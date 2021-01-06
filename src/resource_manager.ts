import sa from 'superagent';
import tkit from 'terminal-kit';

import Cache from './cache';

const terminal = tkit.terminal;

export interface IManagerOptions {
  verbose: boolean;
  forceSynchronize: boolean;
}

export interface IServer {
  url: string;
  cachePaths: ResourceId[];
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest;
}

export interface IDataHandler<T> {
  add(data: any): sa.SuperAgentRequest;
  get(): T;
  serialize(data: T): string;
  deserialize(data: string): T;
  getCacheName(): string;
}

export type ResourceId = string[];
export interface IResource {
  server: string;
  id: ResourceId;
}

export default class ResourceManager {
  options: IManagerOptions;
  servers: Map<string, IServer>;
  cache: Cache;
  resources: Map<string, any>;
  constructor(options: IManagerOptions) {
    this.options = options;
    this.servers = new Map();
    this.cache = new Cache({}, this.options.verbose);
    this.resources = new Map();
  }

  registerServer(name: string, data: IServer) {
    this.servers.set(name, data);
  }

  isFiltered(resource: ResourceId, server: IServer) {
    for (let filter of server.cachePaths) {
      let matched = true;
      let i = 0;
      for (i = 0; i < resource.length; ++i) {
        if (i >= filter.length) {
          matched = false;
          break;
        }

        let filterValue = filter[i];
        let resourceValue = resource[i];
        if (filterValue === '**') {
          return true;
        }
        if (filterValue === '*') {
          continue;
        }
        if (filterValue !== resourceValue) {
          matched = false;
          break;
        }
      }
      if (i < filter.length) {
        matched = false;
      }
      if (matched) {
        return true;
      }
    }
    return false;
  }

  async fetch<T>(resource: IResource, server: IServer, handler: IDataHandler<T>) {
    const completePath = resource.id.join('/');
    const url = `${server.url}${completePath}/`;
    const serverId = resource.server;
    let request = sa.get(url);
    while (request) {
      request = server.setAuthorization(request);
      this.options.verbose && terminal.green(`${serverId}: fetching ${request.url}\n`);
      let result = null;
      try {
        result = await request;
      } catch (error) {
        terminal.red.error(`${error.status} ${error.response?.text}\n`);
        return null;
      }
      request = handler.add(result);
    }
    return handler.get();
  }

  async get<T>(resource: IResource, handler: IDataHandler<T>): Promise<T> {
    const resourceStr = resource.id.join('/');
    let result: T = this.resources.get(resourceStr);
    if (result) {
      this.options.verbose && terminal.green(`rm: ${resourceStr} found\n`);
      return result;
    }
    let server = this.servers.get(resource.server);
    const filename = handler.getCacheName();
    if (!server) {
      terminal.error(`No server ${resource.server} registered\n`);
      return result;
    }
    // Try to get the resource from the cache if applicable
    const isFiltered = this.isFiltered(resource.id, server);
    if (!this.options.forceSynchronize && isFiltered) {
      this.options.verbose && terminal.yellow(`rm: filtered ${resourceStr}\n`);
      result = handler.deserialize(await this.cache.getResource(resource.id, filename));
    }
    // Otherwise just try to get it from the server
    if (!result) {
      result = await this.fetch(resource, server, handler);
      if (!result) {
        this.options.verbose &&
          terminal.error(`Could not get ${resource.id.join('/')}, aborting.\n`);
        return null;
      }
      if (isFiltered) {
        this.cache.saveResource(resource.id, handler.serialize(result), filename);
      }
    }
    this.resources.set(resourceStr, result);
    return result;
  }
}
