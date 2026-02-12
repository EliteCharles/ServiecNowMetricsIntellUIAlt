// Script Include: x_snc_metricintelp.ACCAlertCorrelator
// Name: ACCAlertCorrelator
// Description: Alert correlation engine for ACC metrics - queries em_alert,
//              performs temporal correlation between alerts and metric spikes,
//              extracts alert patterns, and calculates correlation confidence.
// API Name: x_snc_metricintelp.ACCAlertCorrelator
// Access: public
// Client Callable: false
// Active: true

// ============================================================================
// ACCAlertCorrelator - ACC Alert Correlation Engine
// ============================================================================
// VERSION: 1.0
// SCOPE: x_snc_metricintelp
// PURPOSE:
// - Query em_alert for ACC/ITOM Agent sourced alerts
// - Correlate alerts with ACC metric spike data
// - Detect temporal patterns (alerts during metric anomalies)
// - Calculate multi-dimensional correlation strength & confidence
// ============================================================================

var ACCAlertCorrelator = Class.create();
ACCAlertCorrelator.prototype = {

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    initialize: function() {
        this.VERSION = '1.0';
        this.SCOPE = 'x_snc_metricintelp';
        this.LOG_PREFIX = '[ACCAlertCorrelator]';

        // Standard time windows for alert queries
        this.TIME_WINDOWS = {
            '1h': 1,
            '2h': 2,
            '6h': 6,
            '12h': 12,
            '24h': 24,
            '2d': 48,
            '7d': 168
        };

        // ACC-specific alert sources to filter on
        this.ACC_SOURCES = [
            'ITOM Agent',
            'ACC',
            'Agent Client Collector'
        ];

        // Temporal correlation window in seconds: alerts within this window
        // of a metric spike are considered temporally correlated
        this.CORRELATION_WINDOW_SECONDS = 300; // 5 minutes

        // Severity mapping (em_alert severity integer to label)
        this.SEVERITY_MAP = {
            '0': 'Clear',
            '1': 'Critical',
            '2': 'Major',
            '3': 'Minor',
            '4': 'Warning',
            '5': 'Info'
        };

        gs.info(this.LOG_PREFIX + ' Initialized v' + this.VERSION + ' (scope: ' + this.SCOPE + ')');
    },

    // ========================================================================
    // PUBLIC: queryAlerts
    // ========================================================================
    // Queries em_alert for ACC-related alerts for a given CI and time range.
    //
    // @param {string} ciSysId - sys_id of the CI (cmdb_ci)
    // @param {object} timeRange - { start: GlideDateTime|string, end: GlideDateTime|string }
    //                             OR { timeRange: '1h'|'6h'|'24h'|... }
    // @returns {object} { success, alerts[], anomalies[], summary, timeRange }
    // ========================================================================

    queryAlerts: function(ciSysId, timeRange) {
        gs.info(this.LOG_PREFIX + ' ===== QUERY ALERTS START =====');
        gs.info(this.LOG_PREFIX + ' CI: ' + ciSysId);
        gs.info(this.LOG_PREFIX + ' TimeRange: ' + JSON.stringify(timeRange));

        if (!ciSysId) {
            gs.warn(this.LOG_PREFIX + ' No CI sys_id provided');
            return {
                success: false,
                error: 'No CI sys_id provided',
                alerts: [],
                anomalies: [],
                summary: this._emptyAlertSummary()
            };
        }

        var timeInfo = this._calculateTimeRange(timeRange);
        var alerts = this._queryACCAlerts(ciSysId, timeInfo);
        var anomalies = this._queryAnomalies(ciSysId, timeInfo);
        var summary = this._generateAlertSummary(alerts, anomalies);

        gs.info(this.LOG_PREFIX + ' ===== QUERY RESULTS =====');
        gs.info(this.LOG_PREFIX + ' Alerts: ' + alerts.length);
        gs.info(this.LOG_PREFIX + ' Anomalies: ' + anomalies.length);

        return {
            success: true,
            alerts: alerts,
            anomalies: anomalies,
            summary: summary,
            version: this.VERSION,
            timeRange: {
                start: timeInfo.start.getDisplayValue(),
                end: timeInfo.end.getDisplayValue(),
                hours: timeInfo.hours
            }
        };
    },

    // ========================================================================
    // PUBLIC: correlateAlertsWithMetrics
    // ========================================================================
    // Performs multi-dimensional correlation between alerts and metric data.
    // Combines temporal correlation, severity weighting, and pattern analysis
    // to produce an overall correlation assessment.
    //
    // @param {array} alerts - Array of alert objects from queryAlerts()
    // @param {array} metrics - Array of metric data points with spike info
    //   Each metric: { timestamp, value, isSpike, metricName, ... }
    // @returns {object} Correlation result with strength, confidence, details
    // ========================================================================

    correlateAlertsWithMetrics: function(alerts, metrics) {
        gs.info(this.LOG_PREFIX + ' ===== CORRELATION START =====');
        gs.info(this.LOG_PREFIX + ' Alerts count: ' + (alerts ? alerts.length : 0));
        gs.info(this.LOG_PREFIX + ' Metrics count: ' + (metrics ? metrics.length : 0));

        // Edge case: no data
        if ((!alerts || alerts.length === 0) && (!metrics || metrics.length === 0)) {
            return this._buildCorrelationResult('none', 0, 'No alerts or metrics data available', []);
        }

        // Extract spikes from metrics
        var spikes = this._extractSpikes(metrics);

        // Edge case: metrics only, no alerts
        if (!alerts || alerts.length === 0) {
            if (spikes.length > 0) {
                return this._buildCorrelationResult('metric-only', 70,
                    spikes.length + ' metric spike(s) detected without corresponding alerts', []);
            }
            return this._buildCorrelationResult('none', 0, 'No alerts and no metric spikes', []);
        }

        // Edge case: alerts only, no spikes
        if (spikes.length === 0) {
            var patterns = this._extractAlertPatterns(alerts);
            return this._buildCorrelationResult('alert-only', 65,
                alerts.length + ' alert(s) found without metric spikes', patterns);
        }

        // Full correlation: both alerts and spikes present
        var temporalCorrelations = this._findTemporalCorrelations(alerts, spikes);
        var alertPatterns = this._extractAlertPatterns(alerts);
        var severityScore = this._calculateSeverityScore(alerts);

        // Calculate overall correlation strength and confidence
        var correlationRatio = temporalCorrelations.length / Math.max(alerts.length, spikes.length);
        var strength, confidence;

        if (correlationRatio >= 0.6 && temporalCorrelations.length >= 3) {
            strength = 'high';
            confidence = Math.min(95, 85 + Math.round(correlationRatio * 10));
        } else if (correlationRatio >= 0.3 || temporalCorrelations.length >= 2) {
            strength = 'medium';
            confidence = 75 + Math.round(correlationRatio * 10);
        } else if (temporalCorrelations.length >= 1) {
            strength = 'low';
            confidence = 60 + Math.round(correlationRatio * 10);
        } else {
            strength = 'low';
            confidence = 55;
        }

        // Boost confidence for high-severity alerts
        if (severityScore >= 3) {
            confidence = Math.min(98, confidence + 5);
        }

        var description = temporalCorrelations.length + ' temporal correlation(s) found between ' +
            alerts.length + ' alert(s) and ' + spikes.length + ' metric spike(s)';

        gs.info(this.LOG_PREFIX + ' Correlation strength: ' + strength +
            ', confidence: ' + confidence + ', ratio: ' + correlationRatio.toFixed(3));

        return this._buildCorrelationResult(strength, confidence, description, alertPatterns, {
            temporal_correlations: temporalCorrelations,
            correlation_ratio: Math.round(correlationRatio * 1000) / 1000,
            spike_count: spikes.length,
            alert_count: alerts.length,
            severity_score: severityScore,
            matched_count: temporalCorrelations.length
        });
    },

    // ========================================================================
    // PUBLIC: _findTemporalCorrelations
    // ========================================================================
    // Finds alerts that occur within the correlation window of metric spikes.
    // A temporal correlation means an alert fired close in time to when a
    // metric crossed its threshold.
    //
    // @param {array} alerts - Alert objects with sys_created_on timestamps
    // @param {array} spikes - Metric spike objects with timestamp field
    // @returns {array} Array of correlation objects linking alerts to spikes
    // ========================================================================

    _findTemporalCorrelations: function(alerts, spikes) {
        var correlations = [];
        var windowMs = this.CORRELATION_WINDOW_SECONDS * 1000;

        for (var i = 0; i < alerts.length; i++) {
            var alert = alerts[i];
            var alertTime = this._toEpochMs(alert.sys_created_on);

            if (!alertTime) {
                continue;
            }

            for (var j = 0; j < spikes.length; j++) {
                var spike = spikes[j];
                var spikeTime = this._toEpochMs(spike.timestamp);

                if (!spikeTime) {
                    continue;
                }

                var timeDiffMs = Math.abs(alertTime - spikeTime);

                if (timeDiffMs <= windowMs) {
                    var proximity = 1 - (timeDiffMs / windowMs); // 1.0 = exact match, 0.0 = edge of window

                    correlations.push({
                        alert_number: alert.number || '',
                        alert_sys_id: alert.sys_id || '',
                        alert_severity: alert.severity || 0,
                        alert_severity_label: alert.severity_label || '',
                        alert_description: alert.short_description || alert.description || '',
                        alert_time: alert.sys_created_on,
                        spike_time: spike.timestamp,
                        spike_metric: spike.metricName || spike.metric_name || '',
                        spike_value: spike.value || 0,
                        time_diff_seconds: Math.round(timeDiffMs / 1000),
                        proximity_score: Math.round(proximity * 100) / 100,
                        direction: alertTime <= spikeTime ? 'alert_before_spike' : 'alert_after_spike'
                    });
                }
            }
        }

        // Sort by proximity (closest temporal match first)
        correlations.sort(function(a, b) {
            return b.proximity_score - a.proximity_score;
        });

        gs.info(this.LOG_PREFIX + ' Found ' + correlations.length + ' temporal correlations');
        return correlations;
    },

    // ========================================================================
    // PUBLIC: _extractAlertPatterns
    // ========================================================================
    // Analyzes alerts to detect recurring patterns: repeated severities,
    // common sources, metric name clusters, and alert frequency.
    //
    // @param {array} alerts - Array of alert objects
    // @returns {array} Array of pattern objects describing detected patterns
    // ========================================================================

    _extractAlertPatterns: function(alerts) {
        if (!alerts || alerts.length === 0) {
            return [];
        }

        var patterns = [];

        // --- Severity distribution ---
        var severityCounts = {};
        for (var i = 0; i < alerts.length; i++) {
            var sevLabel = alerts[i].severity_label || 'Unknown';
            severityCounts[sevLabel] = (severityCounts[sevLabel] || 0) + 1;
        }

        var dominantSeverity = '';
        var dominantCount = 0;
        for (var sev in severityCounts) {
            if (severityCounts[sev] > dominantCount) {
                dominantCount = severityCounts[sev];
                dominantSeverity = sev;
            }
        }

        if (dominantCount > 1) {
            patterns.push({
                type: 'severity_cluster',
                description: dominantCount + ' alerts with ' + dominantSeverity + ' severity',
                severity: dominantSeverity,
                count: dominantCount,
                percentage: Math.round((dominantCount / alerts.length) * 100)
            });
        }

        // --- Source distribution ---
        var sourceCounts = {};
        for (var s = 0; s < alerts.length; s++) {
            var source = alerts[s].source || 'Unknown';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        }

        for (var src in sourceCounts) {
            if (sourceCounts[src] >= 2) {
                patterns.push({
                    type: 'source_cluster',
                    description: sourceCounts[src] + ' alerts from source: ' + src,
                    source: src,
                    count: sourceCounts[src]
                });
            }
        }

        // --- Metric name clustering ---
        var metricCounts = {};
        for (var m = 0; m < alerts.length; m++) {
            var metricName = alerts[m].metric_name || '';
            if (metricName) {
                metricCounts[metricName] = (metricCounts[metricName] || 0) + 1;
            }
        }

        for (var metric in metricCounts) {
            if (metricCounts[metric] >= 2) {
                patterns.push({
                    type: 'metric_cluster',
                    description: metricCounts[metric] + ' alerts for metric: ' + metric,
                    metric_name: metric,
                    count: metricCounts[metric]
                });
            }
        }

        // --- Alert frequency / burst detection ---
        if (alerts.length >= 3) {
            var timestamps = [];
            for (var t = 0; t < alerts.length; t++) {
                var epoch = this._toEpochMs(alerts[t].sys_created_on);
                if (epoch) {
                    timestamps.push(epoch);
                }
            }
            timestamps.sort(function(a, b) { return a - b; });

            if (timestamps.length >= 3) {
                var totalSpanMs = timestamps[timestamps.length - 1] - timestamps[0];
                var totalSpanMinutes = totalSpanMs / (1000 * 60);

                // Burst: 3+ alerts within 10 minutes
                var burstCount = 0;
                var burstWindowMs = 10 * 60 * 1000;
                for (var b = 0; b < timestamps.length; b++) {
                    var windowCount = 0;
                    for (var w = b; w < timestamps.length; w++) {
                        if (timestamps[w] - timestamps[b] <= burstWindowMs) {
                            windowCount++;
                        } else {
                            break;
                        }
                    }
                    if (windowCount > burstCount) {
                        burstCount = windowCount;
                    }
                }

                if (burstCount >= 3) {
                    patterns.push({
                        type: 'alert_burst',
                        description: burstCount + ' alerts within a 10-minute window (possible incident storm)',
                        burst_count: burstCount,
                        total_span_minutes: Math.round(totalSpanMinutes)
                    });
                }

                // Frequency: alerts per hour
                if (totalSpanMinutes > 0) {
                    var alertsPerHour = Math.round((alerts.length / (totalSpanMinutes / 60)) * 10) / 10;
                    if (alertsPerHour >= 5) {
                        patterns.push({
                            type: 'high_frequency',
                            description: alertsPerHour + ' alerts/hour over ' + Math.round(totalSpanMinutes) + ' minutes',
                            alerts_per_hour: alertsPerHour,
                            total_span_minutes: Math.round(totalSpanMinutes)
                        });
                    }
                }
            }
        }

        gs.info(this.LOG_PREFIX + ' Extracted ' + patterns.length + ' alert patterns');
        return patterns;
    },

    // ========================================================================
    // PRIVATE: _queryACCAlerts
    // ========================================================================
    // Queries em_alert table filtered for ACC/ITOM Agent source alerts.
    //
    // @param {string} ciSysId - CI sys_id
    // @param {object} timeInfo - { start: GlideDateTime, end: GlideDateTime, hours }
    // @returns {array} Formatted alert objects
    // ========================================================================

    _queryACCAlerts: function(ciSysId, timeInfo) {
        var alerts = [];

        gs.info(this.LOG_PREFIX + ' Querying em_alert for CI: ' + ciSysId);
        gs.info(this.LOG_PREFIX + '   Time: ' + timeInfo.start.getDisplayValue() + ' to ' + timeInfo.end.getDisplayValue());

        var alertGR = new GlideRecord('em_alert');
        alertGR.addQuery('cmdb_ci', ciSysId);
        alertGR.addQuery('sys_created_on', '>=', timeInfo.start);
        alertGR.addQuery('sys_created_on', '<=', timeInfo.end);

        // NOTE: No source filter - show all alerts for this CI regardless of source

        alertGR.orderByDesc('sys_created_on');
        alertGR.setLimit(200);
        alertGR.query();

        while (alertGR.next()) {
            alerts.push(this._formatAlert(alertGR));
        }

        gs.info(this.LOG_PREFIX + ' Found ' + alerts.length + ' alerts for CI ' + ciSysId);
        return alerts;
    },

    // ========================================================================
    // PRIVATE: _queryAnomalies
    // ========================================================================
    // Queries em_alert_anomaly for anomalies related to the CI.
    //
    // @param {string} ciSysId - CI sys_id
    // @param {object} timeInfo - { start: GlideDateTime, end: GlideDateTime, hours }
    // @returns {array} Formatted anomaly objects
    // ========================================================================

    _queryAnomalies: function(ciSysId, timeInfo) {
        var anomalies = [];

        gs.info(this.LOG_PREFIX + ' Querying em_alert_anomaly for CI: ' + ciSysId);

        var anomalyGR = new GlideRecord('em_alert_anomaly');
        anomalyGR.addQuery('cmdb_ci', ciSysId);
        anomalyGR.addQuery('sys_created_on', '>=', timeInfo.start);
        anomalyGR.addQuery('sys_created_on', '<=', timeInfo.end);
        anomalyGR.orderByDesc('sys_created_on');
        anomalyGR.setLimit(200);
        anomalyGR.query();

        while (anomalyGR.next()) {
            anomalies.push(this._formatAnomaly(anomalyGR));
        }

        gs.info(this.LOG_PREFIX + ' Found ' + anomalies.length + ' anomalies');
        return anomalies;
    },

    // ========================================================================
    // PRIVATE: _formatAlert
    // ========================================================================

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
            gs.warn(this.LOG_PREFIX + ' Failed to parse additional_info for ' + gr.getValue('number') + ': ' + e);
        }

        // Build metric name with resource context
        var metricName = gr.getValue('metric_name') || '';
        var resource = gr.getValue('resource') || '';

        if (!metricName || metricName.trim() === '') {
            metricName = gr.getDisplayValue('type') || '';
        }
        if (resource && resource.trim() !== '') {
            metricName = metricName + ' [' + resource + ']';
        }

        // Resolve parent alert number
        var parent = gr.getValue('parent');
        var parentNumber = null;
        if (parent) {
            var parentGr = new GlideRecord('em_alert');
            if (parentGr.get(parent)) {
                parentNumber = parentGr.getValue('number');
            }
        }

        // Resolve CI class
        var cmdbCiSysId = gr.getValue('cmdb_ci');
        var ciClass = '';
        if (cmdbCiSysId) {
            var ciGr = new GlideRecord('cmdb_ci');
            if (ciGr.get(cmdbCiSysId)) {
                ciClass = ciGr.getValue('sys_class_name') || 'cmdb_ci';
            }
        }

        var severity = parseInt(gr.getValue('severity'));

        return {
            // Standard alert fields
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            sys_created_on: gr.getValue('sys_created_on'),
            sys_updated_on: gr.getValue('sys_updated_on'),
            state: gr.getDisplayValue('state'),
            severity: severity,
            severity_label: this._getSeverityLabel(severity.toString()),
            source: gr.getValue('source'),

            // CI information
            cmdb_ci_sys_id: cmdbCiSysId,
            ci_name: gr.getDisplayValue('cmdb_ci'),
            ci_class: ciClass,
            node: gr.getValue('node'),

            // Metric information
            metric_name: metricName,
            resource: resource,

            // Descriptions
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),

            // Event details
            event_count: parseInt(gr.getValue('event_count')) || 1,
            initial_event_time: gr.getValue('initial_event_time'),
            last_event_time: gr.getValue('last_event_time'),

            // Grouping
            group_source: gr.getValue('group_source'),
            group_source_label: gr.group_source ? gr.group_source.getDisplayValue() : '',
            correlation_group: gr.getValue('correlation_group'),
            parent: parent,
            parent_number: parentNumber,

            // Assignment
            assignment_group: gr.getDisplayValue('assignment_group'),
            assigned_to: gr.getDisplayValue('assigned_to'),

            // Type
            type: 'alert',
            type_display: gr.getDisplayValue('type'),
            event_class: gr.getValue('event_class'),

            // ACC-specific context from additional_info
            acc_agent_id: additionalInfo.agent_id || '',
            acc_check_name: additionalInfo.check_name || '',
            acc_check_type: additionalInfo.check_type || '',

            // Additional info
            additional_info: additionalInfo
        };
    },

    // ========================================================================
    // PRIVATE: _formatAnomaly
    // ========================================================================

    _formatAnomaly: function(gr) {
        var additionalInfo = {};
        try {
            var raw = gr.getValue('additional_info');
            if (raw) {
                additionalInfo = JSON.parse(raw);
            }
        } catch (e) {
            gs.warn(this.LOG_PREFIX + ' Failed to parse anomaly additional_info: ' + e);
        }

        var metricName = gr.getValue('metric_name') || '';
        var resource = gr.getValue('resource') || '';
        if (resource && resource.trim() !== '') {
            metricName = metricName + ' [' + resource + ']';
        }

        return {
            sys_id: gr.getUniqueValue(),
            number: gr.getValue('number'),
            type: 'anomaly',
            source: gr.getValue('source'),

            // CI
            cmdb_ci_sys_id: gr.getValue('cmdb_ci'),
            ci_name: gr.getDisplayValue('cmdb_ci'),
            node: gr.getValue('node'),

            // Metric
            metric_name: metricName,
            resource: resource,

            // Severity and state
            severity: parseInt(gr.getValue('severity')),
            severity_label: this._getSeverityLabel(gr.getValue('severity')),
            state: gr.getDisplayValue('state'),

            // Descriptions
            short_description: gr.getValue('short_description'),
            description: gr.getValue('description'),

            // Anomaly scores
            anomaly_score: parseFloat(additionalInfo.anomaly_score) || 0,
            max_anomaly_score: parseFloat(additionalInfo.max_anomaly_score) || 0,

            // Metric values and bounds
            metric_value: parseFloat(additionalInfo.metric_value) || null,
            metric_lower_bound: parseFloat(additionalInfo.metric_lower_bound) || null,
            metric_upper_bound: parseFloat(additionalInfo.metric_upper_bound) || null,

            // Timestamps
            initial_event_time: gr.getValue('initial_event_time'),
            last_event_time: gr.getValue('last_event_time'),
            sys_created_on: gr.getValue('sys_created_on'),
            sys_updated_on: gr.getValue('sys_updated_on'),

            // Correlation
            correlation_group: gr.getValue('correlation_group'),
            parent: gr.getValue('parent'),

            // Additional info
            additional_info: additionalInfo
        };
    },

    // ========================================================================
    // PRIVATE: Helper Methods
    // ========================================================================

    _calculateTimeRange: function(timeRange) {
        var start, end, hours;

        if (timeRange && timeRange.start && timeRange.end) {
            // Explicit start/end provided
            if (typeof timeRange.start === 'string') {
                start = new GlideDateTime(timeRange.start);
            } else {
                start = timeRange.start;
            }
            if (typeof timeRange.end === 'string') {
                end = new GlideDateTime(timeRange.end);
            } else {
                end = timeRange.end;
            }

            var durationMs = end.getNumericValue() - start.getNumericValue();
            hours = durationMs / (1000 * 60 * 60);
        } else {
            // Use named time range
            var rangeName = (timeRange && timeRange.timeRange) ? timeRange.timeRange : '24h';
            hours = this.TIME_WINDOWS[rangeName] || 24;

            end = new GlideDateTime();
            start = new GlideDateTime(end);
            start.addSeconds(-1 * hours * 60 * 60);
        }

        return { start: start, end: end, hours: hours };
    },

    _extractSpikes: function(metrics) {
        var spikes = [];
        if (!metrics || metrics.length === 0) {
            return spikes;
        }

        for (var i = 0; i < metrics.length; i++) {
            if (metrics[i].isSpike || metrics[i].is_spike) {
                spikes.push(metrics[i]);
            }
        }

        return spikes;
    },

    _calculateSeverityScore: function(alerts) {
        // Weighted severity: Critical=5, Major=4, Minor=3, Warning=2, Info=1
        var weights = { '1': 5, '2': 4, '3': 3, '4': 2, '5': 1 };
        var totalWeight = 0;

        for (var i = 0; i < alerts.length; i++) {
            var sev = String(alerts[i].severity || 5);
            totalWeight += (weights[sev] || 1);
        }

        return alerts.length > 0 ? Math.round((totalWeight / alerts.length) * 10) / 10 : 0;
    },

    _buildCorrelationResult: function(strength, confidence, description, patterns, details) {
        return {
            correlation_strength: strength,
            confidence: confidence,
            description: description,
            patterns: patterns || [],
            details: details || {},
            timestamp: new GlideDateTime().getDisplayValue(),
            version: this.VERSION
        };
    },

    _toEpochMs: function(dateValue) {
        if (!dateValue) {
            return null;
        }

        try {
            var gdt = new GlideDateTime(String(dateValue));
            return gdt.getNumericValue();
        } catch (e) {
            return null;
        }
    },

    _getSeverityLabel: function(severity) {
        return this.SEVERITY_MAP[severity] || 'Unknown';
    },

    _generateAlertSummary: function(alerts, anomalies) {
        var summary = this._emptyAlertSummary();
        summary.total_alerts = alerts.length;
        summary.total_anomalies = anomalies.length;
        summary.total_items = alerts.length + anomalies.length;

        // Summarize alerts
        for (var i = 0; i < alerts.length; i++) {
            var alert = alerts[i];
            var sevLabel = (alert.severity_label || 'unknown').toLowerCase();
            if (summary.alerts_by_severity[sevLabel] !== undefined) {
                summary.alerts_by_severity[sevLabel]++;
            }

            var state = alert.state || 'Unknown';
            summary.alerts_by_state[state] = (summary.alerts_by_state[state] || 0) + 1;

            if (alert.ci_name) {
                summary.affected_cis[alert.ci_name] = (summary.affected_cis[alert.ci_name] || 0) + 1;
            }
            if (alert.metric_name) {
                summary.top_metrics[alert.metric_name] = (summary.top_metrics[alert.metric_name] || 0) + 1;
            }
        }

        // Summarize anomalies
        for (var j = 0; j < anomalies.length; j++) {
            var anomaly = anomalies[j];
            var aSevLabel = (anomaly.severity_label || 'unknown').toLowerCase();
            if (summary.anomalies_by_severity[aSevLabel] !== undefined) {
                summary.anomalies_by_severity[aSevLabel]++;
            }

            var desc = anomaly.description || '';
            if (desc.indexOf('above calculated boundary') > -1) {
                summary.anomalies_above_baseline++;
            } else if (desc.indexOf('below calculated boundary') > -1) {
                summary.anomalies_below_baseline++;
            }
        }

        return summary;
    },

    _emptyAlertSummary: function() {
        return {
            total_alerts: 0,
            total_anomalies: 0,
            total_items: 0,
            alerts_by_severity: {
                critical: 0, major: 0, minor: 0, warning: 0, info: 0
            },
            anomalies_by_severity: {
                critical: 0, major: 0, minor: 0, warning: 0, info: 0
            },
            alerts_by_state: {},
            affected_cis: {},
            top_metrics: {},
            anomalies_above_baseline: 0,
            anomalies_below_baseline: 0
        };
    },

    type: 'ACCAlertCorrelator'
};
