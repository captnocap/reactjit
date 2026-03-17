// Stress test - slots version
// UI is defined in Zig. JS only does logic via __setState/__getState.
//
// Slot assignments:
//   0: counter (int)
//   1: tickCount (int)
//   2: effectLoop active (bool)
//   3: memoCompute active (bool)
//   4: dynamicList active (bool)
//   5: nestedTree active (bool)
//   6: rapidState active (bool)
//   7: jsComputeTime (int, microseconds)
//   8: memoResult (int)
//   9: effectLoopLabel (string)
//  10: memoComputeLabel (string)
//  11: dynamicListLabel (string)
//  12: nestedTreeLabel (string)
//  13: rapidStateLabel (string)
//  14: counterText (string)
//  15: tickText (string)
//  16: computeText (string)
//  17: memoText (string)

// Slot IDs
const S_COUNTER = 0;
const S_TICK = 1;
const S_EFFECT_ON = 2;
const S_MEMO_ON = 3;
const S_LIST_ON = 4;
const S_TREE_ON = 5;
const S_RAPID_ON = 6;
const S_JS_TIME = 7;
const S_MEMO_RESULT = 8;
const S_LBL_EFFECT = 9;
const S_LBL_MEMO = 10;
const S_LBL_LIST = 11;
const S_LBL_TREE = 12;
const S_LBL_RAPID = 13;
const S_COUNTER_TEXT = 14;
const S_TICK_TEXT = 15;
const S_COMPUTE_TEXT = 16;
const S_MEMO_TEXT = 17;

let counter = 0;
let tickCount = 0;
let effectLoop = false;
let memoCompute = false;
let dynamicList = false;
let nestedTree = false;
let rapidState = false;

function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

function heavyCompute(seed) {
  let result = 0;
  for (let i = 0; i < 100; i++) result += fibonacci(30 + (seed % 10));
  let s = '';
  for (let i = 0; i < 50; i++) s += 'item-' + i + '-' + result + '-';
  return result;
}

function updateLabels() {
  __setState(S_LBL_EFFECT, 'Effect Loop ' + (effectLoop ? 'ON' : 'off'));
  __setState(S_LBL_MEMO, 'Memo Compute ' + (memoCompute ? 'ON' : 'off'));
  __setState(S_LBL_LIST, '200 List Items ' + (dynamicList ? 'ON' : 'off'));
  __setState(S_LBL_TREE, 'Nested Tree ' + (nestedTree ? 'ON' : 'off'));
  __setState(S_LBL_RAPID, 'Rapid State ' + (rapidState ? 'ON' : 'off'));
}

function updateDisplay() {
  const t0 = Date.now();

  if (memoCompute) {
    const result = heavyCompute(counter);
    __setState(S_MEMO_RESULT, result);
    __setState(S_MEMO_TEXT, 'Memo: ' + result);
  } else {
    __setState(S_MEMO_TEXT, 'Memo: off');
  }

  if (rapidState) {
    for (let i = 0; i < 10; i++) counter++;
  }

  __setState(S_COUNTER, counter);
  __setState(S_COUNTER_TEXT, 'Counter: ' + counter);
  __setState(S_TICK_TEXT, 'Tick: ' + tickCount);

  const elapsed = Date.now() - t0;
  __setState(S_JS_TIME, elapsed);
  __setState(S_COMPUTE_TEXT, 'JS: ' + elapsed + 'ms');

  __setState(S_EFFECT_ON, effectLoop);
  __setState(S_MEMO_ON, memoCompute);
  __setState(S_LIST_ON, dynamicList);
  __setState(S_TREE_ON, nestedTree);
  __setState(S_RAPID_ON, rapidState);
}

globalThis.__onPress = function(id) {
  switch(id) {
    case 1: effectLoop = !effectLoop; break;
    case 2: memoCompute = !memoCompute; break;
    case 3: dynamicList = !dynamicList; break;
    case 4: nestedTree = !nestedTree; break;
    case 5: rapidState = !rapidState; break;
    case 10: counter++; break;
    case 11: counter = 0; effectLoop = false; memoCompute = false;
             dynamicList = false; nestedTree = false; rapidState = false; break;
  }
  updateLabels();
  updateDisplay();
};

// Override tick for effect loop
const _origTick = globalThis.__zigOS_tick;
globalThis.__zigOS_tick = function() {
  _origTick();
  tickCount++;

  if (effectLoop) {
    counter++;
    updateDisplay();
  }
  // Update tick count every frame regardless
  __setState(S_TICK, tickCount);
  __setState(S_TICK_TEXT, 'Tick: ' + tickCount);
};

// Initial state
updateLabels();
updateDisplay();
console.log('Stress test (slots) loaded.');
