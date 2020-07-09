import path from 'path';
import yargs from 'yargs';
import getBitBucket, * as bbc from '../../bb_cloud';
import * as ft from '../../format';
import highlight, * as hl from 'cli-highlight';

import tkit, * as term from 'terminal-kit';
const terminal = tkit.terminal;

const TERMINAL_FORMAT = {
  'blue': '^b',
  'cyan': '^c',
  'red': '^r',
  'green': '^g',
  'yellow': '^y',
  'grey': '^K',
  'bold': '^+',
  'underline': '^_',
  'italic': '^/',
};

function tcolor(color: string) {
  return function(text: string) {
    return `${TERMINAL_FORMAT[color]}${text}^:`;
  }
}

let theme: hl.Theme =
    {
      keyword: tcolor('blue'),
      built_in: tcolor('cyan'),
      type: tcolor('cyan'),
      literal: tcolor('blue'),
      number: tcolor('green'),
      regexp: tcolor('red'),
      string: tcolor('red'),
      subst: hl.plain,
      symbol: hl.plain,
      class: tcolor('blue'),
      function: tcolor('yellow'),
      title: hl.plain,
      params: hl.plain,
      comment: tcolor('green'),
      doctag: tcolor('green'),
      meta: tcolor('grey'),
      'meta-keyword': hl.plain,
      'meta-string': hl.plain,
      section: hl.plain,
      tag: tcolor('grey'),
      name: tcolor('blue'),
      'builtin-name': hl.plain,
      attr: tcolor('cyan'),
      attribute: hl.plain,
      variable: hl.plain,
      bullet: hl.plain,
      code: hl.plain,
      emphasis: tcolor('italic'),
      strong: tcolor('bold'),
      formula: hl.plain,
      link: tcolor('underline'),
      quote: hl.plain,
      'selector-tag': hl.plain,
      'selector-id': hl.plain,
      'selector-class': hl.plain,
      'selector-attr': hl.plain,
      'selector-pseudo': hl.plain,
      'template-tag': hl.plain,
      'template-variable': hl.plain,
      addition: tcolor('green'),
      deletion: tcolor('red'),
      default: hl.plain,
    }

function
escapeCaret(content: string) {
  let escapedChars = [];
  for (let c of content) {
    if (c === '^') {
      escapedChars.push('^^');
    } else {
      escapedChars.push(c);
    }
  }
  return escapedChars.join('');
}

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
    let sourceFiles =
        await this.bb.getRepositorySrc(this.repo, this.commit, ...pathParts);
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
    terminal.fullscreen(true);
    // @ts-ignore
    let document = terminal.createDocument({});
    // @ts-ignore
    var layout = new tkit.Layout({
      parent: document,
      layout: {
        id: 'main',
        y: 1,
        widthPercent: 100,
        heightPercent: 100,
        rows: [{
          id: 'main_row',
          heightPercent: 99,
          columns: [
            {id: 'files', widthPercent: 30},
            {id: 'content'},
          ],
        }],
      },
    });
    let items = srcFiles.map(file => {
      return {content: file.path, value: file};
    });
    // @ts-ignore
    let menu = new tkit.ColumnMenu({
      parent: document.elements.files,
      buttonKeyBindings:
          {ENTER: 'submit', CTRL_UP: 'submit', CTRL_DOWN: 'submit'},
      buttonActionKeyBindings: {CTRL_UP: 'up', CTRL_DOWN: 'down'},
      buttonEvenBlurAttr:
          {bgColor: terminal.bgDefaultColor(), color: 'white', bold: true},
      items: items,
      autoWidth: true,
      autoHeight: true,
    });

    // @ts-ignore
    let debugBox = new tkit.TextBox({
      parent: document,
      content: 'DEBUG_BOX',
      contentHasMarkup: 'ansi',
      attr: {bgColor: terminal.bgDefaultColor()},
      x: 0,
      y: 0,
      width: 80,
      height: 1,
      wrap: true,
      wordWrap: true,
      lineWrap: true,
    });
    // @ts-ignore
    let textBox = new tkit.TextBox({
      parent: document.elements.content,
      content: '',
      scrollable: true,
      vScrollBar: true,
      wordWrap: true,
      autoWidth: true,
      autoHeight: true,
      attr: {bgColor: terminal.bgDefaultColor()},
    });

    async function onSubmit(file, action) {
      // console.log(action);
      let content = await bb.getFromUrl(file.links.self.href, bb.string());
      let extension = path.extname(file.path).slice(1);
      content = escapeCaret(content);
      let formattedContent = content;
      if (hl.supportsLanguage(extension)) {
        formattedContent = highlight(
            content, {language: extension, theme: theme, ignoreIllegals: true});
      }
      textBox.setContent(formattedContent, true);
      textBox.scrollTo(0, 0);
      document.giveFocusTo(textBox);
    }
    menu.on('submit', onSubmit);
    textBox.on('key', function(key: string) {
      let handled = false;
       if (key === 'TAB') {
        document.giveFocusTo(menu);
        handled = true;
      }
      return handled;
    });

    terminal.hideCursor(true);
    if (srcFiles.length > 0) {
      menu.focusValue(srcFiles[0]);
    }
  } else {
    terminal(ft.formatRepository(repo));
  }
  // process.exit();
};
