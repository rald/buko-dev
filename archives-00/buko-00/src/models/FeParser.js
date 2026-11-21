export class FeSyntaxError extends SyntaxError {
  constructor(message, position = 0) {
    super(`${message} (at position ${position})`);
    this.name = 'FeSyntaxError';
    this.position = position;
  }
}

export class FeParser {
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
      throw new FeSyntaxError('Unexpected end of input', this.#pos);
    }

    const ch = this.#source[this.#pos];

    if (ch === '(') {
      return this.#parseList();
    }
    if (ch === ')') {
      throw new FeSyntaxError('Unexpected closing parenthesis', this.#pos);
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
    this.#pos += 1; // consume '('
    const elements = [];

    while (true) {
      this.#skipWhitespaceAndComments();
      if (this.#pos >= this.#source.length) {
        throw new FeSyntaxError('Unterminated list', startPos);
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
    this.#pos += 1; // consume opening '"'
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
          throw new FeSyntaxError('Unterminated escape sequence in string', startPos);
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

    throw new FeSyntaxError('Unterminated string literal', startPos);
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
      throw new FeSyntaxError('Unexpected character', startPos);
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
