// ── Collection: useState and object arrays ───────────────────────

function collectState(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count) {
    if (c.isIdent('const') || c.isIdent('let')) {
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

            let isUseState = false;
            if (c.isIdent('useState')) {
              isUseState = true;
              c.advance();
            } else if (c.isIdent('React')) {
              c.advance();
              if (c.kind() === TK.dot) c.advance();
              if (c.isIdent('useState')) {
                isUseState = true;
                c.advance();
              }
            }

            if (isUseState && c.kind() === TK.lparen) {
              c.advance();
              let initial = 0;
              let type = 'int';
              if (c.kind() === TK.number) {
                const num = c.text();
                initial = num.includes('.') ? parseFloat(num) : parseInt(num);
                type = num.includes('.') ? 'float' : 'int';
                c.advance();
              } else if (c.kind() === TK.minus) {
                c.advance();
                if (c.kind() === TK.number) {
                  initial = -parseInt(c.text());
                  c.advance();
                }
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
              } else if (c.kind() === TK.lbracket) {
                type = collectObjectArrayState(c, getter, setter);
              } else if (c.kind() === TK.lbrace) {
                type = collectObjectState(c, getter, setter);
                registerOpaqueStateMarker(getter, setter);
              } else if (c.isIdent('new') || c.kind() === TK.identifier) {
                type = collectOpaqueState(c, getter, setter);
              }
              if (type !== 'object_array' && type !== 'object_flat' && type !== 'opaque_state') {
                ctx.stateSlots.push({ getter, setter, initial, type });
              }
            }
          }
        }
      }
    }
    c.advance();
  }
  c.restore(saved);
}

function registerOpaqueStateMarker(getter, setter) {
  const hiddenGetter = '__opaque_' + getter;
  if (ctx.stateSlots.some(function(s) { return s.getter === hiddenGetter; })) return;
  const slotIdx = ctx.stateSlots.length;
  ctx.stateSlots.push({ getter: hiddenGetter, setter: '__setOpaque_' + getter, initial: 0, type: 'int', _opaqueFor: getter, _opaqueSetter: setter });
  if (!ctx.slotRemap) ctx.slotRemap = {};
  ctx.slotRemap[getter] = slotIdx;
  if (setter) ctx.slotRemap[setter] = slotIdx;
}

function collectOpaqueState(c, getter, setter) {
  let depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      if (depth === 0) break;
      depth--;
      if (depth < 0) break;
    }
    if (depth === 0 && c.kind() === TK.rparen) break;
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  registerOpaqueStateMarker(getter, setter);
  return 'opaque_state';
}

// Flatten useState({ field: val, ... }) into per-field state slots
function collectObjectState(c, getter, setter) {
  c.advance(); // skip {
  var fields = [];
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      var fieldName = c.text();
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      var fieldInitial = 0;
      var fieldType = 'int';
      if (c.kind() === TK.number) {
        var num = c.text();
        fieldInitial = num.includes('.') ? parseFloat(num) : parseInt(num);
        fieldType = num.includes('.') ? 'float' : 'int';
        c.advance();
      } else if (c.kind() === TK.minus) {
        c.advance();
        if (c.kind() === TK.number) { fieldInitial = -parseInt(c.text()); c.advance(); }
      } else if (c.kind() === TK.string) {
        fieldInitial = c.text().slice(1, -1);
        fieldType = 'string';
        c.advance();
      } else if (c.isIdent('true')) { fieldInitial = true; fieldType = 'boolean'; c.advance(); }
      else if (c.isIdent('false')) { fieldInitial = false; fieldType = 'boolean'; c.advance(); }
      fields.push({ name: fieldName, initial: fieldInitial, type: fieldType });
    }
    if (c.kind() === TK.comma) c.advance();
    else if (c.kind() !== TK.rbrace) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
  if (c.kind() === TK.rparen) c.advance();

  for (var fi = 0; fi < fields.length; fi++) {
    var f = fields[fi];
    var flatGetter = getter + '_' + f.name;
    var flatSetter = setter + '_' + f.name;
    ctx.stateSlots.push({ getter: flatGetter, setter: flatSetter, initial: f.initial, type: f.type });
  }
  if (!ctx._objectStateShapes) ctx._objectStateShapes = {};
  ctx._objectStateShapes[getter] = { fields: fields, setter: setter };

  return 'object_flat';
}

function collectObjectArrayState(c, getter, setter) {
  const arrayStartPos = c.pos - 1; // position of [
  c.advance();
  // Empty array: useState([]) → OA with no fields, managed entirely in JS/Lua
  if (c.kind() === TK.rbracket) {
    const parentOaIdx = ctx.objectArrays.length;
    ctx.objectArrays.push({
      fields: [],
      getter: getter, setter: setter, oaIdx: parentOaIdx,
      initDataStartPos: arrayStartPos,
      isEmpty: true,
    });
    c.advance(); // skip ]
    if (c.kind() === TK.rparen) c.advance();
    const oa = ctx.objectArrays[parentOaIdx];
    oa.initDataEndPos = c.pos;
    return 'object_array';
  }
  // Primitive array: useState([0, 0, 0, ...]) → synthetic OA with single 'value' field
  if (c.kind() !== TK.lbrace) {
    // Check if it's an array of numbers/booleans
    if (c.kind() === TK.number || c.kind() === TK.minus || c.isIdent('true') || c.isIdent('false')) {
      const parentOaIdx = ctx.objectArrays.length;
      ctx.objectArrays.push({
        fields: [{ name: 'value', type: 'int' }],
        getter, setter, oaIdx: parentOaIdx,
        initDataStartPos: arrayStartPos,
        isPrimitiveArray: true,
      });
      // Skip to end of array
      let depth = 1;
      while (depth > 0 && c.kind() !== TK.eof) {
        if (c.kind() === TK.lbracket) depth++;
        if (c.kind() === TK.rbracket) depth--;
        if (depth > 0) c.advance();
      }
      if (c.kind() === TK.rbracket) c.advance();
      if (c.kind() === TK.rparen) c.advance();
      const oa = ctx.objectArrays[parentOaIdx];
      oa.initDataEndPos = c.pos;
      return 'object_array';
    }
    return 'int';
  }

  const fields = [];
  c.advance();
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const fieldName = c.text();
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      let fieldType = 'int';
      if (c.kind() === TK.string) {
        fieldType = 'string';
        c.advance();
      } else if (c.kind() === TK.number) {
        const numValue = c.text();
        fieldType = numValue.startsWith('0x') ? 'int' : (numValue.includes('.') ? 'float' : 'int');
        c.advance();
      } else if (c.isIdent('true') || c.isIdent('false')) {
        fieldType = 'boolean';
        c.advance();
      } else if (c.kind() === TK.lbrace) {
        collectNestedObjectFields(c, fieldName, fields);
        if (c.kind() === TK.comma) c.advance();
        continue;
      } else if (c.kind() === TK.lbracket) {
        const nestedArrayField = collectNestedArrayField(c, fieldName);
        fields.push(nestedArrayField);
        continue;
      }
      fields.push({ name: fieldName, type: fieldType });
    }
    if (c.kind() === TK.comma) c.advance();
    else if (c.kind() !== TK.rbrace) c.advance();
  }

  const parentOaIdx = ctx.objectArrays.length;
  // Capture raw token range for initial data emission
  // arrayStartPos is at [, current pos is after first object's fields (still inside the array)
  // We'll reconstruct the JS source from tokens between [ and the matching ]
  const initDataStartPos = arrayStartPos;
  ctx.objectArrays.push({ fields, getter, setter, oaIdx: parentOaIdx, initDataStartPos });
  for (const field of fields) {
    if (field.type === 'nested_array' && field.nestedFields) {
      const childOaIdx = ctx.objectArrays.length;
      field.nestedOaIdx = childOaIdx;
      ctx.objectArrays.push({
        fields: field.nestedFields,
        getter: field.name,
        setter: 'set' + field.name[0].toUpperCase() + field.name.slice(1),
        oaIdx: childOaIdx,
        parentOaIdx: parentOaIdx,
        parentField: field.name,
        isNested: true,
      });
    }
  }

  let depth = 2;
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbracket || c.kind() === TK.rbrace) depth--;
    c.advance();
  }
  // Save end position for initial data reconstruction
  const oa = ctx.objectArrays[parentOaIdx];
  oa.initDataEndPos = c.pos; // position after closing ] )

  return 'object_array';
}

function collectNestedObjectFields(c, fieldName, fields) {
  const flatFields = [];
  const collectFlat = function(prefix, pathSoFar) {
    c.advance();
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) {
        const nestedField = c.text();
        c.advance();
        if (c.kind() === TK.colon) c.advance();
        const fullName = prefix + '_' + nestedField;
        const fullPath = pathSoFar.concat([nestedField]);
        if (c.kind() === TK.lbrace) {
          collectFlat(fullName, fullPath);
        } else {
          let nestedType = 'int';
          if (c.kind() === TK.string) {
            nestedType = 'string';
            c.advance();
          } else if (c.kind() === TK.number) {
            const numValue = c.text();
            nestedType = numValue.startsWith('0x') ? 'int' : (numValue.includes('.') ? 'float' : 'int');
            c.advance();
          } else if (c.isIdent('true') || c.isIdent('false')) {
            nestedType = 'boolean';
            c.advance();
          }
          flatFields.push({ name: fullName, type: nestedType, jsPath: fullPath });
        }
      }
      if (c.kind() === TK.comma) c.advance();
      else if (c.kind() !== TK.rbrace) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
  };

  collectFlat(fieldName, [fieldName]);
  for (const flatField of flatFields) fields.push(flatField);
}

function collectNestedArrayField(c, fieldName) {
  c.advance();
  if (c.kind() !== TK.lbrace) {
    let depth = 1;
    while (depth > 0 && c.kind() !== TK.eof) {
      if (c.kind() === TK.lbracket) depth++;
      if (c.kind() === TK.rbracket) depth--;
      if (depth > 0) c.advance();
    }
    if (c.kind() === TK.rbracket) c.advance();
    return { name: fieldName, type: 'int' };
  }

  const nestedFields = [];
  c.advance();
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const nestedFieldName = c.text();
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      let nestedFieldType = 'int';
      if (c.kind() === TK.string) {
        nestedFieldType = 'string';
        c.advance();
      } else if (c.kind() === TK.number) {
        const numValue = c.text();
        nestedFieldType = numValue.startsWith('0x') ? 'int' : (numValue.includes('.') ? 'float' : 'int');
        c.advance();
      } else if (c.isIdent('true') || c.isIdent('false')) {
        nestedFieldType = 'boolean';
        c.advance();
      }
      nestedFields.push({ name: nestedFieldName, type: nestedFieldType });
    }
    if (c.kind() === TK.comma) c.advance();
    else if (c.kind() !== TK.rbrace) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
  if (c.kind() === TK.rbracket) c.advance();
  const childOaIdx = ctx.objectArrays.length;
  return { name: fieldName, type: 'nested_array', nestedOaIdx: childOaIdx, nestedFields };
}

// ── Collection: const arrays ─────────────────────────────────────

function collectConstArrays(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count) {
    if ((c.isIdent('const') || c.isIdent('var')) && c.pos + 3 < c.count) {
      c.advance();
      if (c.kind() === TK.identifier) {
        const name = c.text();
        c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          if (c.kind() === TK.lbracket) {
            const isStateVar = ctx.stateSlots.some(s => s.getter === name) || ctx.objectArrays.some(o => o.getter === name);
            if (!isStateVar) {
              c.advance();
              if (c.kind() === TK.lbrace) {
                const constArrayInfo = collectConstArrayItems(c);
                if (constArrayInfo.fields && constArrayInfo.fields.length > 0 && constArrayInfo.items.length > 0) {
                  const oaIdx = ctx.objectArrays.length;
                  ctx.objectArrays.push({
                    fields: constArrayInfo.fields,
                    getter: name,
                    setter: null,
                    oaIdx,
                    isConst: true,
                    constData: constArrayInfo.items,
                    constLen: constArrayInfo.items.length,
                  });
                  if (globalThis.__SMITH_DEBUG_MAP_DETECT) {
                    if (!globalThis.__dbg) globalThis.__dbg = [];
                    globalThis.__dbg.push(`CONST_ARRAY name="${name}" fields=[${constArrayInfo.fields.map(f => f.name)}] items=${constArrayInfo.items.length}`);
                  }
                }
              }
            }
          }
        }
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
}

function collectConstArrayItems(c) {
  const items = [];
  let fields = null;
  while (c.kind() === TK.lbrace && c.kind() !== TK.eof) {
    c.advance();
    const item = {};
    const itemFields = [];
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) {
        const fieldName = c.text();
        c.advance();
        if (c.kind() === TK.colon) c.advance();
        const fieldValue = parseConstArrayFieldValue(c);
        item[fieldName] = fieldValue.value;
        itemFields.push({ name: fieldName, type: fieldValue.type });
      }
      if (c.kind() === TK.comma) c.advance();
      else if (c.kind() !== TK.rbrace) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    if (!fields) fields = itemFields;
    items.push(item);
    if (c.kind() === TK.comma) c.advance();
  }
  if (c.kind() === TK.rbracket) c.advance();
  return { items, fields };
}

function parseConstArrayFieldValue(c) {
  if (c.kind() === TK.string) {
    const value = c.text().slice(1, -1);
    c.advance();
    return { value, type: 'string' };
  }
  if (c.kind() === TK.number) {
    const numValue = c.text();
    const value = numValue.startsWith('0x') ? parseInt(numValue, 16) : (numValue.includes('.') ? parseFloat(numValue) : parseInt(numValue));
    const type = numValue.startsWith('0x') ? 'int' : (numValue.includes('.') ? 'float' : 'int');
    c.advance();
    return { value, type };
  }
  if (c.isIdent('true')) {
    c.advance();
    return { value: 1, type: 'int' };
  }
  if (c.isIdent('false')) {
    c.advance();
    return { value: 0, type: 'int' };
  }
  if (c.kind() === TK.minus) {
    c.advance();
    if (c.kind() === TK.number) {
      const value = -parseInt(c.text());
      c.advance();
      return { value, type: 'int' };
    }
  }
  c.advance();
  return { value: 0, type: 'int' };
}
