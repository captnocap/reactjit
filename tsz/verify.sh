#!/bin/bash

# Array of all targets (without .tsz extension)
targets=(
    "01_flex_direction_row"
    "02_flex_direction_column"
    "03_justify_content"
    "04_align_items"
    "05_flex_grow"
    "06_flex_shrink"
    "07_flex_wrap"
    "08_gap"
    "09_align_self"
    "10_flex_basis"
    "11_padding_margin"
    "12_min_max_constraints"
    "13_nested_flex"
    "14_percentage_sizing"
    "15_grow_no_space"
    "16_content_sizing"
    "17_justify_single_item"
    "18_shrink_basis_interaction"
    "19_wrap_align_justify"
    "20_real_world_layouts"
    "21_zero_size_items"
    "22_column_justify"
    "23_deep_nesting"
    "24_overflow_clipping"
    "25_grow_shrink_column"
    "26_gap_with_justify"
    "27_many_items"
    "28_mixed_units"
    "29_full_page_layout"
    "30_align_stretch_sizing"
    "31_padding_all_sides"
    "32_margin_collapse"
    "33_flex_basis_zero_vs_auto"
    "34_wrap_multiline_height"
    "35_complex_dashboard"
    "36_margin_auto"
    "37_absolute_in_flex"
    "38_flex_basis_content"
    "39_wrap_reverse"
    "40_order_property"
    "41_aspect_ratio"
    "42_shrink_min_width"
    "43_stretch_explicit_height"
    "44_grow_with_padding"
    "45_nested_percentage"
    "46_wrap_row_col_gap"
    "47_intrinsic_sizing"
    "48_border_box_flex"
    "49_mixed_fixed_grow"
    "50_column_wrap_height"
    "51_border_radius_all_corners"
    "52_opacity"
    "53_overflow_hidden"
    "54_z_index_stacking"
    "58_border_styles"
    "59_text_styling"
    "61_tw_layout"
    "62_tw_spacing"
    "63_tw_colors"
    "64_tw_sizing"
    "65_tw_typography"
    "66_align_content"
    "67_flex_shorthand"
    "68_aspect_ratio_flex"
    "69_min_max_content"
    "70_flex_interaction_stress"
    "71_flex_direction_reverse"
    "72_row_col_gap"
    "73_align_items_baseline"
    "75_text_align_justify"
)

# Counter for progress tracking
total=${#targets[@]}
current=1

# Loop through each target
for target in "${targets[@]}"; do
    echo "[$current/$total] Verifying: $target"
    
    # Run the conformance report command
    ./scripts/conformance-report --verify "$target"
    
    # Check if command succeeded
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed on target $target"
        exit 1
    fi
    
    ((current++))
done

echo "All $total targets verified successfully!"
