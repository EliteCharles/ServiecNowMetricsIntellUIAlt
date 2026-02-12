import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['d33097782b0ffa105d92f7634391bfc5'],
    name: 'MetricsQueryEngine',
    script: Now.include('./sys_script_include_d33097782b0ffa105d92f7634391bfc5.server.js'),
    description: 'Backend query engine for ACC metrics with time range and CI filtering support',
    apiName: 'x_snc_metricintelp.MetricsQueryEngine',
    clientCallable: false,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
