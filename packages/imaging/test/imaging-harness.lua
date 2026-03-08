local failures = 0
local total = 0

package.path = './?.lua;./?/init.lua;' .. package.path

local function fail(message)
  error(message, 2)
end

local function cloneArray(values)
  local out = {}
  for i = 1, #values do
    out[i] = values[i]
  end
  return out
end

local function assertTrue(condition, message)
  if not condition then
    fail(message)
  end
end

local function assertNil(value, message)
  if value ~= nil then
    fail(string.format('%s (got %s)', message, tostring(value)))
  end
end

local function assertEqual(actual, expected, message)
  if actual ~= expected then
    fail(string.format('%s (expected %s, got %s)', message, tostring(expected), tostring(actual)))
  end
end

local function assertStringContains(haystack, needle, message)
  if type(haystack) ~= 'string' or not string.find(haystack, needle, 1, true) then
    fail(string.format('%s ("%s" missing "%s")', message, tostring(haystack), tostring(needle)))
  end
end

local function assertArrayEqual(actual, expected, message)
  assertEqual(#actual, #expected, message .. ' length')
  for i = 1, #expected do
    assertEqual(actual[i], expected[i], string.format('%s[%d]', message, i))
  end
end

local function test(name, fn)
  total = total + 1
  local ok, err = pcall(fn)
  if ok then
    io.write('ok - ' .. name .. '\n')
    return
  end

  failures = failures + 1
  io.write('not ok - ' .. name .. '\n')
  io.write('  ' .. tostring(err) .. '\n')
end

local canvasSerial = 0
local stateStack = {}
local activeCanvas = nil
local activeColor = { 1, 1, 1, 1 }
local activeBlendMode = 'alpha'
local activeShader = nil
local activeLineWidth = 1
local activeLineJoin = 'miter'

local function snapshotState()
  return {
    canvas = activeCanvas,
    color = cloneArray(activeColor),
    blendMode = activeBlendMode,
    shader = activeShader,
    lineWidth = activeLineWidth,
    lineJoin = activeLineJoin,
  }
end

local function restoreState(state)
  activeCanvas = state.canvas
  activeColor = cloneArray(state.color)
  activeBlendMode = state.blendMode
  activeShader = state.shader
  activeLineWidth = state.lineWidth
  activeLineJoin = state.lineJoin
end

local function newFakeCanvas(w, h, label)
  canvasSerial = canvasSerial + 1
  local canvas = {
    id = label or ('canvas_' .. tostring(canvasSerial)),
    width = w,
    height = h,
    ops = {},
    releaseCount = 0,
  }

  function canvas:getWidth()
    return self.width
  end

  function canvas:getHeight()
    return self.height
  end

  function canvas:release()
    self.releaseCount = self.releaseCount + 1
    self.released = true
  end

  return canvas
end

local function recordOp(op)
  if not activeCanvas then
    return
  end
  op.color = cloneArray(activeColor)
  op.blendMode = activeBlendMode
  op.shader = activeShader
  op.lineWidth = activeLineWidth
  op.lineJoin = activeLineJoin
  table.insert(activeCanvas.ops, op)
end

_G.love = {
  graphics = {},
  filesystem = {},
}

function love.graphics.newCanvas(w, h)
  return newFakeCanvas(w, h)
end

function love.graphics.push(_state)
  table.insert(stateStack, snapshotState())
end

function love.graphics.pop()
  local state = table.remove(stateStack)
  if state then
    restoreState(state)
  end
end

function love.graphics.setCanvas(canvas)
  activeCanvas = canvas
end

function love.graphics.clear(r, g, b, a)
  recordOp({
    kind = 'clear',
    values = { r, g, b, a },
  })
end

function love.graphics.setColor(r, g, b, a)
  activeColor = { r, g, b, a }
end

function love.graphics.setBlendMode(mode)
  activeBlendMode = mode
end

function love.graphics.setShader(shader)
  activeShader = shader
end

function love.graphics.draw(drawable, a, b, c, d, e, f, g)
  recordOp({
    kind = 'draw',
    drawable = drawable,
    args = { a, b, c, d, e, f, g },
  })
end

function love.graphics.rectangle(mode, x, y, w, h)
  recordOp({
    kind = 'rectangle',
    mode = mode,
    x = x,
    y = y,
    w = w,
    h = h,
  })
end

function love.graphics.ellipse(mode, x, y, rx, ry)
  recordOp({
    kind = 'ellipse',
    mode = mode,
    x = x,
    y = y,
    rx = rx,
    ry = ry,
  })
end

function love.graphics.circle(mode, x, y, radius)
  recordOp({
    kind = 'circle',
    mode = mode,
    x = x,
    y = y,
    radius = radius,
  })
end

function love.graphics.line(x1, y1, x2, y2)
  recordOp({
    kind = 'line',
    points = { x1, y1, x2, y2 },
  })
end

function love.graphics.setLineWidth(width)
  activeLineWidth = width
end

function love.graphics.setLineJoin(join)
  activeLineJoin = join
end

function love.graphics.polygon(mode, points, ...)
  local flat = {}
  if type(points) == 'table' then
    for i = 1, #points do
      flat[i] = points[i]
    end
  else
    flat[1] = points
    local rest = { ... }
    for i = 1, #rest do
      flat[#flat + 1] = rest[i]
    end
  end

  recordOp({
    kind = 'polygon',
    mode = mode,
    points = flat,
  })
end

function love.graphics.newShader(code)
  local shader = {
    code = code,
    sent = {},
    releaseCount = 0,
  }

  function shader:send(name, ...)
    local values = { ... }
    self.sent[name] = #values == 1 and values[1] or values
  end

  function shader:release()
    self.releaseCount = self.releaseCount + 1
    self.released = true
  end

  return shader
end

function love.graphics.newImage(data)
  local image = {
    data = data,
    releaseCount = 0,
  }

  function image:getWidth()
    if type(self.data) == 'table' and self.data.getWidth then
      return self.data:getWidth()
    end
    return 1
  end

  function image:getHeight()
    if type(self.data) == 'table' and self.data.getHeight then
      return self.data:getHeight()
    end
    return 1
  end

  function image:release()
    self.releaseCount = self.releaseCount + 1
    self.released = true
  end

  return image
end

function love.filesystem.write(_path, _data)
  return true
end

local Capabilities = require('lua.capabilities')
local Imaging = require('lua.imaging')
local Pipeline = require('lua.imaging.pipeline')
local MaskRegistry = require('lua.imaging.mask_registry')
local DrawCanvas = require('lua.capabilities.draw_canvas')
local handlers = require('lua.capabilities.imaging')

local function findRecordedOp(canvas, kind)
  for i = 1, #canvas.ops do
    if canvas.ops[i].kind == kind then
      return canvas.ops[i]
    end
  end
  return nil
end

local function resetMaskRegistry()
  MaskRegistry.releaseAll()
  assertEqual(handlers['imaging:mask_info']().count, 0, 'mask registry should reset to zero')
end

test('imaging capability exposes the full registered op and blend mode tables', function()
  local expectedOps = {
    'apply_mask',
    'blend',
    'box_blur',
    'brightness',
    'channel_mixer',
    'colorize',
    'contrast',
    'curves',
    'desaturate',
    'edge_detect',
    'emboss',
    'gaussian_blur',
    'gradient_map',
    'hue_saturation',
    'invert',
    'levels',
    'motion_blur',
    'pixelize',
    'posterize',
    'sharpen',
    'threshold',
  }
  local expectedBlendModes = {
    'addition',
    'burn',
    'color',
    'difference',
    'dodge',
    'exclusion',
    'hard_light',
    'hue',
    'multiply',
    'normal',
    'overlay',
    'saturation',
    'screen',
    'soft_light',
    'subtract',
    'value',
  }

  assertTrue(Capabilities.getDefinition('Imaging') ~= nil, 'Imaging capability should register itself')
  assertTrue(Capabilities.getDefinition('Imaging').visual == true, 'Imaging capability should be visual')

  local rpcHandlers = Capabilities.getHandlers()
  assertTrue(type(rpcHandlers['imaging:list_ops']) == 'function', 'imaging:list_ops handler should be merged')
  assertTrue(type(rpcHandlers['imaging:blend_modes']) == 'function', 'imaging:blend_modes handler should be merged')

  assertArrayEqual(Imaging.listOps(), expectedOps, 'Imaging.listOps')
  assertArrayEqual(handlers['imaging:list_ops'](), expectedOps, 'imaging:list_ops')
  assertArrayEqual(Imaging.blendModes(), expectedBlendModes, 'Imaging.blendModes')
  assertArrayEqual(handlers['imaging:blend_modes'](), expectedBlendModes, 'imaging:blend_modes')
end)

test('mask registry stores, releases, and reports mask handles through imaging handlers', function()
  resetMaskRegistry()

  local first = newFakeCanvas(12, 8, 'mask_a')
  local second = newFakeCanvas(16, 9, 'mask_b')
  local firstId = MaskRegistry.store(first)
  local secondId = MaskRegistry.store(second)

  assertEqual(firstId, 'mask_1', 'first mask id')
  assertEqual(secondId, 'mask_2', 'second mask id')
  assertEqual(MaskRegistry.get(firstId), first, 'stored first mask')
  assertEqual(MaskRegistry.get(secondId), second, 'stored second mask')
  assertEqual(handlers['imaging:mask_info']().count, 2, 'mask count after storing')

  handlers['imaging:mask_release']({ maskId = firstId })
  assertTrue(first.released == true, 'mask release should release the first canvas')
  assertNil(MaskRegistry.get(firstId), 'released mask should be removed')
  assertEqual(handlers['imaging:mask_info']().count, 1, 'mask count after releasing first')

  MaskRegistry.releaseAll()
  assertTrue(second.released == true, 'releaseAll should release remaining canvases')
  assertEqual(handlers['imaging:mask_info']().count, 0, 'mask count after releaseAll')
end)

test('pipeline apply uses gpu first, falls back to cpu, and releases intermediates', function()
  local source = newFakeCanvas(32, 18, 'source')
  local firstResult = newFakeCanvas(32, 18, 'first')
  local secondResult = newFakeCanvas(32, 18, 'second')
  local finalResult = newFakeCanvas(32, 18, 'final')
  local calls = {}

  local registry = {
    brightness = {
      gpu = function(canvas, w, h, params)
        calls[#calls + 1] = 'brightness.gpu'
        assertEqual(canvas, source, 'brightness should receive source canvas')
        assertEqual(w, 32, 'brightness width')
        assertEqual(h, 18, 'brightness height')
        assertEqual(params.amount, 0.25, 'brightness amount')
        return firstResult
      end,
    },
    gaussian_blur = {
      gpu = function(canvas, _w, _h, params)
        calls[#calls + 1] = 'gaussian_blur.gpu'
        assertEqual(canvas, firstResult, 'gaussian_blur gpu should receive first result')
        assertEqual(params.radius, 4, 'gaussian_blur radius')
        error('gpu failed')
      end,
      cpu = function(canvas, _w, _h, params)
        calls[#calls + 1] = 'gaussian_blur.cpu'
        assertEqual(canvas, firstResult, 'gaussian_blur cpu should reuse previous canvas')
        assertEqual(params.radius, 4, 'gaussian_blur cpu radius')
        return secondResult
      end,
    },
    invert = {
      gpu = function(canvas, _w, _h, _params)
        calls[#calls + 1] = 'invert.gpu'
        assertEqual(canvas, secondResult, 'invert should receive cpu fallback result')
        return finalResult
      end,
    },
  }

  local result = Pipeline.new(source)
    :brightness(0.25)
    :gaussianBlur(4)
    :invert()
    :apply(registry)

  assertEqual(result, finalResult, 'pipeline final result')
  assertEqual(source.releaseCount, 0, 'source canvas should not be released by pipeline')
  assertEqual(firstResult.releaseCount, 1, 'first intermediate should be released once')
  assertEqual(secondResult.releaseCount, 1, 'second intermediate should be released once')
  assertEqual(finalResult.releaseCount, 0, 'final result should remain owned by caller')
  assertArrayEqual(calls, {
    'brightness.gpu',
    'gaussian_blur.gpu',
    'gaussian_blur.cpu',
    'invert.gpu',
  }, 'pipeline call order')
end)

test('imaging:apply reports decode errors while preserving fallback canvas dimensions', function()
  local result = handlers['imaging:apply']({
    operations = 123,
    width = 32,
    height = 16,
  })

  assertEqual(result.ok, false, 'apply should fail for non-string non-table operations')
  assertEqual(result.didProcess, false, 'apply should not process invalid operations')
  assertEqual(result.width, 32, 'apply fallback width')
  assertEqual(result.height, 16, 'apply fallback height')
  assertStringContains(result.error, 'operations must be JSON string or array table', 'apply error message')
end)

test('imaging:compose caches empty compositions by cache key and clears cleanly', function()
  handlers['imaging:clear_cache']()

  local first = handlers['imaging:compose']({
    composition = {
      width = 40,
      height = 24,
      layers = {},
    },
    cacheKey = 'compose:test',
  })
  assertEqual(first.ok, true, 'first compose should succeed')
  assertEqual(first.cacheHit, false, 'first compose should miss cache')
  assertEqual(first.width, 40, 'first compose width')
  assertEqual(first.height, 24, 'first compose height')
  assertEqual(#first.dirtyRegions, 1, 'first compose dirty region count')
  assertEqual(first.dirtyRegions[1].width, 40, 'dirty region width')
  assertEqual(first.dirtyRegions[1].height, 24, 'dirty region height')

  local second = handlers['imaging:compose']({
    composition = {
      width = 40,
      height = 24,
      layers = {},
    },
    cacheKey = 'compose:test',
  })
  assertEqual(second.ok, true, 'second compose should succeed')
  assertEqual(second.cacheHit, true, 'second compose should hit cache')

  handlers['imaging:clear_cache']()

  local third = handlers['imaging:compose']({
    composition = {
      width = 40,
      height = 24,
      layers = {},
    },
    cacheKey = 'compose:test',
  })
  assertEqual(third.ok, true, 'third compose should succeed')
  assertEqual(third.cacheHit, false, 'third compose should miss cache after clear')
end)

test('imaging:selection_rasterize stores replace/add/subtract masks with expected draw semantics', function()
  resetMaskRegistry()

  local invalid = handlers['imaging:selection_rasterize']({
    shapes = {},
    width = 20,
    height = 10,
  })
  assertEqual(invalid.ok, false, 'empty selection should fail')
  assertStringContains(invalid.error, 'shapes must be a non-empty array', 'empty selection error')

  local base = handlers['imaging:selection_rasterize']({
    shapes = {
      { type = 'rect', x = 2, y = 3, width = 5, height = 4 },
    },
    width = 20,
    height = 10,
    mode = 'replace',
  })
  assertEqual(base.ok, true, 'replace rasterize should succeed')
  assertEqual(handlers['imaging:mask_info']().count, 1, 'mask count after replace')

  local baseCanvas = MaskRegistry.get(base.maskId)
  assertTrue(baseCanvas ~= nil, 'replace mask canvas should be stored')
  assertEqual(baseCanvas:getWidth(), 20, 'replace mask width')
  assertEqual(baseCanvas:getHeight(), 10, 'replace mask height')
  local rectOp = findRecordedOp(baseCanvas, 'rectangle')
  assertTrue(rectOp ~= nil, 'replace rasterize should draw a rectangle')
  assertEqual(rectOp.x, 2, 'replace rectangle x')
  assertEqual(rectOp.y, 3, 'replace rectangle y')
  assertEqual(rectOp.w, 5, 'replace rectangle width')
  assertEqual(rectOp.h, 4, 'replace rectangle height')
  assertEqual(rectOp.blendMode, 'alpha', 'replace rectangle blend mode')

  local added = handlers['imaging:selection_rasterize']({
    shapes = {
      { type = 'ellipse', x = 9, y = 4, width = 3, height = 2 },
    },
    width = 20,
    height = 10,
    mode = 'add',
    baseMaskId = base.maskId,
  })
  assertEqual(added.ok, true, 'add rasterize should succeed')
  assertEqual(handlers['imaging:mask_info']().count, 2, 'mask count after add')

  local addCanvas = MaskRegistry.get(added.maskId)
  local drawBaseOp = findRecordedOp(addCanvas, 'draw')
  local ellipseOp = findRecordedOp(addCanvas, 'ellipse')
  assertTrue(drawBaseOp ~= nil, 'add rasterize should draw the base mask first')
  assertEqual(drawBaseOp.drawable, baseCanvas, 'add rasterize should reuse the base mask canvas')
  assertTrue(ellipseOp ~= nil, 'add rasterize should draw an ellipse')
  assertEqual(ellipseOp.blendMode, 'alpha', 'add ellipse blend mode')

  local subtracted = handlers['imaging:selection_rasterize']({
    shapes = {
      { type = 'polygon', points = { { 1, 1 }, { 6, 1 }, { 3, 5 } } },
    },
    width = 20,
    height = 10,
    mode = 'subtract',
    baseMaskId = added.maskId,
  })
  assertEqual(subtracted.ok, true, 'subtract rasterize should succeed')
  assertEqual(handlers['imaging:mask_info']().count, 3, 'mask count after subtract')

  local subtractCanvas = MaskRegistry.get(subtracted.maskId)
  local subtractDrawOp = findRecordedOp(subtractCanvas, 'draw')
  local polygonOp = findRecordedOp(subtractCanvas, 'polygon')
  assertTrue(subtractDrawOp ~= nil, 'subtract rasterize should draw the base mask first')
  assertEqual(subtractDrawOp.drawable, addCanvas, 'subtract rasterize should reuse the add mask canvas')
  assertTrue(polygonOp ~= nil, 'subtract rasterize should draw a polygon')
  assertEqual(polygonOp.blendMode, 'replace', 'subtract polygon blend mode')
  assertEqual(polygonOp.color[1], 0, 'subtract polygon color red')
  assertEqual(polygonOp.color[2], 0, 'subtract polygon color green')
  assertEqual(polygonOp.color[3], 0, 'subtract polygon color blue')
  assertEqual(polygonOp.color[4], 1, 'subtract polygon color alpha')
  assertArrayEqual(polygonOp.points, { 1, 1, 6, 1, 3, 5 }, 'subtract polygon points')

  handlers['imaging:mask_release']({ maskId = base.maskId })
  handlers['imaging:mask_release']({ maskId = added.maskId })
  handlers['imaging:mask_release']({ maskId = subtracted.maskId })
  assertEqual(handlers['imaging:mask_info']().count, 0, 'mask count after releasing rasterized masks')
end)

test('canvas:paint clips strokes through selection masks on the Lua side', function()
  resetMaskRegistry()

  local drawDef = Capabilities.getDefinition('DrawCanvas')
  assertTrue(drawDef ~= nil, 'DrawCanvas capability should register itself')

  local state = drawDef.create('draw_canvas_masked', {
    canvasId = 'draw_canvas_masked',
    width = 24,
    height = 16,
    background = 'transparent',
  })

  local paintCanvas = DrawCanvas.getCanvas('draw_canvas_masked')
  assertTrue(paintCanvas ~= nil, 'DrawCanvas should create a backing canvas')

  local maskCanvas = newFakeCanvas(24, 16, 'paint_mask')
  local maskId = MaskRegistry.store(maskCanvas)

  local rpcHandlers = Capabilities.getHandlers()
  local result = rpcHandlers['canvas:paint']({
    canvasId = 'draw_canvas_masked',
    points = { { 2, 3 }, { 10, 9 } },
    color = { 0.25, 0.5, 0.75, 1 },
    size = 8,
    opacity = 0.4,
    maskId = maskId,
  })

  assertEqual(result.ok, true, 'masked paint should succeed')

  local compositeOp = findRecordedOp(paintCanvas, 'draw')
  assertTrue(compositeOp ~= nil, 'masked paint should composite a temporary stroke canvas')
  assertTrue(compositeOp.shader ~= nil, 'masked paint should use a clipping shader')
  assertEqual(compositeOp.shader.sent.mask, maskCanvas, 'masked paint should send the selection mask to the shader')
  assertEqual(compositeOp.blendMode, 'alpha', 'masked paint should preserve alpha blending')
  assertTrue(type(compositeOp.drawable) == 'table', 'masked paint should draw from a temporary stroke canvas')

  local strokeCircle = findRecordedOp(compositeOp.drawable, 'circle')
  local strokeLine = findRecordedOp(compositeOp.drawable, 'line')
  assertTrue(strokeCircle ~= nil, 'temporary stroke canvas should include stamped circles')
  assertTrue(strokeLine ~= nil, 'temporary stroke canvas should include connecting line segments')
  assertEqual(strokeCircle.color[4], 0.4, 'masked paint should preserve requested opacity on the stroke canvas')
  assertEqual(compositeOp.drawable.releaseCount, 1, 'temporary stroke canvas should be released after compositing')

  rpcHandlers['imaging:mask_release']({ maskId = maskId })
  drawDef.destroy('draw_canvas_masked', state)
end)

io.write(string.format('\n%d tests, %d failures\n', total, failures))
os.exit(failures == 0 and 0 or 1)
