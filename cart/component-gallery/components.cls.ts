/**
 * Component-gallery classifier sheet.
 *
 * Single-primitive classifiers bound to cockpit theme tokens. Components
 * consume `<S.Foo>`; raw `<Box style={...}>` is forbidden in this cart
 * (gate enforces).
 *
 * Token namespace (set by cart/component-gallery/gallery-theme.ts → runtime):
 *
 *   Colors (strings):
 *     bg / bg1 / bg2                  surfaces
 *     paper / paperAlt / paperInk
 *     paperInkDim / paperRule
 *     paperRuleBright                 paper content tier
 *     ink / inkDim / inkDimmer        text
 *     inkGhost
 *     rule / ruleBright               borders
 *     accent / accentHot              accent
 *     ok / warn / flag                state signals
 *     lilac / blue                    auxiliary
 *     sys / ctx / usr / ast / atch    data channels
 *     tool / wnd / pin
 *     gridDot / gridDotStrong         decorative
 *     fontMono / fontSans             font families (string)
 *
 *   Numbers (style palette):
 *     typeMicro(7) typeTiny(8) typeCaption(9) typeBody(10)
 *     typeBase(11) typeMeta(12) typeStrong(14) typeHeading(18)
 *     radiusSm(4) radiusMd(6) radiusLg(8) radiusXl(10) radiusPill(99) radiusRound(999)
 *     spaceX0(1) spaceX1(2) spaceX2(4) spaceX3(6) spaceX4(8) spaceX5(10)
 *     spaceX6(12) spaceX7(16) spaceX8(18)
 *     chromeTopbar(28) chromeStatusbar(22) chromeTileHead(20) chromeStrip(28)
 *     lineHeight(1.35)
 *
 * Authoring rules (load-bearing):
 *   • One classifier = one primitive. No children logic, no slots.
 *   • Compose by stacking <S.Foo><S.Bar/></S.Foo> in JSX.
 *   • All colors via 'theme:NAME'. No hex literals here.
 *   • Numeric style values via 'theme:NAME' where the token exists.
 *   • Existing structural names (TypeMicro, InlineX*, StackX*, BareGraph,
 *     Spacer, HalfPress, DotSm, DotMd, RoundPill, ChipRound) are preserved
 *     by name — many components already consume them. Their values were
 *     token-ified in place.
 */

import { classifier } from '@reactjit/core';

classifier({

  // ══════════════════════════════════════════════════════════════
  //   Page shell + chrome
  // ══════════════════════════════════════════════════════════════

  // Full-viewport container.
  Page: { type: 'Box', style: {
    width: '100%', height: '100%',
    backgroundColor: 'theme:bg',
  }},

  // Pinned top: icon + title + badge + spacer + subtitle.
  StoryHeader: { type: 'Box', style: { flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: 'theme:bg1',
    borderBottomWidth: 1,
    borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX7',
  }},

  // Pinned bottom: breadcrumb path.
  StoryFooter: { type: 'Box', style: { flexDirection: 'row',
    flexShrink: 0,
    backgroundColor: 'theme:bg1',
    borderTopWidth: 1,
    borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX3', paddingBottom: 'theme:spaceX3',
    gap: 'theme:spaceX6',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Bands (story content rows)
  // ══════════════════════════════════════════════════════════════

  // Accent left-border, full-width hero intro.
  Hero: { type: 'Box', style: {
    borderLeftWidth: 3,
    borderColor: 'theme:accent',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX4',
  }},

  // Two-column band (zigzag layout row).
  Band: { type: 'Box', style: { flexDirection: 'row',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX7',
  }},

  // One side of a Band (50/50 split).
  Half: { type: 'Box', style: {
    flexGrow: 1, flexBasis: 0,
    gap: 'theme:spaceX4',
  }},

  HalfCenter: { type: 'Box', style: {
    flexGrow: 1, flexBasis: 0,
    gap: 'theme:spaceX4',
    alignItems: 'center', justifyContent: 'center',
  }},

  // Full-width band (no split).
  FullBand: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX7', paddingBottom: 'theme:spaceX7',
    gap: 'theme:spaceX4',
  }},

  // Highlighted insight strip.
  Callout: { type: 'Box', style: { flexDirection: 'row',
    backgroundColor: 'theme:bg1',
    borderLeftWidth: 3,
    borderColor: 'theme:blue',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX4',
    alignItems: 'center',
  }},

  // Warning band.
  Warn: { type: 'Box', style: { flexDirection: 'row',
    backgroundColor: 'theme:bg1',
    borderLeftWidth: 3,
    borderColor: 'theme:warn',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX6', paddingBottom: 'theme:spaceX6',
    gap: 'theme:spaceX4',
    alignItems: 'center',
  }},

  // Horizontal divider.
  Divider: { type: 'Box', style: {
    height: 1, flexShrink: 0,
    backgroundColor: 'theme:rule',
  }},

  // Vertical divider.
  VertDivider: { type: 'Box', style: {
    width: 1, flexShrink: 0,
    backgroundColor: 'theme:rule',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Surfaces (cards, wells, etc.)
  // ══════════════════════════════════════════════════════════════

  // Padded card surface w/ radius+gap. Compose with CardHeader/CardBody.
  Card: { type: 'Box', style: {
    flexDirection: 'column',
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusLg',
    gap: 'theme:spaceX4',
  }},

  // Card header row: title + spacer + badge.
  CardHeader: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    gap: 'theme:spaceX4',
  }},

  // Card body column.
  CardBody: { type: 'Box', style: {
    gap: 'theme:spaceX3',
  }},

  // Recessed surface (paper-style).
  Surface: { type: 'Box', style: {
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusMd',
  }},

  // Alternate-tier surface (paperAlt-style).
  SurfaceAlt: { type: 'Box', style: {
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusMd',
  }},

  // Elevated demo well — for interactive previews.
  Well: { type: 'Box', style: {
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderRadius: 'theme:radiusLg',
    gap: 'theme:spaceX5',
  }},

  // Recessed input area for displaying values.
  InputWell: { type: 'Box', style: {
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    padding: 'theme:spaceX3',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Sections + section labels
  // ══════════════════════════════════════════════════════════════

  Section: { type: 'Box', style: {
    gap: 'theme:spaceX6',
  }},

  SectionBody: { type: 'Box', style: {
    gap: 'theme:spaceX4',
  }},

  SectionLabel: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX3',
  }},

  KV: { type: 'Box', style: { flexDirection: 'row',
    gap: 'theme:spaceX3',
    alignItems: 'flex-start',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Buttons (Pressable)
  // ══════════════════════════════════════════════════════════════

  Button: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    backgroundColor: 'theme:accent',
  }},

  ButtonOutline: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    borderWidth: 1, borderColor: 'theme:rule',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Badges
  // ══════════════════════════════════════════════════════════════

  BadgeNeutral: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  BadgeAccent: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
  }},

  BadgeSuccess: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:ok',
  }},

  BadgeError: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:flag',
  }},

  BadgeWarning: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:warn',
  }},

  BadgeInfo: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:blue',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Pills + chips + dots
  // ══════════════════════════════════════════════════════════════

  Chip: { type: 'Box', style: {
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
  }},

  NavPill: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
  }},

  NavPillActive: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  Dot: { type: 'Box', style: {
    width: 'theme:spaceX3', height: 'theme:spaceX3',
    borderRadius: 'theme:radiusSm',
    flexShrink: 0,
  }},

  // Progress track.
  Track: { type: 'Box', style: {
    width: '100%', height: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg2',
  }},

  // Progress fill.
  Fill: { type: 'Box', style: {
    height: 'theme:spaceX2',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
  }},

  // ══════════════════════════════════════════════════════════════
  //   Typography roles
  // ══════════════════════════════════════════════════════════════

  Title:        { type: 'Text', size: 'theme:typeHeading', bold: true, color: 'theme:ink' },
  Headline:     { type: 'Text', size: 'theme:typeStrong',  bold: true, color: 'theme:ink' },
  Heading:      { type: 'Text', size: 'theme:typeStrong',  bold: true, color: 'theme:ink' },
  Subheading:   { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:ink' },
  Body:         { type: 'Text', size: 'theme:typeBody',    color: 'theme:ink' },
  BodyDim:      { type: 'Text', size: 'theme:typeBody',    color: 'theme:inkDim' },
  Muted:        { type: 'Text', size: 'theme:typeBody',    color: 'theme:inkDim' },
  Caption:      { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  TinyDim:      { type: 'Text', size: 'theme:typeTiny',    color: 'theme:inkDim' },
  MicroDim:     { type: 'Text', size: 'theme:typeMicro',   color: 'theme:inkDim' },
  Label:        { type: 'Text', size: 'theme:typeTiny',    bold: true, color: 'theme:inkDim',
                  style: { letterSpacing: 'theme:lsWide' } },
  Code:         { type: 'Text', size: 'theme:typeCaption', color: 'theme:accent',
                  style: { fontFamily: 'theme:fontMono' } },
  Error:        { type: 'Text', size: 'theme:typeBody',    color: 'theme:flag' },

  // Button-shaped texts.
  ButtonLabel:        { type: 'Text', size: 'theme:typeBody', bold: true, color: 'theme:bg' },
  ButtonOutlineLabel: { type: 'Text', size: 'theme:typeBody', color: 'theme:ink' },

  // Badge texts.
  BadgeNeutralText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  BadgeAccentText:  { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeSuccessText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeErrorText:   { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeWarningText: { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },
  BadgeInfoText:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:bg' },

  // Footer breadcrumb.
  Breadcrumb:       { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  BreadcrumbActive: { type: 'Text', size: 'theme:typeCaption', color: 'theme:ink' },

  // ══════════════════════════════════════════════════════════════
  //   Code block + syntax atoms
  // ══════════════════════════════════════════════════════════════

  CodeBlockFrame: { type: 'Box', style: {
    flexDirection: 'column',
    width: '100%',
    minWidth: 0,
    backgroundColor: 'theme:bg2',
    borderWidth: 1,
    borderColor: 'theme:rule',
    borderRadius: 'theme:radiusLg',
    overflow: 'hidden',
  }},

  CodeBlockHeader: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'theme:spaceX5',
    backgroundColor: 'theme:bg1',
    borderBottomWidth: 1,
    borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
  }},

  CodeBlockMeta: { type: 'Box', style: {
    minWidth: 0,
    gap: 'theme:spaceX1',
  }},

  CodeBlockBadge: { type: 'Box', style: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'theme:ruleBright',
    borderRadius: 'theme:radiusSm',
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    backgroundColor: 'theme:bg2',
  }},

  CodeBlockBody: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX5', paddingRight: 'theme:spaceX5',
    paddingTop: 'theme:spaceX5', paddingBottom: 'theme:spaceX5',
    gap: 'theme:spaceX1',
  }},

  CodeBlockScroll: { type: 'ScrollView', showScrollbar: true, style: {
    width: '100%',
    maxHeight: 360,
  }},

  CodeLine: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 'theme:spaceX4',
    minHeight: 16,
    minWidth: 0,
    borderRadius: 'theme:radiusSm',
  }},

  CodeLineEmphasis: { type: 'Box', style: { flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 'theme:spaceX4',
    minHeight: 16,
    minWidth: 0,
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:bg1',
  }},

  CodeLineNumber: { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDimmer',
                    style: { width: 28, textAlign: 'right', fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  CodeLineContent: { type: 'Box', style: { flexDirection: 'row', gap: 0, minWidth: 0 } },
  CodeBlockTitle: { type: 'Text', size: 'theme:typeBase', bold: true, color: 'theme:ink',
                    style: { fontFamily: 'theme:fontSans' } },
  CodeBlockSubtle: { type: 'Text', size: 'theme:typeTiny', color: 'theme:inkDim',
                     style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  CodeBlockBadgeText: { type: 'Text', size: 'theme:typeTiny', color: 'theme:accent',
                        style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  CodeBlockCopyButton: { type: 'Pressable', style: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'theme:rule',
    borderRadius: 'theme:radiusSm',
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    backgroundColor: 'theme:bg2',
  }},
  CodeBlockCopyText: { type: 'Text', size: 'theme:typeTiny', color: 'theme:inkDim',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },

  SyntaxPlain:       { type: 'Text', size: 'theme:typeCaption', color: 'theme:ink',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxKeyword:     { type: 'Text', size: 'theme:typeCaption', color: 'theme:accent',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxString:      { type: 'Text', size: 'theme:typeCaption', color: 'theme:ok',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxNumber:      { type: 'Text', size: 'theme:typeCaption', color: 'theme:warn',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxComment:     { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDimmer',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre', fontStyle: 'italic' } },
  SyntaxFunction:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:blue',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxType:        { type: 'Text', size: 'theme:typeCaption', color: 'theme:lilac',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxProperty:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:ctx',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxPunctuation: { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxOperator:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:flag',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxTag:         { type: 'Text', size: 'theme:typeCaption', color: 'theme:atch',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },
  SyntaxMeta:        { type: 'Text', size: 'theme:typeCaption', color: 'theme:tool',
                       style: { fontFamily: 'theme:fontMono', whiteSpace: 'pre' } },

  // ══════════════════════════════════════════════════════════════
  //   Icons (Image roles)
  // ══════════════════════════════════════════════════════════════

  HeaderIcon:    { type: 'Image', style: { width: 18, height: 18 } },
  SectionIcon:   { type: 'Image', style: { width: 'theme:spaceX5', height: 'theme:spaceX5' } },
  InfoIcon:      { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' } },
  FooterIcon:    { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:inkDim' },
  Icon8:         { type: 'Image', style: { width: 'theme:spaceX4', height: 'theme:spaceX4' } },
  Icon10:        { type: 'Image', style: { width: 'theme:spaceX5', height: 'theme:spaceX5' } },
  Icon12:        { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' } },
  Icon20:        { type: 'Image', style: { width: 20, height: 20 } },
  DimIcon8:      { type: 'Image', style: { width: 'theme:spaceX4', height: 'theme:spaceX4' },
                   tintColor: 'theme:inkDim' },
  DimIcon12:     { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:inkDim' },
  TextIcon12:    { type: 'Image', style: { width: 'theme:spaceX6', height: 'theme:spaceX6' },
                   tintColor: 'theme:ink' },
  AccentIcon20:  { type: 'Image', style: { width: 20, height: 20 },
                   tintColor: 'theme:accent' },

  // ══════════════════════════════════════════════════════════════
  //   Existing entries — token-ified, names preserved.
  //   These are consumed by ~50 component files already; renaming
  //   would break them. Values now resolve from cockpit theme.
  // ══════════════════════════════════════════════════════════════

  // ── Type ladder (matches theme.type.*) ─────────────────────
  TypeMicro:     { type: 'Text', size: 'theme:typeMicro',   style: { fontFamily: 'theme:fontMono' } },
  TypeMicroBold: { type: 'Text', size: 'theme:typeMicro',   bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeTiny:      { type: 'Text', size: 'theme:typeTiny',    style: { fontFamily: 'theme:fontMono' } },
  TypeTinyBold:  { type: 'Text', size: 'theme:typeTiny',    bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeCaption:   { type: 'Text', size: 'theme:typeCaption', style: { fontFamily: 'theme:fontMono' } },
  TypeBody:      { type: 'Text', size: 'theme:typeBody',    style: { fontFamily: 'theme:fontMono' } },
  TypeBodyBold:  { type: 'Text', size: 'theme:typeBody',    bold: true, style: { fontFamily: 'theme:fontMono' } },
  TypeBase:      { type: 'Text', size: 'theme:typeBase',    style: { fontFamily: 'theme:fontMono' } },

  // ── Inline (Row) rhythm (matches theme.spacing x*) ─────────
  InlineX2:           { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX2' } },
  InlineX3:           { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX3' } },
  InlineX4:           { type: 'Box', style: { flexDirection: 'row', gap: 'theme:spaceX4', alignItems: 'stretch' } },
  InlineX4Center:     { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX4' } },
  InlineX5:           { type: 'Box', style: { flexDirection: 'row', gap: 'theme:spaceX5', alignItems: 'center' } },
  InlineX5Between:    { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 'theme:spaceX5' } },
  InlineX4BetweenFull:{ type: 'Box', style: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 'theme:spaceX4' } },

  // ── Stack (Col) rhythm (matches theme.spacing x*) ──────────
  StackX1:        { type: 'Box', style: { gap: 'theme:spaceX1' } },
  StackX1Center:  { type: 'Box', style: { alignItems: 'center', gap: 'theme:spaceX1' } },
  StackX2:        { type: 'Box', style: { gap: 'theme:spaceX2' } },
  StackX3:        { type: 'Box', style: { gap: 'theme:spaceX3' } },
  StackX4:        { type: 'Box', style: { gap: 'theme:spaceX4' } },
  StackX4Center:  { type: 'Box', style: { alignItems: 'center', gap: 'theme:spaceX4' } },
  StackX5:        { type: 'Box', style: { gap: 'theme:spaceX5' } },
  StackX5Center:  { type: 'Box', style: { gap: 'theme:spaceX5', alignItems: 'center' } },
  StackX6:        { type: 'Box', style: { gap: 'theme:spaceX6' } },

  // ── Radius primitives (matches theme.radius.*) ─────────────
  DotSm:     { type: 'Box', style: { width: 'theme:spaceX4', height: 'theme:spaceX4', borderRadius: 'theme:radiusSm' } },
  DotMd:     { type: 'Box', style: { width: 'theme:spaceX6', height: 'theme:spaceX6', borderRadius: 'theme:radiusMd', borderWidth: 1 } },
  RoundPill: { type: 'Box', style: { borderRadius: 'theme:radiusLg' } },
  ChipRound: { type: 'Box', style: { paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4', paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2', borderRadius: 'theme:radiusMd', borderWidth: 1 } },

  // ── Layout utilities ──────────────────────────────────────
  // Graph with top-left origin, fills parent.
  BareGraph: { type: 'Graph', originTopLeft: true, style: { width: '100%', height: '100%' } },

  Spacer:    { type: 'Box', style: { flexGrow: 1 } },
  HalfPress: { type: 'Pressable', style: { flexGrow: 1, flexBasis: 0 } },

  // ══════════════════════════════════════════════════════════════
  //   Document viewer
  // ══════════════════════════════════════════════════════════════

  // Outer dark frame.
  DocShell: { type: 'Box', style: {
    flexDirection: 'column',
    width: '100%', height: '100%',
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    overflow: 'hidden',
  }},

  // Top toolbar strip.
  DocToolbar: { type: 'Box', style: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%',
    height: 'theme:chromeStrip',
    backgroundColor: 'theme:bg2',
    borderBottomWidth: 1, borderColor: 'theme:rule',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    gap: 'theme:spaceX5',
    flexShrink: 0,
  }},

  // Toolbar slot for the title block (grows to fill).
  DocToolbarTitleSlot: { type: 'Box', style: {
    flexDirection: 'column',
    flexGrow: 1, flexShrink: 1,
    gap: 'theme:spaceX0',
  }},

  // Toolbar icon button (square, outlined).
  DocToolbarBtn: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    borderWidth: 1, borderColor: 'theme:rule',
    alignItems: 'center', justifyContent: 'center',
  }},
  DocToolbarBtnActive: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX3', paddingRight: 'theme:spaceX3',
    paddingTop: 'theme:spaceX1', paddingBottom: 'theme:spaceX1',
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
    alignItems: 'center', justifyContent: 'center',
  }},

  // Document body (toolbar | content split).
  DocBody: { type: 'Box', style: {
    flexDirection: 'row',
    flexGrow: 1, flexShrink: 1,
    width: '100%',
  }},

  // Paper-cream sidebar outline.
  DocOutline: { type: 'Box', style: {
    flexDirection: 'column',
    width: 200,
    flexShrink: 0,
    backgroundColor: 'theme:paper',
    borderRightWidth: 1, borderColor: 'theme:paperRule',
  }},
  DocOutlineHeader: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    paddingTop: 'theme:spaceX5', paddingBottom: 'theme:spaceX3',
    borderBottomWidth: 1, borderColor: 'theme:paperRule',
  }},
  DocOutlineRow: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    borderLeftWidth: 2, borderColor: 'theme:paper',
  }},
  DocOutlineRowActive: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    backgroundColor: 'theme:paperAlt',
    borderLeftWidth: 2, borderColor: 'theme:paperRuleBright',
  }},

  // Page slot (right of outline) — dark frame around the paper.
  DocPageWrap: { type: 'Box', style: {
    flexGrow: 1, flexShrink: 1,
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg2',
  }},
  // Page surface — cream paper.
  DocPage: { type: 'Box', style: {
    flexGrow: 1, flexShrink: 1,
    flexDirection: 'column',
    backgroundColor: 'theme:paper',
    borderWidth: 1, borderColor: 'theme:paperRule',
    borderRadius: 'theme:radiusSm',
    overflow: 'hidden',
  }},
  // Inner padded content column inside the page.
  DocPageContent: { type: 'Box', style: {
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
    paddingTop: 'theme:spaceX8', paddingBottom: 'theme:spaceX8',
    gap: 'theme:spaceX5',
  }},

  // Code block (recessed dark surface).
  DocCode: { type: 'Box', style: {
    backgroundColor: 'theme:bg2',
    borderRadius: 'theme:radiusSm',
    padding: 'theme:spaceX5',
  }},

  // Quote (vertical accent bar + content row).
  DocQuoteRow: { type: 'Box', style: {
    flexDirection: 'row',
    gap: 'theme:spaceX4',
  }},
  DocQuoteBar: { type: 'Box', style: {
    width: 3,
    backgroundColor: 'theme:paperRuleBright',
    borderRadius: 'theme:radiusSm',
    alignSelf: 'stretch',
  }},

  // Paper-rule horizontal divider.
  DocPaperRule: { type: 'Box', style: {
    height: 1, flexShrink: 0,
    backgroundColor: 'theme:paperRule',
  }},

  // Doc typography (text on paper).
  DocTitle:       { type: 'Text', size: 'theme:typeHeading', bold: true, color: 'theme:paperInk' },
  DocSubtitle:    { type: 'Text', size: 'theme:typeStrong',  color: 'theme:paperInkDim',
                    style: { fontStyle: 'italic' } },
  DocMeta:        { type: 'Text', size: 'theme:typeCaption', color: 'theme:paperInkDim' },
  DocH1:          { type: 'Text', size: 'theme:typeHeading', bold: true, color: 'theme:paperInk' },
  DocH2:          { type: 'Text', size: 'theme:typeStrong',  bold: true, color: 'theme:paperInk' },
  DocH3:          { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:paperInk' },
  DocBodyText:    { type: 'Text', size: 'theme:typeBody',    color: 'theme:paperInk' },
  DocBodyDim:     { type: 'Text', size: 'theme:typeBody',    color: 'theme:paperInkDim' },
  DocQuoteText:   { type: 'Text', size: 'theme:typeBase',    color: 'theme:paperInk',
                    style: { fontStyle: 'italic' } },
  DocAttribution: { type: 'Text', size: 'theme:typeCaption', color: 'theme:paperInkDim' },
  DocCodeText:    { type: 'Text', size: 'theme:typeCaption', color: 'theme:ink',
                    style: { fontFamily: 'theme:fontMono' } },

  // Doc typography (text in dark toolbar / shell).
  DocToolbarTitle:   { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:ink' },
  DocToolbarSection: { type: 'Text', size: 'theme:typeMicro',   color: 'theme:inkDim' },
  DocToolbarGlyph:   { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:ink' },
  DocToolbarZoom:    { type: 'Text', size: 'theme:typeTiny',    color: 'theme:ink',
                       style: { fontFamily: 'theme:fontMono' } },

  // Outline typography.
  DocOutlineLabel:        { type: 'Text', size: 'theme:typeMicro',   bold: true, color: 'theme:paperInkDim' },
  DocOutlineEntry:        { type: 'Text', size: 'theme:typeCaption', color: 'theme:paperInkDim' },
  DocOutlineEntryActive:  { type: 'Text', size: 'theme:typeCaption', bold: true, color: 'theme:paperInk' },
  DocOutlineEntryH1:      { type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:paperInkDim' },
  DocOutlineEntryH1Active:{ type: 'Text', size: 'theme:typeBase',    bold: true, color: 'theme:paperInk' },

  // ══════════════════════════════════════════════════════════════
  //   cart/app — onboarding flow + custom window chrome
  //
  //   These names are consumed by cart/app/index.tsx, page.jsx,
  //   onboarding/*.jsx. All theme-touching styling for cart/app
  //   lives here — there is no cart/app/theme.js shim. Active /
  //   inactive variants are separate classifiers; the JSX picks one.
  // ══════════════════════════════════════════════════════════════

  // ── Window chrome (top strip) ───────────────────────────────
  AppChrome: { type: 'Box', style: {
    flexDirection: 'row',
    width: '100%', height: 36,
    flexShrink: 0,
    alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX3',
    backgroundColor: 'theme:bg1',
    borderBottomWidth: 1, borderColor: 'theme:rule',
  }},
  AppChromeBrandRow: { type: 'Box', style: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX4',
  }},
  AppChromeNavRow: { type: 'Box', style: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX2',
  }},
  AppChromeRightCluster: { type: 'Box', style: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX2',
  }},
  AppBrandSwatch: { type: 'Box', style: {
    width: 14, height: 14,
    borderRadius: 'theme:radiusSm',
    backgroundColor: 'theme:accent',
  }},
  AppBrandTitle: { type: 'Text', size: 'theme:typeBase', bold: true, color: 'theme:ink' },
  AppBrandSub:   { type: 'Text', size: 'theme:typeCaption', color: 'theme:inkDim' },
  AppChromeDivider: { type: 'Box', style: {
    width: 1, height: 18,
    backgroundColor: 'theme:rule',
    marginLeft: 'theme:spaceX4', marginRight: 'theme:spaceX2',
  }},

  // ── Nav links (chrome route nav) ────────────────────────────
  AppNavLink: { type: 'Pressable', style: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX3',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    backgroundColor: 'transparent',
  }},
  AppNavLinkActive: { type: 'Pressable', style: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX3',
    paddingTop: 'theme:spaceX2', paddingBottom: 'theme:spaceX2',
    paddingLeft: 'theme:spaceX4', paddingRight: 'theme:spaceX4',
    borderRadius: 'theme:radiusMd',
    backgroundColor: 'theme:bg2',
  }},
  AppNavIcon:       { type: 'Icon', size: 14, strokeWidth: 2, color: 'theme:inkDim' },
  AppNavIconActive: { type: 'Icon', size: 14, strokeWidth: 2, color: 'theme:ink' },
  AppNavLabel:       { type: 'Text', size: 'theme:typeBase', color: 'theme:inkDim' },
  AppNavLabelActive: { type: 'Text', size: 'theme:typeBase', color: 'theme:ink' },

  // ── Step cubes (onboarding progress in chrome) ──────────────
  AppStepCubePast:    { type: 'Pressable', style: { width: 14, height: 14, backgroundColor: 'theme:inkDim' } },
  AppStepCubeCurrent: { type: 'Pressable', style: { width: 14, height: 14, backgroundColor: 'theme:accent' } },
  AppStepCubeFuture:  { type: 'Pressable', style: { width: 14, height: 14, backgroundColor: 'theme:rule' } },
  AppStepCubeRow:     { type: 'Box', style: { flexDirection: 'row', alignItems: 'center', gap: 'theme:spaceX2' } },

  // ── Window buttons (minimize / maximize / close) ────────────
  AppWindowBtn: { type: 'Pressable', style: {
    width: 26, height: 22,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 'theme:radiusSm',
  }},
  AppWindowBtnIcon:      { type: 'Icon', size: 14, strokeWidth: 2, color: 'theme:inkDim' },
  AppWindowBtnIconClose: { type: 'Icon', size: 14, strokeWidth: 2, color: 'theme:flag' },

  // ── Onboarding step shell ───────────────────────────────────
  AppStepFrame: { type: 'Box', style: { flexGrow: 1, position: 'relative' } },
  AppStepCenter: { type: 'Box', style: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  }},
  AppStepCenterCol: { type: 'Box', style: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 'theme:spaceX8',
    paddingLeft: 'theme:spaceX8', paddingRight: 'theme:spaceX8',
  }},
  AppStepBottomLeft:  { type: 'Box', style: { position: 'absolute', bottom: 24, left: 24 } },
  AppStepBottomRight: { type: 'Box', style: { position: 'absolute', bottom: 24, right: 24 } },
  AppStepBottomRightRow: { type: 'Box', style: {
    position: 'absolute',
    bottom: 24, right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'theme:spaceX6',
  }},
  AppStepDimmable: { type: 'Box', style: { opacity: 1 } },

  // ── Onboarding text (large, on dark page) ───────────────────
  // FirstStep — "Hello", "what is your name?", greet/exit lines.
  AppHello:        { type: 'Text', size: 48, bold: true, color: 'theme:ink' },
  AppQuestion:     { type: 'Text', size: 16, color: 'theme:inkDim' },
  AppGreet:        { type: 'Text', size: 32, bold: true, color: 'theme:ink' },
  // Step2/Step3 — section prompt + branching exit message.
  AppPromptText:   { type: 'Text', size: 22, bold: true, color: 'theme:ink',
                     style: { textAlign: 'center' } },
  AppExitMessage:  { type: 'Text', size: 32, bold: true, color: 'theme:ink',
                     style: { textAlign: 'center' } },

  // ── Onboarding inputs ───────────────────────────────────────
  AppNameInput: { type: 'TextInput', style: {
    width: 280, height: 36,
    fontSize: 16,
    color: 'theme:ink',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
  }},
  AppFormInput: { type: 'TextInput', style: {
    width: '100%', height: 36,
    fontSize: 13,
    color: 'theme:ink',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
  }},
  AppFormInputMono: { type: 'TextInput', style: {
    width: '100%', height: 36,
    fontSize: 13,
    color: 'theme:ink',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
    paddingLeft: 'theme:spaceX6', paddingRight: 'theme:spaceX6',
    fontFamily: 'theme:fontMono',
  }},

  // ── Provider tiles (Step2) ──────────────────────────────────
  AppProviderRow: { type: 'Box', style: {
    flexDirection: 'row',
    gap: 'theme:spaceX7',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    justifyContent: 'center',
  }},
  AppProviderTile: { type: 'Pressable', style: {
    width: 240,
    minHeight: 120,
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusXl',
    gap: 'theme:spaceX4',
    justifyContent: 'center',
  }},
  AppProviderTileActive: { type: 'Pressable', style: {
    width: 240,
    minHeight: 120,
    padding: 'theme:spaceX7',
    backgroundColor: 'theme:bg1',
    borderWidth: 2, borderColor: 'theme:accent',
    borderRadius: 'theme:radiusXl',
    gap: 'theme:spaceX4',
    justifyContent: 'center',
  }},
  AppProviderTileTitle:       { type: 'Text', size: 'theme:typeStrong', bold: true, color: 'theme:ink' },
  AppProviderTileTitleActive: { type: 'Text', size: 'theme:typeStrong', bold: true, color: 'theme:accent' },
  AppProviderTileSubtitle:    { type: 'Text', size: 'theme:typeMeta', color: 'theme:inkDim' },

  // ── Inline form shell (Step2 provider forms) ────────────────
  AppFormShell: { type: 'Box', style: {
    flexDirection: 'column',
    width: 480,
    padding: 'theme:spaceX8',
    gap: 'theme:spaceX6',
    backgroundColor: 'theme:bg1',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusXl',
  }},
  AppFormFieldCol: { type: 'Box', style: {
    flexDirection: 'column',
    gap: 'theme:spaceX3',
  }},
  AppFormButtonRow: { type: 'Box', style: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  }},
  AppFormLabel: { type: 'Text', size: 'theme:typeBase', color: 'theme:inkDim' },

  // ── Probe result ────────────────────────────────────────────
  AppProbeResult: { type: 'Box', style: {
    flexDirection: 'column',
    gap: 'theme:spaceX2',
    padding: 'theme:spaceX6',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
  }},
  AppProbeOk:      { type: 'Text', size: 'theme:typeMeta', bold: true, color: 'theme:ok' },
  AppProbeFail:    { type: 'Text', size: 'theme:typeMeta', bold: true, color: 'theme:flag' },
  AppProbeMessage: { type: 'Text', size: 'theme:typeBase', color: 'theme:inkDim',
                     style: { fontFamily: 'theme:fontMono' } },

  // ── Model list (Step2) ──────────────────────────────────────
  AppModelListLabel: { type: 'Text', size: 'theme:typeBase', color: 'theme:inkDim' },
  AppModelListBox: { type: 'Box', style: {
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
    padding: 'theme:spaceX2',
    backgroundColor: 'theme:bg2',
    overflow: 'hidden',
  }},
  AppModelChoice: { type: 'Pressable', style: {
    padding: 'theme:spaceX5',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:rule',
    borderRadius: 'theme:radiusMd',
  }},
  AppModelChoiceActive: { type: 'Pressable', style: {
    padding: 'theme:spaceX5',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:accent',
    borderRadius: 'theme:radiusMd',
  }},
  AppModelChoiceText:       { type: 'Text', size: 'theme:typeMeta', color: 'theme:ink',
                              style: { fontFamily: 'theme:fontMono' } },
  AppModelChoiceTextActive: { type: 'Text', size: 'theme:typeMeta', color: 'theme:accent',
                              style: { fontFamily: 'theme:fontMono' } },

  // ── Trait chips (Step3) ─────────────────────────────────────
  AppTraitGrid: { type: 'Box', style: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 'theme:spaceX4',
    justifyContent: 'center',
  }},
  AppTraitChip: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusRound',
    backgroundColor: 'theme:bg1',
    borderWidth: 1, borderColor: 'theme:rule',
  }},
  AppTraitChipActive: { type: 'Pressable', style: {
    paddingLeft: 'theme:spaceX7', paddingRight: 'theme:spaceX7',
    paddingTop: 'theme:spaceX4', paddingBottom: 'theme:spaceX4',
    borderRadius: 'theme:radiusRound',
    backgroundColor: 'theme:bg2',
    borderWidth: 1, borderColor: 'theme:accentHot',
  }},
  AppTraitChipText:       { type: 'Text', size: 'theme:typeMeta', color: 'theme:ink' },
  AppTraitChipTextActive: { type: 'Text', size: 'theme:typeMeta', bold: true, color: 'theme:accentHot' },
});
