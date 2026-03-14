--[[
  capabilities/periodic_table.lua — Auto-generated from PeriodicTable.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/PeriodicTable.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Chemistry = require("lua.generated.chemistry.elements")

local function computeData(props)
  local TABLE_LAYOUT = {
    {
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
  },
    {
    3,
    4,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    5,
    6,
    7,
    8,
    9,
    10,
  },
    {
    11,
    12,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    13,
    14,
    15,
    16,
    17,
    18,
  },
    {
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    27,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
  },
    {
    37,
    38,
    39,
    40,
    41,
    42,
    43,
    44,
    45,
    46,
    47,
    48,
    49,
    50,
    51,
    52,
    53,
    54,
  },
    {
    55,
    56,
    0,
    72,
    73,
    74,
    75,
    76,
    77,
    78,
    79,
    80,
    81,
    82,
    83,
    84,
    85,
    86,
  },
    {
    87,
    88,
    0,
    104,
    105,
    106,
    107,
    108,
    109,
    110,
    111,
    112,
    113,
    114,
    115,
    116,
    117,
    118,
  },
    {
    0,
    0,
    57,
    58,
    59,
    60,
    61,
    62,
    63,
    64,
    65,
    66,
    67,
    68,
    69,
    70,
    71,
    0,
  },
    {
    0,
    0,
    89,
    90,
    91,
    92,
    93,
    94,
    95,
    96,
    97,
    98,
    99,
    100,
    101,
    102,
    103,
    0,
  },
  }
  local s = props.tileSize or 40
  local h = s * 36 / 32
  local gap = math.max(1, math.floor(s / 20 + 0.5))
  return {
    TABLE_LAYOUT = TABLE_LAYOUT,
    s = s,
    h = h,
    gap = gap,
  }
end
local function rebuildList_0(wrapperNodeId, items, data, props)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, row in ipairs(items) do
      -- nested_map build children inline
      local inner_children = {}
      for _k, z in ipairs(row) do
        if z == 0 then
          inner_children[#inner_children + 1] =
        { type = "View", key = "li_0_inner_1_" .. _i .. "_" .. _k, style = { width = data.s, height = data.h } }
        else
          inner_children[#inner_children + 1] =
        { type = "TslxElementTile", key = "li_0_inner_2_" .. _i .. "_" .. _k, props = { element = z, selected = z == ((props.selected) or (0)), size = data.s } }
        end
      end
    tmpl[#tmpl + 1] =
    { type = "View", key = "li_0_" .. _i, style = { flexDirection = "row", gap = data.gap }, children = inner_children }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function buildTemplate()
  return {
    { type = "View", key = "n0", children = {
      { type = "View", key = "n0_1_list_0" },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  Tree.updateChildProps(handles["n0_1_list_0"], { style = { gap = data.gap } })
  Tree.updateChildProps(handles["n0"], { style = { gap = data.gap } })
  rebuildList_0(handles["n0_1_list_0"], data.TABLE_LAYOUT, data, props)
end

Capabilities.register("TslxPeriodicTable", {
  visual = false,

  schema = {
    selected = { type = "number", default = 0, desc = "Atomic number of highlighted element (0 = none)" },
    tileSize = { type = "number", default = 40, desc = "Tile width in pixels" },
  },

  events = {},

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
    end
    local handles = Tree.declareChildren(nodeId, buildTemplate())
    updateTree(handles, props)
    return { handles = handles }
  end,

  update = function(nodeId, props, prev, state)
    updateTree(state.handles, props)
  end,

  destroy = function(nodeId, state)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function() end,
})

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/periodic_table.lua ---
