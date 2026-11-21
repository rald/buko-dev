import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BukoReplModel } from '../buko';
import { BukoConsoleView } from '../buko';
import { BukoReplController } from '../buko';
import { sumPrecisePoly, getOrInsertPoly, isErrorPoly } from '../buko';

describe('Buko Lisp MVC, Design Patterns & ES2026 Helpers', () => {
  it('supports strategy switching between buko and json formatters', () => {
    const model = new BukoReplModel();
    assert.equal(model.evaluateLine('(list 1 2 3)').formatted, '(1 2 3)');
    model.setFormatter('json');
    assert.equal(model.evaluateLine('(list 1 2 3)').formatted, '[\n  1,\n  2,\n  3\n]');
  });

  it('emits observer events on evaluation and errors', () => {
    const model = new BukoReplModel();
    const events = [];
    model.events.on('eval:success', (payload) => events.push(['ok', payload.formatted]));
    model.events.on('eval:error', (payload) => events.push(['err', payload.message]));

    model.evaluateLine('(+ 2 3)');
    model.evaluateLine('(unknown-fn)');

    assert.equal(events[0][0], 'ok');
    assert.equal(events[0][1], '5');
    assert.equal(events[1][0], 'err');
  });

  it('handles meta-commands and file load/save via BukoReplController', async () => {
    const outChunks = [];
    const errChunks = [];
    const view = new BukoConsoleView({
      out: { write: (s) => outChunks.push(s) },
      err: { write: (s) => errChunks.push(s) },
    });
    const controller = new BukoReplController({ view });

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'buko-repl-test-'));
    const scriptFile = path.join(tmpDir, 'sample.buko');
    const histFile = path.join(tmpDir, 'history.txt');
    await fs.writeFile(scriptFile, '(= square (fn (n) (* n n))) (square 9)', 'utf8');

    await controller.handleLine(`:load ${scriptFile}`);
    assert.equal(outChunks.at(-1).trim(), '81');

    await controller.handleLine(':format json');
    await controller.handleLine('(square 4)');
    assert.equal(outChunks.at(-1).trim(), '16');

    await controller.handleLine(`:save ${histFile}`);
    const saved = await fs.readFile(histFile, 'utf8');
    assert.ok(saved.includes('(square 4)'));

    const quitRes = await controller.handleLine(':quit');
    assert.equal(quitRes.continueLoop, false);
    assert.equal(errChunks.length, 0);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('provides accurate ES2026 helper utilities', () => {
    assert.equal(sumPrecisePoly([1e16, 1, -1e16]), 1);
    const map = new Map();
    assert.equal(getOrInsertPoly(map, 'k', 42), 42);
    assert.equal(getOrInsertPoly(map, 'k', 99), 42);
    assert.equal(isErrorPoly(new TypeError('boom')), true);
    assert.equal(isErrorPoly({ message: 'fake' }), false);
  });

  it('prevents duplicate result printing within a single evaluation cycle', async () => {
    const outChunks = [];
    const view = new BukoConsoleView({
      out: { write: (s) => outChunks.push(s) },
      err: { write: () => {} },
    });
    const controller = new BukoReplController({ view });

    await controller.handleLine('(+ 10 20)');
    assert.equal(outChunks.filter((c) => c.trim() === '30').length, 1);

    await controller.handleLine('');
    assert.equal(outChunks.filter((c) => c.trim() === '30').length, 1);
  });
});
