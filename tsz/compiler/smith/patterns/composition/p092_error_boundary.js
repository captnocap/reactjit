(function() {
// ── Pattern 092: Error boundary ─────────────────────────────────
// Index: 92
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   // Definition (class component):
//   class ErrorBoundary extends React.Component {
//     constructor(props) {
//       super(props);
//       this.state = { hasError: false };
//     }
//     static getDerivedStateFromError(error) {
//       return { hasError: true };
//     }
//     componentDidCatch(error, info) {
//       logErrorToService(error, info);
//     }
//     render() {
//       if (this.state.hasError) return <FallbackUI />;
//       return this.props.children;
//     }
//   }
//
//   // Usage:
//   <ErrorBoundary fallback={<Text>Something went wrong</Text>}>
//     <MyApp />
//   </ErrorBoundary>
//
// Mixed syntax (hybrid):
//   Same as soup — error boundaries are class-only in React.
//
// Zig output target:
//   // Error boundary usage compiles as a passthrough wrapper.
//   // <ErrorBoundary><MyApp /></ErrorBoundary>
//   //   → compiles as: <MyApp />  (children rendered directly)
//   //
//   // The fallback prop is compiled but wired to the framework's
//   // crash handler rather than to React error catching.
//   //
//   // For the children:
//   // .{ .style = .{ ... }, .children = &_arr_0 }  // MyApp inlined
//
// Notes:
//   Error boundaries catch JS exceptions during React rendering.
//   In our compiled model, rendering is deterministic Zig — it doesn't
//   throw. Runtime panics (OOB, null deref) are caught by the
//   framework's crash handler (framework/crash.zig) which renders
//   a BSOD screen.
//
//   Compilation strategy:
//   - Class definition: skip entirely (class components not supported)
//   - Usage as JSX wrapper: compile as passthrough, render children
//   - Fallback prop: compile and wire to crash handler's fallback UI
//
//   The crash handler already provides error recovery UI. An error
//   boundary in soup code maps to: "if the app panics, show this
//   fallback" — which is exactly what the crash handler does.

function match(c, ctx) {
  // Two match cases:
  // 1. Class definition: class X extends React.Component
  // 2. JSX usage: <ErrorBoundary> (detected by component name)
  var saved = c.save();

  // Case 1: class definition
  if (c.kind() === 6 && c.text() === 'class') {
    c.advance();
    if (c.kind() === 6) c.advance(); // class name
    if (c.kind() === 6 && c.text() === 'extends') {
      c.restore(saved);
      return true;
    }
  }

  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Case 1: Class definition — extract render() method's return JSX.
  //
  // 1. Skip class header: class Name extends React.Component {
  c.advance(); // class
  var className = c.text();
  c.advance(); // name
  c.advance(); // extends
  // Skip React.Component or Component
  while (c.pos < c.count && c.kind() !== 12 /* TK.lbrace */) c.advance();
  c.advance(); // {
  //
  // 2. Scan class body for render() method
  var classDepth = 1;
  var renderFound = false;
  while (c.pos < c.count && classDepth > 0) {
    if (c.kind() === 12) classDepth++;
    if (c.kind() === 13 /* TK.rbrace */) {
      classDepth--;
      if (classDepth === 0) break;
    }
    // Look for: render() { or render() {
    if (classDepth === 1 && c.kind() === 6 && c.text() === 'render') {
      c.advance(); // render
      if (c.kind() === 8 /* TK.lparen */) {
        c.advance(); // (
        if (c.kind() === 9 /* TK.rparen */) c.advance(); // )
        if (c.kind() === 12) {
          c.advance(); // {
          // Now inside render() body — find return statement
          var renderDepth = 1;
          while (c.pos < c.count && renderDepth > 0) {
            if (renderDepth === 1 && c.kind() === 6 && c.text() === 'return') {
              c.advance(); // return
              if (c.kind() === 8) c.advance(); // optional (
              // Parse the returned JSX
              var resultNode = parseJSXElement(c);
              // Skip to end of class
              while (c.pos < c.count && classDepth > 0) {
                if (c.kind() === 12) classDepth++;
                if (c.kind() === 13) classDepth--;
                c.advance();
              }
              // Register className as a component that renders resultNode
              // When <ErrorBoundary> is used, it inlines to children passthrough
              return resultNode;
            }
            if (c.kind() === 12) renderDepth++;
            if (c.kind() === 13) renderDepth--;
            c.advance();
          }
        }
      }
      continue;
    }
    c.advance();
  }
  if (c.kind() === 13) c.advance(); // closing }
  //
  // If no render method found, skip the class entirely
  return null;
}

_patterns[92] = { id: 92, match: match, compile: compile };

})();
