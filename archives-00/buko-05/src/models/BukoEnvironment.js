import { getOrInsertPoly } from '../patterns/es2026Compat.js';

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
