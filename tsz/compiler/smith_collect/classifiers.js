// ── Classifier support ────────────────────────────────────────────

var _activeTheme = {};

function collectClassifiers() {
  ctx.classifiers = {};
  const clsText = globalThis.__clsContent;
  if (!clsText) return;
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
