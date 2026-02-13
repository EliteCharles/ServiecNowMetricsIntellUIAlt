# ACC Metrics Intelligence with AI

AI-powered metrics analysis and visualization for ServiceNow Agent Client Collector (ACC). Combines Now Assist AI with advanced pattern detection, alert correlation, and SRE intelligence to provide actionable insights from your ACC metrics data.

## 🎯 Overview

This ServiceNow scoped application (`x_snc_metricintelp`) integrates advanced AI capabilities from Dynatrace Metrics Intelligence into an ACC-based metrics platform. It provides intelligent analysis of metrics, alerts, and anomalies with AI-powered root cause analysis and recommendations.

**Key Features:**
- 🤖 **Now Assist Integration** - AI-powered insights using VA Freeform Prompt capability
- 📊 **SRE Intelligence Dashboard** - Radial progress dials for Traffic, Errors, Latency, Saturation (TELS)
- 🔍 **Pattern Detection** - 7-phase comprehensive analysis of alerts and metrics
- 🔗 **Alert Correlation** - Multi-dimensional correlation (temporal, spatial, metric-based)
- 📈 **Spike Detection** - Automatic identification of metric anomalies (max/avg ratio ≥ 2.0)
- 🎨 **Multi-Theme UI** - Dark, Light, and InfiniteBlue themes
- 🔄 **Real-time Analysis** - Current metrics assessment with historical comparison

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACC Metrics Intelligence UI                  │
│                  (acc_metrics_intelligence.html)                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┴───────────────┐
                │  ACCMetricsAIAnalyzerAjax    │ (Client-callable)
                └──────────────┬───────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
    v                          v                          v
┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ MetricsQuery  │    │ ACCAlertCorr    │    │ ACCMetricsAI     │
│ Engine        │    │ elator          │    │ AnalyzerServer   │
└───────┬───────┘    └────────┬────────┘    └────────┬─────────┘
        │                     │                       │
        │ ┌───────────────────┴───────────────────────┘
        │ │                   │
        v v                   v
    ┌───────────┐      ┌─────────────┐
    │ ACC       │      │ Now Assist  │
    │ Metrics   │      │ (LLM)       │
    └───────────┘      └─────────────┘
```

## 📦 Components

### Script Includes (9 total)

#### Phase 1: AI Analysis Engine
1. **ACCMetricsAIAnalyzerServer** (989 lines)
   - Main orchestrator for AI-powered metric analysis
   - Hybrid AI + rule-based analysis
   - Current metrics assessment
   - Method: `getSREIntelligenceInsights(ciSysId, metrics, timeRange)`

2. **ACCMetricsAILLM** (471 lines)
   - Now Assist integration via VA Freeform Prompt
   - Graceful fallback to rule-based when LLM unavailable
   - Method: `generateDescription(context)`

3. **ACCPatternAnalyzer** (1,054 lines)
   - 7-phase comprehensive analysis
   - Pattern detection, CMDB impact, historical resolutions
   - Method: `analyzeAlertQuick(alertNumber)`

#### Phase 2: Enhanced Query Engine
4. **MetricsQueryEngine** (752 lines)
   - ACC metrics querying with spike detection
   - RED/USE signal categorization
   - Health scoring (0-100)
   - Methods: `queryMetricsWithAnalysis()`, `_analyzeMetricBehavior()`

5. **MetricsQueryEngineAjax** (121 lines)
   - Client-callable Ajax processor
   - Method: `getMetricsWithInsights()`

6. **MetricsAPIHandler** (3,407 bytes)
   - API handler for metrics data retrieval
   - Supports original UI page integration
   - Method: `getMetrics()`

#### Phase 3: Alert Correlation
7. **ACCAlertCorrelator** (512 lines)
   - Multi-source alert querying (ITOM Agent, ACC)
   - Temporal correlation (5-minute sliding window)
   - Burst and high-frequency detection
   - Method: `correlateAlertsWithMetrics(alerts, metrics)`

8. **ACCAlertCorrelatorAjax** (139 lines)
   - Client-callable Ajax processor
   - Method: `getAlertsWithCorrelation()`

#### Phase 5: UI Ajax Processor
9. **ACCMetricsAIAnalyzerAjax** (1,514 lines)
   - Client-callable Ajax processor for UI
   - Method: `getSREIntelligenceInsights()`

### UI Page (1 total)

**acc_metrics_intelligence**
- Complete SRE Intelligence Dashboard
- TELS Metrics Grid (5-column layout)
- Dark/Light/InfiniteBlue theme support
- Radial progress dials with health scores
- Real-time metric analysis
- Alert timeline visualization

## 🚀 Installation

### Prerequisites
- ServiceNow instance with admin access
- Agent Client Collector (ACC) configured with metrics
- Now Assist enabled (optional - graceful fallback if unavailable)
- Development or sub-prod environment

### Manual Installation Steps

#### 1. Create the Scoped Application
1. Navigate to **Studio** in ServiceNow
2. Create a new application:
   - **Name**: Metric Intelligence Plus
   - **Scope**: `x_snc_metricintelp`

#### 2. Import Script Includes (9 files)
For each Script Include in `src/script_includes/`:

1. **Studio** → **Create Application File** → **Server Development** → **Script Include**
2. **Name**: [Use filename without .js]
3. **Client callable**:
   - ✓ Yes: ACCMetricsAIAnalyzerAjax, MetricsQueryEngineAjax, ACCAlertCorrelatorAjax, MetricsAPIHandler
   - ✗ No: All others
4. **Script**: Copy entire file contents
5. **Submit**

**Import Order (recommended):**
1. MetricsQueryEngine
2. MetricsAPIHandler
3. ACCAlertCorrelator
4. ACCMetricsAILLM
5. ACCPatternAnalyzer
6. ACCMetricsAIAnalyzerServer
7. MetricsQueryEngineAjax
8. ACCAlertCorrelatorAjax
9. ACCMetricsAIAnalyzerAjax

#### 3. Import UI Page
1. **Studio** → **Create Application File** → **User Interface** → **UI Page**
2. **Name**: `acc_metrics_intelligence`
3. **Direct**: ✓ Checked
4. **HTML**: Copy from `src/ui_pages/acc_metrics_intelligence.html`
5. **Client Script**: Copy from `src/ui_pages/acc_metrics_intelligence_client.js`
6. **Processing Script**: Leave empty
7. **Submit**

#### 4. Add to Application Menu
1. **Studio** → **Create Application File** → **User Interface** → **Module**
2. **Title**: SRE Intelligence Dashboard
3. **Link Type**: URL (from arguments)
4. **Arguments**: `/x_snc_metricintelp/acc_metrics_intelligence.do`
5. **Submit**

#### 5. Test the Application
Access the dashboard:
```
https://[your-instance].service-now.com/x_snc_metricintelp/acc_metrics_intelligence.do
```

## 🎨 Features Deep Dive

### SRE Intelligence Panel
- **Traffic**: Request rate and throughput metrics
- **Errors**: Error rate and failure patterns
- **Latency**: Response time and performance
- **Saturation**: Resource utilization and capacity

### Pattern Detection (7-Phase Analysis)
1. Alert pattern identification
2. Metric correlation analysis
3. Temporal relationship mapping
4. CMDB impact assessment
5. Historical resolution lookup
6. Root cause hypothesis generation
7. Recommendation synthesis

### Spike Detection Algorithm
- **Threshold**: max/avg ratio ≥ 2.0
- **Severity Levels**:
  - Critical: ≥5.0x multiplier
  - Warning: ≥2.0x multiplier
  - Normal: <2.0x multiplier
- **Health Score**: 0-100 (based on spike frequency)

### Alert Correlation
- **Temporal**: 5-minute sliding window
- **Spatial**: Same CI or related CIs
- **Metric-based**: Correlated metric patterns
- **Burst Detection**: 3+ alerts in 10 minutes
- **High-frequency**: 5+ alerts per hour

## 📊 Usage

### Basic Workflow
1. Select a Configuration Item (CI) from dropdown
2. Choose time range (1h, 6h, 12h, 24h, 2d)
3. Click "Analyze Metrics"
4. Review SRE Intelligence panel for health scores
5. Examine TELS metrics grid for detailed insights
6. Check probable cause and recommendations

### Interpreting Health Scores
- **90-100**: Healthy - Normal operations
- **70-89**: Good - Minor anomalies detected
- **50-69**: Warning - Investigation recommended
- **30-49**: Critical - Action required
- **0-29**: Severe - Immediate attention needed

## 🔧 Configuration

### Now Assist Integration
The application automatically detects Now Assist availability. If unavailable:
- Falls back to rule-based analysis
- Maintains full functionality
- No manual configuration required

### Data Sources
Supports multiple alert sources:
- ITOM Agent (`em_alert` table)
- ACC (`em_alert_acc` table)
- Agent Client Collector (`em_alert_acc_v2` table)

## 📝 Development

### Repository Structure
```
ServiecNowMetricsIntellUIAlt/
├── src/
│   ├── script_includes/          # 9 Script Includes
│   │   ├── ACCMetricsAIAnalyzerServer.js
│   │   ├── ACCMetricsAILLM.js
│   │   ├── ACCPatternAnalyzer.js
│   │   ├── MetricsQueryEngine.js
│   │   ├── MetricsQueryEngineAjax.js
│   │   ├── MetricsAPIHandler.js
│   │   ├── ACCAlertCorrelator.js
│   │   ├── ACCAlertCorrelatorAjax.js
│   │   └── ACCMetricsAIAnalyzerAjax.js
│   ├── ui_pages/                 # UI Pages
│   │   ├── acc_metrics_intelligence.html
│   │   ├── acc_metrics_intelligence_client.js
│   │   ├── metric intell plus.html
│   │   └── metric intell Plus_client.js
│   ├── fluent/                   # ServiceNow Fluent CLI generated files
│   │   └── generated/
│   └── server/                   # Server scripts
│       └── script.js
├── README.md
├── now.config.json              # ServiceNow CLI config
└── package.json
```

### Technology Stack
- **Backend**: ServiceNow Server-side JavaScript (Rhino)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **AI**: ServiceNow Now Assist (VA Freeform Prompt)
- **Data**: ACC Metrics, CMDB, Event Management
- **Visualization**: Custom radial dials, time-series charts

## 🤝 Contributing

This is a ServiceNow scoped application. To contribute:
1. Fork the repository
2. Create a feature branch
3. Test in a ServiceNow dev instance
4. Submit pull request with detailed description

## 📜 License


## 📞 Support

For issues or questions:



---

**Version**: 1.0.0
**Last Updated**: February 13, 2026
**ServiceNow Scope**: x_snc_metricintelp
**Total Code**: 9 Script Includes + UI Pages

---

## ⚠️ IMPORTANT DISCLAIMER

### Not an Official ServiceNow Product

**This application is a custom innovation project and is NOT an official ServiceNow product, feature, or module.** It is not endorsed, supported, or maintained by ServiceNow, Inc.

### No ServiceNow Support

- ❌ This application is **NOT covered** by ServiceNow support agreements
- ❌ ServiceNow Technical Support **will not** provide assistance with this application
- ❌ This application is **NOT eligible** for ServiceNow support cases or incidents
- ❌ ServiceNow does **NOT guarantee** compatibility with platform updates or upgrades

### Use At Your Own Risk

By installing or using this application, you acknowledge and accept that:

1. **No Warranty**: This application is provided "AS IS" without warranty of any kind, express or implied
2. **Your Responsibility**: You assume all risks associated with installation, configuration, and use
3. **No Liability**: The creators and contributors are not liable for any damages, data loss, system failures, or business interruptions
4. **Testing Required**: You must thoroughly test in a non-production environment before any production deployment
5. **Instance Health**: This application may impact instance performance, stability, or security
6. **Compliance**: You are responsible for ensuring this application meets your organization's security, privacy, and compliance requirements
7. **Maintenance**: Updates, bug fixes, and enhancements are provided on a best-effort basis with no guarantees

### Production Use Warning

**⚠️ PRODUCTION DEPLOYMENT IS NOT RECOMMENDED WITHOUT EXTENSIVE TESTING**

Before deploying to production:
- ✅ Test thoroughly in a sub-production or development instance
- ✅ Perform security review and vulnerability assessment
- ✅ Validate against your organization's governance policies
- ✅ Ensure proper backup and rollback procedures
- ✅ Monitor resource consumption and performance impact
- ✅ Review and approve with your ServiceNow administrator and security team

### Custom Development

This is a **custom-built innovation** created using ServiceNow development tools. It is:
- Built by individuals for experimental and educational purposes
- Subject to change without notice
- Not part of the ServiceNow product roadmap
- Not subject to ServiceNow's standard quality assurance processes
- Not reviewed or certified by ServiceNow

### Third-Party Integration Notice

This application integrates with ServiceNow Now Assist and other platform capabilities. Changes to these ServiceNow platform features may break functionality without warning.

---

**By using this application, you acknowledge that you have read, understood, and agreed to these terms and disclaimers.**
