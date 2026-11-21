import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FeInterpreter } from '../src/models/FeInterpreter.js';
import { FeSyntaxError } from '../src/models/FeParser.js';

describe('FeInterpreter & FeParser (rxi/fe semantics)', () => {
  it('evaluates arithmetic, booleans, and nil', () => {
    const fe = new FeInterpreter();
    assert.equal(fe.evalSource('(+ 1 2 3)'), 6);
    assert.equal(fe.evalSource('(- 10 3 2)'), 5);
    assert.equal(fe.evalSource('(* 2 3 4)'), 24);
    assert.equal(fe.evalSource('(/ 20 4)'), 5);
    assert.equal(fe.evalSource('nil'), null);
    assert.equal(fe.evalSource('t'), true);
  });

  it('supports lexical closures, assignment (=), and let bindings', () => {
    const fe = new FeInterpreter();
    const code = `
      (= make-adder (fn (x) (fn (y) (+ x y))))
      (= add5 (make-adder 5))
      (add5 7)
    `;
    assert.equal(fe.evalSource(code), 12);

    const scoped = fe.evalSource(`
      (= x 100)
      (let ((x 10) (y 5)) (+ x y))
    `);
    assert.equal(scoped, 15);
    assert.equal(fe.evalSource('x'), 100);
  });

  it('supports list operations: cons, car, cdr, list, and while loops', () => {
    const fe = new FeInterpreter();
    const code = `
      (= reverse (fn (lst)
        (let ((res nil))
          (while lst
            (= res (cons (car lst) res))
            (= lst (cdr lst)))
          res)))
      (reverse (quote ("cat" "dog" "fox")))
    `;
    assert.deepEqual(fe.evalSource(code), ['fox', 'dog', 'cat']);
  });

  it('supports macros via mac', () => {
    const fe = new FeInterpreter();
    const code = `
      (= unless (mac (cond body)
        (list 'if (list 'not cond) body nil)))
      (unless nil 42)
    `;
    assert.equal(fe.evalSource(code), 42);
  });

  it('throws FeSyntaxError on malformed input', () => {
    const fe = new FeInterpreter();
    assert.throws(() => fe.evalSource('(+ 1 2'), FeSyntaxError);
    assert.throws(() => fe.evalSource('"unterminated'), FeSyntaxError);
  });
});
