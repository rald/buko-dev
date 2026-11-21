#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BukoReplController } from './controllers/BukoReplController.js';
import { BukoReplModel } from './models/BukoReplModel.js';
import { BukoConsoleView } from './views/BukoConsoleView.js';

function printUsage(view) {
  view.showInfo([
    'Usage:',
    '  buko                          Start interactive REPL',
    '  buko <script.buko> [args...]  Run a Buko Lisp script file with arguments',
    '  buko -e "<expr>"              Evaluate an inline Buko Lisp expression',
    '  buko -v | --version           Show version',
    '  buko -h | --help              Show this help',
  ].join('\n'));
}

export async function runCli(argv = process.argv.slice(2)) {
  const view = new BukoConsoleView();

  if (!Array.isArray(argv) || argv.length === 0) {
    const controller = new BukoReplController({ view });
    await controller.run();
    return;
  }

  const first = argv[0];

  if (first === '-h' || first === '--help') {
    printUsage(view);
    return;
  }

  if (first === '-v' || first === '--version') {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkgRaw = await fs.readFile(pkgUrl, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    view.showInfo(pkg.version);
    return;
  }

  if (first === '-e' || first === '--eval') {
    const expr = argv[1];
    if (expr === undefined) {
      view.showError('Error: -e / --eval requires an expression argument');
      process.exitCode = 1;
      return;
    }
    const model = new BukoReplModel();
    model.interpreter.globalEnv.define('argv', argv.slice(2));
    model.interpreter.globalEnv.define('*args*', argv.slice(2));
    const res = model.evaluateLine(expr);
    if (!res.ok) {
      view.showError(res.message);
      process.exitCode = 1;
      return;
    }
    if (!res.skipped && res.formatted !== '') {
      view.showResult(res.formatted);
    }
    return;
  }

  if (first.startsWith('-')) {
    view.showError(`Unknown option: ${first}`);
    printUsage(view);
    process.exitCode = 1;
    return;
  }

  const scriptPath = path.resolve(process.cwd(), first);
  const scriptArgs = argv.slice(1);
  const model = new BukoReplModel();
  model.interpreter.globalEnv.define('argv', scriptArgs);
  model.interpreter.globalEnv.define('*args*', scriptArgs);

  try {
    const content = await fs.readFile(scriptPath, 'utf8');
    const res = model.evaluateLine(content);
    if (!res.ok) {
      view.showError(res.message);
      process.exitCode = 1;
    }
  } catch (err) {
    view.showError(`Failed to run script '${first}': ${err.message}`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  await runCli(process.argv.slice(2));
}
