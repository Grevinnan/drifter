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

let theme: hl.Theme = {
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

function escapeCaret(content: string) {
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
    // terminal("^ggrön^ ^rröd^\n");
    // process.exit();
    // console.log(srcFiles[0]);
    // console.log(srcFiles[0].links.self.href);
    // console.log(srcFiles[0].commit.links);
    // const i = 8;
    // let content = await bb.getFromUrl(srcFiles[i].links.self.href,
    // bb.string()); console.log(srcFiles[i]); let extension =
    // path.extname(srcFiles[i].path).slice(1);

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
        y: 2,
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
      // x: 0,
      // y: 0,
      // width: 30,
      buttonKeyBindings:
          {ENTER: 'submit', CTRL_UP: 'submit', CTRL_DOWN: 'submit'},
      buttonActionKeyBindings: {CTRL_UP: 'up', CTRL_DOWN: 'down'},
      // buttonEvenBlurAttr: { bgColor: '@dark-gray' , color: 'white' , bold:
      // true },
      buttonEvenBlurAttr:
          {bgColor: terminal.bgDefaultColor(), color: 'white', bold: true},
      items: items,
      height: srcFiles.length,
    });
    // @ts-ignore
    let debugBox = new tkit.TextBox({
      parent: document,
      // content: 'DEBUG_BOX',
      content: highlight('let jaha = 1;\nconst rofl = "pollo";', {language: 'js'}),
      contentHasMarkup: 'ansi' ,
      // disabled: true,
      attr: {bgColor: terminal.bgDefaultColor()},
      x: 0,
      y: 0,
      width: 80,
      height: 2,
      // height: terminal.height,
      wrap: true,
      wordWrap: true,
      lineWrap: true,
    });
    // @ts-ignore
    let textBox = new tkit.Text({
      parent: document.elements.content,
      content: '',
      attr: {bgColor: terminal.bgDefaultColor()},
    });
    // debugBox.setContent(`${textBox.inputDst.dst.width}`);
    // debugBox.setContent(`${textBox.inputDst.width}`);
    // console.log(textBox);
    // process.exit();
    let lines = null;
    let index = 0;
    let contentWidth = textBox.inputDst.width;
    let contentHeight = textBox.inputDst.height;

    async function onSubmit(file, action) {
      // console.log(action);
      let content = await bb.getFromUrl(file.links.self.href, bb.string());
      // console.log(srcFiles[i]);
      let extension = path.extname(file.path).slice(1);
      // let start = process.hrtime();
      content = escapeCaret(content);
      // let diff = process.hrtime(start);
      // debugBox.setContent(`${diff}`);
      let formattedContent =
          highlight(content, {language: extension, theme: theme});
      // let formattedContent =
      //     highlight(content, {language: extension});
      // let formattedContent = content;
      // console.log(formattedContent);
      // textBox.setContent(formattedContent.split('\n'), true);
      // textBox.height = content.split('\n').length;
      let rawLines = formattedContent.split('\n');
      lines = [];
      let lineWidth = contentWidth;
      // debugBox.setContent(`${lineWidth}`);
      for (let line of rawLines) {
        if (line.length > lineWidth) {
          // debugBox.setContent(`${lineWidth} ${line.length}`);
          let shortened = line.slice(0, lineWidth);
          lines.push(shortened);
          let overflow = line.slice(lineWidth);
          while (overflow > lineWidth) {
            let extraLine = overflow.slice(0, lineWidth);
            lines.push(extraLine);
            overflow = overflow.slice(lineWidth);
          }
          // debugBox.setContent(overflow);
          if (overflow.length > 0) {
            lines.push(overflow);
          }
        } else {
          lines.push(line);
        }
      }
      index = 0;
      // debugBox.setContent(contentHeight);
      textBox.setContent(lines.slice(0, contentHeight), true);
      document.giveFocusTo(textBox);
    }
    menu.on('submit', onSubmit);
    textBox.on('key', function(key) {
      let handled = false;
      // debugBox.setContent(`tb ${key}`);
      debugBox.setContent(highlight('let jaha = 1;\nconst rofl = "";', {language: 'js'}), true);
      if (!lines) {
        return handled;
      }
      if (key === 'j' || key === 'DOWN') {
        index += 1;
        if (index >= lines.length) {
          index = lines.length - 1;
        }
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
        handled = true;
      } else if (key === 'k' || key === 'UP') {
        index -= 1;
        index = index < 0 ? 0 : index;
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
        handled = true;
      } else if (key === 'PAGE_DOWN') {
        index += contentHeight;
        if (index >= lines.length) {
          index = lines.length - 1;
        }
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
        handled = true;
      } else if (key === 'PAGE_UP') {
        index -= contentHeight;
        index = index < 0 ? 0 : index;
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
        handled = true;
      } else if (key === 'TAB') {
        document.giveFocusTo(menu);
        handled = true;
      }
      return handled;
    });
    terminal.on('mouse', function(name, data) {
      // debugBox.setContent(JSON.stringify(document.focusElement));
      if (name === 'MOUSE_WHEEL_UP') {
        index -= 1;
        index = index < 0 ? 0 : index;
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
      } else if (name === 'MOUSE_WHEEL_DOWN') {
        index += 1;
        if (index >= lines.length) {
          index = lines.length - 1;
        }
        let currentLines = lines.slice(index, index + contentHeight);
        textBox.setContent(currentLines, true);
      }
    });
    terminal.on('resize', (width, height) => {
      contentWidth = textBox.inputDst.width;
      contentHeight = textBox.inputDst.height;
      let currentLines = lines.slice(index, index + contentHeight);
      textBox.setContent(currentLines, true);
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
