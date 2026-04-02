# CLI & Scaffolds

## The CLI

One binary: `rjit`. Ships with compiler, dev tools, everything.

```bash
rjit init                    # scaffold a new project
rjit dev                     # hot-reload dev server
rjit build                   # production build
rjit build --release         # optimized binary
rjit test                    # run conformance/parity checks
rjit inspect                 # launch inspector devtool
```

## Scaffolds

`rjit init` asks two questions:

1. **What are you making?** → widget, app, lib
2. **How do you write?** → soup, mixed, chad

That's it. 2 questions, 9 combinations. Each produces a working skeleton that compiles and shows "Happy Hacking" centered on screen.

### The Rule

**Scaffolds are lane-native.** A soup developer gets React. A chad developer gets intent blocks. Nobody sees syntax they didn't choose. The scaffold is the first impression — it must feel like home.

### Widget Scaffolds (one file, one binary)

**soup:**
```tsx
import React from 'react';

const App = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ backgroundColor: "#0f172a", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ color: "#e2e8f0", fontSize: 24 }}>Happy Hacking</h1>
    </div>
  );
};

export default App;
```

**mixed:**
```tsx
const [count, setCount] = useState(0);

function App() {
  return (
    <Box style={{ backgroundColor: "#0f172a", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
      <Text fontSize={24} color="#e2e8f0">Happy Hacking</Text>
    </Box>
  );
}
```

**chad:**
```
<app widget>
  return(
    <Box style={{ backgroundColor: "#0f172a", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
      <Text fontSize={24} color="#e2e8f0">Happy Hacking</Text>
    </Box>
  )
</app>
```

### App Scaffolds (multi-file, pages)

**soup:**
```
my-app/
  app.tsz              ← div/nav/onClick, import pages
  home.tsz             ← div/h1/p, "Happy Hacking"
  settings.tsz         ← div/h2, "Settings"
```

**mixed:**
```
my-app/
  app.tsz              ← Box/Pressable, import pages
  app.script.tsz       ← JS logic
  home.tsz             ← Box/Text, "Happy Hacking"
  settings.tsz         ← Box/Text, "Settings"
  style.cls.tsz        ← base classifiers
```

**chad:**
```
my-app/
  app.tsz              ← <myApp app> with <pages>, <functions>, return()
  home.tsz             ← <home page> with "Happy Hacking"
  settings.tsz         ← <settings page> with "Settings"
  theme.tcls.tsz       ← theme classifiers
  style.cls.tsz        ← layout classifiers
```

### Lib Scaffolds (modules, no UI)

**soup:**
Not applicable — soup is UI-first. If someone picks soup + lib, give them mixed. Libs are backend.

**mixed:**
```
my-lib/
  lib.tsz              ← entry
  utils.mod.tsz        ← module with helper functions
  utils.script.tsz     ← JS logic
```

**chad:**
```
my-lib/
  lib.tsz              ← <myLib lib> with <utils module />
  utils.mod.tsz        ← <utils module> with <functions>
```

## Scaffold Directory

All scaffolds live in the shipped binary as embedded templates:

```
scaffolds/
  widget/
    soup.tsz
    mixed.tsz
    chad.tsz
  app/
    soup/
      app.tsz
      home.tsz
      settings.tsz
    mixed/
      app.tsz
      app.script.tsz
      home.tsz
      settings.tsz
      style.cls.tsz
    chad/
      app.tsz
      home.tsz
      settings.tsz
      theme.tcls.tsz
      style.cls.tsz
  lib/
    mixed/
      lib.tsz
      utils.mod.tsz
      utils.script.tsz
    chad/
      lib.tsz
      utils.mod.tsz
```

## What `rjit init` Does

```bash
$ rjit init
What are you making? [widget/app/lib]: app
How do you write? [soup/mixed/chad]: mixed
Project name: my-dashboard

Creating my-dashboard/...
  my-dashboard/app.tsz
  my-dashboard/app.script.tsz
  my-dashboard/home.tsz
  my-dashboard/settings.tsz
  my-dashboard/style.cls.tsz

Done. Run: cd my-dashboard && rjit dev
```

The scaffold compiles and runs immediately. `rjit dev` shows "Happy Hacking" in a window. From there, the developer replaces the placeholder content with their app.

## What Scaffolds DON'T Do

- No opinions on style (dark theme skeleton only — they'll change it)
- No opinions on architecture (minimal files — they'll add more)
- No boilerplate they'll delete (no comments explaining what things are)
- No features (no counter, no todo — just "Happy Hacking")
- No dependencies (scaffold compiles with zero imports beyond the stdlib)

The scaffold is a blank canvas that proves the toolchain works. Everything after is the developer's problem.
