import fs from 'fs';
import { isBinary } from 'istextorbinary';
import _ from 'lodash';
import path from 'path';
import tkit from 'terminal-kit';

import { ICacheOptions } from './config';
import * as ds from './directory_size';
import * as tu from './terminal_util';
import getXdgDirectory from './xdg';

const terminal = tkit.terminal;

export default class Cache {
  cacheDirectory: string;
  options: ICacheOptions;
  verbose: boolean;
  constructor(options: ICacheOptions, verbose = false) {
    this.cacheDirectory = getXdgDirectory('cache', true);
    this.options = options;
    this.verbose = verbose;
  }

  getCachePath(pathParts: string[]): string {
    let paths: string[] = [];
    pathParts.slice(0, -1).forEach((p) => paths.push(p, 'a'));
    paths.push(pathParts[pathParts.length - 1]);
    return path.join(this.cacheDirectory, ...paths);
  }

  getCacheSize(): number {
    return ds.getTotalSize(this.cacheDirectory);
  }

  async clear() {
    terminal(`Are you sure you want to clear the cache ${this.cacheDirectory}?\n`);
    let clearCache = await terminal.yesOrNo(tu.yesOrNoKeyMaps).promise;
    if (clearCache) {
      await fs.promises.rmdir(this.cacheDirectory, { recursive: true });
      terminal(`deleted ${this.cacheDirectory}\n`);
    }
  }

  async getResource(pathParts: string[], filename: string): Promise<any> {
    let cachePath = this.getCachePath(pathParts);
    if (!fs.existsSync(cachePath)) {
      this.verbose && terminal(`cache: ${cachePath} does not exist\n`);
      return null;
    }
    let dataPath = path.join(cachePath, filename);
    if (!fs.existsSync(dataPath)) {
      this.verbose && terminal(`cache: ${dataPath} does not exist\n`);
      return null;
    }
    // TODO: Handle different types of data, not only JSON
    this.verbose && terminal(`reading data from ${dataPath}\n`);

    let data = null;
    try {
      data = fs.readFileSync(dataPath);
      if (!isBinary(null, data)) {
        data = new TextDecoder().decode(data);
      }
    } catch (error) {
      terminal.error(`cache: could not parse ${dataPath} : ${error}\n`);
      return null;
    }
    return data;
  }

  async saveResource(
    pathParts: string[],
    data: string,
    filename: string
  ): Promise<boolean> {
    let cachePath = this.getCachePath(pathParts);
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      this.verbose && terminal(`cache: ${cachePath} created\n`);
    }

    let dataPath = path.join(cachePath, filename);
    this.verbose && terminal(`cache: saving data to ${dataPath}\n`);

    // TODO: "smart" sync, not only raw overwriting (at least for JSON)
    try {
      fs.writeFileSync(dataPath, data);
    } catch (error) {
      terminal.error(`cache: could not write to ${dataPath} : ${error}\n`);
      return false;
    }

    return true;
  }
}
