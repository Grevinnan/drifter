import crypto from 'crypto';
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

export type Parameters = Map<String, String>;

export interface IRequest {
  request: sa.SuperAgentRequest;
  repeat: boolean;
  queries: Parameters;
}

export interface IDataHandler<T> {
  add(data: any): IRequest;
  get(): T;
  serialize(data: T): string;
  deserialize(data: string): T;
  getCacheName(): string;
}

export type ResourceId = string[];

export interface IResource {
  server: string;
  id: ResourceId;
  parameters: Parameters;
  data: any;
}

const sha1 = (x: string) => crypto.createHash('sha1').update(x, 'utf8').digest('hex');

function getParametersString(parameters: Parameters) {
  const keyValues = Array.from(parameters.entries());
  let sorter = (a: [string, string], b: [string, string]) => a[0].localeCompare(b[0]);
  keyValues.sort(sorter);
  const combined = keyValues.map((x) => `${x[0]}='${x[1]}'`).join('|');
  return combined;
}

function getHash(parameters: Parameters) {
  const parameterStr = getParametersString(parameters);
  const hash = sha1(parameterStr);
  return hash;
}

function getResourcePath(resource: IResource, hash: string) {
  const resourcePath = resource.id.join('/');
  const fullResource = `${resourcePath}_${hash}`;
  return fullResource;
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

  isCachable(resource: ResourceId, server: IServer) {
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

  async interact<T>(
    resource: IResource,
    server: IServer,
    method: string,
    handler: IDataHandler<T>
  ) {
    const completePath = resource.id.join('/');
    const url = `${server.url}${completePath}/`;
    const serverId = resource.server;
    let currentQueries = resource.parameters;
    let r: IRequest = {
      request: sa(method, url).query(Object.fromEntries(currentQueries)),
      repeat: false,
      queries: null,
    };
    if (resource.data) {
      r.request.send(resource.data);
    }
    // console.log(r.request);
    while (r && r.request) {
      r.request = server.setAuthorization(r.request);
      if (this.options.verbose) {
        const parameters = getParametersString(currentQueries);
        terminal.green(`${serverId}: ${method} ${r.request.url} (${parameters})\n`);
      }
      let result = null;
      try {
        result = await r.request;
      } catch (error) {
        if (error.code || error.errno) {
          terminal.red.error(`${error.code} ${error.errno}\n`);
        } else if (error.status) {
          terminal.red.error(`${error.status} ${error.response?.text}\n`);
        }
        return null;
      }
      r = handler.add(result);
      if (r && r.repeat) {
        let newQueries = new Map<String, String>();
        if (r.queries) {
          newQueries = r.queries;
        }
        const repeatQueries = new Map<String, String>([...currentQueries, ...newQueries]);
        r.request = sa(method, url).query(Object.fromEntries(repeatQueries));
        if (resource.data) {
          r.request.send(resource.data);
        }
        currentQueries = repeatQueries;
      }
    }
    return handler.get();
  }

  async get<T>(resource: IResource, handler: IDataHandler<T>): Promise<T> {
    const hash = getHash(resource.parameters);
    const resourceStr = getResourcePath(resource, hash);
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
    const useCache = this.isCachable(resource.id, server);
    if (!this.options.forceSynchronize && useCache) {
      this.options.verbose && terminal.yellow(`rm: trying to load ${resourceStr}\n`);
      result = handler.deserialize(
        await this.cache.getResource(resource.id, hash, filename)
      );
    }
    // Otherwise just try to get it from the server
    if (!result) {
      result = await this.interact(resource, server, 'GET', handler);
      if (!result) {
        this.options.verbose &&
          terminal.error(`Could not GET ${resource.id.join('/')}, aborting.\n`);
        return null;
      }
      if (useCache) {
        this.cache.saveResource(resource.id, hash, handler.serialize(result), filename);
      }
    }
    this.resources.set(resourceStr, result);
    return result;
  }

  async interactUncached<T>(resource: IResource, handler: IDataHandler<T>, method: string) {
    let result: T = null;
    let server = this.servers.get(resource.server);
    if (!server) {
      terminal.error(`No server ${resource.server} registered\n`);
      return result;
    }
    result = await this.interact(resource, server, method, handler);
    if (!result) {
      this.options.verbose &&
        terminal.error(`Could not ${method} ${resource.id.join('/')}, aborting.\n`);
      return null;
    }
    return result;
  }

  async post<T>(resource: IResource, handler: IDataHandler<T>): Promise<T> {
    return this.interactUncached(resource, handler, 'POST');
  }

  async put<T>(resource: IResource, handler: IDataHandler<T>): Promise<T> {
    return this.interactUncached(resource, handler, 'PUT');
  }

  async delete<T>(resource: IResource, handler: IDataHandler<T>): Promise<T> {
    return this.interactUncached(resource, handler, 'DELETE');
  }
}
