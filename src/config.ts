import fs from 'fs';
import path from 'path';
import tkit from 'terminal-kit';
import getXdgDirectory from './xdg';
import * as tu from './terminal_util';

const terminal = tkit.terminal;

export interface IServer {
  url: string;
  username: string;
  authorization: string;
}

export interface ICacheOptions {}

export enum EValueMode {
  Include = "include",
  Exclude = "exclude",
}

export interface IStatusConfig {
  projects: string[];
  projectsMode: EValueMode;
  statuses: string[];
  statusesMode: EValueMode;
}

export function createDefaultStatusConfig() : IStatusConfig {
  return {
    projects: [],
    projectsMode: EValueMode.Include,
    statuses: [],
    statusesMode: EValueMode.Include,
  };
}

export default class Config {
  configDirectory: string;
  configPath: string;
  config: any;

  constructor() {
    this.configDirectory = getXdgDirectory('config', true);
    this.configPath = path.join(this.configDirectory, 'config.json');
    this.config = null;
  }

  getServer(): IServer {
    return this.config.server;
  }

  getStatusConfigs(): Map<string, IStatusConfig> {
    return this.config.statusConfigs;
  }

  checkConfig(): boolean {
    if (fs.existsSync(this.configPath)) {
      this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      return true;
    } else {
      return false;
    }
  }

  writeConfig() {
    if (this.config) {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 4));
    } else {
      terminal.error('Can not write an empty config\n');
    }
  }

  async setupConfig() {
    let configLoaded = this.checkConfig();
    if (!configLoaded) {
      terminal(
        'Configuration could not be loaded, do you wish to run configuration? [y/n]\n'
      );
      let proceed = await terminal.yesOrNo(tu.yesOrNoKeyMaps).promise;
      if (!proceed) {
        return false;
      }
      // First create the configuration directory
      terminal('Please enter the JIRA server URL: ');
      let url = await terminal.inputField({}).promise;
      terminal('\nPlease enter your username: ');
      let username = await terminal.inputField({}).promise;
      terminal('\nPlease enter your API key (not password, see documentation): ');
      let apiKey = await terminal.inputField({}).promise;
      const server : IServer = {
          url: url.replace(/\/+$/, ''),
          username: username,
          authorization: Buffer.from(`${username}:${apiKey}`).toString('base64'),
      };
      const defaultStatus = createDefaultStatusConfig();
      const configData = {
        server: server,
        statusConfigs: {
          default: defaultStatus,
        },
        aliases: {},
      };
      this.config = configData;
      this.writeConfig();
      configLoaded = true;
    }

    return configLoaded;
  }

  async clearConfig() {
    if (!fs.existsSync(this.configPath)) {
      console.log('There is no stored data. Skipping.');
    } else {
      terminal('Are you sure?\n');
      let clearConfig = await terminal.yesOrNo(tu.yesOrNoKeyMaps).promise;
      if (clearConfig) {
        fs.unlinkSync(this.configPath);
        terminal('Configuration deleted successfully!\n');
      }
    }
  }

  getStatusConfig(name: string) : IStatusConfig {
    return this.config.statusConfigs[name];
  }

  setStatusConfig(name: string, config: IStatusConfig) {
    this.config.statusConfigs[name] = config;
    this.writeConfig();
  }
}
