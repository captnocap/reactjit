--[[
  capabilities/spectrum_view.lua — Spectral data visualization

  Renders IR, UV-Vis, mass spec, and NMR spectra as interactive line/bar plots
  with labeled peaks, axes, and grid. All rendering at 60fps in Lua — React
  only declares what to show.

  React usage:
    <SpectrumView spectrumType="ir" compound="C2H5OH" />
    <SpectrumView spectrumType="mass-spec" compound="C8H10N4O2" showLabels />
    <SpectrumView spectrumType="uv-vis" compound="C6H6" highlightPeak={256} />

  Props:
    spectrumType    string   "ir" | "uv-vis" | "mass-spec"
    compound        string   Formula or compound name
    showLabels      boolean  Show peak labels (default: true)
    showGrid        boolean  Show grid lines (default: true)
    highlightPeak   number   Highlight peak at this position
    lineColor       string   Spectrum line color (default: "#3b82f6")

  Events:
    onPeakSelect    { position, intensity, label, assignment }
]]

local Capabilities = require("lua.capabilities")
local ColorUtils = require("lua.color")

-- ============================================================================
-- Built-in spectra database
-- Each spectrum: { peaks = { {pos, intensity, label?, assignment?}, ... }, xRange, yRange, xLabel, yLabel }
-- ============================================================================

local SPECTRA = {}

SPECTRA["ir"] = {
  ["H2O"] = {
    xRange = {4000, 400}, yRange = {0, 1}, xLabel = "Wavenumber (cm-1)", yLabel = "Transmittance",
    peaks = {
      {3400, 0.95, "O-H stretch", "Broad, hydrogen bonded"},
      {1640, 0.55, "H-O-H bend", "Scissoring mode"},
      {680,  0.30, "Libration", "Hindered rotation"},
    },
  },
  ["C2H5OH"] = {
    xRange = {4000, 400}, yRange = {0, 1}, xLabel = "Wavenumber (cm-1)", yLabel = "Transmittance",
    peaks = {
      {3350, 0.90, "O-H stretch", "Broad, H-bonded alcohol"},
      {2975, 0.75, "C-H stretch", "sp3 asymmetric"},
      {2930, 0.70, "C-H stretch", "sp3 symmetric"},
      {2880, 0.55, "C-H stretch", "CH3 symmetric"},
      {1460, 0.40, "C-H bend", "CH2/CH3 deformation"},
      {1380, 0.35, "C-H bend", "CH3 symmetric bend"},
      {1050, 0.85, "C-O stretch", "Primary alcohol"},
      {880,  0.25, "C-C stretch", "Skeletal"},
    },
  },
  ["C3H6O"] = {
    xRange = {4000, 400}, yRange = {0, 1}, xLabel = "Wavenumber (cm-1)", yLabel = "Transmittance",
    peaks = {
      {2970, 0.60, "C-H stretch", "sp3 CH3"},
      {1715, 0.95, "C=O stretch", "Ketone carbonyl"},
      {1430, 0.35, "C-H bend", "CH3 asymmetric deformation"},
      {1365, 0.40, "C-H bend", "CH3 symmetric bend"},
      {1220, 0.50, "C-C stretch", "C-CO-C asymmetric"},
    },
  },
}

SPECTRA["uv-vis"] = {
  ["C6H6"] = {
    xRange = {180, 400}, yRange = {0, 1}, xLabel = "Wavelength (nm)", yLabel = "Absorbance",
    peaks = {
      {184, 0.95, "E1 band", "pi->pi* allowed, intense"},
      {204, 0.70, "E2 band", "pi->pi* allowed"},
      {256, 0.15, "B band", "pi->pi* forbidden, fine structure"},
    },
  },
}

SPECTRA["mass-spec"] = {
  ["C8H10N4O2"] = {
    xRange = {0, 220}, yRange = {0, 1}, xLabel = "m/z", yLabel = "Relative Intensity",
    peaks = {
      {194, 1.00, "M+", "Molecular ion [C8H10N4O2]+"},
      {193, 0.15, "M-1", "Loss of H"},
      {166, 0.45, "M-28", "Loss of CO"},
      {137, 0.65, "M-57", "Loss of C2H3NO"},
      {109, 0.55, "", "Fragment of m/z 137"},
      {82,  0.35, "", "Methylimidazole cation"},
      {67,  0.30, "", "C3H3N2+"},
      {55,  0.25, "", "C3H3NO+"},
      {42,  0.40, "", "CH2=N-CH3+ (iminium)"},
    },
  },
}

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function mapX(val, xRange, plotX, plotW)
  local lo, hi = xRange[1], xRange[2]
  return plotX + (val - lo) / (hi - lo) * plotW
end

local function mapY(val, yRange, plotY, plotH)
  local lo, hi = yRange[1], yRange[2]
  return plotY + plotH - (val - lo) / (hi - lo) * plotH
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("SpectrumView", {
  visual = true,

  schema = {
    spectrumType   = { type = "string", default = "ir", desc = "Spectrum type: ir, uv-vis, mass-spec" },
    compound       = { type = "string", default = "", desc = "Compound formula" },
    showLabels     = { type = "bool",   default = true, desc = "Show peak labels" },
    showGrid       = { type = "bool",   default = true, desc = "Show grid lines" },
    highlightPeak  = { type = "number", default = -1, desc = "Highlight peak at this position" },
    lineColor      = { type = "string", default = "#3b82f6", desc = "Spectrum line color" },
  },

  events = { "onPeakSelect" },

  create = function(nodeId, props) return {} end,
  update = function() end,
  destroy = function() end,
  tick = function() end,

  render = function(node, c, opacity)
    local props = node.props or {}
    local specType = props.spectrumType or "ir"
    local compound = props.compound or ""
    local showLabels = props.showLabels ~= false
    local showGrid = props.showGrid ~= false
    local highlightPos = props.highlightPeak or -1
    local lineColorHex = props.lineColor or "#3b82f6"

    local db = SPECTRA[specType]
    local spectrum = db and db[compound]

    local x, y, w, h = c.x, c.y, c.w, c.h
    local margin = 40
    local plotX = x + margin
    local plotY = y + 16
    local plotW = w - margin - 12
    local plotH = h - margin - 20

    if plotW <= 0 or plotH <= 0 then return end

    -- Scissor for clean clipping
    love.graphics.push("all")
    local psx, psy, psw, psh = love.graphics.getScissor()
    local sx, sy = love.graphics.transformPoint(x, y)
    local sx2, sy2 = love.graphics.transformPoint(x + w, y + h)
    love.graphics.intersectScissor(sx, sy, math.max(0, sx2 - sx), math.max(0, sy2 - sy))

    -- Background
    love.graphics.setColor(0.08, 0.08, 0.10, opacity)
    love.graphics.rectangle("fill", plotX, plotY, plotW, plotH)

    if not spectrum then
      -- No data
      love.graphics.setColor(0.5, 0.5, 0.5, opacity)
      local font = love.graphics.getFont()
      local msg = "No " .. specType:upper() .. " data for " .. compound
      local tw = font:getWidth(msg)
      love.graphics.print(msg, plotX + plotW / 2 - tw / 2, plotY + plotH / 2 - 6)
    else
      local xRange = spectrum.xRange
      local yRange = spectrum.yRange
      local peaks = spectrum.peaks

      -- Grid lines
      if showGrid then
        love.graphics.setColor(0.2, 0.2, 0.25, opacity * 0.5)
        love.graphics.setLineWidth(1)
        -- X grid (5 divisions)
        for i = 0, 5 do
          local val = xRange[1] + (xRange[2] - xRange[1]) * i / 5
          local gx = mapX(val, xRange, plotX, plotW)
          love.graphics.line(gx, plotY, gx, plotY + plotH)
        end
        -- Y grid (4 divisions)
        for i = 0, 4 do
          local val = yRange[1] + (yRange[2] - yRange[1]) * i / 4
          local gy = mapY(val, yRange, plotY, plotH)
          love.graphics.line(plotX, gy, plotX + plotW, gy)
        end
      end

      -- Draw spectrum
      if specType == "mass-spec" then
        -- Bar chart for mass spec
        for _, peak in ipairs(peaks) do
          local px = mapX(peak[1], xRange, plotX, plotW)
          local py = mapY(peak[2], yRange, plotY, plotH)
          local baseY = mapY(0, yRange, plotY, plotH)
          local isHighlight = (math.abs(peak[1] - highlightPos) < 2)

          if isHighlight then
            love.graphics.setColor(1.0, 0.4, 0.4, opacity)
            love.graphics.setLineWidth(3)
          else
            ColorUtils.set(lineColorHex, opacity)
            love.graphics.setLineWidth(2)
          end
          love.graphics.line(px, baseY, px, py)

          -- Peak dot
          love.graphics.circle("fill", px, py, isHighlight and 4 or 2.5)

          -- Label
          if showLabels and peak[3] and peak[3] ~= "" then
            love.graphics.setColor(0.8, 0.8, 0.8, opacity * 0.9)
            local font = love.graphics.getFont()
            local label = peak[3]
            local tw = font:getWidth(label)
            love.graphics.print(label, px - tw / 2, py - 14)
          end
        end
      else
        -- Line spectrum for IR / UV-Vis
        -- Sort peaks by position for line drawing
        local sorted = {}
        for _, p in ipairs(peaks) do sorted[#sorted + 1] = {p[1], p[2], p[3], p[4]} end
        table.sort(sorted, function(a, b) return a[1] < b[1] end)

        -- Draw connected line with Gaussian broadening simulation
        local RESOLUTION = 200
        local points = {}
        for i = 0, RESOLUTION do
          local xVal = xRange[1] + (xRange[2] - xRange[1]) * i / RESOLUTION
          -- Sum Gaussian contributions from each peak
          local yVal = 0
          for _, peak in ipairs(sorted) do
            local sigma = (xRange[2] - xRange[1]) * 0.015  -- peak width
            local dist = (xVal - peak[1]) / sigma
            yVal = yVal + peak[2] * math.exp(-0.5 * dist * dist)
          end
          -- For IR: transmittance = 1 - absorbance
          if specType == "ir" then yVal = 1.0 - yVal end
          yVal = math.max(yRange[1], math.min(yRange[2], yVal))

          local px = mapX(xVal, xRange, plotX, plotW)
          local py = mapY(yVal, yRange, plotY, plotH)
          points[#points + 1] = px
          points[#points + 1] = py
        end

        if #points >= 4 then
          ColorUtils.set(lineColorHex, opacity)
          love.graphics.setLineWidth(2)
          love.graphics.line(points)
        end

        -- Peak markers
        for _, peak in ipairs(peaks) do
          local px = mapX(peak[1], xRange, plotX, plotW)
          local peakY = peak[2]
          if specType == "ir" then peakY = 1.0 - peakY end
          local py = mapY(peakY, yRange, plotY, plotH)
          local isHighlight = (math.abs(peak[1] - highlightPos) < 20)

          if isHighlight then
            love.graphics.setColor(1.0, 0.4, 0.4, opacity)
          else
            love.graphics.setColor(0.9, 0.9, 0.9, opacity * 0.7)
          end
          love.graphics.circle("fill", px, py, isHighlight and 4 or 2.5)

          if showLabels and peak[3] and peak[3] ~= "" then
            love.graphics.setColor(0.7, 0.7, 0.7, opacity * 0.8)
            local font = love.graphics.getFont()
            local label = peak[3]
            local tw = font:getWidth(label)
            love.graphics.print(label, px - tw / 2, py - 14)
          end
        end
      end

      -- Axes
      love.graphics.setColor(0.6, 0.6, 0.6, opacity)
      love.graphics.setLineWidth(1)
      love.graphics.line(plotX, plotY, plotX, plotY + plotH)
      love.graphics.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)

      -- Axis labels
      love.graphics.setColor(0.5, 0.5, 0.5, opacity)
      local font = love.graphics.getFont()

      -- X axis tick labels
      for i = 0, 4 do
        local val = xRange[1] + (xRange[2] - xRange[1]) * i / 4
        local gx = mapX(val, xRange, plotX, plotW)
        local txt = tostring(math.floor(val))
        love.graphics.print(txt, gx - font:getWidth(txt) / 2, plotY + plotH + 4)
      end

      -- X axis label
      local xLabel = spectrum.xLabel or ""
      love.graphics.print(xLabel, plotX + plotW / 2 - font:getWidth(xLabel) / 2, y + h - 14)

      -- Y axis label (rotated)
      local yLabel = spectrum.yLabel or ""
      love.graphics.push()
      love.graphics.translate(x + 4, plotY + plotH / 2 + font:getWidth(yLabel) / 2)
      love.graphics.rotate(-math.pi / 2)
      love.graphics.print(yLabel, 0, 0)
      love.graphics.pop()

      -- Title
      love.graphics.setColor(0.8, 0.8, 0.8, opacity)
      local title = specType:upper() .. " — " .. compound
      love.graphics.print(title, plotX + 4, plotY + 4)
    end

    -- Restore scissor
    love.graphics.pop()
  end,
})
