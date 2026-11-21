import fs from 'node:fs/promises';
import path from 'node:path';
import { FeInterpreter } from './FeInterpreter.js';
import { CommandHistory, EventBus, LispFormatterStrategy, JsonFormatterStrategy } from '../patterns/designPatterns.js';
import { isErrorPoly } from '../patterns/es2026Compat.js';

export class ReplModel {
  #interpreter;
  #history;
  #events;
  #formatter;
  #sessionVariables = new Map();

  constructor({
    interpreter = new FeInterpreter(),
    history = new CommandHistory(),
    events = new EventBus(),
    formatter = new LispFormatterStrategy(),
  } = {}) {
    this.#interpreter = interpreter;
    this.#history = history;
    this.#events = events;
    this.#formatter = formatter;
  }

  get events() {
    return this.#events;
  }

  get interpreter() {
    return this.#interpreter;
  }

  get history() {
    return this.#history;
  }

  setFormatter(mode) {
    if (mode === 'json') {
      this.#formatter = new JsonFormatterStrategy();
    } else {
      this.#formatter = new LispFormatterStrategy();
    }
    this.#events.emit('formatter:changed', mode);
    return mode;
  }

  format(value) {
    return this.#formatter.format(value);
  }

  evaluateLine(line) {
    const trimmed = String(line).trim();
    if (!trimmed) {
      return { ok: true, value: null, formatted: '', skipped: true };
    }

    this.#history.record(trimmed);

    try {
      const value = this.#interpreter.evalSource(trimmed);
      const formatted = this.format(value);
      const entry = { input: trimmed, value, formatted, timestamp: new Date().toISOString() };
      this.#sessionVariables.set(`$${this.#interpreter.evalCount}`, value);
      this.#events.emit('eval:success', entry);
      return { ok: true, value, formatted, skipped: false };
    } catch (err) {
      const message = isErrorPoly(err) ? `${err.name}: ${err.message}` : String(err);
      this.#events.emit('eval:error', { input: trimmed, error: err, message });
      return { ok: false, error: err, message, skipped: false };
    }
  }

  async loadFile(filePath) {
    const resolved = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(resolved, 'utf8');
    const result = this.evaluateLine(content);
    this.#events.emit('file:loaded', { path: resolved, ok: result.ok });
    return result;
  }

  async saveHistory(filePath) {
    const resolved = path.resolve(process.cwd(), filePath);
    const lines = this.#history.getAll().join('\n') + '\n';
    await fs.writeFile(resolved, lines, 'utf8');
    this.#events.emit('history:saved', { path: resolved, count: this.#history.getAll().length });
    return resolved;
  }

  getStats() {
    return {
      evalCount: this.#interpreter.evalCount,
      historyCount: this.#history.getAll().length,
      sessionEntries: this.#sessionVariables.size,
      symbols: this.#interpreter.globalEnv.keys(),
    };
  }
}
