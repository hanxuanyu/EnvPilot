export namespace assetapi {
	
	export class CreateAssetReq {
	    environment_id: number;
	    group_id?: number;
	    category: string;
	    plugin_type: string;
	    name: string;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	    ext_config: Record<string, any>;
	    dns_config?: service.AssetDNSConfig;
	
	    static createFrom(source: any = {}) {
	        return new CreateAssetReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.group_id = source["group_id"];
	        this.category = source["category"];
	        this.plugin_type = source["plugin_type"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
	        this.ext_config = source["ext_config"];
	        this.dns_config = this.convertValues(source["dns_config"], service.AssetDNSConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CreateCredentialReq {
	    name: string;
	    type: string;
	    username: string;
	    secret: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateCredentialReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.username = source["username"];
	        this.secret = source["secret"];
	    }
	}
	export class CreateEnvironmentReq {
	    name: string;
	    description: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateEnvironmentReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	    }
	}
	export class CreateGroupReq {
	    environment_id: number;
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateGroupReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class ListAssetsReq {
	    environment_id: number;
	    group_id: number;
	    category: string;
	    plugin_type: string;
	    keyword: string;
	
	    static createFrom(source: any = {}) {
	        return new ListAssetsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.group_id = source["group_id"];
	        this.category = source["category"];
	        this.plugin_type = source["plugin_type"];
	        this.keyword = source["keyword"];
	    }
	}
	export class Result__EnvPilot_internal_asset_model_Asset_ {
	    success: boolean;
	    data?: model.Asset;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Asset_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Asset);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_asset_model_Credential_ {
	    success: boolean;
	    data?: model.Credential;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Credential_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Credential);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_asset_model_Environment_ {
	    success: boolean;
	    data?: model.Environment;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Environment_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Environment);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_asset_model_Group_ {
	    success: boolean;
	    data?: model.Group;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Group_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Group);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_plugin_PluginDef_ {
	    success: boolean;
	    data?: plugin.PluginDef;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_plugin_PluginDef_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], plugin.PluginDef);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result____EnvPilot_internal_plugin_PluginDef_ {
	    success: boolean;
	    data?: plugin.PluginDef[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result____EnvPilot_internal_plugin_PluginDef_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], plugin.PluginDef);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___EnvPilot_internal_asset_model_Asset_ {
	    success: boolean;
	    data?: model.Asset[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Asset_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Asset);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___EnvPilot_internal_asset_model_Credential_ {
	    success: boolean;
	    data?: model.Credential[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Credential_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Credential);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___EnvPilot_internal_asset_model_Environment_ {
	    success: boolean;
	    data?: model.Environment[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Environment_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Environment);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___EnvPilot_internal_asset_model_Group_ {
	    success: boolean;
	    data?: model.Group[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Group_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Group);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___string_ {
	    success: boolean;
	    data?: string[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class Result_bool_ {
	    success: boolean;
	    data?: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class Result_string_ {
	    success: boolean;
	    data?: string;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class UpdateAssetReq {
	    id: number;
	    group_id?: number;
	    name: string;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	    ext_config: Record<string, any>;
	    dns_config?: service.AssetDNSConfig;
	
	    static createFrom(source: any = {}) {
	        return new UpdateAssetReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.group_id = source["group_id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
	        this.ext_config = source["ext_config"];
	        this.dns_config = this.convertValues(source["dns_config"], service.AssetDNSConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateCredentialReq {
	    id: number;
	    name: string;
	    type: string;
	    username: string;
	    secret: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateCredentialReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.username = source["username"];
	        this.secret = source["secret"];
	    }
	}
	export class UpdateEnvironmentReq {
	    id: number;
	    name: string;
	    description: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateEnvironmentReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	    }
	}
	export class UpdateGroupReq {
	    id: number;
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateGroupReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}

}

export namespace auditapi {
	
	export class ListAuditLogsReq {
	    module: string;
	    action: string;
	    plugin_type: string;
	    success?: boolean;
	    keyword: string;
	    limit: number;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ListAuditLogsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.module = source["module"];
	        this.action = source["action"];
	        this.plugin_type = source["plugin_type"];
	        this.success = source["success"];
	        this.keyword = source["keyword"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class Result__EnvPilot_internal_audit_service_ListResult_ {
	    success: boolean;
	    data?: service.ListResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_audit_service_ListResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.ListResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace authapi {
	
	export class ChangePasswordReq {
	    current_password: string;
	    new_password: string;
	
	    static createFrom(source: any = {}) {
	        return new ChangePasswordReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.current_password = source["current_password"];
	        this.new_password = source["new_password"];
	    }
	}
	export class Result_EnvPilot_internal_auth_service_Status_ {
	    success: boolean;
	    data?: service.Status;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_auth_service_Status_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.Status);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_bool_ {
	    success: boolean;
	    data?: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class UnlockReq {
	    password: string;
	
	    static createFrom(source: any = {}) {
	        return new UnlockReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.password = source["password"];
	    }
	}

}

export namespace configapi {
	
	export class ListSnapshotsReq {
	    limit: number;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ListSnapshotsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class Result__EnvPilot_internal_config_service_CurrentConfigResult_ {
	    success: boolean;
	    data?: service.CurrentConfigResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_config_service_CurrentConfigResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.CurrentConfigResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_config_service_ListSnapshotsResult_ {
	    success: boolean;
	    data?: service.ListSnapshotsResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_config_service_ListSnapshotsResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.ListSnapshotsResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_config_service_SnapshotDetailResult_ {
	    success: boolean;
	    data?: service.SnapshotDetailResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_config_service_SnapshotDetailResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.SnapshotDetailResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RollbackConfigReq {
	    snapshot_id: number;
	    comment: string;
	    operator: string;
	
	    static createFrom(source: any = {}) {
	        return new RollbackConfigReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.snapshot_id = source["snapshot_id"];
	        this.comment = source["comment"];
	        this.operator = source["operator"];
	    }
	}
	export class UpdateConfigReq {
	    config: Record<string, any>;
	    comment: string;
	    operator: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateConfigReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = source["config"];
	        this.comment = source["comment"];
	        this.operator = source["operator"];
	    }
	}

}

export namespace connector {
	
	export class CacheDatabase {
	    name: string;
	    index: number;
	    key_count: number;
	
	    static createFrom(source: any = {}) {
	        return new CacheDatabase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.index = source["index"];
	        this.key_count = source["key_count"];
	    }
	}
	export class CacheCatalog {
	    default_database: number;
	    databases: CacheDatabase[];
	
	    static createFrom(source: any = {}) {
	        return new CacheCatalog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.default_database = source["default_database"];
	        this.databases = this.convertValues(source["databases"], CacheDatabase);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class CacheEntry {
	    field?: string;
	    value?: string;
	    score?: number;
	
	    static createFrom(source: any = {}) {
	        return new CacheEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.value = source["value"];
	        this.score = source["score"];
	    }
	}
	export class CacheKeyDetail {
	    database: number;
	    key: string;
	    type: string;
	    ttl_seconds: number;
	    size: number;
	    string_value?: string;
	    entries?: CacheEntry[];
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl_seconds = source["ttl_seconds"];
	        this.size = source["size"];
	        this.string_value = source["string_value"];
	        this.entries = this.convertValues(source["entries"], CacheEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CacheKeyInput {
	    database: number;
	    key: string;
	    type: string;
	    ttl_seconds?: number;
	    string_value?: string;
	    entries?: CacheEntry[];
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl_seconds = source["ttl_seconds"];
	        this.string_value = source["string_value"];
	        this.entries = this.convertValues(source["entries"], CacheEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CacheKeySummary {
	    key: string;
	    type: string;
	    ttl_seconds: number;
	    size: number;
	    preview?: string;
	
	    static createFrom(source: any = {}) {
	        return new CacheKeySummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl_seconds = source["ttl_seconds"];
	        this.size = source["size"];
	        this.preview = source["preview"];
	    }
	}
	export class CacheKeyPage {
	    database: number;
	    cursor: number;
	    items: CacheKeySummary[];
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyPage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.cursor = source["cursor"];
	        this.items = this.convertValues(source["items"], CacheKeySummary);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class CacheMutationResult {
	    database: number;
	    key: string;
	    type: string;
	    ttl_seconds: number;
	    size: number;
	    summary?: string;
	
	    static createFrom(source: any = {}) {
	        return new CacheMutationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.key = source["key"];
	        this.type = source["type"];
	        this.ttl_seconds = source["ttl_seconds"];
	        this.size = source["size"];
	        this.summary = source["summary"];
	    }
	}
	export class CommandResult {
	    command: string;
	    result: any;
	
	    static createFrom(source: any = {}) {
	        return new CommandResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.result = source["result"];
	    }
	}
	export class DatabaseCatalogItem {
	    name: string;
	    tables: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseCatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.tables = source["tables"];
	        this.error = source["error"];
	    }
	}
	export class DatabaseCatalog {
	    default_database?: string;
	    schema?: string;
	    databases: DatabaseCatalogItem[];
	
	    static createFrom(source: any = {}) {
	        return new DatabaseCatalog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.default_database = source["default_database"];
	        this.schema = source["schema"];
	        this.databases = this.convertValues(source["databases"], DatabaseCatalogItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Message {
	    topic?: string;
	    tag?: string;
	    exchange?: string;
	    routing_key?: string;
	    key?: string;
	    headers?: Record<string, string>;
	    body: string;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.topic = source["topic"];
	        this.tag = source["tag"];
	        this.exchange = source["exchange"];
	        this.routing_key = source["routing_key"];
	        this.key = source["key"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	    }
	}
	export class QueryColumn {
	    name: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryColumn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	    }
	}
	export class QueryResult {
	    columns: QueryColumn[];
	    rows: any[];
	    affected: number;
	    duration_ms: number;
	    summary?: string;
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], QueryColumn);
	        this.rows = source["rows"];
	        this.affected = source["affected"];
	        this.duration_ms = source["duration_ms"];
	        this.summary = source["summary"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SendResult {
	    success: boolean;
	    message_id?: string;
	    detail?: string;
	
	    static createFrom(source: any = {}) {
	        return new SendResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.message_id = source["message_id"];
	        this.detail = source["detail"];
	    }
	}
	export class TableColumn {
	    name: string;
	    type: string;
	    nullable: boolean;
	    default_value?: string;
	    key?: string;
	    extra?: string;
	    comment?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableColumn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.nullable = source["nullable"];
	        this.default_value = source["default_value"];
	        this.key = source["key"];
	        this.extra = source["extra"];
	        this.comment = source["comment"];
	    }
	}
	export class TableIndex {
	    name: string;
	    columns?: string[];
	    unique: boolean;
	    primary: boolean;
	    method?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableIndex(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.columns = source["columns"];
	        this.unique = source["unique"];
	        this.primary = source["primary"];
	        this.method = source["method"];
	    }
	}
	export class TableDetail {
	    database?: string;
	    schema?: string;
	    table: string;
	    columns: TableColumn[];
	    indexes?: TableIndex[];
	    create_sql?: string;
	
	    static createFrom(source: any = {}) {
	        return new TableDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.database = source["database"];
	        this.schema = source["schema"];
	        this.table = source["table"];
	        this.columns = this.convertValues(source["columns"], TableColumn);
	        this.indexes = this.convertValues(source["indexes"], TableIndex);
	        this.create_sql = source["create_sql"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace connectorapi {
	
	export class ListTablesReq {
	    asset_id: number;
	    database: string;
	
	    static createFrom(source: any = {}) {
	        return new ListTablesReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	    }
	}
	export class Result__EnvPilot_internal_connector_CacheCatalog_ {
	    success: boolean;
	    data?: connector.CacheCatalog;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_CacheCatalog_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.CacheCatalog);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_CacheKeyDetail_ {
	    success: boolean;
	    data?: connector.CacheKeyDetail;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_CacheKeyDetail_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.CacheKeyDetail);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_CacheKeyPage_ {
	    success: boolean;
	    data?: connector.CacheKeyPage;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_CacheKeyPage_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.CacheKeyPage);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_CacheMutationResult_ {
	    success: boolean;
	    data?: connector.CacheMutationResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_CacheMutationResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.CacheMutationResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_CommandResult_ {
	    success: boolean;
	    data?: connector.CommandResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_CommandResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.CommandResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_DatabaseCatalog_ {
	    success: boolean;
	    data?: connector.DatabaseCatalog;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_DatabaseCatalog_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.DatabaseCatalog);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_QueryResult_ {
	    success: boolean;
	    data?: connector.QueryResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_QueryResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.QueryResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_SendResult_ {
	    success: boolean;
	    data?: connector.SendResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_SendResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.SendResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_connector_TableDetail_ {
	    success: boolean;
	    data?: connector.TableDetail;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_connector_TableDetail_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], connector.TableDetail);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___string_ {
	    success: boolean;
	    data?: string[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class Result_bool_ {
	    success: boolean;
	    data?: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}

}

export namespace dnsapi {
	
	export class CreateDNSRecordReq {
	    environment_id: number;
	    asset_id?: number;
	    domain: string;
	    record_type: string;
	    value: string;
	    ttl: number;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateDNSRecordReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.asset_id = source["asset_id"];
	        this.domain = source["domain"];
	        this.record_type = source["record_type"];
	        this.value = source["value"];
	        this.ttl = source["ttl"];
	        this.enabled = source["enabled"];
	    }
	}
	export class ListDNSQueryLogsReq {
	    environment_id: number;
	    keyword: string;
	    source: string;
	    limit: number;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ListDNSQueryLogsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.keyword = source["keyword"];
	        this.source = source["source"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class ListDNSRecordsReq {
	    environment_id: number;
	    keyword: string;
	    enabled?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ListDNSRecordsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.keyword = source["keyword"];
	        this.enabled = source["enabled"];
	    }
	}
	export class Result__EnvPilot_internal_dns_model_DNSRecord_ {
	    success: boolean;
	    data?: model.DNSRecord;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_dns_model_DNSRecord_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.DNSRecord);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_dns_service_ListQueryLogsResult_ {
	    success: boolean;
	    data?: service.ListQueryLogsResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_dns_service_ListQueryLogsResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.ListQueryLogsResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_EnvPilot_internal_dns_service_RuntimeStatus_ {
	    success: boolean;
	    data?: service.RuntimeStatus;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_dns_service_RuntimeStatus_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.RuntimeStatus);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result___EnvPilot_internal_dns_model_DNSRecord_ {
	    success: boolean;
	    data?: model.DNSRecord[];
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_dns_model_DNSRecord_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.DNSRecord);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_bool_ {
	    success: boolean;
	    data?: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class UpdateDNSRecordReq {
	    id: number;
	    asset_id?: number;
	    domain: string;
	    record_type: string;
	    value: string;
	    ttl: number;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new UpdateDNSRecordReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.asset_id = source["asset_id"];
	        this.domain = source["domain"];
	        this.record_type = source["record_type"];
	        this.value = source["value"];
	        this.ttl = source["ttl"];
	        this.enabled = source["enabled"];
	    }
	}

}

export namespace executorapi {
	
	export class BatchExecuteReq {
	    asset_ids: number[];
	    command: string;
	    operator: string;
	    force: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BatchExecuteReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_ids = source["asset_ids"];
	        this.command = source["command"];
	        this.operator = source["operator"];
	        this.force = source["force"];
	    }
	}
	export class ExecuteResult {
	    dangerous: boolean;
	    execution?: model.Execution;
	
	    static createFrom(source: any = {}) {
	        return new ExecuteResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.dangerous = source["dangerous"];
	        this.execution = this.convertValues(source["execution"], model.Execution);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BatchExecuteResult {
	    results: ExecuteResult[];
	    dangerous: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BatchExecuteResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], ExecuteResult);
	        this.dangerous = source["dangerous"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExecuteCommandReq {
	    asset_id: number;
	    command: string;
	    operator: string;
	    force: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExecuteCommandReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.command = source["command"];
	        this.operator = source["operator"];
	        this.force = source["force"];
	    }
	}
	
	export class ExecutionListResult {
	    list: model.Execution[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ExecutionListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.list = this.convertValues(source["list"], model.Execution);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListExecutionsReq {
	    asset_id: number;
	    page: number;
	    page_size: number;
	
	    static createFrom(source: any = {}) {
	        return new ListExecutionsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.page = source["page"];
	        this.page_size = source["page_size"];
	    }
	}
	export class Result__EnvPilot_internal_executor_model_Execution_ {
	    success: boolean;
	    data?: model.Execution;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_executor_model_Execution_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.Execution);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_EnvPilot_internal_executor_api_BatchExecuteResult_ {
	    success: boolean;
	    data?: BatchExecuteResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_BatchExecuteResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], BatchExecuteResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_EnvPilot_internal_executor_api_ExecuteResult_ {
	    success: boolean;
	    data?: ExecuteResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_ExecuteResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], ExecuteResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_EnvPilot_internal_executor_api_ExecutionListResult_ {
	    success: boolean;
	    data?: ExecutionListResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_ExecutionListResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], ExecutionListResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SFTPDownloadResult {
	    name: string;
	    path: string;
	    size: number;
	    content_base64: string;
	
	    static createFrom(source: any = {}) {
	        return new SFTPDownloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.content_base64 = source["content_base64"];
	    }
	}
	export class Result_EnvPilot_internal_executor_api_SFTPDownloadResult_ {
	    success: boolean;
	    data?: SFTPDownloadResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_SFTPDownloadResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], SFTPDownloadResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SFTPEntry {
	    name: string;
	    path: string;
	    is_dir: boolean;
	    size: number;
	    mode: string;
	    owner?: string;
	    group?: string;
	    // Go type: time
	    mod_time: any;
	
	    static createFrom(source: any = {}) {
	        return new SFTPEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.is_dir = source["is_dir"];
	        this.size = source["size"];
	        this.mode = source["mode"];
	        this.owner = source["owner"];
	        this.group = source["group"];
	        this.mod_time = this.convertValues(source["mod_time"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SFTPListResult {
	    path: string;
	    home: string;
	    parent?: string;
	    entries: SFTPEntry[];
	
	    static createFrom(source: any = {}) {
	        return new SFTPListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.home = source["home"];
	        this.parent = source["parent"];
	        this.entries = this.convertValues(source["entries"], SFTPEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_EnvPilot_internal_executor_api_SFTPListResult_ {
	    success: boolean;
	    data?: SFTPListResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_SFTPListResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], SFTPListResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SFTPTransferResult {
	    path: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new SFTPTransferResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	    }
	}
	export class Result_EnvPilot_internal_executor_api_SFTPTransferResult_ {
	    success: boolean;
	    data?: SFTPTransferResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_SFTPTransferResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], SFTPTransferResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result_bool_ {
	    success: boolean;
	    data?: boolean;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class Result_string_ {
	    success: boolean;
	    data?: string;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	
	
	export class SFTPListRequest {
	    asset_id: number;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new SFTPListRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.path = source["path"];
	    }
	}
	
	export class SFTPMoveRequest {
	    asset_id: number;
	    path: string;
	    target_path: string;
	    overwrite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SFTPMoveRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.path = source["path"];
	        this.target_path = source["target_path"];
	        this.overwrite = source["overwrite"];
	    }
	}
	export class SFTPPathRequest {
	    asset_id: number;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new SFTPPathRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.path = source["path"];
	    }
	}
	
	export class SFTPUploadRequest {
	    asset_id: number;
	    path: string;
	    content_base64: string;
	    overwrite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SFTPUploadRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.path = source["path"];
	        this.content_base64 = source["content_base64"];
	        this.overwrite = source["overwrite"];
	    }
	}

}

export namespace healthapi {
	
	export class CheckAllReq {
	    environment_id: number;
	    category: string;
	
	    static createFrom(source: any = {}) {
	        return new CheckAllReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.category = source["category"];
	    }
	}
	export class ListSnapshotsReq {
	    environment_id: number;
	    category: string;
	    status: string;
	    keyword: string;
	    limit: number;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ListSnapshotsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.category = source["category"];
	        this.status = source["status"];
	        this.keyword = source["keyword"];
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	    }
	}
	export class Result__EnvPilot_internal_health_model_HealthSnapshot_ {
	    success: boolean;
	    data?: model.HealthSnapshot;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_health_model_HealthSnapshot_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], model.HealthSnapshot);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_health_service_CheckAllResult_ {
	    success: boolean;
	    data?: service.CheckAllResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_health_service_CheckAllResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.CheckAllResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_health_service_ListSnapshotsResult_ {
	    success: boolean;
	    data?: service.ListSnapshotsResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_health_service_ListSnapshotsResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.ListSnapshotsResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result__EnvPilot_internal_health_service_SummaryResult_ {
	    success: boolean;
	    data?: service.SummaryResult;
	    message?: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_health_service_SummaryResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = this.convertValues(source["data"], service.SummaryResult);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace hostinfo {
	
	export class Snapshot {
	    hostname: string;
	    platform: string;
	    platform_version: string;
	    kernel_version: string;
	    architecture: string;
	    uptime_seconds: number;
	    boot_time_unix: number;
	    cpu_cores: number;
	    cpu_percent: number;
	    memory_total: number;
	    memory_used: number;
	    memory_percent: number;
	    disk_path: string;
	    disk_total: number;
	    disk_used: number;
	    disk_percent: number;
	    executable: string;
	    sampled_at_unix: number;
	
	    static createFrom(source: any = {}) {
	        return new Snapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.platform = source["platform"];
	        this.platform_version = source["platform_version"];
	        this.kernel_version = source["kernel_version"];
	        this.architecture = source["architecture"];
	        this.uptime_seconds = source["uptime_seconds"];
	        this.boot_time_unix = source["boot_time_unix"];
	        this.cpu_cores = source["cpu_cores"];
	        this.cpu_percent = source["cpu_percent"];
	        this.memory_total = source["memory_total"];
	        this.memory_used = source["memory_used"];
	        this.memory_percent = source["memory_percent"];
	        this.disk_path = source["disk_path"];
	        this.disk_total = source["disk_total"];
	        this.disk_used = source["disk_used"];
	        this.disk_percent = source["disk_percent"];
	        this.executable = source["executable"];
	        this.sampled_at_unix = source["sampled_at_unix"];
	    }
	}

}

export namespace main {
	
	export class LaunchContext {
	    route: string;
	    auto_connect: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LaunchContext(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.route = source["route"];
	        this.auto_connect = source["auto_connect"];
	    }
	}
	export class SaveExportFileReq {
	    filename: string;
	    data_base64: string;
	    title: string;
	    filter_display_name: string;
	    filter_pattern: string;
	    default_directory: string;
	
	    static createFrom(source: any = {}) {
	        return new SaveExportFileReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.data_base64 = source["data_base64"];
	        this.title = source["title"];
	        this.filter_display_name = source["filter_display_name"];
	        this.filter_pattern = source["filter_pattern"];
	        this.default_directory = source["default_directory"];
	    }
	}

}

export namespace model {
	
	export class HealthSection {
	    check_interval: number;
	    timeout: number;
	    auto_check: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HealthSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.check_interval = source["check_interval"];
	        this.timeout = source["timeout"];
	        this.auto_check = source["auto_check"];
	    }
	}
	export class DNSSection {
	    enabled: boolean;
	    listen_addr: string;
	    upstream: string;
	    default_ttl: number;
	
	    static createFrom(source: any = {}) {
	        return new DNSSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.listen_addr = source["listen_addr"];
	        this.upstream = source["upstream"];
	        this.default_ttl = source["default_ttl"];
	    }
	}
	export class SecuritySection {
	    master_password_enabled: boolean;
	    salt_file: string;
	    dangerous_commands: string[];
	
	    static createFrom(source: any = {}) {
	        return new SecuritySection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.master_password_enabled = source["master_password_enabled"];
	        this.salt_file = source["salt_file"];
	        this.dangerous_commands = source["dangerous_commands"];
	    }
	}
	export class DatabaseSection {
	    filename: string;
	    max_idle_conns: number;
	    max_open_conns: number;
	
	    static createFrom(source: any = {}) {
	        return new DatabaseSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.max_idle_conns = source["max_idle_conns"];
	        this.max_open_conns = source["max_open_conns"];
	    }
	}
	export class LogSection {
	    level: string;
	    filename: string;
	    max_size: number;
	    max_backups: number;
	    max_age: number;
	    compress: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LogSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.level = source["level"];
	        this.filename = source["filename"];
	        this.max_size = source["max_size"];
	        this.max_backups = source["max_backups"];
	        this.max_age = source["max_age"];
	        this.compress = source["compress"];
	    }
	}
	export class AppSection {
	    name: string;
	    data_dir: string;
	    log_dir: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.data_dir = source["data_dir"];
	        this.log_dir = source["log_dir"];
	    }
	}
	export class AppConfig {
	    app: AppSection;
	    log: LogSection;
	    database: DatabaseSection;
	    security: SecuritySection;
	    dns: DNSSection;
	    health: HealthSection;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.app = this.convertValues(source["app"], AppSection);
	        this.log = this.convertValues(source["log"], LogSection);
	        this.database = this.convertValues(source["database"], DatabaseSection);
	        this.security = this.convertValues(source["security"], SecuritySection);
	        this.dns = this.convertValues(source["dns"], DNSSection);
	        this.health = this.convertValues(source["health"], HealthSection);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Credential {
	    id: number;
	    name: string;
	    type: string;
	    username: string;
	    secret_masked?: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Credential(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.username = source["username"];
	        this.secret_masked = source["secret_masked"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Group {
	    id: number;
	    environment_id: number;
	    name: string;
	    description: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    environment?: Environment;
	    assets?: Asset[];
	
	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.environment_id = source["environment_id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.environment = this.convertValues(source["environment"], Environment);
	        this.assets = this.convertValues(source["assets"], Asset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Environment {
	    id: number;
	    name: string;
	    description: string;
	    color: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    groups?: Group[];
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.color = source["color"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.groups = this.convertValues(source["groups"], Group);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Asset {
	    id: number;
	    environment_id: number;
	    group_id?: number;
	    category: string;
	    plugin_type: string;
	    name: string;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	    status: string;
	    // Go type: time
	    last_checked_at?: any;
	    ext_config: Record<string, any>;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    environment?: Environment;
	    group?: Group;
	    credential?: Credential;
	
	    static createFrom(source: any = {}) {
	        return new Asset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.environment_id = source["environment_id"];
	        this.group_id = source["group_id"];
	        this.category = source["category"];
	        this.plugin_type = source["plugin_type"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
	        this.status = source["status"];
	        this.last_checked_at = this.convertValues(source["last_checked_at"], null);
	        this.ext_config = source["ext_config"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.environment = this.convertValues(source["environment"], Environment);
	        this.group = this.convertValues(source["group"], Group);
	        this.credential = this.convertValues(source["credential"], Credential);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AuditLog {
	    id: number;
	    module: string;
	    action: string;
	    resource_type: string;
	    resource_id?: number;
	    resource_name?: string;
	    plugin_type?: string;
	    operator?: string;
	    success: boolean;
	    detail?: string;
	    request_data?: string;
	    result_data?: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new AuditLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.module = source["module"];
	        this.action = source["action"];
	        this.resource_type = source["resource_type"];
	        this.resource_id = source["resource_id"];
	        this.resource_name = source["resource_name"];
	        this.plugin_type = source["plugin_type"];
	        this.operator = source["operator"];
	        this.success = source["success"];
	        this.detail = source["detail"];
	        this.request_data = source["request_data"];
	        this.result_data = source["result_data"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ConfigSnapshot {
	    id: number;
	    version: number;
	    content: string;
	    comment?: string;
	    created_by?: string;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new ConfigSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.version = source["version"];
	        this.content = source["content"];
	        this.comment = source["comment"];
	        this.created_by = source["created_by"];
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DNSQueryLog {
	    id: number;
	    environment_id?: number;
	    domain: string;
	    question_type: string;
	    response_code: string;
	    answer_summary: string;
	    source: string;
	    hit_local: boolean;
	    upstream_used: boolean;
	    client_ip: string;
	    duration_ms: number;
	    // Go type: time
	    queried_at: any;
	    environment?: Environment;
	
	    static createFrom(source: any = {}) {
	        return new DNSQueryLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.environment_id = source["environment_id"];
	        this.domain = source["domain"];
	        this.question_type = source["question_type"];
	        this.response_code = source["response_code"];
	        this.answer_summary = source["answer_summary"];
	        this.source = source["source"];
	        this.hit_local = source["hit_local"];
	        this.upstream_used = source["upstream_used"];
	        this.client_ip = source["client_ip"];
	        this.duration_ms = source["duration_ms"];
	        this.queried_at = this.convertValues(source["queried_at"], null);
	        this.environment = this.convertValues(source["environment"], Environment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DNSRecord {
	    id: number;
	    environment_id: number;
	    asset_id?: number;
	    domain: string;
	    record_type: string;
	    value: string;
	    ttl: number;
	    enabled: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	    environment?: Environment;
	    asset?: Asset;
	
	    static createFrom(source: any = {}) {
	        return new DNSRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.environment_id = source["environment_id"];
	        this.asset_id = source["asset_id"];
	        this.domain = source["domain"];
	        this.record_type = source["record_type"];
	        this.value = source["value"];
	        this.ttl = source["ttl"];
	        this.enabled = source["enabled"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	        this.environment = this.convertValues(source["environment"], Environment);
	        this.asset = this.convertValues(source["asset"], Asset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class Execution {
	    id: number;
	    asset_id: number;
	    asset_name: string;
	    asset_host: string;
	    command: string;
	    output: string;
	    exit_code: number;
	    status: string;
	    operator: string;
	    // Go type: time
	    started_at: any;
	    // Go type: time
	    finished_at?: any;
	    // Go type: time
	    created_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Execution(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.asset_id = source["asset_id"];
	        this.asset_name = source["asset_name"];
	        this.asset_host = source["asset_host"];
	        this.command = source["command"];
	        this.output = source["output"];
	        this.exit_code = source["exit_code"];
	        this.status = source["status"];
	        this.operator = source["operator"];
	        this.started_at = this.convertValues(source["started_at"], null);
	        this.finished_at = this.convertValues(source["finished_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class HealthSnapshot {
	    id: number;
	    asset_id: number;
	    environment_id: number;
	    status: string;
	    check_type: string;
	    latency_ms: number;
	    detail: string;
	    metrics: Record<string, any>;
	    // Go type: time
	    checked_at: any;
	    // Go type: time
	    created_at: any;
	    asset?: Asset;
	
	    static createFrom(source: any = {}) {
	        return new HealthSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.asset_id = source["asset_id"];
	        this.environment_id = source["environment_id"];
	        this.status = source["status"];
	        this.check_type = source["check_type"];
	        this.latency_ms = source["latency_ms"];
	        this.detail = source["detail"];
	        this.metrics = source["metrics"];
	        this.checked_at = this.convertValues(source["checked_at"], null);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.asset = this.convertValues(source["asset"], Asset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace plugin {
	
	export class SelectOption {
	    value: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new SelectOption(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.value = source["value"];
	        this.label = source["label"];
	    }
	}
	export class ConfigField {
	    key: string;
	    label: string;
	    type: string;
	    required: boolean;
	    default_val?: any;
	    options?: SelectOption[];
	    placeholder?: string;
	    description?: string;
	    secret?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConfigField(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.label = source["label"];
	        this.type = source["type"];
	        this.required = source["required"];
	        this.default_val = source["default_val"];
	        this.options = this.convertValues(source["options"], SelectOption);
	        this.placeholder = source["placeholder"];
	        this.description = source["description"];
	        this.secret = source["secret"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PluginDef {
	    type_id: string;
	    display_name: string;
	    category: string;
	    icon_name: string;
	    config_schema: ConfigField[];
	    credential_required?: boolean;
	    credential_types?: string[];
	    capabilities?: string[];
	    integration_guide?: string[];
	
	    static createFrom(source: any = {}) {
	        return new PluginDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type_id = source["type_id"];
	        this.display_name = source["display_name"];
	        this.category = source["category"];
	        this.icon_name = source["icon_name"];
	        this.config_schema = this.convertValues(source["config_schema"], ConfigField);
	        this.credential_required = source["credential_required"];
	        this.credential_types = source["credential_types"];
	        this.capabilities = source["capabilities"];
	        this.integration_guide = source["integration_guide"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace service {
	
	export class AssetDNSConfig {
	    enabled: boolean;
	    domain: string;
	    ttl: number;
	
	    static createFrom(source: any = {}) {
	        return new AssetDNSConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.domain = source["domain"];
	        this.ttl = source["ttl"];
	    }
	}
	export class CacheKeyDeleteRequest {
	    asset_id: number;
	    database: number;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyDeleteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.key = source["key"];
	    }
	}
	export class CacheKeyDetailRequest {
	    asset_id: number;
	    database: number;
	    key: string;
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyDetailRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.key = source["key"];
	    }
	}
	export class CacheKeyListRequest {
	    asset_id: number;
	    database: number;
	    pattern: string;
	    cursor: number;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new CacheKeyListRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.pattern = source["pattern"];
	        this.cursor = source["cursor"];
	        this.limit = source["limit"];
	    }
	}
	export class CacheKeySaveRequest {
	    asset_id: number;
	    input: connector.CacheKeyInput;
	
	    static createFrom(source: any = {}) {
	        return new CacheKeySaveRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.input = this.convertValues(source["input"], connector.CacheKeyInput);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CheckAllResult {
	    checked: number;
	
	    static createFrom(source: any = {}) {
	        return new CheckAllResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.checked = source["checked"];
	    }
	}
	export class HotReloadResult {
	    applied?: string[];
	    restart_required?: string[];
	    messages?: string[];
	
	    static createFrom(source: any = {}) {
	        return new HotReloadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.applied = source["applied"];
	        this.restart_required = source["restart_required"];
	        this.messages = source["messages"];
	    }
	}
	export class CurrentConfigResult {
	    config: model.AppConfig;
	    yaml: string;
	    config_path: string;
	    requires_restart: boolean;
	    hot_reload: HotReloadResult;
	    latest_snapshot?: model.ConfigSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new CurrentConfigResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.config = this.convertValues(source["config"], model.AppConfig);
	        this.yaml = source["yaml"];
	        this.config_path = source["config_path"];
	        this.requires_restart = source["requires_restart"];
	        this.hot_reload = this.convertValues(source["hot_reload"], HotReloadResult);
	        this.latest_snapshot = this.convertValues(source["latest_snapshot"], model.ConfigSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ExecuteRedisCommandRequest {
	    asset_id: number;
	    database: number;
	    command: string;
	    args: string[];
	
	    static createFrom(source: any = {}) {
	        return new ExecuteRedisCommandRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.command = source["command"];
	        this.args = source["args"];
	    }
	}
	export class ExecuteSQLRequest {
	    asset_id: number;
	    database: string;
	    query: string;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new ExecuteSQLRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.query = source["query"];
	        this.limit = source["limit"];
	    }
	}
	
	export class ListQueryLogsResult {
	    items: model.DNSQueryLog[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ListQueryLogsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], model.DNSQueryLog);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListResult {
	    items: model.AuditLog[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], model.AuditLog);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ListSnapshotsResult {
	    items: model.ConfigSnapshot[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new ListSnapshotsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = this.convertValues(source["items"], model.ConfigSnapshot);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RuntimeStatus {
	    enabled: boolean;
	    running: boolean;
	    listen_addr: string;
	    upstream: string;
	    default_ttl: number;
	
	    static createFrom(source: any = {}) {
	        return new RuntimeStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.running = source["running"];
	        this.listen_addr = source["listen_addr"];
	        this.upstream = source["upstream"];
	        this.default_ttl = source["default_ttl"];
	    }
	}
	export class SendMQMessageRequest {
	    asset_id: number;
	    message: connector.Message;
	
	    static createFrom(source: any = {}) {
	        return new SendMQMessageRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.message = this.convertValues(source["message"], connector.Message);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SnapshotDetailResult {
	    snapshot: model.ConfigSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new SnapshotDetailResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.snapshot = this.convertValues(source["snapshot"], model.ConfigSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Status {
	    enabled: boolean;
	    initialized: boolean;
	    unlocked: boolean;
	    read_only: boolean;
	    needs_setup: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.initialized = source["initialized"];
	        this.unlocked = source["unlocked"];
	        this.read_only = source["read_only"];
	        this.needs_setup = source["needs_setup"];
	    }
	}
	export class SummaryResult {
	    total: number;
	    healthy: number;
	    warning: number;
	    critical: number;
	    unreachable: number;
	    unknown: number;
	
	    static createFrom(source: any = {}) {
	        return new SummaryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.healthy = source["healthy"];
	        this.warning = source["warning"];
	        this.critical = source["critical"];
	        this.unreachable = source["unreachable"];
	        this.unknown = source["unknown"];
	    }
	}
	export class TableDetailRequest {
	    asset_id: number;
	    database: string;
	    table: string;
	
	    static createFrom(source: any = {}) {
	        return new TableDetailRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
	        this.database = source["database"];
	        this.table = source["table"];
	    }
	}

}

