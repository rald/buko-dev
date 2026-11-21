#!/usr/bin/env node

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

async function loadNodeModules() {
  if (isBrowser) return null;
  const [fsMod, pathMod, rlMod, urlMod, procMod] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('node:readline/promises'),
    import('node:url'),
    import('node:process'),
  ]);
  return {
    fs: fsMod.default,
    path: pathMod.default,
    readline: rlMod.default,
    pathToFileURL: urlMod.pathToFileURL,
    stdin: procMod.stdin,
    stdout: procMod.stdout,
    stderr: procMod.stderr,
    process: procMod.default,
  };
}

export function getOrInsertPoly(map, key, defaultValue) {
  if (typeof map.getOrInsert === 'function') {
    return map.getOrInsert(key, defaultValue);
  }
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }
  return map.get(key);
}

export function getOrInsertComputedPoly(map, key, computeFn) {
  if (typeof map.getOrInsertComputed === 'function') {
    return map.getOrInsertComputed(key, computeFn);
  }
  if (!map.has(key)) {
    map.set(key, computeFn());
  }
  return map.get(key);
}

export function sumPrecisePoly(values) {
  if (typeof Math.sumPrecise === 'function') {
    return Math.sumPrecise(values);
  }
  let sum = 0.0;
  let c = 0.0;
  for (const v of values) {
    const x = Number(v);
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) {
      c += (sum - t) + x;
    } else {
      c += (x - t) + sum;
    }
    sum = t;
  }
  return sum + c;
}

export function isErrorPoly(val) {
  if (typeof Error.isError === 'function') {
    return Error.isError(val);
  }
  return val instanceof Error || (
    typeof val === 'object' &&
    val !== null &&
    Object.prototype.toString.call(val) === '[object Error]'
  );
}

export function concatIteratorsPoly(...iterables) {
  if (typeof Iterator !== 'undefined' && typeof Iterator.concat === 'function') {
    return Iterator.concat(...iterables);
  }
  return (function* () {
    for (const it of iterables) {
      yield* it;
    }
  })();
}

export class EventBus {
  #listeners = new Map();

  on(event, handler) {
    const set = getOrInsertPoly(this.#listeners, event, new Set());
    set.add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const set = this.#listeners.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  emit(event, payload) {
    const set = this.#listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }
}

export class CommandHistory {
  #history = [];
  #cursor = -1;

  record(entry) {
    if (this.#cursor < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#cursor + 1);
    }
    this.#history.push(entry);
    this.#cursor = this.#history.length - 1;
  }

  previous() {
    if (this.#history.length === 0) return null;
    if (this.#cursor > 0) {
      this.#cursor -= 1;
    }
    return this.#history[this.#cursor];
  }

  next() {
    if (this.#history.length === 0) return null;
    if (this.#cursor < this.#history.length - 1) {
      this.#cursor += 1;
      return this.#history[this.#cursor];
    }
    return null;
  }

  getAll() {
    return [...this.#history];
  }

  clear() {
    this.#history = [];
    this.#cursor = -1;
  }
}

export class OutputFormatterStrategy {
  format(_value) {
    throw new Error('OutputFormatterStrategy.format() must be implemented');
  }
}

export class BukoFormatterStrategy extends OutputFormatterStrategy {
  format(value) {
    if (value === null || value === undefined) return 'nil';
    if (typeof value === 'boolean') return value ? 't' : 'nil';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'symbol') return value.description ?? 'sym';
    if (Array.isArray(value)) {
      return `(${value.map((el) => this.format(el)).join(' ')})`;
    }
    if (typeof value === 'object' && value.type === 'pair') {
      const items = [];
      let curr = value;
      while (curr && curr.type === 'pair') {
        items.push(this.format(curr.car));
        curr = curr.cdr;
      }
      if (curr === null || curr === undefined) {
        return `(${items.join(' ')})`;
      }
      return `(${items.join(' ')} . ${this.format(curr)})`;
    }
    if (typeof value === 'object' && value.type === 'closure') {
      return `<fn (${value.params.join(' ')})>`;
    }
    if (typeof value === 'object' && value.type === 'macro') {
      return `<macro (${value.params.join(' ')})>`;
    }
    if (typeof value === 'function') {
      return `<builtin:${value.name || 'fn'}>`;
    }
    return String(value);
  }
}

export class JsonFormatterStrategy extends OutputFormatterStrategy {
  format(value) {
    const replacer = (_key, val) => {
      if (typeof val === 'bigint') {
        return typeof JSON.rawJSON === 'function' ? JSON.rawJSON(val.toString()) : val.toString();
      }
      if (typeof val === 'symbol') {
        return val.description ?? 'symbol';
      }
      if (typeof val === 'function') {
        return `[Function: ${val.name || 'anonymous'}]`;
      }
      if (val && typeof val === 'object' && val.type === 'pair') {
        const arr = [];
        let cur = val;
        while (cur && cur.type === 'pair') {
          arr.push(cur.car);
          cur = cur.cdr;
        }
        return arr;
      }
      return val;
    };
    return JSON.stringify(value, replacer, 2) ?? 'null';
  }
}

export class ValueFactory {
  static pair(car, cdr = null) {
    return { type: 'pair', car, cdr };
  }

  static closure(params, body, env) {
    return { type: 'closure', params, body, env };
  }

  static macro(params, body, env) {
    return { type: 'macro', params, body, env };
  }
}

export class BukoEnvironment {
  #bindings = new Map();
  #parent = null;

  constructor(parent = null) {
    this.#parent = parent;
  }

  get parent() {
    return this.#parent;
  }

  define(name, value) {
    this.#bindings.set(name, value);
    return value;
  }

  set(name, value) {
    if (this.#bindings.has(name)) {
      this.#bindings.set(name, value);
      return value;
    }
    if (this.#parent) {
      return this.#parent.set(name, value);
    }
    return this.define(name, value);
  }

  get(name) {
    if (this.#bindings.has(name)) {
      return this.#bindings.get(name);
    }
    if (this.#parent) {
      return this.#parent.get(name);
    }
    throw new ReferenceError(`Unbound symbol: ${name}`);
  }

  has(name) {
    if (this.#bindings.has(name)) return true;
    return this.#parent ? this.#parent.has(name) : false;
  }

  ensureNamespace(nsName) {
    return getOrInsertPoly(this.#bindings, nsName, new BukoEnvironment(this));
  }

  keys() {
    return [...this.#bindings.keys()];
  }
}

export class BukoSyntaxError extends SyntaxError {
  constructor(message, position = 0) {
    super(`${message} (at position ${position})`);
    this.name = 'BukoSyntaxError';
    this.position = position;
  }
}

export class BukoParser {
  #source;
  #pos = 0;

  constructor(source = '') {
    this.#source = String(source);
  }

  parseAll() {
    const exprs = [];
    while (true) {
      this.#skipWhitespaceAndComments();
      if (this.#pos >= this.#source.length) break;
      exprs.push(this.parseNext());
    }
    return exprs;
  }

  parseNext() {
    this.#skipWhitespaceAndComments();
    if (this.#pos >= this.#source.length) {
      throw new BukoSyntaxError('Unexpected end of input', this.#pos);
    }

    const ch = this.#source[this.#pos];

    if (ch === '(') {
      return this.#parseList();
    }
    if (ch === ')') {
      throw new BukoSyntaxError('Unexpected closing parenthesis', this.#pos);
    }
    if (ch === "'") {
      this.#pos += 1;
      const quoted = this.parseNext();
      return [{ type: 'symbol', name: 'quote' }, quoted];
    }
    if (ch === '"') {
      return this.#parseString();
    }
    return this.#parseAtom();
  }

  #skipWhitespaceAndComments() {
    if (this.#pos === 0 && this.#source.startsWith('#!')) {
      while (this.#pos < this.#source.length && this.#source[this.#pos] !== '\n') {
        this.#pos += 1;
      }
    }
    while (this.#pos < this.#source.length) {
      const ch = this.#source[this.#pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.#pos += 1;
      } else if (ch === ';') {
        while (this.#pos < this.#source.length && this.#source[this.#pos] !== '\n') {
          this.#pos += 1;
        }
      } else {
        break;
      }
    }
  }

  #parseList() {
    const startPos = this.#pos;
    this.#pos += 1;
    const elements = [];

    while (true) {
      this.#skipWhitespaceAndComments();
      if (this.#pos >= this.#source.length) {
        throw new BukoSyntaxError('Unterminated list', startPos);
      }
      if (this.#source[this.#pos] === ')') {
        this.#pos += 1;
        return elements;
      }
      elements.push(this.parseNext());
    }
  }

  #parseString() {
    const startPos = this.#pos;
    this.#pos += 1;
    let out = '';

    while (this.#pos < this.#source.length) {
      const ch = this.#source[this.#pos];
      if (ch === '"') {
        this.#pos += 1;
        return out;
      }
      if (ch === '\\') {
        this.#pos += 1;
        if (this.#pos >= this.#source.length) {
          throw new BukoSyntaxError('Unterminated escape sequence in string', startPos);
        }
        const esc = this.#source[this.#pos];
        if (esc === 'n') out += '\n';
        else if (esc === 'r') out += '\r';
        else if (esc === 't') out += '\t';
        else if (esc === '\\') out += '\\';
        else if (esc === '"') out += '"';
        else out += esc;
        this.#pos += 1;
      } else {
        out += ch;
        this.#pos += 1;
      }
    }

    throw new BukoSyntaxError('Unterminated string literal', startPos);
  }

  #parseAtom() {
    const startPos = this.#pos;
    let token = '';
    while (this.#pos < this.#source.length) {
      const ch = this.#source[this.#pos];
      if (
        ch === ' ' ||
        ch === '\t' ||
        ch === '\n' ||
        ch === '\r' ||
        ch === '(' ||
        ch === ')' ||
        ch === '"' ||
        ch === ';'
      ) {
        break;
      }
      token += ch;
      this.#pos += 1;
    }

    if (token.length === 0) {
      throw new BukoSyntaxError('Unexpected character', startPos);
    }

    if (token === 'nil') return null;
    if (token === 't') return true;

    if (/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(token)) {
      const num = Number(token);
      if (!Number.isNaN(num)) return num;
    }

    return { type: 'symbol', name: token };
  }
}

export class BukoInterpreter {
  #globalEnv;
  #outputSink;
  #evalCount = 0;

  constructor({
    outputSink = (msg) => {
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(String(msg) + '\n');
      } else {
        console.log(String(msg));
      }
    },
  } = {}) {
    this.#outputSink = outputSink;
    this.#globalEnv = new BukoEnvironment(null);
    this.#installBuiltins();
  }

  get globalEnv() {
    return this.#globalEnv;
  }

  get evalCount() {
    return this.#evalCount;
  }

  #installBuiltins() {
    const env = this.#globalEnv;

    env.define('nil', null);
    env.define('false', null);
    env.define('t', true);

    env.define('+', (...args) => sumPrecisePoly(args));
    env.define('-', (a, ...rest) => {
      if (rest.length === 0) return -Number(a);
      return Number(a) - sumPrecisePoly(rest);
    });
    env.define('*', (...args) => args.reduce((acc, v) => acc * Number(v), 1));
    env.define('/', (a, b) => {
      const denom = Number(b);
      if (denom === 0) throw new RangeError('Division by zero');
      return Number(a) / denom;
    });
    env.define('mod', (a, b) => Number(a) % Number(b));

    env.define('=', (a, b) => this.#isEqual(a, b));
    env.define('eq', (a, b) => this.#isEqual(a, b));
    env.define('==', (a, b) => this.#isEqual(a, b));
    env.define('<', (a, b) => Number(a) < Number(b));
    env.define('>', (a, b) => Number(a) > Number(b));
    env.define('<=', (a, b) => Number(a) <= Number(b));
    env.define('>=', (a, b) => Number(a) >= Number(b));

    env.define('not', (a) => !this.#isTruthy(a));
    env.define('and', (...args) => {
      for (const item of args) {
        if (!this.#isTruthy(item)) return null;
      }
      return args.length ? args[args.length - 1] : true;
    });
    env.define('or', (...args) => {
      for (const item of args) {
        if (this.#isTruthy(item)) return item;
      }
      return null;
    });

    env.define('cons', (car, cdr) => {
      if (Array.isArray(cdr)) {
        return [car, ...cdr];
      }
      if (cdr === null || cdr === undefined) {
        return [car];
      }
      return ValueFactory.pair(car, cdr);
    });

    env.define('car', (lst) => {
      if (lst === null || lst === undefined) return null;
      if (Array.isArray(lst)) return lst.length > 0 ? lst[0] : null;
      if (typeof lst === 'object' && lst.type === 'pair') return lst.car;
      throw new TypeError('car requires a list or pair');
    });

    env.define('cdr', (lst) => {
      if (lst === null || lst === undefined) return null;
      if (Array.isArray(lst)) return lst.length > 1 ? lst.slice(1) : null;
      if (typeof lst === 'object' && lst.type === 'pair') return lst.cdr;
      throw new TypeError('cdr requires a list or pair');
    });

    env.define('list', (...args) => args);
    env.define('atom', (val) => val === null || typeof val !== 'object' || val.type !== 'pair');

    env.define('print', (...args) => {
      const rendered = args.map((v) => this.#stringify(v)).join(' ');
      this.#outputSink(rendered);
      return args.length ? args[args.length - 1] : null;
    });

    env.define('str', (...args) => args.map((v) => (v === null ? 'nil' : String(v))).join(''));
    env.define('len', (val) => {
      if (typeof val === 'string' || Array.isArray(val)) return val.length;
      if (val === null) return 0;
      throw new TypeError('len requires a string or list');
    });
  }

  #isTruthy(val) {
    return val !== null && val !== undefined && val !== false;
  }

  #isEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((el, idx) => this.#isEqual(el, b[idx]));
    }
    if (typeof a === 'object' && typeof b === 'object' && a.type === 'symbol' && b.type === 'symbol') {
      return a.name === b.name;
    }
    if (typeof a === 'object' && typeof b === 'object' && a.type === 'pair' && b.type === 'pair') {
      return this.#isEqual(a.car, b.car) && this.#isEqual(a.cdr, b.cdr);
    }
    return false;
  }

  #stringify(val) {
    if (val === null || val === undefined) return 'nil';
    if (typeof val === 'boolean') return val ? 't' : 'nil';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return `(${val.map((x) => this.#stringify(x)).join(' ')})`;
    if (typeof val === 'object' && val.type === 'symbol') return val.name;
    if (typeof val === 'object' && val.type === 'pair') return `(${this.#stringify(val.car)} . ${this.#stringify(val.cdr)})`;
    return String(val);
  }

  evalSource(source, env = this.#globalEnv) {
    const parser = new BukoParser(source);
    const exprs = parser.parseAll();
    let lastResult = null;
    for (const expr of exprs) {
      lastResult = this.evalExpr(expr, env);
    }
    return lastResult;
  }

  evalExpr(expr, env = this.#globalEnv) {
    this.#evalCount += 1;

    if (expr === null || expr === undefined) {
      return null;
    }
    if (typeof expr === 'number' || typeof expr === 'boolean' || typeof expr === 'string') {
      return expr;
    }
    if (typeof expr === 'object' && expr.type === 'symbol') {
      return env.get(expr.name);
    }
    if (!Array.isArray(expr)) {
      return expr;
    }
    if (expr.length === 0) {
      return null;
    }

    const head = expr[0];
    const headName = typeof head === 'object' && head !== null && head.type === 'symbol' ? head.name : null;

    if (headName === 'quote') {
      return expr[1] ?? null;
    }

    if (headName === '=') {
      const target = expr[1];
      if (target && typeof target === 'object' && target.type === 'symbol' && expr.length >= 3) {
        const val = this.evalExpr(expr[2] ?? null, env);
        return env.set(target.name, val);
      }
      const lhs = this.evalExpr(expr[1] ?? null, env);
      const rhs = this.evalExpr(expr[2] ?? null, env);
      return this.#isEqual(lhs, rhs);
    }

    if (headName === 'let') {
      const bindings = expr[1];
      if (!Array.isArray(bindings)) {
        throw new TypeError('let bindings must be a list');
      }
      const childEnv = new BukoEnvironment(env);
      for (const pair of bindings) {
        if (!Array.isArray(pair) || pair.length < 2 || pair[0]?.type !== 'symbol') {
          throw new TypeError('Each let binding must be (symbol value)');
        }
        const boundVal = this.evalExpr(pair[1], childEnv);
        childEnv.define(pair[0].name, boundVal);
      }
      let res = null;
      for (let i = 2; i < expr.length; i += 1) {
        res = this.evalExpr(expr[i], childEnv);
      }
      return res;
    }

    if (headName === 'do') {
      let res = null;
      for (let i = 1; i < expr.length; i += 1) {
        res = this.evalExpr(expr[i], env);
      }
      return res;
    }

    if (headName === 'if') {
      const condVal = this.evalExpr(expr[1], env);
      if (this.#isTruthy(condVal)) {
        return this.evalExpr(expr[2] ?? null, env);
      }
      return expr.length > 3 ? this.evalExpr(expr[3], env) : null;
    }

    if (headName === 'while') {
      let res = null;
      while (this.#isTruthy(this.evalExpr(expr[1], env))) {
        for (let i = 2; i < expr.length; i += 1) {
          res = this.evalExpr(expr[i], env);
        }
      }
      return res;
    }

    if (headName === 'fn') {
      const paramsNode = expr[1];
      if (!Array.isArray(paramsNode)) {
        throw new TypeError('fn parameters must be a list');
      }
      const paramNames = paramsNode.map((p) => {
        if (!p || p.type !== 'symbol') throw new TypeError('fn parameter must be a symbol');
        return p.name;
      });
      const bodyExprs = expr.slice(2);
      return ValueFactory.closure(paramNames, bodyExprs, env);
    }

    if (headName === 'mac') {
      const paramsNode = expr[1];
      if (!Array.isArray(paramsNode)) {
        throw new TypeError('mac parameters must be a list');
      }
      const paramNames = paramsNode.map((p) => {
        if (!p || p.type !== 'symbol') throw new TypeError('mac parameter must be a symbol');
        return p.name;
      });
      const bodyExprs = expr.slice(2);
      return ValueFactory.macro(paramNames, bodyExprs, env);
    }

    const fnOrMacro = this.evalExpr(head, env);

    if (fnOrMacro && typeof fnOrMacro === 'object' && fnOrMacro.type === 'macro') {
      const macEnv = new BukoEnvironment(fnOrMacro.env);
      const rawArgs = expr.slice(1);
      fnOrMacro.params.forEach((pName, idx) => {
        macEnv.define(pName, rawArgs[idx] ?? null);
      });
      let expanded = null;
      for (const bExpr of fnOrMacro.body) {
        expanded = this.evalExpr(bExpr, macEnv);
      }
      return this.evalExpr(expanded, env);
    }

    const evaluatedArgs = expr.slice(1).map((argExpr) => this.evalExpr(argExpr, env));

    if (typeof fnOrMacro === 'function') {
      return fnOrMacro(...evaluatedArgs);
    }

    if (fnOrMacro && typeof fnOrMacro === 'object' && fnOrMacro.type === 'closure') {
      const callEnv = new BukoEnvironment(fnOrMacro.env);
      fnOrMacro.params.forEach((pName, idx) => {
        callEnv.define(pName, evaluatedArgs[idx] ?? null);
      });
      let result = null;
      for (const bExpr of fnOrMacro.body) {
        result = this.evalExpr(bExpr, callEnv);
      }
      return result;
    }

    if (isErrorPoly(fnOrMacro)) {
      throw fnOrMacro;
    }

    throw new TypeError(`Cannot invoke non-callable value: ${this.#stringify(fnOrMacro)}`);
  }
}

export class BukoReplModel {
  #interpreter;
  #history;
  #events;
  #formatter;
  #sessionVariables = new Map();

  constructor({
    interpreter = new BukoInterpreter(),
    history = new CommandHistory(),
    events = new EventBus(),
    formatter = new BukoFormatterStrategy(),
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
      this.#formatter = new BukoFormatterStrategy();
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
    const node = await loadNodeModules();
    if (!node) {
      throw new Error('File loading is not available directly in browser mode.');
    }
    const resolved = node.path.resolve(node.process.cwd(), filePath);
    const content = await node.fs.readFile(resolved, 'utf8');
    const result = this.evaluateLine(content);
    this.#events.emit('file:loaded', { path: resolved, ok: result.ok });
    return result;
  }

  async saveHistory(filePath) {
    const node = await loadNodeModules();
    if (!node) {
      throw new Error('Saving to local filesystem is not available directly in browser mode.');
    }
    const resolved = node.path.resolve(node.process.cwd(), filePath);
    const lines = this.#history.getAll().join('\n') + '\n';
    await node.fs.writeFile(resolved, lines, 'utf8');
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

export class BukoConsoleView {
  #out;
  #err;

  constructor({
    out = (typeof process !== 'undefined' && process.stdout) ? process.stdout : { write: (s) => console.log(s) },
    err = (typeof process !== 'undefined' && process.stderr) ? process.stderr : { write: (s) => console.error(s) },
  } = {}) {
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

export class BukoReplController {
  #model;
  #view;
  #input;
  #output;
  #running = false;
  #lastRenderedOutput = null;

  constructor({
    model = new BukoReplModel(),
    view = new BukoConsoleView(),
    input = (typeof process !== 'undefined' && process.stdin) ? process.stdin : null,
    output = (typeof process !== 'undefined' && process.stdout) ? process.stdout : null,
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

  #writeResultOnce(formatted) {
    if (formatted === '' || formatted === undefined || formatted === null) {
      return;
    }
    if (this.#lastRenderedOutput === formatted) {
      return;
    }
    this.#lastRenderedOutput = formatted;
    this.#view.showResult(formatted);
  }

  resetPrintGuard() {
    this.#lastRenderedOutput = null;
  }

  async handleLine(line) {
    const trimmed = String(line).trim();
    if (!trimmed) {
      return { continueLoop: true };
    }

    this.#lastRenderedOutput = null;

    if (trimmed.startsWith(':')) {
      return this.#handleMetaCommand(trimmed);
    }

    const res = this.#model.evaluateLine(trimmed);
    if (res.ok) {
      if (!res.skipped) {
        this.#writeResultOnce(res.formatted);
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
            if (!fileRes.skipped) this.#writeResultOnce(fileRes.formatted);
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

    const node = await loadNodeModules();
    if (!node) return;

    const rl = node.readline.createInterface({
      input: this.#input ?? node.stdin,
      output: this.#output ?? node.stdout,
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

export async function runCli(argv = []) {
  const node = await loadNodeModules();
  if (!node) {
    throw new Error('CLI mode requires a Node.js runtime.');
  }
  const view = new BukoConsoleView({ out: node.stdout, err: node.stderr });

  if (!Array.isArray(argv) || argv.length === 0) {
    const controller = new BukoReplController({ view, input: node.stdin, output: node.stdout });
    await controller.run();
    return;
  }

  const first = argv[0];

  if (first === '-h' || first === '--help') {
    printUsage(view);
    return;
  }

  if (first === '-v' || first === '--version') {
    const pkgUrl = new URL('./package.json', import.meta.url);
    const pkgRaw = await node.fs.readFile(pkgUrl, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    view.showInfo(pkg.version);
    return;
  }

  if (first === '-e' || first === '--eval') {
    const expr = argv[1];
    if (expr === undefined) {
      view.showError('Error: -e / --eval requires an expression argument');
      node.process.exitCode = 1;
      return;
    }
    const model = new BukoReplModel();
    model.interpreter.globalEnv.define('argv', argv.slice(2));
    model.interpreter.globalEnv.define('*args*', argv.slice(2));
    const res = model.evaluateLine(expr);
    if (!res.ok) {
      view.showError(res.message);
      node.process.exitCode = 1;
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
    node.process.exitCode = 1;
    return;
  }

  const scriptPath = node.path.resolve(node.process.cwd(), first);
  const scriptArgs = argv.slice(1);
  const model = new BukoReplModel();
  model.interpreter.globalEnv.define('argv', scriptArgs);
  model.interpreter.globalEnv.define('*args*', scriptArgs);

  try {
    const content = await node.fs.readFile(scriptPath, 'utf8');
    const res = model.evaluateLine(content);
    if (!res.ok) {
      view.showError(res.message);
      node.process.exitCode = 1;
    }
  } catch (err) {
    view.showError(`Failed to run script '${first}': ${err.message}`);
    node.process.exitCode = 1;
  }
}

if (!isBrowser) {
  const node = await loadNodeModules();
  const isDirectExecution =
    typeof node.process.argv[1] === 'string' &&
    node.pathToFileURL(node.path.resolve(node.process.argv[1])).href === import.meta.url;

  if (isDirectExecution) {
    await runCli(node.process.argv.slice(2));
  }
}
