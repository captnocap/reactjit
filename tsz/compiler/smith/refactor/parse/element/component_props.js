// ── JSX component call prop collection ────────────────────────────

function collectComponentPropValues(c) {
  const propValues = {};
  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    // JSX prop spread: {...item} — expand all OA fields as individual props
    if (c.kind() === TK.lbrace && c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.spread && c.kindAt(c.pos + 2) === TK.identifier) {
      c.advance();
      c.advance();
      const spreadName = c.text();
      c.advance();
      if (c.kind() === TK.rbrace) c.advance();
      if (ctx.currentMap && spreadName === ctx.currentMap.itemParam) {
        const oa = ctx.currentMap.oa;
        for (const f of oa.fields) {
          if (f.type === 'nested_array') continue;
          if (f.type === 'string') {
            propValues[f.name] = `_oa${oa.oaIdx}_${f.name}[_i][0.._oa${oa.oaIdx}_${f.name}_lens[_i]]`;
          } else {
            propValues[f.name] = `_oa${oa.oaIdx}_${f.name}[_i]`;
          }
        }
      }
      continue;
    }
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (c.kind() === TK.string) {
          propValues[attr] = c.text().slice(1, -1);
          c.advance();
        } else if (tryParseComponentHandlerProp(c, attr, propValues)) {
          continue;
        } else if (c.kind() === TK.lbrace) {
          c.advance();
          if (c.kind() === TK.lt) {
            const jsxResult = parseJSXElement(c);
            if (c.kind() === TK.rbrace) c.advance();
            propValues[attr] = { __jsxSlot: true, result: jsxResult };
            continue;
          }
          if (ctx.currentMap && c.kind() === TK.identifier) {
            let matchMap = null;
            let pm = ctx.currentMap;
            while (pm) {
              if (c.text() === pm.itemParam) {
                matchMap = pm;
                break;
              }
              pm = pm.parentMap;
            }
            if (matchMap) {
              c.advance();
              if (c.kind() === TK.dot) {
                c.advance();
                if (c.kind() === TK.identifier) {
                  const field = c.text();
                  const oa = matchMap.oa;
                  const fi = oa.fields.find(ff => ff.name === field);
                  if (fi) {
                    let idx = '_i';
                    if (matchMap !== ctx.currentMap) {
                      const bf = ctx.currentMap.oa.fields.find(ff => ff.name === matchMap.itemParam + 'Idx');
                      if (bf) idx = `@intCast(_oa${ctx.currentMap.oa.oaIdx}_${bf.name}[_i])`;
                    }
                    if (fi.type === 'string') {
                      propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}][0.._oa${oa.oaIdx}_${field}_lens[${idx}]]`;
                    } else {
                      propValues[attr] = `_oa${oa.oaIdx}_${field}[${idx}]`;
                    }
                    c.advance();
                    if (c.kind() === TK.rbrace) c.advance();
                    continue;
                  }
                }
              }
            }
          }
          let val = '';
          let depth = 0;
          while (c.kind() !== TK.eof) {
            if (c.kind() === TK.lbrace) depth++;
            if (c.kind() === TK.rbrace) {
              if (depth === 0) break;
              depth--;
            }
            // Resolve props.X dot-access in {expr} prop values
            {
              const pa = peekPropsAccess(c);
              if (pa) {
                skipPropsAccess(c);
                val += typeof pa.value === 'string' ? pa.value : String(pa.value);
                continue;
              }
            }
            if (c.kind() === TK.template_literal) {
              const raw = c.text().slice(1, -1);
              let ti = 0;
              while (ti < raw.length) {
                if (raw[ti] === '$' && raw[ti + 1] === '{') {
                  const end = raw.indexOf('}', ti + 2);
                  if (end >= 0) {
                    const expr = raw.slice(ti + 2, end).trim();
                    if (ctx.currentMap && ctx.currentMap.oa) {
                      const oa = ctx.currentMap.oa;
                      const fi = oa.fields.find(ff => ff.name === expr);
                      if (fi) {
                        val = fi.type === 'string'
                          ? `_oa${oa.oaIdx}_${expr}[_i][0.._oa${oa.oaIdx}_${expr}_lens[_i]]`
                          : `_oa${oa.oaIdx}_${expr}[_i]`;
                        break;
                      }
                    }
                    if (isGetter(expr)) {
                      val = slotGet(expr);
                      break;
                    }
                    if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) {
                      val = ctx.renderLocals[expr];
                      break;
                    }
                    val += c.text();
                    break;
                  }
                }
                ti++;
              }
            } else if (c.kind() === TK.identifier && isGetter(c.text())) val += slotGet(c.text());
            else if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) val += ctx.renderLocals[c.text()];
            else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) val += '@as(i64, @intCast(_i))';
            else {
              let resolved = false;
              if (c.kind() === TK.identifier && ctx.currentMap) {
                let pm = ctx.currentMap.parentMap;
                while (pm) {
                  if (c.text() === pm.indexParam) {
                    const bf = ctx.currentMap.oa.fields.find(ff => ff.name === pm.itemParam + 'Idx');
                    if (bf) {
                      val += `_oa${ctx.currentMap.oa.oaIdx}_${bf.name}[_i]`;
                      resolved = true;
                      break;
                    }
                  }
                  pm = pm.parentMap;
                }
              }
              if (!resolved) {
                if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
                  val += ctx.renderLocals[c.text()];
                } else if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined && typeof ctx.propStack[c.text()] === 'string') {
                  val += ctx.propStack[c.text()];
                } else {
                  val += c.text();
                }
              }
            }
            c.advance();
          }
          if (c.kind() === TK.rbrace) c.advance();
          if (val.indexOf('?') >= 0 && val.indexOf(':') >= 0) {
            const qIdx = val.indexOf('?');
            const cIdx = val.indexOf(':', qIdx);
            if (qIdx > 0 && cIdx > qIdx) {
              const cond = val.substring(0, qIdx).trim();
              const then = val.substring(qIdx + 1, cIdx).trim();
              const els = val.substring(cIdx + 1).trim();
              const thenVal = /^-?\d+$/.test(then) ? '@as(i64, ' + then + ')' : then;
              const elsVal = /^-?\d+$/.test(els) ? '@as(i64, ' + els + ')' : els;
              val = 'if (' + cond + ') ' + thenVal + ' else ' + elsVal;
            }
          }
          propValues[attr] = val;
        }
      }
    } else {
      c.advance();
    }
  }
  return propValues;
}
