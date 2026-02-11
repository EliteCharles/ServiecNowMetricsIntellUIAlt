import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['87f104052b0b3e105d92f7634391bfe4'],
    name: 'MetricsQueryEngineAjax',
    script: Now.include('./sys_script_include_87f104052b0b3e105d92f7634391bfe4.server.js'),
    apiName: 'x_snc_metricintelp.MetricsQueryEngineAjax',
    clientCallable: true,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
