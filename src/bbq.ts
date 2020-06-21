#!/usr/bin/env node

'use strict';

import yargs from 'yargs';
import Config from './config';
import ResourceManager, { IManagerOptions } from './resource_manager';

import tkit from 'terminal-kit';
const terminal = tkit.terminal;

terminal.on('key', (key: string) => {
  if (key === 'CTRL_C' || key === 'CTRL_D') {
    terminal.grabInput(false);
    process.exit();
  }
});

async function getConfig() {
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

class BitBucket {
  config: Config;
  baseUrl: string;
  manager: ResourceManager;
  constructor(config: Config, options: IManagerOptions) {
    this.config = config;
    this.baseUrl = 'https://api.bitbucket.org/2.0';
    this.manager = new ResourceManager(this.config, options);
  }

  async getWorkspaces() {
    return await this.manager.getResource('workspaces');
  }

  async getPublicRepositories() {
    return await this.manager.getResource('repositories');
  }

  async getRepositories(workspace: string) {
    return await this.manager.getResource('repositories', workspace);
  }
}

function getOptions(argv): IManagerOptions {
  const managerOptions: IManagerOptions = {
    verbose: argv.verbose,
    synchronize: argv.synchronize,
    maxPages: argv.maxPages,
  };
  return managerOptions;
}

yargs
  .scriptName('bbq')
  .version('v0.0.1')
  .strict(true)
  .demandCommand()
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false,
  })
  .option('max-pages', {
    alias: 'm',
    type: 'number',
    description: 'The maximum number of pages to fetch',
    default: 10,
  })
  .option('synchronize', {
    alias: 's',
    type: 'boolean',
    description: 'Will force synchronization with the server',
    default: false,
  })
  .command(
    ['ws', 'workspaces'],
    'Operations on workspaces',
    (yargs) => {
      yargs.option('list', {
        alias: 'l',
        type: 'boolean',
        description: 'List available workspaces',
        default: false,
      });
    },
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv));
      if (argv.list) {
        let values = await bb.getWorkspaces();
        let slugs = values.map((ws) => ws.slug);
        slugs.forEach((slug) => terminal(`${slug}\n`));
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  )
  .command(
    ['rp', 'repositories'],
    'Operations on repositories',
    (yargs) => {
      yargs.option('list', {
        alias: 'l',
        type: 'boolean',
        description: 'List your repositories',
        default: false,
      });
      yargs.option('public', {
        alias: 'p',
        type: 'boolean',
        description: 'List public repositories',
        default: false,
      });
    },
    async (argv) => {
      let config = await getConfig();
      let bb = new BitBucket(config, getOptions(argv));
      if (argv.public) {
        let values = await bb.getPublicRepositories();
        let names = values.map((ws) => ws.full_name);
        names.forEach((name) => terminal(`${name}\n`));
      }
      if (argv.list) {
        let workspaceIds = (await bb.getWorkspaces()).map((ws) => ws.uuid);
        for (let uuid of workspaceIds) {
          let repositories = await bb.getRepositories(uuid);
          let repoNames = repositories.map((repo) => repo.full_name);
          repoNames.forEach((repo) => terminal(`${repo}\n`));
        }
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  )
  .command(
    ['cg', 'config'],
    'Handle your configuration',
    (yargs) => {
      yargs.option('clear', {
        alias: 'c',
        type: 'boolean',
        description: 'Clear your configuration',
        default: false,
      });
    },
    async (argv) => {
      let config = await getConfig();
      if (argv.clear) {
        await config.clearConfig();
      } else {
        yargs.showHelp();
      }
      process.exit();
    }
  ).argv;
