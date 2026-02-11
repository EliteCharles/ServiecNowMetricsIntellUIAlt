// Script Include: x_snc_metricintelp.ACCPatternAnalyzer
// Name: ACCPatternAnalyzer
// API Name: x_snc_metricintelp.ACCPatternAnalyzer
// Description: ACC Pattern Analyzer v1.0 - AI Synthesis Mode for ACC Metrics Intelligence
//              Adapted from global.AIOpsAnalyzerV2 v3.1 for ACC context
// Access: public
// Client Callable: false
// Active: true
// Scope: x_snc_metricintelp
//
// ============================================================================
// ACCPatternAnalyzer v1.0 - AI Synthesis Mode for ACC
// ============================================================================
// Adapted from: global.AIOpsAnalyzerV2 v3.1 (Dynatrace version)
// Key Changes:
//   - Scoped to x_snc_metricintelp (ACC Metrics Intelligence)
//   - Removed Dynatrace-specific API calls (DynatraceAPIClient_v2)
//   - Replaced with x_snc_metricintelp.MetricsQueryEngine for ACC metrics
//   - Pattern matchers generalized for ACC alert sources (not just Dynatrace)
//   - All pattern detection algorithms preserved
//   - CMDB Impact Analysis preserved
//   - Historical Resolutions preserved
//   - Alert Correlation (storm, cascade, recurring) preserved
//   - Now Assist LLM Synthesis preserved
//   - Fallback analysis preserved
// ============================================================================
// Architecture:
//   1. Pattern Matching (collect structured knowledge, don't return early)
//   2. ACC Metrics Context (performance metrics from Agent Client Collector)
//   3. CMDB Impact Analysis (business impact, users, services)
//   4. Historical Resolutions (what worked before)
//   5. Alert Correlation (related alerts, storms, recurring patterns)
//   6. Now Assist LLM Synthesis (answers "Why do I care?")
// ============================================================================
// Dependencies:
//   - x_snc_metricintelp.MetricsQueryEngine (ACC metrics data source)
//   - Now Assist for ITSM (sn_one_extend.OneExtendUtil)
// ============================================================================

var ACCPatternAnalyzer = Class.create();
ACCPatternAnalyzer.prototype = {

    /**
     * Initialize the analyzer
     */
    initialize: function() {
        this.logPrefix = '[ACC Pattern]';
        this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5'; // VA Freeform Prompt

        gs.info(this.logPrefix + ' ACCPatternAnalyzer v1.0 initialized - AI Synthesis Mode');
    },

    /**
     * Quick alert analysis with comprehensive data collection + AI synthesis
     * ACC-adapted: Uses MetricsQueryEngine instead of DynatraceAPIClient_v2
     *
     * @param {string} alertNumber - Alert number (e.g. 'Alert0179572')
     * @return {Object} Analysis result with pattern, confidence, AI synthesis, timing
     */
    analyzeAlertQuick: function(alertNumber) {
        gs.info(this.logPrefix + ' Starting comprehensive analysis for: ' + alertNumber);

        var startTime = new Date().getTime();
        var timing = {
            patternMatch: 0,
            accMetricsContext: 0,
            accMetrics: 0,
            cmdbImpact: 0,
            historicalResolutions: 0,
            alertCorrelation: 0,
            aiSynthesis: 0,
            dataCollection: 0,
            total: 0
        };

        try {
            // Get alert details
            var alertGR = new GlideRecord('em_alert');
            if (!alertGR.get('number', alertNumber)) {
                return {
                    success: false,
                    error: 'Alert not found: ' + alertNumber
                };
            }

            var alertInfo = this._getAlertInfo(alertGR);
            gs.info(this.logPrefix + ' Alert info: ' + alertInfo);

            // ================================================================
            // PHASE 1: Pattern Matching (don't return early!)
            // ================================================================
            var t1 = new Date().getTime();
            gs.info(this.logPrefix + ' Checking patterns...');

            var patternMatch = null;
            var patternSolution = null;

            // ACC-adapted: Pattern matchers work with any alert source
            if (this._matchesSyntheticMonitor(alertGR)) {
                patternMatch = 'Synthetic Monitor Down';
                patternSolution = this._getSyntheticMonitorSolution();
                gs.info(this.logPrefix + ' Pattern matched: Synthetic Monitor Down');
            } else if (this._matchesBatchJobFailure(alertGR)) {
                patternMatch = 'Batch Job Failure';
                patternSolution = this._getBatchJobFailureSolution();
                gs.info(this.logPrefix + ' Pattern matched: Batch Job Failure');
            } else if (this._matchesResponseTimeDegradation(alertGR)) {
                patternMatch = 'Response Time Degradation';
                patternSolution = this._getResponseTimeDegradationSolution();
                gs.info(this.logPrefix + ' Pattern matched: Response Time Degradation');
            } else if (this._matchesFailureRateIncrease(alertGR)) {
                patternMatch = 'Failure Rate Increase';
                patternSolution = this._getFailureRateIncreaseSolution();
                gs.info(this.logPrefix + ' Pattern matched: Failure Rate Increase');
            } else if (this._matchesResourceSaturation(alertGR)) {
                // ACC-specific: Detect CPU/Memory/Disk saturation from ACC metrics
                patternMatch = 'Resource Saturation';
                patternSolution = this._getResourceSaturationSolution();
                gs.info(this.logPrefix + ' Pattern matched: Resource Saturation');
            }

            timing.patternMatch = new Date().getTime() - t1;

            // ================================================================
            // PHASE 2: ACC Metrics Context
            // ACC-adapted: Uses MetricsQueryEngine instead of DynatraceAPIClient_v2
            // ================================================================
            var t2 = new Date().getTime();
            var accContext = null;
            var ciSysId = alertGR.getValue('cmdb_ci') || '';

            if (ciSysId) {
                try {
                    // ACC-adapted: Query metrics through ACC MetricsQueryEngine
                    var metricsEngine = new x_snc_metricintelp.MetricsQueryEngine();
                    accContext = metricsEngine.getMetricsForCI(ciSysId, '24h');

                    if (accContext && accContext.success) {
                        gs.info(this.logPrefix + ' ACC metrics context collected successfully');
                    }
                } catch (e) {
                    gs.error(this.logPrefix + ' Error collecting ACC metrics context: ' + e.message);
                }
            }

            timing.accMetricsContext = new Date().getTime() - t2;

            // ================================================================
            // PHASE 3: ACC Performance Metrics (trend analysis)
            // ACC-adapted: Uses MetricsQueryEngine for trend data
            // ================================================================
            var t3 = new Date().getTime();
            var metricsContext = null;
            var metricsSkippedReason = null;

            if (ciSysId) {
                try {
                    var metricsEngine2 = new x_snc_metricintelp.MetricsQueryEngine();
                    metricsContext = metricsEngine2.getAlertMetricsContext(alertNumber);

                    if (metricsContext && metricsContext.success) {
                        var metricCount = metricsContext.trends ? metricsContext.trends.length : 0;
                        gs.info(this.logPrefix + ' ACC metrics collected: ' + metricCount + ' metrics');
                    } else {
                        metricsSkippedReason = metricsContext ? metricsContext.error : 'No metrics available';
                        gs.info(this.logPrefix + ' ACC metrics query result: ' + metricsSkippedReason);
                    }
                } catch (e) {
                    metricsSkippedReason = 'MetricsQueryEngine error: ' + e.message;
                    gs.error(this.logPrefix + ' Error collecting ACC metrics: ' + e.message);
                }
            } else {
                metricsSkippedReason = 'No CI associated with alert';
                gs.info(this.logPrefix + ' Skipping metrics: ' + metricsSkippedReason);
            }

            timing.accMetrics = new Date().getTime() - t3;

            // ================================================================
            // PHASE 4: CMDB Impact Analysis (always collect if CI exists)
            // ================================================================
            var t4 = new Date().getTime();
            var cmdbImpact = this._getCMDBImpactAnalysis(alertGR);

            if (cmdbImpact && cmdbImpact.success) {
                gs.info(this.logPrefix + ' CMDB impact collected: ' + cmdbImpact.impact.affected_users + ' users affected');
            } else {
                gs.info(this.logPrefix + ' CMDB impact unavailable');
            }

            timing.cmdbImpact = new Date().getTime() - t4;

            // ================================================================
            // PHASE 5: Historical Resolutions (always collect)
            // ================================================================
            var t5 = new Date().getTime();
            var historicalResolutions = this._getHistoricalResolutions(alertGR);

            if (historicalResolutions && historicalResolutions.success) {
                gs.info(this.logPrefix + ' Historical resolutions found: ' + historicalResolutions.count);
            } else {
                gs.info(this.logPrefix + ' Historical resolutions unavailable');
            }

            timing.historicalResolutions = new Date().getTime() - t5;

            // ================================================================
            // PHASE 6: Alert Correlation (always collect)
            // ================================================================
            var t6 = new Date().getTime();
            gs.info(this.logPrefix + ' Starting correlation analysis for alert: ' + alertNumber);

            var correlationResult = this.correlateAlerts(alertNumber);
            var isRecurring = correlationResult.success && correlationResult.patterns.isRecurring;

            if (isRecurring) {
                gs.info(this.logPrefix + ' RECURRING PATTERN DETECTED');
            }

            if (correlationResult.success) {
                gs.info(this.logPrefix + ' Alert correlation collected: ' + correlationResult.relatedAlerts.length + ' related alerts');
            }

            timing.alertCorrelation = new Date().getTime() - t6;

            // ================================================================
            // DATA COLLECTION COMPLETE
            // ================================================================
            timing.dataCollection = new Date().getTime() - startTime;

            var breakdown = 'Pattern=' + timing.patternMatch + 'ms, ' +
                          'ACCCtx=' + timing.accMetricsContext + 'ms, ' +
                          'ACCMetrics=' + timing.accMetrics + 'ms, ' +
                          'CMDB=' + timing.cmdbImpact + 'ms, ' +
                          'Hist=' + timing.historicalResolutions + 'ms, ' +
                          'Corr=' + timing.alertCorrelation + 'ms';

            gs.info(this.logPrefix + ' Data collection complete (' + timing.dataCollection + 'ms)');
            gs.info(this.logPrefix + ' Breakdown: ' + breakdown);

            // ================================================================
            // PHASE 7: Now Assist LLM Synthesis (always call!)
            // ================================================================
            gs.info(this.logPrefix + ' Calling Now Assist LLM for synthesis...');

            var t7 = new Date().getTime();

            // Build comprehensive prompt with ALL collected data
            var comprehensivePrompt = this._buildComprehensivePrompt({
                alertGR: alertGR,
                alertNumber: alertNumber,
                patternMatch: patternMatch,
                patternSolution: patternSolution,
                accContext: accContext,
                metricsContext: metricsContext,
                metricsSkippedReason: metricsSkippedReason,
                cmdbImpact: cmdbImpact,
                historicalResolutions: historicalResolutions,
                correlationResult: correlationResult
            });

            // Call Now Assist LLM (or use fallback if unavailable)
            var aiAnalysis = this._callNowLLM(comprehensivePrompt);

            timing.aiSynthesis = new Date().getTime() - t7;
            gs.info(this.logPrefix + ' AI synthesis complete (' + timing.aiSynthesis + 'ms)');

            // ================================================================
            // RETURN COMPLETE ANALYSIS
            // ================================================================
            timing.total = new Date().getTime() - startTime;
            gs.info(this.logPrefix + ' Total analysis time: ' + timing.total + 'ms');

            // Check if metrics were actually collected (trends.length > 0)
            var metricsAvailable = metricsContext &&
                                   metricsContext.success &&
                                   metricsContext.trends &&
                                   metricsContext.trends.length > 0;

            return {
                success: true,
                alertNumber: alertNumber,
                pattern: patternMatch || 'No Pattern Match',
                confidence: patternMatch ? 'MEDIUM' : 'N/A',
                analysis: aiAnalysis,
                dataCollected: {
                    patternMatch: patternMatch !== null,
                    accContext: accContext && accContext.success,
                    metricsAvailable: metricsAvailable,
                    cmdbImpact: cmdbImpact && cmdbImpact.success,
                    historicalData: historicalResolutions && historicalResolutions.success,
                    correlationData: correlationResult && correlationResult.success
                },
                timing: {
                    patternMatch: timing.patternMatch + 'ms',
                    accMetricsContext: timing.accMetricsContext + 'ms',
                    accMetrics: timing.accMetrics + 'ms',
                    cmdbImpact: timing.cmdbImpact + 'ms',
                    historicalResolutions: timing.historicalResolutions + 'ms',
                    alertCorrelation: timing.alertCorrelation + 'ms',
                    aiSynthesis: timing.aiSynthesis + 'ms',
                    dataCollection: timing.dataCollection + 'ms',
                    total: timing.total + 'ms'
                }
            };

        } catch (e) {
            gs.error(this.logPrefix + ' Error in analyzeAlertQuick: ' + e.message);
            gs.error(this.logPrefix + ' Stack: ' + e.stack);
            return {
                success: false,
                error: e.message,
                stack: e.stack
            };
        }
    },

    /**
     * Get alert information for logging
     */
    _getAlertInfo: function(alertGR) {
        var desc = alertGR.description.toString();
        if (desc.length > 100) {
            desc = desc.substring(0, 100) + '...';
        }
        return desc;
    },

    // ========================================================================
    // PATTERN MATCHERS (collect data, don't return early!)
    // ACC-adapted: Generalized to work with any alert source
    // ========================================================================

    /**
     * Match synthetic monitor alerts (source-agnostic)
     * ACC-adapted: Checks for synthetic monitor keywords regardless of source
     */
    _matchesSyntheticMonitor: function(alertGR) {
        var desc = alertGR.description.toString().toLowerCase();
        return desc.indexOf('synthetic monitor') >= 0 ||
               desc.indexOf('synthetic test') >= 0 ||
               desc.indexOf('http monitor') >= 0;
    },

    /**
     * Match batch job failure alerts
     */
    _matchesBatchJobFailure: function(alertGR) {
        var desc = alertGR.description.toString().toLowerCase();
        return desc.indexOf('batch job') >= 0 && desc.indexOf('failed') >= 0 ||
               desc.indexOf('scheduled job') >= 0 && desc.indexOf('failed') >= 0;
    },

    /**
     * Match response time degradation alerts
     */
    _matchesResponseTimeDegradation: function(alertGR) {
        var desc = alertGR.description.toString().toLowerCase();
        return desc.indexOf('response time') >= 0 &&
               (desc.indexOf('degradation') >= 0 ||
                desc.indexOf('increased') >= 0 ||
                desc.indexOf('slow') >= 0);
    },

    /**
     * Match failure rate increase alerts
     */
    _matchesFailureRateIncrease: function(alertGR) {
        var desc = alertGR.description.toString().toLowerCase();
        return desc.indexOf('failure rate') >= 0 ||
               desc.indexOf('error rate') >= 0;
    },

    /**
     * Match resource saturation alerts (ACC-specific)
     * Detects CPU, memory, and disk saturation patterns common in ACC metrics
     */
    _matchesResourceSaturation: function(alertGR) {
        var desc = alertGR.description.toString().toLowerCase();
        return (desc.indexOf('cpu') >= 0 && (desc.indexOf('high') >= 0 || desc.indexOf('saturation') >= 0)) ||
               (desc.indexOf('memory') >= 0 && (desc.indexOf('high') >= 0 || desc.indexOf('exhausted') >= 0 || desc.indexOf('pressure') >= 0)) ||
               (desc.indexOf('disk') >= 0 && (desc.indexOf('full') >= 0 || desc.indexOf('space') >= 0));
    },

    // ========================================================================
    // KNOWLEDGE BASE - Pattern Solutions
    // ACC-adapted: Generalized recommendations (not Dynatrace-specific)
    // ========================================================================

    _getSyntheticMonitorSolution: function() {
        return {
            rootCause: 'Synthetic Monitor detected failure',
            commonCauses: [
                'Application or service is down',
                'Network connectivity issues',
                'SSL certificate expired',
                'DNS resolution failure',
                'Firewall blocking access'
            ],
            immediateActions: [
                'Check application/service availability',
                'Verify network connectivity to endpoint',
                'Check SSL certificate validity',
                'Review firewall rules',
                'Test endpoint manually from different locations'
            ],
            validation: [
                'Synthetic monitor returns to green status',
                'Application accessible from multiple locations',
                'SSL certificate valid and not expiring soon'
            ]
        };
    },

    _getBatchJobFailureSolution: function() {
        return {
            rootCause: 'Batch job execution failed',
            commonCauses: [
                'Data validation failure',
                'Database connectivity issues',
                'Insufficient resources (memory/CPU)',
                'Dependency on upstream process that failed',
                'File not found or permissions issue'
            ],
            immediateActions: [
                'Check job execution logs for detailed error',
                'Verify database connectivity and credentials',
                'Check upstream dependencies completed successfully',
                'Verify file permissions and paths',
                'Review recent changes to job configuration'
            ],
            validation: [
                'Job executes successfully on retry',
                'All downstream jobs complete without errors',
                'Data loads match expected row counts'
            ]
        };
    },

    _getResponseTimeDegradationSolution: function() {
        return {
            rootCause: 'Service experiencing elevated response times',
            commonCauses: [
                'Database query performance issues',
                'Increased load/traffic',
                'Memory pressure or CPU saturation',
                'External API slowness',
                'Network latency'
            ],
            immediateActions: [
                'Check ACC metrics for detailed performance data',
                'Review database query execution times',
                'Check system resources (CPU, memory, disk I/O)',
                'Verify external dependency response times',
                'Review recent deployments or changes'
            ],
            validation: [
                'Response times return to baseline (< 500ms)',
                'No resource constraints (CPU < 80%, Memory < 85%)',
                'Database queries executing within SLA'
            ]
        };
    },

    _getFailureRateIncreaseSolution: function() {
        return {
            rootCause: 'Application experiencing increased error rate',
            commonCauses: [
                'Recent code deployment issues',
                'External dependency failures',
                'Authentication/authorization problems',
                'Resource exhaustion',
                'Configuration changes'
            ],
            immediateActions: [
                'Review recent deployments or changes',
                'Check application logs for error patterns',
                'Verify external dependencies are healthy',
                'Check authentication services',
                'Review resource utilization via ACC metrics'
            ],
            validation: [
                'Error rate returns to baseline (< 1%)',
                'No errors in application logs',
                'All health checks passing'
            ]
        };
    },

    /**
     * ACC-specific: Resource saturation solution
     */
    _getResourceSaturationSolution: function() {
        return {
            rootCause: 'System resource saturation detected by ACC',
            commonCauses: [
                'Memory leak in application process',
                'Runaway process consuming CPU',
                'Log files or temp files filling disk',
                'Insufficient capacity for workload',
                'Background job resource contention'
            ],
            immediateActions: [
                'Identify top resource-consuming processes',
                'Check ACC metrics for resource trend data',
                'Review application logs for OOM errors',
                'Check disk space and cleanup temp files',
                'Evaluate if horizontal/vertical scaling is needed'
            ],
            validation: [
                'CPU utilization below 80%',
                'Memory usage below 85%',
                'Disk space above 20% free',
                'No OOM kills in system logs'
            ]
        };
    },

    // ========================================================================
    // CMDB IMPACT ANALYSIS
    // ========================================================================

    /**
     * Analyze business impact using CMDB relationships
     * Unchanged from original - CMDB queries are source-agnostic
     */
    _getCMDBImpactAnalysis: function(alertGR) {
        try {
            var ciSysId = alertGR.cmdb_ci.toString();
            if (!ciSysId) {
                return { success: false };
            }

            var ci = new GlideRecord('cmdb_ci');
            if (!ci.get(ciSysId)) {
                return { success: false };
            }

            var impact = {
                business_criticality: ci.business_criticality ? ci.business_criticality.getDisplayValue() : 'Unknown',
                dependent_count: 0,
                affected_users: 'Unknown',
                business_services: []
            };

            // Get dependent services count
            var relGR = new GlideRecord('cmdb_rel_ci');
            relGR.addQuery('parent', ciSysId);
            relGR.addQuery('type.name', 'Depends on::Used by');
            relGR.query();
            impact.dependent_count = relGR.getRowCount();

            // Get business services
            var bsGR = new GlideRecord('cmdb_ci_service');
            bsGR.addQuery('used_for', 'CONTAINS', ciSysId);
            bsGR.setLimit(3);
            bsGR.query();

            while (bsGR.next()) {
                impact.business_services.push({
                    name: bsGR.name.toString(),
                    criticality: bsGR.business_criticality ? bsGR.business_criticality.getDisplayValue() : 'Unknown'
                });
            }

            // Estimate affected users based on criticality
            if (impact.business_criticality.indexOf('Critical') >= 0 || impact.business_criticality.indexOf('1') >= 0) {
                impact.affected_users = '1000+';
            } else if (impact.business_criticality.indexOf('High') >= 0 || impact.business_criticality.indexOf('2') >= 0) {
                impact.affected_users = '100-1000';
            } else if (impact.business_criticality.indexOf('Medium') >= 0 || impact.business_criticality.indexOf('3') >= 0) {
                impact.affected_users = '10-100';
            } else {
                impact.affected_users = '<10';
            }

            return { success: true, impact: impact };

        } catch (e) {
            gs.error(this.logPrefix + ' Error in getCMDBImpactAnalysis: ' + e.message);
            return { success: false };
        }
    },

    // ========================================================================
    // HISTORICAL RESOLUTIONS
    // ========================================================================

    /**
     * Find historical incident resolutions for the same CI
     * Unchanged from original - incident queries are source-agnostic
     */
    _getHistoricalResolutions: function(alertGR) {
        try {
            var ciSysId = alertGR.cmdb_ci.toString();
            if (!ciSysId) {
                return { success: false };
            }

            var incGR = new GlideRecord('incident');
            incGR.addQuery('cmdb_ci', ciSysId);
            incGR.addQuery('state', '6'); // Resolved
            incGR.addQuery('sys_created_on', '>', gs.daysAgo(30));
            incGR.addQuery('close_notes', '!=', '');
            incGR.orderByDesc('resolved');
            incGR.setLimit(3);
            incGR.query();

            var resolutions = [];
            while (incGR.next()) {
                var resTime = incGR.calendar_duration.getGlideObject().getNumericValue();
                var resHours = Math.round(resTime / 3600);

                resolutions.push({
                    number: incGR.number.toString(),
                    short_description: incGR.short_description.toString(),
                    close_notes: incGR.close_notes.toString(),
                    resolved_by: incGR.resolved_by.getDisplayValue(),
                    resolution_time: resHours + 'h'
                });
            }

            if (resolutions.length === 0) {
                return { success: false };
            }

            return { success: true, resolutions: resolutions, count: resolutions.length };

        } catch (e) {
            gs.error(this.logPrefix + ' Error in getHistoricalResolutions: ' + e.message);
            return { success: false };
        }
    },

    // ========================================================================
    // ALERT CORRELATION
    // ========================================================================

    /**
     * Correlate alerts to detect storms, cascades, and recurring patterns
     * Unchanged from original - alert correlation is source-agnostic
     */
    correlateAlerts: function(alertNumber) {
        try {
            gs.info(this.logPrefix + ' Starting correlation analysis for alert: ' + alertNumber);

            var alertGR = new GlideRecord('em_alert');
            if (!alertGR.get('number', alertNumber)) {
                return { success: false, error: 'Alert not found' };
            }

            var ciSysId = alertGR.cmdb_ci.toString();
            var alertTime = alertGR.sys_created_on.getGlideObject();

            // ================================================================
            // 1. Find Related Alerts (30-minute window)
            // ================================================================
            gs.info(this.logPrefix + ' Searching for related alerts in 30-minute window');

            var relatedAlerts = [];
            var relGR = new GlideRecord('em_alert');

            if (ciSysId) {
                relGR.addQuery('cmdb_ci', ciSysId);
            }

            relGR.addQuery('number', '!=', alertNumber);
            relGR.addQuery('state', 'IN', '1,2,3,10'); // Open states

            // 30-minute window before and after
            var thirtyMinBefore = new GlideDateTime(alertTime);
            thirtyMinBefore.addSeconds(-1800);
            var thirtyMinAfter = new GlideDateTime(alertTime);
            thirtyMinAfter.addSeconds(1800);

            relGR.addQuery('sys_created_on', '>=', thirtyMinBefore);
            relGR.addQuery('sys_created_on', '<=', thirtyMinAfter);
            relGR.orderBy('sys_created_on');
            relGR.setLimit(10);
            relGR.query();

            while (relGR.next()) {
                relatedAlerts.push({
                    number: relGR.number.toString(),
                    description: relGR.description.toString(),
                    severity: relGR.severity.toString(),
                    created: relGR.sys_created_on.getDisplayValue(),
                    source: relGR.source.toString()
                });
            }

            gs.info(this.logPrefix + ' Found ' + relatedAlerts.length + ' related alerts');

            // ================================================================
            // 2. Detect Alert Storm (3+ alerts in 30 minutes)
            // ================================================================
            var isAlertStorm = relatedAlerts.length >= 3;

            // ================================================================
            // 3. Detect Recurring Pattern (7+ occurrences in 7 days on same CI)
            // ================================================================
            var occurrenceCount = 0;

            if (ciSysId) {
                var recurGR = new GlideRecord('em_alert');
                recurGR.addQuery('cmdb_ci', ciSysId);
                recurGR.addQuery('sys_created_on', '>', gs.daysAgo(7));
                recurGR.query();
                occurrenceCount = recurGR.getRowCount();

                if (occurrenceCount >= 7) {
                    gs.info(this.logPrefix + ' RECURRING PATTERN: ' + occurrenceCount + ' alerts on same CI in 7 days');
                }
            }

            var isRecurring = occurrenceCount >= 7;

            return {
                success: true,
                relatedAlerts: relatedAlerts,
                patterns: {
                    isAlertStorm: isAlertStorm,
                    isRecurring: isRecurring,
                    occurrenceCount: occurrenceCount
                }
            };

        } catch (e) {
            gs.error(this.logPrefix + ' Error in correlateAlerts: ' + e.message);
            return { success: false, error: e.message };
        }
    },

    // ========================================================================
    // COMPREHENSIVE PROMPT BUILDER
    // ACC-adapted: References ACC metrics instead of Dynatrace
    // ========================================================================

    _buildComprehensivePrompt: function(data) {
        var prompt = '';

        // ================================================================
        // SECTION 1: Alert Information
        // ================================================================
        prompt += '=== ALERT INFORMATION ===\n';
        prompt += 'Alert: ' + data.alertNumber + '\n';
        prompt += 'Severity: ' + data.alertGR.getDisplayValue('severity') + '\n';
        prompt += 'Description: ' + data.alertGR.getValue('description') + '\n';
        prompt += 'Source: ' + data.alertGR.getValue('source') + '\n';

        if (data.alertGR.cmdb_ci) {
            prompt += 'CI: ' + data.alertGR.getDisplayValue('cmdb_ci') + '\n';
        }

        prompt += '\n';

        // ================================================================
        // SECTION 2: Known Pattern (if matched)
        // ================================================================
        if (data.patternMatch && data.patternSolution) {
            prompt += '=== KNOWN PATTERN DETECTED ===\n';
            prompt += 'Pattern: ' + data.patternMatch + ' (Confidence: MEDIUM)\n\n';
            prompt += 'Known Root Cause: ' + data.patternSolution.rootCause + '\n';
            prompt += 'Common Causes:\n';
            for (var i = 0; i < data.patternSolution.commonCauses.length; i++) {
                prompt += '  - ' + data.patternSolution.commonCauses[i] + '\n';
            }
            prompt += '\nProven Immediate Actions:\n';
            for (var j = 0; j < data.patternSolution.immediateActions.length; j++) {
                prompt += '  ' + (j + 1) + '. ' + data.patternSolution.immediateActions[j] + '\n';
            }
            prompt += '\n';
        }

        // ================================================================
        // SECTION 3: ACC Metrics Intelligence
        // ACC-adapted: Replaces Dynatrace AI Intelligence section
        // ================================================================
        if (data.accContext && data.accContext.success) {
            prompt += '=== ACC METRICS INTELLIGENCE ===\n';

            if (data.accContext.metrics && data.accContext.metrics.length > 0) {
                prompt += 'Metrics collected: ' + data.accContext.metrics.length + '\n';
                for (var m = 0; m < Math.min(5, data.accContext.metrics.length); m++) {
                    var metric = data.accContext.metrics[m];
                    prompt += '  - ' + (metric.name || 'Unknown') + ': avg=' + (metric.avg || 'N/A') + ', max=' + (metric.max || 'N/A');
                    if (metric.unit) prompt += ' ' + metric.unit;
                    prompt += '\n';
                }
            }

            prompt += '\n';
        }

        // ================================================================
        // SECTION 4: Performance Metrics (if available)
        // ACC-adapted: Uses ACC trend data instead of Dynatrace metrics
        // ================================================================
        if (data.metricsContext && data.metricsContext.success && data.metricsContext.trends) {
            var hasSignificant = false;
            for (var t = 0; t < data.metricsContext.trends.length; t++) {
                if (data.metricsContext.trends[t].change && data.metricsContext.trends[t].change.isSignificant) {
                    if (!hasSignificant) {
                        prompt += '=== PERFORMANCE METRICS (ACC) ===\n';
                        hasSignificant = true;
                    }
                    var trend = data.metricsContext.trends[t];
                    prompt += trend.metricName + ': ' + trend.before.avg + ' -> ' + trend.during.avg + ' ' + (trend.unit || '');
                    prompt += ' (' + trend.change.direction + ' ' + trend.change.percent + '%)\n';
                }
            }
            if (hasSignificant) {
                prompt += '\n';
            }
        } else if (data.metricsSkippedReason) {
            prompt += '=== PERFORMANCE METRICS ===\n';
            prompt += 'Note: Metrics unavailable (' + data.metricsSkippedReason + ')\n\n';
        }

        // ================================================================
        // SECTION 5: Business Impact (CMDB)
        // ================================================================
        if (data.cmdbImpact && data.cmdbImpact.success) {
            prompt += '=== BUSINESS IMPACT ===\n';
            prompt += 'Affected Users: ' + data.cmdbImpact.impact.affected_users + '\n';
            prompt += 'Business Criticality: ' + data.cmdbImpact.impact.business_criticality + '\n';
            prompt += 'Dependent Services: ' + data.cmdbImpact.impact.dependent_count + '\n';

            if (data.cmdbImpact.impact.business_services.length > 0) {
                prompt += 'Business Services Impacted:\n';
                for (var b = 0; b < data.cmdbImpact.impact.business_services.length; b++) {
                    prompt += '  - ' + data.cmdbImpact.impact.business_services[b].name + '\n';
                }
            }

            prompt += '\n';
        }

        // ================================================================
        // SECTION 6: What Worked Before (Historical Resolutions)
        // ================================================================
        if (data.historicalResolutions && data.historicalResolutions.success) {
            prompt += '=== WHAT WORKED BEFORE (Historical Resolutions - Last 30 Days) ===\n';
            for (var h = 0; h < data.historicalResolutions.resolutions.length; h++) {
                var res = data.historicalResolutions.resolutions[h];
                prompt += res.number + ' (' + res.resolution_time + '): ' + res.short_description + '\n';
                prompt += 'Solution: ' + res.close_notes.substring(0, 200) + '\n';
                prompt += 'Resolved by: ' + res.resolved_by + '\n\n';
            }
        }

        // ================================================================
        // SECTION 7: Alert Correlation
        // ================================================================
        if (data.correlationResult && data.correlationResult.success) {
            prompt += '=== ALERT CORRELATION ===\n';

            if (data.correlationResult.patterns.isAlertStorm) {
                prompt += 'ALERT STORM: ' + data.correlationResult.relatedAlerts.length + ' alerts in 30-minute window\n';
            }

            if (data.correlationResult.patterns.isRecurring) {
                prompt += 'RECURRING PATTERN: ' + data.correlationResult.patterns.occurrenceCount + ' occurrences in 7 days\n';
                prompt += 'This requires a PERMANENT FIX, not just a workaround\n';
            }

            if (data.correlationResult.relatedAlerts.length > 0) {
                prompt += '\nRelated Alerts (' + data.correlationResult.relatedAlerts.length + '):\n';
                for (var c = 0; c < Math.min(3, data.correlationResult.relatedAlerts.length); c++) {
                    var rel = data.correlationResult.relatedAlerts[c];
                    prompt += '  - ' + rel.number + ': ' + rel.description.substring(0, 80) + '\n';
                }
            }

            prompt += '\n';
        }

        // ================================================================
        // INSTRUCTION SECTION
        // ================================================================
        prompt += '=== INSTRUCTIONS ===\n';
        prompt += 'Synthesize ALL the above information to answer: "Why do I care about this alert?"\n\n';
        prompt += 'Provide:\n';
        prompt += '1. Root Cause Analysis (evidence-based, using pattern match + ACC metrics data)\n';
        prompt += '2. Recommended Actions (prioritized, specific, reference historical solutions if available)\n';
        prompt += '3. Business Impact (quantified if possible, using CMDB data)\n';

        return prompt;
    },

    // ========================================================================
    // NOW ASSIST LLM API INTEGRATION (One Extend)
    // ========================================================================

    /**
     * Call Now Assist LLM using One Extend API (VA Freeform Prompt capability)
     * Uses sn_one_extend.OneExtendUtil.execute()
     *
     * @param {string} prompt - Comprehensive analysis prompt
     * @return {string} AI-generated analysis or fallback analysis
     */
    _callNowLLM: function(prompt) {
        try {
            gs.info(this.logPrefix + ' Calling Now Assist LLM (One Extend API)...');

            // Check if One Extend API is available
            if (typeof sn_one_extend === 'undefined' || !sn_one_extend.OneExtendUtil) {
                gs.warn(this.logPrefix + ' One Extend API not available - using fallback analysis');
                return this._generateFallbackAnalysis(prompt);
            }

            var startTime = new Date().getTime();

            // Build One Extend request
            var request = {
                "executionRequests": [{
                    "payload": {
                        "prompt": prompt
                    },
                    "capabilityId": this.VA_CAPABILITY_ID
                }]
            };

            // Execute
            var response = sn_one_extend.OneExtendUtil.execute(request);
            var llmTime = new Date().getTime() - startTime;

            // Parse response
            if (response && response.status === 'completed') {
                var result = response.capabilities[this.VA_CAPABILITY_ID];

                if (result && result.status === 'success' && result.response) {
                    gs.info(this.logPrefix + ' Now LLM response received (' + result.response.length + ' chars, ' + llmTime + 'ms)');
                    gs.info(this.logPrefix + ' Provider: ' + (result.provider || 'Now LLM'));
                    return result.response;
                }
            }

            gs.error(this.logPrefix + ' No valid response from Now LLM API - using fallback');
            gs.error(this.logPrefix + ' Response status: ' + (response ? response.status : 'null'));
            return this._generateFallbackAnalysis(prompt);

        } catch (e) {
            gs.error(this.logPrefix + ' Error calling Now LLM: ' + e.message);
            gs.error(this.logPrefix + ' Stack: ' + e.stack);
            gs.warn(this.logPrefix + ' Using fallback analysis');
            return this._generateFallbackAnalysis(prompt);
        }
    },

    /**
     * Generate fallback analysis when Now LLM is unavailable
     * Extracts and structures all collected intelligence
     */
    _generateFallbackAnalysis: function(prompt) {
        var analysis = 'NOW ASSIST LLM UNAVAILABLE - USING STRUCTURED FALLBACK ANALYSIS\n\n';
        analysis += 'Note: Now Assist One Extend API unavailable. Using pattern-based analysis.\n\n';

        // Extract key sections from prompt
        var sections = {
            alert: this._extractSection(prompt, '=== ALERT INFORMATION ==='),
            pattern: this._extractSection(prompt, '=== KNOWN PATTERN DETECTED ==='),
            accMetrics: this._extractSection(prompt, '=== ACC METRICS INTELLIGENCE ==='),
            metrics: this._extractSection(prompt, '=== PERFORMANCE METRICS'),
            impact: this._extractSection(prompt, '=== BUSINESS IMPACT ==='),
            historical: this._extractSection(prompt, '=== WHAT WORKED BEFORE'),
            correlation: this._extractSection(prompt, '=== ALERT CORRELATION ===')
        };

        // Build structured response
        analysis += '1. EXECUTIVE SUMMARY\n';
        analysis += '--------------------\n';

        if (sections.alert) {
            var alertLines = sections.alert.split('\n');
            for (var i = 0; i < Math.min(4, alertLines.length); i++) {
                if (alertLines[i].trim()) {
                    analysis += alertLines[i] + '\n';
                }
            }
        }

        analysis += '\n';

        if (sections.pattern) {
            analysis += '2. ROOT CAUSE (Pattern Match)\n';
            analysis += '--------------------\n';
            analysis += sections.pattern + '\n\n';
        }

        if (sections.accMetrics) {
            analysis += '3. ACC METRICS INTELLIGENCE\n';
            analysis += '--------------------\n';
            analysis += sections.accMetrics + '\n\n';
        }

        if (sections.metrics && sections.metrics.indexOf('No significant') === -1 && sections.metrics.indexOf('unavailable') === -1) {
            analysis += '4. PERFORMANCE TRENDS\n';
            analysis += '--------------------\n';
            analysis += sections.metrics + '\n\n';
        }

        if (sections.impact) {
            analysis += '5. BUSINESS IMPACT\n';
            analysis += '--------------------\n';
            analysis += sections.impact + '\n\n';
        }

        if (sections.historical) {
            analysis += '6. PROVEN SOLUTIONS (Historical Data)\n';
            analysis += '--------------------\n';
            analysis += sections.historical + '\n\n';
        }

        if (sections.correlation) {
            analysis += '7. ALERT CORRELATION\n';
            analysis += '--------------------\n';
            analysis += sections.correlation + '\n\n';
        }

        analysis += 'TO ENABLE AI-POWERED SYNTHESIS\n';
        analysis += '--------------------\n';
        analysis += 'Now Assist is installed. Verify:\n';
        analysis += '1. sn_one_extend.OneExtendUtil is available\n';
        analysis += '2. VA Freeform Prompt capability is enabled\n';
        analysis += '3. Capability ID: ' + this.VA_CAPABILITY_ID + '\n\n';

        return analysis;
    },

    /**
     * Extract section from comprehensive prompt
     * Used by fallback analysis to structure output
     */
    _extractSection: function(prompt, startMarker) {
        try {
            var startIdx = prompt.indexOf(startMarker);
            if (startIdx === -1) return null;

            var contentStart = startIdx + startMarker.length;
            var nextSection = prompt.indexOf('===', contentStart);

            if (nextSection === -1) {
                return prompt.substring(contentStart).trim();
            }

            return prompt.substring(contentStart, nextSection).trim();
        } catch (e) {
            gs.error(this.logPrefix + ' Error extracting section: ' + e.message);
            return null;
        }
    },

    type: 'ACCPatternAnalyzer'
};