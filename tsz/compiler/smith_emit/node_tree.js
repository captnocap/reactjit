// Emit static node tree

function emitNodeTree(ctx, rootExpr, promotedToPerItem) {
  let out = `// ── Generated node tree ─────────────────────────────────────────\n`;
  for (let i = 0; i < ctx.arrayDecls.length; i++) {
    const nm = ctx.arrayDecls[i].match(/^var (_arr_\d+)/);
    if (nm && promotedToPerItem.has(nm[1])) continue;
    if (ctx.arrayComments[i]) out += ctx.arrayComments[i] + '\n';
    out += ctx.arrayDecls[i].replace(/"__mt\d+__"/g, '""') + '\n';
  }
  const nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  out += `var _root = Node${nodeInit};\n`;
  return out;
}
