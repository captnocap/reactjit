// ── Collection: components ───────────────────────────────────────

function collectComponents(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count - 3) {
    if (c.isIdent('function') && c.kindAt(c.pos + 1) === TK.identifier) {
      const namePos = c.pos + 1;
      const name = c.textAt(namePos);
      if (name === 'App' || !(name[0] >= 'A' && name[0] <= 'Z')) {
        c.advance();
        continue;
      }

      c.pos = namePos + 1;
      const propNames = [];
      let isBareParams = false;
      if (c.kind() === TK.lparen) {
        c.advance();
        if (c.kind() === TK.lbrace) {
          c.advance();
          while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
            if (c.kind() === TK.identifier) propNames.push(c.text());
            c.advance();
          }
          if (c.kind() === TK.rbrace) c.advance();
        } else if (c.kind() === TK.identifier) {
          isBareParams = true;
          while (c.kind() !== TK.rparen && c.kind() !== TK.eof) {
            if (c.kind() === TK.identifier) propNames.push(c.text());
            if (c.kind() === TK.comma) c.advance();
            else c.advance();
          }
        }
        if (c.kind() === TK.rparen) c.advance();
      }

      const funcBodyPos = c.pos;

      let bodyPos = -1;
      let braceDepth = 0;
      const compStateSlots = [];
      while (c.pos < c.count) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) {
          braceDepth--;
          if (braceDepth <= 0) break;
        }
        if (braceDepth === 1 && (c.isIdent('const') || c.isIdent('let'))) {
          c.advance();
          if (c.kind() === TK.lbracket) {
            c.advance();
            if (c.kind() === TK.identifier) {
              const getter = c.text();
              c.advance();
              if (c.kind() === TK.comma) c.advance();
              if (c.kind() === TK.identifier) {
                const setter = c.text();
                c.advance();
                if (c.kind() === TK.rbracket) c.advance();
                if (c.kind() === TK.equals) c.advance();
                if (c.isIdent('useState')) {
                  c.advance();
                  if (c.kind() === TK.lparen) {
                    c.advance();
                    let initial = 0;
                    let type = 'int';
                    if (c.kind() === TK.number) {
                      const num = c.text();
                      initial = num.includes('.') ? parseFloat(num) : parseInt(num);
                      type = num.includes('.') ? 'float' : 'int';
                      c.advance();
                    } else if (c.isIdent('true')) {
                      initial = true;
                      type = 'boolean';
                      c.advance();
                    } else if (c.isIdent('false')) {
                      initial = false;
                      type = 'boolean';
                      c.advance();
                    } else if (c.kind() === TK.string) {
                      initial = c.text().slice(1, -1);
                      type = 'string';
                      c.advance();
                    }
                    compStateSlots.push({ getter, setter, initial, type });
                  }
                }
              }
            }
          }
          continue;
        }
        if (c.isIdent('return')) {
          c.advance();
          if (c.kind() === TK.lparen) c.advance();
          if (c.kind() === TK.lt) {
            bodyPos = c.pos;
            break;
          }
          if (c.kind() === TK.identifier) {
            if (
              c.pos + 2 < c.count &&
              c.kindAt(c.pos + 1) === TK.dot &&
              c.kindAt(c.pos + 2) === TK.identifier &&
              c.textAt(c.pos + 2) === 'map'
            ) {
              bodyPos = c.pos;
              break;
            }
          }
        }
        c.advance();
      }

      if (bodyPos >= 0) {
        ctx.components.push({ name, propNames, isBareParams, funcBodyPos, bodyPos, stateSlots: compStateSlots });
      }
    }
    c.advance();
  }
  c.restore(saved);
}

function findComponent(name) {
  return ctx.components.find(comp => comp.name === name);
}
