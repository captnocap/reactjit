/*
 * Custom FreeType module list for iLoveReact.
 *
 * Only registers modules needed for modern TTF/OTF rendering.
 * Excluded (not needed for Love2D fonts):
 *   - bdf, pcf, winfnt       — legacy bitmap/Windows font formats
 *   - pfr, t42, t1cid        — rare/obsolete PostScript variants
 *   - sdf, bitmap_sdf        — SDF rendering (we use smooth renderer)
 *   - svg                    — OT-SVG (requires external rasterizer)
 *
 * Included:
 *   autofit    — auto-hinting (essential for clean TTF rendering)
 *   truetype   — TTF/TTC font driver
 *   type1      — PostScript Type 1 fonts
 *   cff        — OpenType/CFF (OTF) font driver
 *   psaux      — shared PS/CFF primitives
 *   psnames    — PS glyph name lookup
 *   pshinter   — PostScript hinting for type1/cff
 *   sfnt       — shared SFNT table support (TTF+OTF)
 *   smooth     — anti-aliased (grey) rasterizer
 *   raster1    — monochrome rasterizer
 */

FT_USE_MODULE( FT_Module_Class, autofit_module_class )
FT_USE_MODULE( FT_Driver_ClassRec, tt_driver_class )
FT_USE_MODULE( FT_Driver_ClassRec, t1_driver_class )
FT_USE_MODULE( FT_Driver_ClassRec, cff_driver_class )
FT_USE_MODULE( FT_Module_Class, psaux_module_class )
FT_USE_MODULE( FT_Module_Class, psnames_module_class )
FT_USE_MODULE( FT_Module_Class, pshinter_module_class )
FT_USE_MODULE( FT_Module_Class, sfnt_module_class )
FT_USE_MODULE( FT_Renderer_Class, ft_smooth_renderer_class )
FT_USE_MODULE( FT_Renderer_Class, ft_raster1_renderer_class )

/* EOF */
