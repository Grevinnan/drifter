import fs from 'fs';
import path from 'path';
import tkit from 'terminal-kit';

import { ICacheOptions } from './config';
import IResourceWorker from './resource_worker_i';
import getXdgDirectory from './xdg';

const terminal = tkit.terminal;

export default class Cache implements IResourceWorker {
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

  async getResource(pathParts: string[]): Promise<any> {
    let cachePath = this.getCachePath(pathParts);
    // console.log(cachePath);
    if (!fs.existsSync(cachePath)) {
      this.verbose && terminal(`cache: ${cachePath} does not exist\n`);
      return null;
    }
    let dataPath = path.join(cachePath, 'data');
    if (!fs.existsSync(dataPath)) {
      this.verbose && terminal(`cache: ${dataPath} does not exist\n`);
      return null;
    }
    // TODO: Handle different types of data, not only JSON
    this.verbose && terminal(`reading data from ${dataPath}\n`);

    let data = null;
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (error) {
      terminal.error(`cache: could not parse ${dataPath} : ${error}\n`);
      return null;
    }
    return data;
  }

  async saveResource(pathParts: string[], data: string): Promise<boolean> {
    let cachePath = this.getCachePath(pathParts);
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      this.verbose && terminal(`cache: ${cachePath} created\n`);
    }

    let dataPath = path.join(cachePath, 'data');
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
