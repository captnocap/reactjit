-- ifttt: If This Then That rules engine for LuaJIT
-- useIFTTT(trigger, action) → rule handle

__ifttt = { rules = {}, _next_id = 1, _initialized = false, _elapsed = 0 }

-- ── SDL scancode name table ──
local __ifttt_keys = {
  a=4,b=5,c=6,d=7,e=8,f=9,g=10,h=11,i=12,j=13,k=14,l=15,m=16,
  n=17,o=18,p=19,q=20,r=21,s=22,t=23,u=24,v=25,w=26,x=27,y=28,z=29,
  ['1']=30,['2']=31,['3']=32,['4']=33,['5']=34,['6']=35,['7']=36,['8']=37,['9']=38,['0']=39,
  enter=40,escape=41,esc=41,backspace=42,tab=43,space=44,
  minus=45,equals=46,leftbracket=47,rightbracket=48,backslash=49,
  semicolon=51,apostrophe=52,grave=53,comma=54,period=55,slash=56,
  capslock=57,f1=58,f2=59,f3=60,f4=61,f5=62,f6=63,f7=64,f8=65,
  f9=66,f10=67,f11=68,f12=69,printscreen=70,scrolllock=71,pause=72,
  insert=73,home=74,pageup=75,delete=76,['end']=77,pagedown=78,
  right=79,left=80,down=81,up=82,
}
local function resolve_key(name)
  local n = tonumber(name)
  if n then return n end
  return __ifttt_keys[name:lower()] or 0
end

-- ── Named state registry ──
__ifttt_stateMap = {}
function __ifttt_registerState(name, slot)
  __ifttt_stateMap[name] = slot
end
local function resolve_slot(s)
  local n = tonumber(s)
  if n then return n end
  return __ifttt_stateMap[s] or -1
end

-- ── Trigger parsing ──

local function parse_trigger(t)
  if t == 'mount' then return { kind = 'mount' } end
  if t == 'click' then return { kind = 'event', event = 'click' } end
  if t == 'filedrop' then return { kind = 'event', event = 'filedrop' } end

  -- key:up:<key>
  local k = t:match('^key:up:(.+)$')
  if k then return { kind = 'key_up', key = resolve_key(k) } end

  -- key:ctrl+s, key:ctrl+shift+z — combo with modifiers
  if t:sub(1, 4) == 'key:' and t:find('+') then
    local parts = {}
    for p in t:sub(5):lower():gmatch('[^+]+') do parts[#parts + 1] = p:match('^%s*(.-)%s*$') end
    local combo = { ctrl = false, shift = false, alt = false, key = 0 }
    for _, p in ipairs(parts) do
      if p == 'ctrl' or p == 'control' then combo.ctrl = true
      elseif p == 'shift' then combo.shift = true
      elseif p == 'alt' then combo.alt = true
      else combo.key = resolve_key(p) end
    end
    return { kind = 'key_combo', combo = combo }
  end

  k = t:match('^key:(.+)$')
  if k then return { kind = 'key', key = resolve_key(k) } end

  -- timer:every:<ms>
  local ms = t:match('^timer:every:(%d+)$')
  if ms then return { kind = 'timer_every', interval_ms = tonumber(ms), accum = 0 } end

  -- timer:once:<ms>
  ms = t:match('^timer:once:(%d+)$')
  if ms then return { kind = 'timer_once', interval_ms = tonumber(ms), accum = 0, fired = false } end

  -- state:<name_or_slot>:<value>
  local slot_str, val = t:match('^state:([^:]+):(.+)$')
  if slot_str then
    local slot = resolve_slot(slot_str)
    local nval = tonumber(val)
    if val == 'true' then nval = true
    elseif val == 'false' then nval = false end
    return { kind = 'state_match', slot = slot, match_val = nval or val, prev_matched = false }
  end

  -- fallback: raw event name
  return { kind = 'event', event = t }
end

-- ── Action execution ──

local function exec_action(action, event)
  if type(action) == 'function' then
    action(event)
    return
  end

  -- state:set:<name_or_slot>:<value>
  local slot_str, val = action:match('^state:set:([^:]+):(.+)$')
  if slot_str then
    local slot = resolve_slot(slot_str)
    if slot < 0 then return end
    if val == 'true' then __setState(slot, 1)
    elseif val == 'false' then __setState(slot, 0)
    else
      local n = tonumber(val)
      if n then __setState(slot, n)
      else __setStateString(slot, val) end
    end
    __markDirty()
    return
  end

  -- state:toggle:<name_or_slot>
  slot_str = action:match('^state:toggle:([^:]+)$')
  if slot_str then
    local slot = resolve_slot(slot_str)
    if slot < 0 then return end
    local cur = __getState(slot)
    __setState(slot, cur == 0 and 1 or 0)
    __markDirty()
    return
  end

  -- call:<fn_name>
  local fn_name = action:match('^call:(.+)$')
  if fn_name then
    local f = _G[fn_name]
    if type(f) == 'function' then f(event) end
    return
  end

  -- log:<message>
  local msg = action:match('^log:(.+)$')
  if msg then
    __hostLog(msg)
    return
  end

  -- clipboard:<text> — copy to system clipboard
  local clip = action:match('^clipboard:(.+)$')
  if clip then
    __clipboard_set(clip)
    return
  end

  -- notification:<msg> — log with notification prefix (OS notifications TODO)
  local note = action:match('^notification:(.+)$')
  if note then
    __hostLog('[NOTIFICATION] ' .. note)
    return
  end
end

-- ── Public API ──

function useIFTTT(trigger, action)
  local rule = {
    id = __ifttt._next_id,
    action = action,
    fired = 0,
    active = true,
  }
  __ifttt._next_id = __ifttt._next_id + 1

  if type(trigger) == 'function' then
    rule.trigger = { kind = 'condition', fn = trigger, prev = false }
  else
    rule.trigger = parse_trigger(trigger)
  end

  __ifttt.rules[rule.id] = rule
  return rule
end

function __ifttt_fire(rule, event)
  if not rule.active then return end
  rule.fired = rule.fired + 1
  exec_action(rule.action, event)
end

function __ifttt_init()
  for id, rule in pairs(__ifttt.rules) do
    if rule.trigger.kind == 'mount' then
      __ifttt_fire(rule)
    end
    if rule.trigger.kind == 'condition' then
      rule.trigger.prev = rule.trigger.fn()
    end
  end
  __ifttt._initialized = true
end

function __ifttt_tick(dt_ms)
  __ifttt._elapsed = __ifttt._elapsed + dt_ms
  for id, rule in pairs(__ifttt.rules) do
    if not rule.active then goto continue end
    local t = rule.trigger

    if t.kind == 'timer_every' then
      t.accum = t.accum + dt_ms
      while t.accum >= t.interval_ms do
        t.accum = t.accum - t.interval_ms
        __ifttt_fire(rule)
      end

    elseif t.kind == 'timer_once' then
      if not t.fired then
        t.accum = t.accum + dt_ms
        if t.accum >= t.interval_ms then
          t.fired = true
          __ifttt_fire(rule)
        end
      end

    elseif t.kind == 'state_match' then
      local cur = __getState(t.slot)
      local matched = false
      if type(t.match_val) == 'boolean' then
        matched = (t.match_val == true and cur ~= 0) or (t.match_val == false and cur == 0)
      else
        matched = (cur == t.match_val)
      end
      if matched and not t.prev_matched then
        __ifttt_fire(rule)
      end
      t.prev_matched = matched

    elseif t.kind == 'condition' then
      local cur = t.fn()
      if cur and not t.prev then
        __ifttt_fire(rule)
      end
      t.prev = cur
    end

    ::continue::
  end
end

function __ifttt_onKeyDown(packed)
  -- Decode: low 16 bits = keycode, high 16 bits = modifiers
  local keycode = packed % 65536
  local mods = math.floor(packed / 65536)
  local hasCtrl = (mods % 256) >= 64    -- KMOD_CTRL = 0x00C0
  local hasShift = (mods % 4) >= 1      -- KMOD_SHIFT = 0x0003
  local hasAlt = (mods % 1024) >= 256   -- KMOD_ALT = 0x0300
  local evt = { key = keycode, mods = mods, ctrl = hasCtrl, shift = hasShift, alt = hasAlt }

  for id, rule in pairs(__ifttt.rules) do
    if not rule.active then goto continue end
    if rule.trigger.kind == 'key' and rule.trigger.key == keycode then
      __ifttt_fire(rule, evt)
    elseif rule.trigger.kind == 'key_combo' then
      local c = rule.trigger.combo
      if c.key == keycode and c.ctrl == hasCtrl and c.shift == hasShift and c.alt == hasAlt then
        __ifttt_fire(rule, evt)
      end
    end
    ::continue::
  end
end

function __ifttt_onKeyUp(packed)
  local keycode = packed % 65536
  for id, rule in pairs(__ifttt.rules) do
    if not rule.active then goto continue end
    if rule.trigger.kind == 'key_up' and rule.trigger.key == keycode then
      __ifttt_fire(rule, { key = keycode })
    end
    ::continue::
  end
end

-- SDL_BUTTON_LEFT=1, SDL_BUTTON_RIGHT=3
function __ifttt_onClick(packed)
  local button = packed % 65536
  local mx = math.floor(packed / 65536)
  local isLeft = (button == 1)
  local isRight = (button == 3)
  local evt = { button = button, x = mx, left = isLeft, right = isRight }

  for id, rule in pairs(__ifttt.rules) do
    if not rule.active then goto continue end
    if rule.trigger.kind == 'event' then
      if rule.trigger.event == 'click' and isLeft then __ifttt_fire(rule, evt) end
      if rule.trigger.event == 'rightclick' and isRight then __ifttt_fire(rule, evt) end
      if rule.trigger.event == 'anyclick' then __ifttt_fire(rule, evt) end
    end
    ::continue::
  end
end

function __ifttt_onFiledrop(path)
  local evt = { path = path }
  for id, rule in pairs(__ifttt.rules) do
    if not rule.active then goto continue end
    if rule.trigger.kind == 'event' and rule.trigger.event == 'filedrop' then
      __ifttt_fire(rule, evt)
    end
    ::continue::
  end
end
