--[[
  capabilities/element_card.lua — Full element property card (tree-composed)

  This is the first capability to use Lua-side subtree declaration instead of
  manual love.graphics draw calls. The render output is composed from the same
  tree primitives React uses (View, __TEXT__, Text) — laid out by layout.lua,
  painted by painter.lua.

  React usage:
    <ElementCard element={26} />
    <ElementCard element="Fe" />

  Props:
    element   number|string  Atomic number or symbol
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Tree = require("lua.tree")

local CATEGORY_COLORS = {
  ["alkali-metal"]         = "#7b6faa",
  ["alkaline-earth"]       = "#9a9cc4",
  ["transition-metal"]     = "#de9a9a",
  ["post-transition-metal"]= "#8fbc8f",
  ["metalloid"]            = "#c8c864",
  ["nonmetal"]             = "#59b5e6",
  ["halogen"]              = "#d4a844",
  ["noble-gas"]            = "#c87e4a",
  ["lanthanide"]           = "#c45879",
  ["actinide"]             = "#d4879a",
}

local PHASE_COLORS = {
  solid   = "#69db7c",
  liquid  = "#4dabf7",
  gas     = "#ffd43b",
  unknown = "#868e96",
}

--- Build the static template for an ElementCard subtree.
--- This is the tree-composed equivalent of what render() used to draw manually.
local function buildTemplate()
  -- Property row helper: label on left, value on right
  local function propRow(key)
    return {
      type = "View", key = key,
      style = {
        flexDirection = "row", justifyContent = "space-between",
        paddingLeft = 0, paddingRight = 0,
      },
      children = {
        { type = "Text", key = key .. "_label",
          children = {
            { type = "__TEXT__", key = key .. "_label_t", text = "" },
          },
          style = { fontSize = 12, color = "#a5adcb" },
        },
        { type = "Text", key = key .. "_value",
          children = {
            { type = "__TEXT__", key = key .. "_value_t", text = "" },
          },
          style = { fontSize = 12, color = "#cad3f5" },
        },
      },
    }
  end

  return {
    -- Outer card container
    {
      type = "View", key = "card",
      style = {
        borderRadius = 8, backgroundColor = "#363a4f",
        padding = 12, borderWidth = 2, borderColor = "#868e96",
        width = "100%",
      },
      children = {
        -- Header row: badge + name/category
        {
          type = "View", key = "header",
          style = { flexDirection = "row", gap = 10, marginBottom = 12 },
          children = {
            -- Symbol badge
            {
              type = "View", key = "badge",
              style = {
                width = 44, height = 44, borderRadius = 6,
                backgroundColor = "#868e96",
                alignItems = "center", justifyContent = "center",
              },
              children = {
                { type = "Text", key = "badge_number",
                  children = {
                    { type = "__TEXT__", key = "badge_number_t", text = "" },
                  },
                  style = { fontSize = 10, color = "rgba(0,0,0,0.6)" },
                },
                { type = "Text", key = "badge_symbol",
                  children = {
                    { type = "__TEXT__", key = "badge_symbol_t", text = "" },
                  },
                  style = { fontSize = 16, color = "#000000", fontWeight = "bold" },
                },
              },
            },
            -- Name + category column
            {
              type = "View", key = "name_col",
              style = { justifyContent = "center" },
              children = {
                { type = "Text", key = "name",
                  children = {
                    { type = "__TEXT__", key = "name_t", text = "" },
                  },
                  style = { fontSize = 14, color = "#cad3f5" },
                },
                { type = "Text", key = "category",
                  children = {
                    { type = "__TEXT__", key = "category_t", text = "" },
                  },
                  style = { fontSize = 12, color = "#a5adcb" },
                },
              },
            },
          },
        },
        -- Property rows
        propRow("mass"),
        propRow("group"),
        propRow("period"),
        propRow("phase"),
        propRow("valence"),
        propRow("en"),
        propRow("mp"),
        propRow("bp"),
        propRow("density"),
        propRow("econfig"),
      },
    },
  }
end

--- Push element data into the declared subtree handles.
local function updateTree(handles, el)
  if not el then return end

  local catColor = CATEGORY_COLORS[el.category] or "#868e96"
  local phaseColor = PHASE_COLORS[el.phase] or "#868e96"
  local valence = Chemistry.valenceElectrons(el.number)

  -- Card border color
  Tree.updateChildProps(handles["card"], {
    style = { borderColor = catColor },
  })

  -- Badge
  Tree.updateChildProps(handles["badge"], {
    style = { backgroundColor = catColor },
  })
  Tree.updateChildProps(handles["badge_number_t"], { text = tostring(el.number) })
  Tree.updateChildProps(handles["badge_symbol_t"], { text = el.symbol })

  -- Name + category
  Tree.updateChildProps(handles["name_t"], { text = el.name })
  Tree.updateChildProps(handles["category_t"], { text = el.category:gsub("-", " ") })

  -- Property rows: { key, label, value, valueColor? }
  local rows = {
    { "mass",    "Atomic Mass",        string.format("%.3f u", el.mass) },
    { "group",   "Group",              tostring(el.group) },
    { "period",  "Period",             tostring(el.period) },
    { "phase",   "Phase",              el.phase,                          phaseColor },
    { "valence", "Valence Electrons",  tostring(valence) },
    { "en",      "Electronegativity",  el.electronegativity and tostring(el.electronegativity) or "\u{2014}" },
    { "mp",      "Melting Point",      el.meltingPoint and string.format("%.0f K", el.meltingPoint) or "\u{2014}" },
    { "bp",      "Boiling Point",      el.boilingPoint and string.format("%.0f K", el.boilingPoint) or "\u{2014}" },
    { "density", "Density",            el.density and string.format("%.3f g/cm\u{00B3}", el.density) or "\u{2014}" },
    { "econfig", "Electron Config",    el.electronConfig or "" },
  }

  for _, row in ipairs(rows) do
    local key, label, value, valueColor = row[1], row[2], row[3], row[4]
    Tree.updateChildProps(handles[key .. "_label_t"], { text = label })
    Tree.updateChildProps(handles[key .. "_value_t"], { text = value })
    if valueColor then
      Tree.updateChildProps(handles[key .. "_value"], {
        style = { color = valueColor },
      })
    end
  end
end

Capabilities.register("ElementCard", {
  -- visual = false: we no longer paint manually. The subtree nodes
  -- are regular tree nodes — layout and painter handle them.
  visual = false,

  schema = {
    element = { type = "number", default = 1, desc = "Atomic number or symbol" },
  },

  events = {},

  create = function(nodeId, props)
    local handles = Tree.declareChildren(nodeId, buildTemplate())
    local el = Chemistry.getElement(props.element)
    updateTree(handles, el)
    return { handles = handles, elementData = el, prevElement = props.element }
  end,

  update = function(nodeId, props, prev, state)
    if props.element ~= state.prevElement then
      state.prevElement = props.element
      state.elementData = Chemistry.getElement(props.element)
      updateTree(state.handles, state.elementData)
    end
  end,

  destroy = function(nodeId, state)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function(nodeId, state, dt, pushEvent, props) end,
})
