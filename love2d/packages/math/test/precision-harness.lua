local mathUtils = dofile('lua/math_utils.lua')
local handlers = mathUtils.getHandlers()

local EPSILON = 1e-9
local failures = 0
local total = 0

local function fail(message)
  error(message, 2)
end

local function isArray(value)
  return type(value) == 'table' and rawget(value, 1) ~= nil
end

local function call(op, args)
  local payload = args or {}
  payload.op = op
  return handlers["math:call"](payload)
end

local function callBatch(batch)
  return handlers["math:call"]({ batch = batch })
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

local function assertAlmostEqual(actual, expected, epsilon, message)
  epsilon = epsilon or EPSILON
  if math.abs(actual - expected) > epsilon then
    fail(string.format('%s (expected %.12f, got %.12f, eps %.2e)', message, expected, actual, epsilon))
  end
end

local function assertVecAlmostEqual(actual, expected, epsilon, message)
  epsilon = epsilon or EPSILON
  assertTrue(type(actual) == 'table', message .. ' returned non-table')
  assertEqual(#actual, #expected, message .. ' length mismatch')
  for i = 1, #expected do
    local childMessage = string.format('%s[%d]', message, i)
    if type(expected[i]) == 'table' and isArray(expected[i]) then
      assertVecAlmostEqual(actual[i], expected[i], epsilon, childMessage)
    else
      assertAlmostEqual(actual[i], expected[i], epsilon, childMessage)
    end
  end
end

local function assertBBoxAlmostEqual(actual, expected, epsilon, message)
  assertVecAlmostEqual(actual.min, expected.min, epsilon, message .. '.min')
  assertVecAlmostEqual(actual.max, expected.max, epsilon, message .. '.max')
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

test('math:call dispatcher supports single, batch, and missing ops', function()
  assertNil(call('missing.op', {}), 'single missing op should return nil')

  local single = call('vec2.add', { a = { 1, 2 }, b = { 3, 4 } })
  assertVecAlmostEqual(single, { 4, 6 }, EPSILON, 'single vec2.add')

  local batch = callBatch({
    { op = 'vec2.add', a = { 1, 2 }, b = { 3, 4 } },
    { op = 'noise2d', x = 1.2, y = 3.4, seed = 5 },
    { op = 'missing.op' },
  })

  assertVecAlmostEqual(batch[1], { 4, 6 }, EPSILON, 'batch vec2.add')
  assertAlmostEqual(batch[2], 0.435276105600006, 1e-12, 'batch noise2d sample')
  assertEqual(batch[3], false, 'batch missing op should return false')
end)

test('vec2 ops preserve unit length and rotation precision', function()
  local normalized = call('vec2.normalize', { v = { 3, 4 } })
  assertVecAlmostEqual(normalized, { 0.6, 0.8 }, EPSILON, 'vec2.normalize')
  assertAlmostEqual(call('vec2.length', { v = normalized }), 1, EPSILON, 'vec2.normalize length')

  local fromAngle = call('vec2.fromAngle', { radians = math.pi / 3 })
  assertVecAlmostEqual(fromAngle, { 0.5, math.sqrt(3) / 2 }, EPSILON, 'vec2.fromAngle')
  assertAlmostEqual(call('vec2.angle', { v = fromAngle }), math.pi / 3, EPSILON, 'vec2.angle')

  local rotated = call('vec2.rotate', { v = { 1, 0 }, radians = math.pi / 2 })
  assertVecAlmostEqual(rotated, { 0, 1 }, EPSILON, 'vec2.rotate quarter turn')

  assertAlmostEqual(call('vec2.dot', { a = { 3, 4 }, b = { -4, 3 } }), 0, EPSILON, 'vec2.dot orthogonal')
  assertAlmostEqual(call('vec2.cross', { a = { 3, 4 }, b = { -4, 3 } }), 25, EPSILON, 'vec2.cross area')
end)

test('vec3 ops maintain orthogonality, reflection, and spherical interpolation', function()
  local cross = call('vec3.cross', { a = { 1, 0, 0 }, b = { 0, 1, 0 } })
  assertVecAlmostEqual(cross, { 0, 0, 1 }, EPSILON, 'vec3.cross')
  assertAlmostEqual(call('vec3.dot', { a = cross, b = { 1, 0, 0 } }), 0, EPSILON, 'vec3.cross orthogonal to x')
  assertAlmostEqual(call('vec3.dot', { a = cross, b = { 0, 1, 0 } }), 0, EPSILON, 'vec3.cross orthogonal to y')

  local reflected = call('vec3.reflect', {
    v = { 1, -1, 0 },
    normal = { 0, 1, 0 },
  })
  assertVecAlmostEqual(reflected, { 1, 1, 0 }, EPSILON, 'vec3.reflect')

  local halfway = call('vec3.slerp', {
    a = { 1, 0, 0 },
    b = { 0, 1, 0 },
    t = 0.5,
  })
  assertVecAlmostEqual(halfway, { math.sqrt(0.5), math.sqrt(0.5), 0 }, EPSILON, 'vec3.slerp halfway')
  assertAlmostEqual(call('vec3.length', { v = halfway }), 1, EPSILON, 'vec3.slerp unit length')
end)

test('mat4 and quaternion ops agree on transforms and decompose cleanly', function()
  local translated = call('mat4.translate', {
    m = call('mat4.identity', {}),
    v = { 3, -2, 5 },
  })
  local point = call('mat4.transformPoint', {
    m = translated,
    v = { 4, 5, 6 },
  })
  assertVecAlmostEqual(point, { 7, 3, 11 }, EPSILON, 'mat4.transformPoint translation')

  local rotated = call('mat4.rotateZ', {
    m = translated,
    radians = math.pi / 2,
  })
  local composed = call('mat4.scale', {
    m = rotated,
    v = { 2, 3, 4 },
  })
  local inverse = call('mat4.invert', { m = composed })
  local identity = call('mat4.multiply', { a = composed, b = inverse })
  assertVecAlmostEqual(identity, call('mat4.identity', {}), 1e-8, 'mat4.invert')

  local decomposed = call('mat4.decompose', { m = composed })
  assertVecAlmostEqual(decomposed.translation, { 3, -2, 5 }, EPSILON, 'mat4.decompose translation')
  assertVecAlmostEqual(decomposed.scale, { 2, 3, 4 }, EPSILON, 'mat4.decompose scale')
  assertAlmostEqual(call('quat.length', { q = decomposed.rotation }), 1, EPSILON, 'mat4.decompose rotation normalized')

  local quarterTurn = call('quat.fromAxisAngle', {
    axis = { 0, 0, 1 },
    radians = math.pi / 2,
  })
  local rotatedByQuat = call('quat.rotateVec3', {
    q = quarterTurn,
    v = { 1, 0, 0 },
  })
  assertVecAlmostEqual(rotatedByQuat, { 0, 1, 0 }, EPSILON, 'quat.rotateVec3')

  local rotationMatrix = call('quat.toMat4', { q = quarterTurn })
  local rotatedByMatrix = call('mat4.transformDirection', {
    m = rotationMatrix,
    v = { 1, 0, 0 },
  })
  assertVecAlmostEqual(rotatedByMatrix, rotatedByQuat, EPSILON, 'quat.toMat4 matches quat.rotateVec3')
end)

test('geometry and interpolation helpers hit expected analytic values', function()
  local intersection = call('geo.lineIntersection', {
    a1 = { 0, 0 },
    a2 = { 2, 2 },
    b1 = { 0, 2 },
    b2 = { 2, 0 },
  })
  assertVecAlmostEqual(intersection, { 1, 1 }, EPSILON, 'geo.lineIntersection')

  local bbox = call('geo.bbox2_union', {
    a = { min = { 0, 0 }, max = { 2, 1 } },
    b = { min = { -1, -2 }, max = { 3, 4 } },
  })
  assertBBoxAlmostEqual(bbox, {
    min = { -1, -2 },
    max = { 3, 4 },
  }, EPSILON, 'geo.bbox2_union')

  local distance = call('geo.distancePointToSegment', {
    point = { 3, 2 },
    a = { 1, 0 },
    b = { 1, 5 },
  })
  assertAlmostEqual(distance, 2, EPSILON, 'geo.distancePointToSegment')

  assertAlmostEqual(call('interp.inverseLerp', {
    a = 10,
    b = 20,
    value = 15,
  }), 0.5, EPSILON, 'interp.inverseLerp')

  assertAlmostEqual(call('interp.smoothstep', {
    edge0 = 0,
    edge1 = 10,
    x = 5,
  }), 0.5, EPSILON, 'interp.smoothstep midpoint')

  assertAlmostEqual(call('interp.smootherstep', {
    edge0 = 0,
    edge1 = 1,
    x = 0.5,
  }), 0.5, EPSILON, 'interp.smootherstep midpoint')

  assertAlmostEqual(call('interp.wrap', {
    value = -1,
    min = 0,
    max = 10,
  }), 9, EPSILON, 'interp.wrap negative value')

  local moved = call('interp.moveTowardsAngle', {
    current = math.rad(350),
    target = math.rad(10),
    maxDelta = math.rad(15),
  })
  assertAlmostEqual(math.deg(moved), 365, EPSILON, 'interp.moveTowardsAngle shortest path')

  local damped = call('interp.smoothDamp', {
    current = 0,
    target = 10,
    velocity = 0,
    smoothTime = 0.5,
    dt = 0.1,
    maxSpeed = 100,
  })
  assertAlmostEqual(damped.result, 0.6156156156156156, 1e-12, 'interp.smoothDamp result')
  assertAlmostEqual(damped.velocity, 10.725010725010726, 1e-12, 'interp.smoothDamp velocity')
end)

test('noise ops stay deterministic across seeded scalar and field samples', function()
  assertAlmostEqual(call('noise2d', {
    x = 1.2,
    y = 3.4,
    seed = 5,
  }), 0.435276105600006, 1e-12, 'noise2d regression sample')

  assertAlmostEqual(call('noise3d', {
    x = 1.2,
    y = 3.4,
    z = 5.6,
    seed = 7,
  }), -0.341657210560021, 1e-12, 'noise3d regression sample')

  local field = call('noisefield', {
    width = 3,
    height = 2,
    scale = 0.1,
    seed = 2,
    octaves = 3,
  })
  assertEqual(#field, 6, 'noisefield cell count')
  assertVecAlmostEqual(field, {
    -0.546048000000000,
    -0.342522774674284,
    -0.211144627931428,
    -0.350318372571426,
    -0.204216257097139,
    -0.158048974262854,
  }, 1e-12, 'noisefield regression sample')
end)

test('fft, ifft, and bezier evaluation keep known numerical outputs stable', function()
  local magnitudes = call('fft', {
    samples = { 0, 1, 0, -1 },
  })
  assertVecAlmostEqual(magnitudes, { 0, 0.5 }, EPSILON, 'fft sinusoid magnitudes')

  local reconstructed = call('ifft', {
    real = { 1, 1, 1, 1 },
    imag = { 0, 0, 0, 0 },
  })
  assertVecAlmostEqual(reconstructed, { 1, 0, 0, 0 }, EPSILON, 'ifft impulse reconstruction')

  local curve = call('bezier', {
    points = {
      { 0, 0 },
      { 1, 1 },
      { 2, 0 },
    },
    segments = 4,
  })
  assertEqual(#curve, 5, 'bezier segment count')
  assertVecAlmostEqual(curve[1], { 0, 0 }, EPSILON, 'bezier start point')
  assertVecAlmostEqual(curve[3], { 1, 0.5 }, EPSILON, 'bezier midpoint')
  assertVecAlmostEqual(curve[5], { 2, 0 }, EPSILON, 'bezier end point')
end)

io.write(string.format('%d/%d checks passed\n', total - failures, total))
os.exit(failures == 0 and 0 or 1)
