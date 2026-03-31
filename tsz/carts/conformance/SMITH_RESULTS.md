# SMITH CONFORMANCE — Forge+Smith vs OG Zig Compiler (bin/tsz)
#
# Comparing the new JS-based compiler (1,640 lines) against the
# original 25,000-line Zig compiler for the death test suite.
#
# OG = bin/tsz (frozen reference, all [P] in RESULTS.md)
# Smith = zig-out/bin/forge + compiler/smith_*.js + compiler/smith_{collect,lanes,parse,preflight,emit}/
#
# Status codes:
#   [P] = Pass — compiles, runs, renders correctly
#   [F] = Fail — crashes on launch, broken render, or lint blocked
#   [B] = Blocked — lint catches known bad codegen, build prevented
#   [~] = Partial — renders but buttons/handlers broken
#   [ ] = Untested
#
# Date: 2026-03-27

## SECTION II — Death Tests: Core Patterns (D01–D25)

| Cart | OG | Smith | Blocker |
|------|:--:|:-----:|---------|
| d01_nested_maps | P | P | — |
| d02_component_returning_map | P | P | — |
| d03_conditional_wrapping_map | P | P | — |
| d04_map_handler_captures | P | P | — |
| d05_dynamic_style_in_map | P | P | — |
| d06_ternary_jsx_branches | P | P | — |
| d07_sibling_maps_shared_state | P | P | — |
| d08_map_classifier_components | P | P | — |
| d09_nested_template_scope | P | P | — |
| d10_handler_triple_capture | P | P | — |
| d11_map_component_map | P | B | lua_on_press string literal in map rebuild |
| d12_kanban_evil | P | B | multi-handler per map + shared static arrays |
| d13_schema_form | P | B | multi-handler per map |
| d14_multiple_instances | P | F | component instance state sharing (1 slot for all instances) |
| d15_unmount_remount | P | P | — |
| d16_state_stress | P | P | — |
| d17_map_conditional_card | P | F | shared static arrays + unused _map_lua_ptrs |
| d18_array_mutation | P | F | untested |
| d19_polymorphic_map | P | F | untested |
| d20_multi_handler_map | P | F | untested |
| d21_nested_object_access | P | F | nested objects not parsed + conditional-in-map scope |
| d22_index_math | P | ~ | builds, Color{} + shared arrays |
| d23_empty_array | P | F | imported script functions not registered |
| d24_chained_state | P | F | imported script funcs + Color{} + template literals |
| d25_map_conditional_classifier | P | F | untested |

## SECTION III — Death Tests: Script Runtimes (D26–D33)

| Cart | OG | Smith | Blocker |
|------|:--:|:-----:|---------|
| d26a_timer_script | P | P | — |
| d26b_timer_zscript | P | | untested |
| d27a_array_methods_script | P | B | raw JS in LUA_LOGIC |
| d27b_array_methods_zscript | P | | untested |
| d28a_string_ops_script | P | F | crash |
| d28b_string_ops_zscript | P | | untested |
| d29a_json_parse_script | P | F | crash |
| d29b_json_parse_zscript | P | | untested |
| d30a_math_derived_script | P | F | crash |
| d30b_math_derived_zscript | P | | untested |
| d31a_state_machine_script | P | ~ | crash on button press |
| d31b_state_machine_zscript | P | | untested |
| d32_deep_nesting | P | B | duplicate __mapPress + shared static arrays |
| d33_extreme_nesting | P | B | same as d32 |

## SECTION IV — Death Tests: Language Features (D34–D60)

| Cart | OG | Smith | Blocker |
|------|:--:|:-----:|---------|
| d34_switch_forof_while | P | B | raw JS in LUA_LOGIC |
| d35_jsx_fragments | P | P | — |
| d36_nullish_bitwise | P | P | — |
| d37_destructuring | P | B | raw JS in LUA_LOGIC + shared map arrays |
| d38_arrow_default_params | P | B | raw JS in LUA_LOGIC |
| d39_declare_function | P | B | raw JS in LUA_LOGIC |
| d40_type_annotations | P | B | raw JS in LUA_LOGIC |
| d41_multi_component_props | P | F | shared static arrays + template literal props |
| d42_export_import | P | B | raw JS in LUA_LOGIC + shared map arrays |
| d43_html_tags | P | P | — |
| d44_classifier_styles | P | ~ | shared static arrays + unused _map_lua_ptrs |
| d45_union_type_alias | P | ~ | shared static arrays + Color{} |
| d46_multiline_comments | P | P | — |
| d47_nested_ternary | P | F | crash |
| d48_complex_template_literals | P | B | raw JS in LUA_LOGIC |
| d49_string_state | P | P | — |
| d50_boolean_state | P | P | — |
| d51_computed_access | F | P | — |
| d52_multi_handler_state | F | P | — |
| d53_compound_conditionals | P | B | raw JS in LUA_LOGIC + Color{} |
| d54_util_functions | P | F | untested |
| d55_deeply_nested_objects | P | F | deep object field access |
| d56_multiple_maps_nested | P | P | — |
| d57_children_prop | P | P | — |
| d58_dynamic_styles | P | F | untested |
| d59_large_array | P | F | untested |
| d60_component_reuse | P | P | — |

## SECTION V — Death Tests: Advanced & Integration (D61–D83)

| Cart | OG | Smith | Blocker |
|------|:--:|:-----:|---------|
| d61_map_ternary_branch | P | B | JS strings leaked + Color{} |
| d62_negative_numbers | F | F | untested |
| d63_empty_states | P | F | untested |
| d64_multi_import | F | F | untested |
| d65_component_8_props | P | F | untested |
| d66_chained_calls | P | F | untested |
| d67_conditional_in_map_component | F | F | untested |
| d68_todo_app | P | F | untested |
| d69_chat_ui | P | F | untested |
| d70_strict_equality | P | F | === not handled |
| d71_increment_decrement | P | F | untested |
| d72_typeof_operator | P | F | untested |
| d73_undefined_checks | P | F | untested |
| d74_optional_chaining | P | F | deep object access |
| d75_throw_try_catch | P | F | === not handled |
| d76_new_expression | P | P | — |
| d77_do_while | P | P | — |
| d78_for_in | P | P | — |
| d79_shorthand_properties | P | P | — |
| d80_logical_assignment | P | P | — |
| d81_rest_spread_params | P | P | — |
| d82_string_methods_chain | P | P | — |
| d83_array_methods | P | P | — |

## SECTION V.5 — Death Tests: Stress & Integration (D84–D104)

| Cart | OG | Smith | Blocker |
|------|:--:|:-----:|---------|
| d84_nested_component_state | P | F | broken (works as d51 somehow) |
| d85_math_heavy | P | B | unescaped quotes + Color{} |
| d86_settings_page | | F | non-onPress handler props |
| d87_kanban_lite | | F | non-onPress handler props |
| d88_data_table | | F | untested |
| d89_calculator | | F | non-onPress handler props |
| d90_spreadsheet | | F | untested |
| d91_file_explorer | | F | untested |
| d92_state_machine_complex | | F | untested |
| d93_dashboard_full | | F | untested |
| d94_react_from_hell | | F | untested |
| d95_cherry_studio | | F | untested |
| d96_const_array_map | | F | untested |
| d96_graph_map_expr_attrs | | F | Graph.Path dot-name tag |
| d97_jsx_prop_spread | | F | {...obj} spread not handled |
| d98_callback_prop_chain | | F | non-onPress handler props |
| d99_recursive_tree_component | | F | forge crash (recursive component) |
| d100_named_slots | | F | JSX-as-prop-value |
| d101_filter_sort_map_render | | F | chained .filter().sort().map() |
| d102_ternary_hex_styles | P | P | — |
| d103_inline_glyphs | | F | untested |
| d103_ternary_array_sizing | | F | ternary child array sizing |
| d104_graph_layout | | F | Graph.Path dot-name tag |

---

## Summary

| | OG (bin/tsz) | Smith (forge) |
|---|:---:|:---:|
| **Pass** | 128 | 32 |
| **Fail/Blocked** | 5 | ~55 |
| **Untested** | many | many |

## Top Blockers (fix count = carts unblocked)

| Root Cause | Carts Blocked | Status |
|------------|:---:|--------|
| Raw JS in LUA_LOGIC | ~10 | **FIXED** (pane 5) — needs retest |
| Shared static arrays in maps | ~10 | In progress (pane 5) |
| Multi-handler per map naming | ~4 | **FIXED** (pane 5) — needs retest |
| Imported script funcs not registered | ~3 | Not started |
| Component instance state sharing | 1 (d14) | Not started |
| === / !== in JSX conditions | ~2+ | Not started |
| Non-onPress handler props | ~4 | Not started |
| Nested object field access | ~2 | Not started |
| Graph.Path dot-name JSX tag | ~3 | Not started |
| Ternary in style attributes | ~7 | Not started |

## Code Size Comparison

| | OG Compiler | Smith Compiler |
|---|:---:|:---:|
| Lines of code | ~25,000 Zig | ~1,640 JS + ~240 Zig |
| Kill ratio | — | **15:1** |
