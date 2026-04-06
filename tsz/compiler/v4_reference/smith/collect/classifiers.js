// ── Classifier support ────────────────────────────────────────────

var _activeTheme = {};

function collectClassifiers() {
  ctx.classifiers = {};
  const clsText = globalThis.__clsContent;
  if (!clsText) return;

  // Chad block classifier syntax: <C.Name is Type> ... </C.Name>
  if (clsText.indexOf('<C.') !== -1) {
    parseChadClassifiers(clsText);
    return;
  }

  // Existing JS eval path (mixed-style classifiers)
  try {
    let merged = {};
    let themeCollected = false;
    const classifier = function(obj) { for (const k in obj) merged[k] = obj[k]; };
    const effects = function() {};
    const glyphs = function() {};
    const theme = function(name, obj) {
      if (!themeCollected) {
        _activeTheme = obj;
        themeCollected = true;
      }
    };
    const variants = function() {};
    const cleanText = clsText.split('\n').filter(function(line) { return !line.trim().match(/^from\s+['"]/); }).join('\n');
    eval(cleanText);
    ctx.classifiers = merged;
  } catch (e) {
    if (!ctx._debugLines) ctx._debugLines = [];
    ctx._debugLines.push('collectClassifiers eval failed: ' + String(e));
  }
}

function parseChadClassifiers(text) {
  // 1. Parse theme tokens from <main> block (from .tcls.tsz)
  var mainMatch = text.match(/<main>([\s\S]*?)<\/main>/);
  if (mainMatch) {
    var tlines = mainMatch[1].split('\n');
    for (var ti = 0; ti < tlines.length; ti++) {
      var tl = tlines[ti].trim();
      if (!tl || tl.startsWith('//')) continue;
      var tm = tl.match(/^(\w+)\s+is\s+(.+)$/);
      if (tm) {
        var tv = tm[2].trim();
        if ((tv[0] === "'" && tv[tv.length - 1] === "'") ||
            (tv[0] === '"' && tv[tv.length - 1] === '"')) {
          _activeTheme[tm[1]] = tv.slice(1, -1);
        } else if (/^-?\d+(\.\d+)?$/.test(tv)) {
          _activeTheme[tm[1]] = parseFloat(tv);
        } else {
          _activeTheme[tm[1]] = tv;
        }
      }
    }
  }

  // 2. Parse classifier blocks: <C.Name is Type> ... </C.Name>
  var merged = {};
  var re = /<C\.(\w+)\s+is\s+(\w+)\s*>([\s\S]*?)<\/C\.\1>/g;
  var match;
  while ((match = re.exec(text)) !== null) {
    var name = match[1];
    var type = match[2];
    var body = match[3];

    var def = { type: type, style: {} };
    var blines = body.split('\n');
    for (var bi = 0; bi < blines.length; bi++) {
      var bl = blines[bi].trim();
      if (!bl || bl.startsWith('//')) continue;

      var pm = bl.match(/^(\w+)\s+(?:is|exact)\s+(.+)$/);
      if (pm) {
        var prop = pm[1];
        var val = pm[2].trim();

        // Parse value: quoted string → unquoted, number → number, rest → string
        if ((val[0] === "'" && val[val.length - 1] === "'") ||
            (val[0] === '"' && val[val.length - 1] === '"')) {
          val = val.slice(1, -1);
        } else if (/^-?\d+(\.\d+)?$/.test(val)) {
          val = parseFloat(val);
        }
        // theme-xxx and bare keywords stay as strings

        // fontSize and color are top-level (Text node fields)
        if (prop === 'fontSize' || prop === 'color') {
          def[prop] = val;
        } else {
          def.style[prop] = val;
        }
      }
    }

    merged[name] = def;
  }

  ctx.classifiers = merged;

  // 3. Parse glyph blocks: <name glyph> ... </name>
  ctx._glyphRegistry = {};
  var glyphRe = /<(\w+)\s+glyph\s*>([\s\S]*?)<\/\1>/g;
  var gm;
  while ((gm = glyphRe.exec(text)) !== null) {
    var gName = gm[1];
    var gBody = gm[2];
    var gDef = { d: '', fill: '#ffffff' };
    var gLines = gBody.split('\n');
    for (var gi = 0; gi < gLines.length; gi++) {
      var gl = gLines[gi].trim();
      if (!gl || gl.startsWith('//')) continue;
      var gpm = gl.match(/^(\w+)\s+is\s+(.+)$/);
      if (gpm) {
        var gProp = gpm[1];
        var gVal = gpm[2].trim();
        if ((gVal[0] === "'" && gVal[gVal.length - 1] === "'") ||
            (gVal[0] === '"' && gVal[gVal.length - 1] === '"')) {
          gVal = gVal.slice(1, -1);
        }
        // Resolve theme tokens for fill
        if (gProp === 'fill' && gVal.startsWith('theme-')) {
          gVal = resolveThemeToken(gVal);
        }
        gDef[gProp] = gVal;
      }
    }
    ctx._glyphRegistry[gName] = gDef;
  }
}

var _defaultStyleTokens = {
  radiusSm: 4, radiusMd: 8, radiusLg: 16,
  spacingSm: 8, spacingMd: 16, spacingLg: 24,
  borderThin: 1, borderMedium: 2,
  fontSm: 10, fontMd: 13, fontLg: 18,
};

function resolveThemeToken(val) {
  if (typeof val !== 'string') return val;
  if (!val.startsWith('theme-')) return val;
  const token = val.slice(6);
  if (_activeTheme[token] !== undefined) return _activeTheme[token];
  if (_defaultStyleTokens[token] !== undefined) return _defaultStyleTokens[token];
  return val;
}

function clsStyleFields(def) {
  if (!def || !def.style) return [];
  const fields = [];
  const style = def.style;
  for (const key of Object.keys(style)) {
    const raw = style[key];
    const val = resolveThemeToken(raw);
    if (colorKeys[key]) {
      fields.push(`.${colorKeys[key]} = ${parseColor(String(val))}`);
    } else if (enumKeys[key]) {
      const enumMeta = enumKeys[key];
      const mapped = enumMeta.values[val];
      if (mapped) fields.push(`.${enumMeta.field} = ${mapped}`);
    } else if (styleKeys[key]) {
      if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val);
        fields.push(`.${styleKeys[key]} = ${pct === 100 ? -1 : pct / 100}`);
      } else if (!(typeof val === 'string' && val === 'auto')) {
        fields.push(`.${styleKeys[key]} = ${val}`);
      }
    }
  }
  return fields;
}

function clsNodeFields(def) {
  if (!def) return [];
  const fields = [];
  if (def.fontSize !== undefined) fields.push(`.font_size = ${resolveThemeToken(def.fontSize)}`);
  if (def.color !== undefined) fields.push(`.text_color = ${parseColor(String(resolveThemeToken(def.color)))}`);
  return fields;
}

function mergeFields(clsFields, inlineFields) {
  const result = [...inlineFields];
  for (const clsField of clsFields) {
    const key = clsField.split('=')[0].trim();
    if (!result.some(f => f.split('=')[0].trim() === key)) {
      result.unshift(clsField);
    }
  }
  return result;
}
