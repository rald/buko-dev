import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BukoInterpreter } from '../src/models/BukoInterpreter.js';
import { BukoSyntaxError } from '../src/models/BukoParser.js';

describe('BukoInterpreter & BukoParser (Buko Lisp semantics)', () => {
  it('evaluates arithmetic, booleans, and nil', () => {
    const buko = new BukoInterpreter();
    assert.equal(buko.evalSource('(+ 1 2 3)'), 6);
    assert.equal(buko.evalSource('(- 10 3 2)'), 5);
    assert.equal(buko.evalSource('(* 2 3 4)'), 24);
    assert.equal(buko.evalSource('(/ 20 4)'), 5);
    assert.equal(buko.evalSource('nil'), null);
    assert.equal(buko.evalSource('t'), true);
  });

  it('supports lexical closures, assignment (=), and let bindings', () => {
    const buko = new BukoInterpreter();
    const code = `
      (= make-adder (fn (x) (fn (y) (+ x y))))
      (= add5 (make-adder 5))
      (add5 7)
    `;
    assert.equal(buko.evalSource(code), 12);

    const scoped = buko.evalSource(`
      (= x 100)
      (let ((x 10) (y 5)) (+ x y))
    `);
    assert.equal(scoped, 15);
    assert.equal(buko.evalSource('x'), 100);
  });

  it('supports list operations: cons, car, cdr, list, and while loops', () => {
    const buko = new BukoInterpreter();
    const code = `
      (= reverse (fn (lst)
        (let ((res nil))
          (while lst
            (= res (cons (car lst) res))
            (= lst (cdr lst)))
          res)))
      (reverse (quote ("buko" "pandan" "latik")))
    `;
    assert.deepEqual(buko.evalSource(code), ['latik', 'pandan', 'buko']);
  });

  it('supports macros via mac', () => {
    const buko = new BukoInterpreter();
    const code = `
      (= unless (mac (cond body)
        (list 'if (list 'not cond) body nil)))
      (unless nil 42)
    `;
    assert.equal(buko.evalSource(code), 42);
  });

  it('throws BukoSyntaxError on malformed input', () => {
    const buko = new BukoInterpreter();
    assert.throws(() => buko.evalSource('(+ 1 2'), BukoSyntaxError);
    assert.throws(() => buko.evalSource('"unterminated'), BukoSyntaxError);
  });
});
