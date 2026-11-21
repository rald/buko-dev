import readline from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import { BukoReplModel } from '../models/BukoReplModel.js';
import { BukoConsoleView } from '../views/BukoConsoleView.js';

export class BukoReplController {
  #model;
  #view;
  #input;
  #output;
  #running = false;

  constructor({
    model = new BukoReplModel(),
    view = new BukoConsoleView(),
    input = defaultInput,
    output = defaultOutput,
  } = {}) {
    this.#model = model;
    this.#view = view;
    this.#input = input;
    this.#output = output;
  }

  get model() {
    return this.#model;
  }

  get view() {
    return this.#view;
  }

  async handleLine(line) {
    const trimmed = String(line).trim();
    if (!trimmed) {
      return { continueLoop: true };
    }

    if (trimmed.startsWith(':')) {
      return this.#handleMetaCommand(trimmed);
    }

    const res = this.#model.evaluateLine(trimmed);
    if (res.ok) {
      if (!res.skipped) {
        this.#view.showResult(res.formatted);
      }
    } else {
      this.#view.showError(res.message);
    }
    return { continueLoop: true };
  }

  async #handleMetaCommand(cmdLine) {
    const parts = cmdLine.split(/\s+/);
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case ':quit':
      case ':q':
      case ':exit':
        this.#running = false;
        return { continueLoop: false };

      case ':help':
      case ':h':
        this.#view.showHelp();
        return { continueLoop: true };

      case ':format': {
        if (arg !== 'buko' && arg !== 'json') {
          this.#view.showError('Usage: :format <buko|json>');
          return { continueLoop: true };
        }
        this.#model.setFormatter(arg);
        this.#view.showInfo(`Formatter set to ${arg}`);
        return { continueLoop: true };
      }

      case ':load': {
        if (!arg) {
          this.#view.showError('Usage: :load <filepath>');
          return { continueLoop: true };
        }
        try {
          const fileRes = await this.#model.loadFile(arg);
          if (fileRes.ok) {
            if (!fileRes.skipped) this.#view.showResult(fileRes.formatted);
          } else {
            this.#view.showError(fileRes.message);
          }
        } catch (err) {
          this.#view.showError(`Failed to load file: ${err.message}`);
        }
        return { continueLoop: true };
      }

      case ':save': {
        if (!arg) {
          this.#view.showError('Usage: :save <filepath>');
          return { continueLoop: true };
        }
        try {
          const savedPath = await this.#model.saveHistory(arg);
          this.#view.showInfo(`History saved to ${savedPath}`);
        } catch (err) {
          this.#view.showError(`Failed to save history: ${err.message}`);
        }
        return { continueLoop: true };
      }

      case ':stats': {
        const stats = this.#model.getStats();
        this.#view.showInfo(JSON.stringify(stats, null, 2));
        return { continueLoop: true };
      }

      case ':history': {
        const hist = this.#model.history.getAll();
        this.#view.showInfo(hist.length ? hist.map((h, i) => `${i + 1}: ${h}`).join('\n') : '(empty)');
        return { continueLoop: true };
      }

      default:
        this.#view.showError(`Unknown meta-command: ${cmd}. Type :help for commands.`);
        return { continueLoop: true };
    }
  }

  async run() {
    this.#running = true;
    this.#view.showBanner();

    const rl = readline.createInterface({
      input: this.#input,
      output: this.#output,
      prompt: 'buko> ',
    });

    try {
      rl.prompt();
      for await (const line of rl) {
        const { continueLoop } = await this.handleLine(line);
        if (!continueLoop || !this.#running) {
          break;
        }
        rl.prompt();
      }
    } finally {
      rl.close();
    }
  }
}
