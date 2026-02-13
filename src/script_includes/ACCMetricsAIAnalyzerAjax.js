// Script Include: ACCMetricsAIAnalyzerAjax
// API Name: x_snc_metricintelp.ACCMetricsAIAnalyzerAjax
// Description: Client-callable Ajax processor for ACC Metrics AI Analysis
// Access: public
// Client Callable: true
// Active: true

var ACCMetricsAIAnalyzerAjax = Class.create();
ACCMetricsAIAnalyzerAjax.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    getSREIntelligenceInsights: function() {
        var ciSysId = this.getParameter('sysparm_ci_sys_id');
        var timeRange = this.getParameter('sysparm_time_range') || '24h';

        // ✅ CRITICAL FIX: Force string conversion to prevent "Cannot read property 'toString'" errors
        var metricsJson = String(this.getParameter('sysparm_metrics') || '[]');

        var metrics = [];
        if (metricsJson) {
            try {
                metrics = JSON.parse(metricsJson);
                gs.info('[ACCMetricsAIAnalyzerAjax] ✓ Successfully parsed ' + metrics.length + ' metrics');
            } catch (e) {
                gs.error('[ACCMetricsAIAnalyzerAjax] Error parsing metrics: ' + e);
                gs.error('[ACCMetricsAIAnalyzerAjax] Metrics JSON (first 500 chars): ' + metricsJson.substring(0, 500));
            }
        }

        try {
            var analyzer = new x_snc_metricintelp.ACCMetricsAIAnalyzerServer();
            var insights = analyzer.getSREIntelligenceInsights(ciSysId, metrics, timeRange);

            return JSON.stringify({
                success: true,
                data: insights
            });
        } catch (e) {
            gs.error('[ACCMetricsAIAnalyzerAjax] Error: ' + e);
            return JSON.stringify({
                success: false,
                error: e.toString()
            });
        }
    },

    ajaxGetCIDetails: function() {
        var ciSysId = this.getParameter('sysparm_ci_sys_id');

        if (!ciSysId) {
            return JSON.stringify({
                success: false,
                error: 'Missing CI sys_id parameter'
            });
        }

        try {
            var ci = new GlideRecord('cmdb_ci');
            if (ci.get(ciSysId)) {
                return JSON.stringify({
                    success: true,
                    sysId: ciSysId,
                    name: ci.getValue('name') || 'Unknown CI',
                    className: ci.sys_class_name.toString() || 'cmdb_ci'
                });
            } else {
                return JSON.stringify({
                    success: false,
                    error: 'CI not found'
                });
            }
        } catch (e) {
            gs.error('[ACCMetricsAIAnalyzerAjax] Error fetching CI details: ' + e);
            return JSON.stringify({
                success: false,
                error: e.toString()
            });
        }
    },

    type: 'ACCMetricsAIAnalyzerAjax'
});
