import Config from './config';
import ResourceManager, * as rm from './resource_manager';
import { IAuth } from './config';
import sa from 'superagent';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export interface IRepositoryPath {
  workspace: string;
  repository: string;
}

const JIRACloudCacheFilter: rm.ResourceId[] = [
  // TODO
  // ['myself'],
  // ['workspaces'],
  // ['workspaces', '*', 'members'],
  // ['repositories', '*'],
  // ['repositories', '*', '*', 'src', '**'],
];

class JiraCloud implements rm.IServer {
  auth: IAuth;
  url: string;
  cachePaths: rm.ResourceId[];
  constructor(auth: IAuth) {
    this.auth = auth;
    // TODO: Add configuration for domain
    this.url = 'https://domain.atlassian.net/rest/api/2/';
    this.cachePaths = JIRACloudCacheFilter;
  }
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest {
    request
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${this.auth.password}`);
    return request;
  }
}

// TODO: base class
class JsonListHandler<U = any> implements rm.IDataHandler<U[]> {
  list: U[];
  maxPages: number;
  index: number;
  constructor(maxPages: number = 0) {
    this.list = [];
    this.maxPages = maxPages;
    this.index = 0;
  }

  add(result: any): sa.SuperAgentRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    this.list.push(...result.body.values);
    let nextPage = result.body.next;
    this.index += 1;
    const useMaxPages = this.maxPages > 0;
    if (nextPage && (!useMaxPages || this.index < this.maxPages)) {
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

// TODO: cache results in class(RM?)
export class Jira {
  config: Config;
  manager: ResourceManager;
  JiraCloud: rm.IServer;
  constructor(config: Config, options: rm.IManagerOptions) {
    this.config = config;
    this.manager = new ResourceManager(options);
    this.JiraCloud = new JiraCloud(config.auth);
    this.manager.registerServer('jira-cloud', this.JiraCloud);
  }

  jsonList(maxPages: number = 0) {
    return new JsonListHandler(maxPages);
  }

  json() {
    return new JsonHandler();
  }

  async getFromUrl<T>(
    url: string,
    workspaceUuid: string,
    repoUuid: string,
    handler: rm.IDataHandler<T>
  ) {
    let resourceUrl: string = url;
    if (url.indexOf(this.JiraCloud.url) === 0) {
      resourceUrl = url.slice(this.JiraCloud.url.length);
    }
    let resourceParts = resourceUrl.split('/');
    // Substitute the name with the UUIDs
    if (resourceParts[0] === 'repositories' && resourceParts.length >= 3) {
      resourceParts[1] = workspaceUuid;
      resourceParts[2] = repoUuid;
    }
    return await this.get(handler, ...resourceParts);
  }

  async get<T>(handler: rm.IDataHandler<T>, ...id: string[]) {
    let resource: rm.IResource = {
      server: 'jira-cloud',
      id: id,
    };
    return await this.manager.get(resource, handler);
  }

  async getUser() {
    return await this.get(this.json(), 'myself');
  }

  async getIssue(issue: string) {
    return await this.get(this.json(), 'issue', issue);
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

  async getRepositorySrc(repo: IRepositoryPath, maxPages: number, ...filePath: string[]) {
    return await this.get(
      this.jsonList(maxPages),
      'repositories',
      repo.workspace,
      repo.repository,
      'src',
      ...filePath
    );
  }

  async findRepositoryInWorkspace(repository: string, workspace: any): Promise<any> {
    let repositories = await this.getRepositories(workspace.uuid);
    let repoId = repository.toLowerCase();
    for (let repo of repositories) {
      if (
        repo.full_name.toLowerCase() === repoId ||
        repo.name.toLowerCase() === repoId ||
        repo.uuid === repoId
      ) {
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

export default async function getJira(argv): Promise<Jira> {
  let config = await getConfig();
  return new Jira(config, getOptions(argv));
}
