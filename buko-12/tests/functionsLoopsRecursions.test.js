import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BukoInterpreter } from '../buko';

describe('All Builtin Functions, Loops, and Recursions', () => {
  it('tests all arithmetic, comparison, logic, list, and string builtin functions', () => {
    const logs = [];
    const buko = new BukoInterpreter({ outputSink: (msg) => logs.push(msg) });

    // Arithmetic
    assert.equal(buko.evalSource('(+ 1 2 3 4)'), 10);
    assert.equal(buko.evalSource('(- 20 5 3)'), 12);
    assert.equal(buko.evalSource('(- 7)'), -7);
    assert.equal(buko.evalSource('(* 2 3 5)'), 30);
    assert.equal(buko.evalSource('(/ 100 4)'), 25);
    assert.equal(buko.evalSource('(mod 17 5)'), 2);
    assert.throws(() => buko.evalSource('(/ 1 0)'), RangeError);

    // Comparisons
    assert.equal(buko.evalSource('(= 10 10)'), true);
    assert.equal(buko.evalSource('(= 10 20)'), false);
    assert.equal(buko.evalSource('(< 3 9)'), true);
    assert.equal(buko.evalSource('(> 9 3)'), true);
    assert.equal(buko.evalSource('(<= 5 5)'), true);
    assert.equal(buko.evalSource('(>= 6 5)'), true);

    // Logic
    assert.equal(buko.evalSource('(not nil)'), true);
    assert.equal(buko.evalSource('(not t)'), false);
    assert.equal(buko.evalSource('(and t 10 "ok")'), 'ok');
    assert.equal(buko.evalSource('(and t nil "ok")'), null);
    assert.equal(buko.evalSource('(or nil false "fallback" 99)'), 'fallback');
    assert.equal(buko.evalSource('(or nil false)'), null);

    // List & pair operations
    assert.deepEqual(buko.evalSource('(list 1 2 3)'), [1, 2, 3]);
    assert.deepEqual(buko.evalSource('(cons 0 (list 1 2))'), [0, 1, 2]);
    assert.equal(buko.evalSource('(car (list "a" "b" "c"))'), 'a');
    assert.deepEqual(buko.evalSource('(cdr (list "a" "b" "c"))'), ['b', 'c']);
    assert.equal(buko.evalSource('(atom 42)'), true);
    assert.equal(buko.evalSource('(atom (quote (1 2)))'), true);

    // String & print & len
    assert.equal(buko.evalSource('(str "buko-" 2026 "-" nil)'), 'buko-2026-nil');
    assert.equal(buko.evalSource('(len "hello")'), 5);
    assert.equal(buko.evalSource('(len (list 10 20 30))'), 3);
    assert.equal(buko.evalSource('(len nil)'), 0);
    assert.equal(buko.evalSource('(print "value:" 42)'), 42);
    assert.equal(logs.at(-1), 'value: 42');
  });

  it('tests while loops, nested loops, accumulator loops, and early-exit style state', () => {
    const buko = new BukoInterpreter();

    const sumLoop = `
      (let ((i 1) (total 0))
        (while (<= i 10)
          (= total (+ total i))
          (= i (+ i 1)))
        total)
    `;
    assert.equal(buko.evalSource(sumLoop), 55);

    const nestedLoop = `
      (let ((r 1) (gridSum 0))
        (while (<= r 3)
          (let ((c 1))
            (while (<= c 4)
              (= gridSum (+ gridSum (* r c)))
              (= c (+ c 1))))
          (= r (+ r 1)))
        gridSum)
    `;
    assert.equal(buko.evalSource(nestedLoop), 60);
  });

  it('tests direct recursion, tail recursion, mutual recursion, and recursive list processing', () => {
    const buko = new BukoInterpreter();

    // Classic factorial recursion
    const factCode = `
      (= fact (fn (n)
        (if (<= n 1)
          1
          (* n (fact (- n 1))))))
      (fact 6)
    `;
    assert.equal(buko.evalSource(factCode), 720);

    // Fibonacci recursion
    const fibCode = `
      (= fib (fn (n)
        (if (<= n 1)
          n
          (+ (fib (- n 1)) (fib (- n 2))))))
      (fib 10)
    `;
    assert.equal(buko.evalSource(fibCode), 55);

    // Tail-recursive sum
    const tailSumCode = `
      (= sum-to (fn (n acc)
        (if (<= n 0)
          acc
          (sum-to (- n 1) (+ acc n)))))
      (sum-to 20 0)
    `;
    assert.equal(buko.evalSource(tailSumCode), 210);

    // Mutual recursion (even? / odd?) using eq for comparison
    const mutualCode = `
      (= is-even (fn (n)
        (if (eq n 0) t (is-odd (- n 1)))))
      (= is-odd (fn (n)
        (if (eq n 0) nil (is-even (- n 1)))))
      (list (is-even 8) (is-odd 8) (is-even 7) (is-odd 7))
    `;
    assert.deepEqual(buko.evalSource(mutualCode), [true, null, null, true]);

    // Recursive map over list
    const recMapCode = `
      (= map-fn (fn (f lst)
        (if lst
          (cons (f (car lst)) (map-fn f (cdr lst)))
          nil)))
      (map-fn (fn (x) (* x x)) (list 1 2 3 4 5))
    `;
    assert.deepEqual(buko.evalSource(recMapCode), [1, 4, 9, 16, 25]);
  });
});
