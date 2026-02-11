import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['6e8104812b0b3e105d92f7634391bf46'],
    name: 'ACCAlertCorrelatorAjax',
    script: Now.include('./sys_script_include_6e8104812b0b3e105d92f7634391bf46.server.js'),
    apiName: 'x_snc_metricintelp.ACCAlertCorrelatorAjax',
    clientCallable: true,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
