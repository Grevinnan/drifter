import { IAuth } from './config';
import sa from 'superagent';
import IResourceWorker from './resource_worker_i';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

export default class BitBucketAPI implements IResourceWorker {
  auth: IAuth;
  maxPages: number;
  baseUrl: string;
  verbose: boolean;
  constructor(auth: IAuth, maxPages: number, verbose: boolean = false) {
    this.auth = auth;
    this.maxPages = maxPages;
    this.verbose = verbose;
    this.baseUrl = 'https://api.bitbucket.org/2.0';
  }

  setAuthorization(request: sa.SuperAgentRequest) {
    request
      .set('Content-Type', 'application/json')
      .set('Authorization', `Basic ${this.auth.password}`);
    return request;
  }

  async fetchValues(url: string, maxPages: number) {
    let values = [];
    let pageIndex = 0;
    let currentRequest = this.setAuthorization(sa.get(url));
    while (pageIndex < maxPages) {
      let result = await currentRequest;
      values.push(...result.body.values);
      let nextPage = result.body.next;
      if (nextPage) {
        currentRequest = this.setAuthorization(sa.get(nextPage));
      } else {
        break;
      }
      pageIndex += 1;
    }
    return values;
  }

  async getResource(pathParts: string[]): Promise<any> {
    let completePath = pathParts.join('/');
    let url = `${this.baseUrl}/${completePath}/`;
    this.verbose && terminal(`bb-api: fetching ${url}\n`);
    return await this.fetchValues(url, this.maxPages);
  }

  async saveResource(pathParts: string[], data: string): Promise<boolean> {
    // TODO
    return false;
  }
}
