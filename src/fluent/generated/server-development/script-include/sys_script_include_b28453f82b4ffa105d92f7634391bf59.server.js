var AlertsQueryEngine = Class.create();
AlertsQueryEngine.prototype = {
    initialize: function() {
        this.TIME_WINDOWS = {
            '1h': 1,
            '2h': 2,
            '6h': 6,
            '12h': 12,
            '24h': 24,
            '2d': 48
        };
    },

    /**
     * Main query method - gets alerts and anomalies for specified CIs and time range
     * @param {Object} filters - { ciSysIds: [], timeRange: '24h', startTime: timestamp, endTime: timestamp }
     * @return {Object} - { alerts: [], anomalies: [], summary: {} }
     */
    queryAlerts: function(filters) {
        gs.info('[AlertsQueryEngine] Starting query with filters: ' + JSON.stringify(filters));

        var timeInfo = this._calculateTimeRange(filters);

        var alerts = this._queryAlerts(filters.ciSysIds, timeInfo);
        var anomalies = this._queryAnomalies(filters.ciSysIds, timeInfo);

        var summary = this._generateSummary(alerts, anomalies);

        gs.info('[AlertsQueryEngine] Found ' + alerts.length + ' alerts, ' + anomalies.length + ' anomalies');

        return {
            alerts: alerts,
            anomalies: anomalies,
            summary: summary,
            timeRange: {
                start: timeInfo.start.getDisplayValue(),
                end: timeInfo.end.getDisplayValue(),
                hours: timeInfo.hours
            }
        };
    },

    /**
     * Calculate time range from custom timestamps or standard time window
     */
    _calculateTimeRange: function(filters) {
        var start, end, hours;

        if (filters.startTime && filters.endTime) {
            // Custom time range
            start = new GlideDateTime();
            start.setNumericValue(filters.startTime);

            end = new GlideDateTime();
            end.setNumericValue(filters.endTime);

            var durationMs = filters.endTime - filters.startTime;
            hours = durationMs / (1000 * 60 * 60);

            gs.info('[AlertsQueryEngine] Using custom time range');
            gs.info('  Start: ' + start.getDisplayValue());
            gs.info('  End: ' + end.getDisplayValue());
            gs.info('  Duration: ' + hours.toFixed(2) + ' hours');
        } else {
            // Standard time window
            var timeRange = filters.timeRange || '24h';
            hours = this.TIME_WINDOWS[timeRange] || 24;

            end = new GlideDateTime();
            start = new GlideDateTime(end);
            start.addSeconds(-1 * hours * 60 * 60);

            gs.info('[AlertsQueryEngine] Using standard time range - ' + timeRange);
        }

        return {
            start: start,
            end: end,
            hours: hours
        };
    },

    /**
     * Query em_alert table
     */
    _queryAlerts: function(ciSysIds, timeInfo) {
        var alerts = [];

        if (!ciSysIds || ciSysIds.length === 0) {
            gs.warn('[AlertsQueryEngine] No CI sys_ids provided for alerts query');
            return alerts;
        }

        var alertGR = new GlideRecord('em_alert');
        alertGR.addQuery('cmdb_ci', 'IN', ciSysIds.join(','));
        alertGR.addQuery('sys_created_on', '>=', timeInfo.start);
        alertGR.addQuery('sys_created_on', '<=', timeInfo.end);
        alertGR.orderByDesc('sys_created_on');
        alertGR.setLimit(200);
        alertGR.query();

        gs.info('[AlertsQueryEngine] Querying em_alert for ' + ciSysIds.length + ' CIs');

        while (alertGR.next()) {
            alerts.push(this._formatAlert(alertGR));
        }

        return alerts;
    },

    /**
     * Query em_alert_anomaly table
     */
    _queryAnomalies: function(ciSysIds, timeInfo) {
        var anomalies = [];

        if (!ciSysIds || ciSysIds.length === 0) {
            gs.warn('[AlertsQueryEngine] No CI sys_ids provided for anomalies query');
            return anomalies;
        }

        var anomalyGR = new GlideRecord('em_alert_anomaly');
        anomalyGR.addQuery('cmdb_ci', 'IN', ciSysIds.join(','));
        anomalyGR.addQuery('sys_created_on', '>=', timeInfo.start);
        anomalyGR.addQuery('sys_created_on', '<=', timeInfo.end);
        anomalyGR.orderByDesc('sys_created_on');
        anomalyGR.setLimit(200);
        anomalyGR.query();

        gs.info('[AlertsQueryEngine] Querying em_alert_anomaly for ' + ciSysIds.length + ' CIs');

        while (anomalyGR.next()) {
            anomalies.push(this._formatAnomaly(anomalyGR));
        }

        return anomalies;
    },

    /**
     * Format em_alert record into clean JSON
     * ⬅️ ENHANCED: Constructs full metric name with resource, includes group_source and parent_number
     */
    _formatAlert: function(gr) {
        // Parse additional_info JSON
        var additionalInfo = {};
        var additionalInfoStr = '';
        try {
            additionalInfoStr = gr.getValue('additional_info');
            if (additionalInfoStr) {
                additionalInfo = JSON.parse(additionalInfoStr);
            }
        } catch (e) {
            gs.warn('[AlertsQueryEngine] Failed to parse additional_info: ' + e);
        }

        // ⬅️ CONSTRUCT FULL METRIC NAME WITH RESOURCE
        var metricName = gr.getValue('metric_name') || '';
        var resource = gr.getValue('resource') || '';

        // If resource exists and is not empty, append it in brackets
        // Format: "metric_name [resource]"
        if (resource && resource.trim() !== '') {
            metricName = metricName + ' [' + resource + ']';
        }

        // ⬅️ GET PARENT ALERT NUMBER (for dashboard Parent column)
        var parentSysId = gr.getValue('parent');
        var parentNumber = null;
        if (parentSysId) {
            var parentGr = new GlideRecord('em_alert');
            if (parentGr.get(parentSysId)) {
                parentNumber = parentGr.getValue('number');
            }
        }

        return {
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            type: 'alert',
            source: gr.getValue('source'),

            // CI Information
            ci_sys_id: gr.getValue('cmdb_ci'),
            ci_name: gr.getDisplayValue('cmdb_ci'),
            node: gr.getValue('node'),

            // Alert Details
            metric_name: metricName, // ⬅️ FIXED: Full name with resource
            resource: resource, // ⬅️ Keep original resource field
            severity: parseInt(gr.getValue('severity')),
            severity_label: this._getSeverityLabel(gr.getValue('severity')),
            state: gr.getValue('state'),
            state_value: gr.getValue('state'),

            // Description
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),

            // Assignment
            assignment_group: gr.getDisplayValue('assignment_group'),
            assignment_group_sys_id: gr.getValue('assignment_group'),
            assigned_to: gr.getDisplayValue('assigned_to'),

            // Timing
            initial_event_time: gr.getValue('initial_event_time'),
            last_event_time: gr.getValue('last_event_time'),
            sys_created_on: gr.getValue('sys_created_on'),
            sys_updated_on: gr.getValue('sys_updated_on'),

            // Correlation
            correlation_group: gr.getValue('correlation_group'),
            parent: parentSysId, // ⬅️ Parent sys_id
            parent_number: parentNumber, // ⬅️ NEW - Parent alert number for dashboard
            event_count: parseInt(gr.getValue('event_count')) || 1,

            // ⬅️ NEW - Group Source fields (for dashboard Group column)
            group_source: gr.getValue('group_source'), // ⬅️ Raw value (1-13)
            group_source_label: gr.group_source.getDisplayValue(), // ⬅️ Display label (Tag Cluster, Secondary, etc.)

            // Additional metadata
            event_class: gr.getValue('event_class'),
            additional_info_raw: additionalInfoStr,
            additional_info: additionalInfo,

            // Tags from additional_info
            environment: additionalInfo.t_environment || '',
            ip_address: additionalInfo.t_ip_address || additionalInfo.ip_address || '',
            tech_service: additionalInfo.t_tech_svc || ''
        };
    },

    /**
     * Format em_alert_anomaly record into clean JSON
     * ⬅️ ENHANCED: Constructs full metric name with resource & includes most_anomalous_metric_value
     */
    _formatAnomaly: function(gr) {
        // Parse additional_info JSON
        var additionalInfo = {};
        var additionalInfoStr = '';
        try {
            additionalInfoStr = gr.getValue('additional_info');
            if (additionalInfoStr) {
                additionalInfo = JSON.parse(additionalInfoStr);
            }
        } catch (e) {
            gs.warn('[AlertsQueryEngine] Failed to parse anomaly additional_info: ' + e);
        }

        // ⬅️ CONSTRUCT FULL METRIC NAME WITH RESOURCE
        var metricName = gr.getValue('metric_name') || '';
        var resource = gr.getValue('resource') || '';

        // If resource exists and is not empty, append it in brackets
        // Format: "metric_name [resource]"
        // Example: "system.network.Bytes_Sent/sec [Intel[R]_82574L_Gigabit_Network_Connection]"
        if (resource && resource.trim() !== '') {
            metricName = metricName + ' [' + resource + ']';
        }

        // Extract numeric state value for comparison (4 = Closed)
        var stateValue = gr.getValue('state');
        var stateDisplay = gr.getDisplayValue('state');

        return {
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            type: 'anomaly',
            source: gr.getValue('source'),

            // CI Information
            ci_sys_id: gr.getValue('cmdb_ci'),
            ci_name: gr.getDisplayValue('cmdb_ci'),
            node: gr.getValue('node'),

            // Anomaly Details
            metric_name: metricName, // ⬅️ FIXED: Full name with resource
            resource: resource, // ⬅️ Keep original resource field
            resource_id: gr.getValue('resource_id'),
            severity: parseInt(gr.getValue('severity')),
            severity_label: this._getSeverityLabel(gr.getValue('severity')),
            state: stateDisplay,
            state_value: stateValue,

            // Description
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),

            // Anomaly-specific metrics from additional_info
            anomaly_score: parseFloat(additionalInfo.anomaly_score) || 0,
            max_anomaly_score: parseFloat(additionalInfo.max_anomaly_score) || 0,
            initial_anomaly_score: parseFloat(additionalInfo.initial_anomaly_score) || 0,
            metric_value: parseFloat(additionalInfo.metric_value) || null,
            metric_lower_bound: parseFloat(additionalInfo.metric_lower_bound) || null,
            metric_upper_bound: parseFloat(additionalInfo.metric_upper_bound) || null,
            most_anomalous_metric_value: parseFloat(additionalInfo.most_anomalous_metric_value) || null, // ⬅️ ADDED THIS LINE - THE FIX!
            initial_outlier_metric_value: parseFloat(additionalInfo.initial_outlier_metric_value) || parseFloat(additionalInfo.metric_value) || null,
            model_type: additionalInfo.model_type || '',
            source_metric_type: additionalInfo.source_metric_type || '',

            // Assignment
            assignment_group: additionalInfo.assignment_group || '',

            // Timing
            initial_event_time: gr.getValue('initial_event_time'),
            last_event_time: gr.getValue('last_event_time'),
            sys_created_on: gr.getValue('sys_created_on'),
            sys_updated_on: gr.getValue('sys_updated_on'),

            // Correlation
            correlation_group: gr.getValue('correlation_group'),
            parent: gr.getValue('parent'),

            // Additional metadata
            additional_info_raw: additionalInfoStr,
            additional_info: additionalInfo
        };
    },

    /**
     * Get severity label from severity number
     */
    _getSeverityLabel: function(severity) {
        var severityMap = {
            '0': 'Clear',
            '1': 'Critical',
            '2': 'Major',
            '3': 'Minor',
            '4': 'Warning',
            '5': 'Info'
        };

        return severityMap[severity] || 'Unknown';
    },

    /**
     * Generate summary statistics
     */
    _generateSummary: function(alerts, anomalies) {
        var summary = {
            total_alerts: alerts.length,
            total_anomalies: anomalies.length,
            total_items: alerts.length + anomalies.length,

            alerts_by_severity: {
                critical: 0,
                major: 0,
                minor: 0,
                warning: 0,
                info: 0
            },

            anomalies_by_severity: {
                critical: 0,
                major: 0,
                minor: 0,
                warning: 0,
                info: 0
            },

            alerts_by_state: {},
            anomalies_by_state: {},

            affected_cis: {},
            top_metrics: {},

            anomalies_above_baseline: 0,
            anomalies_below_baseline: 0
        };

        // Analyze alerts
        for (var i = 0; i < alerts.length; i++) {
            var alert = alerts[i];

            // Count by severity
            var sevLabel = alert.severity_label.toLowerCase();
            if (summary.alerts_by_severity[sevLabel] !== undefined) {
                summary.alerts_by_severity[sevLabel]++;
            }

            // Count by state
            var state = alert.state || 'Unknown';
            summary.alerts_by_state[state] = (summary.alerts_by_state[state] || 0) + 1;

            // Track affected CIs
            if (alert.ci_name) {
                summary.affected_cis[alert.ci_name] = (summary.affected_cis[alert.ci_name] || 0) + 1;
            }

            // Track top metrics
            if (alert.metric_name) {
                summary.top_metrics[alert.metric_name] = (summary.top_metrics[alert.metric_name] || 0) + 1;
            }
        }

        // Analyze anomalies
        for (var j = 0; j < anomalies.length; j++) {
            var anomaly = anomalies[j];

            // Count by severity
            var aSevLabel = anomaly.severity_label.toLowerCase();
            if (summary.anomalies_by_severity[aSevLabel] !== undefined) {
                summary.anomalies_by_severity[aSevLabel]++;
            }

            // Count by state
            var aState = anomaly.state || 'Unknown';
            summary.anomalies_by_state[aState] = (summary.anomalies_by_state[aState] || 0) + 1;

            // Track affected CIs
            if (anomaly.ci_name) {
                summary.affected_cis[anomaly.ci_name] = (summary.affected_cis[anomaly.ci_name] || 0) + 1;
            }

            // Track top metrics
            if (anomaly.metric_name) {
                summary.top_metrics[anomaly.metric_name] = (summary.top_metrics[anomaly.metric_name] || 0) + 1;
            }

            // Count anomaly directions
            var desc = anomaly.description || '';
            if (desc.indexOf('above calculated boundary') > -1) {
                summary.anomalies_above_baseline++;
            } else if (desc.indexOf('below calculated boundary') > -1) {
                summary.anomalies_below_baseline++;
            }
        }

        return summary;
    },

    type: 'AlertsQueryEngine'
};