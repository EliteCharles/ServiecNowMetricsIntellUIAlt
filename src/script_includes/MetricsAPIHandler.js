// Script Include: MetricsAPIHandler
// API Name: x_snc_metricintelp.MetricsAPIHandler
// Description: Client-callable Ajax processor for original Metric Intelligence UI
// Active: true
// Access: public
// Client Callable: true
// Extends: AbstractAjaxProcessor

var MetricsAPIHandler = Class.create();
MetricsAPIHandler.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    /**
     * Get metrics with alerts for the original UI page
     * Delegates to MetricsQueryEngine for metrics data
     */
    getMetricsWithAlerts: function() {
        var response = {
            success: false,
            metrics: [],
            alerts: [],
            error: ''
        };

        try {
            // Build filters from parameters
            var filters = this._buildFiltersFromParams();

            // Query metrics using MetricsQueryEngine
            var engine = new x_snc_metricintelp.MetricsQueryEngine();
            var result = engine.queryMetricsWithAnalysis(filters);

            // Map to expected format
            response.success = true;
            response.metrics = result.metrics || [];
            response.alerts = []; // Alerts would be queried separately if needed
            response.totalMetrics = result.metrics ? result.metrics.length : 0;

            gs.info('MetricsAPIHandler: Returned ' + response.totalMetrics + ' metrics');

        } catch (e) {
            gs.error('MetricsAPIHandler: Error in getMetricsWithAlerts - ' + e.message);
            response.error = 'Failed to query metrics: ' + e.message;
        }

        return JSON.stringify(response);
    },

    /**
     * Build filters object from sysparm parameters
     * @returns {Object} Filters compatible with MetricsQueryEngine
     * @private
     */
    _buildFiltersFromParams: function() {
        var filters = {};

        // Time range
        var timeRange = this.getParameter('sysparm_time_range');
        if (timeRange) {
            filters.timeRange = timeRange;
        }

        // Custom time range (epoch ms)
        var startTime = this.getParameter('sysparm_start_time');
        var endTime = this.getParameter('sysparm_end_time');
        if (startTime && endTime) {
            filters.startTime = parseInt(startTime, 10);
            filters.endTime = parseInt(endTime, 10);
        }

        // CI filtering
        var ciSysIds = this.getParameter('sysparm_ci_sys_ids');
        if (ciSysIds) {
            filters.ciSysIds = ciSysIds.split(',');
        }

        // CI class
        var ciClass = this.getParameter('sysparm_ci_class');
        if (ciClass && ciClass !== 'All') {
            filters.ciClass = ciClass;
        }

        // Platform
        var platform = this.getParameter('sysparm_platform');
        if (platform) {
            filters.platform = platform;
        }

        // CI name
        var ciName = this.getParameter('sysparm_ci_name');
        if (ciName) {
            filters.ciName = ciName;
        }

        // Metric category
        var category = this.getParameter('sysparm_category');
        if (category) {
            filters.metricCategory = category;
        }

        // Max agents
        var maxAgents = this.getParameter('sysparm_max_agents');
        if (maxAgents) {
            filters.maxAgents = parseInt(maxAgents, 10);
        }

        return filters;
    },

    type: 'MetricsAPIHandler'
});
