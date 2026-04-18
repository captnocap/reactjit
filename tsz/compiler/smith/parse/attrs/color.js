// ── Color parser (from attrs.js) ──
//
// `theme-*` tokens resolve to literal RGB at compile time. The cockpit vocabulary
// below uses the <dawn> theme values as defaults. Overriding at runtime requires
// wiring framework/theme.zig + setVariant, which lands in a follow-up.

const themeColors = {
  // ── Legacy Catppuccin set (preserved for existing carts) ──
  'theme-bgElevated':     [49, 50, 68],
  'theme-surface':        [49, 50, 68],
  'theme-surfaceHover':   [69, 71, 90],
  'theme-border':         [69, 71, 90],
  'theme-primaryHover':   [116, 199, 236],
  'theme-primaryPressed': [137, 220, 235],
  'theme-text':           [205, 214, 244],

  // ── Cockpit vocabulary (dawn defaults) ──

  // Backgrounds
  'theme-bg':           [247, 242, 224], // #F7F2E0 warm.cream
  'theme-bgAlt':        [212, 212, 168], // #D4D4A8 warm.sand
  'theme-bgRaised':     [228, 225, 252], // #E4E1FC lavender.ice
  'theme-bgSunken':     [214, 199, 232], // #D6C7E8 lavender.pale
  'theme-bgFloat':      [228, 225, 252], // #E4E1FC lavender.ice
  'theme-bgOverlay':    [54,  47,  66 ], // #362F42 dark.plum
  'theme-bgTint':       [238, 232, 245], // #EEE8F5

  // Text
  'theme-textPrimary':   [54,  47,  66 ], // #362F42 dark.plum
  'theme-textSecondary': [103, 71,  77 ], // #67474D warm.plum_brown
  'theme-textDim':       [168, 121, 101], // #A87965 warm.taupe
  'theme-textAccent':    [181, 149, 232], // #B595E8 lavender.vivid
  'theme-textOnAccent':  [255, 255, 255],
  'theme-textDisabled':  [196, 168, 212], // #C4A8D4 lavender.mid
  'theme-textError':     [179, 78,  78 ], // #B34E4E bold.brick
  'theme-textWarning':   [242, 219, 67 ], // #F2DB43 bold.mustard
  'theme-textSuccess':   [78,  179, 120], // #4EB378 green.fresh

  // Borders
  'theme-borderHair':   [214, 199, 232], // #D6C7E8 lavender.pale
  'theme-borderLight':  [196, 168, 212], // #C4A8D4 lavender.mid
  'theme-borderMid':    [168, 121, 101], // #A87965 warm.taupe
  'theme-borderStrong': [80,  76,  84 ], // #504C54 dark.grey_plum
  'theme-borderFocus':  [181, 149, 232], // #B595E8 lavender.vivid

  // Semantic
  'theme-primary': [189, 181, 248], // #BDB5F8 lavender.soft
  'theme-accent':  [243, 181, 210], // #F3B5D2 pink.baby
  'theme-success': [78,  179, 120], // #4EB378 green.fresh
  'theme-warning': [242, 219, 67 ], // #F2DB43 bold.mustard
  'theme-error':   [179, 78,  78 ], // #B34E4E bold.brick
  'theme-info':    [153, 200, 240], // #99C8F0 blue.sky

  // Tiers
  'theme-tier0': [168, 121, 101], // #A87965 warm.taupe
  'theme-tier1': [236, 194, 194], // #ECC2C2 pink.blush
  'theme-tier2': [242, 219, 67 ], // #F2DB43 bold.mustard
  'theme-tier3': [242, 120, 53 ], // #F27835 bold.orange
  'theme-tier4': [179, 78,  78 ], // #B34E4E bold.brick

  // Affect
  'theme-affectConfident':     [168, 212, 188], // #A8D4BC green.mint
  'theme-affectUncertain':     [139, 184, 200], // #8BB8C8 blue.dusty
  'theme-affectFrustrated':    [240, 148, 187], // #F094BB pink.rose
  'theme-affectStuck':         [48,  65,  78 ], // #30414E blue.slate
  'theme-affectRationalizing': [242, 120, 53 ], // #F27835 bold.orange
  'theme-affectFocused':       [181, 149, 232], // #B595E8 lavender.vivid
  'theme-affectDrifting':      [233, 191, 160], // #E9BFA0 warm.peach
  'theme-affectPerforming':    [242, 219, 67 ], // #F2DB43 bold.mustard

  // Backend
  'theme-backendClaude': [153, 200, 240], // blue.sky
  'theme-backendCodex':  [192, 157, 248], // lavender.bright
  'theme-backendKimi':   [168, 212, 188], // green.mint

  // Memory layers
  'theme-l1River':        [139, 184, 200], // blue.dusty
  'theme-l2Feeling':      [240, 155, 169], // pink.salmon
  'theme-l3Echo':         [189, 181, 248], // lavender.soft
  'theme-l4Wound':        [179, 78,  78 ], // bold.brick
  'theme-l5Cooccurrence': [84,  150, 150], // green.teal

  // Worker slots
  'theme-worker1': [189, 181, 248], // lavender.soft
  'theme-worker2': [243, 181, 210], // pink.baby
  'theme-worker3': [168, 212, 188], // green.mint
  'theme-worker4': [153, 200, 240], // blue.sky
  'theme-worker5': [233, 191, 160], // warm.peach
  'theme-worker6': [240, 153, 200], // pink.candy
  'theme-worker7': [84,  150, 150], // green.teal
  'theme-worker8': [192, 157, 248], // lavender.bright

  // Tetris
  'theme-tetrisSpec':                  [189, 181, 248],
  'theme-tetrisWorker1':               [189, 181, 248],
  'theme-tetrisWorker2':               [243, 181, 210],
  'theme-tetrisWorker3':               [168, 212, 188],
  'theme-tetrisWorker4':               [153, 200, 240],
  'theme-tetrisWorker5':               [233, 191, 160],
  'theme-tetrisWorker6':               [240, 153, 200],
  'theme-tetrisWorker7':               [84,  150, 150],
  'theme-tetrisWorker8':               [192, 157, 248],
  'theme-tetrisRationalizationWound':  [179, 78,  78 ],
  'theme-tetrisPinned':                [78,  179, 120],
  'theme-tetrisResonance3':            [242, 120, 53 ],
  'theme-tetrisUserNote':              [242, 219, 67 ],
  'theme-tetrisBreadcrumb':            [168, 121, 101],
  'theme-tetrisFloor':                 [214, 199, 232],

  // Law ticker
  'theme-lawConstitutional': [179, 78, 78 ],
  'theme-lawOperational':    [242, 219, 67],
  'theme-lawFieldNote':      [236, 194, 194],
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
