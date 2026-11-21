import { BukoEnvironment } from './BukoEnvironment.js';
import { BukoParser } from './BukoParser.js';
import { sumPrecisePoly, isErrorPoly } from '../patterns/es2026Compat.js';
import { ValueFactory } from '../patterns/designPatterns.js';

export class BukoInterpreter {
  #globalEnv;
  #outputSink;
  #evalCount = 0;

  constructor({ outputSink = (msg) => process.stdout.write(String(msg) + '\n') } = {}) {
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
      if (!target || target.type !== 'symbol') {
        throw new TypeError('First argument to = must be a symbol');
      }
      const val = this.evalExpr(expr[2] ?? null, env);
      return env.set(target.name, val);
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
