#!/usr/bin/env node
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import url from 'url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const bundlePath = path.resolve(here, process.argv[2] || 'bundle-hello.js');
const nodeConsole = globalThis.console;

function logHost(name, ...args) {
  nodeConsole.log(`[host] ${name}`, ...args);
}

function install(name, fn) {
  globalThis[name] = fn;
}

install('__hostCreateText', (...args) => {
  logHost('CREATE_TEXT', ...args);
  return 1;
});
install('__hostCreate', (...args) => {
  logHost('CREATE', ...args);
  return 1;
});
install('__hostAppend', (...args) => {
  logHost('APPEND', ...args);
});
install('__hostAppendToRoot', (...args) => {
  logHost('APPEND_TO_ROOT', ...args);
});
install('__hostUpdate', (...args) => {
  logHost('UPDATE', ...args);
});
install('__hostUpdateText', (...args) => {
  logHost('UPDATE_TEXT', ...args);
});
install('__hostRemove', (...args) => {
  logHost('REMOVE', ...args);
});
install('__hostRemoveFromRoot', (...args) => {
  logHost('REMOVE_FROM_ROOT', ...args);
});
install('__hostInsertBefore', (...args) => {
  logHost('INSERT_BEFORE', ...args);
});
install('__hostInsertBeforeRoot', (...args) => {
  logHost('INSERT_BEFORE_ROOT', ...args);
});
install('__hostFlush', (...args) => {
  logHost('FLUSH', ...args);
});
install('__hostLog', (...args) => {
  logHost('LOG', ...args);
});
install('__getInputTextForNode', (...args) => {
  logHost('GET_INPUT_TEXT', ...args);
  return '';
});
install('__getPreparedRightClick', (...args) => {
  logHost('GET_PREPARED_RIGHT_CLICK', ...args);
  return {};
});
install('__getPreparedScroll', (...args) => {
  logHost('GET_PREPARED_SCROLL', ...args);
  return {};
});
install('__beginJsEvent', () => {
  logHost('BEGIN_JS_EVENT');
});
install('__endJsEvent', () => {
  logHost('END_JS_EVENT');
});
install('__dispatchEvent', (...args) => {
  logHost('DISPATCH_EVENT', ...args);
});
install('__registerDispatch', (...args) => {
  logHost('REGISTER_DISPATCH', ...args);
});
install('__zigOS_tick', (...args) => {
  logHost('ZIGOS_TICK', ...args);
});
install('__clickLatencyStampDispatch', () => {
  logHost('CLICK_LATENCY_DISPATCH');
});
install('__clickLatencyStampHandler', () => {
  logHost('CLICK_LATENCY_HANDLER');
});
install('__clickLatencyStampStateUpdate', () => {
  logHost('CLICK_LATENCY_STATE_UPDATE');
});
install('__clickLatencyStampFlush', () => {
  logHost('CLICK_LATENCY_FLUSH');
});
install('__clickLatencyStampApplyDone', () => {
  logHost('CLICK_LATENCY_APPLY_DONE');
});
install('__clickLatencyBegin', () => {
  logHost('CLICK_LATENCY_BEGIN');
  return 1;
});
install('__clickLatencyDump', (...args) => {
  logHost('CLICK_LATENCY_DUMP', ...args);
});

globalThis.performance = globalThis.performance || { now: () => 0 };

try {
  const code = fs.readFileSync(bundlePath, 'utf8');
  vm.runInThisContext(code, { filename: bundlePath, displayErrors: true });
  nodeConsole.log('[shim] bundle completed without throwing');
} catch (err) {
  nodeConsole.error('[shim] bundle threw');
  nodeConsole.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
}
