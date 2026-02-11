import { Acl } from '@servicenow/sdk/core'

Acl({
    $id: Now.ID['6a150c412b4b3e105d92f7634391bfb1'],
    localOrExisting: 'Existing',
    type: 'ui_page',
    operation: 'read',
    roles: ['evt_mgmt_user'],
    name: 'x_snc_metricintelp_acc_metrics_intelligence',
})
