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

const BBCloudCacheFilter: rm.ResourceId[] = [
  ['workspaces'],
  ['repositories', '*'],
  ['repositories', '*', '*', 'src', '**'],
];

class BitBucketCloud implements rm.IServer {
  auth: IAuth;
  url: string;
  cachePaths: rm.ResourceId[];
  constructor(auth: IAuth) {
    this.auth = auth;
    this.url = 'https://api.bitbucket.org/2.0';
    this.cachePaths = BBCloudCacheFilter;
  }
  setAuthorization(request: sa.SuperAgentRequest): sa.SuperAgentRequest {
    request
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${this.auth.password}`);
    return request;
  }
}

class JsonListHandler<U = any> implements rm.IDataHandler<U[]> {
  list: U[];
  pageIndex: number;
  maxPages: number;
  constructor(maxPages: number) {
    this.list = [];
    this.pageIndex = 0;
    this.maxPages = maxPages;
  }

  add(result: any): sa.SuperAgentRequest {
    let nextRequest: sa.SuperAgentRequest = null;
    this.list.push(...result.body.values);
    this.pageIndex += 1;
    let nextPage = result.body.next;
    if (nextPage && this.pageIndex < this.maxPages) {
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

export class BitBucket {
  config: Config;
  maxPages: number;
  manager: ResourceManager;
  constructor(config: Config, options: rm.IManagerOptions, maxPages: number) {
    this.config = config;
    this.maxPages = maxPages;
    this.manager = new ResourceManager(options);
    this.manager.registerServer('bb-cloud', new BitBucketCloud(config.auth));
  }

  async get(...id: string[]) {
    let resource: rm.IResource = {
      server: 'bb-cloud',
      id: id,
    };
    return await this.manager.get(resource, new JsonListHandler(this.maxPages));
  }

  async getWorkspaces() {
    return await this.get('workspaces');
  }

  async getPublicRepositories() {
    return await this.get('repositories');
  }

  async getRepositories(workspace: string) {
    return await this.get('repositories', workspace);
  }

  async getRepositorySrc(repo: IRepositoryPath, ...filePath: string[]) {
    return await this.get(
      'repositories',
      repo.workspace,
      repo.repository,
      'src',
      ...filePath
    );
  }

  async findRepository(repository: string): Promise<any> {
    let workspaces = await this.getWorkspaces();
    for (let workspace of workspaces) {
      let repositories = await this.getRepositories(workspace.uuid);
      for (let repo of repositories) {
        if (repo.full_name === repository || repo.uuid === repository) {
          return repo;
        }
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

export default async function getBitBucket(argv) : Promise<BitBucket> {
  let config = await getConfig();
  return new BitBucket(config, getOptions(argv), argv.m);
}
