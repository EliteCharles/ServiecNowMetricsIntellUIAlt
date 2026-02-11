import { Acl } from '@servicenow/sdk/core'

Acl({
    $id: Now.ID['de124c052b0b3e105d92f7634391bff1'],
    localOrExisting: 'Existing',
    type: 'client_callable_script_include',
    operation: 'execute',
    roles: ['evt_mgmt_user'],
    name: 'MetricsQueryEngineAjax',
})
