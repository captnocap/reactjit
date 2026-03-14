--[[
  capabilities/dashboard_card.lua — Auto-generated from DashboardCard.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/DashboardCard.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")

local function buildTemplate()
  return {
    { type = "View", key = "c3_0", style = { flexDirection = "row", justifyContent = "space-between", alignItems = "center", marginBottom = 16 }, children = {
      { type = "View", key = "c3_0_1_1", style = { flexDirection = "row", gap = 12, alignItems = "center" }, children = {
        { type = "View", key = "c3_0_1_1_1_2", style = { width = 40, height = 40, borderRadius = 20, backgroundColor = "#5e81ac", alignItems = "center", justifyContent = "center" }, children = {
          { type = "Text", key = "c3_0_1_1_1_2_1_3", style = { fontSize = 18, color = "#eceff4", fontWeight = "bold" }, children = {
            { type = "__TEXT__", key = "c3_0_1_1_1_2_1_3_0_t", text = "" },
            } },
          } },
        { type = "View", key = "c3_0_1_1_3_4", style = { gap = 2 }, children = {
          { type = "Text", key = "c3_0_1_1_3_4_1_5", style = { fontSize = 14, color = "#eceff4", fontWeight = "bold" }, children = {
            { type = "__TEXT__", key = "c3_0_1_1_3_4_1_5_0_t", text = "" },
            } },
          { type = "Text", key = "c3_0_1_1_3_4_3_6", style = { fontSize = 11, color = "#4c566a" }, children = {
            { type = "__TEXT__", key = "c3_0_1_1_3_4_3_6_0_t", text = "" },
            } },
          } },
        } },
      { type = "View", key = "c3_0_3_7", style = { backgroundColor = "#a3be8c", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c3_0_3_7_1_8", style = { fontSize = 10, color = "#2e3440" }, children = {
          { type = "__TEXT__", key = "c3_0_3_7_1_8_0_t", text = "" },
          } },
        } },
      } },
    { type = "View", key = "c7_9", style = { flexDirection = "row", gap = 8, marginBottom = 16 }, children = {
      { type = "View", key = "c7_9_1_10", style = { flexGrow = 1, flexBasis = 0, backgroundColor = "#3b4252", borderRadius = 6, padding = 10, alignItems = "center", gap = 4 }, children = {
        { type = "Text", key = "c7_9_1_10_1_11", style = { fontSize = 20, color = "#88c0d0", fontWeight = "bold" }, children = {
          { type = "__TEXT__", key = "c7_9_1_10_1_11_0_t", text = "" },
          } },
        { type = "Text", key = "c7_9_1_10_3_12", style = { fontSize = 10, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c7_9_1_10_3_12_0_t", text = "Commits" },
          } },
        } },
      { type = "View", key = "c7_9_3_13", style = { flexGrow = 1, flexBasis = 0, backgroundColor = "#3b4252", borderRadius = 6, padding = 10, alignItems = "center", gap = 4 }, children = {
        { type = "Text", key = "c7_9_3_13_1_14", style = { fontSize = 20, color = "#88c0d0", fontWeight = "bold" }, children = {
          { type = "__TEXT__", key = "c7_9_3_13_1_14_0_t", text = "" },
          } },
        { type = "Text", key = "c7_9_3_13_3_15", style = { fontSize = 10, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c7_9_3_13_3_15_0_t", text = "PRs" },
          } },
        } },
      { type = "View", key = "c7_9_5_16", style = { flexGrow = 1, flexBasis = 0, backgroundColor = "#3b4252", borderRadius = 6, padding = 10, alignItems = "center", gap = 4 }, children = {
        { type = "Text", key = "c7_9_5_16_1_17", style = { fontSize = 20, color = "#88c0d0", fontWeight = "bold" }, children = {
          { type = "__TEXT__", key = "c7_9_5_16_1_17_0_t", text = "" },
          } },
        { type = "Text", key = "c7_9_5_16_3_18", style = { fontSize = 10, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c7_9_5_16_3_18_0_t", text = "Issues" },
          } },
        } },
      } },
    { type = "View", key = "c11_19", style = { backgroundColor = "#3b4252", borderRadius = 8, padding = 12, gap = 10, marginBottom = 16 }, children = {
      { type = "Text", key = "c11_19_1_20", style = { fontSize = 12, color = "#eceff4", fontWeight = "bold" }, children = {
        { type = "__TEXT__", key = "c11_19_1_20_0_t", text = "Sprint Progress" },
        } },
      { type = "View", key = "c11_19_3_21", style = { gap = 4 }, children = {
        { type = "View", key = "c11_19_3_21_1_22", style = { flexDirection = "row", justifyContent = "space-between" }, children = {
          { type = "Text", key = "c11_19_3_21_1_22_1_23", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c11_19_3_21_1_22_1_23_0_t", text = "Frontend" },
            } },
          { type = "Text", key = "c11_19_3_21_1_22_3_24", style = { fontSize = 11, color = "#4c566a" }, children = {
            { type = "__TEXT__", key = "c11_19_3_21_1_22_3_24_0_t", text = "72%" },
            } },
          } },
        { type = "View", key = "c11_19_3_21_3_25", style = { height = 6, borderRadius = 3, backgroundColor = "#2e3440" }, children = {
          { type = "View", key = "c11_19_3_21_3_25_1_26", style = { height = 6, borderRadius = 3, backgroundColor = "#88c0d0", width = "72%" } },
          } },
        } },
      { type = "View", key = "c11_19_5_27", style = { gap = 4 }, children = {
        { type = "View", key = "c11_19_5_27_1_28", style = { flexDirection = "row", justifyContent = "space-between" }, children = {
          { type = "Text", key = "c11_19_5_27_1_28_1_29", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c11_19_5_27_1_28_1_29_0_t", text = "Backend" },
            } },
          { type = "Text", key = "c11_19_5_27_1_28_3_30", style = { fontSize = 11, color = "#4c566a" }, children = {
            { type = "__TEXT__", key = "c11_19_5_27_1_28_3_30_0_t", text = "45%" },
            } },
          } },
        { type = "View", key = "c11_19_5_27_3_31", style = { height = 6, borderRadius = 3, backgroundColor = "#2e3440" }, children = {
          { type = "View", key = "c11_19_5_27_3_31_1_32", style = { height = 6, borderRadius = 3, backgroundColor = "#a3be8c", width = "45%" } },
          } },
        } },
      { type = "View", key = "c11_19_7_33", style = { gap = 4 }, children = {
        { type = "View", key = "c11_19_7_33_1_34", style = { flexDirection = "row", justifyContent = "space-between" }, children = {
          { type = "Text", key = "c11_19_7_33_1_34_1_35", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c11_19_7_33_1_34_1_35_0_t", text = "Docs" },
            } },
          { type = "Text", key = "c11_19_7_33_1_34_3_36", style = { fontSize = 11, color = "#4c566a" }, children = {
            { type = "__TEXT__", key = "c11_19_7_33_1_34_3_36_0_t", text = "90%" },
            } },
          } },
        { type = "View", key = "c11_19_7_33_3_37", style = { height = 6, borderRadius = 3, backgroundColor = "#2e3440" }, children = {
          { type = "View", key = "c11_19_7_33_3_37_1_38", style = { height = 6, borderRadius = 3, backgroundColor = "#ebcb8b", width = "90%" } },
          } },
        } },
      { type = "View", key = "c11_19_9_39", style = { gap = 4 }, children = {
        { type = "View", key = "c11_19_9_39_1_40", style = { flexDirection = "row", justifyContent = "space-between" }, children = {
          { type = "Text", key = "c11_19_9_39_1_40_1_41", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c11_19_9_39_1_40_1_41_0_t", text = "Tests" },
            } },
          { type = "Text", key = "c11_19_9_39_1_40_3_42", style = { fontSize = 11, color = "#4c566a" }, children = {
            { type = "__TEXT__", key = "c11_19_9_39_1_40_3_42_0_t", text = "33%" },
            } },
          } },
        { type = "View", key = "c11_19_9_39_3_43", style = { height = 6, borderRadius = 3, backgroundColor = "#2e3440" }, children = {
          { type = "View", key = "c11_19_9_39_3_43_1_44", style = { height = 6, borderRadius = 3, backgroundColor = "#bf616a", width = "33%" } },
          } },
        } },
      } },
    { type = "View", key = "c15_45", style = { gap = 2 }, children = {
      { type = "Text", key = "c15_45_1_46", style = { fontSize = 12, color = "#eceff4", fontWeight = "bold", marginBottom = 8 }, children = {
        { type = "__TEXT__", key = "c15_45_1_46_0_t", text = "Recent Activity" },
        } },
      { type = "View", key = "c15_45_3_47", style = { flexDirection = "row", justifyContent = "space-between", paddingTop = 6, paddingBottom = 6, borderBottomWidth = 1, borderColor = "#3b4252" }, children = {
        { type = "View", key = "c15_45_3_47_1_48", style = { flexDirection = "row", gap = 6 }, children = {
          { type = "Text", key = "c15_45_3_47_1_48_1_49", style = { fontSize = 11, color = "#81a1c1" }, children = {
            { type = "__TEXT__", key = "c15_45_3_47_1_48_1_49_0_t", text = "pushed to" },
            } },
          { type = "Text", key = "c15_45_3_47_1_48_3_50", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c15_45_3_47_1_48_3_50_0_t", text = "main" },
            } },
          } },
        { type = "Text", key = "c15_45_3_47_3_51", style = { fontSize = 11, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c15_45_3_47_3_51_0_t", text = "2m ago" },
          } },
        } },
      { type = "View", key = "c15_45_5_52", style = { flexDirection = "row", justifyContent = "space-between", paddingTop = 6, paddingBottom = 6, borderBottomWidth = 1, borderColor = "#3b4252" }, children = {
        { type = "View", key = "c15_45_5_52_1_53", style = { flexDirection = "row", gap = 6 }, children = {
          { type = "Text", key = "c15_45_5_52_1_53_1_54", style = { fontSize = 11, color = "#81a1c1" }, children = {
            { type = "__TEXT__", key = "c15_45_5_52_1_53_1_54_0_t", text = "reviewed" },
            } },
          { type = "Text", key = "c15_45_5_52_1_53_3_55", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c15_45_5_52_1_53_3_55_0_t", text = "PR #142" },
            } },
          } },
        { type = "Text", key = "c15_45_5_52_3_56", style = { fontSize = 11, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c15_45_5_52_3_56_0_t", text = "15m ago" },
          } },
        } },
      { type = "View", key = "c15_45_7_57", style = { flexDirection = "row", justifyContent = "space-between", paddingTop = 6, paddingBottom = 6, borderBottomWidth = 1, borderColor = "#3b4252" }, children = {
        { type = "View", key = "c15_45_7_57_1_58", style = { flexDirection = "row", gap = 6 }, children = {
          { type = "Text", key = "c15_45_7_57_1_58_1_59", style = { fontSize = 11, color = "#81a1c1" }, children = {
            { type = "__TEXT__", key = "c15_45_7_57_1_58_1_59_0_t", text = "closed" },
            } },
          { type = "Text", key = "c15_45_7_57_1_58_3_60", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c15_45_7_57_1_58_3_60_0_t", text = "Issue #89" },
            } },
          } },
        { type = "Text", key = "c15_45_7_57_3_61", style = { fontSize = 11, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c15_45_7_57_3_61_0_t", text = "1h ago" },
          } },
        } },
      { type = "View", key = "c15_45_9_62", style = { flexDirection = "row", justifyContent = "space-between", paddingTop = 6, paddingBottom = 6, borderBottomWidth = 1, borderColor = "#3b4252" }, children = {
        { type = "View", key = "c15_45_9_62_1_63", style = { flexDirection = "row", gap = 6 }, children = {
          { type = "Text", key = "c15_45_9_62_1_63_1_64", style = { fontSize = 11, color = "#81a1c1" }, children = {
            { type = "__TEXT__", key = "c15_45_9_62_1_63_1_64_0_t", text = "opened" },
            } },
          { type = "Text", key = "c15_45_9_62_1_63_3_65", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c15_45_9_62_1_63_3_65_0_t", text = "PR #143" },
            } },
          } },
        { type = "Text", key = "c15_45_9_62_3_66", style = { fontSize = 11, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c15_45_9_62_3_66_0_t", text = "2h ago" },
          } },
        } },
      { type = "View", key = "c15_45_11_67", style = { flexDirection = "row", justifyContent = "space-between", paddingTop = 6, paddingBottom = 6, borderBottomWidth = 1, borderColor = "#3b4252" }, children = {
        { type = "View", key = "c15_45_11_67_1_68", style = { flexDirection = "row", gap = 6 }, children = {
          { type = "Text", key = "c15_45_11_67_1_68_1_69", style = { fontSize = 11, color = "#81a1c1" }, children = {
            { type = "__TEXT__", key = "c15_45_11_67_1_68_1_69_0_t", text = "commented on" },
            } },
          { type = "Text", key = "c15_45_11_67_1_68_3_70", style = { fontSize = 11, color = "#d8dee9" }, children = {
            { type = "__TEXT__", key = "c15_45_11_67_1_68_3_70_0_t", text = "Issue #91" },
            } },
          } },
        { type = "Text", key = "c15_45_11_67_3_71", style = { fontSize = 11, color = "#4c566a" }, children = {
          { type = "__TEXT__", key = "c15_45_11_67_3_71_0_t", text = "3h ago" },
          } },
        } },
      } },
    { type = "View", key = "c19_72", style = { flexDirection = "row", gap = 6, marginTop = 16, flexWrap = "wrap" }, children = {
      { type = "View", key = "c19_72_1_73", style = { backgroundColor = "#5e81ac", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_1_73_1_74", style = { fontSize = 10, color = "#eceff4" }, children = {
          { type = "__TEXT__", key = "c19_72_1_73_1_74_0_t", text = "lua" },
          } },
        } },
      { type = "View", key = "c19_72_3_75", style = { backgroundColor = "#88c0d0", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_3_75_1_76", style = { fontSize = 10, color = "#2e3440" }, children = {
          { type = "__TEXT__", key = "c19_72_3_75_1_76_0_t", text = "react" },
          } },
        } },
      { type = "View", key = "c19_72_5_77", style = { backgroundColor = "#a3be8c", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_5_77_1_78", style = { fontSize = 10, color = "#2e3440" }, children = {
          { type = "__TEXT__", key = "c19_72_5_77_1_78_0_t", text = "love2d" },
          } },
        } },
      { type = "View", key = "c19_72_7_79", style = { backgroundColor = "#81a1c1", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_7_79_1_80", style = { fontSize = 10, color = "#2e3440" }, children = {
          { type = "__TEXT__", key = "c19_72_7_79_1_80_0_t", text = "typescript" },
          } },
        } },
      { type = "View", key = "c19_72_9_81", style = { backgroundColor = "#b48ead", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_9_81_1_82", style = { fontSize = 10, color = "#eceff4" }, children = {
          { type = "__TEXT__", key = "c19_72_9_81_1_82_0_t", text = "opengl" },
          } },
        } },
      { type = "View", key = "c19_72_11_83", style = { backgroundColor = "#d08770", borderRadius = 4, paddingLeft = 8, paddingRight = 8, paddingTop = 2, paddingBottom = 2 }, children = {
        { type = "Text", key = "c19_72_11_83_1_84", style = { fontSize = 10, color = "#2e3440" }, children = {
          { type = "__TEXT__", key = "c19_72_11_83_1_84_0_t", text = "ffi" },
          } },
        } },
      } },
  }
end

local function updateTree(handles, props)
  Tree.updateChildProps(handles["c3_0_1_1_1_2_1_3_0_t"], { text = props.avatarLetter or "" })
  Tree.updateChildProps(handles["c3_0_1_1_3_4_1_5_0_t"], { text = props.username or "" })
  Tree.updateChildProps(handles["c3_0_1_1_3_4_3_6_0_t"], { text = props.handle or "" })
  Tree.updateChildProps(handles["c3_0_3_7_1_8_0_t"], { text = props.status or "" })
  Tree.updateChildProps(handles["c7_9_1_10_1_11_0_t"], { text = props.commits or "" })
  Tree.updateChildProps(handles["c7_9_3_13_1_14_0_t"], { text = props.prs or "" })
  Tree.updateChildProps(handles["c7_9_5_16_1_17_0_t"], { text = props.issues or "" })
end

Capabilities.register("DashboardCard", {
  visual = false,

  schema = {
    username = { type = "string", default = "user", desc = "Username" },
    status = { type = "string", default = "online", desc = "Status: online/away/busy/offline" },
    commits = { type = "number", default = 847, desc = "Commit count" },
    prs = { type = "number", default = 63, desc = "PR count" },
    issues = { type = "number", default = 128, desc = "Issue count" },
  },

  events = {},

  create = function(nodeId, props)
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
