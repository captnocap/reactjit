// ── Color parser (from attrs.js) ──

const themeColors = {
  'theme-bg':             [30, 30, 46],
  'theme-bgAlt':          [24, 24, 37],
  'theme-bgElevated':     [49, 50, 68],
  'theme-surface':        [49, 50, 68],
  'theme-surfaceHover':   [69, 71, 90],
  'theme-border':         [69, 71, 90],
  'theme-borderFocus':    [137, 180, 250],
  'theme-text':           [205, 214, 244],
  'theme-textSecondary':  [186, 194, 222],
  'theme-textDim':        [166, 173, 200],
  'theme-primary':        [137, 180, 250],
  'theme-primaryHover':   [116, 199, 236],
  'theme-primaryPressed': [137, 220, 235],
  'theme-accent':         [203, 166, 247],
  'theme-error':          [243, 139, 168],
  'theme-warning':        [250, 179, 135],
  'theme-success':        [166, 227, 161],
  'theme-info':           [137, 220, 235],
};

function parseColor(hex) {
  if (hex === 'transparent') return 'Color.rgba(0, 0, 0, 0)';
  if (themeColors[hex]) {
    const [r,g,b] = themeColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  if (namedColors[hex]) {
    const [r,g,b] = namedColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  const h = hex.startsWith('#') ? hex.slice(1) : hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length === 8) {
    return `Color.rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, ${parseInt(h.slice(6,8),16)})`;
  }
  if (h.length === 6) {
    return `Color.rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`;
  }
  if (h.length === 3) {
    return `Color.rgb(${parseInt(h[0],16)*17}, ${parseInt(h[1],16)*17}, ${parseInt(h[2],16)*17})`;
  }
  return 'Color.rgb(255, 255, 255)';
}
