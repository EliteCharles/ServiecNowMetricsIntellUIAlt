import { Acl } from '@servicenow/sdk/core'

Acl({
    $id: Now.ID['a4d4933c2b4ffa105d92f7634391bf1d'],
    localOrExisting: 'Existing',
    type: 'client_callable_script_include',
    operation: 'execute',
    roles: ['evt_mgmt_user'],
    name: 'AlertsQueryEngine',
})
