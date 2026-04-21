// Minimal TSX — proves the full esbuild → JSRT pipeline handles real JSX.
//
// JSX is lowered by esbuild to `h(Type, props, ...children)` calls. The `h`
// factory is supplied by the host (JSRT has no idea "h" is React's creator,
// it's just a function value in scope). When h encounters a function
// component, it invokes it. The component returns a plain JS tree that
// the mount walker converts into host ops.

function Text(props: any) {
  return { kind: "Text", text: props.children };
}

function render(tree: any) {
  if (typeof tree === "string") {
    return __hostCreateText(tree);
  }
  const id = __hostCreate(tree.kind, {});
  if (tree.text) {
    const textId = __hostCreateText(tree.text);
    __hostAppend(id, textId);
  }
  __hostAppendToRoot(id);
}

render(<Text>hello</Text>);
