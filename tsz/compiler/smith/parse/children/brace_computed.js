function _syntheticFieldType(name) {
  if (!name) return 'string';
  if (name.indexOf('is') === 0 || name.indexOf('has') === 0 || name.indexOf('can') === 0 || name.indexOf('should') === 0) return 'boolean';
  if (name.indexOf('count') >= 0 || name.indexOf('index') >= 0 || name.indexOf('idx') >= 0 || name.indexOf('token') >= 0 || name.indexOf('pct') >= 0 || name === 'value') return 'int';
  if (name === 'id' || name === 'name' || name === 'label' || name === 'description' || name === 'content' || name === 'type' || name === 'title' || name === 'reason' || name === 'date') return 'string';
  return 'string';
}

function _sanitizeComputedGetter(baseName, suffix) {
  const raw = (baseName || '__expr') + (suffix || '');
  const clean = raw.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
  return (clean.length > 0 ? clean : '__expr') + '_' + (ctx._computedMapCounter++);
}

function _findAliasPropertyPaths(snippet, alias) {
  const out = [];
  const seen = {};
  const re = new RegExp('\\b' + alias + '\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)', 'g');
  let m;
  while ((m = re.exec(snippet)) !== null) {
    const path = m[1];
    if (seen[path]) continue;
    seen[path] = true;
    out.push(path);
  }
  return out;
}

function _aliasUsedBare(snippet, alias) {
  const re = new RegExp('\\b' + alias + '\\b', 'g');
  let m;
  while ((m = re.exec(snippet)) !== null) {
    let next = m.index + alias.length;
    while (next < snippet.length && /\s/.test(snippet[next])) next++;
    if (next >= snippet.length || snippet[next] !== '.') return true;
  }
  return false;
}

function _buildDestructuredComputedPlan(mapExpr, snippet, aliases) {
  const aliasProps = {};
  const bareAliases = {};
  let primaryAlias = aliases[0] || '_item';
  let bestPropCount = -1;

  for (const alias of aliases) {
    const props = _findAliasPropertyPaths(snippet, alias);
    aliasProps[alias] = props;
    bareAliases[alias] = _aliasUsedBare(snippet, alias);
    if (props.length > bestPropCount) {
      bestPropCount = props.length;
      primaryAlias = alias;
    }
  }

  const fields = [];
  const seenFields = {};
  const transformEntries = [];
  const aliasFieldMap = {};

  for (let ai = 0; ai < aliases.length; ai++) {
    const alias = aliases[ai];
    const props = aliasProps[alias];

    if ((bareAliases[alias] || props.length === 0) && !seenFields[alias]) {
      seenFields[alias] = true;
      fields.push({ name: alias, type: _syntheticFieldType(alias) });
      transformEntries.push(`${alias}: _entry[${ai}]`);
      aliasFieldMap[alias] = alias;
    }

    for (const path of props) {
      const flat = path.replace(/\./g, '_');
      const fieldName = alias === primaryAlias ? flat : alias + '_' + flat;
      if (!seenFields[fieldName]) {
        seenFields[fieldName] = true;
        fields.push({ name: fieldName, type: _syntheticFieldType(fieldName) });
      }
      transformEntries.push(`${fieldName}: _entry[${ai}].${path}`);
    }
  }

  if (fields.length === 0) return null;

  return {
    fields,
    primaryAlias,
    aliasFieldMap,
    computedExpr: `(${_normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr))}).map((_entry, _idx) => ({ ${transformEntries.join(', ')} }))`,
  };
}

function _ensureSyntheticComputedOa(getterName, mapExpr, snippet, header) {
  if (!ctx._computedMapByGetter) ctx._computedMapByGetter = {};
  if (ctx._computedMapByGetter[getterName]) return ctx._computedMapByGetter[getterName];

  const itemParam = header && header.itemParam ? header.itemParam : '_item';
  const destructuredAliases = header && header.destructuredAliases ? header.destructuredAliases : null;
  const destructuredPlan = destructuredAliases && destructuredAliases.length > 0
    ? _buildDestructuredComputedPlan(mapExpr, snippet, destructuredAliases)
    : null;
  const nestedHints = {};
  const fields = destructuredPlan ? destructuredPlan.fields.slice() : [];
  const seen = {};
  for (const field of fields) seen[field.name] = true;
  if (!destructuredPlan) {
    const fieldRe = new RegExp('\\b' + itemParam + '\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)', 'g');
    let m;
    while ((m = fieldRe.exec(snippet)) !== null) {
      const path = m[1];
      const first = path.split('.')[0];
      if (snippet.indexOf(itemParam + '.' + first + '.map(') >= 0) {
        nestedHints[first] = true;
        continue;
      }
      const flat = path.replace(/\./g, '_');
      if (seen[flat]) continue;
      seen[flat] = true;
      fields.push({ name: flat, type: _syntheticFieldType(flat) });
    }
  }

  for (const nf of Object.keys(nestedHints)) {
    fields.push({ name: nf, type: 'nested_array', nestedFields: [{ name: '_v', type: 'string' }] });
  }

  let oa;
  const colorMatches = snippet.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const uniqueColors = [];
  for (let ci = 0; ci < colorMatches.length; ci++) {
    if (uniqueColors.indexOf(colorMatches[ci]) < 0) uniqueColors.push(colorMatches[ci]);
  }
  if (fields.length === 0) {
    oa = {
      fields: [{ name: '_v', type: 'string' }],
      getter: getterName,
      setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1),
      oaIdx: ctx.objectArrays.length,
      isSimpleArray: true,
      _computedExpr: _normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr)),
      _computedColors: uniqueColors,
      _computedHasTernary: snippet.indexOf('?(') >= 0 || snippet.indexOf('? (') >= 0,
    };
    ctx.objectArrays.push(oa);
  } else {
    oa = {
      fields: fields,
      getter: getterName,
      setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1),
      oaIdx: ctx.objectArrays.length,
      _computedExpr: destructuredPlan ? destructuredPlan.computedExpr : _normalizeJoinedJsExpr(_expandRenderLocalJsFully(mapExpr)),
      _computedColors: uniqueColors,
      _computedHasTernary: snippet.indexOf('?(') >= 0 || snippet.indexOf('? (') >= 0,
    };
    if (destructuredPlan) {
      oa._computedHeader = {
        itemParam: destructuredPlan.primaryAlias,
        indexParam: header.indexParam,
        destructuredAliases: header.destructuredAliases,
        filterConditions: [],
        renderLocalAliases: destructuredPlan.aliasFieldMap,
      };
    }
    ctx.objectArrays.push(oa);
    for (const field of fields) {
      if (field.type === 'nested_array') {
        const childOaIdx = ctx.objectArrays.length;
        field.nestedOaIdx = childOaIdx;
        ctx.objectArrays.push({
          fields: field.nestedFields,
          getter: getterName + '_' + field.name,
          setter: 'set' + getterName[0].toUpperCase() + getterName.slice(1) + '_' + field.name,
          oaIdx: childOaIdx,
          parentOaIdx: oa.oaIdx,
          parentField: field.name,
          isNested: true,
        });
      }
    }
  }

  ctx._computedMapByGetter[getterName] = oa;
  return oa;
}
