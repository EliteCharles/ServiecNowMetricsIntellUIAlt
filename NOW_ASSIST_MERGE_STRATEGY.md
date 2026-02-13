# Now Assist Integration - Dynatrace Merge Strategy

**Version:** 1.0
**Date:** 2026-02-13
**Status:** Ready for Implementation

---

## Executive Summary

This document provides a detailed strategy for merging the **Dynatrace Now Assist implementation** with our **ACC Metrics Intelligence codebase**. The Dynatrace team has successfully implemented a working Now Assist integration that we can adapt to replace our placeholder implementation.

### Key Findings

✅ **What Dynatrace Got Right:**
- Production-ready Now Assist API integration using `sn_one_extend.OneExtendUtil`
- Hybrid AI + rule-based approach with graceful fallback
- Clean separation: AI for description generation, rules for pattern detection
- Robust error handling with multiple fallback layers
- Current metrics awareness (v3.5) - compares alert state vs current system state

✅ **What We Already Have:**
- Complete fallback framework (Now Assist → SRE Rules)
- Smart CI selection and stress scoring
- Client-side placeholder ready for integration
- Simplified metrics payload construction

🎯 **Integration Strategy:**
- Adopt Dynatrace's Now Assist API calling mechanism
- Keep our fallback framework architecture
- Merge their hybrid AI+rules approach with our SRE rules engine
- Add their current metrics assessment feature

---

## 1. Architecture Comparison

### Our Current Architecture (Placeholder)

```
Client (_fetchNowAssistInsights)
    ↓ [placeholder - always fails]
    → Falls back to _fetchSREInsights
        ↓ [GlideAjax call]
        → (Not yet created: ACCNowAssistAnalyzer)
            ↓
            → (Not yet created: ACCNowAssistAnalyzerServer)
```

### Dynatrace Architecture (Working)

```
Client (loadAIInsights)
    ↓ [GlideAjax: MetricsAIAnalyzerAjax]
    → ajaxGetSREInsights()
        ↓
        → MetricsAIAnalyzerServer
            ↓
            → getSREIntelligenceInsights()
                ├─→ Rule-based analysis (alerts, metrics, correlation)
                └─→ MetricsAIAnalyzerServerLLM
                    ├─→ Try: sn_one_extend.OneExtendUtil.execute()
                    └─→ Fallback: Rule-based description
```

### Key Difference

**Dynatrace approach:** ALL analysis is rule-based EXCEPT the description text, which uses AI with fallback.

**Our planned approach:** Attempt full AI analysis, then fall back to rules.

**RECOMMENDED:** Adopt Dynatrace's hybrid approach - it's more reliable and predictable.

---

## 2. Now Assist API Implementation

### Critical Discovery: The Working API Call

Dynatrace successfully calls Now Assist using this approach:

```javascript
// From: MetricsAIAnalyzerServerLLM.js (lines 316-351)

_callNowLLM: function(prompt) {
    try {
        // Check if One Extend API is available
        if (typeof sn_one_extend === 'undefined' || !sn_one_extend.OneExtendUtil) {
            gs.warn(this.LOG_PREFIX + ' One Extend API not available');
            return { success: false, fallback: true };
        }

        var request = {
            "executionRequests": [{
                "payload": { "prompt": prompt },
                "capabilityId": this.VA_CAPABILITY_ID  // Key: Virtual Agent capability ID
            }]
        };

        var response = sn_one_extend.OneExtendUtil.execute(request);

        if (response && response.status === 'completed') {
            var result = response.capabilities[this.VA_CAPABILITY_ID];

            if (result && result.status === 'success' && result.response) {
                gs.info(this.LOG_PREFIX + ' ✓ AI response received (' + result.response.length + ' chars)');
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
}
```

**Key Components:**
1. **API:** `sn_one_extend.OneExtendUtil.execute(request)`
2. **Capability ID:** `d82ff09efffc311063f5ffffffffffc5` (Virtual Agent capability)
3. **Request Format:** Object with `executionRequests` array containing `payload` and `capabilityId`
4. **Response Format:** Object with `status` and `capabilities[capabilityId].response`

---

## 3. Step-by-Step Merge Strategy

### Phase 1: Create Server-Side Script Includes

#### File 1: `ACCNowAssistAnalyzerServer.js` (Main Server Logic)

**Path:** `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzerServer.js`

**Strategy:** Merge Dynatrace's `MetricsAIAnalyzerServer.js` approach with our planned structure.

**Key Adaptations:**
- Keep Dynatrace's rule-based pattern detection (lines 345-430)
- Keep Dynatrace's correlation logic (lines 463-503)
- Keep Dynatrace's current metrics assessment (lines 514-606) - **NEW FEATURE!**
- Adapt to work with ACC data structures
- Use our namespace: `x_snc_metricintelp`

<details>
<summary>See implementation skeleton</summary>

```javascript
var ACCNowAssistAnalyzerServer = Class.create();
ACCNowAssistAnalyzerServer.prototype = {

    initialize: function() {
        this.LOG_PREFIX = '[ACCNowAssist]';
        this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5';

        // Store original data for current metrics assessment
        this._originalMetrics = null;
        this._originalAlerts = null;
    },

    /**
     * Main entry point - called by Ajax processor
     * ADAPTED FROM: Dynatrace MetricsAIAnalyzerServer.getSREIntelligenceInsights()
     */
    getNowAssistInsights: function(ciSysId, metrics, alerts, timeRange) {
        gs.info(this.LOG_PREFIX + ' ===== ANALYSIS START =====');

        this._originalMetrics = metrics;
        this._originalAlerts = alerts;

        var result = {
            success: true,
            probableCause: { title: 'System Analysis', description: 'Analyzing...', correlation: 60 },
            alertSummary: { total: 0, open: 0, closed: 0 },
            alertTimelineCorrelation: '',
            metricCorrelation: null,
            recommendations: [],
            ciDetails: null,
            analysisMode: 'hybrid_ai_rules'
        };

        try {
            // 1. Get CI details
            if (ciSysId) {
                result.ciDetails = this._getCIDetails(ciSysId);
            }

            // 2. Summarize alerts (rule-based)
            result.alertSummary = this._summarizeAlerts(alerts);

            // 3. Determine analysis context (rule-based)
            var analysisContext = this._determineAnalysisContext(alerts, metrics, timeRange);
            result.analysisMode = analysisContext.mode;
            result.alertTimelineCorrelation = analysisContext.timelineDescription;

            // 4. Analyze metrics with context (rule-based)
            var metricAnalysis = this._analyzeMetricsWithContext(metrics, analysisContext);
            result.metricCorrelation = metricAnalysis;

            // 5. Generate probable cause (HYBRID: AI for description, rules for pattern)
            result.probableCause = this._determineSmartFallback(alerts, metricAnalysis, analysisContext, result.ciDetails);

            // 6. Generate recommendations (rule-based)
            result.recommendations = this._generateSmartRecommendations(result.probableCause, analysisContext);

            gs.info(this.LOG_PREFIX + ' ✓ Analysis complete: ' + result.probableCause.title);

        } catch (e) {
            gs.error(this.LOG_PREFIX + ' Error: ' + e.message);
            return this._buildErrorResponse(e.toString());
        }

        return result;
    },

    // === COPY FROM DYNATRACE: Alert/Metric Pattern Detection ===
    // Lines 346-430 from MetricsAIAnalyzerServer.js

    _extractAlertPatterns: function(alerts) { /* ... */ },
    _extractMetricPatterns: function(metricAnalysis) { /* ... */ },
    _buildTimelineContext: function(alerts, context) { /* ... */ },
    _correlateAlertsWithMetrics: function(alertPatterns, metricPatterns) { /* ... */ },

    // === COPY FROM DYNATRACE: Current Metrics Assessment (v3.5 feature) ===
    // Lines 514-606 from MetricsAIAnalyzerServer.js

    _assessCurrentMetrics: function(metrics, alerts) { /* ... */ },

    // === COPY FROM DYNATRACE: Hybrid AI Integration ===
    // Lines 612-682 from MetricsAIAnalyzerServer.js

    _buildDynamicSummary: function(alertPatterns, metricPatterns, timelineContext, correlation, ciDetails) {
        // This calls the LLM wrapper for description generation
        // Falls back to rule-based if AI unavailable
    },

    // === Helper functions ===
    _getCIDetails: function(ciSysId) { /* ... */ },
    _summarizeAlerts: function(alerts) { /* ... */ },
    _determineAnalysisContext: function(alerts, metrics, timeRange) { /* ... */ },
    _analyzeMetricsWithContext: function(metrics, context) { /* ... */ },
    _generateSmartRecommendations: function(probableCause, context) { /* ... */ },
    _buildErrorResponse: function(errorMessage) { /* ... */ },

    type: 'ACCNowAssistAnalyzerServer'
};
```

</details>

---

#### File 2: `ACCNowAssistAnalyzerLLM.js` (AI Description Generator)

**Path:** `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzerLLM.js`

**Strategy:** Direct adaptation of Dynatrace's `MetricsAIAnalyzerServerLLM.js` (458 lines).

**Key Features:**
- Single responsibility: Generate description text ONLY
- Uses `sn_one_extend.OneExtendUtil.execute()` for Now Assist
- Smart prompt engineering with current metrics awareness
- Built-in rule-based fallback

<details>
<summary>See implementation skeleton</summary>

```javascript
var ACCNowAssistAnalyzerLLM = Class.create();
ACCNowAssistAnalyzerLLM.prototype = {

    initialize: function() {
        this.LOG_PREFIX = '[ACC LLM]';
        this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5';
    },

    /**
     * Generate description text for SRE Intelligence summary
     * ADAPTED FROM: Dynatrace MetricsAIAnalyzerServerLLM.generateDescription()
     *
     * @param {Object} context - Analysis context including:
     *   - ciDetails, alertCount, alertPatterns, timelineContext
     *   - metricPatterns, correlation, title, currentMetrics
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

                gs.info(this.LOG_PREFIX + ' ✓ AI description generated');

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
     * Build prompt with current metrics assessment
     * COPY FROM: Dynatrace MetricsAIAnalyzerServerLLM._buildDescriptionPrompt()
     * Lines 105-277
     */
    _buildDescriptionPrompt: function(context) {
        // This is a sophisticated prompt that includes:
        // - System & Issue Context
        // - Alert Summary with OPEN/CLOSED Status
        // - Timeline
        // - Metrics During Alert Window
        // - CURRENT METRICS STATUS (NEW!)
        // - Correlation
        // - Smart instructions for AI

        /* See lines 105-277 in MetricsAIAnalyzerServerLLM.js */
    },

    /**
     * Call Now Assist using One Extend API
     * COPY EXACTLY FROM: Dynatrace MetricsAIAnalyzerServerLLM._callNowLLM()
     * Lines 316-351
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
                    gs.info(this.LOG_PREFIX + ' ✓ AI response received');
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
     * Generate rule-based description (fallback)
     * COPY FROM: Dynatrace MetricsAIAnalyzerServerLLM._generateRuleBasedDescription()
     * Lines 358-455
     */
    _generateRuleBasedDescription: function(context) {
        /* See lines 358-455 in MetricsAIAnalyzerServerLLM.js */
    },

    _formatCIClassName: function(className) { /* ... */ },

    type: 'ACCNowAssistAnalyzerLLM'
};
```

</details>

---

#### File 3: `ACCNowAssistAnalyzer.js` (Ajax Processor)

**Path:** `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzer.js`

**Strategy:** Adapt Dynatrace's `MetricsAIAnalyzerAjax.js` with our parameter handling.

**Changes from Dynatrace:**
- Keep their robust string conversion fix (line 46: `String(this.getParameter(...))`)
- Keep their detailed logging
- Keep their error handling structure
- Change method name: `ajaxGetSREInsights` → `getNowAssistInsights`

<details>
<summary>See implementation skeleton</summary>

```javascript
var ACCNowAssistAnalyzer = Class.create();
ACCNowAssistAnalyzer.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    getNowAssistInsights: function() {
        var ciSysId = '';
        var timeRange = '24h';
        var metrics = [];
        var alerts = [];

        try {
            gs.info('[ACCNowAssist Ajax] ===== START =====');

            // Get CI sys_id
            ciSysId = String(this.getParameter('sysparm_ci_sys_id'));
            gs.info('[ACCNowAssist Ajax] CI sys_id: ' + ciSysId);

            // Get time range
            timeRange = this.getParameter('sysparm_time_range') || '24h';
            gs.info('[ACCNowAssist Ajax] Time range: ' + timeRange);

            // Get metrics - WITH STRING CONVERSION FIX
            var metricsJson = '';
            try {
                // CRITICAL FIX: Force string conversion
                metricsJson = String(this.getParameter('sysparm_metrics') || '[]');
                gs.info('[ACCNowAssist Ajax] Metrics JSON length: ' + metricsJson.length);

                metrics = JSON.parse(metricsJson);
                gs.info('[ACCNowAssist Ajax] ✓ Successfully parsed ' + metrics.length + ' metrics');
            } catch (e3) {
                gs.error('[ACCNowAssist Ajax] ✗ Error parsing metrics: ' + e3.message);
                metrics = [];
            }

            // Get alerts
            var alertsJson = '';
            try {
                alertsJson = String(this.getParameter('sysparm_alerts') || '[]');
                alerts = JSON.parse(alertsJson);
                gs.info('[ACCNowAssist Ajax] ✓ Successfully parsed ' + alerts.length + ' alerts');
            } catch (e4) {
                gs.error('[ACCNowAssist Ajax] ✗ Error parsing alerts: ' + e4.message);
                alerts = [];
            }

            // Validate CI sys_id
            if (!ciSysId || ciSysId === 'null' || ciSysId === 'undefined') {
                gs.warn('[ACCNowAssist Ajax] Invalid CI sys_id');
                return this._errorResponse('Missing or invalid CI sys_id');
            }

            // Call server
            gs.info('[ACCNowAssist Ajax] Creating server instance...');
            var server = new x_snc_metricintelp.ACCNowAssistAnalyzerServer();

            gs.info('[ACCNowAssist Ajax] Calling getNowAssistInsights...');
            var result = server.getNowAssistInsights(ciSysId, metrics, alerts, timeRange);

            gs.info('[ACCNowAssist Ajax] ✓ Success');
            if (result.probableCause) {
                gs.info('[ACCNowAssist Ajax] Probable Cause: ' + result.probableCause.title);
            }

            return JSON.stringify(result);

        } catch (e) {
            gs.error('[ACCNowAssist Ajax] EXCEPTION: ' + e.message);
            gs.error('[ACCNowAssist Ajax] Stack: ' + e.stack);
            return this._errorResponse(e.message);
        }
    },

    _errorResponse: function(message) {
        return JSON.stringify({
            success: false,
            error: message,
            probableCause: {
                title: 'Analysis Failed',
                description: 'Could not complete analysis: ' + message,
                correlation: 0
            },
            recommendations: []
        });
    },

    type: 'ACCNowAssistAnalyzer'
});
```

</details>

---

### Phase 2: Update Client-Side Code

**File:** `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/ui_pages/acc_metrics_intelligence_client.js`

**Location:** Line ~2562 (`_fetchNowAssistInsights` function)

**Strategy:** Replace the placeholder with real GlideAjax call (already sketched in comments).

**Changes:**
1. Remove `setTimeout` placeholder
2. Add real GlideAjax call to `x_snc_metricintelp.ACCNowAssistAnalyzer`
3. Keep error handling structure
4. Keep our callback pattern (already compatible)

<details>
<summary>See implementation</summary>

```javascript
_fetchNowAssistInsights: function(ciSysId, callback) {
    var self = this;

    console.log('[NOW_ASSIST] Fetching Now Assist insights...');
    console.log('[NOW_ASSIST] CI sys_id:', ciSysId);

    // Prepare simplified metrics (same as _fetchSREInsights)
    var simplifiedMetrics = [];
    if (this.data.metrics) {
        for (var i = 0; i < this.data.metrics.length; i++) {
            var m = this.data.metrics[i];
            if (m.name || m.metricId) {
                simplifiedMetrics.push({
                    name: String(m.name || m.metricId || 'Unknown'),
                    max: Number(m.max || 0),
                    avg: Number(m.avg || 0),
                    current: Number(m.current || m.value || 0),
                    unit: String(m.unit || '')
                });
            }
        }
    }

    console.log('[NOW_ASSIST] Prepared ' + simplifiedMetrics.length + ' metrics');

    // Call Now Assist Ajax processor
    var ga = new GlideAjax('x_snc_metricintelp.ACCNowAssistAnalyzer');
    ga.addParam('sysparm_name', 'getNowAssistInsights');
    ga.addParam('sysparm_ci_sys_id', ciSysId);
    ga.addParam('sysparm_metrics', JSON.stringify(simplifiedMetrics));
    ga.addParam('sysparm_alerts', JSON.stringify(self.data.alerts || []));
    ga.addParam('sysparm_time_range', self.data.filters.timeRange || '24h');

    ga.getXMLAnswer(function(response) {
        try {
            if (!response || response === 'null' || response.trim() === '') {
                console.warn('[NOW_ASSIST] Empty response');
                callback({
                    success: false,
                    message: 'Empty response from Now Assist'
                });
                return;
            }

            var nowAssistData = JSON.parse(response);

            if (nowAssistData.success) {
                console.log('[NOW_ASSIST] ✓ Insights received');
                console.log('[NOW_ASSIST] Title:', nowAssistData.probableCause.title);

                callback({
                    success: true,
                    data: nowAssistData
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

</details>

---

## 4. Key Technical Decisions

### Decision 1: Hybrid vs Full-AI Approach

**RECOMMENDATION:** Adopt Dynatrace's hybrid approach.

**Rationale:**
- **More predictable:** Rules handle pattern detection consistently
- **Faster:** Only description generation uses AI (5-10s vs 20-30s for full AI)
- **More reliable:** AI failure only affects description, not core analysis
- **Better fallback:** If AI fails, rules provide complete analysis

**Implementation:**
```javascript
// Dynatrace approach (RECOMMENDED)
1. Extract alert patterns (rule-based) ✓
2. Analyze metrics (rule-based) ✓
3. Correlate alerts+metrics (rule-based) ✓
4. Generate title (rule-based) ✓
5. Generate description (AI with fallback) ✓
6. Generate recommendations (rule-based) ✓

// Our original plan (NOT recommended)
1. Try full AI analysis
2. If fails, use full rule-based analysis
```

---

### Decision 2: Current Metrics Assessment

**RECOMMENDATION:** Adopt Dynatrace's v3.5 feature.

**Rationale:**
- Addresses common SRE pain point: "Why am I seeing open alerts when system is healthy?"
- Compares alert window metrics vs current (last hour) metrics
- Provides clear guidance: "Alert remains open but metrics returned to normal"
- Already implemented and tested in Dynatrace code

**Implementation:**
Copy `_assessCurrentMetrics()` function from Dynatrace (lines 514-606) into our server code.

---

### Decision 3: Capability ID

**RECOMMENDATION:** Use the same capability ID as Dynatrace.

**Capability ID:** `d82ff09efffc311063f5ffffffffffc5`

**Rationale:**
- This is the Virtual Agent capability ID in ServiceNow
- Already proven to work in Dynatrace implementation
- Standard across ServiceNow Now Assist integrations

**Where to configure:**
```javascript
// In ACCNowAssistAnalyzerLLM.js
initialize: function() {
    this.VA_CAPABILITY_ID = 'd82ff09efffc311063f5ffffffffffc5';
}
```

---

### Decision 4: Error Handling Layers

**RECOMMENDATION:** Implement 3-layer fallback (like Dynatrace).

**Layers:**
1. **Layer 1:** Try Now Assist AI (`sn_one_extend.OneExtendUtil`)
2. **Layer 2:** Rule-based description (in LLM script)
3. **Layer 3:** Emergency fallback (in server script)

**Result:** User ALWAYS gets insights, never a blank screen.

---

### Decision 5: Attribution Text

**RECOMMENDATION:** Add attribution to distinguish AI vs rules.

**Implementation:**
```javascript
// If AI succeeded
description += ' [response from Now Assist]';

// If rules used
description += ' [response from SRE rulelogic]';
```

**Rationale:**
- Transparency for users
- Debugging aid for developers
- Matches Dynatrace's approach

---

## 5. Code Compatibility Matrix

| Component | Our Codebase | Dynatrace Code | Compatibility | Action |
|-----------|-------------|----------------|---------------|--------|
| **Client-side data structure** | `self.data.metrics` with max/avg/current | Same structure | ✅ 100% | No changes needed |
| **Alert structure** | `self.data.alerts` | Same (em_alert table) | ✅ 100% | No changes needed |
| **Time range format** | '24h', '12h', '4h' | Same format | ✅ 100% | No changes needed |
| **Ajax parameter names** | Not yet defined | `sysparm_ci_sys_id`, `sysparm_metrics`, `sysparm_alerts` | ✅ Compatible | Use their naming |
| **Response format** | Not yet defined | `{ success, probableCause, alertSummary, ... }` | ✅ Compatible | Use their format |
| **Namespace** | `x_snc_metricintelp` | `global` | ⚠️ Different | Keep ours, adapt code |
| **Now Assist API** | Not implemented | `sn_one_extend.OneExtendUtil` | ✅ Compatible | Copy their approach |
| **Fallback framework** | Already built | Not present (they only have AI→rules, not full fallback) | ✅ Keep ours | Our architecture is better |

---

## 6. Implementation Checklist

### Pre-Implementation

- [ ] Read this merge strategy document
- [ ] Review Dynatrace source files:
  - `MetricsAIAnalyzerServer.js` (874 lines)
  - `MetricsAIAnalyzerServerLLM.js` (458 lines)
  - `MetricsAIAnalyzerAjax.js` (123 lines)
- [ ] Confirm ServiceNow instance has Now Assist enabled
- [ ] Verify `sn_one_extend` plugin is active

### Phase 1: Server-Side Implementation

- [ ] Create `ACCNowAssistAnalyzerServer.js`
  - [ ] Copy pattern detection logic from Dynatrace (lines 345-430)
  - [ ] Copy correlation logic from Dynatrace (lines 463-503)
  - [ ] Copy current metrics assessment from Dynatrace (lines 514-606)
  - [ ] Copy helper functions (CI details, alerts, recommendations)
  - [ ] Adapt namespace to `x_snc_metricintelp`
  - [ ] Test with sample data

- [ ] Create `ACCNowAssistAnalyzerLLM.js`
  - [ ] Copy ENTIRE file from Dynatrace (minimal changes)
  - [ ] Change namespace to `x_snc_metricintelp`
  - [ ] Update log prefix: `[ACC LLM]`
  - [ ] Test AI API availability check
  - [ ] Test fallback logic

- [ ] Create `ACCNowAssistAnalyzer.js`
  - [ ] Adapt Dynatrace's Ajax processor
  - [ ] Keep string conversion fix (line 46)
  - [ ] Keep error handling structure
  - [ ] Change method name and namespace
  - [ ] Test parameter parsing

### Phase 2: Client-Side Implementation

- [ ] Update `acc_metrics_intelligence_client.js`
  - [ ] Replace placeholder in `_fetchNowAssistInsights()` (line ~2562)
  - [ ] Add GlideAjax call to `ACCNowAssistAnalyzer`
  - [ ] Add metrics simplification logic
  - [ ] Test error handling
  - [ ] Verify callback integration

### Phase 3: Testing

- [ ] **Unit Testing**
  - [ ] Test Now Assist API call (with/without AI available)
  - [ ] Test rule-based fallback
  - [ ] Test current metrics assessment
  - [ ] Test empty data handling

- [ ] **Integration Testing**
  - [ ] Test with 0 alerts (normal state)
  - [ ] Test with multiple alerts (incident state)
  - [ ] Test with open alerts but normal metrics
  - [ ] Test with closed alerts but elevated metrics
  - [ ] Test AI timeout handling

- [ ] **End-to-End Testing**
  - [ ] Single CI analysis
  - [ ] Multi-CI auto-selection
  - [ ] Fallback chain (AI → rules)
  - [ ] Subtitle changes ("powered by Now Assist" vs "powered by SRE Rules Engine")

### Phase 4: Documentation

- [ ] Update `NOW_ASSIST_INTEGRATION_PLAN.md`
  - [ ] Mark as "IMPLEMENTED"
  - [ ] Add "Merged with Dynatrace approach" note
  - [ ] Update architecture diagrams

- [ ] Create deployment guide
  - [ ] Script Include installation order
  - [ ] Required plugins
  - [ ] Configuration steps
  - [ ] Troubleshooting guide

---

## 7. Deployment Strategy

### Order of Deployment

**CRITICAL:** Deploy in this exact order to avoid runtime errors.

1. **First:** `ACCNowAssistAnalyzerLLM.js`
   - No dependencies
   - Can test AI API independently

2. **Second:** `ACCNowAssistAnalyzerServer.js`
   - Depends on: ACCNowAssistAnalyzerLLM
   - Can test pattern detection independently

3. **Third:** `ACCNowAssistAnalyzer.js`
   - Depends on: ACCNowAssistAnalyzerServer
   - Bridge between client and server

4. **Last:** Update `acc_metrics_intelligence_client.js`
   - Depends on: All server-side components
   - Only deploy after server-side is tested

### Rollback Plan

If issues occur:

1. **Immediate:** Revert client.js change (restores placeholder)
   - System continues using SRE rules engine
   - No user impact

2. **If needed:** Delete/deactivate server Script Includes
   - System continues using SRE rules engine
   - No user impact

---

## 8. Configuration Requirements

### Required ServiceNow Plugins

| Plugin | Purpose | Check |
|--------|---------|-------|
| `com.glide.now_assist` | Now Assist platform | Required |
| `sn_one_extend` | AI/ML API framework | Required |
| `com.snc.virtual_agent` | Virtual Agent capability | Required |

**How to check:**
```javascript
// Run in Scripts - Background
gs.info('One Extend available: ' + (typeof sn_one_extend !== 'undefined'));
gs.info('OneExtendUtil available: ' + (typeof sn_one_extend !== 'undefined' && !!sn_one_extend.OneExtendUtil));
```

### Required System Properties

**Check if Now Assist is enabled:**
- Navigate to: **Now Assist > Administration**
- Verify: Status = "Active"
- Verify: Virtual Agent capability is enabled

### Capability ID Verification

**How to find/verify capability ID:**
```javascript
// Run in Scripts - Background
var capability = new GlideRecord('sn_one_extend_capability');
capability.addQuery('name', 'CONTAINS', 'Virtual Agent');
capability.query();
if (capability.next()) {
    gs.info('Capability ID: ' + capability.getUniqueValue());
    gs.info('Capability Name: ' + capability.getValue('name'));
    gs.info('Active: ' + capability.getValue('active'));
}
```

If the capability ID differs from `d82ff09efffc311063f5ffffffffffc5`, update in:
- `ACCNowAssistAnalyzerLLM.js` (line ~31)
- `ACCNowAssistAnalyzerServer.js` (line ~31)

---

## 9. Performance Considerations

### Expected Response Times

| Operation | Time | Notes |
|-----------|------|-------|
| Rule-based pattern detection | 0.5-2s | Fast, consistent |
| Now Assist API call | 5-15s | Varies with load |
| Full AI timeout | 30s | Fallback triggers |
| Total (with AI) | 6-17s | User-facing |
| Total (rules only) | 1-3s | Fallback mode |

### Optimization Strategies

**1. Timeout Configuration**
```javascript
// In ACCNowAssistAnalyzerLLM.js
// Add timeout to One Extend call if supported
var request = {
    "executionRequests": [{
        "payload": { "prompt": prompt },
        "capabilityId": this.VA_CAPABILITY_ID,
        "timeout": 25000  // 25 second timeout
    }]
};
```

**2. Prompt Optimization**
- Keep prompts concise (Dynatrace uses ~400-600 words)
- Focus on data, not verbose instructions
- Include only relevant metrics (filter before sending)

**3. Caching (Future Enhancement)**
```javascript
// Cache AI descriptions for 5 minutes per CI
var cacheKey = 'ai_insights_' + ciSysId + '_' + alertFingerprint;
var cached = gs.getProperty(cacheKey);
if (cached && !isExpired(cached)) {
    return JSON.parse(cached);
}
```

---

## 10. Testing Scenarios

### Scenario 1: Normal Operations (No Alerts)

**Input:**
- 0 alerts
- All metrics within baseline

**Expected Output:**
```javascript
{
    probableCause: {
        title: 'Normal Operations',
        description: 'System operating within expected parameters. 15 metrics monitored with no anomalies detected. [response from SRE rulelogic]',
        correlation: 90
    },
    analysisMode: 'hybrid_ai_rules'
}
```

**Subtitle:** "powered by SRE Rules Engine" (AI not needed for normal state)

---

### Scenario 2: Active Incident (Open Alerts + Elevated Metrics)

**Input:**
- 5 open alerts (3 critical, 2 major)
- CPU at 95%, memory at 88%
- Response time 2.5x baseline

**Expected Output:**
```javascript
{
    probableCause: {
        title: 'Critical System Event',
        description: 'Analysis for server-prod-01 (Windows Server): 5 alerts detected (3 critical, 2 major), 5 currently open. Metrics During Alert Window: 8 of 15 metrics spiked (4 latency, 3 saturation, 1 errors). CURRENT METRICS STATUS: CPU Usage 95% (ELEVATED), Memory 88% (ELEVATED). Issue is ongoing requiring immediate attention. [response from Now Assist]',
        correlation: 85
    },
    analysisMode: 'hybrid_ai_rules'
}
```

**Subtitle:** "powered by Now Assist" (AI successfully generated description)

---

### Scenario 3: Ghost Alert (Open Alert but Normal Metrics)

**Input:**
- 1 open alert (major)
- All current metrics normal

**Expected Output:**
```javascript
{
    probableCause: {
        title: 'System Alert Event',
        description: 'Alert remains open but current metrics show CPU 45%, Memory 67%, Response Time 120ms have returned to normal, suggesting the issue has self-resolved. [response from Now Assist]',
        correlation: 70
    },
    currentMetrics: {
        overallNormal: true
    }
}
```

**Subtitle:** "powered by Now Assist"

**Why this matters:** Helps SREs prioritize - they can close the alert with confidence.

---

### Scenario 4: AI Unavailable (Fallback)

**Input:**
- 3 open alerts
- `sn_one_extend` not available or times out

**Expected Output:**
```javascript
{
    probableCause: {
        title: 'Performance Anomaly Detected',
        description: 'Analysis for db-prod-02: 3 alerts detected, 3 currently open. 5 of 12 metrics spiked (3 latency, 2 saturation). Strong correlation indicates common root cause. [response from SRE rulelogic]',
        correlation: 75
    },
    analysisMode: 'hybrid_ai_rules'
}
```

**Subtitle:** "powered by SRE Rules Engine" (graceful fallback)

---

## 11. Troubleshooting Guide

### Issue 1: "One Extend API not available"

**Symptom:** Log shows `[ACC LLM] One Extend API not available`, always falls back to rules.

**Diagnosis:**
```javascript
// Run in Scripts - Background
gs.info('sn_one_extend exists: ' + (typeof sn_one_extend !== 'undefined'));
gs.info('OneExtendUtil exists: ' + (typeof sn_one_extend !== 'undefined' && !!sn_one_extend.OneExtendUtil));
```

**Solutions:**
1. Check if plugin `sn_one_extend` is active
2. Check if Now Assist is licensed and enabled
3. Verify ServiceNow version supports One Extend (San Diego+)

---

### Issue 2: "No valid response from Now Assist"

**Symptom:** API call succeeds but no response text returned.

**Diagnosis:**
```javascript
// Add debug logging in ACCNowAssistAnalyzerLLM._callNowLLM()
gs.info('Response status: ' + response.status);
gs.info('Response capabilities: ' + JSON.stringify(response.capabilities));
gs.info('Capability result: ' + JSON.stringify(result));
```

**Solutions:**
1. Verify capability ID is correct for your instance
2. Check Virtual Agent capability is active
3. Test with simpler prompt (reduce to 100 words)
4. Check AI model quota/limits

---

### Issue 3: Client gets empty response

**Symptom:** `[NOW_ASSIST] Empty response` in browser console.

**Diagnosis:**
1. Check Script Include is `Client Callable: true`
2. Check method name matches (`getNowAssistInsights`)
3. Check server-side logs for errors

**Solutions:**
```javascript
// Check Ajax processor setup
var ga = new GlideAjax('x_snc_metricintelp.ACCNowAssistAnalyzer');
ga.addParam('sysparm_name', 'getNowAssistInsights');  // Must match function name
```

---

### Issue 4: "Error parsing metrics"

**Symptom:** Server log shows `✗ Error parsing metrics`.

**Diagnosis:**
```javascript
// In ACCNowAssistAnalyzer.js, log the raw parameter
gs.info('Raw metrics param type: ' + typeof this.getParameter('sysparm_metrics'));
gs.info('Raw metrics param: ' + this.getParameter('sysparm_metrics'));
```

**Solutions:**
1. Ensure client sends `JSON.stringify(simplifiedMetrics)`
2. Add string conversion: `String(this.getParameter('sysparm_metrics'))`
3. Check for circular references in metric objects

---

### Issue 5: Always falls back to SRE rules

**Symptom:** Never shows "powered by Now Assist", always uses rules.

**Diagnosis:**
1. Check `_callNowLLM()` return value
2. Verify capability ID
3. Test prompt length (too long may fail)

**Test:**
```javascript
// Run in Scripts - Background
var llm = new x_snc_metricintelp.ACCNowAssistAnalyzerLLM();
var testPrompt = 'Summarize: CPU is high at 95%.';
var response = llm._callNowLLM(testPrompt);
gs.info('Test result: ' + JSON.stringify(response));
```

---

## 12. Code Diff Summary

### Changes to Existing Files

**File:** `acc_metrics_intelligence_client.js`

**Location:** Line ~2562-2617

**Change Type:** Replace placeholder implementation

**Lines Changed:** ~55 lines

**Risk:** LOW (only affects Now Assist path, fallback unchanged)

---

### New Files Created

| File | Lines | Complexity | Dependencies |
|------|-------|------------|--------------|
| `ACCNowAssistAnalyzerServer.js` | ~870 | HIGH | em_alert, cmdb_ci, ACCNowAssistAnalyzerLLM |
| `ACCNowAssistAnalyzerLLM.js` | ~460 | MEDIUM | sn_one_extend |
| `ACCNowAssistAnalyzer.js` | ~120 | LOW | AbstractAjaxProcessor, ACCNowAssistAnalyzerServer |

**Total new code:** ~1,450 lines

**Code reuse:** ~90% copied/adapted from Dynatrace (proven working code)

---

## 13. Success Metrics

### Technical Metrics

- [ ] Now Assist API call success rate > 80%
- [ ] Average response time < 20 seconds (with AI)
- [ ] Fallback success rate = 100%
- [ ] Zero user-facing errors
- [ ] AI description quality > rule-based (subjective)

### User Experience Metrics

- [ ] Subtitle correctly shows "powered by Now Assist" when AI used
- [ ] Subtitle correctly shows "powered by SRE Rules Engine" when rules used
- [ ] Attribution text present in description
- [ ] Current metrics assessment appears when relevant
- [ ] Recommendations always provided

### Business Metrics

- [ ] Reduced mean time to resolution (AI provides better context)
- [ ] Increased confidence in alert triage (current metrics assessment)
- [ ] Reduced false escalations (ghost alert detection)

---

## 14. Future Enhancements

### Enhancement 1: Recommendation Generation with AI

**Current:** Recommendations are rule-based (keyword matching)

**Enhancement:** Use AI to generate context-specific recommendations

**Dynatrace Status:** Not implemented (rules only)

**Implementation Effort:** MEDIUM (similar to description generation)

---

### Enhancement 2: Multi-CI Correlation

**Current:** Analyzes one CI at a time

**Enhancement:** Correlate issues across multiple CIs

**Example:** "Database slow-down is causing API server errors"

**Implementation Effort:** HIGH (requires cross-CI data aggregation)

---

### Enhancement 3: Historical Pattern Detection

**Current:** Analyzes current time window only

**Enhancement:** Compare against historical patterns

**Example:** "Similar incident occurred 30 days ago, resolved by restarting service X"

**Implementation Effort:** HIGH (requires time-series analysis)

---

### Enhancement 4: Alert Prediction

**Current:** Reactive (analyzes after alerts fire)

**Enhancement:** Predictive (warns before alert threshold)

**Example:** "Memory trending toward critical level in 2 hours"

**Implementation Effort:** VERY HIGH (requires ML models)

---

## 15. Conclusion

### Summary of Merge Strategy

✅ **Adopt Dynatrace's proven Now Assist integration**
- Use `sn_one_extend.OneExtendUtil.execute()` API
- Copy their hybrid AI+rules approach
- Leverage their 3-layer fallback system

✅ **Keep our superior fallback architecture**
- Client-side Now Assist → SRE rules fallback
- Smart CI selection
- Stress scoring

✅ **Add Dynatrace's v3.5 innovation**
- Current metrics assessment
- Open alert relevance checking
- Ghost alert detection

### Implementation Complexity

| Phase | Effort | Risk | Timeline |
|-------|--------|------|----------|
| Server Script Includes | 4-6 hours | LOW | Day 1 |
| Client Update | 1-2 hours | LOW | Day 1 |
| Testing | 2-4 hours | LOW | Day 1-2 |
| Deployment | 1 hour | LOW | Day 2 |
| **TOTAL** | **8-13 hours** | **LOW** | **2 days** |

**Why LOW risk?**
- 90% code reuse from working Dynatrace implementation
- Fallback always works (never breaks user experience)
- Can deploy incrementally
- Easy rollback plan

---

## 16. Next Steps

1. **Review this document** with team
2. **Verify prerequisites** (plugins, Now Assist license)
3. **Copy Dynatrace source files** to your repo for reference
4. **Create branch** for implementation
5. **Follow checklist** (Section 6)
6. **Test thoroughly** (Section 10)
7. **Deploy** following order (Section 7)

---

## Appendix A: File Locations Reference

### Source Files (Dynatrace - Read Only)

```
/Users/charles.elite/Library/CloudStorage/OneDrive-ServiceNow/Notes/Projects/2026/Q1/Dynatrace_UpdateSet_Analysis/extracted_code/
├── script_includes/
│   ├── global.MetricsAIAnalyzerServer.js (874 lines) - COPY PATTERNS
│   ├── global.MetricsAIAnalyzerServerLLM.js (458 lines) - COPY ENTIRE
│   └── global.MetricsAIAnalyzerAjax.js (123 lines) - ADAPT
└── ui_pages/
    └── dynatrace_metrics_genai_client.js - REFERENCE ONLY
```

### Target Files (ACC Metrics Intelligence - Write To)

```
/Users/charles.elite/ServiecNowMetricsIntellUIAlt/
├── src/
│   ├── script_includes/
│   │   ├── ACCNowAssistAnalyzerServer.js - CREATE
│   │   ├── ACCNowAssistAnalyzerLLM.js - CREATE
│   │   └── ACCNowAssistAnalyzer.js - CREATE
│   └── ui_pages/
│       └── acc_metrics_intelligence_client.js - MODIFY (line ~2562)
├── NOW_ASSIST_INTEGRATION_PLAN.md - UPDATE (mark as implemented)
└── NOW_ASSIST_MERGE_STRATEGY.md - THIS DOCUMENT
```

---

## Appendix B: Key Code Snippets

### Snippet 1: Now Assist API Call (Core Integration)

```javascript
// From: MetricsAIAnalyzerServerLLM.js, lines 316-351
// This is the ONLY code that actually calls Now Assist AI

_callNowLLM: function(prompt) {
    try {
        if (typeof sn_one_extend === 'undefined' || !sn_one_extend.OneExtendUtil) {
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
                return { success: true, text: result.response, fallback: false };
            }
        }

        return { success: false, fallback: true };
    } catch (e) {
        return { success: false, fallback: true };
    }
}
```

**Key Points:**
- Synchronous call (blocks until response or timeout)
- Graceful failure (returns `fallback: true`)
- No external dependencies (pure ServiceNow API)

---

### Snippet 2: Current Metrics Assessment (New Feature)

```javascript
// From: MetricsAIAnalyzerServer.js, lines 514-606
// Compares alert window metrics vs current metrics

_assessCurrentMetrics: function(metrics, alerts) {
    var assessment = {
        responseTime: null,
        responseTimeNormal: false,
        failureRate: null,
        failureRateNormal: true,
        memoryUsage: null,
        memoryNormal: true,
        cpuUsage: null,
        cpuNormal: true,
        overallNormal: false
    };

    for (var i = 0; i < metrics.length; i++) {
        var metric = metrics[i];
        var nameLower = (metric.name || '').toLowerCase();

        // Response Time
        if (nameLower.indexOf('response') !== -1 || nameLower.indexOf('latency') !== -1) {
            var recentValue = metric.current || metric.avg || 0;
            var avgValue = metric.avg || 0;

            assessment.responseTime = this._formatMetricValue(recentValue) + (metric.unit || 'ms');

            // Consider normal if current < 1.5x average
            if (avgValue > 0 && recentValue < (avgValue * 1.5)) {
                assessment.responseTimeNormal = true;
            }
        }

        // Memory
        if (nameLower.indexOf('memory') !== -1 && nameLower.indexOf('usage') !== -1) {
            var memUsage = metric.current || metric.avg || 0;
            assessment.memoryUsage = Math.round(memUsage);

            // Consider elevated if > 85%
            if (memUsage > 85) {
                assessment.memoryNormal = false;
            }
        }

        // CPU
        if (nameLower.indexOf('cpu') !== -1) {
            var cpuUsage = metric.current || metric.avg || 0;
            assessment.cpuUsage = Math.round(cpuUsage);

            // Consider elevated if > 80%
            if (cpuUsage > 80) {
                assessment.cpuNormal = false;
            }
        }
    }

    // Overall assessment
    assessment.overallNormal = assessment.responseTimeNormal &&
                              assessment.failureRateNormal &&
                              assessment.memoryNormal &&
                              assessment.cpuNormal;

    return assessment;
}
```

**Usage:**
```javascript
var currentMetrics = this._assessCurrentMetrics(metrics, alerts);

// Pass to AI prompt
var llmContext = {
    // ... other context
    currentMetrics: currentMetrics  // AI uses this to say "alert open but metrics normal"
};
```

---

### Snippet 3: String Conversion Fix (Critical for Ajax)

```javascript
// From: MetricsAIAnalyzerAjax.js, line 46
// CRITICAL FIX: Force string conversion to avoid "Cannot read property 'toString' of undefined"

var metricsJson = '';
try {
    // ✅ CRITICAL FIX: Force string conversion
    metricsJson = String(this.getParameter('sysparm_metrics') || '[]');

    gs.info('Metrics JSON length: ' + metricsJson.length);

    // Parse the JSON
    metrics = JSON.parse(metricsJson);
    gs.info('✓ Successfully parsed ' + metrics.length + ' metrics');

} catch (e) {
    gs.error('✗ Error parsing metrics: ' + e.message);
    metrics = [];
}
```

**Why this matters:**
- ServiceNow `getParameter()` can return objects, not strings
- `JSON.parse()` expects a string
- Without `String()` conversion, parsing fails unpredictably

---

## Appendix C: Comparison Table

| Feature | Our Original Plan | Dynatrace Implementation | RECOMMENDED |
|---------|-------------------|--------------------------|-------------|
| **Now Assist API** | Placeholder (not specified) | `sn_one_extend.OneExtendUtil` | ✅ Use Dynatrace's |
| **Analysis Approach** | Try full AI, fallback to rules | Hybrid: Rules + AI description | ✅ Use Dynatrace's |
| **Fallback Layers** | 2 layers (Now Assist → SRE) | 3 layers (AI → LLM rules → Server rules) | ✅ Use Dynatrace's |
| **Current Metrics** | Not planned | v3.5 feature (implemented) | ✅ Add Dynatrace's |
| **Attribution** | Not planned | "[response from Now Assist]" | ✅ Add Dynatrace's |
| **Error Handling** | Basic | Robust with detailed logging | ✅ Use Dynatrace's |
| **Pattern Detection** | Not specified | Rule-based (alert patterns, metric spikes) | ✅ Use Dynatrace's |
| **Correlation Logic** | Not specified | Sophisticated (spike-to-alert ratio) | ✅ Use Dynatrace's |
| **Recommendations** | Basic | Context-aware (keyword-based) | ✅ Use Dynatrace's |
| **Client Fallback** | ✅ Already built | Not present | ✅ Keep ours |
| **Smart CI Selection** | ✅ Already built | Not present | ✅ Keep ours |
| **Stress Scoring** | ✅ Already built | Not present | ✅ Keep ours |

---

**END OF MERGE STRATEGY**

---

**Questions or Issues?**

Contact: Charles (charles.elite@servicenow.com)

**Document History:**
- v1.0 (2026-02-13): Initial merge strategy based on Dynatrace analysis
