# Now Assist Integration Plan

**Version:** 5.0
**Status:** Framework Complete - Now Assist API Integration Pending
**Date:** 2025-02-12

---

## 📋 Current State

### ✅ What's Already Built

The **complete fallback framework** is implemented and working:

1. **Smart CI Selection** - Auto-selects most critical CI for analysis
2. **Fallback Architecture** - Tries Now Assist first, falls back to SRE rules
3. **Client-side placeholder** - `_fetchNowAssistInsights()` ready for API integration
4. **Visual indicators** - Shows which analysis engine was used
5. **Stress scoring** - Ranks CIs by alert severity, metric violations, anomalies

### 🔄 Current Behavior

When SRE Intelligence is enabled:
- Client calls `_fetchInsightsWithFallback()`
- Tries `_fetchNowAssistInsights()` first
- **Placeholder returns:** `{ success: false, message: 'Now Assist not configured' }`
- Falls back to `_fetchSREInsights()` (SRE rules engine)
- Subtitle shows: **"powered by SRE Rules Engine"**

---

## 🎯 Implementation Goal

Replace the placeholder with **real Now Assist API integration** so that:
- Now Assist AI analyzes metrics, alerts, and CI health
- Returns AI-generated insights (probable cause, recommendations, correlations)
- Subtitle shows: **"powered by Now Assist"** when successful
- Falls back to SRE rules if Now Assist unavailable/fails

---

## 📂 File Locations

### Client-Side Files
| File | Path | Status |
|------|------|--------|
| Main client script | `src/ui_pages/acc_metrics_intelligence_client.js` | ✅ Framework ready |
| Placeholder function | Line ~2555: `_fetchNowAssistInsights()` | 🔄 Needs API integration |

### Server-Side Files (TO CREATE)
| File | Path | Status |
|------|------|--------|
| Now Assist Ajax processor | `src/script_includes/ACCNowAssistAnalyzer.js` | ❌ Does not exist |
| Now Assist Server logic | `src/script_includes/ACCNowAssistAnalyzerServer.js` | ❌ Does not exist |

---

## 🔧 Implementation Steps

### **Step 1: Create Server-Side Ajax Processor**

**File:** `src/script_includes/ACCNowAssistAnalyzer.js`

```javascript
// Script Include: x_snc_metricintelp.ACCNowAssistAnalyzer
// Name: ACCNowAssistAnalyzer
// API Name: x_snc_metricintelp.ACCNowAssistAnalyzer
// Extends: AbstractAjaxProcessor
// Client Callable: true

var ACCNowAssistAnalyzer = Class.create();
ACCNowAssistAnalyzer.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    getNowAssistInsights: function() {
        var ciSysId = this.getParameter('sysparm_ci_sys_id');
        var timeRange = this.getParameter('sysparm_time_range') || '24h';
        var metricsJson = this.getParameter('sysparm_metrics');
        var alertsJson = this.getParameter('sysparm_alerts');

        var metrics = [];
        var alerts = [];

        // Parse metrics
        if (metricsJson) {
            try {
                metrics = JSON.parse(metricsJson);
            } catch (e) {
                gs.error('[ACCNowAssistAnalyzer] Error parsing metrics: ' + e);
            }
        }

        // Parse alerts
        if (alertsJson) {
            try {
                alerts = JSON.parse(alertsJson);
            } catch (e) {
                gs.error('[ACCNowAssistAnalyzer] Error parsing alerts: ' + e);
            }
        }

        try {
            var analyzer = new x_snc_metricintelp.ACCNowAssistAnalyzerServer();
            var insights = analyzer.getNowAssistInsights(ciSysId, metrics, alerts, timeRange);

            return JSON.stringify({
                success: true,
                insights: insights
            });
        } catch (e) {
            gs.error('[ACCNowAssistAnalyzer] Error: ' + e);
            return JSON.stringify({
                success: false,
                error: e.toString()
            });
        }
    },

    type: 'ACCNowAssistAnalyzer'
});
```

---

### **Step 2: Create Server-Side Now Assist Logic**

**File:** `src/script_includes/ACCNowAssistAnalyzerServer.js`

```javascript
// Script Include: x_snc_metricintelp.ACCNowAssistAnalyzerServer
// Name: ACCNowAssistAnalyzerServer

var ACCNowAssistAnalyzerServer = Class.create();
ACCNowAssistAnalyzerServer.prototype = {
    initialize: function() {
        this.LOG_PREFIX = '[ACCNowAssistAnalyzerServer]';
    },

    /**
     * Generate insights using Now Assist AI
     * @param {string} ciSysId - CI sys_id
     * @param {Array} metrics - Metric data array
     * @param {Array} alerts - Alert data array
     * @param {string} timeRange - Time range (e.g., '24h')
     * @return {Object} Now Assist insights
     */
    getNowAssistInsights: function(ciSysId, metrics, alerts, timeRange) {
        gs.info(this.LOG_PREFIX + ' ===== NOW ASSIST ANALYSIS START =====');
        gs.info(this.LOG_PREFIX + ' CI: ' + ciSysId);
        gs.info(this.LOG_PREFIX + ' Metrics: ' + metrics.length);
        gs.info(this.LOG_PREFIX + ' Alerts: ' + alerts.length);

        // TODO: Check if Now Assist is available/configured
        if (!this._isNowAssistAvailable()) {
            gs.warn(this.LOG_PREFIX + ' Now Assist not available');
            return this._buildErrorResponse('Now Assist not configured');
        }

        try {
            // Build context for Now Assist
            var context = this._buildAnalysisContext(ciSysId, metrics, alerts, timeRange);

            // Call Now Assist API
            var nowAssistResponse = this._callNowAssistAPI(context);

            if (nowAssistResponse.success) {
                // Parse and structure Now Assist response
                return this._structureInsights(nowAssistResponse.data);
            } else {
                return this._buildErrorResponse(nowAssistResponse.error);
            }

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error: ' + e.message);
            return this._buildErrorResponse(e.toString());
        }
    },

    /**
     * Check if Now Assist is available and configured
     */
    _isNowAssistAvailable: function() {
        // TODO: Implement actual Now Assist availability check
        // Check system properties, licenses, API credentials, etc.

        // Placeholder: Always return false for now
        return false;
    },

    /**
     * Build analysis context for Now Assist
     */
    _buildAnalysisContext: function(ciSysId, metrics, alerts, timeRange) {
        var context = {
            ci_sys_id: ciSysId,
            time_range: timeRange,
            metrics_summary: this._summarizeMetrics(metrics),
            alerts_summary: this._summarizeAlerts(alerts),
            ci_details: this._getCIDetails(ciSysId)
        };

        return context;
    },

    /**
     * Call Now Assist API with context
     */
    _callNowAssistAPI: function(context) {
        // TODO: Implement actual Now Assist API call
        // This will vary based on ServiceNow's Now Assist API structure

        /* EXAMPLE STRUCTURE (adjust based on actual API):

        var nowAssist = new sn_now_assist.NowAssistAPI();
        var prompt = this._buildPrompt(context);
        var response = nowAssist.analyze({
            prompt: prompt,
            context: context,
            model: 'sre-analysis'
        });

        return {
            success: response.success,
            data: response.insights
        };

        */

        // Placeholder: Return error
        return {
            success: false,
            error: 'Now Assist API integration not implemented'
        };
    },

    /**
     * Build AI prompt for Now Assist
     */
    _buildPrompt: function(context) {
        var prompt = "You are an SRE analyst. Analyze the following system metrics and alerts:\n\n";
        prompt += "CI: " + context.ci_details.name + " (" + context.ci_details.className + ")\n";
        prompt += "Time Range: " + context.time_range + "\n\n";
        prompt += "Metrics Summary:\n" + JSON.stringify(context.metrics_summary, null, 2) + "\n\n";
        prompt += "Alerts Summary:\n" + JSON.stringify(context.alerts_summary, null, 2) + "\n\n";
        prompt += "Provide:\n";
        prompt += "1. Probable cause (title and detailed description)\n";
        prompt += "2. Correlation analysis between alerts and metrics\n";
        prompt += "3. 3-5 actionable recommendations\n";
        prompt += "4. Overall system health assessment\n";

        return prompt;
    },

    /**
     * Structure Now Assist response into standard format
     */
    _structureInsights: function(nowAssistData) {
        // Transform Now Assist response into the format expected by client
        return {
            success: true,
            probableCause: {
                title: nowAssistData.probable_cause_title || 'AI Analysis Complete',
                description: nowAssistData.probable_cause_description || '',
                correlation: 85  // AI confidence score
            },
            alertSummary: nowAssistData.alert_summary || {},
            metricCorrelation: nowAssistData.metric_correlation || null,
            recommendations: nowAssistData.recommendations || [],
            ciDetails: nowAssistData.ci_details || null,
            analysisMode: 'ai_powered'
        };
    },

    /**
     * Summarize metrics for AI context
     */
    _summarizeMetrics: function(metrics) {
        var summary = {
            total_metrics: metrics.length,
            critical_metrics: [],
            warning_metrics: [],
            normal_metrics: 0
        };

        for (var i = 0; i < metrics.length; i++) {
            var m = metrics[i];
            // Analyze metric health (simplified)
            if (m.max > 90) {
                summary.critical_metrics.push({
                    name: m.name,
                    max: m.max,
                    unit: m.unit
                });
            } else if (m.max > 75) {
                summary.warning_metrics.push({
                    name: m.name,
                    max: m.max,
                    unit: m.unit
                });
            } else {
                summary.normal_metrics++;
            }
        }

        return summary;
    },

    /**
     * Summarize alerts for AI context
     */
    _summarizeAlerts: function(alerts) {
        var summary = {
            total: alerts.length,
            by_severity: {
                critical: 0,
                major: 0,
                minor: 0,
                warning: 0,
                info: 0
            },
            recent_alerts: []
        };

        for (var i = 0; i < Math.min(5, alerts.length); i++) {
            var a = alerts[i];
            var sevLabel = a.severity_label || 'unknown';
            summary.by_severity[sevLabel.toLowerCase()] = (summary.by_severity[sevLabel.toLowerCase()] || 0) + 1;

            summary.recent_alerts.push({
                number: a.number,
                severity: a.severity_label,
                description: a.short_description,
                created: a.sys_created_on
            });
        }

        return summary;
    },

    /**
     * Get CI details
     */
    _getCIDetails: function(ciSysId) {
        var ci = new GlideRecord('cmdb_ci');
        if (ci.get(ciSysId)) {
            return {
                sys_id: ciSysId,
                name: ci.getValue('name'),
                className: ci.getValue('sys_class_name')
            };
        }
        return null;
    },

    /**
     * Build error response
     */
    _buildErrorResponse: function(errorMessage) {
        return {
            success: false,
            error: errorMessage,
            probableCause: {
                title: 'Analysis Unavailable',
                description: 'Now Assist analysis could not be completed: ' + errorMessage,
                correlation: 0
            },
            recommendations: [],
            analysisMode: 'error'
        };
    },

    type: 'ACCNowAssistAnalyzerServer'
};
```

---

### **Step 3: Update Client-Side Placeholder**

**File:** `src/ui_pages/acc_metrics_intelligence_client.js`
**Function:** `_fetchNowAssistInsights()` (around line 2555)

**Replace the placeholder timeout with real API call:**

```javascript
_fetchNowAssistInsights: function(ciSysId, callback) {
    var self = this;

    console.log('[NOW_ASSIST] Checking Now Assist availability...');

    // Make real GlideAjax call to Now Assist analyzer
    var ga = new GlideAjax('x_snc_metricintelp.ACCNowAssistAnalyzer');
    ga.addParam('sysparm_name', 'getNowAssistInsights');
    ga.addParam('sysparm_ci_sys_id', ciSysId);
    ga.addParam('sysparm_metrics', JSON.stringify(self.data.metrics));
    ga.addParam('sysparm_alerts', JSON.stringify(self.data.alerts));
    ga.addParam('sysparm_time_range', self.data.filters.timeRange);

    ga.getXMLAnswer(function(response) {
        try {
            if (!response || response === 'null' || response.trim() === '') {
                callback({
                    success: false,
                    message: 'Empty response from Now Assist'
                });
                return;
            }

            var nowAssistData = JSON.parse(response);

            if (nowAssistData.success) {
                console.log('[NOW_ASSIST] ✓ Insights received');
                callback({
                    success: true,
                    data: nowAssistData.insights
                });
            } else {
                console.log('[NOW_ASSIST] Not available:', nowAssistData.error);
                callback({
                    success: false,
                    message: nowAssistData.error || 'Now Assist returned error'
                });
            }
        } catch (e) {
            console.error('[NOW_ASSIST] Parse error:', e);
            callback({
                success: false,
                message: 'Failed to parse Now Assist response'
            });
        }
    });
},
```

---

## 🧪 Testing Strategy

### **Phase 1: Placeholder Testing (Current State)**
✅ Already working - SRE Intelligence falls back to rules engine

### **Phase 2: Server-Side Testing**
1. Create both Script Includes in ServiceNow
2. Test availability check: `_isNowAssistAvailable()` should return false
3. Verify fallback works (should still use SRE rules)

### **Phase 3: Now Assist API Integration**
1. Research ServiceNow Now Assist API documentation
2. Implement `_callNowAssistAPI()` with real API calls
3. Test with actual Now Assist responses
4. Verify subtitle shows "powered by Now Assist"

### **Phase 4: Production Testing**
1. Test with 1 CI (should work)
2. Test with multiple CIs (should auto-select worst CI)
3. Test fallback when Now Assist times out
4. Verify performance (AI calls can be slow - add timeout)

---

## 🔍 Research Required

Before implementing, research these ServiceNow APIs:

1. **Now Assist API Structure**
   - How to call Now Assist from Script Includes
   - Authentication/configuration requirements
   - API endpoint and parameters
   - Response format

2. **ServiceNow Documentation**
   - Search for: "Now Assist API", "sn_now_assist", "Virtual Agent API"
   - Check if there's a REST API or JavaScript API
   - Look for example integrations

3. **Alternative: Virtual Agent Integration**
   - If direct API not available, might need Virtual Agent topic
   - Could be async (webhook callback pattern)

---

## 📊 Expected Response Format

Now Assist should return insights matching this structure:

```javascript
{
    success: true,
    insights: {
        probableCause: {
            title: "High CPU Usage Due to Process Leak",
            description: "Analysis indicates sustained CPU at 95%...",
            correlation: 85
        },
        alertSummary: {
            total: 9,
            open: 7,
            closed: 2
        },
        metricCorrelation: {
            // Correlation details
        },
        recommendations: [
            {
                title: "Identify Runaway Process",
                description: "Use top/htop to identify...",
                priority: "high"
            },
            // ... more recommendations
        ],
        ciDetails: {
            name: "cruprgwhtheli00",
            className: "cmdb_ci_win_server"
        },
        analysisMode: "ai_powered"
    }
}
```

---

## ⚠️ Important Notes

1. **Fallback Always Works**
   - Even if Now Assist fails, SRE rules will take over
   - Users always get insights (never a blank screen)

2. **Performance**
   - AI calls can be slow (5-30 seconds)
   - Consider adding timeout (30 seconds max)
   - Show loading indicator during AI analysis

3. **Error Handling**
   - Graceful degradation is critical
   - Log all errors for debugging
   - Never break the dashboard if Now Assist fails

4. **API Costs**
   - Now Assist API calls may have usage limits
   - Consider caching results temporarily
   - Monitor API usage in production

---

## 🚀 Quick Start for Next Session

```bash
# 1. Clone the repo (if new session)
cd /Users/charles.elite/github/ServiecNowMetricsIntellUIAlt

# 2. Review current state
git log --oneline -5

# 3. Read this plan
cat NOW_ASSIST_INTEGRATION_PLAN.md

# 4. Start with Step 1: Create server-side files
# Create: src/script_includes/ACCNowAssistAnalyzer.js
# Create: src/script_includes/ACCNowAssistAnalyzerServer.js

# 5. Research Now Assist API
# ServiceNow docs, community forums, API explorer

# 6. Implement and test
```

---

## 📝 Session Handoff Checklist

When starting a new session, verify:
- [ ] Framework v5.0 is deployed and working
- [ ] SRE Intelligence works with rules engine fallback
- [ ] Smart CI selection works on multi-CI pages
- [ ] Console shows "powered by SRE Rules Engine"
- [ ] No errors in browser console

Then proceed with Now Assist integration steps above.

---

## 📞 Questions for Next Session

If unclear during implementation:
1. Is there a ServiceNow Now Assist JavaScript API?
2. Do we need API credentials/tokens?
3. Is there a simpler "AI Search" or "Virtual Agent" API we can use?
4. Should we use REST API instead of JavaScript API?
5. What's the expected response time for AI analysis?

---

**Good luck with the Now Assist integration! The framework is solid and ready for the API connection.**
