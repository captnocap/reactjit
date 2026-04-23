// Minimum React-shape mount. The createElement signature matches React's;
// JSRT doesn't know this is "React" — it's just a function call.
function createElement(type, props, children) {
  return { type: type, props: props || {}, children: children };
}

// Hello, world.
let root = createElement("Text", {}, ["hello"]);
let textNodeId = __hostCreateText(root.children[0]);
let textId = __hostCreate(root.type, root.props);
__hostAppend(textId, textNodeId);
__hostAppendToRoot(textId);
