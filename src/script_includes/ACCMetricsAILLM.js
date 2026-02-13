// Script Include: x_snc_metricintelp.ACCMetricsAILLM
// Name: ACCMetricsAILLM
// API Name: x_snc_metricintelp.ACCMetricsAILLM
// Description: ACC Metrics AI LLM v1.0 - Now Assist Description Generator
//              Adapted from global.MetricsAIAnalyzerServerLLM v1.1 for ACC Metrics Intelligence
// Access: public
// Client Callable: false
// Active: true
// Scope: x_snc_metricintelp
//
// ============================================================================
// ACCMetricsAILLM v1.0 - Enhanced Description Generator for ACC
// ============================================================================
// Adapted from: global.MetricsAIAnalyzerServerLLM v1.1 (Dynatrace version)
// Key Changes:
//   - Scoped to x_snc_metricintelp (ACC Metrics Intelligence)
//   - Updated prompts for ACC context (not Dynatrace-specific)
//   - Prompt references "ACC Metrics Intelligence" instead of "Dynatrace"
//   - All Now Assist integration preserved (One Extend API)
//   - Rule-based fallback preserved
//   - Current metrics assessment in prompts preserved
//   - Open/closed alert distinction preserved
// ============================================================================
// Dependencies:
//   - Now Assist for ITSM (sn_one_extend.OneExtendUtil)
//   - VA Freeform Prompt capability (d82ff09efffc311063f5ffffffffffc5)
// Called by: x_snc_metricintelp.ACCMetricsAIAnalyzerServer._buildDynamicSummary()
// ============================================================================

var ACCMetricsAILLM = Class.create();
ACCMetricsAILLM.prototype = {

    initialize: function() {
        this.LOG_PREFIX = '[ACC LLM]';
        this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5';

        // TODO: FUTURE ENHANCEMENT - Custom Now Assist Skill
        // Consider creating a custom Now Assist skill specifically for SRE/ITOM analysis
        // This would allow:
        //   - Domain-specific training on incident/alert/metric patterns
        //   - Optimized prompts for root cause analysis
        //   - Better understanding of infrastructure context
        //   - Custom output format tailored to SRE workflows
        // Research: Now Assist Skill Kit (NASK) or ServiceNow Professional Services
        // Tables: sys_cs_genai_skill, sys_ai_capability
        // See: FUTURE_ENHANCEMENTS.md for detailed plan

        gs.debug(this.LOG_PREFIX + ' Initialized v1.1 (Enhanced prompts for better AI responses)');
    },

    /**
     * Generate description text for ACC SRE Intelligence summary
     * This is the ONLY GenAI call - all other logic remains rule-based
     *
     * @param {Object} context - Analysis context from ACCMetricsAIAnalyzerServer
     *   - ciDetails: { name, className }
     *   - alertCount: number
     *   - alertPatterns: { dominantType, severityDistribution, stateDistribution, rootCauseCount }
     *   - timelineContext: { description }
     *   - metricPatterns: { spikeCount, totalAnalyzed, signalDistribution, behavior }
     *   - correlation: { strength, description }
     *   - title: string (the detected pattern/issue title)
     *   - currentMetrics: { responseTime, failureRate, requestCount, memoryUsage, cpuUsage, overallNormal }
     *
     * @return {Object} { success, description, usedAI }
     */
    generateDescription: function(context) {
        try {
            gs.info(this.LOG_PREFIX + ' Generating description for: ' + (context.title || 'Unknown'));

            // Build focused prompt (just for description)
            var prompt = this._buildDescriptionPrompt(context);

            // Try Now Assist
            var aiResponse = this._callNowLLM(prompt);

            if (aiResponse.success && !aiResponse.fallback) {
                // Clean up AI response and add attribution
                var description = aiResponse.text.trim();
                description += ' [response from Now Assist]';

                gs.info(this.LOG_PREFIX + ' AI description generated');

                return {
                    success: true,
                    description: description,
                    usedAI: true
                };
            } else {
                // Use rule-based fallback
                gs.info(this.LOG_PREFIX + ' Using rule-based description');
                var fallbackDesc = this._generateRuleBasedDescription(context);
                fallbackDesc += ' [response from SRE rulelogic]';

                return {
                    success: true,
                    description: fallbackDesc,
                    usedAI: false
                };
            }

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error: ' + e.message);

            // Emergency fallback
            var emergency = this._generateRuleBasedDescription(context);
            emergency += ' [response from SRE rulelogic]';

            return {
                success: true,
                description: emergency,
                usedAI: false
            };
        }
    },

    /**
     * Build prompt focused ONLY on description generation
     * ACC-adapted: References ACC Metrics Intelligence context, not Dynatrace
     * Includes current metrics assessment for alert relevance
     */
    _buildDescriptionPrompt: function(context) {
        var prompt = '';

        prompt += 'Generate a concise 2-3 sentence summary for this system issue detected by ACC Metrics Intelligence:\n\n';

        // ================================================================
        // SECTION 1: System & Issue Context
        // ================================================================
        if (context.ciDetails && context.ciDetails.name) {
            prompt += 'System: ' + context.ciDetails.name;
            if (context.ciDetails.className) {
                prompt += ' (' + this._formatCIClassName(context.ciDetails.className) + ')';
            }
            prompt += '\n';
        }

        prompt += 'Issue: ' + (context.title || 'System Event') + '\n';
        prompt += 'Source: ACC Metrics Intelligence (Agent Client Collector)\n';

        // ================================================================
        // SECTION 2: Alert Summary with OPEN/CLOSED Status
        // ================================================================
        if (context.alertCount > 0) {
            prompt += 'Alerts: ' + context.alertCount + ' alert(s) detected';

            // Severity breakdown
            if (context.alertPatterns && context.alertPatterns.severityDistribution) {
                var sev = context.alertPatterns.severityDistribution;
                if (sev.critical > 0) prompt += ' (' + sev.critical + ' critical';
                if (sev.major > 0) prompt += ', ' + sev.major + ' major';
                prompt += ')';
            }

            // Open vs Closed distinction
            if (context.alertPatterns && context.alertPatterns.stateDistribution) {
                var state = context.alertPatterns.stateDistribution;
                if (state.open > 0) {
                    prompt += ' - ' + state.open + ' CURRENTLY OPEN';
                } else {
                    prompt += ' - all now resolved';
                }
            }

            if (context.alertPatterns && context.alertPatterns.rootCauseCount > 0) {
                prompt += ', ' + context.alertPatterns.rootCauseCount + ' marked as root cause';
            }
            prompt += '\n';
        }

        // ================================================================
        // SECTION 3: Timeline
        // ================================================================
        if (context.timelineContext && context.timelineContext.description) {
            prompt += 'Timeline: ' + context.timelineContext.description + '\n';
        }

        // ================================================================
        // SECTION 4: ACC Metrics During Alert Window
        // ================================================================
        if (context.metricPatterns && context.metricPatterns.spikeCount > 0) {
            prompt += 'ACC Metrics During Alert Window: ' + context.metricPatterns.spikeCount + ' of ' + context.metricPatterns.totalAnalyzed + ' metrics spiked';

            // Signal breakdown (TELS: Traffic, Errors, Latency, Saturation)
            if (context.metricPatterns.signalDistribution) {
                var signals = [];
                for (var signal in context.metricPatterns.signalDistribution) {
                    var count = context.metricPatterns.signalDistribution[signal];
                    if (count > 0) {
                        signals.push(count + ' ' + signal.toLowerCase());
                    }
                }
                if (signals.length > 0) {
                    prompt += ' (' + signals.join(', ') + ')';
                }
            }
            prompt += '\n';
        }

        // ================================================================
        // SECTION 5: Current Metrics Status
        // ================================================================
        if (context.currentMetrics) {
            prompt += '\nCURRENT METRICS STATUS (Last Hour - ACC Collector Data):\n';

            // Response Time
            if (context.currentMetrics.responseTime !== null && context.currentMetrics.responseTime !== undefined) {
                prompt += '- Response Time: ' + context.currentMetrics.responseTime;
                if (context.currentMetrics.responseTimeNormal) {
                    prompt += ' (NORMAL - within baseline)';
                } else {
                    prompt += ' (ELEVATED - still above baseline)';
                }
                prompt += '\n';
            }

            // Failure Rate
            if (context.currentMetrics.failureRate !== null && context.currentMetrics.failureRate !== undefined) {
                prompt += '- Failure Rate: ' + context.currentMetrics.failureRate + '%';
                if (context.currentMetrics.failureRateNormal) {
                    prompt += ' (NORMAL - below 1% threshold)';
                } else {
                    prompt += ' (ELEVATED - above 1% threshold)';
                }
                prompt += '\n';
            }

            // Request Count / Throughput
            if (context.currentMetrics.requestCount !== null && context.currentMetrics.requestCount !== undefined) {
                prompt += '- Request Count: ' + context.currentMetrics.requestCount + '/min';
                if (context.currentMetrics.requestCountNormal) {
                    prompt += ' (STABLE - within normal variance)';
                } else {
                    prompt += ' (FLUCTUATING - unusual traffic pattern)';
                }
                prompt += '\n';
            }

            // Memory
            if (context.currentMetrics.memoryUsage !== null && context.currentMetrics.memoryUsage !== undefined) {
                prompt += '- Memory Usage: ' + context.currentMetrics.memoryUsage + '%';
                if (context.currentMetrics.memoryNormal) {
                    prompt += ' (NORMAL - below 85%)';
                } else {
                    prompt += ' (ELEVATED - above 85%)';
                }
                prompt += '\n';
            }

            // CPU
            if (context.currentMetrics.cpuUsage !== null && context.currentMetrics.cpuUsage !== undefined) {
                prompt += '- CPU Usage: ' + context.currentMetrics.cpuUsage + '%';
                if (context.currentMetrics.cpuNormal) {
                    prompt += ' (NORMAL - below 80%)';
                } else {
                    prompt += ' (ELEVATED - above 80%)';
                }
                prompt += '\n';
            }

            // Overall assessment
            if (context.currentMetrics.overallNormal) {
                prompt += '- Overall Assessment: Metrics have RETURNED TO NORMAL levels\n';
            } else {
                prompt += '- Overall Assessment: Some metrics STILL SHOWING ANOMALIES\n';
            }
        }

        // ================================================================
        // SECTION 6: Correlation
        // ================================================================
        if (context.correlation && context.correlation.description) {
            prompt += 'Correlation: ' + context.correlation.description + '\n';
        }

        // ================================================================
        // SECTION 7: Enhanced AI Instructions (v1.1 - Improved Specificity)
        // ================================================================
        prompt += '\n=== INSTRUCTIONS FOR AI ANALYSIS ===\n';
        prompt += 'You are an expert SRE analyst reviewing a production system incident. Provide a detailed, actionable analysis in 3-4 sentences.\n\n';

        prompt += 'REQUIRED ELEMENTS (YOU MUST INCLUDE ALL OF THESE):\n';
        prompt += '1. SPECIFIC METRICS: Name the EXACT metrics showing anomalies with their names from the data above\n';
        prompt += '   - BAD: "some metrics are elevated"\n';
        prompt += '   - GOOD: "CPU usage, memory consumption, and response time"\n\n';

        prompt += '2. ACTUAL VALUES: Include SPECIFIC NUMBERS from the data above\n';
        prompt += '   - BAD: "metrics are high"\n';
        prompt += '   - GOOD: "CPU spiked to 95% (baseline: 40%), response time increased to 3.2s (baseline: 200ms)"\n\n';

        prompt += '3. TIMELINE CONTEXT: Reference the actual timeframes from the data\n';
        prompt += '   - Include when the issue started and current duration\n';
        prompt += '   - Mention if this is ongoing vs resolved\n\n';

        prompt += '4. ROOT CAUSE HYPOTHESIS: Based on the pattern, suggest 1-2 LIKELY causes\n';
        prompt += '   - High CPU + Normal Memory → CPU-bound process, algorithmic issue, infinite loop\n';
        prompt += '   - High Memory + Normal CPU → Memory leak, cache growth, unclosed connections\n';
        prompt += '   - High CPU + High Memory → Resource exhaustion, traffic spike, runaway process\n';
        prompt += '   - Slow response + Normal resources → Database latency, network congestion, external API delay\n';
        prompt += '   - High errors + Normal resources → Application bug, integration failure, bad deployment\n\n';

        prompt += '5. CURRENT STATUS: Based on the "Current Metrics Status" section above, state:\n';
        prompt += '   - If alerts OPEN + metrics NORMAL: "Alert remains open, but [metric names] have returned to normal ([specific values]), suggesting self-resolution"\n';
        prompt += '   - If alerts OPEN + metrics ELEVATED: "Issue ongoing with [metric names] currently at [values], requiring immediate attention"\n';
        prompt += '   - If alerts CLOSED + metrics NORMAL: "Issue resolved with all metrics returned to baseline"\n';
        prompt += '   - If alerts CLOSED + metrics ELEVATED: "Alerts closed but [metric names] remain elevated at [values], monitoring recommended"\n\n';

        prompt += 'FORMATTING RULES:\n';
        prompt += '- Start with the MOST CRITICAL finding (highest severity or biggest deviation)\n';
        prompt += '- Use EXACT metric names from the data - never generalize or say "various metrics"\n';
        prompt += '- Compare current values to baselines when provided\n';
        prompt += '- Write for a senior engineer who needs to take immediate action\n';
        prompt += '- Be concise but specific - every number and metric name matters\n';
        prompt += '- Do NOT include attribution text (will be added automatically)\n';
        prompt += '- Do NOT provide recommendations (focus on status assessment only)\n\n';

        prompt += 'EXAMPLE OF EXCELLENT RESPONSE:\n';
        prompt += '"Critical resource exhaustion detected on Windows Server between 14:59 and 12:04 (21 hours). CPU usage spiked to 95% (baseline: 40%) with sustained elevation, while memory climbed to 14.2GB (85% of capacity). 19 critical alerts fired for CPU threshold violations, with 4 alerts still open. Pattern suggests memory leak causing CPU thrash - likely runaway application process or unclosed database connections. Current metrics show CPU remains elevated at 92% and memory at 13.8GB, requiring immediate investigation of running processes and application logs."\n\n';

        prompt += 'NOW GENERATE YOUR ANALYSIS FOLLOWING THE ABOVE REQUIREMENTS:\n';

        return prompt;
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
            'cmdb_ci_computer': 'Computer'
        };

        return friendlyNames[className] || className;
    },

    /**
     * Call Now Assist LLM using One Extend API
     * Uses VA Freeform Prompt capability
     *
     * @param {string} prompt - The prompt to send to Now Assist
     * @return {Object} { success, text, fallback }
     */
    _callNowLLM: function(prompt) {
        try {
            if (typeof sn_one_extend === 'undefined' || !sn_one_extend.OneExtendUtil) {
                gs.warn(this.LOG_PREFIX + ' One Extend API not available');
                return { success: false, fallback: true };
            }

            var request = {
                "executionRequests": [{
                    "payload": { "prompt": prompt },
                    "capabilityId": this.VA_CAPABILITY_ID
                }]
            };

            var response = sn_one_extend.OneExtendUtil.execute(request);

            if (response && response.status === 'completed') {
                var result = response.capabilities[this.VA_CAPABILITY_ID];

                if (result && result.status === 'success' && result.response) {
                    gs.info(this.LOG_PREFIX + ' AI response received (' + result.response.length + ' chars)');
                    return {
                        success: true,
                        text: result.response,
                        fallback: false
                    };
                }
            }

            gs.warn(this.LOG_PREFIX + ' No valid response from Now Assist');
            return { success: false, fallback: true };

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' LLM call failed: ' + e.message);
            return { success: false, fallback: true };
        }
    },

    /**
     * Generate rule-based description (fallback when Now Assist is unavailable)
     * Includes current metrics assessment
     *
     * @param {Object} context - Full analysis context
     * @return {string} Rule-based description text
     */
    _generateRuleBasedDescription: function(context) {
        var parts = [];

        // Part 1: CI Context
        if (context.ciDetails && context.ciDetails.name) {
            var ciContext = 'Analysis for ' + context.ciDetails.name;
            if (context.ciDetails.className) {
                ciContext += ' (' + this._formatCIClassName(context.ciDetails.className) + ')';
            }
            parts.push(ciContext + ':');
        }

        // Part 2: Alert context with open/closed
        if (context.alertCount > 0) {
            var alertDesc = context.alertCount + ' alert(s) detected';

            if (context.alertPatterns && context.alertPatterns.severityDistribution) {
                var sev = context.alertPatterns.severityDistribution;
                if (sev.critical > 0) {
                    alertDesc += ' (' + sev.critical + ' critical';
                    if (sev.major > 0) alertDesc += ', ' + sev.major + ' major';
                    alertDesc += ')';
                }
            }

            // Add open/closed status
            if (context.alertPatterns && context.alertPatterns.stateDistribution) {
                var state = context.alertPatterns.stateDistribution;
                if (state.open > 0) {
                    alertDesc += ', ' + state.open + ' currently open';
                } else {
                    alertDesc += ', all now resolved';
                }
            }

            if (context.alertPatterns && context.alertPatterns.rootCauseCount > 0) {
                alertDesc += ', ' + context.alertPatterns.rootCauseCount + ' marked as root cause';
            }

            parts.push(alertDesc);
        }

        // Part 3: Timeline
        if (context.timelineContext && context.timelineContext.description) {
            parts.push(context.timelineContext.description);
        }

        // Part 4: Metrics during alert window
        if (context.metricPatterns && context.metricPatterns.spikeCount > 0) {
            var metricDesc = context.metricPatterns.spikeCount + ' of ' + context.metricPatterns.totalAnalyzed + ' metrics spiked';

            if (context.metricPatterns.signalDistribution) {
                var signals = [];
                for (var signal in context.metricPatterns.signalDistribution) {
                    var count = context.metricPatterns.signalDistribution[signal];
                    if (count > 0) {
                        signals.push(count + ' ' + signal.toLowerCase());
                    }
                }
                if (signals.length > 0) {
                    metricDesc += ' (' + signals.join(', ') + ')';
                }
            }

            parts.push(metricDesc);
        }

        // Part 5: Current metrics assessment
        if (context.currentMetrics) {
            if (context.currentMetrics.overallNormal) {
                parts.push('Current metrics have returned to normal levels');
            } else {
                var elevatedMetrics = [];
                if (context.currentMetrics.responseTime && !context.currentMetrics.responseTimeNormal) {
                    elevatedMetrics.push('response time');
                }
                if (context.currentMetrics.memoryUsage && !context.currentMetrics.memoryNormal) {
                    elevatedMetrics.push('memory');
                }
                if (context.currentMetrics.cpuUsage && !context.currentMetrics.cpuNormal) {
                    elevatedMetrics.push('CPU');
                }

                if (elevatedMetrics.length > 0) {
                    parts.push('Current ' + elevatedMetrics.join(', ') + ' still elevated');
                }
            }
        }

        // Part 6: Interpretation
        if (context.correlation && context.correlation.strength === 'high') {
            parts.push('Strong correlation indicates common root cause');
        } else if (context.metricPatterns && context.metricPatterns.behavior === 'spiking') {
            parts.push('Multiple metrics deviated >2x from baseline simultaneously');
        }

        return parts.join('. ') + '.';
    },

    type: 'ACCMetricsAILLM'
};