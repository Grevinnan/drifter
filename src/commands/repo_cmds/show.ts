import path from 'path';
import yargs from 'yargs';
import getBitBucket, * as bbc from '../../bb_cloud';
import * as ft from '../../format';
import highlight from 'cli-highlight';

import tkit, * as term from 'terminal-kit';
const terminal = tkit.terminal;

class SourceTreeWalker {
  bb: bbc.BitBucket;
  repo: bbc.IRepositoryPath;
  commit: string;
  constructor(bb: bbc.BitBucket, repo: bbc.IRepositoryPath, commit: string) {
    this.bb = bb;
    this.repo = repo;
    this.commit = commit;
  }

  async walkTree(pathParts: string[] = []) {
    let paths = [];
    let sourceFiles = await this.bb.getRepositorySrc(
      this.repo,
      this.commit,
      ...pathParts
    );
    // TODO: consider escaped_path?
    let directoryTasks = [];
    for (let file of sourceFiles) {
      if (file.type === 'commit_file') {
        paths.push(file);
      } else {
        // let directoryPaths = await this.walkTree(file.path.split('/'));
        // paths.push(...directoryPaths);
        directoryTasks.push(this.walkTree(file.path.split('/')));
      }
    }
    let directories = await Promise.all(directoryTasks);
    for (let directoryFiles of directories) {
      paths.push(...directoryFiles);
    }
    return paths;
  }
}

async function walkSourceTree(bb: bbc.BitBucket, repo: bbc.IRepositoryPath) {
  let rootFiles = await bb.getRepositorySrc(repo);
  if (rootFiles.length > 0) {
    let commit: string = rootFiles[0].commit.hash;
    // We fetch the same files again but through another endpoint
    let treeWalker = new SourceTreeWalker(bb, repo, commit);
    return await treeWalker.walkTree([]);
  }
  return null;
}

exports.command = 'show <repository>';
exports.aliases = [];
exports.desc = 'Show repository data';
exports.builder = (yargs: yargs.Argv<{}>) => {
  return yargs
    .positional('repository', {
      describe: 'Repository name/uuid',
      type: 'string',
      default: '',
    })
    .option('f', {
      alias: 'list-files',
      type: 'boolean',
      description: 'List repository files',
      default: false,
    })
    .option('E', {
      alias: 'explore',
      type: 'boolean',
      description: 'Explore repositories files',
      default: false,
    });
};

exports.handler = async (argv: any) => {
  let bb = await getBitBucket(argv);
  // For some reason TS does not understand the type
  let repoId: string = String(argv.repository);
  let repo = await bb.findRepository(repoId);
  if (!repo) {
    terminal.error.red(`Could not find repository ${argv.repository}\n`);
    process.exit();
  }
  argv.verbose && terminal(`found ${repo.uuid} ${repo.full_name}\n`);
  if (argv.f) {
    let srcFiles = await walkSourceTree(bb, {
      workspace: repo.workspace.uuid,
      repository: repo.uuid,
    });
    srcFiles.forEach((file) => terminal(`${file.path}\n`));
  } else if (argv.E) {
    let srcFiles = await walkSourceTree(bb, {
      workspace: repo.workspace.uuid,
      repository: repo.uuid,
    });
    // console.log(srcFiles[0]);
    // console.log(srcFiles[0].links.self.href);
    // console.log(srcFiles[0].commit.links);
    // const i = 8;
    // let content = await bb.getFromUrl(srcFiles[i].links.self.href, bb.string());
    // console.log(srcFiles[i]);
    // let extension = path.extname(srcFiles[i].path).slice(1);

    // terminal(highlight(content, {language: extension}));
    terminal.fullscreen(true);
    // let password = await terminal.inputField({}).promise;
    // terminal(password);
    // @ts-ignore
    let document = terminal.createDocument({});
    // let document = terminal.createDocument({palette: new tkit.Palette()});
    // @ts-ignore
    var layout = new tkit.Layout({
      parent: document,
      // boxChars: 'double',
      layout: {
        id: 'main',
        y: 1,
        widthPercent: 100,
        heightPercent: 100,
        rows: [
          {
            id: 'main_row',
            heightPercent: 100,
            columns: [
              { id: 'files', widthPercent: 30 },
              { id: 'content'},
            ],
          }
        ],
      },
    });
    let items = srcFiles.map(file => {
      return {content: file.path, value: file};
    });
    // @ts-ignore
    let menu = new tkit.ColumnMenu({
      parent: document.elements.files,
      // x: 0,
      // y: 0,
      // width: 30,
      buttonKeyBindings:
          {ENTER: 'submit', CTRL_UP: 'submit', CTRL_DOWN: 'submit'},
      buttonActionKeyBindings: {CTRL_UP: 'up', CTRL_DOWN: 'down'},
      // buttonEvenBlurAttr: { bgColor: '@dark-gray' , color: 'white' , bold: true },
      buttonEvenBlurAttr: { bgColor: terminal.bgDefaultColor(), color: 'white' , bold: true },
      items: items,
      height: srcFiles.length,
    });
    const longText = 'CONTENT MANNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN???\nabcd\nrofl';
    // @ts-ignore
    let textBox = new tkit.TextBox({
    // let textBox = new tkit.Text({
      parent: document.elements.content,
      content: longText.split('\n'),
      scrollable: true,
      // x: 0,
      // y: 0,
      width: 80,
      height: terminal.height,
      wordWrap: true,
      lineWrap: true,
      vScrollbar: true,
    });

    async function onSubmit(file , action ) {
      // console.log(action);
      let content = await bb.getFromUrl(file.links.self.href, bb.string());
      // console.log(srcFiles[i]);
      let extension = path.extname(file.path).slice(1);
      // let formattedContent = highlight(content, {language: extension});
      let formattedContent = content;
      // console.log(formattedContent);
      // textBox.setContent(formattedContent.split('\n'), true);
      textBox.height = content.split('\n').length;
      textBox.setContent(formattedContent);
      textBox.redraw();

      // terminal(highlight(content, {language: extension}));
      terminal.saveCursor() ;
      terminal.restoreCursor() ;
    }
    menu.on( 'submit' , onSubmit ) ;
    terminal.on( 'resize' , ( width , height ) => {
      // console.log('aaaassssssssssssssssssss');
      textBox.height = height;
      // console.log(textBox.height);
      textBox.draw();
    } ) ;

    terminal.hideCursor();
    if (srcFiles.length > 0) {
      menu.focusValue(srcFiles[0]);
    }
  } else {
    terminal(ft.formatRepository(repo));
  }
  // process.exit();
};
