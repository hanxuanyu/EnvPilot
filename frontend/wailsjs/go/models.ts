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

export namespace connector {
	
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
	
	    static createFrom(source: any = {}) {
	        return new QueryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.columns = this.convertValues(source["columns"], QueryColumn);
	        this.rows = source["rows"];
	        this.affected = source["affected"];
	        this.duration_ms = source["duration_ms"];
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

}

export namespace model {
	
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
	export class ExecuteRedisCommandRequest {
	    asset_id: number;
	    command: string;
	    args: string[];
	
	    static createFrom(source: any = {}) {
	        return new ExecuteRedisCommandRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.asset_id = source["asset_id"];
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

}

