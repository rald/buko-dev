import { getOrInsertPoly } from './es2026Compat.js';

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

export class LispFormatterStrategy extends OutputFormatterStrategy {
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
