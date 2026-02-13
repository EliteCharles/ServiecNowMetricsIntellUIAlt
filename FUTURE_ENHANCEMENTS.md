# Future Enhancements - Now Assist Integration

This document tracks potential enhancements to improve the Now Assist integration for ACC Metrics Intelligence.

---

## 🎯 Priority 1: Custom Now Assist Skill (HIGH IMPACT)

### Problem
The current implementation uses the **generic VA Freeform Prompt** capability (`d82ff09efffc311063f5ffffffffffc5`), which:
- ❌ Has no domain-specific training on SRE/ITOM patterns
- ❌ Produces generic responses lacking specific insights
- ❌ Doesn't understand infrastructure/observability context
- ❌ Requires extensive prompt engineering to get decent results

### Solution
Create a **custom Now Assist skill** specifically trained for SRE Intelligence analysis.

### Benefits
- ✅ **Domain-specific training** on incident patterns, alert correlation, metric analysis
- ✅ **Optimized prompts** built into the skill (less client-side prompt engineering)
- ✅ **Better root cause hypotheses** based on SRE knowledge base
- ✅ **Consistent output format** tailored to engineering workflows
- ✅ **Reduced token usage** (shorter prompts needed)
- ✅ **Faster responses** (pre-trained model understands context faster)

### Implementation Approach

#### Option A: Now Assist Skill Kit (NASK)
ServiceNow provides the **Now Assist Skill Kit** for creating custom AI skills.

**Steps:**
1. **Activate Plugin**: `com.snc.now_assist.skill_kit` (if available in your version)
2. **Navigate to**: `All > Now Assist > Skill Kit > Create Skill`
3. **Define Skill:**
   - **Name**: `SRE Intelligence Analysis`
   - **Type**: `Text Generation`
   - **Domain**: `IT Operations / Observability`
   - **Model**: `Now LLM` or custom model
4. **Configure Prompt Template:**
   ```
   You are an expert SRE analyst specializing in infrastructure monitoring and incident response.

   Analyze the following system telemetry and alerts:
   - CI: {{ci_name}} ({{ci_class}})
   - Alerts: {{alert_count}} ({{critical_count}} critical)
   - Metrics: {{metric_summary}}
   - Timeline: {{timeline}}
   - Current Status: {{current_metrics}}

   Provide:
   1. Root cause hypothesis (1-2 most likely causes)
   2. Specific metrics driving the issue (names + values)
   3. Current status assessment (ongoing vs resolved)
   4. Estimated business impact

   Format: 3-4 sentences, factual, actionable.
   ```
5. **Train with Examples:**
   - Provide 10-20 example incidents with ideal responses
   - Cover common patterns: CPU spike, memory leak, network latency, error storms
6. **Test and Iterate:**
   - Test against real alert data
   - Refine prompt template based on output quality
7. **Register Capability:**
   - Get the new capability ID from `sys_cs_genai_skill` table
   - Update `ACCMetricsAILLM.js` line 35 with new capability ID
8. **Deploy and Monitor:**
   - Track response quality
   - Monitor API costs
   - Gather user feedback

#### Option B: ServiceNow Professional Services
If NASK is unavailable or too complex, engage **ServiceNow Professional Services** to:
- Design custom skill architecture
- Provide domain-specific training data
- Integrate with ACC Metrics Intelligence
- Support ongoing tuning and optimization

**Contact:** ServiceNow account manager for quote

#### Option C: Third-Party AI Model
If Now Assist limitations persist, consider integrating a third-party AI model:
- **OpenAI GPT-4** (via API)
- **Anthropic Claude** (via API)
- **Azure OpenAI** (enterprise agreement)

**Tradeoffs:**
- ✅ More control over model and prompts
- ✅ Access to latest AI capabilities
- ❌ Separate licensing costs
- ❌ Integration complexity
- ❌ Data governance concerns (sending telemetry to external APIs)

### Technical Details

**Tables to Work With:**
```javascript
// Check existing skills
var skill = new GlideRecord('sys_cs_genai_skill');
skill.query();

// Check available capabilities
var cap = new GlideRecord('sys_ai_capability');
cap.query();

// Create new skill (via UI or API)
// sys_cs_genai_skill fields:
// - name: "SRE Intelligence Analysis"
// - capability_id: (generated)
// - model: "now_llm"
// - prompt_template: (custom template)
// - scope: x_snc_metricintelp
```

**Code Changes Required:**
1. Update `ACCMetricsAILLM.js` line 35:
   ```javascript
   this.VA_CAPABILITY_ID = 'NEW_CUSTOM_SKILL_CAPABILITY_ID';
   ```
2. Simplify `_buildDescriptionPrompt()` (skill handles much of the structure)
3. Update tests to verify new skill responses

### Estimated Effort
- **NASK Approach**: 2-3 days (if available)
- **Professional Services**: 2-4 weeks (depends on engagement)
- **Third-Party Model**: 1-2 weeks (integration + testing)

### ROI
- **Time Savings**: 40-60% reduction in false positives (better root cause analysis)
- **MTTR Improvement**: 20-30% faster incident resolution (more actionable insights)
- **User Satisfaction**: Higher confidence in AI recommendations
- **Cost Reduction**: Lower token usage with optimized prompts

---

## 🎯 Priority 2: Multi-Stage Prompting (MEDIUM IMPACT)

### Concept
Instead of one AI call, use **two-stage analysis**:

**Stage 1: Deep Analysis**
```javascript
var analysisPrompt = "Analyze this alert data and identify the root cause...";
var analysis = this._callNowLLM(analysisPrompt);
```

**Stage 2: Executive Summary**
```javascript
var summaryPrompt = "Given this analysis: " + analysis + ", write a 3-sentence summary for an SRE engineer...";
var summary = this._callNowLLM(summaryPrompt);
```

### Benefits
- ✅ Mimics chain-of-thought reasoning
- ✅ Often produces better final output
- ✅ Separates analysis from communication

### Tradeoffs
- ❌ 2x API calls = 2x cost
- ❌ 2x latency (10-30 seconds instead of 5-15)
- ❌ More complex error handling

### Implementation
- Add `_callNowLLMMultiStage()` method to `ACCMetricsAILLM.js`
- Make it configurable via system property: `x_snc_metricintelp.llm_use_multistage`

---

## 🎯 Priority 3: Enhanced Context Data (MEDIUM IMPACT)

### Current Limitation
The prompt only includes **summary data** (alert counts, spike counts), not **detailed breakdowns**.

### Enhancement
Pass richer context to the AI:

#### Add to `ACCMetricsAIAnalyzerServer.js`:
```javascript
context.detailedMetrics = this._getDetailedMetricBreakdown(metrics);
context.alertDetails = this._getTopAlertDetails(alerts, 5);
context.historicalBaselines = this._getHistoricalBaselines(ciSysId);
context.affectedServices = this._getAffectedServices(ciSysId);
context.recentChanges = this._getRecentChanges(ciSysId);  // From CMDB change records
```

#### Update Prompt in `ACCMetricsAILLM.js`:
```javascript
// SECTION 8: Detailed Metric Breakdown
if (context.detailedMetrics) {
    prompt += '\n=== DETAILED METRICS ===\n';
    for (var i = 0; i < context.detailedMetrics.length; i++) {
        var m = context.detailedMetrics[i];
        prompt += '- ' + m.name + ': Current=' + m.current + m.unit;
        prompt += ', Baseline=' + m.baseline + m.unit;
        prompt += ' (deviation: +' + m.deviationPercent + '%)\n';
    }
}

// SECTION 9: Top Alert Descriptions
if (context.alertDetails) {
    prompt += '\n=== TOP ALERTS ===\n';
    for (var i = 0; i < context.alertDetails.length; i++) {
        var a = context.alertDetails[i];
        prompt += (i+1) + '. [' + a.severity + '] ' + a.shortDescription + '\n';
    }
}

// SECTION 10: Recent Changes
if (context.recentChanges && context.recentChanges.length > 0) {
    prompt += '\n=== RECENT CHANGES (Last 24h) ===\n';
    for (var i = 0; i < context.recentChanges.length; i++) {
        var c = context.recentChanges[i];
        prompt += '- ' + c.type + ': ' + c.description + ' at ' + c.timestamp + '\n';
    }
}
```

### Benefits
- ✅ AI has specific details to reference
- ✅ Can correlate changes with incidents
- ✅ More accurate root cause hypotheses

### Estimated Effort
- 1-2 days (depends on data availability)

---

## 🎯 Priority 4: SRE Knowledge Base Integration (LOW-MEDIUM IMPACT)

### Concept
Add **SRE domain knowledge** directly into the prompt:

```javascript
prompt += '\n=== SRE KNOWLEDGE BASE ===\n';
prompt += 'Common root causes by pattern:\n';
prompt += '- High CPU + Normal Memory → CPU-bound process (infinite loop, regex complexity, tight loop)\n';
prompt += '- High Memory + Normal CPU → Memory leak (unclosed connections, cache growth, zombie objects)\n';
prompt += '- High CPU + High Memory → Resource exhaustion (traffic spike, DDoS, runaway process)\n';
prompt += '- Slow Response + Normal Resources → External dependency (DB query, API call, network)\n';
prompt += '- High Errors + Normal Resources → Application bug (NPE, integration failure, bad config)\n';
prompt += '- Disk I/O + Normal CPU/Memory → Database issue (slow query, missing index, lock contention)\n\n';

prompt += 'First response actions by pattern:\n';
prompt += '- CPU spike → Check: top/htop, running processes, thread dumps\n';
prompt += '- Memory leak → Check: heap dump, GC logs, memory profiler\n';
prompt += '- Network latency → Check: ping/traceroute, DNS resolution, firewall logs\n';
prompt += '- Database slow → Check: slow query log, active queries, table locks\n\n';

prompt += 'Use this knowledge to guide your root cause hypothesis and recommended first steps.\n\n';
```

### Benefits
- ✅ Guides AI toward better hypotheses
- ✅ Provides domain expertise
- ✅ Standardizes terminology

### Implementation
- Add to `_buildDescriptionPrompt()` in `ACCMetricsAILLM.js`
- Make knowledge base configurable (external file or database table)

---

## 🎯 Priority 5: Result Caching (COST OPTIMIZATION)

### Problem
Repeated analyses of the same issue consume unnecessary API calls.

### Solution
Cache AI-generated descriptions for **1 hour**:

```javascript
_checkDescriptionCache: function(ciSysId, alertContext) {
    var cacheKey = ciSysId + '_' + alertContext.pattern + '_' + alertContext.severity;

    var cache = new GlideRecord('x_snc_metricintelp_llm_cache');
    cache.addQuery('cache_key', cacheKey);
    cache.addQuery('sys_created_on', '>', gs.minutesAgo(60));
    cache.query();

    if (cache.next()) {
        return {
            success: true,
            description: cache.getValue('cached_result'),
            fromCache: true,
            usedAI: false
        };
    }

    return null;
}
```

### Benefits
- ✅ 40-60% cost reduction (based on typical usage patterns)
- ✅ Faster responses (no API latency)
- ✅ Reduced Now Assist API consumption

### Implementation
- Create table: `x_snc_metricintelp_llm_cache`
- Add cache check before `_callNowLLM()`
- Store successful AI responses with TTL

---

## 📊 Enhancement Priority Matrix

| Enhancement | Impact | Effort | Cost | Timeline | Priority |
|-------------|--------|--------|------|----------|----------|
| Custom Skill | **HIGH** | Medium-High | Medium | 2-4 weeks | **P1** |
| Enhanced Prompts | **MEDIUM** | Low | None | ✅ Done | **DONE** |
| Enhanced Context | **MEDIUM** | Medium | None | 1-2 days | **P2** |
| Multi-Stage Prompting | **MEDIUM** | Low-Medium | High (2x calls) | 1 day | **P3** |
| SRE Knowledge Base | **LOW-MEDIUM** | Low | None | 1 day | **P4** |
| Result Caching | **MEDIUM** | Medium | None (saves $) | 1-2 days | **P2** |

---

## 🚀 Recommended Implementation Roadmap

### Phase 1: Quick Wins (This Week)
- ✅ Enhanced prompt engineering ← **DONE**
- ⬜ Result caching (cost optimization)
- ⬜ SRE knowledge base in prompt

### Phase 2: Data Enrichment (Next 2 Weeks)
- ⬜ Enhanced context data (detailed metrics, alert descriptions)
- ⬜ Recent change correlation
- ⬜ Historical baseline integration

### Phase 3: Custom Skill (1-2 Months)
- ⬜ Research Now Assist Skill Kit availability
- ⬜ Design custom skill architecture
- ⬜ Gather training data (example incidents + ideal responses)
- ⬜ Build and test custom skill
- ⬜ Deploy and monitor performance

### Phase 4: Advanced Features (3+ Months)
- ⬜ Multi-stage prompting (if needed)
- ⬜ Third-party AI model integration (if custom skill insufficient)
- ⬜ Auto-learning from SRE feedback

---

## 📝 Notes

**Created:** 2026-02-13
**Last Updated:** 2026-02-13
**Owner:** Charles Elite
**Status:** Planning

**References:**
- ServiceNow Now Assist documentation: https://docs.servicenow.com/now-assist
- Now Assist Skill Kit: Search ServiceNow Store for "Skill Kit"
- GenAI Controller: Navigate to `All > GenAI Controller`

---

**Next Steps:**
1. Test enhanced prompts (v1.1) and measure improvement
2. Implement result caching for cost optimization
3. Research Now Assist Skill Kit availability in current instance version
4. Gather example incidents for custom skill training data
