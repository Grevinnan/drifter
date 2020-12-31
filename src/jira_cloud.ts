import Config from './config';
import ResourceManager, * as rm from './resource_manager';
import { IServer } from './config';
import sa from 'superagent';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export interface IRepositoryPath {
  workspace: string;
  repository: string;
}

const JIRACloudCacheFilter: rm.ResourceId[] = [
  // TODO
  ['resolution'],
  ['issue', 'createmeta'],
  // ['workspaces'],
  // ['workspaces', '*', 'members'],
  // ['repositories', '*'],
  // ['repositories', '*', '*', 'src', '**'],
];

class JiraCloud implements rm.IServer {
  server: IServer;
  url: string;
  cachePaths: rm.ResourceId[];
  constructor(server: IServer) {
    this.server = server;
    this.url = server.url;
    this.cachePaths = JIRACloudCacheFilter;
  }
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest {
    request
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${this.server.authorization}`);
    return request;
  }
}

class BaseJsonListHandler<U = any> implements rm.IDataHandler<U[]> {
  list: U[];
  constructor() {
    this.list = [];
  }

  add(result: any): rm.IRequest {
    return null;
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

class StatusHandler implements rm.IDataHandler<number> {
  statusCode: number;
  constructor() {
    this.statusCode = null;
  }

  add(result: any): rm.IRequest {
    if (result.statusCode) {
      this.statusCode = result.statusCode;
    }
    return null;
  }

  get(): number {
    return this.statusCode;
  }

  serialize(data: number): string {
    return data.toString();
  }

  deserialize(data: string): number {
    // TODO: catch errors
    return parseInt(data);
  }

  getCacheName(): string {
    return 'data.txt';
  }
}

class JsonListHandler<U = any> extends BaseJsonListHandler<U> {
  maxPages: number;
  listName: string;
  index: number;
  constructor(maxPages: number = 0, listName: string) {
    super();
    this.maxPages = maxPages;
    this.listName = listName;
    this.index = 0;
  }

  add(result: any): rm.IRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    const body = result.body;
    const values = body[this.listName];
    this.list.push(...values);
    let nextPage = result.body.nextPage;
    // console.log(result.body);
    this.index += 1;
    const useMaxPages = this.maxPages > 0;
    if (nextPage && (!useMaxPages || this.index < this.maxPages)) {
      nextRequest = sa.get(nextPage);
    }
    return { request: nextRequest, repeat: false, queries: null };
  }
}

class IssueListHandler<U = any> extends BaseJsonListHandler<U> {
  numIssues: number;
  issueCount: number;
  constructor(numIssues: number = 0) {
    super();
    this.numIssues = numIssues;
    this.issueCount = 0;
  }

  add(result: any): rm.IRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    let repeat: boolean = false;
    let queries: rm.Parameters = new Map<String, String>();
    const body = result.body;
    const issues = body['issues'];
    if (this.numIssues > 0) {
      this.numIssues = Math.min(this.numIssues, body.total);
    } else {
      this.numIssues = body.total;
    }
    // console.log(this.numIssues);
    this.list.push(...issues);
    // console.log(this.list.length);
    if (this.list.length < this.numIssues) {
      repeat = true;
      const remainingIssues = this.numIssues - this.list.length;
      queries.set('startAt', this.list.length.toString());
      queries.set('maxResults', remainingIssues.toString());
      // console.log(remainingIssues);
      // console.log(queries);
    }
    return { request: nextRequest, repeat: repeat, queries: queries };
  }
}

class JsonHandler<U = any> implements rm.IDataHandler<U> {
  json: U;
  constructor() {
    this.json = null;
  }

  add(result: any): rm.IRequest {
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
    this.JiraCloud = new JiraCloud(config.server);
    this.manager.registerServer('jira-cloud', this.JiraCloud);
  }

  jsonList(maxPages: number = 0, listName: string = 'values') {
    return new JsonListHandler(maxPages, listName);
  }

  issueList(numIssues: number) {
    return new IssueListHandler(numIssues);
  }

  json() {
    return new JsonHandler();
  }

  status() {
    return new StatusHandler();
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
    return await this.get(handler, new Map(), ...resourceParts);
  }

  async get<T>(handler: rm.IDataHandler<T>, parameters: rm.Parameters, ...id: string[]) {
    let resource: rm.IResource = {
      server: 'jira-cloud',
      id: id,
      parameters: parameters,
      data: null,
    };
    return await this.manager.get(resource, handler);
  }

  async post<T>(handler: rm.IDataHandler<T>, data: any, parameters: rm.Parameters, ...id: string[]) {
    let resource: rm.IResource = {
      server: 'jira-cloud',
      id: id,
      parameters: parameters,
      data: data,
    };
    return await this.manager.post(resource, handler);
  }

  async getUser() {
    return await this.get(this.json(), new Map(), 'myself');
  }

  async searchUsers(parameters: rm.Parameters) {
    return await this.get(this.json(), parameters, 'user', 'search');
  }

  async getIssue(issue: string) {
    if (!issue) {
      return null;
    }
    return await this.get(this.json(), new Map(), 'issue', issue);
  }

  async getTransitions(issue: string, parameters: rm.Parameters) {
    if (!issue) {
      return null;
    }
    return await this.get(this.json(), parameters, 'issue', issue, 'transitions');
  }

  async postTransition(issue: string, data: any) {
    if (!issue) {
      return null;
    }
    return await this.post(this.status(), data, new Map(), 'issue', issue, 'transitions');
  }

  async getResolutions() {
    return await this.get(this.json(), new Map(), 'resolution');
  }

  async getProject(project: string) {
    if (!project) {
      return null;
    }
    return await this.get(this.json(), new Map(), 'project', project);
  }

  async searchProjects(parameters: rm.Parameters) {
    return await this.get(this.jsonList(), parameters, 'project', 'search');
  }

  async searchIssues(parameters: rm.Parameters, numIssues: number) {
    return await this.get(this.issueList(numIssues), parameters, 'search');
  }

  async getCreateMeta(parameters: rm.Parameters) {
    return await this.get(this.json(), parameters, 'issue', 'createmeta');
  }

  async createIssue(data: any) {
    if (!data) {
      return null;
    }
    return await this.post(this.json(), data, new Map(), 'issue');
  }

  // OLD BB from here
  async getPullrequests(user: string) {
    return await this.get(this.jsonList(), new Map(), 'pullrequests', user);
  }

  async getWorkspaces() {
    return await this.get(this.jsonList(), new Map(), 'workspaces');
  }

  async getMembers(workspace: string) {
    return await this.get(this.jsonList(), new Map(), 'workspaces', workspace, 'members');
  }

  async getPublicRepositories() {
    return await this.get(this.jsonList(), new Map(), 'repositories');
  }

  async getRepositories(workspace: string) {
    return await this.get(this.jsonList(), new Map(), 'repositories', workspace);
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
