# Now Assist Integration Architecture

**Visual guide to the complete integration**

---

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD UI (Client-Side)                   │
│  File: acc_metrics_intelligence_client.js                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ _fetchInsightsWithFallback(ciSysId)                        │ │
│  │   │                                                         │ │
│  │   ├─[TRY FIRST]───> _fetchNowAssistInsights(ciSysId)      │ │
│  │   │                     │                                   │ │
│  │   │                     ├─[SUCCESS]─> Display "Now Assist" │ │
│  │   │                     │                                   │ │
│  │   │                     └─[FAIL]─┐                         │ │
│  │   │                               │                         │ │
│  │   └─[FALLBACK]─────────<─────────┘                         │ │
│  │                         │                                   │ │
│  │                         ▼                                   │ │
│  │                   _fetchSREInsights(ciSysId)               │ │
│  │                         │                                   │ │
│  │                         └─> Display "SRE Rules Engine"     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ GlideAjax Call
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               AJAX PROCESSOR (Server-Side Bridge)               │
│  File: ACCNowAssistAnalyzer.js                                  │
│  Class: AbstractAjaxProcessor                                   │
│  Client Callable: TRUE                                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ getNowAssistInsights()                                     │ │
│  │   │                                                         │ │
│  │   ├─ Parse parameters (ciSysId, metrics, alerts, timeRange)│ │
│  │   ├─ String conversion fix (critical!)                     │ │
│  │   ├─ JSON parsing with error handling                      │ │
│  │   │                                                         │ │
│  │   └─> Call: ACCNowAssistAnalyzerServer.getNowAssistInsights│ │
│  │                                                             │ │
│  │   ┌─[ERROR HANDLING]─────────────────────────────────────┐ │ │
│  │   │ Try-catch wrapping                                    │ │ │
│  │   │ Returns error JSON if exception                       │ │ │
│  │   └───────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│            ANALYSIS ENGINE (Server-Side Business Logic)         │
│  File: ACCNowAssistAnalyzerServer.js                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ getNowAssistInsights(ciSysId, metrics, alerts, timeRange)  │ │
│  │                                                             │ │
│  │  STEP 1: Get CI Details                                    │ │
│  │  ├─ Query: cmdb_ci table                                   │ │
│  │  └─ Extract: name, className                               │ │
│  │                                                             │ │
│  │  STEP 2: Summarize Alerts (RULE-BASED)                     │ │
│  │  ├─ Count: total, open, closed                             │ │
│  │  └─ Categorize by severity                                 │ │
│  │                                                             │ │
│  │  STEP 3: Determine Analysis Context (RULE-BASED)           │ │
│  │  ├─ Mode: alert-centric vs spike-centric                   │ │
│  │  ├─ Timeline: earliest to latest alert                     │ │
│  │  └─ Focus time window                                      │ │
│  │                                                             │ │
│  │  STEP 4: Analyze Metrics (RULE-BASED)                      │ │
│  │  ├─ Calculate spike ratio: max/avg                         │ │
│  │  ├─ Categorize: Traffic/Errors/Latency/Saturation          │ │
│  │  └─ Determine behavior: normal/elevated/spiking            │ │
│  │                                                             │ │
│  │  STEP 5: Extract Patterns (RULE-BASED)                     │ │
│  │  ├─ Alert patterns: dominant types, keywords               │ │
│  │  ├─ Metric patterns: spike count, signal distribution      │ │
│  │  └─ Timeline context: clustering, distribution             │ │
│  │                                                             │ │
│  │  STEP 6: Correlate Alerts + Metrics (RULE-BASED)           │ │
│  │  ├─ Calculate spike-to-alert ratio                         │ │
│  │  ├─ Determine correlation strength: high/medium/low        │ │
│  │  └─ Generate correlation description                       │ │
│  │                                                             │ │
│  │  STEP 7: Assess Current Metrics (RULE-BASED) **NEW v3.5**  │ │
│  │  ├─ Compare alert window vs current state                  │ │
│  │  ├─ Check: responseTime, CPU, memory, failureRate          │ │
│  │  └─ Determine: overallNormal (true/false)                  │ │
│  │                                                             │ │
│  │  STEP 8: Generate Probable Cause (HYBRID AI+RULES)         │ │
│  │  ├─ Generate TITLE (rule-based)                            │ │
│  │  │   └─ Based on: dominant alert type, severity, behavior  │ │
│  │  │                                                          │ │
│  │  └─ Generate DESCRIPTION (AI with fallback)                │ │
│  │      │                                                      │ │
│  │      └─> Call: ACCNowAssistAnalyzerLLM.generateDescription │ │
│  │                                                             │ │
│  │  STEP 9: Generate Recommendations (RULE-BASED)             │ │
│  │  └─ Based on: title keywords (memory, CPU, disk, etc.)     │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ (Only for description text)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│           AI DESCRIPTION GENERATOR (LLM Wrapper)                │
│  File: ACCNowAssistAnalyzerLLM.js                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ generateDescription(context)                               │ │
│  │                                                             │ │
│  │  STEP 1: Build Prompt                                      │ │
│  │  ├─ System context (CI, issue, timeline)                   │ │
│  │  ├─ Alert summary (with open/closed status)                │ │
│  │  ├─ Metrics during alert window                            │ │
│  │  ├─ Current metrics status **NEW v3.5**                    │ │
│  │  ├─ Correlation findings                                   │ │
│  │  └─ Smart instructions for AI                              │ │
│  │                                                             │ │
│  │  STEP 2: Call Now Assist API                               │ │
│  │  │                                                          │ │
│  │  ├─> _callNowLLM(prompt)                                   │ │
│  │      │                                                      │ │
│  │      ├─[CHECK]─> Is sn_one_extend available?               │ │
│  │      │            │                                         │ │
│  │      │            ├─[NO]──> Return: {fallback: true}       │ │
│  │      │            │                                         │ │
│  │      │            └─[YES]─> Continue                       │ │
│  │      │                                                      │ │
│  │      ├─[CALL]──> sn_one_extend.OneExtendUtil.execute()     │ │
│  │      │            │                                         │ │
│  │      │            ├─ Request: {                            │ │
│  │      │            │    executionRequests: [{               │ │
│  │      │            │      payload: { prompt: "..." },       │ │
│  │      │            │      capabilityId: "d82ff09..."        │ │
│  │      │            │    }]                                  │ │
│  │      │            │  }                                     │ │
│  │      │            │                                         │ │
│  │      │            ├─[SUCCESS]─> Extract response.text      │ │
│  │      │            │              Add: "[response from      │ │
│  │      │            │                    Now Assist]"        │ │
│  │      │            │              Return: {success: true,   │ │
│  │      │            │                       usedAI: true}    │ │
│  │      │            │                                         │ │
│  │      │            └─[FAIL]────> Return: {fallback: true}   │ │
│  │      │                                                      │ │
│  │  STEP 3: Handle Response                                   │ │
│  │  │                                                          │ │
│  │  ├─[AI SUCCESS]──> Return AI description                   │ │
│  │  │                                                          │ │
│  │  └─[AI FAIL]─────> _generateRuleBasedDescription(context)  │ │
│  │                     │                                       │ │
│  │                     ├─ Part 1: CI context                  │ │
│  │                     ├─ Part 2: Alert summary               │ │
│  │                     ├─ Part 3: Timeline                    │ │
│  │                     ├─ Part 4: Metrics during window       │ │
│  │                     ├─ Part 5: Current metrics **NEW**     │ │
│  │                     ├─ Part 6: Interpretation              │ │
│  │                     └─ Add: "[response from SRE rulelogic]"│ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ (Returns description text)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NOW ASSIST PLATFORM                          │
│  ServiceNow One Extend Framework                               │
│  Capability ID: d82ff09efffc311063f5ffffffffffc5                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Virtual Agent Capability                                   │ │
│  │   │                                                         │ │
│  │   ├─ Receives: Structured prompt with system context       │ │
│  │   ├─ Processes: Using LLM (likely GPT-based model)         │ │
│  │   └─ Returns: Natural language description                 │ │
│  │                                                             │ │
│  │ Response Format:                                           │ │
│  │   {                                                         │ │
│  │     status: "completed",                                    │ │
│  │     capabilities: {                                         │ │
│  │       "d82ff09...": {                                       │ │
│  │         status: "success",                                  │ │
│  │         response: "Analysis for server-prod-01: 5 alerts..."│ │
│  │       }                                                     │ │
│  │     }                                                       │ │
│  │   }                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
CLIENT                          SERVER                          NOW ASSIST
  │                               │                                 │
  │ User clicks CI                │                                 │
  │ ────────────────────────────> │                                 │
  │                               │                                 │
  │ GlideAjax Request:            │                                 │
  │ {                             │                                 │
  │   ciSysId: "abc123",          │                                 │
  │   metrics: [                  │                                 │
  │     {name: "CPU", max: 85}    │                                 │
  │   ],                          │                                 │
  │   alerts: [                   │                                 │
  │     {severity: 1, state: "open"}                                │
  │   ],                          │                                 │
  │   timeRange: "24h"            │                                 │
  │ }                             │                                 │
  │ ────────────────────────────> │                                 │
  │                               │                                 │
  │                               │ Parse & Validate                │
  │                               │ ──────────────┐                 │
  │                               │               │                 │
  │                               │ <─────────────┘                 │
  │                               │                                 │
  │                               │ Rule-Based Analysis             │
  │                               │ ──────────────┐                 │
  │                               │ - Extract alert patterns        │
  │                               │ - Analyze metrics               │
  │                               │ - Correlate                     │
  │                               │ - Assess current state          │
  │                               │ - Generate title                │
  │                               │ <─────────────┘                 │
  │                               │                                 │
  │                               │ Build AI Prompt                 │
  │                               │ ──────────────┐                 │
  │                               │               │                 │
  │                               │ <─────────────┘                 │
  │                               │                                 │
  │                               │ OneExtendUtil.execute()         │
  │                               │ ──────────────────────────────> │
  │                               │                                 │
  │                               │                                 │ Process Prompt
  │                               │                                 │ ────────────┐
  │                               │                                 │             │
  │                               │                                 │ <───────────┘
  │                               │                                 │
  │                               │ <────────────────────────────── │
  │                               │ {response: "Analysis shows..."}  │
  │                               │                                 │
  │                               │ [IF AI FAILS]                   │
  │                               │ ──────────────┐                 │
  │                               │ Use rule-based description      │
  │                               │ <─────────────┘                 │
  │                               │                                 │
  │                               │ Build Final Response            │
  │                               │ ──────────────┐                 │
  │                               │ {                               │
  │                               │   success: true,                │
  │                               │   probableCause: {              │
  │                               │     title: "Critical Event",    │
  │                               │     description: "...[response  │
  │                               │       from Now Assist]"         │
  │                               │   },                            │
  │                               │   recommendations: [...]        │
  │                               │ }                               │
  │                               │ <─────────────┘                 │
  │                               │                                 │
  │ <──────────────────────────── │                                 │
  │ JSON Response                 │                                 │
  │                               │                                 │
  │ Parse & Display               │                                 │
  │ ──────────────┐               │                                 │
  │ - Show title  │               │                                 │
  │ - Show description            │                                 │
  │ - Show recommendations        │                                 │
  │ - Update subtitle:            │                                 │
  │   "powered by Now Assist"     │                                 │
  │ <─────────────┘               │                                 │
  │                               │                                 │
```

---

## Fallback Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                         FALLBACK LAYERS                         │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: NOW ASSIST (Client-Side Fallback)
┌──────────────────────────────────────────────────────────────┐
│ _fetchNowAssistInsights(ciSysId)                             │
│   │                                                           │
│   ├─[TRY]──> Call ACCNowAssistAnalyzer                       │
│   │            │                                              │
│   │            ├─[SUCCESS]──> Use Now Assist insights        │
│   │            │               analysisType = "Now Assist AI"│
│   │            │               subtitle = "powered by Now    │
│   │            │                          Assist"            │
│   │            │                                              │
│   │            └─[FAIL]────> Return: {success: false}        │
│   │                          (empty response, parse error,   │
│   │                           server error, etc.)            │
│   │                                                           │
│   └─[IF FAIL]──> Callback triggers fallback                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │ (on failure)
                                ▼
LAYER 2: SRE RULES ENGINE (Client-Side Fallback)
┌──────────────────────────────────────────────────────────────┐
│ _fetchSREInsights(ciSysId)                                   │
│   │                                                           │
│   └─> Call ACCNowAssistAnalyzer (same endpoint!)             │
│        But relies on rule-based fallback within server       │
│        analysisType = "SRE Rules Engine"                     │
│        subtitle = "powered by SRE Rules Engine"              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │
                                ▼
LAYER 3: AI DESCRIPTION FALLBACK (Server-Side)
┌──────────────────────────────────────────────────────────────┐
│ ACCNowAssistAnalyzerLLM.generateDescription()                │
│   │                                                           │
│   ├─[TRY]──> _callNowLLM(prompt)                             │
│   │            │                                              │
│   │            ├─[CHECK]──> sn_one_extend available?         │
│   │            │             │                                │
│   │            │             ├─[NO]──> {fallback: true}      │
│   │            │             │                                │
│   │            │             └─[YES]─> Call One Extend API   │
│   │            │                        │                    │
│   │            │                        ├─[SUCCESS]──> AI text│
│   │            │                        │                    │
│   │            │                        └─[FAIL]────> {fallback: true}│
│   │            │                          (timeout, error,   │
│   │            │                           quota exceeded)   │
│   │            │                                              │
│   └─[IF FAIL]──> _generateRuleBasedDescription(context)      │
│                  Returns: Structured text based on patterns  │
│                  Attribution: "[response from SRE rulelogic]"│
│                                                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │
                                ▼
LAYER 4: EMERGENCY FALLBACK (Server-Side)
┌──────────────────────────────────────────────────────────────┐
│ ACCNowAssistAnalyzerServer._buildDynamicSummary()            │
│   │                                                           │
│   └─[IF LLM THROWS EXCEPTION]──>                             │
│       _buildRuleBasedDescription(...)                        │
│       Same as Layer 3 but called from different context      │
│       This should NEVER happen (LLM has internal fallback)   │
│       But included for absolute safety                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │
                                ▼
LAYER 5: AJAX ERROR RESPONSE
┌──────────────────────────────────────────────────────────────┐
│ ACCNowAssistAnalyzer._errorResponse()                        │
│   │                                                           │
│   └─> Returns: {                                             │
│          success: false,                                     │
│          error: "error message",                             │
│          probableCause: {                                    │
│            title: "Analysis Failed",                         │
│            description: "Could not complete analysis: ..."   │
│          }                                                    │
│        }                                                      │
│        This is returned if server-side crashes               │
│                                                               │
└──────────────────────────────────────────────────────────────┘

RESULT: User ALWAYS gets insights - never a blank screen!
```

---

## Component Dependencies

```
┌────────────────────────────────────────────────────────────────┐
│                       DEPENDENCY TREE                          │
└────────────────────────────────────────────────────────────────┘

acc_metrics_intelligence_client.js (CLIENT)
│
├─[depends on]─> x_snc_metricintelp.ACCNowAssistAnalyzer (AJAX)
│                 │
│                 ├─[extends]─> AbstractAjaxProcessor (ServiceNow)
│                 │
│                 └─[depends on]─> x_snc_metricintelp.ACCNowAssistAnalyzerServer (SERVER)
│                                   │
│                                   ├─[depends on]─> x_snc_metricintelp.ACCNowAssistAnalyzerLLM (LLM)
│                                   │                 │
│                                   │                 └─[depends on]─> sn_one_extend.OneExtendUtil (PLATFORM)
│                                   │                                   │
│                                   │                                   └─[requires]─> Now Assist License
│                                   │
│                                   ├─[queries]─> cmdb_ci (table)
│                                   │
│                                   └─[uses]─> em_alert (table - via alerts parameter)
│
└─[uses]─> GlideAjax (ServiceNow framework)

DEPLOYMENT ORDER (bottom-up):
1. ACCNowAssistAnalyzerLLM (no dependencies)
2. ACCNowAssistAnalyzerServer (depends on LLM)
3. ACCNowAssistAnalyzer (depends on Server)
4. acc_metrics_intelligence_client.js (depends on Ajax)
```

---

## State Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    SRE INTELLIGENCE STATES                     │
└────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   INITIAL LOAD      │
                    │  (Dashboard opens)  │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   CI SELECTION      │
                    │  (Auto or manual)   │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │   NOW ASSIST TRY    │
                    │  Calling AI API...  │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
      ┌─────────────────────┐   ┌─────────────────────┐
      │  NOW ASSIST SUCCESS │   │   NOW ASSIST FAIL   │
      │  - AI description   │   │  - Timeout/Error    │
      │  - Rule patterns    │   │  - Not available    │
      └─────────────────────┘   └─────────────────────┘
                │                           │
                │                           ▼
                │                 ┌─────────────────────┐
                │                 │  SRE RULES FALLBACK │
                │                 │  - Rule description │
                │                 │  - Rule patterns    │
                │                 └─────────────────────┘
                │                           │
                └──────────┬────────────────┘
                           ▼
                 ┌─────────────────────┐
                 │   DISPLAY INSIGHTS  │
                 │  - Title            │
                 │  - Description      │
                 │  - Recommendations  │
                 │  - Subtitle shows   │
                 │    source           │
                 └─────────────────────┘
                           │
                           ▼
                 ┌─────────────────────┐
                 │   USER INTERACTION  │
                 │  - Read insights    │
                 │  - Take action      │
                 │  - Change CI        │────┐
                 └─────────────────────┘    │
                                            │
                                            └──> (loop back to CI SELECTION)

ERROR STATES (from any point):
┌─────────────────────┐
│  AJAX ERROR         │
│  - Show error msg   │
│  - Retry option     │
└─────────────────────┘

┌─────────────────────┐
│  PARSE ERROR        │
│  - Log to console   │
│  - Fallback to SRE  │
└─────────────────────┘

┌─────────────────────┐
│  NO DATA            │
│  - Show empty state │
│  - Suggest actions  │
└─────────────────────┘
```

---

## Code Structure Map

```
/src/
├── ui_pages/
│   └── acc_metrics_intelligence_client.js (7000+ lines)
│       │
│       ├── Dashboard object
│       │   ├── data: { metrics, alerts, ci, filters, ... }
│       │   ├── init()
│       │   ├── loadData()
│       │   └── updateUI()
│       │
│       ├── SRE Intelligence section (~500 lines)
│       │   │
│       │   ├── _initSREIntelligence(ciSysId)
│       │   │   └──> Chooses CI, fetches details
│       │   │
│       │   ├── _selectCIForAnalysis()
│       │   │   └──> Smart CI selection logic
│       │   │
│       │   ├── _fetchInsightsWithFallback(ciSysId) ◄─── ENTRY POINT
│       │   │   ├──> _fetchNowAssistInsights(ciSysId, callback)
│       │   │   │     │
│       │   │   │     ├─[SUCCESS]──> Use AI insights, display
│       │   │   │     │
│       │   │   │     └─[FAIL]─────> Trigger fallback
│       │   │   │
│       │   │   └──> _fetchSREInsights(ciSysId) ◄─── FALLBACK
│       │   │         └──> Same Ajax call, uses rules
│       │   │
│       │   ├── _fetchNowAssistInsights(ciSysId, callback) ◄─── MODIFIED
│       │   │   │                                                (was placeholder)
│       │   │   ├── Simplify metrics
│       │   │   ├── Create GlideAjax call
│       │   │   ├── Send: ciSysId, metrics, alerts, timeRange
│       │   │   └── Parse response, invoke callback
│       │   │
│       │   ├── _fetchSREInsights(ciSysId)
│       │   │   │
│       │   │   ├── Simplify metrics (same as Now Assist)
│       │   │   ├── Create GlideAjax call
│       │   │   ├── Send: same parameters
│       │   │   └── Parse response, update UI
│       │   │
│       │   └── _renderSREPanel()
│       │       └──> Shows title, description, recommendations
│       │           Updates subtitle based on analysisType
│       │
│       └── Other dashboard functions...
│
├── script_includes/
│   │
│   ├── ACCNowAssistAnalyzer.js (~120 lines) ◄─── NEW
│   │   │
│   │   ├── extends: AbstractAjaxProcessor
│   │   ├── client_callable: TRUE
│   │   │
│   │   ├── getNowAssistInsights() ◄─── CLIENT CALLS THIS
│   │   │   ├── Parse parameters (with String() fix)
│   │   │   ├── Validate CI sys_id
│   │   │   ├── Call: ACCNowAssistAnalyzerServer.getNowAssistInsights()
│   │   │   └── Return: JSON.stringify(result)
│   │   │
│   │   └── _errorResponse(message)
│   │       └── Returns error JSON
│   │
│   ├── ACCNowAssistAnalyzerServer.js (~870 lines) ◄─── NEW
│   │   │
│   │   ├── initialize()
│   │   │   └── Set VA_CAPABILITY_ID
│   │   │
│   │   ├── getNowAssistInsights(ciSysId, metrics, alerts, timeRange) ◄─── MAIN
│   │   │   ├── _getCIDetails(ciSysId)
│   │   │   ├── _summarizeAlerts(alerts)
│   │   │   ├── _determineAnalysisContext(alerts, metrics, timeRange)
│   │   │   ├── _analyzeMetricsWithContext(metrics, context)
│   │   │   ├── _determineSmartFallback(...) ◄─── Calls LLM
│   │   │   └── _generateSmartRecommendations(...)
│   │   │
│   │   ├── PATTERN DETECTION (rule-based)
│   │   │   ├── _extractAlertPatterns(alerts)
│   │   │   ├── _extractMetricPatterns(metricAnalysis)
│   │   │   ├── _buildTimelineContext(alerts, context)
│   │   │   └── _correlateAlertsWithMetrics(alertPatterns, metricPatterns)
│   │   │
│   │   ├── CURRENT METRICS (rule-based)
│   │   │   └── _assessCurrentMetrics(metrics, alerts)
│   │   │
│   │   ├── HYBRID SUMMARY
│   │   │   ├── _buildDynamicSummary(...) ◄─── Calls LLM for description
│   │   │   └── _buildRuleBasedDescription(...) ◄─── Emergency fallback
│   │   │
│   │   └── HELPER FUNCTIONS
│   │       ├── _formatCIClassName(className)
│   │       ├── _formatTimeDisplay(dateStr)
│   │       ├── _categorizeMetric(name)
│   │       └── _formatMetricValue(value)
│   │
│   └── ACCNowAssistAnalyzerLLM.js (~460 lines) ◄─── NEW
│       │
│       ├── initialize()
│       │   └── Set VA_CAPABILITY_ID
│       │
│       ├── generateDescription(context) ◄─── SERVER CALLS THIS
│       │   ├── _buildDescriptionPrompt(context)
│       │   ├── _callNowLLM(prompt)
│       │   │   ├── Check: sn_one_extend available?
│       │   │   ├── Call: OneExtendUtil.execute(request)
│       │   │   └── Return: {success, text} or {fallback: true}
│       │   │
│       │   ├── [IF SUCCESS]──> Add attribution, return
│       │   └── [IF FAIL]─────> _generateRuleBasedDescription(context)
│       │
│       ├── PROMPT BUILDING
│       │   ├── _buildDescriptionPrompt(context)
│       │   │   ├── System context
│       │   │   ├── Alert summary (with open/closed)
│       │   │   ├── Metrics during window
│       │   │   ├── Current metrics status
│       │   │   ├── Correlation
│       │   │   └── Smart instructions
│       │   │
│       │   └── _formatCIClassName(className)
│       │
│       ├── AI INTEGRATION
│       │   └── _callNowLLM(prompt) ◄─── ONLY NOW ASSIST API CALL
│       │       └──> sn_one_extend.OneExtendUtil.execute()
│       │
│       └── FALLBACK
│           └── _generateRuleBasedDescription(context)
│               ├── Part 1: CI context
│               ├── Part 2: Alert summary
│               ├── Part 3: Timeline
│               ├── Part 4: Metrics during window
│               ├── Part 5: Current metrics
│               └── Part 6: Interpretation
│
└── (Other files unchanged)
```

---

## Integration Points

```
┌────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                       │
└────────────────────────────────────────────────────────────────┘

1. ServiceNow One Extend Platform
   ├── API: sn_one_extend.OneExtendUtil
   ├── Method: execute(request)
   └── Requires: Now Assist license, plugin active

2. Virtual Agent Capability
   ├── Capability ID: d82ff09efffc311063f5ffffffffffc5
   ├── Type: Text generation / summarization
   └── Model: (likely GPT-based, managed by ServiceNow)

3. CMDB Integration
   ├── Table: cmdb_ci
   ├── Queries: Get CI details (name, className)
   └── Access: Read-only

4. Alert Integration
   ├── Table: em_alert
   ├── Data: Passed from client (already loaded)
   └── Access: Read-only (via parameter)

5. Metrics Data
   ├── Source: Client-side (from main dashboard)
   ├── Format: Simplified array of objects
   └── Access: Passed as parameter
```

---

## Security & Permissions

```
┌────────────────────────────────────────────────────────────────┐
│                    SECURITY CONSIDERATIONS                     │
└────────────────────────────────────────────────────────────────┘

Script Includes:
├── ACCNowAssistAnalyzer
│   ├── Client Callable: ✅ TRUE (required for GlideAjax)
│   ├── Access: public
│   └── Risk: LOW (validates input, no direct DB writes)
│
├── ACCNowAssistAnalyzerServer
│   ├── Client Callable: ❌ FALSE (not directly accessible)
│   ├── Access: public
│   └── Risk: LOW (read-only operations)
│
└── ACCNowAssistAnalyzerLLM
    ├── Client Callable: ❌ FALSE (not directly accessible)
    ├── Access: public
    └── Risk: LOW (read-only, calls ServiceNow API)

Data Flow:
├── User Input: CI sys_id (validated against cmdb_ci)
├── Metrics: Sanitized on client before sending
├── Alerts: Already from trusted source (em_alert table)
└── AI Prompts: Built server-side (user cannot inject)

AI Integration:
├── Prompts: Server-controlled (no user injection possible)
├── Responses: From ServiceNow Now Assist (trusted platform)
└── Fallback: Always available (no dependency on external systems)

Permissions Required:
├── User must have: Access to dashboard UI Page
├── User must have: Read access to cmdb_ci table
├── User must have: Read access to em_alert table
└── Now Assist: Instance-level license (not user-specific)
```

---

This architecture supports:
- ✅ Graceful degradation (AI → rules → emergency)
- ✅ No single point of failure
- ✅ Fast fallback (no long timeouts)
- ✅ Clear attribution (user knows source)
- ✅ Minimal client changes (1 function)
- ✅ Maximum code reuse (90% from Dynatrace)
