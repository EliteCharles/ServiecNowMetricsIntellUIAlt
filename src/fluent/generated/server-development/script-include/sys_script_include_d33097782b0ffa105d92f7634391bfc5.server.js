var MetricsQueryEngine = Class.create();
MetricsQueryEngine.prototype = {
    initialize: function() {
        this.TIME_WINDOWS = {
            '1h': 1,
            '2h': 2,
            '6h': 6,
            '12h': 12,
            '24h': 24,
            '2d': 48
        };
        
        this.metricTypeCache = {};
        this.loadMetricTypeCache();
    },
    
    loadMetricTypeCache: function() {
        var metricTypeGR = new GlideRecord('sa_metric_type');
        metricTypeGR.setLimit(1000);
        metricTypeGR.query();
        
        while (metricTypeGR.next()) {
            var metricType = metricTypeGR.getValue('metric_type');
            var tinyName = metricTypeGR.getValue('metric_type_tiny_name');
            
            if (tinyName) {
                this.metricTypeCache[metricType] = tinyName;
            }
        }
        
        gs.info('MetricsQueryEngine: Loaded ' + Object.keys(this.metricTypeCache).length + ' metric types');
    },
    
    _getSamplingInterval: function(timeRange) {
        return 1; // No sampling - return all datapoints
    },
    
    _downsampleData: function(values, samplingInterval) {
        if (samplingInterval <= 1 || !values || values.length === 0) {
            return values;
        }
        
        var sampled = [];
        for (var i = 0; i < values.length; i += samplingInterval) {
            sampled.push(values[i]);
        }
        
        return sampled;
    },
    
    /**
     * Main query method - supports custom time ranges and CI filtering
     */
    queryMetrics: function(filters) {
        var allMetrics = [];
        
        var agents = this._getFilteredAgents(filters);
        
        gs.info('MetricsQueryEngine: Found ' + agents.length + ' agents');
        
        var timeInfo = this._calculateTimeRange(filters);
        gs.info('MetricsQueryEngine: Time range - ' + 
                timeInfo.start.getDisplayValue() + ' to ' + 
                timeInfo.end.getDisplayValue());
        
        for (var i = 0; i < agents.length; i++) {
            var agent = agents[i];
            
            var metricDefinitions = this._getMetricDefinitions(agent.ciClass, filters);
            var resources = this._getResources(agent.cmdbCiSysId);
            
            var ciMetrics = this._queryCIMetrics(agent, metricDefinitions, timeInfo);
            allMetrics = allMetrics.concat(ciMetrics);
            
            var resourceMetrics = this._queryResourceMetrics(agent, resources, metricDefinitions, timeInfo);
            allMetrics = allMetrics.concat(resourceMetrics);
        }
        
        gs.info('MetricsQueryEngine: Found ' + allMetrics.length + ' total metrics');
        
        var grouped = this._groupMetricsByType(allMetrics);
        
        return grouped;
    },
    
    /**
     * Calculate time range from custom timestamps or standard time window
     */
    _calculateTimeRange: function(filters) {
        var start, end, hours, isCustomRange;
        
        if (filters.startTime && filters.endTime) {
            start = new GlideDateTime();
            start.setNumericValue(filters.startTime);
            
            end = new GlideDateTime();
            end.setNumericValue(filters.endTime);
            
            var durationMs = filters.endTime - filters.startTime;
            hours = durationMs / (1000 * 60 * 60);
            
            isCustomRange = true;
            
            gs.info('MetricsQueryEngine: Using custom time range (ZOOM)');
            gs.info('  Start: ' + start.getDisplayValue());
            gs.info('  End: ' + end.getDisplayValue());
            gs.info('  Duration: ' + hours.toFixed(2) + ' hours');
        } else {
            var timeRange = filters.timeRange || '24h';
            hours = this.TIME_WINDOWS[timeRange] || 24;
            
            end = new GlideDateTime();
            start = new GlideDateTime(end);
            start.addSeconds(-1 * hours * 60 * 60);
            
            isCustomRange = false;
            
            gs.info('MetricsQueryEngine: Using standard time range - ' + timeRange);
        }
        
        var samplingInterval = this._getSamplingInterval(filters.timeRange || hours + 'h');
        
        return {
            start: start,
            end: end,
            hours: hours,
            samplingInterval: samplingInterval,
            isCustomRange: isCustomRange
        };
    },
    
    /**
     * Get filtered ACC agents - supports CI sys_id filtering
     * FIXED: Eliminated N+1 query problem by using dot-walking to access related record fields
     */
    _getFilteredAgents: function(filters) {
        var agents = [];

        var agentInfo = new GlideRecord('sn_agent_ci_extended_info');
        agentInfo.addQuery('data_collection', '0');
        agentInfo.addQuery('status', '0');
        agentInfo.addQuery('running_checks_num', '>', 2);

        // Filter by CI sys_ids if provided
        if (filters.ciSysIds && filters.ciSysIds.length > 0) {
            agentInfo.addQuery('cmdb_ci', 'IN', filters.ciSysIds.join(','));
        }

        agentInfo.setLimit(filters.maxAgents || 50);
        agentInfo.query();

        while (agentInfo.next()) {
            var cmdbCiSysId = agentInfo.getValue('cmdb_ci');
            if (!cmdbCiSysId) continue;

            // Use dot-walking to access related record fields directly
            // This eliminates the need for additional queries
            var ciName = agentInfo.cmdb_ci.name.toString();
            var ciClass = agentInfo.cmdb_ci.sys_class_name.toString();

            // Skip if CI doesn't exist or is invalid
            if (!ciName || !ciClass) continue;

            var platform = this._getPlatformFromCIClass(ciClass);

            // Use dot-walking for support group
            var supportGroupName = 'N/A';
            if (agentInfo.cmdb_ci.support_group) {
                supportGroupName = agentInfo.cmdb_ci.support_group.name.toString() || 'N/A';
            }

            // Use dot-walking for location
            var locationName = 'N/A';
            if (agentInfo.cmdb_ci.location) {
                locationName = agentInfo.cmdb_ci.location.name.toString() || 'N/A';
            }

            // Use dot-walking for IP address from CI record
            var ipAddress = agentInfo.cmdb_ci.ip_address.toString() || agentInfo.getValue('ip_address');

            // Apply filters
            if (filters.platform) {
                var filterPlatform = filters.platform.toLowerCase();
                if (filterPlatform === 'windows' && platform !== 'Windows') continue;
                if (filterPlatform === 'linux' && platform !== 'Linux') continue;
            }

            if (filters.ciName && ciName !== filters.ciName) continue;
            if (filters.ciClass && ciClass !== filters.ciClass) continue;

            agents.push({
                name: agentInfo.getValue('name'),
                agentId: agentInfo.getValue('agent_id'),
                cmdbCiSysId: cmdbCiSysId,
                ciName: ciName,
                ciClass: ciClass,
                platform: platform,
                supportGroup: supportGroupName,
                location: locationName,
                ipAddress: ipAddress
            });
        }

        return agents;
    },
    
    _getPlatformFromCIClass: function(ciClass) {
        if (!ciClass) return 'Unknown';
        
        if (ciClass === 'cmdb_ci_linux_server') {
            return 'Linux';
        } else if (ciClass === 'cmdb_ci_win_server') {
            return 'Windows';
        } else if (ciClass.indexOf('linux') !== -1) {
            return 'Linux';
        } else if (ciClass.indexOf('win') !== -1) {
            return 'Windows';
        }
        
        return 'Unknown';
    },
    
    _getMetricDefinitions: function(ciClass, filters) {
        var metricDefs = [];
        
        var dashboardMetadata = new GlideRecord('sa_metric_dashboard_metadata');
        dashboardMetadata.addQuery('source', 'ITOM Agent');
        dashboardMetadata.addQuery('cmdb_ci_type', ciClass);
        dashboardMetadata.addQuery('active', true);
        
        if (filters.metricCategory) {
            dashboardMetadata.addQuery('title', 'CONTAINS', filters.metricCategory);
        }

        dashboardMetadata.setLimit(100);
        dashboardMetadata.query();

        // First pass: collect all sys_ids and their categories
        var sysIdToCategory = {};
        var allSysIds = [];

        while (dashboardMetadata.next()) {
            var category = dashboardMetadata.getValue('title');
            var sourceMetricsSysIds = dashboardMetadata.getValue('source_metrics_types') || '';

            if (sourceMetricsSysIds) {
                var sysIds = sourceMetricsSysIds.split(',');

                for (var i = 0; i < sysIds.length; i++) {
                    var sysId = sysIds[i].trim();
                    if (sysId) {
                        sysIdToCategory[sysId] = category;
                        allSysIds.push(sysId);
                    }
                }
            }
        }

        // Batch load all source metric types with a single query
        if (allSysIds.length > 0) {
            var sourceMetricTypeMap = {};

            var sourceMetricType = new GlideRecord('sa_source_metric_type');
            sourceMetricType.addQuery('sys_id', 'IN', allSysIds.join(','));
            sourceMetricType.query();

            while (sourceMetricType.next()) {
                var sysId = sourceMetricType.getUniqueValue();
                sourceMetricTypeMap[sysId] = {
                    metricType: sourceMetricType.getValue('source_metric_type'),
                    displayName: sourceMetricType.getValue('display_name'),
                    unit: sourceMetricType.getValue('unit') || ''
                };
            }

            // Build metric definitions using the cached data
            for (var j = 0; j < allSysIds.length; j++) {
                var sysId = allSysIds[j];
                var metricData = sourceMetricTypeMap[sysId];

                if (metricData) {
                    var metricType = metricData.metricType;
                    var displayName = metricData.displayName || metricType;
                    var unit = metricData.unit;
                    var category = sysIdToCategory[sysId];

                    var tinyName = this.metricTypeCache[metricType];

                    if (tinyName) {
                        metricDefs.push({
                            metricType: metricType,
                            tinyName: tinyName,
                            displayName: displayName,
                            unit: unit,
                            category: category
                        });
                    }
                }
            }
        }

        return metricDefs;
    },
    
    _getResources: function(ciSysId) {
        var resources = [];

        var resourceGR = new GlideRecord('ci_resource_hardware');
        resourceGR.addQuery('cmdb_ci', ciSysId);
        resourceGR.setLimit(50);
        resourceGR.query();
        
        while (resourceGR.next()) {
            resources.push({
                name: resourceGR.getValue('name'),
                sysId: resourceGR.getUniqueValue(),
                type: resourceGR.getValue('type')
            });
        }
        
        return resources;
    },
    
    _queryCIMetrics: function(agent, metricDefinitions, timeInfo) {
        var results = [];
        var samplingInterval = timeInfo.samplingInterval;
        
        var ciRecord = new GlideRecord(agent.ciClass);
        if (!ciRecord.get(agent.cmdbCiSysId)) return results;
        
        for (var i = 0; i < metricDefinitions.length; i++) {
            var metricDef = metricDefinitions[i];
            
            try {
                var builder = new sn_clotho.Transformer(ciRecord);
                builder.metric(metricDef.tinyName);
                var result = builder.execute(timeInfo.start, timeInfo.end);
                
                if (result && result.getData() && result.getData().getValues()) {
                    var values = result.getData().getValues();
                    
                    if (values && values.length > 0) {
                        var sampledValues = this._downsampleData(values, samplingInterval);
                        
                        results.push(this._formatMetricResult(
                            agent,
                            metricDef,
                            sampledValues,
                            null,
                            false,
                            samplingInterval,
                            timeInfo.start,
                            timeInfo.end
                        ));
                    }
                }
            } catch (e) {
                // Metric not available
            }
        }
        
        return results;
    },
    
    _queryResourceMetrics: function(agent, resources, metricDefinitions, timeInfo) {
        var results = [];
        var samplingInterval = timeInfo.samplingInterval;
        
        for (var r = 0; r < resources.length; r++) {
            var resource = resources[r];
            
            var resourceRecord = new GlideRecord('ci_resource_hardware');
            if (!resourceRecord.get(resource.sysId)) continue;
            
            for (var m = 0; m < metricDefinitions.length; m++) {
                var metricDef = metricDefinitions[m];
                
                try {
                    var builder = new sn_clotho.Transformer(resourceRecord);
                    builder.metric(metricDef.tinyName).avg();
                    var result = builder.execute(timeInfo.start, timeInfo.end);
                    
                    if (result && result.getData() && result.getData().getValues()) {
                        var values = result.getData().getValues();
                        
                        if (values && values.length > 0) {
                            var sampledValues = this._downsampleData(values, samplingInterval);
                            
                            results.push(this._formatMetricResult(
                                agent,
                                metricDef,
                                sampledValues,
                                resource.name,
                                true,
                                samplingInterval,
                                timeInfo.start,
                                timeInfo.end
                            ));
                        }
                    }
                } catch (e) {
                    // Metric not available
                }
            }
        }
        
        return results;
    },
    
    _formatMetricResult: function(agent, metricDef, values, resourceId, isResourceBased, samplingInterval, startTime, endTime) {
        var sum = 0;
        var min = parseFloat(values[0]);
        var max = parseFloat(values[0]);
        
        for (var i = 0; i < values.length; i++) {
            var val = parseFloat(values[i]);
            if (!isNaN(val)) {
                sum += val;
                if (val < min) min = val;
                if (val > max) max = val;
            }
        }
        
        var avg = sum / values.length;
        
        return {
            agentName: agent.name,
            ciName: agent.ciName,
            ciSysId: agent.cmdbCiSysId,
            ciClass: agent.ciClass,
            platform: agent.platform,
            supportGroup: agent.supportGroup,
            location: agent.location,
            metricName: metricDef.metricType,
            metricType: metricDef.metricType,
            tinyName: metricDef.tinyName,
            category: metricDef.category,
            unit: metricDef.unit || this._inferUnit(metricDef.metricType),
            isResourceBased: isResourceBased,
            resourceId: resourceId,
            dataPoints: values.length,
            lastValue: parseFloat(values[values.length - 1]).toFixed(2),
            avgValue: avg.toFixed(2),
            minValue: min.toFixed(2),
            maxValue: max.toFixed(2),
            values: values,
            timestamps: this._generateTimestampsFromRange(values.length, startTime, endTime)
        };
    },
    
    _inferUnit: function(metricType) {
        var lower = metricType.toLowerCase();
        
        if (lower.indexOf('percentage') > -1 || lower.indexOf('percent') > -1) return '%';
        if (lower.indexOf('bytes') > -1) return 'Bytes';
        if (lower.indexOf('kb') > -1) return 'KB';
        if (lower.indexOf('gb') > -1) return 'GB';
        if (lower.indexOf('sec') > -1) return '/sec';
        if (lower.indexOf('packets') > -1) return 'packets';
        if (lower.indexOf('time') > -1) return 'ms';
        
        return '';
    },
    
    _generateTimestampsFromRange: function(count, startTime, endTime) {
        var timestamps = [];
        
        if (!startTime || !endTime || count <= 0) {
            return timestamps;
        }
        
        var startMs = startTime.getNumericValue();
        var endMs = endTime.getNumericValue();
        var intervalMs = (endMs - startMs) / (count - 1);
        
        for (var i = 0; i < count; i++) {
            var timestampMs = startMs + (i * intervalMs);
            var gdt = new GlideDateTime();
            gdt.setNumericValue(timestampMs);
            timestamps.push(gdt.getDisplayValue());
        }
        
        return timestamps;
    },
    
    _groupMetricsByType: function(results) {
        var grouped = {};
        
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            
            var key = result.metricType + '_' + (result.resourceId || 'CI');
            
            if (!grouped[key]) {
                grouped[key] = {
                    id: key,
                    name: result.resourceId ? 
                        result.metricType + ' [' + result.resourceId + ']' : 
                        result.metricType,
                    metricType: result.metricType,
                    tinyName: result.tinyName,
                    unit: result.unit,
                    ciClass: result.ciClass,
                    category: result.category,
                    isResourceBased: result.isResourceBased,
                    resourceId: result.resourceId,
                    location: result.location,
                    supportGroup: result.supportGroup,
                    hosts: [],
                    data: []
                };
            }
            
            grouped[key].hosts.push(result.ciName);
            grouped[key].data.push({
                host: result.ciName,
                values: result.values,
                timestamps: result.timestamps,
                current: result.lastValue,
                avg: result.avgValue,
                min: result.minValue,
                max: result.maxValue
            });
        }
        
        var groupedArray = [];
        for (var k in grouped) {
            groupedArray.push(grouped[k]);
        }
        
        return groupedArray;
    },
    
    type: 'MetricsQueryEngine'
};