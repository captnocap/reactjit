// ── Smith Pattern Registry ───────────────────────────────────────
//
// Every React/JSX pattern the compiler handles lives in exactly ONE
// file under patterns/. If a pattern isn't here, it isn't supported.
// If you need to add support for a pattern, add it here FIRST, then
// implement in the designated file.
//
// DO NOT put pattern logic anywhere else. DO NOT inline regex matching
// in consumer files. Consumers call these functions.
//
// Groups mirror React's rendering model:
//   primitives/        — literal values in JSX
//   ternary/           — conditional expressions
//   logical/           — &&, ||, ?? operators
//   map/               — array.map() rendering
//   filter_sort/       — filter/sort/reduce before render
//   array_construction/— Array.from, Object.keys, spread concat
//   props/             — prop passing patterns
//   children/          — children composition
//   component_ref/     — component resolution
//   conditional_rendering/ — if/else/switch before return
//   composition/       — HOC, context, portals, slots
//   hooks/             — hook values flowing into JSX
//   keys/              — key assignment patterns
//   style/             — inline styles, className
//   events/            — event handler patterns
//   strings/           — template literals, concatenation
//   type_narrowing/    — typeof, optional chaining, guards
//   misc_jsx/          — innerHTML, data attrs, comments, SVG

// ── Pattern Status ──
// Each pattern file exports: { id, name, status, match, compile }
//   status: 'stub' | 'partial' | 'complete' | 'not_applicable'
//   match(tokens, ctx): boolean — does this token sequence match?
//   compile(tokens, ctx): string — emit Zig for this pattern

var patterns = {};

// ── Primitives (1-10) ──
patterns[1]  = require('./primitives/p001_string_literal');
patterns[2]  = require('./primitives/p002_number_literal');
patterns[3]  = require('./primitives/p003_boolean_render');
patterns[4]  = require('./primitives/p004_null_render');
patterns[5]  = require('./primitives/p005_undefined_render');
patterns[6]  = require('./primitives/p006_jsx_element');
patterns[7]  = require('./primitives/p007_fragment');
patterns[8]  = require('./primitives/p008_named_fragment');
patterns[9]  = require('./primitives/p009_variable_interpolation');
patterns[10] = require('./primitives/p010_expression_interpolation');

// ── Ternary (11-15) ──
// patterns[11] = require('./ternary/p011_ternary_element');
// patterns[12] = require('./ternary/p012_ternary_null');
// patterns[13] = require('./ternary/p013_ternary_string');
// patterns[14] = require('./ternary/p014_ternary_nested');
// patterns[15] = require('./ternary/p015_ternary_fragment');

// ── Logical (16-18) ──
// patterns[16] = require('./logical/p016_and_short_circuit');
// patterns[17] = require('./logical/p017_or_fallback');
// patterns[18] = require('./logical/p018_nullish_fallback');

// ── Map (19-29) ──
// patterns[19] = require('./map/p019_map_element');
// patterns[20] = require('./map/p020_map_fragment');
// patterns[21] = require('./map/p021_map_nested');
// patterns[22] = require('./map/p022_map_ternary');
// patterns[23] = require('./map/p023_map_and_filter');
// patterns[24] = require('./map/p024_map_index_key');
// patterns[25] = require('./map/p025_map_stable_key');
// patterns[26] = require('./map/p026_map_compound_key');
// patterns[27] = require('./map/p027_map_destructured');
// patterns[28] = require('./map/p028_map_implicit_return');
// patterns[29] = require('./map/p029_map_explicit_return');

// ── Filter/Sort/Reduce (30-38) ──
// patterns[30] = require('./filter_sort/p030_filter_map');
// patterns[31] = require('./filter_sort/p031_sort_map');
// patterns[32] = require('./filter_sort/p032_filter_sort_map');
// patterns[33] = require('./filter_sort/p033_reduce_jsx');
// patterns[34] = require('./filter_sort/p034_slice_map');
// patterns[35] = require('./filter_sort/p035_slice_show_more');
// patterns[36] = require('./filter_sort/p036_flat_map');
// patterns[37] = require('./filter_sort/p037_flatmap_element');
// patterns[38] = require('./filter_sort/p038_spread_concat_map');

// ── Array Construction (39-46) ──
// patterns[39] = require('./array_construction/p039_array_fill_map');
// patterns[40] = require('./array_construction/p040_array_from_map');
// patterns[41] = require('./array_construction/p041_spread_array_map');
// patterns[42] = require('./array_construction/p042_object_keys_map');
// patterns[43] = require('./array_construction/p043_object_values_map');
// patterns[44] = require('./array_construction/p044_object_entries_map');
// patterns[45] = require('./array_construction/p045_map_entries');
// patterns[46] = require('./array_construction/p046_set_to_array_map');

// ── Props (47-65) ──
// patterns[47] = require('./props/p047_string_prop');
// patterns[48] = require('./props/p048_number_prop');
// patterns[49] = require('./props/p049_boolean_shorthand');
// patterns[50] = require('./props/p050_boolean_explicit');
// patterns[51] = require('./props/p051_expression_prop');
// patterns[52] = require('./props/p052_callback_prop');
// patterns[53] = require('./props/p053_callback_with_args');
// patterns[54] = require('./props/p054_spread_props');
// patterns[55] = require('./props/p055_spread_override');
// patterns[56] = require('./props/p056_computed_prop_name');
// patterns[57] = require('./props/p057_object_prop');
// patterns[58] = require('./props/p058_array_prop');
// patterns[59] = require('./props/p059_jsx_prop');
// patterns[60] = require('./props/p060_render_prop');
// patterns[61] = require('./props/p061_function_as_children');
// patterns[62] = require('./props/p062_destructured_signature');
// patterns[63] = require('./props/p063_default_prop_values');
// patterns[64] = require('./props/p064_rest_props');
// patterns[65] = require('./props/p065_forwarded_ref');

// ── Children (66-72) ──
// patterns[66] = require('./children/p066_single_child');
// patterns[67] = require('./children/p067_multiple_children');
// patterns[68] = require('./children/p068_string_children');
// patterns[69] = require('./children/p069_expression_children');
// patterns[70] = require('./children/p070_mixed_children');
patterns[71] = require('./children/p071_array_children');
patterns[72] = require('./children/p072_no_children');

// ── Component Reference (73-80) ──
patterns[73] = require('./component_ref/p073_direct_component');
patterns[74] = require('./component_ref/p074_dot_notation');
patterns[75] = require('./component_ref/p075_dynamic_variable');
patterns[76] = require('./component_ref/p076_dynamic_ternary');
patterns[77] = require('./component_ref/p077_create_element');
patterns[78] = require('./component_ref/p078_clone_element');
patterns[79] = require('./component_ref/p079_lazy_component');
patterns[80] = require('./component_ref/p080_suspense');

// ── Conditional Rendering (81-85) ──
// patterns[81] = require('./conditional_rendering/p081_if_else_early_return');
// patterns[82] = require('./conditional_rendering/p082_guard_null');
// patterns[83] = require('./conditional_rendering/p083_switch_return');
// patterns[84] = require('./conditional_rendering/p084_object_lookup');
// patterns[85] = require('./conditional_rendering/p085_iife');

// ── Composition (86-93) ──
// patterns[86] = require('./composition/p086_wrapper');
// patterns[87] = require('./composition/p087_hoc');
// patterns[88] = require('./composition/p088_forwarded_ref');
// patterns[89] = require('./composition/p089_context_provider');
// patterns[90] = require('./composition/p090_context_consumer');
// patterns[91] = require('./composition/p091_portal');
// patterns[92] = require('./composition/p092_error_boundary');
// patterns[93] = require('./composition/p093_slot_pattern');

// ── Hooks (94-100) ──
// patterns[94] = require('./hooks/p094_usestate_value');
// patterns[95] = require('./hooks/p095_usereducer_dispatch');
// patterns[96] = require('./hooks/p096_usememo_computed');
// patterns[97] = require('./hooks/p097_usecallback_handler');
// patterns[98] = require('./hooks/p098_useref_current');
// patterns[99] = require('./hooks/p099_useid_generated');
// patterns[100] = require('./hooks/p100_custom_hook');

// ── Keys (101-104) ──
// patterns[101] = require('./keys/p101_key_element');
// patterns[102] = require('./keys/p102_key_fragment');
// patterns[103] = require('./keys/p103_key_remount');
// patterns[104] = require('./keys/p104_missing_key');

// ── Style (105-114) ──
// patterns[105] = require('./style/p105_inline_object');
// patterns[106] = require('./style/p106_computed_inline');
// patterns[107] = require('./style/p107_classname_string');
// patterns[108] = require('./style/p108_classname_ternary');
// patterns[109] = require('./style/p109_classname_template');
// patterns[110] = require('./style/p110_classname_array_join');
// patterns[111] = require('./style/p111_classnames_utility');
// patterns[112] = require('./style/p112_css_module');
// patterns[113] = require('./style/p113_css_in_js_template');
// patterns[114] = require('./style/p114_css_in_js_object');

// ── Events (115-120) ──
// patterns[115] = require('./events/p115_inline_arrow');
// patterns[116] = require('./events/p116_bound_method');
// patterns[117] = require('./events/p117_event_param');
// patterns[118] = require('./events/p118_prevent_default');
// patterns[119] = require('./events/p119_closure_map_item');
// patterns[120] = require('./events/p120_synthetic_parent');

// ── Strings (121-124) ──
// patterns[121] = require('./strings/p121_template_literal_jsx');
// patterns[122] = require('./strings/p122_template_literal_prop');
// patterns[123] = require('./strings/p123_string_concat');
// patterns[124] = require('./strings/p124_array_join');

// ── Type Narrowing (125-131) ──
// patterns[125] = require('./type_narrowing/p125_typeof_gate');
// patterns[126] = require('./type_narrowing/p126_array_isarray');
// patterns[127] = require('./type_narrowing/p127_prop_in_obj');
// patterns[128] = require('./type_narrowing/p128_optional_chaining');
// patterns[129] = require('./type_narrowing/p129_non_null_assertion');
// patterns[130] = require('./type_narrowing/p130_type_predicate');
// patterns[131] = require('./type_narrowing/p131_discriminated_union');

// ── Misc JSX (132-140) ──
// patterns[132] = require('./misc_jsx/p132_dangerously_set_html');
// patterns[133] = require('./misc_jsx/p133_spread_dom_attrs');
// patterns[134] = require('./misc_jsx/p134_data_attributes');
// patterns[135] = require('./misc_jsx/p135_aria_attributes');
// patterns[136] = require('./misc_jsx/p136_svg_elements');
// patterns[137] = require('./misc_jsx/p137_namespaced_attrs');
// patterns[138] = require('./misc_jsx/p138_jsx_comment');
// patterns[139] = require('./misc_jsx/p139_multiline_parens');
// patterns[140] = require('./misc_jsx/p140_adjacent_fragment');

module.exports = patterns;
