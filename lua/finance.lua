--[[
  finance.lua — Finance indicator RPCs for ReactJIT.

  Moves compute-heavy technical analysis math to Lua so React/TS only wires
  state and rendering.

  RPC handlers:
    finance:technical_analysis — Compute full TA bundle from OHLCV candles
]]

local M = {}

local abs = math.abs
local max = math.max
local min = math.min
local sqrt = math.sqrt
local insert = table.insert

local NAN = 0 / 0

local function is_nan(v)
  return v ~= v
end

local function num(v, fallback)
  local n = tonumber(v)
  if n == nil then return fallback or 0 end
  return n
end

local function nz(v, fallback)
  if v == nil or v == 0 then return fallback or 1 end
  return v
end

local function candle(c)
  c = c or {}
  return {
    time = num(c.time, 0),
    open = num(c.open, 0),
    high = num(c.high, 0),
    low = num(c.low, 0),
    close = num(c.close, 0),
    volume = num(c.volume, 0),
  }
end

-- ============================================================================
-- Indicator math
-- ============================================================================

function M.sma(data, period)
  period = max(1, num(period, 20))
  local out = {}
  local sum = 0
  for i = 1, #data do
    sum = sum + num(data[i], 0)
    if i > period then
      sum = sum - num(data[i - period], 0)
    end
    out[i] = (i >= period) and (sum / nz(period)) or NAN
  end
  return out
end

function M.ema(data, period)
  period = max(1, num(period, 20))
  local out = {}
  local k = 2 / nz(period + 1)
  local prev = NAN

  for i = 1, #data do
    if i < period then
      out[i] = NAN
    elseif i == period then
      local sum = 0
      for j = 1, period do
        sum = sum + num(data[j], 0)
      end
      prev = sum / nz(period)
      out[i] = prev
    else
      prev = num(data[i], 0) * k + prev * (1 - k)
      out[i] = prev
    end
  end

  return out
end

function M.rsi(data, period)
  period = max(1, num(period, 14))
  local out = {}
  if #data == 0 then return out end

  out[1] = NAN
  local avgGain = 0
  local avgLoss = 0

  for i = 2, #data do
    local delta = num(data[i], 0) - num(data[i - 1], 0)
    local gain = (delta > 0) and delta or 0
    local loss = (delta < 0) and (-delta) or 0
    local idx = i - 1

    if idx <= period then
      avgGain = avgGain + gain
      avgLoss = avgLoss + loss
      if idx == period then
        avgGain = avgGain / nz(period)
        avgLoss = avgLoss / nz(period)
        local rs = (avgLoss == 0) and 100 or (avgGain / nz(avgLoss))
        out[i] = 100 - 100 / (1 + rs)
      else
        out[i] = NAN
      end
    else
      avgGain = (avgGain * (period - 1) + gain) / nz(period)
      avgLoss = (avgLoss * (period - 1) + loss) / nz(period)
      local rs = (avgLoss == 0) and 100 or (avgGain / nz(avgLoss))
      out[i] = 100 - 100 / (1 + rs)
    end
  end

  return out
end

function M.macd(data, fastPeriod, slowPeriod, signalPeriod)
  fastPeriod = num(fastPeriod, 12)
  slowPeriod = num(slowPeriod, 26)
  signalPeriod = num(signalPeriod, 9)

  local fastEma = M.ema(data, fastPeriod)
  local slowEma = M.ema(data, slowPeriod)
  local macdLine = {}
  for i = 1, #data do
    if is_nan(fastEma[i]) or is_nan(slowEma[i]) then
      macdLine[i] = NAN
    else
      macdLine[i] = fastEma[i] - slowEma[i]
    end
  end

  local validMacd = {}
  local validIndices = {}
  for i = 1, #macdLine do
    if not is_nan(macdLine[i]) then
      insert(validMacd, macdLine[i])
      insert(validIndices, i)
    end
  end

  local signalEma = M.ema(validMacd, signalPeriod)
  local signalLine = {}
  for i = 1, #data do signalLine[i] = NAN end
  for i = 1, #validIndices do
    signalLine[validIndices[i]] = signalEma[i]
  end

  local out = {}
  for i = 1, #data do
    local m = macdLine[i]
    local s = signalLine[i]
    out[i] = {
      time = i - 1,
      macd = m,
      signal = s,
      histogram = (is_nan(m) or is_nan(s)) and NAN or (m - s),
    }
  end
  return out
end

function M.bollinger_bands(data, period, multiplier)
  period = max(1, num(period, 20))
  multiplier = num(multiplier, 2)

  local middle = M.sma(data, period)
  local out = {}

  for i = 1, #data do
    if is_nan(middle[i]) then
      out[i] = { time = i - 1, upper = NAN, middle = NAN, lower = NAN }
    else
      local variance = 0
      for j = i - period + 1, i do
        local diff = num(data[j], 0) - middle[i]
        variance = variance + diff * diff
      end
      local stdDev = sqrt(variance / nz(period))
      out[i] = {
        time = i - 1,
        upper = middle[i] + multiplier * stdDev,
        middle = middle[i],
        lower = middle[i] - multiplier * stdDev,
      }
    end
  end

  return out
end

function M.vwap(candles)
  local out = {}
  local cumVolPrice = 0
  local cumVol = 0

  for i = 1, #candles do
    local c = candle(candles[i])
    local typical = (c.high + c.low + c.close) / 3
    cumVolPrice = cumVolPrice + typical * c.volume
    cumVol = cumVol + c.volume
    out[i] = {
      time = c.time,
      value = (cumVol == 0) and typical or (cumVolPrice / nz(cumVol)),
    }
  end

  return out
end

function M.obv(candles)
  local out = {}
  local vol = 0

  for i = 1, #candles do
    local c = candle(candles[i])
    if i > 1 then
      local prev = candle(candles[i - 1])
      if c.close > prev.close then vol = vol + c.volume end
      if c.close < prev.close then vol = vol - c.volume end
    end
    out[i] = { time = c.time, value = vol }
  end

  return out
end

function M.atr(candles, period)
  period = num(period, 14)
  local tr = {}

  for i = 1, #candles do
    local c = candle(candles[i])
    if i == 1 then
      tr[i] = c.high - c.low
    else
      local prev = candle(candles[i - 1])
      tr[i] = max(c.high - c.low, abs(c.high - prev.close), abs(c.low - prev.close))
    end
  end

  local atrValues = M.ema(tr, period)
  local out = {}
  for i = 1, #candles do
    local c = candle(candles[i])
    out[i] = { time = c.time, value = atrValues[i] }
  end
  return out
end

function M.stochastic(candles, kPeriod, dPeriod)
  kPeriod = num(kPeriod, 14)
  dPeriod = num(dPeriod, 3)

  local kValues = {}
  for i = 1, #candles do
    if i < kPeriod then
      kValues[i] = NAN
    else
      local highMax = -math.huge
      local lowMin = math.huge
      for j = i - kPeriod + 1, i do
        local c = candle(candles[j])
        if c.high > highMax then highMax = c.high end
        if c.low < lowMin then lowMin = c.low end
      end
      local cNow = candle(candles[i])
      local range = highMax - lowMin
      kValues[i] = (range == 0) and 50 or (((cNow.close - lowMin) / nz(range)) * 100)
    end
  end

  local dInput = {}
  for i = 1, #kValues do
    dInput[i] = is_nan(kValues[i]) and 0 or kValues[i]
  end
  local dValues = M.sma(dInput, dPeriod)

  local out = {}
  for i = 1, #candles do
    local c = candle(candles[i])
    out[i] = {
      time = c.time,
      k = kValues[i],
      d = is_nan(kValues[i]) and NAN or dValues[i],
    }
  end
  return out
end

function M.pivot_points(candles)
  if #candles == 0 then return nil end
  local last = candle(candles[#candles])
  local pivot = (last.high + last.low + last.close) / 3
  return {
    pivot = pivot,
    r1 = 2 * pivot - last.low,
    r2 = pivot + (last.high - last.low),
    r3 = last.high + 2 * (pivot - last.low),
    s1 = 2 * pivot - last.high,
    s2 = pivot - (last.high - last.low),
    s3 = last.low - 2 * (last.high - pivot),
  }
end

function M.detect_patterns(candles)
  local signals = {}
  local len = #candles

  for i = 2, len do
    local curr = candle(candles[i])
    local prev = candle(candles[i - 1])
    local bodySize = abs(curr.close - curr.open)
    local range = curr.high - curr.low
    local prevBody = abs(prev.close - prev.open)

    if range > 0 and (bodySize / nz(range)) < 0.1 then
      insert(signals, { type = "doji", index = i - 1, confidence = 1 - bodySize / nz(range) })
    end

    local lowerShadow = min(curr.open, curr.close) - curr.low
    local upperShadow = curr.high - max(curr.open, curr.close)
    if range > 0 and lowerShadow > bodySize * 2 and upperShadow < bodySize * 0.5 then
      insert(signals, { type = "hammer", index = i - 1, confidence = min(1, lowerShadow / nz(range)) })
    end

    if range > 0 and upperShadow > bodySize * 2 and lowerShadow < bodySize * 0.5 then
      insert(signals, { type = "shooting_star", index = i - 1, confidence = min(1, upperShadow / nz(range)) })
    end

    if prev.close < prev.open and curr.close > curr.open and
      curr.open <= prev.close and curr.close >= prev.open then
      insert(signals, {
        type = "bullish_engulfing",
        index = i - 1,
        confidence = min(1, bodySize / ((prevBody ~= 0) and prevBody or 1)),
      })
    end

    if prev.close > prev.open and curr.close < curr.open and
      curr.open >= prev.close and curr.close <= prev.open then
      insert(signals, {
        type = "bearish_engulfing",
        index = i - 1,
        confidence = min(1, bodySize / ((prevBody ~= 0) and prevBody or 1)),
      })
    end
  end

  local highs = {}
  local lows = {}
  for i = 3, len - 2 do
    local c = candle(candles[i])
    local p1 = candle(candles[i - 1])
    local p2 = candle(candles[i - 2])
    local n1 = candle(candles[i + 1])
    local n2 = candle(candles[i + 2])

    if c.high > p1.high and c.high > p2.high and c.high > n1.high and c.high > n2.high then
      insert(highs, i)
    end
    if c.low < p1.low and c.low < p2.low and c.low < n1.low and c.low < n2.low then
      insert(lows, i)
    end
  end

  for i = 2, #highs do
    local a = candle(candles[highs[i - 1]]).high
    local b = candle(candles[highs[i]]).high
    local denom = max(a, b)
    local diff = (denom == 0) and 0 or abs(a - b) / nz(denom)
    if diff < 0.015 then
      insert(signals, { type = "double_top", index = highs[i] - 1, confidence = 1 - diff / 0.015 })
    end
  end

  for i = 2, #lows do
    local a = candle(candles[lows[i - 1]]).low
    local b = candle(candles[lows[i]]).low
    local denom = max(a, b)
    local diff = (denom == 0) and 0 or abs(a - b) / nz(denom)
    if diff < 0.015 then
      insert(signals, { type = "double_bottom", index = lows[i] - 1, confidence = 1 - diff / 0.015 })
    end
  end

  return signals
end

function M.technical_analysis(candles)
  candles = candles or {}
  local closes = {}
  for i = 1, #candles do
    closes[i] = num(candles[i] and candles[i].close, 0)
  end

  return {
    sma20 = M.sma(closes, 20),
    sma50 = M.sma(closes, 50),
    ema12 = M.ema(closes, 12),
    ema26 = M.ema(closes, 26),
    rsi14 = M.rsi(closes, 14),
    macd = M.macd(closes, 12, 26, 9),
    bollinger = M.bollinger_bands(closes, 20, 2),
    vwap = M.vwap(candles),
    atr14 = M.atr(candles, 14),
    obv = M.obv(candles),
    stochastic = M.stochastic(candles, 14, 3),
    pivots = M.pivot_points(candles),
    patterns = M.detect_patterns(candles),
  }
end

-- ============================================================================
-- RPC handlers
-- ============================================================================

local handlers = {}

handlers["finance:technical_analysis"] = function(args)
  return M.technical_analysis(args and args.candles or {})
end

function M.getHandlers()
  return handlers
end

return M
