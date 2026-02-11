var MetricsAPIHandler = Class.create();
MetricsAPIHandler.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
    
    /**
     * Get metrics only (original method)
     */
    getMetrics: function() {
        try {
            var timeRange = this.getParameter('sysparm_time_range') || '24h';
            var startTime = this.getParameter('sysparm_start_time') || '';
            var endTime = this.getParameter('sysparm_end_time') || '';
            var ciClass = this.getParameter('sysparm_ci_class') || '';
            var ciSysIds = this.getParameter('sysparm_ci_sys_ids') || '';
            
            gs.info('[MetricsAPI] getMetrics - Request received');
            gs.info('  Time Range: ' + timeRange);
            gs.info('  Start Time: ' + startTime);
            gs.info('  End Time: ' + endTime);
            gs.info('  CI Class: ' + ciClass);
            
            var filters = {
                timeRange: timeRange,
                ciClass: ciClass,
                maxAgents: 50
            };
            
            // Parse CI sys_ids
            if (ciSysIds) {
                filters.ciSysIds = [];
                var ids = ciSysIds.split(',');
                for (var i = 0; i < ids.length; i++) {
                    var id = ids[i].trim();
                    if (id) {
                        filters.ciSysIds.push(id);
                    }
                }
                gs.info('[MetricsAPI] Filtering by ' + filters.ciSysIds.length + ' CI sys_ids');
            }
            
            // Parse custom time range
            if (startTime && endTime) {
                if (isNaN(startTime)) {
                    var startGDT = new GlideDateTime();
                    startGDT.setDisplayValue(startTime);
                    filters.startTime = parseInt(startGDT.getNumericValue());
                } else {
                    filters.startTime = parseInt(startTime);
                }
                
                if (isNaN(endTime)) {
                    var endGDT = new GlideDateTime();
                    endGDT.setDisplayValue(endTime);
                    filters.endTime = parseInt(endGDT.getNumericValue());
                } else {
                    filters.endTime = parseInt(endTime);
                }
                
                gs.info('[MetricsAPI] Custom time range: ' + 
                        new GlideDateTime(filters.startTime).getDisplayValue() + ' to ' +
                        new GlideDateTime(filters.endTime).getDisplayValue());
            }
            
            // Query metrics using existing engine
            var engine = new x_snc_metricintelp.MetricsQueryEngine();
            var results = engine.queryMetrics(filters);
            
            gs.info('[MetricsAPI] Success - ' + results.length + ' metrics returned');
            
            var response = {
                success: true,
                count: results.length,
                timestamp: new GlideDateTime().getDisplayValue(),
                filters: {
                    timeRange: filters.timeRange,
                    ciClass: filters.ciClass,
                    ciSysIds: filters.ciSysIds || [],
                    hasCustomTimeRange: !!(filters.startTime && filters.endTime)
                },
                data: results
            };
            
            return JSON.stringify(response);
            
        } catch (e) {
            gs.error('[MetricsAPI] ERROR in getMetrics: ' + e.toString());
            gs.error('[MetricsAPI] Stack: ' + e.stack);
            
            var errorResponse = {
                success: false,
                error: e.toString(),
                message: 'Check system logs for details'
            };
            
            return JSON.stringify(errorResponse);
        }
    },
    
    /**
     * Get metrics with alerts and anomalies - combined response
     * This method fetches metrics, alerts, and anomalies in a single call
     */
getMetricsWithAlerts: function() {
    try {
        var timeRange = this.getParameter('sysparm_time_range') || '24h';
        var startTime = this.getParameter('sysparm_start_time') || '';
        var endTime = this.getParameter('sysparm_end_time') || '';
        var ciClass = this.getParameter('sysparm_ci_class') || '';
        var ciSysIds = this.getParameter('sysparm_ci_sys_ids') || '';
        
        gs.info('[MetricsAPI] getMetricsWithAlerts - Request received');
        gs.info('  Time Range: ' + timeRange);
        gs.info('  CI Class: ' + ciClass);
        
        var metricsFilters = {
            timeRange: timeRange,
            ciClass: ciClass,
            maxAgents: 50
        };
        
        // Parse CI sys_ids for metrics query
        var urlCiSysIds = [];
        if (ciSysIds) {
            var ids = ciSysIds.split(',');
            for (var i = 0; i < ids.length; i++) {
                var id = ids[i].trim();
                if (id) {
                    urlCiSysIds.push(id);
                }
            }
            metricsFilters.ciSysIds = urlCiSysIds;
            gs.info('[MetricsAPI] Filtering by ' + urlCiSysIds.length + ' CI sys_ids from URL');
        }
        
        // Parse custom time range
        if (startTime && endTime) {
            if (isNaN(startTime)) {
                var startGDT = new GlideDateTime();
                startGDT.setDisplayValue(startTime);
                metricsFilters.startTime = parseInt(startGDT.getNumericValue());
            } else {
                metricsFilters.startTime = parseInt(startTime);
            }
            
            if (isNaN(endTime)) {
                var endGDT = new GlideDateTime();
                endGDT.setDisplayValue(endTime);
                metricsFilters.endTime = parseInt(endGDT.getNumericValue());
            } else {
                metricsFilters.endTime = parseInt(endTime);
            }
            
            gs.info('[MetricsAPI] Custom time range: ' + 
                    new GlideDateTime(metricsFilters.startTime).getDisplayValue() + ' to ' +
                    new GlideDateTime(metricsFilters.endTime).getDisplayValue());
        }
        
        // Query metrics (returns array directly)
        var metricsEngine = new x_snc_metricintelp.MetricsQueryEngine();
        var metricsArray = metricsEngine.queryMetrics(metricsFilters);
        
        gs.info('[MetricsAPI] MetricsQueryEngine returned ' + metricsArray.length + ' metrics');
        
        // ⬅️ GET CI SYS_IDS FOR ALERTS QUERY
        var alertCiSysIds = [];
        
        // Option 1: Use URL parameters if provided
        if (urlCiSysIds.length > 0) {
            alertCiSysIds = urlCiSysIds;
            gs.info('[MetricsAPI] Using CI sys_ids from URL: ' + alertCiSysIds.length);
        } 
        // Option 2: Query agents directly
        else {
            var agentGR = new GlideRecord('sn_agent_ci_extended_info');
            agentGR.addQuery('status', '0');  // Active agents
            agentGR.addQuery('data_collection', '0');  // Data collection enabled
            
            if (ciClass) {
                agentGR.addQuery('cmdb_ci.sys_class_name', ciClass);
            }
            
            agentGR.query();
            
            while (agentGR.next()) {
                var ciSysId = agentGR.getValue('cmdb_ci');
                if (ciSysId && alertCiSysIds.indexOf(ciSysId) === -1) {
                    alertCiSysIds.push(ciSysId);
                }
            }
            
            gs.info('[MetricsAPI] Queried agents directly, found ' + alertCiSysIds.length + ' CI sys_ids');
        }
        
        // ⬅️ BUILD ALERTS FILTERS WITH CI SYS_IDS
        var alertsFilters = {
            ciSysIds: alertCiSysIds,  // ⬅️ THIS IS THE KEY FIX!
            timeRange: timeRange
        };
        
        // Add custom time range to alerts filters
        if (metricsFilters.startTime && metricsFilters.endTime) {
            alertsFilters.startTime = metricsFilters.startTime;
            alertsFilters.endTime = metricsFilters.endTime;
        }
        
        // Query alerts and anomalies WITH CI sys_ids
        var alertsEngine = new x_snc_metricintelp.AlertsQueryEngine();
        var alertsResult = alertsEngine.queryAlerts(alertsFilters);
        
        gs.info('[MetricsAPI] Success - ' + metricsArray.length + ' metrics, ' + 
                alertsResult.alerts.length + ' alerts, ' + 
                alertsResult.anomalies.length + ' anomalies');
        
        // ⬅️ RETURN STRUCTURE THAT CLIENT EXPECTS
        var response = {
            success: true,
            timestamp: new GlideDateTime().getDisplayValue(),
            filters: {
                timeRange: metricsFilters.timeRange,
                ciClass: metricsFilters.ciClass,
                ciSysIds: alertCiSysIds,
                hasCustomTimeRange: !!(metricsFilters.startTime && metricsFilters.endTime)
            },
            metrics: {
                count: metricsArray.length,
                data: metricsArray  // ⬅️ Client expects metrics.data
            },
            alerts: {
                count: alertsResult.alerts.length,
                data: alertsResult.alerts  // ⬅️ Client expects alerts.data
            },
            anomalies: {
                count: alertsResult.anomalies.length,
                data: alertsResult.anomalies  // ⬅️ Client expects anomalies.data
            },
            summary: alertsResult.summary
        };
        
        return JSON.stringify(response);
        
    } catch (e) {
        gs.error('[MetricsAPI] ERROR in getMetricsWithAlerts: ' + e.toString());
        gs.error('[MetricsAPI] Stack: ' + e.stack);
        
        var errorResponse = {
            success: false,
            error: e.toString(),
            message: 'Check system logs for details',
            metrics: { count: 0, data: [] },
            alerts: { count: 0, data: [] },
            anomalies: { count: 0, data: [] }
        };
        
        return JSON.stringify(errorResponse);
    }
},
    /**
     * Get alerts and anomalies only (without metrics)
     * Lighter weight endpoint for alert-focused views
     */
    getAlerts: function() {
        try {
            var timeRange = this.getParameter('sysparm_time_range') || '24h';
            var startTime = this.getParameter('sysparm_start_time') || '';
            var endTime = this.getParameter('sysparm_end_time') || '';
            var ciSysIds = this.getParameter('sysparm_ci_sys_ids') || '';
            
            gs.info('[MetricsAPI] getAlerts - Request received');
            
            var filters = {
                timeRange: timeRange
            };
            
            // Parse CI sys_ids
            if (ciSysIds) {
                filters.ciSysIds = [];
                var ids = ciSysIds.split(',');
                for (var i = 0; i < ids.length; i++) {
                    var id = ids[i].trim();
                    if (id) {
                        filters.ciSysIds.push(id);
                    }
                }
                gs.info('[MetricsAPI] Filtering by ' + filters.ciSysIds.length + ' CI sys_ids');
            }
            
            // Parse custom time range
            if (startTime && endTime) {
                if (isNaN(startTime)) {
                    var startGDT = new GlideDateTime();
                    startGDT.setDisplayValue(startTime);
                    filters.startTime = parseInt(startGDT.getNumericValue());
                } else {
                    filters.startTime = parseInt(startTime);
                }
                
                if (isNaN(endTime)) {
                    var endGDT = new GlideDateTime();
                    endGDT.setDisplayValue(endTime);
                    filters.endTime = parseInt(endGDT.getNumericValue());
                } else {
                    filters.endTime = parseInt(endTime);
                }
            }
            
            // Query alerts and anomalies only
            var alertsEngine = new x_snc_metricintelp.AlertsQueryEngine();
            var alertsData = alertsEngine.queryAlerts(filters);
            
            gs.info('[MetricsAPI] Success - ' + 
                    alertsData.alerts.length + ' alerts, ' + 
                    alertsData.anomalies.length + ' anomalies');
            
            var response = {
                success: true,
                timestamp: new GlideDateTime().getDisplayValue(),
                filters: {
                    timeRange: filters.timeRange,
                    ciSysIds: filters.ciSysIds || [],
                    hasCustomTimeRange: !!(filters.startTime && filters.endTime)
                },
                alerts: {
                    count: alertsData.alerts.length,
                    data: alertsData.alerts
                },
                anomalies: {
                    count: alertsData.anomalies.length,
                    data: alertsData.anomalies
                },
                summary: alertsData.summary,
                timeRange: alertsData.timeRange
            };
            
            return JSON.stringify(response);
            
        } catch (e) {
            gs.error('[MetricsAPI] ERROR in getAlerts: ' + e.toString());
            gs.error('[MetricsAPI] Stack: ' + e.stack);
            
            var errorResponse = {
                success: false,
                error: e.toString(),
                message: 'Check system logs for details'
            };
            
            return JSON.stringify(errorResponse);
        }
    },
    
    type: 'MetricsAPIHandler'
});