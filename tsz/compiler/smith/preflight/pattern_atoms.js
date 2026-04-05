// ── Pattern → Atom mapping table ────────────────────────────────
//
// Static mapping from source-level features (detected during route scan)
// to the emit atoms they will trigger. The route scanner uses this to
// predict the full emit path before parse/emit run.
//
// This is NOT pattern-ID → atom-ID (patterns are parse-time constructs).
// This is feature-flag → atom-set: "if the source has maps, these atoms fire."
//
// The atom registry has 46 atoms. Some are always-on (preamble, entry,
// finalize). The interesting ones are gated on ctx fields that the
// route scanner can predict from source scanning.

// Feature flags → atom IDs that fire when the flag is true.
// Always-on atoms (1,2,3,5,33,34,35,39,40,41,42,46) are not listed —
// they fire unconditionally on every compile.
var FEATURE_ATOMS = {
  // State slots detected in source
  has_state: [4],                    // a004: state_manifest

  // Array declarations (node tree)
  has_node_arrays: [6],              // a006: static_node_arrays

  // Root expression (always true for valid source, but tracked)
  has_root_expr: [7],                // a007: root_node_init

  // Dynamic text bindings
  has_dyn_texts: [8],                // a008: dynamic_text_buffers

  // Event handlers (non-map)
  has_handlers: [9],                 // a009: non_map_handlers

  // CPU effect renderers
  has_effects: [10, 11],             // a010: cpu_effect_renderers, a011: wgsl_effect_shaders

  // Object arrays
  has_object_arrays: [12, 13],       // a012: qjs_bridge, a013: oa_string_helpers
  has_const_oa: [14],                // a014: oa_const_storage
  has_dynamic_oa: [15, 16],          // a015: oa_dynamic_storage, a016: oa_flat_unpack
  has_nested_oa: [17],               // a017: oa_nested_unpack

  // Variant bindings
  has_variants: [18, 37],            // a018: variant_host_setter, a037: variant_updates

  // Maps (any)
  has_maps: [19],                    // a019: map_metadata (computes, no output)

  // Flat maps (not nested, not inline)
  has_flat_maps: [20, 26],           // a020: flat_map_pool_decls, a026: flat_map_rebuild

  // Nested maps
  has_nested_maps: [21, 27],         // a021: nested_map_pool_decls, a027: nested_map_rebuild

  // Inline maps
  has_inline_maps: [22, 28],         // a022: inline_map_pool_decls, a028: inline_map_rebuild

  // Map sub-features
  has_map_arrays: [23],              // a023: map_per_item_arrays
  has_map_dyn_texts: [24],           // a024: map_dynamic_text_storage
  has_map_handlers: [25],            // a025: map_handler_ptrs

  // Lua maps
  has_lua_maps: [29, 30, 31, 32],   // a029-a032: lua map wrapper/rebuilder/nested/dispatch

  // Conditionals
  has_conditionals: [36],            // a036: conditional_updates

  // Runtime dirty tick (state OR OAs OR lua maps)
  has_runtime_tick: [38],            // a038: runtime_dirty_tick

  // Split output mode
  has_split_output: [43, 44, 45],    // a043-a045: split section/namespace/headers
};

// Always-on atoms — fire on every compile regardless of source content.
var ALWAYS_ON_ATOMS = [1, 2, 3, 5, 33, 34, 35, 39, 40, 41, 42, 46];

// Given a set of feature flags (from route scan), return the full list
// of atom IDs that will fire during emit.
function predictAtomSet(features) {
  var atoms = ALWAYS_ON_ATOMS.slice();
  for (var key in features) {
    if (features[key] && FEATURE_ATOMS[key]) {
      var fAtoms = FEATURE_ATOMS[key];
      for (var i = 0; i < fAtoms.length; i++) {
        if (atoms.indexOf(fAtoms[i]) < 0) atoms.push(fAtoms[i]);
      }
    }
  }
  atoms.sort(function(a, b) { return a - b; });
  return atoms;
}
