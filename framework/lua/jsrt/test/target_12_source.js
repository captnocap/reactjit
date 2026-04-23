// Minimal React-shape counter.
//
// Structure:
//   <Pressable onPress={() => setN(n+1)}>
//     <Text>{n}</Text>
//   </Pressable>
//
// Single-instance single-hook-slot to keep the test honest without
// needing fiber machinery. Real React's fiber-indexed hook arrays arrive
// at target 13 with the real library.

function createElement(type, props, children) {
  return { type: type, props: props || {}, children: children || [] };
}

// Hook storage — exactly one slot, one component.
let hookSlot = undefined;

// Per-mount bookkeeping.
let textHostId = null;
let pressHandler = null;

function useState(initial) {
  if (hookSlot === undefined) {
    hookSlot = initial;
  }
  let current = hookSlot;
  let setter = function(v) {
    hookSlot = v;
    rerender();
  };
  return [current, setter];
}

function Counter() {
  let s = useState(0);
  let n = s[0];
  let setN = s[1];
  return createElement(
    "Pressable",
    { onPress: function() { setN(n + 1); } },
    [ createElement("Text", {}, [n]) ]
  );
}

function mount() {
  let tree = Counter();
  pressHandler = tree.props.onPress;

  let pressId = __hostCreate("Pressable", {});
  let textEl = tree.children[0];
  textHostId = __hostCreate("Text", {});
  let strId = __hostCreateText("" + textEl.children[0]);
  __hostAppend(textHostId, strId);
  __hostAppend(pressId, textHostId);
  __hostAppendToRoot(pressId);
}

function rerender() {
  let tree = Counter();
  pressHandler = tree.props.onPress;
  let textEl = tree.children[0];
  __hostUpdateText(textHostId, "" + textEl.children[0]);
}

mount();

// Hand the host a dispatch function. The Lua test calls it to simulate a
// click; it invokes the currently-registered press handler, which runs
// through useState's setter, which triggers rerender, which emits UPDATE_TEXT.
__registerDispatch(function() { pressHandler(); });
