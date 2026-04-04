// ── Soup Parsing ────────────────────────────────────────────────────────────
// Migrated from soup.js — JSX tokenizer, tag parser, balanced brace,
// tree builder, block extractor, matching close finder.

function soupBlock(src, pos) {
  var depth = 0, i = pos;
  while (i < src.length) {
    var ch = src.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < src.length && src.charAt(i) !== q) { if (src.charAt(i) === '\\') i++; i++; }
    } else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(pos + 1, i); }
    i++;
  }
  return src.slice(pos + 1);
}

function _soupFindMatchingClose(str, start, tagName) {
  var openTag = '<' + tagName;
  var closeTag = '</' + tagName + '>';
  var depth = 1, i = start;
  while (i < str.length && depth > 0) {
    if (str.slice(i, i + closeTag.length) === closeTag) {
      depth--;
      if (depth === 0) return i;
      i += closeTag.length;
    } else if (str.slice(i, i + openTag.length) === openTag) {
      var afterTag = i + openTag.length;
      if (afterTag < str.length && /[\s>\/]/.test(str.charAt(afterTag))) depth++;
      i += openTag.length;
    } else {
      i++;
    }
  }
  return -1;
}

function soupTokenize(jsx) {
  var tokens = [], i = 0;
  while (i < jsx.length) {
    var ch = jsx.charAt(i);
    if (ch === '{' && jsx.slice(i, i + 4) === '{/*') {
      var end = jsx.indexOf('*/}', i + 3); i = end >= 0 ? end + 3 : jsx.length; continue;
    }
    if (ch === '<' && jsx.slice(i, i + 4) === '<!--') {
      var end = jsx.indexOf('-->', i + 4); i = end >= 0 ? end + 3 : jsx.length; continue;
    }
    if (ch === '/' && jsx.charAt(i + 1) === '/') {
      var end = jsx.indexOf('\n', i + 2); i = end >= 0 ? end + 1 : jsx.length; continue;
    }
    if (ch === '<') {
      if (jsx.charAt(i + 1) === '/') {
        var end = jsx.indexOf('>', i + 2);
        tokens.push({ type: 'close', name: jsx.slice(i + 2, end >= 0 ? end : jsx.length).trim().toLowerCase() });
        i = end >= 0 ? end + 1 : jsx.length;
      } else {
        var t = soupParseTag(jsx, i); tokens.push(t.token); i = t.end;
      }
      continue;
    }
    if (ch === '{') {
      var r = soupBalanced(jsx, i);
      var expr = r.text.trim();
      if (expr) tokens.push({ type: 'expr', expr: expr });
      i = r.end; continue;
    }
    var start = i;
    while (i < jsx.length && jsx.charAt(i) !== '<' && jsx.charAt(i) !== '{') i++;
    var text = jsx.slice(start, i).replace(/\s+/g, ' ').trim();
    if (text) tokens.push({ type: 'text', text: text });
  }
  return tokens;
}

function soupBalanced(src, start) {
  var depth = 0, i = start;
  while (i < src.length) {
    var ch = src.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < src.length && src.charAt(i) !== q) { if (src.charAt(i) === '\\') i++; i++; }
    } else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth === 0) return { text: src.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { text: src.slice(start + 1), end: src.length };
}

function soupParseTag(jsx, start) {
  var i = start + 1, name = '';
  while (i < jsx.length && /[a-zA-Z0-9_\-]/.test(jsx.charAt(i))) name += jsx.charAt(i++);
  name = name.toLowerCase();
  var attrs = {}, selfClose = false;
  while (i < jsx.length) {
    while (i < jsx.length && /\s/.test(jsx.charAt(i))) i++;
    if (jsx.charAt(i) === '>') { i++; break; }
    if (jsx.charAt(i) === '/' && jsx.charAt(i + 1) === '>') { selfClose = true; i += 2; break; }
    var aname = '';
    while (i < jsx.length && jsx.charAt(i) !== '=' && !/[\s>\/]/.test(jsx.charAt(i))) aname += jsx.charAt(i++);
    if (!aname) { i++; continue; }
    if (jsx.charAt(i) !== '=') { attrs[aname.toLowerCase()] = true; continue; }
    i++;
    var ch = jsx.charAt(i);
    if (ch === '"' || ch === "'") {
      i++; var val = '';
      while (i < jsx.length && jsx.charAt(i) !== ch) val += jsx.charAt(i++);
      i++; attrs[aname.toLowerCase()] = val;
    } else if (ch === '{') {
      var r = soupBalanced(jsx, i); attrs[aname.toLowerCase()] = { expr: r.text.trim() }; i = r.end;
    } else {
      var val = '';
      while (i < jsx.length && !/[\s>]/.test(jsx.charAt(i))) val += jsx.charAt(i++);
      attrs[aname.toLowerCase()] = val;
    }
  }
  return { token: { type: selfClose ? 'selfclose' : 'open', name: name, attrs: attrs }, end: i };
}

function soupBuildTree(tokens) {
  var stack = [{ type: 'root', children: [] }];
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i], top = stack[stack.length - 1];
    if (t.type === 'open') {
      var node = { type: 'element', tag: t.name, attrs: t.attrs, children: [] };
      top.children.push(node); stack.push(node);
    } else if (t.type === 'selfclose') {
      top.children.push({ type: 'element', tag: t.name, attrs: t.attrs, children: [] });
    } else if (t.type === 'close') {
      if (stack.length > 1) stack.pop();
    } else if (t.type === 'text') {
      top.children.push({ type: 'text', text: t.text });
    } else if (t.type === 'expr') {
      top.children.push({ type: 'expr', expr: t.expr });
    }
  }
  return stack[0].children.length > 0 ? stack[0].children[0] : null;
}
