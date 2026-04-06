// ── JSX tag normalization helpers ─────────────────────────────────

function normalizeRawTag(c, rawTag) {
  let clsDef = null;
  let clsName = null;
  const lineOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  if (rawTag === 'C' && c.kind() === TK.dot) {
    c.advance();
    clsName = c.text();
    c.advance();
    clsDef = ctx.classifiers && ctx.classifiers[clsName];
    if (!clsDef) {
      ctx._unresolvedClassifiers.push({ name: clsName, line: lineOffset });
    }
    rawTag = clsDef ? clsDef.type : 'Box';
  }

  if (rawTag === 'Graph' && c.kind() === TK.dot) {
    c.advance();
    rawTag = 'Graph.' + c.text();
    c.advance();
  }
  if (rawTag === 'Canvas' && c.kind() === TK.dot) {
    c.advance();
    rawTag = 'Canvas.' + c.text();
    c.advance();
  }
  if (rawTag === '3D' && c.kind() === TK.dot) {
    c.advance();
    rawTag = '3D.' + c.text();
    c.advance();
  }
  if (rawTag === 'Scene3D' && c.kind() === TK.dot) {
    c.advance();
    rawTag = '3D.' + c.text();
    c.advance();
  }
  if (rawTag === 'Physics' && c.kind() === TK.dot) {
    c.advance();
    rawTag = 'Physics.' + c.text();
    c.advance();
  }

  if (rawTag.startsWith('Physics.') || rawTag.startsWith('3D.') || rawTag === 'Scene3D' || rawTag === 'Effect') {
    ctx._unknownSubsystemTags.push({ tag: rawTag, line: lineOffset });
  }

  // Bare classifier import: <Nav> matches classifier key directly (no C. prefix)
  // But components take priority — if a component exists with this name, don't classifier-ify it.
  if (!clsDef && ctx.classifiers && ctx.classifiers[rawTag] && !findComponent(rawTag)) {
    clsDef = ctx.classifiers[rawTag];
    clsName = rawTag;
    rawTag = clsDef.type || 'Box';
  }

  return { rawTag, clsDef, clsName };
}
