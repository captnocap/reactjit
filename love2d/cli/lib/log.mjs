// ── ANSI color helpers ─────────────────────────────────────
// Zero dependencies. Used by all CLI commands for consistent output.

const esc = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;

export const bold    = esc('1');
export const dim     = esc('2');
export const italic  = esc('3');
export const red     = esc('31');
export const green   = esc('32');
export const yellow  = esc('33');
export const blue    = esc('34');
export const magenta = esc('35');
export const cyan    = esc('36');
export const white   = esc('37');

// Bright variants
export const brightRed     = esc('91');
export const brightGreen   = esc('92');
export const brightYellow  = esc('93');
export const brightBlue    = esc('94');
export const brightMagenta = esc('95');
export const brightCyan    = esc('96');

// ── Composable styles ──────────────────────────────────────

export const boldCyan    = (s) => bold(cyan(s));
export const boldGreen   = (s) => bold(green(s));
export const boldRed     = (s) => bold(red(s));
export const boldYellow  = (s) => bold(yellow(s));
export const boldMagenta = (s) => bold(magenta(s));

// ── Prefixed loggers ──────────────────────────────────────

const TAG = bold(magenta('rjit'));

export const log   = (...args) => console.log(`  ${TAG}`, ...args);
export const info  = (...args) => console.log(`  ${TAG}  ${cyan('info')}`, ...args);
export const ok    = (...args) => console.log(`  ${TAG}  ${boldGreen('  ok')}`, ...args);
export const warn  = (...args) => console.log(`  ${TAG}  ${boldYellow('warn')}`, ...args);
export const fail  = (...args) => console.error(`  ${TAG}  ${boldRed('fail')}`, ...args);

// ── Banner ─────────────────────────────────────────────────

export function banner(title, subtitle) {
  const line = dim('─'.repeat(48));
  console.log('');
  console.log(`  ${line}`);
  console.log(`  ${bold(magenta('ReactJIT'))}  ${title}`);
  if (subtitle) console.log(`  ${dim(subtitle)}`);
  console.log(`  ${line}`);
  console.log('');
}

// ── Timing ─────────────────────────────────────────────────

export function elapsed(startMs) {
  const ms = Date.now() - startMs;
  if (ms < 1000) return dim(`${ms}ms`);
  return dim(`${(ms / 1000).toFixed(1)}s`);
}
