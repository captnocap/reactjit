// Soup style parsing — extracted from soup.js

function soupHexRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  if (hex.length !== 6) return null;
  return parseInt(hex.slice(0,2),16)+', '+parseInt(hex.slice(2,4),16)+', '+parseInt(hex.slice(4,6),16);
}

function soupStyleColorToRgb(raw) {
  if (!raw) return null;
  if (raw.charAt(0) === '#') return soupHexRgb(raw);
  var key = raw.toLowerCase();
  if (typeof namedColors !== 'undefined' && namedColors[key]) {
    var c = namedColors[key];
    return c[0] + ', ' + c[1] + ', ' + c[2];
  }
  if (key === 'blue') return '59, 130, 246';
  if (key === 'red') return '220, 38, 38';
  if (key === 'black') return '0, 0, 0';
  if (key === 'white') return '255, 255, 255';
  return null;
}

function soupParseTextStyle(expr) {
  var result = { fontSize: null, textColor: null };
  var fsM = /\bfontSize\s*:\s*(\d+)/.exec(expr);
  if (fsM) result.fontSize = parseInt(fsM[1], 10);
  var colorM = /\bcolor\s*:\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(expr);
  if (colorM) {
    var raw = colorM[1] || colorM[2] || colorM[3] || '';
    var rgb = soupStyleColorToRgb(raw);
    if (rgb) result.textColor = rgb;
    else {
      // Variable ref — likely ternary. Find first hex color (accent/primary branch)
      var cRest = expr.slice(colorM.index + colorM[0].length);
      var cFallback = /["'](#[0-9a-fA-F]{3,8})["']/.exec(cRest);
      if (cFallback) {
        rgb = soupStyleColorToRgb(cFallback[1]);
        if (rgb) result.textColor = rgb;
      }
    }
  }
  return result;
}

function soupParseStyle(expr, warns) {
  var fields = [];
  var bgM = /backgroundColor\s*:\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(expr);
  if (bgM) {
    var bg = bgM[1] || bgM[2] || bgM[3] || '';
    var c = soupStyleColorToRgb(bg);
    if (c) fields.push('.background_color = Color.rgb(' + c + ')');
    // Dynamic bg (variable ref / ternary) → extract last hex color in this property
    else if (/^\w+$/.test(bg)) {
      var bgPropVal = expr.slice(bgM.index);
      var bgPropEnd = bgPropVal.search(/,\s*[a-zA-Z]\w*\s*:/);
      if (bgPropEnd > 0) bgPropVal = bgPropVal.slice(0, bgPropEnd);
      var bgAll = bgPropVal.match(/["'](#[0-9a-fA-F]{3,8})["']/g);
      if (bgAll && bgAll.length > 0) {
        var lastHex = bgAll[bgAll.length - 1].replace(/["']/g, '');
        c = soupStyleColorToRgb(lastHex);
        if (c) fields.push('.background_color = Color.rgb(' + c + ')');
      }
      if (!c) warns.push('[W] dynamic backgroundColor=' + bg + ' dropped');
    }
  }
  var wM = /\bwidth\s*:\s*(?:'([^']+)'|"([^"]+)"|(\d+))/.exec(expr);
  if (wM) { var wv = wM[1]||wM[2]||wM[3]||''; if (wv==='100%') fields.push('.width = -1'); else if (/^\d+$/.test(wv)) fields.push('.width = '+wv); }
  var hM = /\bheight\s*:\s*(?:'([^']+)'|"([^"]+)"|(\d+))/.exec(expr);
  if (hM) { var hv = hM[1]||hM[2]||hM[3]||''; if (hv==='100%') fields.push('.height = -1'); else if (/^\d+$/.test(hv)) fields.push('.height = '+hv); }
  var minWM = /\bminWidth\s*:\s*(\d+)/.exec(expr);
  if (minWM) fields.push('.min_width = ' + minWM[1]);
  var pM = /\bpadding\s*:\s*(\d+)/.exec(expr);
  if (pM) fields.push('.padding = ' + pM[1]);
  var gM = /\bgap\s*:\s*(\d+)/.exec(expr);
  if (gM) fields.push('.gap = ' + gM[1]);
  var brM = /\bborderRadius\s*:\s*(\d+)/.exec(expr);
  if (brM) fields.push('.border_radius = ' + brM[1]);
  var fdM = /flexDirection\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (fdM) {
    var fd = (fdM[1] || fdM[2] || '').toLowerCase();
    if (fd === 'row') fields.push('.flex_direction = .row');
    else if (fd === 'column') fields.push('.flex_direction = .column');
  }
  var aiM = /alignItems\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (aiM) {
    var ai = aiM[1] || aiM[2] || '';
    if (ai === 'center') fields.push('.align_items = .center');
    else if (ai === 'start' || ai === 'flex-start' || ai === 'flexStart') fields.push('.align_items = .start');
    else if (ai === 'end' || ai === 'flex-end' || ai === 'flexEnd') fields.push('.align_items = .end');
  }
  var jcM = /justifyContent\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (jcM) {
    var jc = jcM[1] || jcM[2] || '';
    if (jc === 'center') fields.push('.justify_content = .center');
    else if (jc === 'start' || jc === 'flex-start' || jc === 'flexStart') fields.push('.justify_content = .start');
    else if (jc === 'end' || jc === 'flex-end' || jc === 'flexEnd') fields.push('.justify_content = .end');
    else if (jc === 'space-between' || jc === 'spaceBetween') fields.push('.justify_content = .space_between');
  }
  var ovM = /overflow\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (ovM) {
    var ov = ovM[1] || ovM[2] || '';
    if (ov === 'hidden') fields.push('.overflow = .hidden');
    else if (ov === 'scroll') fields.push('.overflow = .scroll');
  }
  var fgM = /flexGrow\s*:\s*(\d+)/.exec(expr);
  if (fgM) fields.push('.flex_grow = ' + fgM[1]);
  var plM = /paddingLeft\s*:\s*(\d+)/.exec(expr);
  if (plM) fields.push('.padding_left = ' + plM[1]);
  var prM = /paddingRight\s*:\s*(\d+)/.exec(expr);
  if (prM) fields.push('.padding_right = ' + prM[1]);
  var ptM = /paddingTop\s*:\s*(\d+)/.exec(expr);
  if (ptM) fields.push('.padding_top = ' + ptM[1]);
  var pbM = /paddingBottom\s*:\s*(\d+)/.exec(expr);
  if (pbM) fields.push('.padding_bottom = ' + pbM[1]);
  var bwM = /\bborderWidth\s*:\s*(\d+)/.exec(expr);
  if (bwM) fields.push('.border_width = ' + bwM[1]);
  var bcM = /\bborderColor\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (bcM) {
    var bcRaw = bcM[1] || bcM[2] || '';
    var bcRgb = soupStyleColorToRgb(bcRaw);
    if (bcRgb) fields.push('.border_color = Color.rgb(' + bcRgb + ')');
  }
  var blwM = /borderLeftWidth\s*:\s*(\d+)/.exec(expr);
  if (blwM) fields.push('.border_left_width = ' + blwM[1]);
  var blcM = /borderLeftColor\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (blcM) {
    var blcRaw = blcM[1] || blcM[2] || '';
    var blcRgb = soupStyleColorToRgb(blcRaw);
    if (blcRgb) fields.push('.border_left_color = Color.rgb(' + blcRgb + ')');
  }
  return fields;
}
