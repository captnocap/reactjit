--[[
  texteditor_tooltips.lua -- Hover tooltip dictionary for the TextEditor

  Maps known identifiers (components, hooks, props, keywords) to descriptions
  at three verbosity levels:
    beginner — full explanation, assumes no React/flexbox knowledge
    guided   — assumes React knowledge, focuses on ReactJIT specifics
    clean    — minimal: just name + signature or one-liner

  Used by texteditor.lua to show IDE-like hover tooltips in the playground.
]]

local M = {}
local tooltips = {}
M.entries = tooltips

-- ============================================================================
-- Primitives
-- ============================================================================

tooltips["Box"] = {
  beginner = "Box is the basic building block. It's a rectangle that can hold other elements inside it. Use style props like width, height, backgroundColor, and flexDirection to control how it looks and how its children are arranged.",
  guided   = "Core container primitive. Renders as a View node. Auto-sizes from children, or uses proportional fallback (1/4 parent) when empty. Row Boxes need a known width for justifyContent.",
  clean    = "Box — container primitive (View node)",
}

tooltips["Text"] = {
  beginner = "Text displays words on screen. Every Text MUST have a fontSize or it won't render. Text is the only element that has intrinsic width — it measures itself based on the string content and font size.",
  guided   = "Text primitive. MUST have explicit fontSize (linter enforces). Only node type with intrinsic width via font measurement. No Unicode symbols — use Box-based geometry instead.",
  clean    = "Text — text display (requires fontSize)",
}

tooltips["Image"] = {
  beginner = "Image displays a picture from a file path. Give it a src prop with the image path, and width/height to control its size. Use objectFit to control how the image scales inside its box.",
  guided   = "Image primitive. src is a Love2D asset path. Supports objectFit: fill/contain/cover/none. Surface node — uses proportional fallback (1/4 parent) when unsized.",
  clean    = "Image — image display ({ src, style })",
}

tooltips["Pressable"] = {
  beginner = "Pressable makes something clickable. Wrap any content in Pressable and give it an onPress handler. The style can be a function that receives { hovered, pressed } state for visual feedback.",
  guided   = "Pressable — interactive wrapper with press/hover states. style can be (state) => Style for hover/press feedback. Events: onPress, onLongPress, onHoverIn, onHoverOut.",
  clean    = "Pressable — interactive wrapper ({ onPress, style })",
}

tooltips["ScrollView"] = {
  beginner = "ScrollView creates a scrollable area. Put content inside it that's taller than the ScrollView itself, and users can scroll through it. Needs an explicit height to know when to start scrolling.",
  guided   = "ScrollView — scrollable container. Needs explicit height. Supports horizontal prop. Events: onScroll, onScrollBegin, onScrollEnd. showScrollIndicator controls scrollbar.",
  clean    = "ScrollView — scrollable container ({ horizontal?, style })",
}

tooltips["TextInput"] = {
  beginner = "TextInput is a single-line text field where users can type. Use value and onChangeText for controlled input, or defaultValue for uncontrolled. The placeholder shows hint text when empty.",
  guided   = "TextInput — single-line input. Lua-owned interaction (no per-keystroke bridge traffic). Supports controlled (value + onChangeText) and uncontrolled (defaultValue) modes.",
  clean    = "TextInput — text input field ({ value?, onChangeText? })",
}

tooltips["TextEditor"] = {
  beginner = "TextEditor is a multi-line code editor with line numbers, syntax highlighting, and cursor/selection support. All editing happens in Lua — JS only hears about focus, blur, and submit events.",
  guided   = "TextEditor — Lua-owned multi-line editor. All state (cursor, selection, scroll) lives in Lua. JS receives boundary events only. Supports syntaxHighlight, lineNumbers, readOnly.",
  clean    = "TextEditor — multi-line code editor ({ initialValue?, syntaxHighlight? })",
}

tooltips["Modal"] = {
  beginner = "Modal shows content in a floating overlay on top of everything else. It dims the background and centers your content. Use a visible prop to show/hide it.",
  guided   = "Modal — overlay primitive. Renders above all other content with backdrop dimming. Controlled via visible prop. onRequestClose fires on backdrop tap or Escape.",
  clean    = "Modal — overlay dialog ({ visible, onRequestClose })",
}

-- ============================================================================
-- Form controls
-- ============================================================================

tooltips["Slider"] = {
  beginner = "Slider lets users pick a number by dragging a handle along a track. Set min, max, and value to control the range and current position. onValueChange fires as they drag.",
  guided   = "Slider — range input. Props: min, max, value, step, onValueChange. Renders track + thumb in Lua. Supports custom track/thumb colors.",
  clean    = "Slider — range input ({ min, max, value, onValueChange })",
}

tooltips["Switch"] = {
  beginner = "Switch is a toggle that's either on or off, like a light switch. The value prop controls whether it's on (true) or off (false). onValueChange fires when toggled.",
  guided   = "Switch — boolean toggle. Controlled via value + onValueChange. Animated thumb slide in Lua. Supports custom on/off colors.",
  clean    = "Switch — boolean toggle ({ value, onValueChange })",
}

tooltips["Checkbox"] = {
  beginner = "Checkbox is a small box that can be checked or unchecked. Use checked prop to control its state and onToggle to respond when the user clicks it.",
  guided   = "Checkbox — checkable input. Props: checked, onToggle, label. Renders box + checkmark geometry in Lua (no Unicode).",
  clean    = "Checkbox — boolean input ({ checked, onToggle })",
}

tooltips["Radio"] = {
  beginner = "Radio is a circular button used in groups where only one option can be selected at a time. Use it inside a RadioGroup to manage which option is currently active.",
  guided   = "Radio — single option in a RadioGroup. Props: value, label. Selection managed by parent RadioGroup's value + onValueChange.",
  clean    = "Radio — radio button ({ value, label })",
}

tooltips["RadioGroup"] = {
  beginner = "RadioGroup wraps multiple Radio buttons and ensures only one can be selected at a time. Set value to the currently selected option and onValueChange to handle selection.",
  guided   = "RadioGroup — manages mutual exclusion of child Radio elements. Props: value, onValueChange, children (Radio elements).",
  clean    = "RadioGroup — radio group container ({ value, onValueChange })",
}

tooltips["Select"] = {
  beginner = "Select shows a dropdown menu where users pick one option from a list. Provide options as an array of { label, value } objects. The selected value is controlled by the value prop.",
  guided   = "Select — dropdown picker. Props: options (array of {label, value}), value, onValueChange, placeholder. Opens a Lua-rendered overlay menu.",
  clean    = "Select — dropdown picker ({ options, value, onValueChange })",
}

-- ============================================================================
-- Layout helpers
-- ============================================================================

tooltips["Card"] = {
  beginner = "Card is a styled container with a background, border radius, and padding — like a card in a card game. It groups related content together with visual separation.",
  guided   = "Card — styled Box with default background, borderRadius, padding, and optional shadow. Convenience wrapper, not a distinct node type.",
  clean    = "Card — styled container ({ style?, children })",
}

tooltips["Badge"] = {
  beginner = "Badge is a small label, often colored, used to show status or counts — like a notification dot with a number in it. It auto-sizes to fit its text content.",
  guided   = "Badge — inline label component. Auto-sizes to content. Props: label, color, variant. Renders as Box + Text with preset styling.",
  clean    = "Badge — inline label ({ label, color? })",
}

tooltips["Divider"] = {
  beginner = "Divider draws a thin horizontal or vertical line to visually separate sections of content, like a section break in a document.",
  guided   = "Divider — visual separator. Props: orientation ('horizontal'|'vertical'), color, thickness. Renders as a styled Box.",
  clean    = "Divider — separator line ({ orientation? })",
}

tooltips["FlexRow"] = {
  beginner = "FlexRow is a shortcut for a Box with flexDirection: 'row'. It arranges its children side by side horizontally instead of stacking them vertically.",
  guided   = "FlexRow — Box with flexDirection: 'row' preset. Remember: row Boxes need explicit width for justifyContent to work.",
  clean    = "FlexRow — horizontal flex container",
}

tooltips["FlexColumn"] = {
  beginner = "FlexColumn is a shortcut for a Box with flexDirection: 'column'. It stacks its children vertically from top to bottom — the default layout direction.",
  guided   = "FlexColumn — Box with flexDirection: 'column' preset. Default direction, but explicit for readability.",
  clean    = "FlexColumn — vertical flex container",
}

tooltips["Spacer"] = {
  beginner = "Spacer is an invisible element that pushes other elements apart. It uses flexGrow: 1 to take up all available empty space between siblings.",
  guided   = "Spacer — empty Box with flexGrow: 1. Consumes remaining space in a flex container to push siblings apart.",
  clean    = "Spacer — flexible space (flexGrow: 1)",
}

-- ============================================================================
-- Data visualization
-- ============================================================================

tooltips["Table"] = {
  beginner = "Table displays data in rows and columns, like a spreadsheet. Provide column definitions and row data, and it handles header rendering, cell layout, and optional sorting.",
  guided   = "Table — data grid component. Props: columns (definitions), data (rows), onSort. Renders header + body with Lua layout. Supports fixed column widths.",
  clean    = "Table — data grid ({ columns, data })",
}

tooltips["BarChart"] = {
  beginner = "BarChart draws a bar graph from an array of data points. Each bar's height represents a value. Useful for comparing quantities across categories.",
  guided   = "BarChart — bar graph component. Props: data (array of {label, value, color?}), width, height. Pure Box+Text rendering, no canvas/SVG.",
  clean    = "BarChart — bar graph ({ data, width?, height? })",
}

tooltips["ProgressBar"] = {
  beginner = "ProgressBar shows how much of a task is complete as a filled horizontal bar. Set value (0-100) to control how much is filled.",
  guided   = "ProgressBar — linear progress indicator. Props: value (0-100), color, trackColor, height. Rendered as nested Boxes with width percentage.",
  clean    = "ProgressBar — progress indicator ({ value })",
}

tooltips["Sparkline"] = {
  beginner = "Sparkline draws a tiny inline line chart from an array of numbers. It's a compact way to show trends without axis labels or legends.",
  guided   = "Sparkline — inline mini chart. Props: data (number[]), width, height, color. Renders as a series of positioned Box segments.",
  clean    = "Sparkline — inline mini chart ({ data })",
}

-- ============================================================================
-- Navigation
-- ============================================================================

tooltips["NavPanel"] = {
  beginner = "NavPanel is a sidebar navigation menu with clickable items. Each item has a label and optional icon. Use it to switch between different views or sections.",
  guided   = "NavPanel — sidebar navigation. Props: items (array of {label, icon?, action}), activeItem, onSelect. Renders vertically stacked Pressable items.",
  clean    = "NavPanel — sidebar navigation ({ items, onSelect })",
}

tooltips["Tabs"] = {
  beginner = "Tabs shows a row of tab buttons at the top, and the content of the selected tab below. Click a tab to switch what content is displayed.",
  guided   = "Tabs — tabbed view switcher. Props: tabs (array of {label, content}), activeTab, onTabChange. Header row + content area layout.",
  clean    = "Tabs — tab view ({ tabs, activeTab, onTabChange })",
}

tooltips["Breadcrumbs"] = {
  beginner = "Breadcrumbs shows a trail of links showing where you are in a hierarchy, like 'Home > Products > Shoes'. Each segment is clickable to navigate back.",
  guided   = "Breadcrumbs — hierarchical path display. Props: items (array of {label, action?}), separator. Renders as horizontal Text chain.",
  clean    = "Breadcrumbs — path navigation ({ items })",
}

tooltips["Toolbar"] = {
  beginner = "Toolbar is a horizontal bar of action buttons, like the toolbar in a text editor. Each item can have an icon, label, and click handler.",
  guided   = "Toolbar — horizontal action bar. Props: items (array of {label, icon?, onPress, disabled?}). FlexRow of Pressable items.",
  clean    = "Toolbar — action bar ({ items })",
}

-- ============================================================================
-- Animation
-- ============================================================================

tooltips["AnimatedValue"] = {
  beginner = "AnimatedValue creates a number that changes smoothly over time. Instead of jumping from 0 to 100 instantly, it gradually transitions, creating animation effects.",
  guided   = "AnimatedValue — interpolatable numeric value for declarative animation. Use with useAnimation hook. Drives style properties via Lua-side interpolation.",
  clean    = "AnimatedValue — animated number for transitions",
}

tooltips["useAnimation"] = {
  beginner = "useAnimation is a React hook that creates and controls an animated value. It returns an AnimatedValue and functions to start/stop animations like fade, slide, or scale.",
  guided   = "useAnimation — hook returning {value, start, stop, reset}. Drives AnimatedValue with configurable duration, easing, and loop. Lua-side interpolation.",
  clean    = "useAnimation() — animation control hook",
}

tooltips["useSpring"] = {
  beginner = "useSpring creates physics-based animations that feel natural, like a spring bouncing. Instead of fixed durations, the animation settles based on tension and friction values.",
  guided   = "useSpring — spring physics animation hook. Props: tension, friction, mass. Returns animated value with natural settle behavior. Lua-side physics sim.",
  clean    = "useSpring() — spring physics animation hook",
}

-- ============================================================================
-- React hooks
-- ============================================================================

tooltips["useState"] = {
  beginner = "useState stores a value that your component remembers between renders. When you call the setter function, React re-renders your component with the new value. Returns [value, setValue].",
  guided   = "useState — React state hook. Returns [state, setState]. setState triggers re-render. Can accept initializer function for expensive computations.",
  clean    = "useState(initial) — state hook returning [value, setter]",
}

tooltips["useEffect"] = {
  beginner = "useEffect runs code after your component renders. Use it for side effects like timers, data fetching, or subscriptions. The dependency array controls when it re-runs — empty means 'only on mount'.",
  guided   = "useEffect — side effect hook. Runs after render. Deps array controls re-execution. Return cleanup function for unmount/re-run. Empty deps = mount only.",
  clean    = "useEffect(fn, deps) — post-render side effect",
}

tooltips["useCallback"] = {
  beginner = "useCallback remembers a function between renders so it doesn't get recreated every time. This is important when passing functions to child components to prevent unnecessary re-renders.",
  guided   = "useCallback — memoized callback. Returns stable function reference across renders. Only recreates when deps change. Prevents child re-renders from new fn refs.",
  clean    = "useCallback(fn, deps) — memoized function reference",
}

tooltips["useRef"] = {
  beginner = "useRef creates a container that holds a value without causing re-renders when it changes. Commonly used to reference DOM elements or store mutable values that persist across renders.",
  guided   = "useRef — mutable ref container. .current persists across renders without triggering re-render. Use for instance refs, timers, previous values.",
  clean    = "useRef(initial) — mutable ref container (.current)",
}

tooltips["useMemo"] = {
  beginner = "useMemo remembers a computed value and only recalculates it when its dependencies change. Use it for expensive calculations that shouldn't re-run on every render.",
  guided   = "useMemo — memoized computation. Returns cached value, recomputes only when deps change. Use for expensive derivations, not for simple values.",
  clean    = "useMemo(fn, deps) — memoized computed value",
}

tooltips["useContext"] = {
  beginner = "useContext reads a value from a React Context — a way to share data with deeply nested components without passing props through every level of the tree.",
  guided   = "useContext — reads nearest Context.Provider value. Re-renders when context value changes. Use for truly global state (theme, locale, auth).",
  clean    = "useContext(Context) — read context value",
}

tooltips["useReducer"] = {
  beginner = "useReducer is like useState but for complex state logic. Instead of setting values directly, you dispatch actions and a reducer function decides how to update the state.",
  guided   = "useReducer — state management with action dispatch. Returns [state, dispatch]. Better than useState for complex state transitions or when next state depends on previous.",
  clean    = "useReducer(reducer, init) — [state, dispatch]",
}

-- ============================================================================
-- Style props (flexbox + visual)
-- ============================================================================

tooltips["flexGrow"] = {
  beginner = "flexGrow controls how much extra space an element takes up. A value of 1 means 'take all remaining space'. If two siblings both have flexGrow: 1, they split the extra space equally.",
  guided   = "flexGrow — share of remaining space in flex container. Requires parent with known dimensions. Don't use on root containers (use width/height: '100%' instead).",
  clean    = "flexGrow — proportion of remaining flex space",
}

tooltips["flexDirection"] = {
  beginner = "flexDirection controls whether children are arranged in a row (side by side) or column (stacked vertically). The default is 'column'. Set to 'row' for horizontal layouts.",
  guided   = "flexDirection — main axis direction. 'column' (default) = vertical, 'row' = horizontal. Affects how justifyContent and alignItems work.",
  clean    = "flexDirection — 'row' | 'column' (default: column)",
}

tooltips["justifyContent"] = {
  beginner = "justifyContent controls how children are spaced along the main axis (horizontal in rows, vertical in columns). 'center' centers them, 'space-between' spreads them with space in between.",
  guided   = "justifyContent — main-axis distribution. Row Boxes need a known width (explicit, '100%', or flexGrow) for this to work. Values: start, center, end, space-between, space-around, space-evenly.",
  clean    = "justifyContent — main-axis alignment",
}

tooltips["alignItems"] = {
  beginner = "alignItems controls how children are positioned on the cross axis (vertical in rows, horizontal in columns). 'center' centers them, 'stretch' makes them fill the cross axis.",
  guided   = "alignItems — cross-axis alignment. Values: start, center, end, stretch. 'stretch' makes children fill the cross dimension if they don't have explicit sizing.",
  clean    = "alignItems — cross-axis alignment",
}

tooltips["padding"] = {
  beginner = "padding adds empty space inside an element, between its border and its content. Like adding a soft cushion inside a picture frame — the content shrinks to make room.",
  guided   = "padding — inner spacing. Supports number (all sides) or per-side via paddingTop/Right/Bottom/Left. Added to auto-sized container dimensions.",
  clean    = "padding — inner spacing (number | string)",
}

tooltips["margin"] = {
  beginner = "margin adds empty space outside an element, pushing it away from its neighbors. Like personal space around a person — other elements can't enter that zone.",
  guided   = "margin — outer spacing. Supports number (all sides) or per-side. Collapses in some flex contexts. Use gap on parent instead when spacing siblings.",
  clean    = "margin — outer spacing (number | string)",
}

tooltips["gap"] = {
  beginner = "gap adds equal spacing between all children of a container, like adding a fixed amount of space between items in a list. Simpler than adding margin to each child.",
  guided   = "gap — spacing between flex children. Preferred over per-child margins. Supports number or string. Applied between children on the main axis.",
  clean    = "gap — space between flex children",
}

tooltips["backgroundColor"] = {
  beginner = "backgroundColor fills the element's rectangle with a color. Can be a CSS string like '#ff0000' or an RGBA array like [1, 0, 0, 1]. Default is transparent.",
  guided   = "backgroundColor — fill color. Accepts CSS hex/rgba strings or Love2D [r,g,b,a] arrays (0-1 range). Supports transition animation.",
  clean    = "backgroundColor — fill color (Color)",
}

tooltips["borderRadius"] = {
  beginner = "borderRadius rounds the corners of an element. Higher values make rounder corners. Set to half the width/height for a perfect circle.",
  guided   = "borderRadius — corner rounding in pixels. Per-corner overrides: borderTopLeftRadius, etc. Works with borders, backgrounds, and clip masks.",
  clean    = "borderRadius — corner rounding (number)",
}

tooltips["width"] = {
  beginner = "width sets how wide an element is. Can be a number (pixels) or a string like '100%' (percentage of parent). Without explicit width, containers auto-size to their content.",
  guided   = "width — explicit horizontal size. Number = px, string = percentage of parent. '100%' on root containers to fill viewport. Auto-sized if omitted (content-based).",
  clean    = "width — horizontal size (number | string)",
}

tooltips["height"] = {
  beginner = "height sets how tall an element is. Can be a number (pixels) or a string like '100%' (percentage of parent). Without explicit height, containers auto-size to their content.",
  guided   = "height — explicit vertical size. Number = px, string = percentage of parent. Root containers need '100%' to fill the Love2D canvas.",
  clean    = "height — vertical size (number | string)",
}

tooltips["overflow"] = {
  beginner = "overflow controls what happens when content is bigger than its container. 'hidden' clips the overflow, 'scroll' adds scrolling, 'auto' scrolls only when needed, 'visible' lets it spill out.",
  guided   = "overflow — content clipping. 'hidden' enables scissor rect, 'scroll' enables Lua scroll handling, 'auto' scrolls only when content overflows, 'visible' (default) lets content exceed bounds.",
  clean    = "overflow — 'visible' | 'hidden' | 'scroll' | 'auto'",
}

tooltips["transform"] = {
  beginner = "transform lets you move, rotate, scale, or skew an element without affecting layout. It's visual-only — other elements still see the original position and size.",
  guided   = "transform — visual transformation (no layout impact). Props: translateX/Y, rotate (degrees), scaleX/Y, skewX/Y, originX/Y (0-1). Lua-side matrix math.",
  clean    = "transform — visual transform ({ translateX?, rotate?, scaleX? })",
}

tooltips["opacity"] = {
  beginner = "opacity controls how see-through an element is. 1 is fully visible, 0 is invisible. 0.5 is half-transparent. Affects the element and all its children.",
  guided   = "opacity — alpha transparency (0-1). Inherited by children via effectiveOpacity multiplication. Supports transition animation. 0 still receives events.",
  clean    = "opacity — transparency (0-1)",
}

tooltips["position"] = {
  beginner = "position controls how an element is placed. 'relative' (default) means normal flow. 'absolute' takes it out of flow and positions it relative to its parent using top/left/right/bottom.",
  guided   = "position — positioning mode. 'relative' (default) = flow-based. 'absolute' = removed from flow, positioned via top/left/right/bottom relative to nearest positioned ancestor.",
  clean    = "position — 'relative' | 'absolute'",
}

tooltips["flexWrap"] = {
  beginner = "flexWrap controls whether children that don't fit in one line wrap to the next line. Default is 'nowrap' (everything stays on one line). Set to 'wrap' to allow wrapping.",
  guided   = "flexWrap — 'nowrap' (default) or 'wrap'. When 'wrap', children that exceed the container's main axis size flow to the next line. Works with gap.",
  clean    = "flexWrap — 'nowrap' | 'wrap'",
}

tooltips["flexShrink"] = {
  beginner = "flexShrink controls whether an element can shrink below its natural size when there isn't enough space. Default is 1 (can shrink). Set to 0 to prevent shrinking.",
  guided   = "flexShrink — shrink factor when container overflows. Default 1. Set to 0 to prevent element from shrinking below its basis/content size.",
  clean    = "flexShrink — shrink factor (default: 1)",
}

tooltips["flexBasis"] = {
  beginner = "flexBasis sets the initial size of an element before flexGrow/flexShrink are applied. It's like a 'starting size' that flex then adjusts. Can be a number or 'auto'.",
  guided   = "flexBasis — initial main-axis size before flex distribution. Number = px, 'auto' = use width/height. Overrides width/height in the flex axis.",
  clean    = "flexBasis — initial flex size (number | 'auto')",
}

tooltips["alignSelf"] = {
  beginner = "alignSelf overrides the parent's alignItems for a single child. If the parent says 'center' but one child needs to be at the 'start', use alignSelf: 'start' on that child.",
  guided   = "alignSelf — per-item cross-axis override. Values: auto, start, center, end, stretch. Overrides parent's alignItems for this element only.",
  clean    = "alignSelf — per-item cross-axis alignment",
}

tooltips["fontSize"] = {
  beginner = "fontSize sets the size of text in pixels. Every Text element MUST have a fontSize — the framework requires it. Larger numbers mean bigger text.",
  guided   = "fontSize — text size in px. REQUIRED on every Text node (linter enforces). Affects font measurement and line height. Scaled by textScale if set.",
  clean    = "fontSize — text size in px (required on Text)",
}

tooltips["fontFamily"] = {
  beginner = "fontFamily chooses which font to use for text. Set it to 'monospace' for code-style text, or a custom font name if you've loaded custom fonts.",
  guided   = "fontFamily — font selection. 'monospace' for code. Custom fonts loaded via Love2D font path. Falls back to default Love2D font if not found.",
  clean    = "fontFamily — font name string",
}

tooltips["fontWeight"] = {
  beginner = "fontWeight controls how thick or thin the text appears. 'bold' makes it heavier, 'normal' is the default weight. Some fonts support numeric weights like 600.",
  guided   = "fontWeight — 'normal', 'bold', or numeric (100-900). Requires font variant that supports the weight. Love2D loads separate font files per weight.",
  clean    = "fontWeight — 'normal' | 'bold' | number",
}

tooltips["color"] = {
  beginner = "color sets the text color. Can be a CSS string like '#ffffff' (white) or an RGBA array like [1, 1, 1, 1]. Only applies to Text elements.",
  guided   = "color — text foreground color. Accepts CSS hex/rgba or Love2D [r,g,b,a] array. Applied to Text nodes. Use backgroundColor for container fills.",
  clean    = "color — text color (Color)",
}

tooltips["textAlign"] = {
  beginner = "textAlign controls horizontal text alignment within its container. 'left' is the default. 'center' centers text, and 'right' aligns it to the right edge.",
  guided   = "textAlign — horizontal text alignment. 'left' (default), 'center', 'right'. Requires the Text's parent to have width for center/right to be visible.",
  clean    = "textAlign — 'left' | 'center' | 'right'",
}

tooltips["zIndex"] = {
  beginner = "zIndex controls which element appears on top when elements overlap. Higher numbers are drawn on top of lower numbers. Like layers in a drawing program.",
  guided   = "zIndex — stacking order for overlapping siblings. Higher values drawn later (on top). Only affects rendering order, not layout. Default: 0.",
  clean    = "zIndex — stacking order (number)",
}

tooltips["borderWidth"] = {
  beginner = "borderWidth adds a visible border around an element. Set a borderColor too, or the border will be invisible. The width is in pixels.",
  guided   = "borderWidth — border thickness in px. Requires borderColor. Per-side overrides: borderTopWidth, etc. Does not affect layout sizing (painted outside).",
  clean    = "borderWidth — border thickness (number)",
}

tooltips["borderColor"] = {
  beginner = "borderColor sets the color of the element's border. Use together with borderWidth — without a width, the border won't be visible even if you set a color.",
  guided   = "borderColor — border stroke color. Requires borderWidth > 0. Per-side overrides: borderTopColor, etc. Accepts CSS or Love2D color format.",
  clean    = "borderColor — border color (Color)",
}

-- ============================================================================
-- JS keywords (beginner level only — guided/clean skip these)
-- ============================================================================

tooltips["const"] = {
  beginner = "const declares a variable that can't be reassigned. Use it for values that shouldn't change, like component definitions or configuration. This is the most common way to declare variables in React.",
  guided   = "Block-scoped constant binding. Standard JS — no ReactJIT-specific behavior.",
  clean    = "const — constant declaration",
}

tooltips["let"] = {
  beginner = "let declares a variable that CAN be reassigned later. Use it when you need to change the value, like a counter or accumulator. Prefer const when the value won't change.",
  guided   = "Block-scoped mutable binding. Prefer const unless reassignment is needed.",
  clean    = "let — mutable variable declaration",
}

tooltips["var"] = {
  beginner = "var is the old way to declare variables. It has function-level scoping instead of block-level. Prefer const or let instead — var can cause subtle bugs in loops and conditionals.",
  guided   = "Function-scoped variable. Avoid — use const/let instead.",
  clean    = "var — function-scoped variable (prefer const/let)",
}

tooltips["function"] = {
  beginner = "function defines a reusable block of code that you can call by name. In React, components are functions that return JSX describing what to render on screen.",
  guided   = "Function declaration. Components are functions returning JSX. Hoisted (available before the declaration line).",
  clean    = "function — function declaration",
}

tooltips["return"] = {
  beginner = "return sends a value back from a function. In React components, return gives back the JSX that describes what to show on screen. A component must return something (or null).",
  guided   = "Returns value from function. Component return = JSX tree for rendering. Early returns useful for guard clauses.",
  clean    = "return — return value from function",
}

tooltips["import"] = {
  beginner = "import brings in code from another file or package. Use it to pull in React, components, hooks, or utilities. The curly braces { } syntax imports specific named exports.",
  guided   = "ES module import. Named: import { X }, default: import X. ReactJIT uses @reactjit/core for primitives.",
  clean    = "import — ES module import",
}

tooltips["export"] = {
  beginner = "export makes a function, variable, or component available for other files to import. 'export default' makes it the main export, while named exports use 'export' before the declaration.",
  guided   = "ES module export. Named: export { X }, default: export default X. Components typically use named exports.",
  clean    = "export — ES module export",
}

tooltips["map"] = {
  beginner = "map transforms each item in an array into something new. In React, you use array.map() to turn a list of data into a list of components. Returns a new array without changing the original.",
  guided   = "Array.prototype.map — transform each element. In JSX: {items.map(item => <Component key={...} />)}. Always provide key prop.",
  clean    = "map(fn) — transform array elements",
}

tooltips["filter"] = {
  beginner = "filter creates a new array with only the items that pass a test. For example, array.filter(x => x > 5) keeps only numbers greater than 5. The original array isn't changed.",
  guided   = "Array.prototype.filter — keep elements matching predicate. Returns new array. Often chained with map for filtered rendering.",
  clean    = "filter(fn) — keep matching array elements",
}

tooltips["reduce"] = {
  beginner = "reduce combines all items in an array into a single value by applying a function to each item and an accumulator. Like folding a list down to one result — sum, concatenation, etc.",
  guided   = "Array.prototype.reduce — fold array to single value. (accumulator, current) => nextAccumulator. Provide initial value as second argument.",
  clean    = "reduce(fn, init) — fold array to single value",
}

tooltips["async"] = {
  beginner = "async marks a function that does asynchronous work (like fetching data). Inside an async function, you can use await to pause until a Promise resolves, making async code look synchronous.",
  guided   = "Async function declaration. Returns Promise. Enables await keyword inside. In React: use inside useEffect or event handlers, never in render.",
  clean    = "async — async function modifier",
}

tooltips["await"] = {
  beginner = "await pauses an async function until a Promise resolves, giving you the result directly. Without await, you'd get a Promise object instead of the actual value.",
  guided   = "Await Promise resolution. Only valid inside async functions. In React: use in useEffect callbacks or event handlers.",
  clean    = "await — pause for Promise resolution",
}

tooltips["true"] = {
  beginner = "true is a boolean value meaning 'yes' or 'on'. Used in conditions, props, and state. For example, isVisible: true means the element should be shown.",
  guided   = "Boolean literal. In JSX: <Comp prop /> is shorthand for prop={true}.",
  clean    = "true — boolean literal",
}

tooltips["false"] = {
  beginner = "false is a boolean value meaning 'no' or 'off'. Used in conditions, props, and state. For example, readOnly: false means the element is editable.",
  guided   = "Boolean literal. In JSX: omitting a boolean prop defaults to false (except for defaulted props).",
  clean    = "false — boolean literal",
}

tooltips["null"] = {
  beginner = "null means 'intentionally empty' — the variable exists but has no value. In React, returning null from a component means 'render nothing'. Useful for conditional rendering.",
  guided   = "Null value. Returning null from component = render nothing. Conditional: {condition ? <Comp /> : null}.",
  clean    = "null — intentional absence of value",
}

tooltips["if"] = {
  beginner = "if runs a block of code only when a condition is true. Use it to make decisions in your code. In React, you often use ternary expressions (condition ? a : b) instead for inline JSX.",
  guided   = "Conditional branch. In JSX: use ternary or && short-circuit. if/else for early returns or complex branching.",
  clean    = "if — conditional branch",
}

tooltips["else"] = {
  beginner = "else provides an alternative code block that runs when the if condition is false. Combine with if for two-way decisions: if the condition is true, do A; else, do B.",
  guided   = "Alternative branch after if. In JSX: prefer ternary for inline conditionals.",
  clean    = "else — alternative branch",
}

tooltips["for"] = {
  beginner = "for repeats a block of code a specific number of times. Less common in React — you'll usually use array.map() instead for rendering lists of components.",
  guided   = "Loop construct. In React rendering, prefer .map() for JSX lists. Use for/of in event handlers and effects.",
  clean    = "for — loop construct",
}

-- ============================================================================
-- Additional common identifiers
-- ============================================================================

tooltips["React"] = {
  beginner = "React is the library that lets you build user interfaces with components. Components are functions that describe what to show. React figures out how to efficiently update the screen when data changes.",
  guided   = "React library. ReactJIT uses React 18.3+ with react-reconciler. Same component model as web React but rendering targets Love2D/terminal/etc.",
  clean    = "React — UI component library",
}

tooltips["style"] = {
  beginner = "style is a prop that controls how an element looks and is positioned. Pass an object with properties like width, height, backgroundColor, padding, flexDirection, etc.",
  guided   = "Style prop — object of layout + visual properties. Unlike CSS, all properties are camelCase and values are numbers (px) or strings. No cascade — each node owns its style.",
  clean    = "style — visual/layout properties object",
}

tooltips["children"] = {
  beginner = "children are the elements nested inside a component. When you write <Box><Text>Hi</Text></Box>, the Text is a child of Box. React passes them automatically via props.children.",
  guided   = "props.children — nested JSX content. Implicitly passed by React. Use React.Children utilities for manipulation.",
  clean    = "children — nested content (props.children)",
}

tooltips["key"] = {
  beginner = "key is a special prop that helps React identify which items in a list have changed, been added, or removed. Always give unique keys when rendering arrays of components.",
  guided   = "key — React reconciliation hint. MUST be unique among siblings. Use stable IDs, not array indices (unless list is static). Changing key forces remount.",
  clean    = "key — unique sibling identifier for reconciliation",
}

tooltips["onPress"] = {
  beginner = "onPress is an event handler that fires when the user clicks or taps on a Pressable element. The function receives an event object with information about the click (position, etc.).",
  guided   = "onPress — Pressable click/tap handler. Receives LoveEvent with { x, y, button }. Love2D: mouse button 1 = left click.",
  clean    = "onPress — click/tap handler (LoveEvent) => void",
}

tooltips["onChangeText"] = {
  beginner = "onChangeText fires whenever the text in a TextInput changes, giving you the new text string. Use it with useState to track what the user has typed.",
  guided   = "onChangeText — text change callback. Receives the new text string directly (not an event object). Standard pattern: [text, setText] + onChangeText={setText}.",
  clean    = "onChangeText — (text: string) => void",
}

tooltips["value"] = {
  beginner = "value is the controlled value prop for inputs. When you set value, the input always shows what you tell it to. Pair with onChangeText to update it — this is the 'controlled component' pattern.",
  guided   = "value — controlled input value. Component reflects this exactly. Must pair with change handler to update. Omit for uncontrolled (use defaultValue instead).",
  clean    = "value — controlled input value",
}

-- ============================================================================
-- Broader JS/React syntax coverage (hooks, loops, operators, punctuation)
-- ============================================================================

tooltips["useLayoutEffect"] = {
  beginner = "useLayoutEffect is like useEffect, but it runs earlier: right after React updates the UI tree and before the user sees the frame. Use it when you must measure layout or update something visual without flicker.",
  guided   = "Synchronous effect hook. Runs after commit, before paint. Use for layout read/write and imperative visual sync; prefer useEffect when this is not required.",
  clean    = "useLayoutEffect(fn, deps) — pre-paint effect hook",
}

tooltips["useImperativeHandle"] = {
  beginner = "useImperativeHandle lets a component decide what a parent gets when using ref. Instead of exposing everything, you expose a small API object with only the methods you want.",
  guided   = "Customizes ref value exposed by forwardRef. Use with refs for imperative APIs while keeping component internals private.",
  clean    = "useImperativeHandle(ref, create, deps) — custom ref handle",
}

tooltips["useTransition"] = {
  beginner = "useTransition lets you mark some state updates as non-urgent so the UI stays responsive. It returns a pending flag and a function to wrap slower updates.",
  guided   = "Concurrent React hook for low-priority updates. Returns [isPending, startTransition]. Keeps urgent input responsive during expensive renders.",
  clean    = "useTransition() — deferred state update priority",
}

tooltips["useDeferredValue"] = {
  beginner = "useDeferredValue gives you a delayed version of a value. You can render quick UI from the current value while expensive UI catches up using the deferred one.",
  guided   = "Defers propagation of a rapidly changing value. Useful when expensive children should lag behind fast input updates.",
  clean    = "useDeferredValue(value) — lagged value for expensive renders",
}

tooltips["useId"] = {
  beginner = "useId creates a stable unique id string for this component instance. Useful for connecting labels and inputs without hardcoding ids.",
  guided   = "Generates stable unique IDs across server/client and remounts. Common for accessibility attributes.",
  clean    = "useId() — stable unique id hook",
}

tooltips["useSyncExternalStore"] = {
  beginner = "useSyncExternalStore lets React safely read data from stores that live outside React, like custom event emitters or external state libraries.",
  guided   = "React external-store subscription hook. Ensures consistent snapshots in concurrent rendering.",
  clean    = "useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?)",
}

tooltips["useInsertionEffect"] = {
  beginner = "useInsertionEffect runs very early in rendering and is mainly for style libraries that must inject styles before layout effects run.",
  guided   = "Specialized hook for CSS-in-JS style insertion timing. Rare in app code.",
  clean    = "useInsertionEffect(fn, deps) — style insertion timing hook",
}

tooltips["useDebugValue"] = {
  beginner = "useDebugValue adds labels for custom hooks in React DevTools so other developers can understand hook state more easily.",
  guided   = "Annotates custom hooks in DevTools. Optional developer-only metadata.",
  clean    = "useDebugValue(value, format?) — DevTools label hook",
}

tooltips["while"] = {
  beginner = "while repeats a block as long as a condition is true. Be careful to update the condition inside the loop, or it can run forever.",
  guided   = "Condition-controlled loop. Re-evaluates condition before each iteration.",
  clean    = "while (condition) { ... } — conditional loop",
}

tooltips["do"] = {
  beginner = "do starts a do...while loop. This loop always runs the block once before checking the condition.",
  guided   = "do...while loop keyword. Executes body once before condition check.",
  clean    = "do { ... } while (condition) — post-check loop",
}

tooltips["switch"] = {
  beginner = "switch checks one value against many possible cases. It can be easier to read than many if/else branches when you have many exact matches.",
  guided   = "Multi-branch control flow over a single expression. Pair case labels with break unless intentional fallthrough.",
  clean    = "switch (expr) { case ... } — multi-branch control",
}

tooltips["case"] = {
  beginner = "case is one branch inside a switch. If the switch value matches this case value, this block runs.",
  guided   = "Switch branch label. Control jumps here when the switch expression matches.",
  clean    = "case value: — switch branch",
}

tooltips["default"] = {
  beginner = "default is the fallback branch in switch. It runs when no other case matches.",
  guided   = "Fallback switch branch when no case matches.",
  clean    = "default: — switch fallback branch",
}

tooltips["break"] = {
  beginner = "break exits the current loop or switch immediately and continues with the next line after it.",
  guided   = "Terminates nearest loop or switch branch.",
  clean    = "break — exit loop/switch",
}

tooltips["continue"] = {
  beginner = "continue skips the rest of the current loop iteration and jumps to the next iteration.",
  guided   = "Skips to next iteration of nearest loop.",
  clean    = "continue — next loop iteration",
}

tooltips["try"] = {
  beginner = "try wraps code that might fail. If an error happens, control moves to catch so your app can handle the failure gracefully.",
  guided   = "Starts exception handling block. Pair with catch and optional finally.",
  clean    = "try { ... } catch (...) { ... }",
}

tooltips["catch"] = {
  beginner = "catch receives errors thrown inside the matching try block so you can handle them instead of crashing.",
  guided   = "Exception handler for errors thrown in the paired try block.",
  clean    = "catch (err) { ... } — exception handler",
}

tooltips["finally"] = {
  beginner = "finally runs after try/catch no matter what. Use it for cleanup, like stopping a loading state.",
  guided   = "Cleanup block that runs after try/catch regardless of success or failure.",
  clean    = "finally { ... } — guaranteed cleanup",
}

tooltips["throw"] = {
  beginner = "throw creates an error and stops normal execution, sending control to the nearest catch block.",
  guided   = "Raises an exception. Use Error objects for stack and message consistency.",
  clean    = "throw value — raise exception",
}

tooltips["in"] = {
  beginner = "in checks whether a property name exists on an object, or appears in a for...in loop over object keys.",
  guided   = "Used for property-membership checks and for...in key iteration.",
  clean    = "in — membership / for...in keyword",
}

tooltips["of"] = {
  beginner = "of is used in for...of loops to iterate actual values in arrays or other iterables.",
  guided   = "for...of value iteration keyword (arrays, strings, iterables).",
  clean    = "of — for...of iteration keyword",
}

tooltips["new"] = {
  beginner = "new creates an instance from a class or constructor function.",
  guided   = "Invokes constructor and returns a new instance object.",
  clean    = "new Constructor(...) — instance creation",
}

tooltips["class"] = {
  beginner = "class defines a blueprint for objects with shared methods and data. Modern React mostly uses function components, but classes are still part of JavaScript.",
  guided   = "Class declaration syntax for constructor/prototype-based objects.",
  clean    = "class Name { ... } — class declaration",
}

tooltips["extends"] = {
  beginner = "extends means one class inherits behavior from another class.",
  guided   = "Class inheritance keyword.",
  clean    = "extends BaseClass — inherit from class",
}

tooltips["("] = {
  beginner = "( starts a parameter list, argument list, or grouped expression. In hooks like useState(0), it opens the arguments passed to the hook call.",
  guided   = "Open parenthesis: call arguments, function params, or expression grouping.",
  clean    = "( — open parenthesis",
}

tooltips[")"] = {
  beginner = ") closes a parameter list, argument list, or grouped expression.",
  guided   = "Close parenthesis.",
  clean    = ") — close parenthesis",
}

tooltips["["] = {
  beginner = "[ starts an array literal or array destructuring. In const [count, setCount] = useState(0), it starts unpacking the returned array.",
  guided   = "Open bracket: array literal/index access/destructuring.",
  clean    = "[ — open bracket",
}

tooltips["]"] = {
  beginner = "] closes an array literal, index access, or destructuring pattern.",
  guided   = "Close bracket.",
  clean    = "] — close bracket",
}

tooltips["{"] = {
  beginner = "{ starts a block of code or an object literal. In JSX, single braces also mean 'switch into JavaScript expression mode'.",
  guided   = "Open brace: block/object literal/JSX expression boundary.",
  clean    = "{ — open brace",
}

tooltips["}"] = {
  beginner = "} closes a block, object literal, or JSX expression block.",
  guided   = "Close brace.",
  clean    = "} — close brace",
}

tooltips[","] = {
  beginner = ", separates items: function arguments, array elements, object properties, or variables in destructuring.",
  guided   = "Comma separator between list items.",
  clean    = ", — separator",
}

tooltips["."] = {
  beginner = ". accesses a property or method on an object, like user.name or items.map(...).",
  guided   = "Property/method access operator.",
  clean    = ". — property access",
}

tooltips[";"] = {
  beginner = "; ends a statement. JavaScript can insert semicolons automatically, but writing them makes boundaries explicit.",
  guided   = "Statement terminator.",
  clean    = "; — statement terminator",
}

tooltips[":"] = {
  beginner = ": is used in object properties (key: value), type annotations, and ternary expressions (condition ? yes : no).",
  guided   = "Colon in object literals, annotations, and ternaries.",
  clean    = ": — object/annotation/ternary separator",
}

tooltips["=>"] = {
  beginner = "=> creates an arrow function. Left side is parameters, right side is the function body or returned expression.",
  guided   = "Arrow function operator. Lexically binds this and supports concise function syntax.",
  clean    = "=> — arrow function operator",
}

tooltips["="] = {
  beginner = "= assigns a value to a variable, like const total = price + tax.",
  guided   = "Assignment operator.",
  clean    = "= — assignment",
}

tooltips["=="] = {
  beginner = "== checks equality with type conversion. Beginners should usually use === instead to avoid surprises.",
  guided   = "Loose equality with coercion. Prefer === for predictable behavior.",
  clean    = "== — loose equality",
}

tooltips["==="] = {
  beginner = "=== checks strict equality: same value and same type. This is the safest default comparison in JavaScript.",
  guided   = "Strict equality (no coercion).",
  clean    = "=== — strict equality",
}

tooltips["!="] = {
  beginner = "!= checks inequality with type conversion. Usually prefer !== for strict comparisons.",
  guided   = "Loose inequality with coercion. Prefer !==.",
  clean    = "!= — loose inequality",
}

tooltips["!=="] = {
  beginner = "!== checks strict inequality: value or type is different.",
  guided   = "Strict inequality (no coercion).",
  clean    = "!== — strict inequality",
}

tooltips["!"] = {
  beginner = "! flips true/false. Example: !isLoading means 'not loading'.",
  guided   = "Logical NOT operator.",
  clean    = "! — logical NOT",
}

tooltips["&&"] = {
  beginner = "&& means 'and'. It is true only when both sides are true. In JSX it is often used for conditional rendering.",
  guided   = "Logical AND with short-circuit behavior.",
  clean    = "&& — logical AND",
}

tooltips["||"] = {
  beginner = "|| means 'or'. It returns the first truthy value, otherwise the second one.",
  guided   = "Logical OR with short-circuit behavior.",
  clean    = "|| — logical OR",
}

tooltips["?"] = {
  beginner = "? is part of the ternary operator: condition ? valueIfTrue : valueIfFalse.",
  guided   = "Ternary conditional operator marker.",
  clean    = "? — ternary operator",
}

tooltips["..."] = {
  beginner = "... is spread/rest syntax. It can copy or merge array/object items, or gather remaining function arguments.",
  guided   = "Spread/rest operator for expansion or collection.",
  clean    = "... — spread/rest syntax",
}

tooltips["<"] = {
  beginner = "< can start JSX tags like <Box> or compare values in JavaScript expressions.",
  guided   = "Less-than operator or JSX opening delimiter depending on context.",
  clean    = "< — JSX opener or less-than",
}

tooltips[">"] = {
  beginner = "> can close a JSX opening tag or compare values in JavaScript expressions.",
  guided   = "Greater-than operator or JSX tag closer depending on context.",
  clean    = "> — JSX closer or greater-than",
}

tooltips["</"] = {
  beginner = "</ starts a JSX closing tag, like </Box>.",
  guided   = "JSX closing tag opener.",
  clean    = "</ — JSX close tag start",
}

tooltips["/>"] = {
  beginner = "/> ends a self-closing JSX element like <Image src='x' />.",
  guided   = "JSX self-closing element terminator.",
  clean    = "/> — self-closing JSX terminator",
}

tooltips["<>"] = {
  beginner = "<> starts a React fragment, which groups elements without adding an extra wrapper node.",
  guided   = "React fragment open token.",
  clean    = "<> — fragment start",
}

tooltips["</>"] = {
  beginner = "</> closes a React fragment.",
  guided   = "React fragment close token.",
  clean    = "</> — fragment end",
}

local function pickLevel(entry, level)
  if not entry then return nil end
  if level and entry[level] then return entry[level] end
  return entry.guided or entry.clean or entry.beginner
end

local function isIdentifier(token)
  if not token then return false end
  return token:match("^[a-zA-Z_$][a-zA-Z0-9_$]*$") ~= nil
end

local function toLabel(name)
  if not name or name == "" then return "this name" end
  return "'" .. name .. "'"
end

local function genericIdentifierTooltip(token, level, context)
  if not isIdentifier(token) then return nil end
  local prevToken = context and context.prevToken or nil
  local nextToken = context and context.nextToken or nil

  if token:match("^use[A-Z]") then
    if level == "beginner" then
      return "This name looks like a custom React hook. Hooks are reusable state/effect logic. By convention, custom hooks start with 'use' and are called at the top level of components."
    elseif level == "guided" then
      return "Likely a custom hook (useX). Keep calls unconditional and at component top level."
    else
      return "Custom hook-style identifier"
    end
  end

  if token:match("^set[A-Z]") then
    if level == "beginner" then
      return toLabel(token) .. " looks like a state setter (often from useState). Calling it schedules a re-render with updated state."
    elseif level == "guided" then
      return "Setter-style identifier; likely from useState tuple."
    else
      return "State setter-style identifier"
    end
  end

  if prevToken == "const" or prevToken == "let" or prevToken == "var" then
    if level == "beginner" then
      return "This is a variable being declared. The name is how you refer to this value later in the component."
    elseif level == "guided" then
      return "Variable declaration identifier."
    else
      return "Declared variable name"
    end
  end

  if prevToken == "function" then
    if level == "beginner" then
      return "This is the function name. You can call this name elsewhere to run the function."
    elseif level == "guided" then
      return "Function declaration identifier."
    else
      return "Function name"
    end
  end

  if nextToken == "(" then
    if level == "beginner" then
      return "This name is being called like a function. The parentheses after it hold the inputs (arguments)."
    elseif level == "guided" then
      return "Function call identifier."
    else
      return "Function call target"
    end
  end

  if token:match("^[A-Z][A-Za-z0-9_]*$") then
    if level == "beginner" then
      return "This PascalCase name is usually a React component. Components are reusable UI functions that return JSX."
    elseif level == "guided" then
      return "PascalCase identifier; typically a component or class."
    else
      return "PascalCase identifier"
    end
  end

  if level == "beginner" then
    return "This is an identifier (a name for a value, function, or object)."
  elseif level == "guided" then
    return "Identifier reference."
  else
    return "Identifier"
  end
end

function M.lookup(token, level, context)
  if not token or token == "" then return nil end
  local entry = tooltips[token]
  if entry then
    local text = pickLevel(entry, level)
    if text and text ~= "" then
      return {
        key = token,
        text = text,
        entry = entry,
      }
    end
  end

  local fallback = genericIdentifierTooltip(token, level, context)
  if fallback then
    return {
      key = "__generic_identifier",
      text = fallback,
      entry = nil,
    }
  end

  return nil
end

function M.inlineHint(line, level)
  if level ~= "beginner" or not line then return nil end
  local trimmed = line:gsub("^%s+", ""):gsub("%s+$", "")
  if trimmed == "" then return nil end
  if trimmed:find("//", 1, true) or trimmed:find("/%*", 1, true) then return nil end

  if trimmed:find("const%s+%[[^%]]+%]%s*=%s*useState%s*%(") then
    return "array destructuring: [state, setState] from useState(...)"
  end
  if trimmed:find("useState%s*%(") then
    return "hook call: local state that survives re-renders"
  end
  if trimmed:find("useEffect%s*%(") then
    return "effect hook: run side effects after render"
  end
  if trimmed:find("useMemo%s*%(") then
    return "memoized value: recompute only when dependencies change"
  end
  if trimmed:find("useCallback%s*%(") then
    return "memoized function reference for stable props"
  end
  if trimmed:find("for%s*%(") then
    return "loop header: init; condition; update"
  end
  if trimmed:find("for%s+[%a_$][%w_$]*%s+of%s+") then
    return "for...of iterates over values"
  end
  if trimmed:find("for%s+[%a_$][%w_$]*%s+in%s+") then
    return "for...in iterates over object keys"
  end
  if trimmed:find("while%s*%(") then
    return "while loop: repeats while condition stays true"
  end
  if trimmed:find("^if%s*%(") then
    return "conditional branch: run this block only when true"
  end
  if trimmed:find("^return%s+<") or trimmed:find("^return%s*%(") then
    return "component render output"
  end
  if trimmed:find("%.map%s*%(") then
    return "map transforms each item; in JSX it renders a list"
  end
  if trimmed:find("=>") then
    return "arrow function: parameters on the left, body on the right"
  end
  if trimmed:find("^import%s+") then
    return "imports code from another module"
  end
  if trimmed:find("^export%s+") then
    return "exports this value for use in other files"
  end
  return nil
end

setmetatable(M, {
  __index = tooltips,
})

return M
