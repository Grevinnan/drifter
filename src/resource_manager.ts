import Config from './config';
import BitBucketAPI from './bitbucket_api';
import Cache from './cache';

export interface IManagerOptions {
  verbose: boolean;
  synchronize: boolean;
  maxPages: number;
}

export default class ResourceManager {
  config: Config;
  options: IManagerOptions;
  bbApi: BitBucketAPI;
  cache: Cache;
  constructor(config: Config, options: IManagerOptions) {
    this.config = config;
    this.options = options;
    this.bbApi = new BitBucketAPI(
      this.config.auth,
      this.options.maxPages,
      this.options.verbose
    );
    this.cache = new Cache({}, this.options.verbose);
  }

  async getResource(...parts: string[]): Promise<any[]> {
    let result = null;
    if (!this.options.synchronize) {
      result = await this.cache.getResource(parts);
    }
    if (!result) {
      result = await this.bbApi.getResource(parts);
      this.cache.saveResource(parts, JSON.stringify(result));
    }
    return result;
  }
}
