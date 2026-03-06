export namespace assetapi {
	
	export class CreateAssetReq {
	    environment_id: number;
	    group_id?: number;
	    type: string;
	    name: string;
	    host: string;
	    port: number;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateAssetReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.group_id = source["group_id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
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
	    type: string;
	    keyword: string;
	
	    static createFrom(source: any = {}) {
	        return new ListAssetsReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.environment_id = source["environment_id"];
	        this.group_id = source["group_id"];
	        this.type = source["type"];
	        this.keyword = source["keyword"];
	    }
	}
	export class Result__EnvPilot_internal_asset_model_Asset_ {
	    ok: boolean;
	    data?: model.Asset;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Asset_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data?: model.Credential;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Credential_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data?: model.Environment;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Environment_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data?: model.Group;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_asset_model_Group_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	export class Result___EnvPilot_internal_asset_model_Asset_ {
	    ok: boolean;
	    data: model.Asset[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Asset_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: model.Credential[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Credential_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: model.Environment[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Environment_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: model.Group[];
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result___EnvPilot_internal_asset_model_Group_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class UpdateAssetReq {
	    id: number;
	    group_id?: number;
	    name: string;
	    host: string;
	    port: number;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	
	    static createFrom(source: any = {}) {
	        return new UpdateAssetReq(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.group_id = source["group_id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
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
	    ok: boolean;
	    data?: model.Execution;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result__EnvPilot_internal_executor_model_Execution_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: BatchExecuteResult;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_BatchExecuteResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: ExecuteResult;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_ExecuteResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: ExecutionListResult;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_EnvPilot_internal_executor_api_ExecutionListResult_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    ok: boolean;
	    data: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_bool_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.data = source["data"];
	        this.message = source["message"];
	    }
	}
	export class Result_string_ {
	    ok: boolean;
	    data: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Result_string_(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
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
	    type: string;
	    name: string;
	    host: string;
	    port: number;
	    description: string;
	    tags: string[];
	    credential_id?: number;
	    status: string;
	    // Go type: time
	    last_checked_at?: any;
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
	        this.type = source["type"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.credential_id = source["credential_id"];
	        this.status = source["status"];
	        this.last_checked_at = this.convertValues(source["last_checked_at"], null);
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

