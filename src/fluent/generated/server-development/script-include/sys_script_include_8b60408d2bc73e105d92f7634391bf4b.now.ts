import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['8b60408d2bc73e105d92f7634391bf4b'],
    name: 'ACCMetricsAIAnalyzerServer',
    script: Now.include('./sys_script_include_8b60408d2bc73e105d92f7634391bf4b.server.js'),
    description: 'ACC Metrics AI Analyzer Server v1.0 - HYBRID AI + RULE-BASED ANALYSIS&#13;',
    apiName: 'x_snc_metricintelp.ACCMetricsAIAnalyzerServer',
    clientCallable: false,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
