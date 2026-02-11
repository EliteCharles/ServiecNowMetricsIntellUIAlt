// Script Include: MetricsQueryEngineAjax
// API Name: x_snc_metricintelp.MetricsQueryEngineAjax
// Description: Client-callable Ajax processor for metrics querying with AI insights
// Active: true
// Access: public
// Client Callable: true
// Extends: AbstractAjaxProcessor

var MetricsQueryEngineAjax = Class.create();
MetricsQueryEngineAjax.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    /**
     * Client-callable method that returns ACC metrics enriched with spike
     * detection analysis and RED/USE signal categorization.
     *
     * Expected sysparm parameters (passed via GlideAjax addParam):
     *   sysparm_time_range  - Time window: '1h','2h','6h','12h','24h','2d' (default '24h')
     *   sysparm_ci_sys_ids  - Comma-separated CI sys_ids to filter (optional)
     *   sysparm_platform    - 'windows' or 'linux' (optional)
     *   sysparm_ci_name     - Exact CI name filter (optional)
     *   sysparm_ci_class    - CI class filter (optional)
     *   sysparm_category    - Metric category filter (optional)
     *   sysparm_max_agents  - Max agents to query, default 50 (optional)
     *   sysparm_start_time  - Custom start time in ms epoch (optional)
     *   sysparm_end_time    - Custom end time in ms epoch (optional)
     *
     * @returns {string} JSON string with metrics, analysis, spikes, and signals
     */
    getMetricsWithInsights: function() {
        var response = {
            success: false,
            metrics: [],
            analysis: {},
            spikes: [],
            signals: {},
            error: ''
        };

        try {
            var filters = this._buildFiltersFromParams();

            var engine = new x_snc_metricintelp.MetricsQueryEngine();
            var result = engine.queryMetricsWithAnalysis(filters);

            response.success = true;
            response.metrics = result.metrics;
            response.analysis = result.analysis;
            response.spikes = result.spikes;
            response.signals = result.signals;

        } catch (e) {
            gs.error('MetricsQueryEngineAjax: Error in getMetricsWithInsights - ' + e.message);
            response.error = 'Failed to query metrics: ' + e.message;
        }

        return JSON.stringify(response);
    },

    /**
     * Build a filters object from the incoming sysparm_ parameters.
     * @returns {Object} Filters compatible with MetricsQueryEngine.queryMetrics
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

        // CI class
        var ciClass = this.getParameter('sysparm_ci_class');
        if (ciClass) {
            filters.ciClass = ciClass;
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

    type: 'MetricsQueryEngineAjax'
});
