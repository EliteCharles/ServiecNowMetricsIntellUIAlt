import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['494144412b0b3e105d92f7634391bf85'],
    name: 'ACCPatternAnalyzer',
    script: Now.include('./sys_script_include_494144412b0b3e105d92f7634391bf85.server.js'),
    apiName: 'x_snc_metricintelp.ACCPatternAnalyzer',
    clientCallable: false,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
