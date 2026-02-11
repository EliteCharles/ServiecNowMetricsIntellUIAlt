import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    '0c8157bc2b0ffa105d92f7634391bff4': {
                        table: 'sys_ui_page'
                        id: '0c8157bc2b0ffa105d92f7634391bff4'
                    }
                    '1af11f302b4ffa105d92f7634391bf49': {
                        table: 'sys_scope_privilege'
                        id: '1af11f302b4ffa105d92f7634391bf49'
                    }
                    '1af11f302b4ffa105d92f7634391bf61': {
                        table: 'sys_scope_privilege'
                        id: '1af11f302b4ffa105d92f7634391bf61'
                    }
                    '1ef11f302b4ffa105d92f7634391bf4d': {
                        table: 'sys_scope_privilege'
                        id: '1ef11f302b4ffa105d92f7634391bf4d'
                    }
                    '4ef11f302b4ffa105d92f7634391bf08': {
                        table: 'sys_scope_privilege'
                        id: '4ef11f302b4ffa105d92f7634391bf08'
                    }
                    '5af11f302b4ffa105d92f7634391bf85': {
                        table: 'sys_scope_privilege'
                        id: '5af11f302b4ffa105d92f7634391bf85'
                    }
                    '5af11f302b4ffa105d92f7634391bfd9': {
                        table: 'sys_scope_privilege'
                        id: '5af11f302b4ffa105d92f7634391bfd9'
                    }
                    '5ef11f302b4ffa105d92f7634391bf43': {
                        table: 'sys_scope_privilege'
                        id: '5ef11f302b4ffa105d92f7634391bf43'
                    }
                    '82f11f302b4ffa105d92f7634391bf2b': {
                        table: 'sys_scope_privilege'
                        id: '82f11f302b4ffa105d92f7634391bf2b'
                    }
                    '8ef11f302b4ffa105d92f7634391bf2e': {
                        table: 'sys_scope_privilege'
                        id: '8ef11f302b4ffa105d92f7634391bf2e'
                    }
                    '9af11f302b4ffa105d92f7634391bf81': {
                        table: 'sys_scope_privilege'
                        id: '9af11f302b4ffa105d92f7634391bf81'
                    }
                    a4d4933c2b4ffa105d92f7634391bf1d: {
                        table: 'sys_security_acl'
                        id: 'a4d4933c2b4ffa105d92f7634391bf1d'
                    }
                    b28453f82b4ffa105d92f7634391bf59: {
                        table: 'sys_script_include'
                        id: 'b28453f82b4ffa105d92f7634391bf59'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: '9b3815b15b94450b8ad12e775f5e24b4'
                    }
                    br0: {
                        table: 'sys_script'
                        id: 'bd3e6c00d9f84e23a7b42ac07ec30e60'
                    }
                    c3c15bfc2b0ffa105d92f7634391bfbd: {
                        table: 'sys_security_acl'
                        id: 'c3c15bfc2b0ffa105d92f7634391bfbd'
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: 'fac19d02cc364873bfb7f1b9b1739b35'
                    }
                    d2f11f302b4ffa105d92f7634391bf33: {
                        table: 'sys_scope_privilege'
                        id: 'd2f11f302b4ffa105d92f7634391bf33'
                    }
                    d2f11f302b4ffa105d92f7634391bf65: {
                        table: 'sys_scope_privilege'
                        id: 'd2f11f302b4ffa105d92f7634391bf65'
                    }
                    d33097782b0ffa105d92f7634391bfc5: {
                        table: 'sys_script_include'
                        id: 'd33097782b0ffa105d92f7634391bfc5'
                    }
                    def11f302b4ffa105d92f7634391bf5d: {
                        table: 'sys_scope_privilege'
                        id: 'def11f302b4ffa105d92f7634391bf5d'
                    }
                    e101d7b82b0ffa105d92f7634391bf86: {
                        table: 'sys_script_include'
                        id: 'e101d7b82b0ffa105d92f7634391bf86'
                    }
                    fb51db7c2b0ffa105d92f7634391bf23: {
                        table: 'sys_security_acl'
                        id: 'fb51db7c2b0ffa105d92f7634391bf23'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: 'a0b2073aa95146c396235986ad870e5b'
                    }
                    src_server_script_js: {
                        table: 'sys_module'
                        id: 'b7f0af7ee1bb4db4b4d64963947fcd95'
                    }
                }
                composite: [
                    {
                        table: 'sys_security_acl_role'
                        id: '0c61db7c2b0ffa105d92f7634391bf90'
                        key: {
                            sys_security_acl: 'fb51db7c2b0ffa105d92f7634391bf23'
                            sys_user_role: {
                                id: 'ed2c2a31eb12110045e1a5115206feaf'
                                key: {
                                    name: 'evt_mgmt_user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '17c19bfc2b0ffa105d92f7634391bfda'
                        key: {
                            sys_security_acl: 'c3c15bfc2b0ffa105d92f7634391bfbd'
                            sys_user_role: {
                                id: 'ed2c2a31eb12110045e1a5115206feaf'
                                key: {
                                    name: 'evt_mgmt_user'
                                }
                            }
                        }
                    },
                    {
                        table: 'sys_security_acl_role'
                        id: '34d4933c2b4ffa105d92f7634391bf59'
                        key: {
                            sys_security_acl: 'a4d4933c2b4ffa105d92f7634391bf1d'
                            sys_user_role: {
                                id: 'ed2c2a31eb12110045e1a5115206feaf'
                                key: {
                                    name: 'evt_mgmt_user'
                                }
                            }
                        }
                    },
                ]
            }
        }
    }
}
