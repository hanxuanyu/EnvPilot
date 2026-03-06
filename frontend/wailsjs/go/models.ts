export namespace api {
	
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
	
	

}

