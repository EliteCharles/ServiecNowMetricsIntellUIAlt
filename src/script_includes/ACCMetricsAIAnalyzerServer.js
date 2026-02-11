// Script Include: x_snc_metricintelp.ACCMetricsAIAnalyzerServer
// Name: ACCMetricsAIAnalyzerServer
// API Name: x_snc_metricintelp.ACCMetricsAIAnalyzerServer
// Description: ACC Metrics AI Analyzer Server v1.0 - HYBRID AI + RULE-BASED ANALYSIS
//              Adapted from global.MetricsAIAnalyzerServer v3.5 for ACC Metrics Intelligence
// Access: public
// Client Callable: false
// Active: true
// Scope: x_snc_metricintelp
//
// ============================================================================
// ACCMetricsAIAnalyzerServer v1.0 - CURRENT METRICS AWARENESS
// ============================================================================
// Adapted from: global.MetricsAIAnalyzerServer v3.5 (Dynatrace version)
// Key Changes:
//   - Scoped to x_snc_metricintelp (ACC Metrics Intelligence)
//   - Replaced Dynatrace-specific references with ACC MetricsQueryEngine
//   - LLM integration uses x_snc_metricintelp.ACCMetricsAILLM
//   - All pattern detection and rule-based analysis preserved
//   - Current metrics assessment (open alerts vs current state) preserved
//   - Hybrid AI + rule-based analysis architecture preserved
// ============================================================================
// Dependencies:
//   - x_snc_metricintelp.ACCMetricsAILLM (Now Assist LLM integration)
//   - x_snc_metricintelp.MetricsQueryEngine (ACC metrics data source)
// Called by: ACCMetricsAIAnalyzerAjax.getSREIntelligenceInsights()
// ============================================================================

var ACCMetricsAIAnalyzerServer = Class.create();
ACCMetricsAIAnalyzerServer.prototype = {

    initialize: function() {
        this.LOG_PREFIX = '[ACCMetricsAIAnalyzerServer]';
        this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5';
        this.SPIKE_RATIO_THRESHOLD = 2.0;
        this.CV_THRESHOLD = 0.5;
        this.MIN_CONFIDENCE = 60;

        // Store original data for current metrics assessment
        this._originalMetrics = null;
        this._originalAlerts = null;
    },

    /**
     * Main entry point: Perform SRE Intelligence analysis for a given CI
     *
     * @param {string} ciSysId - sys_id of the Configuration Item
     * @param {Array} metrics - Array of metric objects from ACC MetricsQueryEngine
     *   Each metric: { name, avg, max, min, current, unit }
     * @param {string} timeRange - Time range: '4h', '12h', '24h'
     * @return {Object} Analysis result with probableCause, alertSummary, recommendations, etc.
     */
    getSREIntelligenceInsights: function(ciSysId, metrics, timeRange) {
        gs.info(this.LOG_PREFIX + ' ===== ANALYSIS START (v1.0 - ACC) =====');

        // Store original data for current assessment
        this._originalMetrics = metrics;

        var result = {
            success: true,
            probableCause: { title: 'System Analysis', description: 'Analyzing...', correlation: 60 },
            alertSummary: { total: 0, open: 0, closed: 0 },
            alertTimelineCorrelation: '',
            metricCorrelation: null,
            recommendations: [],
            ciDetails: null,
            analysisMode: 'basic'
        };

        try {
            if (ciSysId) {
                result.ciDetails = this._getCIDetails(ciSysId);
            }

            var alerts = this.getAlerts(ciSysId, timeRange);
            this._originalAlerts = alerts; // Store for assessment

            result.alertSummary = this._summarizeAlerts(alerts);

            var analysisContext = this._determineAnalysisContext(alerts, metrics, timeRange);
            result.analysisMode = analysisContext.mode;
            result.alertTimelineCorrelation = analysisContext.timelineDescription;

            var metricAnalysis = this._analyzeMetricsWithContext(metrics, analysisContext);
            result.metricCorrelation = metricAnalysis;

            // Pass ciDetails to smart fallback
            result.probableCause = this._determineSmartFallback(alerts, metricAnalysis, analysisContext, result.ciDetails);
            result.recommendations = this._generateSmartRecommendations(result.probableCause, analysisContext);

            gs.info(this.LOG_PREFIX + ' Analysis complete: ' + result.probableCause.title);

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error: ' + e.message);
            gs.error(this.LOG_PREFIX + ' Stack: ' + e.stack);
        }

        return result;
    },

    /**
     * Retrieve alerts for a CI within the specified time range
     * Uses standard em_alert table (source-agnostic, works for ACC context)
     *
     * @param {string} ciSysId - CI sys_id
     * @param {string} timeRange - '4h', '12h', '24h'
     * @return {Array} Alert objects
     */
    getAlerts: function(ciSysId, timeRange) {
        var alerts = [];
        if (!ciSysId) return alerts;

        try {
            var gdt = new GlideDateTime();
            var hours = 24;
            if (timeRange === '12h') hours = 12;
            else if (timeRange === '4h') hours = 4;

            gdt.addSeconds(-hours * 3600);

            var alertGR = new GlideRecord('em_alert');
            alertGR.addQuery('cmdb_ci', ciSysId);
            alertGR.addQuery('sys_created_on', '>=', gdt);
            alertGR.orderByDesc('sys_created_on');
            alertGR.setLimit(100);
            alertGR.query();

            var sevLabels = { '1': 'Critical', '2': 'Major', '3': 'Minor', '4': 'Warning', '5': 'Info' };

            while (alertGR.next()) {
                var sevValue = alertGR.getValue('severity') || '4';
                var additionalInfoRaw = alertGR.getValue('additional_info') || '';
                var parsedInfo = this._parseAdditionalInfo(additionalInfoRaw);

                alerts.push({
                    sys_id: alertGR.getUniqueValue(),
                    number: alertGR.getValue('number') || '',
                    sys_created_on: alertGR.getValue('sys_created_on') || '',
                    initial_event_time: alertGR.getValue('initial_event_time') || '',
                    severity: sevValue,
                    severity_label: sevLabels[sevValue] || 'Warning',
                    state: alertGR.getValue('state') || '',
                    state_display: alertGR.getDisplayValue('state') || '',
                    description: alertGR.getValue('description') || '',
                    short_description: alertGR.getValue('short_description') || '',
                    type_display: alertGR.type.getDisplayValue() || '',
                    // ACC-adapted: Parse additional_info generically (not Dynatrace-specific)
                    event_group_label: parsedInfo.event_group_label,
                    event_description: parsedInfo.event_description,
                    is_root_cause: parsedInfo.is_root_cause,
                    problem_displayId: parsedInfo.problem_displayId,
                    metric_values: parsedInfo.metric_values
                });
            }

            gs.info(this.LOG_PREFIX + ' Retrieved ' + alerts.length + ' alerts');
        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error getting alerts: ' + e.message);
        }

        return alerts;
    },

    /**
     * Parse additional_info JSON from alert record
     * Adapted for ACC: handles both ACC-native and legacy event property formats
     *
     * @param {string} json - additional_info JSON string
     * @return {Object} Parsed info with event_group_label, event_description, etc.
     */
    _parseAdditionalInfo: function(json) {
        var result = {
            event_group_label: '',
            event_description: '',
            is_root_cause: false,
            problem_displayId: '',
            metric_values: {}
        };

        if (!json) return result;

        try {
            var info = JSON.parse(json);
            result.problem_displayId = info.problem_displayId || '';
            result.is_root_cause = info.isRootCause === 'true' || info.isRootCause === true;

            // ACC-adapted: Handle generic event properties
            // Supports both ACC-native format and legacy Dynatrace dt.event.* keys
            if (info.event_properties && Array.isArray(info.event_properties)) {
                for (var i = 0; i < info.event_properties.length; i++) {
                    var prop = info.event_properties[i];
                    var key = prop.key || '';
                    var value = prop.value || '';

                    // ACC event description keys
                    if (key === 'event.description' || key === 'dt.event.description') {
                        result.event_description = value;
                    } else if (key === 'event.group_label' || key === 'dt.event.group_label') {
                        result.event_group_label = value;
                    }
                    // ACC metric value keys (memory, CPU, etc.)
                    else if (key.indexOf('mem_pagefaults') !== -1) {
                        result.metric_values.mem_pagefaults = parseFloat(value);
                    } else if (key.indexOf('mem_percentage_available') !== -1) {
                        result.metric_values.mem_percentage_available = parseFloat(value);
                    } else if (key.indexOf('cpu_usage') !== -1) {
                        result.metric_values.cpu_usage = parseFloat(value);
                    }
                }
            }

            // ACC-native: Also check top-level fields
            if (!result.event_description && info.description) {
                result.event_description = info.description;
            }
            if (!result.event_group_label && info.group_label) {
                result.event_group_label = info.group_label;
            }
        } catch (e) {
            gs.debug(this.LOG_PREFIX + ' Parse error: ' + e.message);
        }

        return result;
    },

    /**
     * Get CI details from CMDB
     */
    _getCIDetails: function(ciSysId) {
        try {
            var ciGR = new GlideRecord('cmdb_ci');
            if (ciGR.get(ciSysId)) {
                return {
                    sysId: ciSysId,
                    name: ciGR.getValue('name') || '',
                    className: ciGR.getValue('sys_class_name') || ''
                };
            }
        } catch (e) {
            gs.warn(this.LOG_PREFIX + ' Error getting CI: ' + e.message);
        }
        return null;
    },

    /**
     * Format CI class name to human-readable string
     */
    _formatCIClassName: function(className) {
        if (!className) return 'Configuration Item';

        var friendlyNames = {
            'cmdb_ci_win_server': 'Windows Server',
            'cmdb_ci_linux_server': 'Linux Server',
            'cmdb_ci_unix_server': 'Unix Server',
            'cmdb_ci_esx_server': 'ESX Server',
            'cmdb_ci_aix_server': 'AIX Server',
            'cmdb_ci_solaris_server': 'Solaris Server',
            'cmdb_ci_netware_server': 'NetWare Server',
            'cmdb_ci_database': 'Database',
            'cmdb_ci_db_instance': 'Database Instance',
            'cmdb_ci_db_ora_instance': 'Oracle Database',
            'cmdb_ci_db_mysql_instance': 'MySQL Database',
            'cmdb_ci_db_mssql_instance': 'SQL Server Database',
            'cmdb_ci_db_postgresql_instance': 'PostgreSQL Database',
            'cmdb_ci_app_server': 'Application Server',
            'cmdb_ci_app_server_java': 'Java Application Server',
            'cmdb_ci_web_server': 'Web Server',
            'cmdb_ci_load_balancer': 'Load Balancer',
            'cmdb_ci_service': 'Service',
            'cmdb_ci_vm_instance': 'Virtual Machine',
            'cmdb_ci_vm_object': 'Virtual Machine',
            'cmdb_ci_computer': 'Computer',
            'cmdb_ci_storage_device': 'Storage Device',
            'cmdb_ci_storage_switch': 'Storage Switch',
            'cmdb_ci_network_adapter': 'Network Adapter',
            'cmdb_ci_ip_router': 'IP Router',
            'cmdb_ci_ip_switch': 'IP Switch',
            'cmdb_ci_datacenter': 'Data Center',
            'cmdb_ci_cluster': 'Cluster',
            'cmdb_ci': 'Configuration Item'
        };

        return friendlyNames[className] || className;
    },

    /**
     * Summarize alerts by open/closed state
     */
    _summarizeAlerts: function(alerts) {
        var summary = { total: alerts.length, open: 0, closed: 0 };

        for (var i = 0; i < alerts.length; i++) {
            var state = (alerts[i].state || '').toLowerCase();
            if (state.indexOf('open') !== -1) summary.open++;
            else summary.closed++;
        }

        return summary;
    },

    /**
     * Determine the analysis context based on alerts and metrics
     * Sets mode to 'alert-centric' if alerts exist, 'spike-centric' otherwise
     */
    _determineAnalysisContext: function(alerts, metrics, timeRange) {
        var context = {
            mode: 'spike-centric',
            focusTime: null,
            focusTimeDisplay: null,
            timelineDescription: '',
            hasAlerts: alerts && alerts.length > 0,
            alertCount: alerts ? alerts.length : 0,
            timeRange: timeRange
        };

        if (context.hasAlerts) {
            context.mode = 'alert-centric';
            var firstTime = alerts[alerts.length - 1].initial_event_time || alerts[alerts.length - 1].sys_created_on;

            if (firstTime) context.focusTimeDisplay = this._formatTimeDisplay(firstTime);

            context.timelineDescription = alerts.length + ' alerts in ' + timeRange + ' window';
        } else {
            context.timelineDescription = 'No alerts in ' + timeRange + ' window';
        }

        return context;
    },

    /**
     * Analyze metrics with context awareness
     * Detects spikes using ratio threshold and categorizes by TELS signal
     *
     * @param {Array} metrics - Metric objects from ACC MetricsQueryEngine
     * @param {Object} context - Analysis context
     * @return {Object} Metric analysis with spike detection results
     */
    _analyzeMetricsWithContext: function(metrics, context) {
        var analysis = {
            totalMetrics: metrics ? metrics.length : 0,
            spikeMetrics: [],
            bySignal: { Traffic: [], Errors: [], Latency: [], Saturation: [] },
            overallBehavior: 'normal',
            behaviorConfidence: 80
        };

        if (!metrics || metrics.length === 0) {
            return analysis;
        }

        var spikeCount = 0;

        for (var i = 0; i < metrics.length; i++) {
            var metric = metrics[i];
            var behavior = this._analyzeMetricBehavior(metric);

            if (behavior.isSpike) {
                spikeCount++;
                var signal = this._categorizeMetric(metric.name || '');

                analysis.spikeMetrics.push({
                    name: metric.name,
                    value: this._formatMetricValue(metric.max || 0),
                    signal: signal,
                    ratio: behavior.ratio
                });

                analysis.bySignal[signal].push(metric.name);
            }
        }

        if (spikeCount > 5) analysis.overallBehavior = 'spiking';
        else if (spikeCount > 0) analysis.overallBehavior = 'elevated';

        return analysis;
    },

    /**
     * Analyze individual metric behavior for spike detection
     * Spike = max/avg ratio exceeds SPIKE_RATIO_THRESHOLD (2.0x)
     */
    _analyzeMetricBehavior: function(metric) {
        var result = { isSpike: false, ratio: 1.0 };
        var max = metric.max || 0;
        var avg = metric.avg || 0;

        if (avg > 0) {
            result.ratio = max / avg;
            if (result.ratio >= this.SPIKE_RATIO_THRESHOLD) {
                result.isSpike = true;
            }
        }

        return result;
    },

    // ========================================================================
    // DYNAMIC PATTERN-BASED ANALYSIS
    // ========================================================================

    /**
     * Determine the probable cause using pattern analysis
     * Combines alert patterns, metric patterns, timeline, and correlation
     */
    _determineSmartFallback: function(alerts, metricAnalysis, context, ciDetails) {
        if (metricAnalysis.overallBehavior === 'normal' && (!alerts || alerts.length === 0)) {
            var normalDesc = 'System operating within expected parameters. ' + metricAnalysis.totalMetrics + ' metrics monitored with no anomalies detected.';

            if (ciDetails && ciDetails.name) {
                normalDesc = 'Analysis for ' + ciDetails.name + ' (' + this._formatCIClassName(ciDetails.className) + '): ' + normalDesc;
            }

            return {
                title: 'Normal Operations',
                description: normalDesc,
                correlation: 90
            };
        }

        var alertPatterns = this._extractAlertPatterns(alerts);
        var metricPatterns = this._extractMetricPatterns(metricAnalysis);
        var timelineContext = this._buildTimelineContext(alerts, context);
        var correlation = this._correlateAlertsWithMetrics(alertPatterns, metricPatterns);

        return this._buildDynamicSummary(alertPatterns, metricPatterns, timelineContext, correlation, ciDetails);
    },

    /**
     * Extract patterns from alerts: dominant types, severity, keywords
     */
    _extractAlertPatterns: function(alerts) {
        var patterns = {
            count: alerts ? alerts.length : 0,
            dominantTypes: {},
            severityDistribution: { critical: 0, major: 0, minor: 0, warning: 0 },
            stateDistribution: { open: 0, closed: 0 },
            keywords: {},
            rootCauseCount: 0
        };

        if (!alerts || alerts.length === 0) return patterns;

        for (var i = 0; i < alerts.length; i++) {
            var alert = alerts[i];

            var eventType = alert.event_group_label || alert.type_display || 'Unknown';
            patterns.dominantTypes[eventType] = (patterns.dominantTypes[eventType] || 0) + 1;

            var sev = parseInt(alert.severity) || 5;
            if (sev === 1) patterns.severityDistribution.critical++;
            else if (sev === 2) patterns.severityDistribution.major++;
            else if (sev === 3) patterns.severityDistribution.minor++;
            else patterns.severityDistribution.warning++;

            var state = (alert.state || alert.state_display || '').toLowerCase();
            if (state.indexOf('open') !== -1) patterns.stateDistribution.open++;
            else patterns.stateDistribution.closed++;

            if (alert.is_root_cause) patterns.rootCauseCount++;

            var text = (alert.description || '') + ' ' + (alert.short_description || '') + ' ' + (alert.event_description || '');
            var words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];

            for (var j = 0; j < words.length; j++) {
                var word = words[j];
                if (this._isSignificantWord(word)) {
                    patterns.keywords[word] = (patterns.keywords[word] || 0) + 1;
                }
            }
        }

        var maxCount = 0;
        var dominantType = null;
        for (var type in patterns.dominantTypes) {
            if (patterns.dominantTypes[type] > maxCount) {
                maxCount = patterns.dominantTypes[type];
                dominantType = type;
            }
        }
        patterns.dominantType = dominantType;
        patterns.dominantTypeCount = maxCount;

        return patterns;
    },

    /**
     * Check if a word is significant for keyword extraction (not a stop word)
     */
    _isSignificantWord: function(word) {
        var stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'will', 'there', 'their', 'would', 'could', 'should'];
        return stopWords.indexOf(word) === -1 && word.length > 3;
    },

    /**
     * Extract patterns from metric analysis results
     */
    _extractMetricPatterns: function(metricAnalysis) {
        var patterns = {
            totalAnalyzed: metricAnalysis.totalMetrics || 0,
            spikeCount: metricAnalysis.spikeMetrics ? metricAnalysis.spikeMetrics.length : 0,
            behavior: metricAnalysis.overallBehavior || 'normal',
            confidence: metricAnalysis.behaviorConfidence || 0,
            signalDistribution: {},
            topSpikes: []
        };

        if (metricAnalysis.bySignal) {
            for (var signal in metricAnalysis.bySignal) {
                var count = metricAnalysis.bySignal[signal].length;
                if (count > 0) {
                    patterns.signalDistribution[signal] = count;
                }
            }
        }

        if (metricAnalysis.spikeMetrics && metricAnalysis.spikeMetrics.length > 0) {
            patterns.topSpikes = metricAnalysis.spikeMetrics.slice(0, 5);
        }

        return patterns;
    },

    /**
     * Build timeline context from alert timestamps
     */
    _buildTimelineContext: function(alerts, context) {
        if (!alerts || alerts.length === 0) {
            return { description: 'No recent alerts', window: context.timeRange || '24h' };
        }

        var times = [];
        for (var i = 0; i < alerts.length; i++) {
            var alertTime = alerts[i].initial_event_time || alerts[i].sys_created_on;
            if (alertTime) times.push(alertTime);
        }

        if (times.length === 0) {
            return { description: alerts.length + ' alerts in window', window: context.timeRange || '24h' };
        }

        times.sort();
        var earliest = this._formatTimeDisplay(times[0]);
        var latest = this._formatTimeDisplay(times[times.length - 1]);

        var desc = '';
        if (times.length === 1) {
            desc = 'Alert occurred at ' + latest;
        } else if (earliest === latest) {
            desc = alerts.length + ' alerts clustered at ' + latest;
        } else {
            desc = alerts.length + ' alerts between ' + earliest + ' and ' + latest;
        }

        return { description: desc, earliest: earliest, latest: latest, window: context.timeRange || '24h' };
    },

    /**
     * Correlate alert patterns with metric patterns to determine relationship strength
     */
    _correlateAlertsWithMetrics: function(alertPatterns, metricPatterns) {
        var correlation = {
            strength: 'none',
            confidence: 50,
            description: ''
        };

        if (alertPatterns.count === 0) {
            if (metricPatterns.spikeCount > 0) {
                correlation.strength = 'metric-only';
                correlation.confidence = 70;
                correlation.description = 'Metric anomalies detected without alert triggers';
            }
            return correlation;
        }

        if (metricPatterns.spikeCount === 0) {
            correlation.strength = 'alert-only';
            correlation.confidence = 65;
            correlation.description = 'Alerts present but no metric spikes detected';
            return correlation;
        }

        var spikeToAlertRatio = metricPatterns.spikeCount / alertPatterns.count;

        if (spikeToAlertRatio >= 5) {
            correlation.strength = 'high';
            correlation.confidence = 85;
            correlation.description = 'Strong correlation: ' + metricPatterns.spikeCount + ' metrics spiked with ' + alertPatterns.count + ' alert(s)';
        } else if (spikeToAlertRatio >= 2) {
            correlation.strength = 'medium';
            correlation.confidence = 75;
            correlation.description = 'Moderate correlation: ' + metricPatterns.spikeCount + ' metrics affected';
        } else {
            correlation.strength = 'low';
            correlation.confidence = 65;
            correlation.description = 'Limited metric impact despite alerts';
        }

        return correlation;
    },

    // ========================================================================
    // CURRENT METRICS ASSESSMENT
    // ========================================================================

    /**
     * Assess current metrics status (last hour) vs alert window
     * Helps determine if open alerts are still relevant
     *
     * @param {Array} metrics - Current metric data from ACC MetricsQueryEngine
     * @param {Array} alerts - Current alerts
     * @return {Object|null} Assessment of current metric health
     */
    _assessCurrentMetrics: function(metrics, alerts) {
        if (!metrics || metrics.length === 0) {
            return null;
        }

        var assessment = {
            responseTime: null,
            responseTimeNormal: false,
            failureRate: null,
            failureRateNormal: true,
            requestCount: null,
            requestCountNormal: true,
            memoryUsage: null,
            memoryNormal: true,
            cpuUsage: null,
            cpuNormal: true,
            overallNormal: false
        };

        // Find key metrics in current data
        for (var i = 0; i < metrics.length; i++) {
            var metric = metrics[i];
            var nameLower = (metric.name || '').toLowerCase();

            // Response Time / Latency metrics
            if (nameLower.indexOf('response') !== -1 || nameLower.indexOf('latency') !== -1 || nameLower.indexOf('duration') !== -1) {
                var recentValue = metric.current || metric.avg || 0;
                var avgValue = metric.avg || 0;

                assessment.responseTime = this._formatMetricValue(recentValue) + (metric.unit || 'ms');

                // Consider normal if current < 1.5x average
                if (avgValue > 0 && recentValue < (avgValue * 1.5)) {
                    assessment.responseTimeNormal = true;
                }
            }

            // Error/Failure metrics
            if (nameLower.indexOf('error') !== -1 || nameLower.indexOf('failure') !== -1 || nameLower.indexOf('fault') !== -1) {
                var errorRate = metric.current || metric.avg || 0;
                assessment.failureRate = parseFloat(errorRate.toFixed(2));

                // Consider normal if < 1%
                if (errorRate > 1) {
                    assessment.failureRateNormal = false;
                }
            }

            // Request/Traffic metrics
            if (nameLower.indexOf('request') !== -1 || nameLower.indexOf('traffic') !== -1 || nameLower.indexOf('throughput') !== -1) {
                var reqCount = metric.current || metric.avg || 0;
                assessment.requestCount = Math.round(reqCount);

                // Check variance
                var avgReq = metric.avg || 0;
                if (avgReq > 0 && Math.abs(reqCount - avgReq) / avgReq > 0.3) {
                    assessment.requestCountNormal = false;
                }
            }

            // Memory metrics
            if (nameLower.indexOf('memory') !== -1 && nameLower.indexOf('usage') !== -1) {
                var memUsage = metric.current || metric.avg || 0;
                assessment.memoryUsage = Math.round(memUsage);

                // Consider elevated if > 85%
                if (memUsage > 85) {
                    assessment.memoryNormal = false;
                }
            }

            // CPU metrics
            if (nameLower.indexOf('cpu') !== -1 && (nameLower.indexOf('usage') !== -1 || nameLower.indexOf('utilization') !== -1)) {
                var cpuUsage = metric.current || metric.avg || 0;
                assessment.cpuUsage = Math.round(cpuUsage);

                // Consider elevated if > 80%
                if (cpuUsage > 80) {
                    assessment.cpuNormal = false;
                }
            }
        }

        // Overall assessment: all key metrics must be normal
        assessment.overallNormal = assessment.responseTimeNormal &&
                                  assessment.failureRateNormal &&
                                  assessment.requestCountNormal &&
                                  assessment.memoryNormal &&
                                  assessment.cpuNormal;

        return assessment;
    },

    // ========================================================================
    // HYBRID AI INTEGRATION + CURRENT METRICS
    // ========================================================================

    /**
     * Build dynamic summary using hybrid AI + rule-based approach
     * Title is always rule-based; description uses AI when available
     */
    _buildDynamicSummary: function(alertPatterns, metricPatterns, timelineContext, correlation, ciDetails) {
        var title = '';
        var description = '';
        var confidence = correlation.confidence;

        // === TITLE GENERATION (Rule-Based - always deterministic) ===
        if (alertPatterns.dominantType && alertPatterns.dominantType !== 'Unknown') {
            title = alertPatterns.dominantType;
        } else if (alertPatterns.severityDistribution.critical > 0) {
            title = 'Critical System Event';
        } else if (metricPatterns.behavior === 'critical') {
            title = 'Critical Performance Degradation';
        } else if (metricPatterns.behavior === 'spiking') {
            title = 'Performance Anomaly Detected';
        } else if (alertPatterns.count > 0) {
            title = 'System Alert Event';
        } else {
            title = 'Metric Anomaly';
        }

        // === DESCRIPTION GENERATION (Hybrid: Try AI with Current Metrics) ===
        try {
            // Calculate current metrics assessment
            var currentMetrics = this._assessCurrentMetrics(
                this._originalMetrics || [],
                this._originalAlerts || []
            );

            gs.info(this.LOG_PREFIX + ' Current metrics assessment: ' +
                   (currentMetrics ? (currentMetrics.overallNormal ? 'NORMAL' : 'ELEVATED') : 'N/A'));

            // Prepare context for LLM (WITH CURRENT METRICS)
            var llmContext = {
                ciDetails: ciDetails,
                alertCount: alertPatterns.count,
                alertPatterns: alertPatterns,
                timelineContext: timelineContext,
                metricPatterns: metricPatterns,
                correlation: correlation,
                title: title,
                currentMetrics: currentMetrics
            };

            // Call LLM for description only
            // ACC-adapted: Uses x_snc_metricintelp.ACCMetricsAILLM instead of global.MetricsAIAnalyzerServerLLM
            gs.info(this.LOG_PREFIX + ' Attempting AI description generation...');
            var llm = new x_snc_metricintelp.ACCMetricsAILLM();
            var descResult = llm.generateDescription(llmContext);

            if (descResult.success) {
                description = descResult.description;
                gs.info(this.LOG_PREFIX + ' Description source: ' + (descResult.usedAI ? 'Now Assist' : 'Rule-based'));
            } else {
                // Emergency fallback (shouldn't happen as LLM has internal fallback)
                gs.warn(this.LOG_PREFIX + ' LLM call failed unexpectedly, using emergency fallback');
                description = this._buildRuleBasedDescription(alertPatterns, metricPatterns, timelineContext, ciDetails, currentMetrics);
                description += ' [response from SRE rulelogic]';
            }

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error generating description: ' + e.message);
            // Emergency fallback
            description = this._buildRuleBasedDescription(alertPatterns, metricPatterns, timelineContext, ciDetails, null);
            description += ' [response from SRE rulelogic]';
        }

        return {
            title: title,
            description: description,
            correlation: confidence
        };
    },

    /**
     * Build rule-based description (used as emergency fallback only)
     * Includes current metrics assessment when available
     */
    _buildRuleBasedDescription: function(alertPatterns, metricPatterns, timelineContext, ciDetails, currentMetrics) {
        var parts = [];

        // Part 1: CI Context
        if (ciDetails && ciDetails.name) {
            parts.push('Analysis for ' + ciDetails.name + ' (' + this._formatCIClassName(ciDetails.className) + '):');
        }

        // Part 2: Alert context with open/closed
        if (alertPatterns.count > 0) {
            var alertDesc = alertPatterns.count + ' alert(s) detected';
            if (alertPatterns.severityDistribution.critical > 0) {
                alertDesc += ' (' + alertPatterns.severityDistribution.critical + ' critical';
                if (alertPatterns.severityDistribution.major > 0) {
                    alertDesc += ', ' + alertPatterns.severityDistribution.major + ' major';
                }
                alertDesc += ')';
            }

            // Add open/closed status
            if (alertPatterns.stateDistribution.open > 0) {
                alertDesc += ', ' + alertPatterns.stateDistribution.open + ' currently open';
            } else {
                alertDesc += ', all now resolved';
            }

            if (alertPatterns.rootCauseCount > 0) {
                alertDesc += ', ' + alertPatterns.rootCauseCount + ' marked as root cause';
            }
            parts.push(alertDesc);
        }

        // Part 3: Timeline
        parts.push(timelineContext.description);

        // Part 4: Metrics during alert window
        if (metricPatterns.spikeCount > 0) {
            var metricDesc = metricPatterns.spikeCount + ' of ' + metricPatterns.totalAnalyzed + ' metrics spiked';
            var signals = [];
            for (var signal in metricPatterns.signalDistribution) {
                if (metricPatterns.signalDistribution[signal] > 0) {
                    signals.push(metricPatterns.signalDistribution[signal] + ' ' + signal.toLowerCase());
                }
            }
            if (signals.length > 0) {
                metricDesc += ' (' + signals.join(', ') + ')';
            }
            parts.push(metricDesc);
        }

        // Part 5: Current metrics assessment
        if (currentMetrics) {
            if (currentMetrics.overallNormal) {
                parts.push('Current metrics have returned to normal levels');
            } else {
                var elevatedMetrics = [];
                if (currentMetrics.responseTime && !currentMetrics.responseTimeNormal) {
                    elevatedMetrics.push('response time');
                }
                if (currentMetrics.memoryUsage && !currentMetrics.memoryNormal) {
                    elevatedMetrics.push('memory');
                }
                if (currentMetrics.cpuUsage && !currentMetrics.cpuNormal) {
                    elevatedMetrics.push('CPU');
                }

                if (elevatedMetrics.length > 0) {
                    parts.push('Current ' + elevatedMetrics.join(', ') + ' still elevated');
                }
            }
        }

        // Part 6: Interpretation
        if (correlation && correlation.strength === 'high') {
            parts.push('Strong correlation indicates common root cause');
        } else if (metricPatterns.behavior === 'spiking') {
            parts.push('Multiple metrics deviated >2x from baseline simultaneously');
        }

        return parts.join('. ') + '.';
    },

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Generate smart recommendations based on probable cause title
     */
    _generateSmartRecommendations: function(probableCause, context) {
        var title = (probableCause.title || '').toLowerCase();

        if (title.indexOf('normal') !== -1) {
            return [
                { description: 'Continue monitoring system behavior' },
                { description: 'Review alert thresholds if needed' },
                { description: 'Document current baseline' }
            ];
        }

        if (title.indexOf('memory') !== -1 || title.indexOf('saturation') !== -1) {
            return [
                { description: 'Identify memory-consuming processes' },
                { description: 'Check for memory leaks in logs' },
                { description: 'Consider RAM upgrade if recurring' }
            ];
        }

        if (title.indexOf('cpu') !== -1) {
            return [
                { description: 'Identify high-CPU processes' },
                { description: 'Check for runaway processes' },
                { description: 'Review thread dumps for contention' }
            ];
        }

        if (title.indexOf('disk') !== -1 || title.indexOf('storage') !== -1) {
            return [
                { description: 'Check disk space and I/O wait times' },
                { description: 'Review large file operations in logs' },
                { description: 'Consider storage capacity expansion' }
            ];
        }

        if (title.indexOf('network') !== -1) {
            return [
                { description: 'Check network connectivity and bandwidth' },
                { description: 'Review firewall and routing configurations' },
                { description: 'Verify DNS resolution' }
            ];
        }

        if (title.indexOf('database') !== -1) {
            return [
                { description: 'Review slow query logs' },
                { description: 'Check connection pool settings' },
                { description: 'Analyze database performance metrics' }
            ];
        }

        return [
            { description: 'Review system logs for detailed error patterns' },
            { description: 'Check scheduled jobs and maintenance windows' },
            { description: 'Monitor for pattern recurrence' }
        ];
    },

    /**
     * Format a date string for display using GlideDateTime
     */
    _formatTimeDisplay: function(dateStr) {
        if (!dateStr) return 'Unknown';
        try {
            var gdt = new GlideDateTime(dateStr);
            return gdt.getDisplayValue();
        } catch (e) {
            return dateStr;
        }
    },

    /**
     * Categorize a metric name into TELS signal type
     * T=Traffic, E=Errors, L=Latency, S=Saturation
     */
    _categorizeMetric: function(name) {
        var nameLower = (name || '').toLowerCase();

        if (nameLower.indexOf('error') !== -1 || nameLower.indexOf('fail') !== -1) {
            return 'Errors';
        }
        if (nameLower.indexOf('latency') !== -1 || nameLower.indexOf('response') !== -1 || nameLower.indexOf('duration') !== -1) {
            return 'Latency';
        }
        if (nameLower.indexOf('cpu') !== -1 || nameLower.indexOf('memory') !== -1 || nameLower.indexOf('disk') !== -1) {
            return 'Saturation';
        }

        return 'Traffic';
    },

    /**
     * Format a numeric metric value for display (K/M suffixes)
     */
    _formatMetricValue: function(value) {
        if (typeof value !== 'number') {
            value = parseFloat(value) || 0;
        }

        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }

        return String(Math.round(value * 100) / 100);
    },

    type: 'ACCMetricsAIAnalyzerServer'
};