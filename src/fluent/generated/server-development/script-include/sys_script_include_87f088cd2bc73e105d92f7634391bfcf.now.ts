import { ScriptInclude } from '@servicenow/sdk/core'

ScriptInclude({
    $id: Now.ID['87f088cd2bc73e105d92f7634391bfcf'],
    name: 'ACCMetricsAILLM',
    script: Now.include('./sys_script_include_87f088cd2bc73e105d92f7634391bfcf.server.js'),
    apiName: 'x_snc_metricintelp.ACCMetricsAILLM',
    clientCallable: false,
    mobileCallable: false,
    sandboxCallable: false,
    accessibleFrom: 'public',
    active: true,
})
