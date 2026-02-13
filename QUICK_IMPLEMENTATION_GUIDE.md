# Quick Implementation Guide - Now Assist Integration

**For developers who want to get started immediately**

---

## TL;DR

Copy 3 files from Dynatrace, adapt namespaces, update 1 function in client code. Done in 8-13 hours.

---

## Step-by-Step Implementation

### Step 1: Copy the LLM Wrapper (30 minutes)

**Action:** Create `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzerLLM.js`

**Source:** Copy from `/Users/charles.elite/Library/CloudStorage/OneDrive-ServiceNow/Notes/Projects/2026/Q1/Dynatrace_UpdateSet_Analysis/extracted_code/script_includes/global.MetricsAIAnalyzerServerLLM.js`

**Changes needed:**
1. Change class name: `MetricsAIAnalyzerServerLLM` → `ACCNowAssistAnalyzerLLM`
2. Change log prefix: `[SRE LLM]` → `[ACC LLM]`
3. Change `type:` at the end to `'ACCNowAssistAnalyzerLLM'`

**Test:**
```javascript
// Run in Scripts - Background
var llm = new ACCNowAssistAnalyzerLLM();
var testContext = {
    title: 'Test Issue',
    ciDetails: { name: 'TestServer', className: 'cmdb_ci_linux_server' },
    alertCount: 1,
    alertPatterns: { count: 1, severityDistribution: { critical: 1 }, stateDistribution: { open: 1 } },
    timelineContext: { description: 'Test timeline' },
    metricPatterns: { totalAnalyzed: 5, spikeCount: 2, behavior: 'elevated', signalDistribution: { Latency: 2 } },
    correlation: { strength: 'high', description: 'Test correlation' },
    currentMetrics: { overallNormal: false, cpuUsage: 85, cpuNormal: false }
};

var result = llm.generateDescription(testContext);
gs.info('Success: ' + result.success);
gs.info('Used AI: ' + result.usedAI);
gs.info('Description: ' + result.description);
```

Expected: Either AI description or rule-based fallback (both are success).

---

### Step 2: Copy the Server Logic (2-3 hours)

**Action:** Create `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzerServer.js`

**Source:** Copy from `/Users/charles.elite/Library/CloudStorage/OneDrive-ServiceNow/Notes/Projects/2026/Q1/Dynatrace_UpdateSet_Analysis/extracted_code/script_includes/global.MetricsAIAnalyzerServer.js`

**Changes needed:**

1. Change class name: `MetricsAIAnalyzerServer` → `ACCNowAssistAnalyzerServer`
2. Change log prefix: `[MetricsAIAnalyzerServer]` → `[ACCNowAssist]`
3. Change type: `'MetricsAIAnalyzerServer'` → `'ACCNowAssistAnalyzerServer'`
4. Line 657: Change `new MetricsAIAnalyzerServerLLM()` → `new ACCNowAssistAnalyzerLLM()`
5. Remove `getAlerts()` function (we already have alerts from client) - lines 83-135
6. Modify main function signature:

**FROM:**
```javascript
getSREIntelligenceInsights: function(ciSysId, metrics, timeRange) {
    // ...
    var alerts = this.getAlerts(ciSysId, timeRange);  // Remove this line
```

**TO:**
```javascript
getNowAssistInsights: function(ciSysId, metrics, alerts, timeRange) {
    // alerts now passed as parameter
```

**Test:**
```javascript
// Run in Scripts - Background
var server = new ACCNowAssistAnalyzerServer();

var testMetrics = [
    { name: 'CPU Usage', max: 85, avg: 70, current: 85, unit: '%' },
    { name: 'Memory Usage', max: 75, avg: 65, current: 75, unit: '%' }
];

var testAlerts = [
    {
        sys_id: 'test123',
        number: 'ALT0001',
        severity: '1',
        severity_label: 'Critical',
        state: 'Open',
        description: 'High CPU usage',
        is_root_cause: true
    }
];

var result = server.getNowAssistInsights('test_ci_sys_id', testMetrics, testAlerts, '24h');
gs.info('Success: ' + result.success);
gs.info('Title: ' + result.probableCause.title);
gs.info('Description preview: ' + result.probableCause.description.substring(0, 100));
```

Expected: Complete insights object with title and description.

---

### Step 3: Create the Ajax Processor (30 minutes)

**Action:** Create `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/script_includes/ACCNowAssistAnalyzer.js`

**Source:** Adapt from `/Users/charles.elite/Library/CloudStorage/OneDrive-ServiceNow/Notes/Projects/2026/Q1/Dynatrace_UpdateSet_Analysis/extracted_code/script_includes/global.MetricsAIAnalyzerAjax.js`

**Full code:**

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
            var server = new ACCNowAssistAnalyzerServer();

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

**IMPORTANT:** Set Script Include properties in ServiceNow:
- **Name:** ACCNowAssistAnalyzer
- **API Name:** x_snc_metricintelp.ACCNowAssistAnalyzer
- **Client Callable:** ✅ TRUE (critical!)
- **Active:** ✅ TRUE
- **Access:** public

**Test:**
```javascript
// Test from client-side (browser console)
var ga = new GlideAjax('x_snc_metricintelp.ACCNowAssistAnalyzer');
ga.addParam('sysparm_name', 'getNowAssistInsights');
ga.addParam('sysparm_ci_sys_id', 'some_valid_ci_sys_id');
ga.addParam('sysparm_metrics', JSON.stringify([{ name: 'CPU', max: 80, avg: 60, current: 80, unit: '%' }]));
ga.addParam('sysparm_alerts', JSON.stringify([]));
ga.addParam('sysparm_time_range', '24h');

ga.getXMLAnswer(function(response) {
    console.log('Response:', response);
    var data = JSON.parse(response);
    console.log('Success:', data.success);
    console.log('Title:', data.probableCause.title);
});
```

---

### Step 4: Update Client Code (30 minutes)

**Action:** Edit `/Users/charles.elite/ServiecNowMetricsIntellUIAlt/src/ui_pages/acc_metrics_intelligence_client.js`

**Location:** Line ~2562 (function `_fetchNowAssistInsights`)

**REPLACE:**
```javascript
_fetchNowAssistInsights: function(ciSysId, callback) {
    var self = this;

    // TODO: Implement Now Assist API integration
    // This is a placeholder that always fails gracefully

    console.log('[NOW_ASSIST] Checking Now Assist availability...');

    // Simulate async check
    setTimeout(function() {

        // PLACEHOLDER: Always return "not configured" for now
        var result = {
            success: false,
            message: 'Now Assist not configured (placeholder)',
            data: null
        };

        /* FUTURE IMPLEMENTATION: ... */

        callback(result);

    }, 100);  // Small delay to simulate async call
},
```

**WITH:**
```javascript
_fetchNowAssistInsights: function(ciSysId, callback) {
    var self = this;

    console.log('[NOW_ASSIST] Fetching Now Assist insights...');
    console.log('[NOW_ASSIST] CI sys_id:', ciSysId);

    // Prepare simplified metrics (reuse logic from _fetchSREInsights)
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
                console.log('[NOW_ASSIST] Analysis failed:', nowAssistData.error);
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

### Step 5: Fix Duplicate Call Issue (5 minutes)

**Problem:** Line 2241 in client code has BOTH calls:

```javascript
// TRY NOW ASSIST FIRST, FALL BACK TO SRE RULES
self._fetchInsightsWithFallback(ciSysId);
self._fetchSREInsights(ciSysId);  // ❌ REMOVE THIS LINE
```

**Action:** Remove the second call. The fallback function already calls `_fetchSREInsights` if Now Assist fails.

**CHANGE TO:**
```javascript
// TRY NOW ASSIST FIRST, FALL BACK TO SRE RULES
self._fetchInsightsWithFallback(ciSysId);
```

---

### Step 6: Test End-to-End (2-4 hours)

**Test Checklist:**

1. **Test with Now Assist available:**
   - [ ] Load dashboard with 1 CI
   - [ ] Check browser console: `[NOW_ASSIST] ✓ Insights received`
   - [ ] Verify subtitle shows: "powered by Now Assist"
   - [ ] Verify description includes: "[response from Now Assist]"

2. **Test with Now Assist unavailable:**
   - [ ] Temporarily break API (set wrong capability ID)
   - [ ] Verify fallback: "powered by SRE Rules Engine"
   - [ ] Verify description includes: "[response from SRE rulelogic]"
   - [ ] Restore correct capability ID

3. **Test data scenarios:**
   - [ ] 0 alerts, normal metrics → "Normal Operations"
   - [ ] Multiple alerts, elevated metrics → Detailed analysis
   - [ ] Open alerts, normal metrics → "returned to normal"
   - [ ] Closed alerts, elevated metrics → "monitoring recommended"

4. **Test error handling:**
   - [ ] Invalid CI sys_id → Error message
   - [ ] Empty metrics array → Still provides analysis
   - [ ] Malformed JSON → Graceful fallback

---

## Common Issues and Fixes

### Issue: "Script Include not found"

**Symptom:** Browser console shows `GlideAjax: Script Include not found`

**Fix:**
1. Check Script Include name: `x_snc_metricintelp.ACCNowAssistAnalyzer`
2. Check "Client Callable" is checked
3. Check "Active" is checked
4. Clear browser cache

---

### Issue: "One Extend API not available"

**Symptom:** Always falls back to rules, log shows `[ACC LLM] One Extend API not available`

**Fix:**
1. Check ServiceNow version (need San Diego or later)
2. Activate plugin: `sn_one_extend`
3. Enable Now Assist in instance
4. Verify license includes Now Assist

**Check command:**
```javascript
// Scripts - Background
gs.info('sn_one_extend exists: ' + (typeof sn_one_extend !== 'undefined'));
gs.info('OneExtendUtil exists: ' + (typeof sn_one_extend !== 'undefined' && !!sn_one_extend.OneExtendUtil));
```

---

### Issue: "Empty response"

**Symptom:** Browser console shows `[NOW_ASSIST] Empty response`

**Fix:**
1. Check server logs for errors
2. Verify method name matches: `getNowAssistInsights`
3. Check Script Include is in correct namespace: `x_snc_metricintelp`

---

### Issue: Subtitle never shows "Now Assist"

**Symptom:** Always shows "SRE Rules Engine" even when AI works

**Fix:** Check the `analysisType` field in response:

```javascript
// In _fetchNowAssistInsights callback
self.sreInsightsData = nowAssistResult.data;
self.sreInsightsData.analysisType = 'Now Assist AI';  // Make sure this line exists
```

---

## Deployment to ServiceNow

### Upload Order (Critical!)

1. **First:** Upload `ACCNowAssistAnalyzerLLM.js`
   - Navigate to: **System Definition > Script Includes**
   - Click **New**
   - Paste code
   - Set properties:
     - Name: `ACCNowAssistAnalyzerLLM`
     - API Name: `x_snc_metricintelp.ACCNowAssistAnalyzerLLM`
     - Client Callable: ❌ FALSE
     - Active: ✅ TRUE
   - Click **Submit**

2. **Second:** Upload `ACCNowAssistAnalyzerServer.js`
   - Same process
   - Name: `ACCNowAssistAnalyzerServer`
   - API Name: `x_snc_metricintelp.ACCNowAssistAnalyzerServer`
   - Client Callable: ❌ FALSE
   - Active: ✅ TRUE

3. **Third:** Upload `ACCNowAssistAnalyzer.js`
   - Same process
   - Name: `ACCNowAssistAnalyzer`
   - API Name: `x_snc_metricintelp.ACCNowAssistAnalyzer`
   - Client Callable: ✅ **TRUE** (critical!)
   - Active: ✅ TRUE

4. **Last:** Update client UI Page
   - Navigate to: **Service Portal > Pages**
   - Find your page
   - Update the client script
   - Click **Update**

---

## Verification

After deployment, run this test:

```javascript
// Browser console (on dashboard page)
console.log('[TEST] Testing Now Assist integration...');

var ga = new GlideAjax('x_snc_metricintelp.ACCNowAssistAnalyzer');
ga.addParam('sysparm_name', 'getNowAssistInsights');
ga.addParam('sysparm_ci_sys_id', g_dashboard.data.sreCISysId);  // Current CI
ga.addParam('sysparm_metrics', JSON.stringify([
    { name: 'Test Metric', max: 100, avg: 50, current: 75, unit: '%' }
]));
ga.addParam('sysparm_alerts', '[]');
ga.addParam('sysparm_time_range', '24h');

ga.getXMLAnswer(function(response) {
    var data = JSON.parse(response);
    console.log('[TEST] Success:', data.success);
    console.log('[TEST] Title:', data.probableCause.title);
    console.log('[TEST] Description preview:', data.probableCause.description.substring(0, 200));

    if (data.probableCause.description.indexOf('[response from Now Assist]') !== -1) {
        console.log('[TEST] ✅ Now Assist is working!');
    } else if (data.probableCause.description.indexOf('[response from SRE rulelogic]') !== -1) {
        console.log('[TEST] ⚠️ Using rule-based fallback (Now Assist unavailable)');
    }
});
```

Expected output:
- `Success: true`
- `Title: <some title>`
- Description with either `[response from Now Assist]` or `[response from SRE rulelogic]`

---

## Success Criteria

✅ **You're done when:**

1. Dashboard loads without errors
2. SRE Intelligence panel shows insights
3. Subtitle shows either:
   - "powered by Now Assist" (ideal)
   - "powered by SRE Rules Engine" (acceptable fallback)
4. Description text is coherent and relevant
5. Recommendations are provided
6. Browser console shows no errors

---

## Time Estimate

- **Step 1:** 30 min (copy LLM)
- **Step 2:** 2-3 hours (copy server + adapt)
- **Step 3:** 30 min (create Ajax)
- **Step 4:** 30 min (update client)
- **Step 5:** 5 min (fix duplicate call)
- **Step 6:** 2-4 hours (testing)

**Total: 8-13 hours**

---

## Need Help?

1. Check detailed merge strategy: `NOW_ASSIST_MERGE_STRATEGY.md`
2. Check original plan: `NOW_ASSIST_INTEGRATION_PLAN.md`
3. Review Dynatrace source code for reference
4. Check ServiceNow system logs for errors

---

**Good luck! The hard work (figuring out the API) is already done by Dynatrace. You're just adapting proven code.**
