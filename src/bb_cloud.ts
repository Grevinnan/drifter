import Config from './config';
import ResourceManager, * as rm from './resource_manager';
import {IAuth} from './config';
import sa from 'superagent';
import {isBinary} from 'istextorbinary';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export interface IRepositoryPath {
  workspace: string;
  repository: string;
}

const BBCloudCacheFilter: rm.ResourceId[] = [
  ['user'],
  ['workspaces'],
  ['workspaces', '*', 'members'],
  ['repositories', '*'],
  ['repositories', '*', '*', 'src', '**'],
];

class BitBucketCloud implements rm.IServer {
  auth: IAuth;
  url: string;
  cachePaths: rm.ResourceId[];
  constructor(auth: IAuth) {
    this.auth = auth;
    this.url = 'https://api.bitbucket.org/2.0/';
    this.cachePaths = BBCloudCacheFilter;
  }
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest {
    request.set('Content-Type', 'application/json')
        .set('Authorization', `Basic ${this.auth.password}`);
    return request;
  }
}

// TODO: base class
class JsonListHandler<U = any> implements rm.IDataHandler<U[]> {
  list: U[];
  constructor() {
    this.list = [];
  }

  add(result: any): sa.SuperAgentRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    this.list.push(...result.body.values);
    let nextPage = result.body.next;
    if (nextPage) {
      nextRequest = sa.get(nextPage);
    }
    return nextRequest;
  }

  get(): U[] {
    return this.list;
  }

  serialize(data: U[]): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): U[] {
    // TODO: catch errors
    return JSON.parse(data);
  }

  getCacheName(): string {
    return 'data.json';
  }
}

class JsonHandler<U = any> implements rm.IDataHandler<U> {
  json: U;
  constructor() {
    this.json = null;
  }

  add(result: any): sa.SuperAgentRequest {
    this.json = result.body;
    return null;
  }

  get(): U {
    return this.json;
  }

  serialize(data: U): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): U {
    // TODO: catch errors
    return JSON.parse(data);
  }

  getCacheName(): string {
    return 'data.json';
  }
}

class RawHandler implements rm.IDataHandler<any> {
  data: string;
  constructor() {
    this.data = null;
  }

  add(result: any): sa.SuperAgentRequest {
    // Check text first, if not, use body
    this.data = result.text;
    if (this.data === undefined) {
      this.data = result.body;
    }
    // Check if we should decode the data
    if (typeof(this.data) === 'object' && !isBinary(null, this.data)) {
      this.data = new TextDecoder().decode(this.data);
    }
    return null;
  }

  get(): string {
    return this.data;
  }

  serialize(data: string): string {
    return data;
  }

  deserialize(data: string): string {
    return data;
  }

  getCacheName(): string {
    // TODO: Maybe use file extension for files?
    return 'data';
  }
}

// TODO: cache results in class(RM?)
export class BitBucket {
  config: Config;
  manager: ResourceManager;
  bbCloud: rm.IServer;
  constructor(config: Config, options: rm.IManagerOptions) {
    this.config = config;
    this.manager = new ResourceManager(options);
    this.bbCloud = new BitBucketCloud(config.auth);
    this.manager.registerServer('bb-cloud', this.bbCloud);
  }

  jsonList() {
    return new JsonListHandler();
  }

  json() {
    return new JsonHandler();
  }

  raw() {
    return new RawHandler();
  }

  async getFromUrl<T>(url: string, handler: rm.IDataHandler<T>) {
    let resourceUrl: string = url;
    if (url.indexOf(this.bbCloud.url) === 0) {
      resourceUrl = url.slice(this.bbCloud.url.length);
    }
    let resourceParts = resourceUrl.split('/');
    if (resourceParts[0] === 'repositories' && resourceParts.length >= 3) {
      let wsId = resourceParts[1];
      let ws = await this.findWorkspace(wsId);
      if (!ws) {
        return null;
      }
      let repoId = resourceParts[2];
      let repo = await this.findRepositoryInWorkspace(repoId, ws);
      if (!repo) {
        return null;
      }
      resourceParts[1] = ws.uuid;
      resourceParts[2] = repo.uuid;
      // console.log(repo);
    }
    // console.log(resourceParts);
    return await this.get(handler, ...resourceParts);
  }

  async get<T>(handler: rm.IDataHandler<T>, ...id: string[]) {
    let resource: rm.IResource = {
      server: 'bb-cloud',
      id: id,
    };
    return await this.manager.get(resource, handler);
  }

  async getUser() {
    return await this.get(this.json(), 'user');
  }

  async getPullrequests(user: string) {
    return await this.get(this.jsonList(), 'pullrequests', user);
  }

  async getWorkspaces() {
    return await this.get(this.jsonList(), 'workspaces');
  }

  async getMembers(workspace: string) {
    return await this.get(this.jsonList(), 'workspaces', workspace, 'members');
  }

  async getPublicRepositories() {
    return await this.get(this.jsonList(), 'repositories');
  }

  async getRepositories(workspace: string) {
    return await this.get(this.jsonList(), 'repositories', workspace);
  }

  async getRepositorySrc(repo: IRepositoryPath, ...filePath: string[]) {
    return await this.get(
        this.jsonList(), 'repositories', repo.workspace, repo.repository, 'src',
        ...filePath);
  }

  async findRepositoryInWorkspace(repository: string, workspace: any):
      Promise<any> {
    let repositories = await this.getRepositories(workspace.uuid);
    let repoId = repository.toLowerCase();
    for (let repo of repositories) {
      if (repo.full_name.toLowerCase() === repoId ||
          repo.name.toLowerCase() === repoId || repo.uuid === repoId) {
        return repo;
      }
    }
    return null;
  }

  async findRepository(repository: string): Promise<any> {
    let workspaces = await this.getWorkspaces();
    let repoId = repository.toLowerCase();
    for (let workspace of workspaces) {
      let repositories = await this.getRepositories(workspace.uuid);
      for (let repo of repositories) {
        if (repo.full_name.toLowerCase() === repoId || repo.uuid === repoId) {
          return repo;
        }
      }
    }
    return null;
  }

  async findWorkspace(workspace: string): Promise<any> {
    let workspaces = await this.getWorkspaces();
    let workspaceId = workspace.toLowerCase();
    for (let ws of workspaces) {
      if (ws.slug.toLowerCase() === workspaceId || ws.uuid === workspaceId) {
        return ws;
      }
    }
    return null;
  }
}

export async function getConfig() {
  let config = new Config();
  if (!config.checkConfig()) {
    let configSetup = await config.setupConfig();
    if (!configSetup) {
      terminal('Config not loaded, aborting.\n');
      process.exit();
    }
  }
  return config;
}

function getOptions(argv): rm.IManagerOptions {
  const managerOptions: rm.IManagerOptions = {
    verbose: argv.v,
    forceSynchronize: argv.s,
  };
  return managerOptions;
}

export default async function getBitBucket(argv): Promise<BitBucket> {
  let config = await getConfig();
  return new BitBucket(config, getOptions(argv));
}
