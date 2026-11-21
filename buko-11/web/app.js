import { BukoInterpreter, BukoReplModel } from '../buko';

const editor = document.getElementById('editor');
const output = document.getElementById('output');
const argsInput = document.getElementById('args-input');
const formatSelect = document.getElementById('format-select');
const presetSelect = document.getElementById('preset-select');
const runScriptBtn = document.getElementById('run-script-btn');
const clearBtn = document.getElementById('clear-btn');
const replForm = document.getElementById('repl-form');
const replInput = document.getElementById('repl-input');

const presets = {
  hello: `; Welcome to Buko Lisp in the browser!
(print "Script args:" *args*)
(= greet (fn (name) (str "Mabuhay, " name "!")))
(if (car *args*)
  (greet (car *args*))
  (greet "Web"))`,
  closure: `; Lexical closures and let bindings
(= make-counter (fn (start)
  (let ((count start))
    (fn (step)
      (= count (+ count step))
      count))))
(= c (make-counter 10))
(c 5)
(c 15)`,
  recursion: `; Recursive list map
(= map-fn (fn (f lst)
  (if lst
    (cons (f (car lst)) (map-fn f (cdr lst)))
    nil)))
(map-fn (fn (x) (* x x)) (list 1 2 3 4 5))`,
};

function appendLine(text, cls = 'line-log') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function parseArgs(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function createFreshModel(scriptArgs = []) {
  const interpreter = new BukoInterpreter({
    outputSink: (msg) => appendLine(`[print] ${msg}`, 'line-log'),
  });
  interpreter.globalEnv.define('argv', scriptArgs);
  interpreter.globalEnv.define('*args*', scriptArgs);
  const m = new BukoReplModel({ interpreter });
  m.setFormatter(formatSelect.value);
  return m;
}

let model = createFreshModel(parseArgs(argsInput.value));

presetSelect.addEventListener('change', () => {
  const code = presets[presetSelect.value];
  if (code) editor.value = code;
});

formatSelect.addEventListener('change', () => {
  model.setFormatter(formatSelect.value);
  appendLine(`; Formatter switched to ${formatSelect.value}`, 'line-log');
});

clearBtn.addEventListener('click', () => {
  output.innerHTML = '';
});

runScriptBtn.addEventListener('click', () => {
  const args = parseArgs(argsInput.value);
  model = createFreshModel(args);
  appendLine(`> [run script] args=${JSON.stringify(args)}`, 'line-in');
  const res = model.evaluateLine(editor.value);
  if (res.ok) {
    if (!res.skipped) appendLine(`=> ${res.formatted}`, 'line-out');
  } else {
    appendLine(`! ${res.message}`, 'line-err');
  }
});

replForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const line = replInput.value.trim();
  if (!line) return;
  appendLine(`buko> ${line}`, 'line-in');
  const res = model.evaluateLine(line);
  if (res.ok) {
    if (!res.skipped) appendLine(`=> ${res.formatted}`, 'line-out');
  } else {
    appendLine(`! ${res.message}`, 'line-err');
  }
  replInput.value = '';
});

appendLine('Buko Lisp Web REPL ready. Run the script or evaluate expressions below.', 'line-log');
