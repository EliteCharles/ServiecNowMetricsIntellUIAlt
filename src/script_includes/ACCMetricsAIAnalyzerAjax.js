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
        var metricsJson = this.getParameter('sysparm_metrics');

        var metrics = [];
        if (metricsJson) {
            try {
                metrics = JSON.parse(metricsJson);
            } catch (e) {
                gs.error('[ACCMetricsAIAnalyzerAjax] Error parsing metrics: ' + e);
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

    type: 'ACCMetricsAIAnalyzerAjax'
});
ACCMetricsAIAnalyzerAjax.prototype.type = 'ACCMetricsAIAnalyzerAjax';
