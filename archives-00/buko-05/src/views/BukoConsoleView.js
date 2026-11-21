export class BukoConsoleView {
  #out;
  #err;

  constructor({ out = process.stdout, err = process.stderr } = {}) {
    this.#out = out;
    this.#err = err;
  }

  showBanner() {
    this.#out.write('Buko Lisp Node.js REPL (rxi/fe lineage | ES2026 | OOP | MVC | TDD)\n');
    this.#out.write('Meta-commands: :help, :quit, :format <buko|json>, :load <file>, :save <file>, :stats, :history\n');
  }

  showHelp() {
    this.#out.write([
      'Available Buko Lisp REPL meta-commands:',
      '  :help             Show this help message',
      '  :quit             Exit the Buko Lisp REPL session',
      '  :format buko|json Switch output formatting strategy',
      '  :load <file>      Evaluate a .buko or .fe script file',
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
