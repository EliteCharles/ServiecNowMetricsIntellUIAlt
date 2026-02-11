import { Acl } from '@servicenow/sdk/core'

Acl({
    $id: Now.ID['6bb1c0c12b0b3e105d92f7634391bf8b'],
    localOrExisting: 'Existing',
    type: 'client_callable_script_include',
    operation: 'execute',
    roles: ['evt_mgmt_user'],
    name: 'ACCAlertCorrelatorAjax',
})
