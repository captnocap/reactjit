// Stress test cartridge -simulates React-style hooks under load
//
// Tests: useEffect (interval re-renders), useMemo (heavy compute),
// dynamic list generation, rapid setState, nested component trees.
// Toggle buttons let you stack stressors and watch FPS/RSS react.

// -- Fake React hooks (simplified but representative) -------------

let _stateSlots = [];
let _stateIdx = 0;
let _effects = [];
let _effectIdx = 0;
let _memos = [];
let _memoIdx = 0;
let _dirty = false;

function resetHooks() {
  _stateIdx = 0;
  _effectIdx = 0;
  _memoIdx = 0;
}

function useState(initial) {
  const idx = _stateIdx++;
  if (_stateSlots[idx] === undefined) _stateSlots[idx] = initial;
  return [
    _stateSlots[idx],
    (val) => {
      const newVal = typeof val === 'function' ? val(_stateSlots[idx]) : val;
      if (_stateSlots[idx] !== newVal) {
        _stateSlots[idx] = newVal;
        _dirty = true;
      }
    }
  ];
}

function useEffect(fn, deps) {
  const idx = _effectIdx++;
  const prev = _effects[idx];
  const depsChanged = !prev || !deps || deps.some((d, i) => d !== prev.deps[i]);
  if (depsChanged) {
    if (prev && prev.cleanup) prev.cleanup();
    const cleanup = fn();
    _effects[idx] = { deps: deps ? [...deps] : null, cleanup };
  }
}

function useMemo(fn, deps) {
  const idx = _memoIdx++;
  const prev = _memos[idx];
  const depsChanged = !prev || deps.some((d, i) => d !== prev.deps[i]);
  if (depsChanged) {
    const value = fn();
    _memos[idx] = { deps: [...deps], value };
    return value;
  }
  return prev.value;
}

// -- Stress toggles -----------------------------------------------

let stressEffectLoop = false;    // useEffect that re-renders every frame
let stressMemoCompute = false;   // useMemo with heavy fibonacci compute
let stressDynamicList = false;   // render 200+ dynamic list items
let stressNestedTree = false;    // deeply nested component tree (10 levels)
let stressRapidState = false;    // 10 setState calls per frame

let counter = 0;
let listCount = 200;
let tickCount = 0;
let lastFlushTime = 0;

// -- Heavy compute for useMemo test ------------------------------

function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function heavyCompute(seed) {
  // Simulate expensive computation: fibonacci + string ops
  let result = 0;
  for (let i = 0; i < 100; i++) {
    result += fibonacci(30 + (seed % 10));
  }
  // String churn (GC pressure)
  let s = '';
  for (let i = 0; i < 50; i++) {
    s += `item-${i}-${result}-`;
  }
  return { result, hash: s.length };
}

// -- Toggle handler ----------------------------------------------

globalThis.__onPress = function(id) {
  switch(id) {
    case 1: stressEffectLoop = !stressEffectLoop; break;
    case 2: stressMemoCompute = !stressMemoCompute; break;
    case 3: stressDynamicList = !stressDynamicList; break;
    case 4: stressNestedTree = !stressNestedTree; break;
    case 5: stressRapidState = !stressRapidState; break;
    case 10: counter++; break;
    case 11: counter = 0; stressEffectLoop = false; stressMemoCompute = false;
             stressDynamicList = false; stressNestedTree = false;
             stressRapidState = false; break;
  }
  render();
};

// -- Build nested tree (stress test) -----------------------------

function buildNestedTree(depth, maxDepth) {
  if (depth >= maxDepth) {
    return {
      kind: 'text',
      text: `Leaf ${depth}`,
      fontSize: 11,
      color: '#88aacc',
    };
  }
  return {
    kind: 'box',
    style: {
      padding: 4,
      backgroundColor: `#${(20 + depth * 8).toString(16).padStart(2,'0')}${(20 + depth * 5).toString(16).padStart(2,'0')}${(40 + depth * 10).toString(16).padStart(2,'0')}`,
      borderRadius: 4,
      flexDirection: 'column',
      gap: 2,
    },
    children: [
      { kind: 'text', text: `Depth ${depth}`, fontSize: 10, color: '#667788' },
      buildNestedTree(depth + 1, maxDepth),
      buildNestedTree(depth + 1, maxDepth),
    ],
  };
}

// -- Render -------------------------------------------------------

function render() {
  resetHooks();
  const t0 = Date.now();

  // Hook: useEffect loop (re-renders every tick via rAF)
  // This is handled in __zigOS_tick override below

  // Hook: useMemo with heavy compute
  let memoResult = null;
  if (stressMemoCompute) {
    memoResult = useMemo(() => heavyCompute(counter), [counter]);
  }

  // Hook: rapid setState (10 increments per render)
  if (stressRapidState) {
    for (let i = 0; i < 10; i++) {
      counter++;
    }
  }

  // Build dynamic list
  let listItems = [];
  if (stressDynamicList) {
    for (let i = 0; i < listCount; i++) {
      listItems.push({
        kind: 'box',
        style: {
          padding: 4,
          backgroundColor: i % 2 === 0 ? '#1a2030' : '#1e2438',
          flexDirection: 'row',
          gap: 8,
        },
        children: [
          { kind: 'text', text: `#${i}`, fontSize: 11, color: '#445566' },
          { kind: 'text', text: `Item ${i} -value: ${(i * 17 + counter) % 1000}`, fontSize: 12, color: '#aabbcc' },
        ],
      });
    }
  }

  // Build nested tree
  let nestedTree = null;
  if (stressNestedTree) {
    nestedTree = buildNestedTree(0, 8); // 2^8 = 256 leaf nodes
  }

  const flushTime = Date.now() - t0;
  lastFlushTime = flushTime;

  function toggleBtn(id, label, active) {
    return {
      kind: 'box',
      style: {
        padding: 8,
        backgroundColor: active ? '#e94560' : '#2a3050',
        borderRadius: 6,
      },
      children: [{ kind: 'text', text: label, fontSize: 12, color: active ? '#ffffff' : '#8899aa' }],
      onPressId: id,
    };
  }

  const tree = {
    kind: 'box',
    style: { width: 1024, flexDirection: 'column', gap: 8, padding: 16, backgroundColor: '#121220' },
    children: [
      // Title
      { kind: 'text', text: 'ZigOS Stress Test', fontSize: 24, color: '#e94560' },

      // Telemetry bar (host fills these via __setTelemetry)
      {
        kind: 'box',
        style: { flexDirection: 'row', gap: 16, padding: 8, backgroundColor: '#1a1a2e', borderRadius: 4 },
        children: [
          { kind: 'text', text: `Counter: ${counter}`, fontSize: 14, color: '#ffffff' },
          { kind: 'text', text: `Tick: ${tickCount}`, fontSize: 14, color: '#667788' },
          { kind: 'text', text: `JS compute: ${flushTime}ms`, fontSize: 14, color: flushTime > 8 ? '#e94560' : '#4ec9b0' },
          { kind: 'text', text: `Memo: ${memoResult ? memoResult.result : 'off'}`, fontSize: 14, color: '#aabbcc' },
        ],
      },

      // Toggle buttons
      {
        kind: 'box',
        style: { flexDirection: 'row', gap: 8 },
        children: [
          toggleBtn(1, `Effect Loop ${stressEffectLoop ? 'ON' : 'off'}`, stressEffectLoop),
          toggleBtn(2, `Memo Compute ${stressMemoCompute ? 'ON' : 'off'}`, stressMemoCompute),
          toggleBtn(3, `${listCount} List Items ${stressDynamicList ? 'ON' : 'off'}`, stressDynamicList),
          toggleBtn(4, `Nested Tree ${stressNestedTree ? 'ON' : 'off'}`, stressNestedTree),
          toggleBtn(5, `Rapid State ${stressRapidState ? 'ON' : 'off'}`, stressRapidState),
        ],
      },

      // Counter buttons
      {
        kind: 'box',
        style: { flexDirection: 'row', gap: 8 },
        children: [
          toggleBtn(10, '+ Count', false),
          toggleBtn(11, 'Reset All', false),
        ],
      },

      // Dynamic list (if enabled)
      ...(stressDynamicList ? [{
        kind: 'box',
        style: { flexDirection: 'column', gap: 1, padding: 4, backgroundColor: '#0f1520', borderRadius: 4 },
        children: listItems.slice(0, 50), // cap visual to 50 to avoid node limit
      }] : []),

      // Nested tree (if enabled)
      ...(stressNestedTree ? [nestedTree] : []),
    ],
  };

  __hostFlush(JSON.stringify(tree));
}

// Override tick to drive effect loop
const _origTick = globalThis.__zigOS_tick;
globalThis.__zigOS_tick = function() {
  _origTick();
  tickCount++;

  if (stressEffectLoop) {
    counter++;
    render();
  }
};

// Initial render
render();
console.log('Stress test cartridge loaded.');
