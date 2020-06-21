import Config from './config';
import BitBucketAPI from './bitbucket_api';
import Cache from './cache';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export interface IManagerOptions {
  verbose: boolean;
  forceSynchronize: boolean;
  maxPages: number;
}

type ResourceId = string[];
const DEFAULT_CACHE_FILTER: ResourceId[] = [
  ['workspaces'],
  ['repositories', '*'],
  ['repositories', '*', '*', 'src', '**'],
];

export default class ResourceManager {
  config: Config;
  options: IManagerOptions;
  bbApi: BitBucketAPI;
  cache: Cache;
  cacheFilter: ResourceId[];
  constructor(config: Config, options: IManagerOptions) {
    this.config = config;
    this.options = options;
    this.bbApi = new BitBucketAPI(
      this.config.auth,
      this.options.maxPages,
      this.options.verbose
    );
    this.cache = new Cache({}, this.options.verbose);
    this.cacheFilter = DEFAULT_CACHE_FILTER;
  }

  isFiltered(resource: ResourceId) {
    for (let filter of this.cacheFilter) {
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

  async getResource(...resourceId: ResourceId): Promise<any[]> {
    let result = null;
    // Try to get the resource from the cache if applicable
    if (!this.options.forceSynchronize && this.isFiltered(resourceId)) {
      this.options.verbose && terminal.yellow(`rm: filtered ${resourceId.join('/')}\n`);
      result = await this.cache.getResource(resourceId);
    }
    // Otherwise just try to get it from the server
    if (!result) {
      result = await this.bbApi.getResource(resourceId);
      this.cache.saveResource(resourceId, JSON.stringify(result));
    }
    return result;
  }
}
