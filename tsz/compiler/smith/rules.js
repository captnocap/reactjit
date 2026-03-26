// ── Token kinds (must match lexer.zig TokenKind enum order) ──
const TK = {
  identifier: 0, number: 1, string: 2, template_literal: 3,
  lparen: 4, rparen: 5, lbrace: 6, rbrace: 7, lbracket: 8, rbracket: 9,
  comma: 10, colon: 11, semicolon: 12, dot: 13, spread: 14, equals: 15,
  arrow: 16, plus: 17, minus: 18, star: 19, slash: 20, percent: 21, bang: 22,
  eq_eq: 23, not_eq: 24, gt_eq: 25, lt_eq: 26,
  ampersand: 27, pipe: 28, caret: 29, tilde: 30, shift_left: 31, shift_right: 32,
  wrap_mul: 33, wrap_add: 34, wrap_sub: 35, caret_eq: 36,
  amp_amp: 37, pipe_pipe: 38,
  question: 39, question_question: 40,
  lt: 41, gt: 42, slash_gt: 43, lt_slash: 44,
  ffi_pragma: 45, comment: 46, builtin: 47, eof: 48,
};

// ── Rules ──

const styleKeys = {
  width: 'width', height: 'height', minWidth: 'min_width', maxWidth: 'max_width',
  minHeight: 'min_height', maxHeight: 'max_height',
  flexGrow: 'flex_grow', flexShrink: 'flex_shrink', flexBasis: 'flex_basis',
  gap: 'gap', order: 'order',
  padding: 'padding', paddingLeft: 'padding_left', paddingRight: 'padding_right',
  paddingTop: 'padding_top', paddingBottom: 'padding_bottom',
  margin: 'margin', marginLeft: 'margin_left', marginRight: 'margin_right',
  marginTop: 'margin_top', marginBottom: 'margin_bottom',
  borderRadius: 'border_radius', opacity: 'opacity', borderWidth: 'border_width',
  borderLeftWidth: 'border_left_width', borderRightWidth: 'border_right_width',
  borderTopWidth: 'border_top_width', borderBottomWidth: 'border_bottom_width',
  shadowOffsetX: 'shadow_offset_x', shadowOffsetY: 'shadow_offset_y', shadowBlur: 'shadow_blur',
  top: 'top', left: 'left', right: 'right', bottom: 'bottom',
  aspectRatio: 'aspect_ratio', rotation: 'rotation', scaleX: 'scale_x', scaleY: 'scale_y',
};

const colorKeys = {
  backgroundColor: 'background_color', borderColor: 'border_color',
  shadowColor: 'shadow_color', gradientColorEnd: 'gradient_color_end',
};

const enumKeys = {
  flexDirection:     { field: 'flex_direction', values: { row: '.row', column: '.column' }},
  justifyContent:    { field: 'justify_content', values: { start: '.start', center: '.center', end: '.end', 'space-between': '.space_between', spaceBetween: '.space_between', 'space-around': '.space_around', spaceAround: '.space_around', 'space-evenly': '.space_evenly', spaceEvenly: '.space_evenly', 'flex-start': '.start', flexStart: '.start', 'flex-end': '.end', flexEnd: '.end' }},
  alignItems:        { field: 'align_items', values: { start: '.start', center: '.center', end: '.end', stretch: '.stretch', 'flex-start': '.start', flexStart: '.start', 'flex-end': '.end', flexEnd: '.end' }},
  alignSelf:         { field: 'align_self', values: { auto: '.auto', start: '.start', center: '.center', end: '.end', stretch: '.stretch', flexStart: '.start', 'flex-start': '.start', flexEnd: '.end', 'flex-end': '.end' }},
  flexWrap:          { field: 'flex_wrap', values: { nowrap: '.no_wrap', noWrap: '.no_wrap', wrap: '.wrap' }},
  position:          { field: 'position', values: { relative: '.relative', absolute: '.absolute' }},
  display:           { field: 'display', values: { flex: '.flex', none: '.none' }},
  textAlign:         { field: 'text_align', values: { left: '.left', center: '.center', right: '.right' }},
  overflow:          { field: 'overflow', values: { visible: '.visible', hidden: '.hidden', scroll: '.scroll' }},
  gradientDirection: { field: 'gradient_direction', values: { vertical: '.vertical', horizontal: '.horizontal', none: '.none' }},
};

const htmlTags = {
  div: 'Box', section: 'Box', article: 'Box', main: 'Box', aside: 'Box',
  header: 'Box', footer: 'Box', nav: 'Box', form: 'Box', fieldset: 'Box',
  ul: 'Box', ol: 'Box', li: 'Box', table: 'Box', tr: 'Box', td: 'Box',
  span: 'Text', p: 'Text', label: 'Text', h1: 'Text', h2: 'Text',
  h3: 'Text', h4: 'Text', h5: 'Text', h6: 'Text', strong: 'Text',
  button: 'Pressable', a: 'Pressable',
  input: 'TextInput', textarea: 'TextArea', img: 'Image',
  // Native tags that pass through as-is (not HTML → primitive mapping)
  ScrollView: 'ScrollView', Cartridge: 'Cartridge',
};

const namedColors = {
  black: [0,0,0], white: [255,255,255], red: [255,0,0], green: [0,128,0],
  blue: [0,0,255], yellow: [255,255,0], cyan: [0,255,255], magenta: [255,0,255],
  gray: [128,128,128], grey: [128,128,128], silver: [192,192,192],
  orange: [255,165,0], transparent: [0,0,0],
};
