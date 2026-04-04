// ── Soup Inline Handler Extractor ───────────────────────────────────────────
// Migrated from soup.js — extracts onClick/onChange/onSubmit inline arrows
// from the node tree into named handler entries.

function soupExtractInlineHandlers(node, warns) {
  if (!node || node.type !== 'element') return;
  var evtKeys = ['onclick', 'onpress', 'onchange', 'onsubmit'];
  for (var ei = 0; ei < evtKeys.length; ei++) {
    var key = evtKeys[ei];
    if (!(key in node.attrs)) continue;
    var v = node.attrs[key];
    if (v && typeof v === 'object' && v.expr) {
      var expr = v.expr.trim();
      if (/^\(/.test(expr) && expr.indexOf('=>') >= 0) {
        var name = '_sh_' + _sShCtr++;
        // Extract arrow param name: (e) => ... or (evt) => ...
        var paramStr = '';
        var parenClose = expr.indexOf(')');
        if (parenClose > 1) paramStr = expr.slice(1, parenClose).trim();
        var arrowIdx = expr.indexOf('=>');
        var body = expr.slice(arrowIdx + 2).trim();
        if (body.charAt(0) === '{' && body.charAt(body.length - 1) === '}')
          body = body.slice(1, -1).trim();
        var entry = { name: name, jsBody: body, params: paramStr };
        // Tag change/submit handlers so soupToZig can route them correctly
        if (key === 'onchange') entry.isChange = true;
        if (key === 'onsubmit') entry.isSubmit = true;
        _sInlineHandlers.push(entry);
        node.attrs[key] = { expr: name };
      }
    }
  }
  for (var ci = 0; ci < node.children.length; ci++)
    soupExtractInlineHandlers(node.children[ci], warns);
}
