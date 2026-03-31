// ── JSX basic attr helpers ───────────────────────────────────────

function tryParseBasicElementAttr(c, attr, rawTag, nodeFields, currentState) {
  let ascriptScript = currentState.ascriptScript;
  let ascriptOnResult = currentState.ascriptOnResult;

  if (rawTag === 'ascript' && attr === 'run') {
    if (c.kind() === TK.string) {
      ascriptScript = c.text().slice(1, -1);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.string) {
        ascriptScript = c.text().slice(1, -1);
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (rawTag === 'ascript' && attr === 'onResult') {
    if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.identifier) {
        ascriptOnResult = c.text();
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else if (c.kind() === TK.identifier) {
      ascriptOnResult = c.text();
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'fontSize') {
    parseFontSizeAttr(c, nodeFields);
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'textEffect') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.text_effect = "${c.text().slice(1, -1)}"`);
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'name' && rawTag === 'Effect') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.effect_name = "${c.text().slice(1, -1)}"`);
      c.advance();
    }
    return { ascriptScript, ascriptOnResult };
  }

  if (attr === 'placeholder' && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
    if (c.kind() === TK.string) {
      nodeFields.push(`.placeholder = "${c.text().slice(1, -1)}"`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return { ascriptScript, ascriptOnResult };
  }

  return null;
}

function parseFontSizeAttr(c, nodeFields) {
  if (c.kind() === TK.lbrace) {
    c.advance();
    let fontSizeValue = null;
    if (c.kind() === TK.number) {
      fontSizeValue = parseFloat(c.text());
      c.advance();
    } else if (
      c.kind() === TK.identifier &&
      ctx.propStack &&
      ctx.propStack[c.text()] !== undefined &&
      /^\d+(\.\d+)?$/.test(ctx.propStack[c.text()])
    ) {
      fontSizeValue = parseFloat(ctx.propStack[c.text()]);
      c.advance();
    }

    if (fontSizeValue !== null) {
      if (c.kind() === TK.star && c.pos + 1 < c.count) {
        c.advance();
        if (c.kind() === TK.number) {
          fontSizeValue = Math.floor(fontSizeValue * parseFloat(c.text()));
          c.advance();
        }
      } else if (c.kind() === TK.slash && c.pos + 1 < c.count) {
        c.advance();
        if (c.kind() === TK.number) {
          fontSizeValue = Math.floor(fontSizeValue / parseFloat(c.text()));
          c.advance();
        }
      }
      nodeFields.push(`.font_size = ${fontSizeValue}`);
    }

    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    return;
  }

  if (c.kind() === TK.number) {
    nodeFields.push(`.font_size = ${c.text()}`);
    c.advance();
  } else if (c.kind() === TK.string) {
    nodeFields.push(`.font_size = ${c.text().slice(1, -1)}`);
    c.advance();
  }
}
