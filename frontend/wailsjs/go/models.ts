export namespace autocomplete {
	
	export class ClearCacheRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new ClearCacheRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class ClearCacheResponse {
	    success: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ClearCacheResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	    }
	}
	export class CompleteRequest {
	    sessionId: string;
	    prefix: string;
	
	    static createFrom(source: any = {}) {
	        return new CompleteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.prefix = source["prefix"];
	    }
	}
	export class Suggestion {
	    command: string;
	    description?: string;
	    type: string;
	
	    static createFrom(source: any = {}) {
	        return new Suggestion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.description = source["description"];
	        this.type = source["type"];
	    }
	}
	export class CompleteResponse {
	    success: boolean;
	    suggestions?: Suggestion[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new CompleteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.suggestions = this.convertValues(source["suggestions"], Suggestion);
	        this.error = source["error"];
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
	export class FetchCommandsRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new FetchCommandsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class FetchCommandsResponse {
	    success: boolean;
	    commands?: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new FetchCommandsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.commands = source["commands"];
	        this.error = source["error"];
	    }
	}

}

export namespace config {
	
	export class ServerConfig {
	    id: string;
	    name: string;
	    group: string;
	    host: string;
	    port: number;
	    username: string;
	    authType: string;
	    password: string;
	    privateKey: string;
	    vncEnabled: boolean;
	    vncPort: number;
	    vncPassword: string;
	    vncTunnel: boolean;
	    favorite: boolean;
	    tags: string[];
	    createdAt?: string;
	    updatedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.group = source["group"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.authType = source["authType"];
	        this.password = source["password"];
	        this.privateKey = source["privateKey"];
	        this.vncEnabled = source["vncEnabled"];
	        this.vncPort = source["vncPort"];
	        this.vncPassword = source["vncPassword"];
	        this.vncTunnel = source["vncTunnel"];
	        this.favorite = source["favorite"];
	        this.tags = source["tags"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class AddServerRequest {
	    server: ServerConfig;
	
	    static createFrom(source: any = {}) {
	        return new AddServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = this.convertValues(source["server"], ServerConfig);
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
	export class AddServerResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new AddServerResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class ConfigManager {
	
	
	    static createFrom(source: any = {}) {
	        return new ConfigManager(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}
	export class DeleteServerRequest {
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	    }
	}
	export class DeleteServerResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteServerResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class GetServersResponse {
	    servers: ServerConfig[];
	
	    static createFrom(source: any = {}) {
	        return new GetServersResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.servers = this.convertValues(source["servers"], ServerConfig);
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
	
	export class ToggleFavoriteRequest {
	    id: string;
	
	    static createFrom(source: any = {}) {
	        return new ToggleFavoriteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	    }
	}
	export class ToggleFavoriteResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ToggleFavoriteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class UpdateServerRequest {
	    server: ServerConfig;
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.server = this.convertValues(source["server"], ServerConfig);
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
	export class UpdateServerResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateServerResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}

}

export namespace monitor {
	
	export class DockerActionRequest {
	    sessionId: string;
	    container: string;
	    action: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerActionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.container = source["container"];
	        this.action = source["action"];
	    }
	}
	export class DockerActionResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerActionResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class DockerContainer {
	    id: string;
	    name: string;
	    image: string;
	    status: string;
	    ports: string;
	    state: string;
	    cpuPct: string;
	    memUsage: string;
	    memPct: string;
	    netIO: string;
	    blockIO: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerContainer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.image = source["image"];
	        this.status = source["status"];
	        this.ports = source["ports"];
	        this.state = source["state"];
	        this.cpuPct = source["cpuPct"];
	        this.memUsage = source["memUsage"];
	        this.memPct = source["memPct"];
	        this.netIO = source["netIO"];
	        this.blockIO = source["blockIO"];
	    }
	}
	export class DockerLogsRequest {
	    sessionId: string;
	    container: string;
	    tail?: number;
	
	    static createFrom(source: any = {}) {
	        return new DockerLogsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.container = source["container"];
	        this.tail = source["tail"];
	    }
	}
	export class DockerLogsResponse {
	    success: boolean;
	    logs?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerLogsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.logs = source["logs"];
	        this.error = source["error"];
	    }
	}
	export class DockerStatsRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerStatsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class DockerStatsResponse {
	    success: boolean;
	    containers?: DockerContainer[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerStatsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.containers = this.convertValues(source["containers"], DockerContainer);
	        this.error = source["error"];
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
	export class GetConnectionsRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new GetConnectionsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class NetConnection {
	    proto: string;
	    localAddr: string;
	    foreign: string;
	    state: string;
	    pid: number;
	
	    static createFrom(source: any = {}) {
	        return new NetConnection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.proto = source["proto"];
	        this.localAddr = source["localAddr"];
	        this.foreign = source["foreign"];
	        this.state = source["state"];
	        this.pid = source["pid"];
	    }
	}
	export class GetConnectionsResponse {
	    success: boolean;
	    connections?: NetConnection[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GetConnectionsResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.connections = this.convertValues(source["connections"], NetConnection);
	        this.error = source["error"];
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
	export class GetDockerRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new GetDockerRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class GetDockerResponse {
	    success: boolean;
	    containers?: DockerContainer[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GetDockerResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.containers = this.convertValues(source["containers"], DockerContainer);
	        this.error = source["error"];
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
	export class GetNetTrafficRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new GetNetTrafficRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class NetInterface {
	    name: string;
	    rxBytes: number;
	    txBytes: number;
	    rxPackets: number;
	    txPackets: number;
	
	    static createFrom(source: any = {}) {
	        return new NetInterface(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.rxBytes = source["rxBytes"];
	        this.txBytes = source["txBytes"];
	        this.rxPackets = source["rxPackets"];
	        this.txPackets = source["txPackets"];
	    }
	}
	export class NetTraffic {
	    interfaces: NetInterface[];
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new NetTraffic(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.interfaces = this.convertValues(source["interfaces"], NetInterface);
	        this.timestamp = source["timestamp"];
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
	export class GetNetTrafficResponse {
	    success: boolean;
	    traffic?: NetTraffic;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GetNetTrafficResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.traffic = this.convertValues(source["traffic"], NetTraffic);
	        this.error = source["error"];
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
	export class GetProcessesRequest {
	    sessionId: string;
	    sort?: string;
	
	    static createFrom(source: any = {}) {
	        return new GetProcessesRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.sort = source["sort"];
	    }
	}
	export class ProcessInfo {
	    pid: number;
	    user: string;
	    cpu: number;
	    mem: number;
	    vsz: number;
	    rss: number;
	    command: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.user = source["user"];
	        this.cpu = source["cpu"];
	        this.mem = source["mem"];
	        this.vsz = source["vsz"];
	        this.rss = source["rss"];
	        this.command = source["command"];
	    }
	}
	export class GetProcessesResponse {
	    success: boolean;
	    processes?: ProcessInfo[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new GetProcessesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.processes = this.convertValues(source["processes"], ProcessInfo);
	        this.error = source["error"];
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
	export class KillProcessRequest {
	    sessionId: string;
	    pid: number;
	    signal?: string;
	
	    static createFrom(source: any = {}) {
	        return new KillProcessRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.pid = source["pid"];
	        this.signal = source["signal"];
	    }
	}
	export class KillProcessResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new KillProcessResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	
	
	
	export class PingRequest {
	    sessionId: string;
	    host: string;
	    count?: number;
	
	    static createFrom(source: any = {}) {
	        return new PingRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.host = source["host"];
	        this.count = source["count"];
	    }
	}
	export class PingStat {
	    min: number;
	    avg: number;
	    max: number;
	    lost: number;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new PingStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.min = source["min"];
	        this.avg = source["avg"];
	        this.max = source["max"];
	        this.lost = source["lost"];
	        this.count = source["count"];
	    }
	}
	export class PingResponse {
	    success: boolean;
	    output?: string;
	    stats?: PingStat;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PingResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.output = source["output"];
	        this.stats = this.convertValues(source["stats"], PingStat);
	        this.error = source["error"];
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
	
	
	export class ResourceUsage {
	    cpuPercent: number;
	    memPercent: number;
	    memUsedMB: number;
	    memTotalMB: number;
	    diskPercent: number;
	    diskUsedGB: number;
	    diskTotalGB: number;
	    load1: number;
	    load5: number;
	    load15: number;
	
	    static createFrom(source: any = {}) {
	        return new ResourceUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpuPercent = source["cpuPercent"];
	        this.memPercent = source["memPercent"];
	        this.memUsedMB = source["memUsedMB"];
	        this.memTotalMB = source["memTotalMB"];
	        this.diskPercent = source["diskPercent"];
	        this.diskUsedGB = source["diskUsedGB"];
	        this.diskTotalGB = source["diskTotalGB"];
	        this.load1 = source["load1"];
	        this.load5 = source["load5"];
	        this.load15 = source["load15"];
	    }
	}
	export class StartMonitorRequest {
	    sessionId: string;
	    interval?: number;
	
	    static createFrom(source: any = {}) {
	        return new StartMonitorRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.interval = source["interval"];
	    }
	}
	export class StartMonitorResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StartMonitorResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class StartNetMonitorRequest {
	    sessionId: string;
	    interval?: number;
	
	    static createFrom(source: any = {}) {
	        return new StartNetMonitorRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.interval = source["interval"];
	    }
	}
	export class StartNetMonitorResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StartNetMonitorResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class StopMonitorRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new StopMonitorRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class StopMonitorResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StopMonitorResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class StopNetMonitorRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new StopNetMonitorRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class StopNetMonitorResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StopNetMonitorResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class SystemInfo {
	    hostname: string;
	    os: string;
	    kernel: string;
	    arch: string;
	    uptime: string;
	    users: number;
	    cpuCores: number;
	    cpuModel: string;
	    totalMemMB: number;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.os = source["os"];
	        this.kernel = source["kernel"];
	        this.arch = source["arch"];
	        this.uptime = source["uptime"];
	        this.users = source["users"];
	        this.cpuCores = source["cpuCores"];
	        this.cpuModel = source["cpuModel"];
	        this.totalMemMB = source["totalMemMB"];
	    }
	}
	export class TracerouteRequest {
	    sessionId: string;
	    host: string;
	
	    static createFrom(source: any = {}) {
	        return new TracerouteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.host = source["host"];
	    }
	}
	export class TracerouteResponse {
	    success: boolean;
	    output?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new TracerouteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.output = source["output"];
	        this.error = source["error"];
	    }
	}

}

export namespace sftp {
	
	export class ConnectFromSSHRequest {
	    sshSessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectFromSSHRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sshSessionId = source["sshSessionId"];
	    }
	}
	export class ConnectRequest {
	    host: string;
	    port: number;
	    username: string;
	    password: string;
	    privateKey: string;
	    authType: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.privateKey = source["privateKey"];
	        this.authType = source["authType"];
	    }
	}
	export class ConnectResponse {
	    success: boolean;
	    error?: string;
	    sessionId?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.sessionId = source["sessionId"];
	    }
	}
	export class DeleteFileRequest {
	    sessionId: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteFileRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.path = source["path"];
	    }
	}
	export class DeleteFileResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteFileResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class DownloadRequest {
	    sessionId: string;
	    remotePath: string;
	    localPath: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.remotePath = source["remotePath"];
	        this.localPath = source["localPath"];
	    }
	}
	export class DownloadResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new DownloadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class FileInfo {
	    name: string;
	    size: number;
	    type: string;
	    path: string;
	    modTime?: string;
	    mode?: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.size = source["size"];
	        this.type = source["type"];
	        this.path = source["path"];
	        this.modTime = source["modTime"];
	        this.mode = source["mode"];
	    }
	}
	export class GetTransferStateRequest {
	    sessionId: string;
	    remotePath: string;
	    localPath: string;
	    direction: string;
	
	    static createFrom(source: any = {}) {
	        return new GetTransferStateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.remotePath = source["remotePath"];
	        this.localPath = source["localPath"];
	        this.direction = source["direction"];
	    }
	}
	export class GetTransferStateResponse {
	    success: boolean;
	    error?: string;
	    localSize?: number;
	    remoteSize?: number;
	    canResume?: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GetTransferStateResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.localSize = source["localSize"];
	        this.remoteSize = source["remoteSize"];
	        this.canResume = source["canResume"];
	    }
	}
	export class ListFilesRequest {
	    sessionId: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new ListFilesRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.path = source["path"];
	    }
	}
	export class ListFilesResponse {
	    success: boolean;
	    files?: FileInfo[];
	    error?: string;
	    path?: string;
	
	    static createFrom(source: any = {}) {
	        return new ListFilesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.files = this.convertValues(source["files"], FileInfo);
	        this.error = source["error"];
	        this.path = source["path"];
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
	export class LocalDeleteRequest {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalDeleteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class LocalDeleteResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalDeleteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class LocalListFilesRequest {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalListFilesRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class LocalListFilesResponse {
	    success: boolean;
	    files?: FileInfo[];
	    error?: string;
	    path?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalListFilesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.files = this.convertValues(source["files"], FileInfo);
	        this.error = source["error"];
	        this.path = source["path"];
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
	export class LocalMkdirRequest {
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalMkdirRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	    }
	}
	export class LocalMkdirResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalMkdirResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class LocalRenameRequest {
	    oldPath: string;
	    newPath: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalRenameRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.oldPath = source["oldPath"];
	        this.newPath = source["newPath"];
	    }
	}
	export class LocalRenameResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new LocalRenameResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class MkdirRequest {
	    sessionId: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new MkdirRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.path = source["path"];
	    }
	}
	export class MkdirResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new MkdirResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class PickFilesResponse {
	    paths: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PickFilesResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.paths = source["paths"];
	        this.error = source["error"];
	    }
	}
	export class RenameRequest {
	    sessionId: string;
	    oldPath: string;
	    newPath: string;
	
	    static createFrom(source: any = {}) {
	        return new RenameRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.oldPath = source["oldPath"];
	        this.newPath = source["newPath"];
	    }
	}
	export class RenameResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new RenameResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class ResumeDownloadRequest {
	    sessionId: string;
	    remotePath: string;
	    localPath: string;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ResumeDownloadRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.remotePath = source["remotePath"];
	        this.localPath = source["localPath"];
	        this.offset = source["offset"];
	    }
	}
	export class ResumeDownloadResponse {
	    success: boolean;
	    error?: string;
	    skipBytes?: number;
	    totalBytes?: number;
	
	    static createFrom(source: any = {}) {
	        return new ResumeDownloadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.skipBytes = source["skipBytes"];
	        this.totalBytes = source["totalBytes"];
	    }
	}
	export class ResumeUploadRequest {
	    sessionId: string;
	    localPath: string;
	    remotePath: string;
	    offset: number;
	
	    static createFrom(source: any = {}) {
	        return new ResumeUploadRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.localPath = source["localPath"];
	        this.remotePath = source["remotePath"];
	        this.offset = source["offset"];
	    }
	}
	export class ResumeUploadResponse {
	    success: boolean;
	    error?: string;
	    skipBytes?: number;
	    totalBytes?: number;
	
	    static createFrom(source: any = {}) {
	        return new ResumeUploadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.skipBytes = source["skipBytes"];
	        this.totalBytes = source["totalBytes"];
	    }
	}
	export class SFTPManager {
	    Ctx: any;
	
	    static createFrom(source: any = {}) {
	        return new SFTPManager(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ctx = source["Ctx"];
	    }
	}
	export class UploadRequest {
	    sessionId: string;
	    localPath: string;
	    remotePath: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.localPath = source["localPath"];
	        this.remotePath = source["remotePath"];
	    }
	}
	export class UploadResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}

}

export namespace ssh {
	
	export class Client {
	    Conn: any;
	
	    static createFrom(source: any = {}) {
	        return new Client(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Conn = source["Conn"];
	    }
	}
	export class ConnectRequest {
	    host: string;
	    port: number;
	    username: string;
	    password: string;
	    privateKey: string;
	    authType: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.privateKey = source["privateKey"];
	        this.authType = source["authType"];
	    }
	}
	export class ConnectResponse {
	    success: boolean;
	    error?: string;
	    sessionId?: string;
	    needsHostKeyTrust?: boolean;
	    hostKeyFingerprint?: string;
	    hostKeyType?: string;
	    hostKeyHost?: string;
	    hostKeyMismatch?: boolean;
	    expectedFingerprint?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.sessionId = source["sessionId"];
	        this.needsHostKeyTrust = source["needsHostKeyTrust"];
	        this.hostKeyFingerprint = source["hostKeyFingerprint"];
	        this.hostKeyType = source["hostKeyType"];
	        this.hostKeyHost = source["hostKeyHost"];
	        this.hostKeyMismatch = source["hostKeyMismatch"];
	        this.expectedFingerprint = source["expectedFingerprint"];
	    }
	}
	export class CreateShellRequest {
	    baseSessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateShellRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseSessionId = source["baseSessionId"];
	    }
	}
	export class CreateShellResponse {
	    success: boolean;
	    error?: string;
	    sessionId?: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateShellResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.sessionId = source["sessionId"];
	    }
	}
	export class ExecCommandRequest {
	    sessionId: string;
	    command: string;
	    timeout?: number;
	
	    static createFrom(source: any = {}) {
	        return new ExecCommandRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.command = source["command"];
	        this.timeout = source["timeout"];
	    }
	}
	export class ExecCommandResponse {
	    success: boolean;
	    output?: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ExecCommandResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.output = source["output"];
	        this.error = source["error"];
	    }
	}
	export class GetLatencyRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new GetLatencyRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class GetLatencyResponse {
	    success: boolean;
	    latency: number;
	
	    static createFrom(source: any = {}) {
	        return new GetLatencyResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.latency = source["latency"];
	    }
	}
	export class IsConnectedResponse {
	    connected: boolean;
	
	    static createFrom(source: any = {}) {
	        return new IsConnectedResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	    }
	}
	export class ResizeRequest {
	    sessionId: string;
	    rows: number;
	    cols: number;
	
	    static createFrom(source: any = {}) {
	        return new ResizeRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.rows = source["rows"];
	        this.cols = source["cols"];
	    }
	}
	export class ResizeResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ResizeResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class SSHService {
	    Ctx: any;
	
	    static createFrom(source: any = {}) {
	        return new SSHService(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ctx = source["Ctx"];
	    }
	}
	export class TrustHostKeyRequest {
	    host: string;
	    keyType: string;
	    fingerprint: string;
	
	    static createFrom(source: any = {}) {
	        return new TrustHostKeyRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.keyType = source["keyType"];
	        this.fingerprint = source["fingerprint"];
	    }
	}
	export class TrustHostKeyResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new TrustHostKeyResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class WriteRequest {
	    sessionId: string;
	    data: string;
	
	    static createFrom(source: any = {}) {
	        return new WriteRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.data = source["data"];
	    }
	}
	export class WriteResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new WriteResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}

}

export namespace vnc {
	
	export class Proxy {
	    Ctx: any;
	
	    static createFrom(source: any = {}) {
	        return new Proxy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Ctx = source["Ctx"];
	    }
	}
	export class StartProxyRequest {
	    host: string;
	    port: number;
	    password: string;
	    tunnel: boolean;
	    sshSessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new StartProxyRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.password = source["password"];
	        this.tunnel = source["tunnel"];
	        this.sshSessionId = source["sshSessionId"];
	    }
	}
	export class StartProxyResponse {
	    success: boolean;
	    error?: string;
	    wsUrl?: string;
	
	    static createFrom(source: any = {}) {
	        return new StartProxyResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	        this.wsUrl = source["wsUrl"];
	    }
	}
	export class StopProxyRequest {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new StopProxyRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class StopProxyResponse {
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StopProxyResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}

}

