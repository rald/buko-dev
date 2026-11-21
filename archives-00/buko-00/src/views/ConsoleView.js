export class ConsoleView {
  #out;
  #err;

  constructor({ out = process.stdout, err = process.stderr } = {}) {
    this.#out = out;
    this.#err = err;
  }

  showBanner() {
    this.#out.write('rxi/fe Node.js REPL (ES2026 | OOP | MVC | TDD)\n');
    this.#out.write('Meta-commands: :help, :quit, :format <lisp|json>, :load <file>, :save <file>, :stats, :history\n');
  }

  showHelp() {
    this.#out.write([
      'Available REPL meta-commands:',
      '  :help             Show this help message',
      '  :quit             Exit the REPL session',
      '  :format lisp|json Switch output formatting strategy',
      '  :load <file>      Evaluate a .fe script file',
      '  :save <file>      Save command history to a file',
      '  :stats            Display interpreter & session metrics',
      '  :history          Show evaluated inputs in this session',
    ].join('\n') + '\n');
  }

  showResult(formatted) {
    if (formatted !== '') {
      this.#out.write(`${formatted}\n`);
    }
  }

  showError(message) {
    this.#err.write(`${message}\n`);
  }

  showInfo(message) {
    this.#out.write(`${message}\n`);
  }
}
