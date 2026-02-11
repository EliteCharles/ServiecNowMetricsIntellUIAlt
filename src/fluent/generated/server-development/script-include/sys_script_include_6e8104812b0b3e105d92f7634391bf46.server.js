// Script Include: x_snc_metricintelp.ACCAlertCorrelatorAjax
// Name: ACCAlertCorrelatorAjax
// Description: Client-callable Ajax processor for ACC alert correlation.
//              Provides a GlideAjax endpoint for retrieving alerts and
//              correlation analysis from the client side.
// API Name: x_snc_metricintelp.ACCAlertCorrelatorAjax
// Extends: AbstractAjaxProcessor
// Access: public
// Client Callable: true
// Active: true

// ============================================================================
// ACCAlertCorrelatorAjax - Client-Callable Alert Correlation Endpoint
// ============================================================================
// VERSION: 1.0
// SCOPE: x_snc_metricintelp
// PURPOSE:
// - Expose ACCAlertCorrelator capabilities via GlideAjax
// - Accept CI sys_id, time range, and optional metric data from client
// - Return alerts with full correlation analysis as JSON
// ============================================================================

var ACCAlertCorrelatorAjax = Class.create();
ACCAlertCorrelatorAjax.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    // ========================================================================
    // getAlertsWithCorrelation
    // ========================================================================
    // Client-callable method that retrieves alerts for a CI and performs
    // correlation analysis against provided metric spike data.
    //
    // Client-side usage:
    //   var ga = new GlideAjax('x_snc_metricintelp.ACCAlertCorrelatorAjax');
    //   ga.addParam('sysparm_name', 'getAlertsWithCorrelation');
    //   ga.addParam('sysparm_ci_sys_id', ciSysId);
    //   ga.addParam('sysparm_time_range', '24h');
    //   ga.addParam('sysparm_metrics', JSON.stringify(metricsArray)); // optional
    //   ga.getXMLAnswer(function(response) {
    //       var result = JSON.parse(response);
    //   });
    //
    // Parameters (via sysparm):
    //   sysparm_ci_sys_id  - (required) sys_id of the CI
    //   sysparm_time_range - (optional) '1h','6h','24h','2d','7d' (default: '24h')
    //   sysparm_start_time - (optional) explicit start time (overrides time_range)
    //   sysparm_end_time   - (optional) explicit end time (overrides time_range)
    //   sysparm_metrics    - (optional) JSON array of metric data with spike info
    //
    // Returns: JSON string with alerts, anomalies, correlation, and summary
    // ========================================================================

    getAlertsWithCorrelation: function() {
        var LOG_PREFIX = '[ACCAlertCorrelatorAjax]';

        // --- Extract parameters ---
        var ciSysId = this.getParameter('sysparm_ci_sys_id');
        var timeRangeParam = this.getParameter('sysparm_time_range') || '24h';
        var startTime = this.getParameter('sysparm_start_time');
        var endTime = this.getParameter('sysparm_end_time');
        var metricsParam = this.getParameter('sysparm_metrics');

        gs.info(LOG_PREFIX + ' Request - CI: ' + ciSysId + ', Range: ' + timeRangeParam);

        // --- Validate required parameters ---
        if (!ciSysId) {
            gs.warn(LOG_PREFIX + ' Missing required parameter: sysparm_ci_sys_id');
            return JSON.stringify({
                success: false,
                error: 'Missing required parameter: sysparm_ci_sys_id',
                alerts: [],
                anomalies: [],
                correlation: null,
                summary: null
            });
        }

        // --- Build time range object ---
        var timeRange;
        if (startTime && endTime) {
            timeRange = {
                start: startTime,
                end: endTime
            };
        } else {
            timeRange = {
                timeRange: timeRangeParam
            };
        }

        // --- Parse optional metrics data ---
        var metrics = [];
        if (metricsParam) {
            try {
                metrics = JSON.parse(metricsParam);
                if (!Array.isArray(metrics)) {
                    gs.warn(LOG_PREFIX + ' sysparm_metrics is not an array, ignoring');
                    metrics = [];
                }
            } catch (e) {
                gs.warn(LOG_PREFIX + ' Failed to parse sysparm_metrics: ' + e);
                metrics = [];
            }
        }

        // --- Execute alert query ---
        var correlator = new x_snc_metricintelp.ACCAlertCorrelator();
        var alertResult = correlator.queryAlerts(ciSysId, timeRange);

        // --- Perform correlation if metrics provided ---
        var correlation = null;
        if (metrics.length > 0 && alertResult.success) {
            correlation = correlator.correlateAlertsWithMetrics(alertResult.alerts, metrics);
        } else if (alertResult.success && alertResult.alerts.length > 0) {
            // No metrics provided - return alert-only correlation
            correlation = correlator.correlateAlertsWithMetrics(alertResult.alerts, []);
        }

        // --- Build response ---
        var response = {
            success: alertResult.success,
            alerts: alertResult.alerts,
            anomalies: alertResult.anomalies,
            alert_count: alertResult.alerts.length,
            anomaly_count: alertResult.anomalies.length,
            correlation: correlation,
            summary: alertResult.summary,
            time_range: alertResult.timeRange,
            version: alertResult.version
        };

        gs.info(LOG_PREFIX + ' Response - Alerts: ' + response.alert_count +
            ', Anomalies: ' + response.anomaly_count +
            ', Correlation: ' + (correlation ? correlation.correlation_strength : 'N/A'));

        return JSON.stringify(response);
    },

    type: 'ACCAlertCorrelatorAjax'
});