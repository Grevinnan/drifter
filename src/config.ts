import fs from 'fs';
import path from 'path';
import tkit from 'terminal-kit';
import getXdgDirectory from './xdg';
import * as tu from './terminal_util';

const terminal = tkit.terminal;

export interface IAuth {
  username: string;
  password: string;
}

export interface ICacheOptions {}

export interface IOptions {
  cache?: ICacheOptions;
}

export default class Config {
  configDirectory: string;
  configPath: string;
  auth: IAuth;
  options: IOptions;
  reviewers?: any;

  constructor() {
    this.configDirectory = getXdgDirectory('config', true);
    this.configPath = path.join(this.configDirectory, 'config.json');
    this.auth = null;
    this.options = {};
  }

  checkConfig(): boolean {
    if (fs.existsSync(this.configPath)) {
      let configObject = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      this.auth = configObject.auth;
      this.reviewers = configObject.reviewers;
      return true;
    } else {
      return false;
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
      terminal('Please enter your username: ');
      let username = await terminal.inputField({}).promise;
      terminal(
        '\nPlease enter your API key (not password, see documentation): '
      );
      let password = await terminal.inputField({}).promise;
      this.auth = {
        username: username,
        password: Buffer.from(`${username}:${password}`).toString('base64'),
      };
      let configData = {
        auth: this.auth,
        options: {},
      };
      fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 4));
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
}
