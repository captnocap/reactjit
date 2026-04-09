// ── Style expression tokenizer (from attrs.js) ──

function _readStyleAttrExpressionRaw(c) {
  if (c.kind() !== TK.lbrace) return '';
  c.advance();
  var parts = [];
  var depthParen = 0;
  var depthBracket = 0;
  var depthBrace = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.rbrace && depthParen === 0 && depthBracket === 0 && depthBrace === 0) break;
    if (c.kind() === TK.lparen) depthParen++;
    else if (c.kind() === TK.rparen && depthParen > 0) depthParen--;
    else if (c.kind() === TK.lbracket) depthBracket++;
    else if (c.kind() === TK.rbracket && depthBracket > 0) depthBracket--;
    else if (c.kind() === TK.lbrace) depthBrace++;
    else if (c.kind() === TK.rbrace && depthBrace > 0) depthBrace--;
    parts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
  return _normalizeStyleExprJs(parts.join(' '));
}

function _tokenizeStyleExpr(raw) {
  var src = String(raw || '');
  var tokens = [];
  var i = 0;
  while (i < src.length) {
    var ch = src.charAt(i);
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"' || ch === "'") {
      var quote = ch;
      var j = i + 1;
      var value = '';
      var escape = false;
      while (j < src.length) {
        var ch2 = src.charAt(j);
        if (escape) {
          value += ch2;
          escape = false;
          j++;
          continue;
        }
        if (ch2 === '\\') {
          value += ch2;
          escape = true;
          j++;
          continue;
        }
        if (ch2 === quote) break;
        value += ch2;
        j++;
      }
      tokens.push({ kind: 'string', value: value });
      i = j + 1;
      continue;
    }
    var three = src.slice(i, i + 3);
    if (three === '===' || three === '!==') {
      tokens.push({ kind: 'op', value: three });
      i += 3;
      continue;
    }
    var two = src.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=' || two === '>=' || two === '<=') {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }
    if (ch === '-' && i + 1 < src.length && /\d/.test(src.charAt(i + 1))) {
      var nj = i + 1;
      while (nj < src.length && /[\d.]/.test(src.charAt(nj))) nj++;
      tokens.push({ kind: 'number', value: src.slice(i, nj) });
      i = nj;
      continue;
    }
    if (/\d/.test(ch)) {
      var n = i + 1;
      while (n < src.length && /[\d.]/.test(src.charAt(n))) n++;
      tokens.push({ kind: 'number', value: src.slice(i, n) });
      i = n;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      var k = i + 1;
      while (k < src.length) {
        var next = src.charAt(k);
        if (/[A-Za-z0-9_$]/.test(next)) { k++; continue; }
        if (next === '.') {
          var after = src.charAt(k + 1);
          if (/[A-Za-z_$]/.test(after)) {
            k += 2;
            while (k < src.length && /[A-Za-z0-9_$]/.test(src.charAt(k))) k++;
            continue;
          }
        }
        break;
      }
      tokens.push({ kind: 'identifier', value: src.slice(i, k) });
      i = k;
      continue;
    }
    if ('{}()?:;=,!<>[],'.indexOf(ch) >= 0) {
      tokens.push({ kind: ch, value: ch });
      i++;
      continue;
    }
    i++;
  }
  return tokens;
}

function _makeStyleTokenStream(tokens) {
  return {
    tokens: tokens || [],
    pos: 0,
  };
}
