// Script Include: MetricsQueryEngine
// API Name: x_snc_metricintelp.MetricsQueryEngine
// Description: Enhanced ACC metrics query engine with spike detection and signal categorization
// Active: true
// Access: package_private
// Client Callable: false

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

        this.SPIKE_THRESHOLD = 2.0;

        this.SIGNAL_PATTERNS = {
            errors:     ['error', 'fail', 'fault'],
            latency:    ['latency', 'response', 'duration'],
            saturation: ['cpu', 'memory', 'disk'],
            traffic:    [] // default bucket
        };

        this.metricTypeCache = {};
        this.loadMetricTypeCache();
    },

    loadMetricTypeCache: function() {
        var metricTypeGR = new GlideRecord('sa_metric_type');
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

    // ========================================================================
    // CORE QUERY METHODS (preserved from x_snc_metric2ai.MetricsQueryEngine)
    // ========================================================================

    /**
     * Main query method - supports custom time ranges and CI filtering.
     * Returns grouped metrics without analysis enrichment.
     * @param {Object} filters - Query filters (timeRange, ciSysIds, platform, etc.)
     * @returns {Array} Grouped metric results
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

    // ========================================================================
    // ENHANCED QUERY METHOD - Metrics + Spike Detection + Signal Analysis
    // ========================================================================

    /**
     * Enhanced query that returns metrics enriched with spike detection and
     * RED/USE signal categorization. Builds on queryMetrics without modifying
     * the base data pipeline.
     *
     * @param {Object} filters - Same filters as queryMetrics
     * @returns {Object} result
     * @returns {Array}  result.metrics   - Grouped metrics (same as queryMetrics)
     * @returns {Object} result.analysis  - Aggregated analysis summary
     * @returns {Array}  result.spikes    - Metrics flagged as spikes
     * @returns {Object} result.signals   - Metrics bucketed by RED/USE signal
     */
    queryMetricsWithAnalysis: function(filters) {
        var grouped = this.queryMetrics(filters);

        var spikes = [];
        var signals = {
            errors: [],
            latency: [],
            saturation: [],
            traffic: []
        };
        var totalMetrics = 0;

        for (var i = 0; i < grouped.length; i++) {
            var metricGroup = grouped[i];
            totalMetrics++;

            // Categorize by RED/USE signal
            var signal = this._categorizeMetric(metricGroup.metricType || metricGroup.name);
            signals[signal].push(metricGroup.name);

            // Analyze each host series within the group
            if (metricGroup.data && metricGroup.data.length > 0) {
                for (var d = 0; d < metricGroup.data.length; d++) {
                    var hostData = metricGroup.data[d];
                    var behavior = this._analyzeMetricBehavior(hostData);

                    // Attach analysis inline
                    hostData.analysis = behavior;

                    if (behavior.isSpike) {
                        spikes.push({
                            metricName: metricGroup.name,
                            metricType: metricGroup.metricType,
                            host: hostData.host,
                            signal: signal,
                            ratio: behavior.ratio,
                            max: behavior.max,
                            avg: behavior.avg,
                            severity: behavior.severity
                        });
                    }
                }
            }
        }

        var analysis = {
            totalMetrics: totalMetrics,
            totalSpikes: spikes.length,
            spikeRate: totalMetrics > 0 ? (spikes.length / totalMetrics * 100).toFixed(1) + '%' : '0%',
            signalBreakdown: {
                errors: signals.errors.length,
                latency: signals.latency.length,
                saturation: signals.saturation.length,
                traffic: signals.traffic.length
            },
            healthScore: this._calculateHealthScore(spikes, totalMetrics)
        };

        gs.info('MetricsQueryEngine: Analysis complete - ' +
                spikes.length + ' spikes detected across ' +
                totalMetrics + ' metric groups');

        return {
            metrics: grouped,
            analysis: analysis,
            spikes: spikes,
            signals: signals
        };
    },

    // ========================================================================
    // SPIKE DETECTION
    // ========================================================================

    /**
     * Analyze a single metric host series for spike behavior.
     * A spike is defined as max/avg ratio >= SPIKE_THRESHOLD (default 2.0).
     *
     * @param {Object} metric - Host-level metric data with avg, max, min fields
     * @returns {Object} Behavioral analysis result
     * @returns {number} result.max       - Parsed max value
     * @returns {number} result.avg       - Parsed avg value
     * @returns {number} result.min       - Parsed min value
     * @returns {number} result.ratio     - max / avg ratio
     * @returns {boolean} result.isSpike  - Whether this metric exhibits a spike
     * @returns {string}  result.severity - 'critical' | 'warning' | 'normal'
     */
    _analyzeMetricBehavior: function(metric) {
        var max = parseFloat(metric.max) || 0;
        var avg = parseFloat(metric.avg) || 0;
        var min = parseFloat(metric.min) || 0;

        var ratio = avg > 0 ? max / avg : 1.0;
        var isSpike = ratio >= this.SPIKE_THRESHOLD;

        var severity = 'normal';
        if (ratio >= 5.0) {
            severity = 'critical';
        } else if (ratio >= this.SPIKE_THRESHOLD) {
            severity = 'warning';
        }

        return {
            max: max,
            avg: avg,
            min: min,
            ratio: parseFloat(ratio.toFixed(2)),
            isSpike: isSpike,
            severity: severity
        };
    },

    // ========================================================================
    // SIGNAL CATEGORIZATION (RED/USE methodology)
    // ========================================================================

    /**
     * Categorize a metric name into a RED/USE signal bucket.
     * Matching is case-insensitive against known keyword patterns.
     *
     * @param {string} name - Metric type name or display name
     * @returns {string} Signal category: 'errors' | 'latency' | 'saturation' | 'traffic'
     */
    _categorizeMetric: function(name) {
        if (!name) {
            return 'traffic';
        }

        var lower = name.toLowerCase();

        // Check errors first (highest priority signal)
        var errorPatterns = this.SIGNAL_PATTERNS.errors;
        for (var e = 0; e < errorPatterns.length; e++) {
            if (lower.indexOf(errorPatterns[e]) !== -1) {
                return 'errors';
            }
        }

        // Check latency
        var latencyPatterns = this.SIGNAL_PATTERNS.latency;
        for (var l = 0; l < latencyPatterns.length; l++) {
            if (lower.indexOf(latencyPatterns[l]) !== -1) {
                return 'latency';
            }
        }

        // Check saturation
        var saturationPatterns = this.SIGNAL_PATTERNS.saturation;
        for (var s = 0; s < saturationPatterns.length; s++) {
            if (lower.indexOf(saturationPatterns[s]) !== -1) {
                return 'saturation';
            }
        }

        // Default: traffic
        return 'traffic';
    },

    // ========================================================================
    // HEALTH SCORING
    // ========================================================================

    /**
     * Calculate an overall health score (0-100) based on spike prevalence.
     * Scores are weighted: critical spikes count 2x vs warnings.
     *
     * @param {Array} spikes - Array of detected spike objects
     * @param {number} totalMetrics - Total number of metric groups
     * @returns {number} Health score between 0 and 100
     */
    _calculateHealthScore: function(spikes, totalMetrics) {
        if (totalMetrics === 0) {
            return 100;
        }

        var penalty = 0;
        for (var i = 0; i < spikes.length; i++) {
            if (spikes[i].severity === 'critical') {
                penalty += 2;
            } else {
                penalty += 1;
            }
        }

        var score = Math.max(0, 100 - (penalty / totalMetrics * 100));
        return parseFloat(score.toFixed(1));
    },

    // ========================================================================
    // TIME RANGE CALCULATION
    // ========================================================================

    /**
     * Calculate time range from custom timestamps or standard time window.
     * @param {Object} filters - Filters with optional startTime/endTime or timeRange
     * @returns {Object} Time range info with start, end, hours, samplingInterval
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

    // ========================================================================
    // AGENT FILTERING
    // ========================================================================

    /**
     * Get filtered ACC agents - supports CI sys_id filtering.
     * Uses string values for scoped app compatibility.
     * @param {Object} filters - Filters with optional ciSysIds, platform, ciName, ciClass, maxAgents
     * @returns {Array} Array of agent descriptor objects
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

            var ciRecord = new GlideRecord('cmdb_ci');
            if (!ciRecord.get(cmdbCiSysId)) continue;

            var ciName = ciRecord.getValue('name');
            var ciClass = ciRecord.getValue('sys_class_name');

            var platform = this._getPlatformFromCIClass(ciClass);

            var supportGroupName = 'N/A';
            var supportGroupSysId = ciRecord.getValue('support_group');
            if (supportGroupSysId) {
                var sgGR = new GlideRecord('sys_user_group');
                if (sgGR.get(supportGroupSysId)) {
                    supportGroupName = sgGR.getValue('name');
                }
            }

            var locationName = 'N/A';
            var locationSysId = ciRecord.getValue('location');
            if (locationSysId) {
                var locGR = new GlideRecord('cmn_location');
                if (locGR.get(locationSysId)) {
                    locationName = locGR.getValue('name');
                }
            }

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
                ipAddress: agentInfo.getValue('ip_address')
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

    // ========================================================================
    // METRIC DEFINITIONS & RESOURCES
    // ========================================================================

    _getMetricDefinitions: function(ciClass, filters) {
        var metricDefs = [];

        var dashboardMetadata = new GlideRecord('sa_metric_dashboard_metadata');
        dashboardMetadata.addQuery('source', 'ITOM Agent');
        dashboardMetadata.addQuery('cmdb_ci_type', ciClass);
        dashboardMetadata.addQuery('active', true);

        if (filters.metricCategory) {
            dashboardMetadata.addQuery('title', 'CONTAINS', filters.metricCategory);
        }

        dashboardMetadata.query();

        while (dashboardMetadata.next()) {
            var category = dashboardMetadata.getValue('title');
            var sourceMetricsSysIds = dashboardMetadata.getValue('source_metrics_types') || '';

            if (sourceMetricsSysIds) {
                var sysIds = sourceMetricsSysIds.split(',');

                for (var i = 0; i < sysIds.length; i++) {
                    var sysId = sysIds[i].trim();

                    var sourceMetricType = new GlideRecord('sa_source_metric_type');
                    if (sourceMetricType.get(sysId)) {
                        var metricType = sourceMetricType.getValue('source_metric_type');
                        var displayName = sourceMetricType.getValue('display_name') || metricType;
                        var unit = sourceMetricType.getValue('unit') || '';

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
        }

        return metricDefs;
    },

    _getResources: function(ciSysId) {
        var resources = [];

        var resourceGR = new GlideRecord('ci_resource_hardware');
        resourceGR.addQuery('cmdb_ci', ciSysId);
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

    // ========================================================================
    // METRIC DATA QUERIES (sn_clotho)
    // ========================================================================

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
                // Metric not available for this CI
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
                    // Metric not available for this resource
                }
            }
        }

        return results;
    },

    // ========================================================================
    // FORMATTING & UTILITIES
    // ========================================================================

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