import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['e101d7b82b0ffa105d92f7634391bf86'],
    name: 'MetricsAPIHandler',
    script: Now.include('./sys_script_include_e101d7b82b0ffa105d92f7634391bf86.server.js'),
    apiName: 'x_snc_metricintelp.MetricsAPIHandler',
    clientCallable: true,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
    protectionPolicy: '',
})
