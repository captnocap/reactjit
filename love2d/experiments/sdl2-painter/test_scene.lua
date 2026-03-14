--[[
  test_scene.lua -- Fake ReactJIT node tree to exercise the SDL2 painter.

  This mirrors what the reconciler + layout engine would normally produce.
  Structured identically to real tree.lua output so the painter doesn't
  know the difference.
]]

local TestScene = {}

-- Helper to build a node (same shape as tree.lua output)
local function node(type_, computed, style, props, children, text)
  return {
    type     = type_,
    computed = computed,
    style    = style or {},
    props    = props or {},
    children = children or {},
    text     = text,
  }
end

--[[
  Scene layout (1280 × 720):

  ┌─────────────────────────────────────────┐
  │ Dark background #0c0c14                 │
  │                                         │
  │  ┌─────────── Card (600×440) ────────┐  │
  │  │  ReactJIT SDL2          [badge] │  │
  │  │  Painter proof-of-concept         │  │
  │  │                                   │  │
  │  │  [Red] [Green] [Blue]             │  │
  │  │                                   │  │
  │  │  ┌── overflow:hidden clip ──────┐ │  │
  │  │  │ clipped content (strips)     │ │  │
  │  │  └─────────────────────────────┘ │  │
  │  │                                   │  │
  │  │  Gradient bar                     │  │
  │  └───────────────────────────────────┘  │
  │                                         │
  │  Stencil (rounded overflow:hidden):     │
  │  ┌────────────────────────────────────┐ │
  │  │  rounded clip • strips inside      │ │
  │  └────────────────────────────────────┘ │
  └─────────────────────────────────────────┘
]]

function TestScene.build()
  local SW, SH = 1280, 720
  local cardX, cardY = (SW - 620) / 2, 40
  local cardW, cardH = 620, 440
  local pad = 24

  -- Three colored boxes inside card
  local function colorBox(x, y, w, h, bg, label)
    return node("View", {x=x, y=y, w=w, h=h}, {
      backgroundColor = bg,
      borderRadius    = 8,
    }, {}, {
      node("Text", {x=x+8, y=y+6, w=w-16, h=20}, {
        fontSize = 13, color = "#ffffff",
      }, {}, {}, label),
    })
  end

  -- Scissor clip (overflow:hidden, no border radius)
  local clipX = cardX + pad
  local clipY = cardY + 200
  local clipW = cardW - pad*2
  local clipH = 60
  local stripes = {}
  for i = 0, 8 do
    local cx = clipX + i * (clipW / 8)
    stripes[#stripes+1] = node("View",
      { x = cx, y = clipY, w = clipW/8 - 2, h = clipH },
      { backgroundColor = i % 2 == 0 and "#3b4cb8" or "#6272e8" },
      {}, {})
  end

  -- Gradient bar
  local gradY = clipY + clipH + 16
  local gradBar = node("View", { x=cardX+pad, y=gradY, w=cardW-pad*2, h=28 }, {
    backgroundGradient = {
      direction = "horizontal",
      colors    = { "#ff4e6a", "#7b5fff" },
    },
    borderRadius = 6,
  }, {}, {})

  -- Main card
  local card = node("View", { x=cardX, y=cardY, w=cardW, h=cardH }, {
    backgroundColor = "#111128",
    borderRadius    = 16,
    borderWidth     = 1,
    borderColor     = "#2a2a50",
    shadowColor     = "#000000",
    shadowBlur      = 20,
    shadowOffsetX   = 0,
    shadowOffsetY   = 8,
  }, {}, {
    -- Heading
    node("Text", { x=cardX+pad, y=cardY+pad, w=cardW-pad*2, h=40 }, {
      fontSize = 32, color = "#e8e8ff",
    }, {}, {}, "ReactJIT SDL2"),

    -- Subtitle
    node("Text", { x=cardX+pad, y=cardY+pad+46, w=cardW-pad*2, h=20 }, {
      fontSize = 14, color = "#7070a0",
    }, {}, {}, "SDL2 + OpenGL painter proof-of-concept"),

    -- Badge (top-right)
    node("View", { x=cardX+cardW-100, y=cardY+pad, w=76, h=26 }, {
      backgroundColor = "#3b4cb8",
      borderRadius    = 13,
    }, {}, {
      node("Text", { x=cardX+cardW-100+8, y=cardY+pad+4, w=60, h=18 }, {
        fontSize = 12, color = "#ffffff", textAlign = "center",
      }, {}, {}, "v0.0.1"),
    }),

    -- Three colored boxes
    colorBox(cardX+pad,      cardY+130, 150, 40, "#c0392b", "View (fill)"),
    colorBox(cardX+pad+170,  cardY+130, 150, 40, "#27ae60", "Text (draw)"),
    colorBox(cardX+pad+340,  cardY+130, 150, 40, "#2980b9", "Scissor"),

    -- Scissor clip container
    node("View", { x=clipX, y=clipY, w=clipW, h=clipH }, {
      overflow = "hidden",  -- triggers scissor clipping
      borderWidth = 1,
      borderColor = "#404080",
    }, {}, stripes),

    gradBar,

    -- Caption below clip
    node("Text", { x=clipX, y=clipY-18, w=clipW, h=16 }, {
      fontSize = 12, color = "#505080",
    }, {}, {}, "overflow:hidden (scissor)"),

    node("Text", { x=cardX+pad, y=gradY-18, w=cardW-pad*2, h=16 }, {
      fontSize = 12, color = "#505080",
    }, {}, {}, "backgroundGradient (horizontal)"),
  })

  -- Stencil clip demo (rounded overflow:hidden) — below the card
  local sclipY  = cardY + cardH + 20
  local sclipX  = cardX
  local sclipW  = cardW
  local sclipH  = 60
  local sstripes = {}
  for i = 0, 14 do
    local sx = sclipX + i * (sclipW / 14)
    sstripes[#sstripes+1] = node("View",
      { x = sx, y = sclipY, w = sclipW/14 - 2, h = sclipH },
      { backgroundColor = i % 2 == 0 and "#7b5fff" or "#ff4e6a" },
      {}, {})
  end

  local stencilClip = node("View",
    { x = sclipX, y = sclipY, w = sclipW, h = sclipH }, {
    overflow     = "hidden",   -- rounded → triggers stencil
    borderRadius = 12,
    borderWidth  = 1,
    borderColor  = "#6040a0",
  }, {}, sstripes)

  local stencilLabel = node("Text",
    { x = sclipX, y = sclipY - 18, w = sclipW, h = 16 }, {
    fontSize = 12, color = "#505080",
  }, {}, {}, "overflow:hidden (stencil, rounded corners)")

  -- Root
  return node("View", { x=0, y=0, w=SW, h=SH }, {
    backgroundColor = "#0c0c14",
  }, {}, {
    card,
    stencilLabel,
    stencilClip,
  })
end

function TestScene.render(Painter)
  Painter.paint(TestScene.build())
end

return TestScene
