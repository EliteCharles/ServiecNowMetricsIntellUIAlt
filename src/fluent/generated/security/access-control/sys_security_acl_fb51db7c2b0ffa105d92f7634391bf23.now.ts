import { Acl } from '@servicenow/sdk/core'

Acl({
    $id: Now.ID['fb51db7c2b0ffa105d92f7634391bf23'],
    localOrExisting: 'Existing',
    type: 'client_callable_script_include',
    operation: 'execute',
    roles: ['evt_mgmt_user'],
    name: 'MetricsAPIHandler',
})
