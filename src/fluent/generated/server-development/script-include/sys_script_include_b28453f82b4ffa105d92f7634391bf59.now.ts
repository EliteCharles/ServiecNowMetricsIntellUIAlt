import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['b28453f82b4ffa105d92f7634391bf59'],
    name: 'AlertsQueryEngine',
    script: Now.include('./sys_script_include_b28453f82b4ffa105d92f7634391bf59.server.js'),
    apiName: 'x_snc_metricintelp.AlertsQueryEngine',
    clientCallable: true,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
