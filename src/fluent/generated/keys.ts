import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: '9b3815b15b94450b8ad12e775f5e24b4'
                    }
                    br0: {
                        table: 'sys_script'
                        id: 'bd3e6c00d9f84e23a7b42ac07ec30e60'
                    }
                    cs0: {
                        table: 'sys_script_client'
                        id: 'fac19d02cc364873bfb7f1b9b1739b35'
                    }
                    d33097782b0ffa105d92f7634391bfc5: {
                        table: 'sys_script_include'
                        id: 'd33097782b0ffa105d92f7634391bfc5'
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
                ]
            }
        }
    }
}
