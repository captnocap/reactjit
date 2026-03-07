// rjit test shim — evaluated inside QuickJS before the user's spec bundle.
//
// Defines globals: test(), page, expect(), _runTests()
// Uses globalThis.__rjitBridge (set by Love2DApp.ts at startup).
//
// No Node.js. No npm. Runs entirely inside the Love2D process.
;(function () {
  var bridge = globalThis.__rjitBridge;
  if (!bridge) {
    throw new Error('[rjit test] __rjitBridge not found — is RJIT_TEST=1 set?');
  }

  var _tests = [];

  // ── test() ──────────────────────────────────────────────────────────────────
  globalThis.test = function (name, fn) {
    _tests.push({ name: name, fn: fn });
  };

  // ── Locator ──────────────────────────────────────────────────────────────────
  // Lazy query — evaluated on first interaction.
  function Locator(queryArgs) {
    this._q = queryArgs;
  }

  Locator.prototype._resolve = async function () {
    var results = await bridge.rpc('test:query', this._q);
    if (!results || !results[0]) {
      throw new Error('Element not found: ' + JSON.stringify(this._q));
    }
    return results[0];
  };

  // Click: inject mouse event, then wait one frame for React to process it.
  Locator.prototype.click = async function () {
    var el = await this._resolve();
    await bridge.rpc('test:click', { x: el.cx, y: el.cy });
    await bridge.rpc('test:wait', {});
  };

  // Type: click to focus, send characters, wait one frame.
  Locator.prototype.type = async function (text) {
    var el = await this._resolve();
    await bridge.rpc('test:click', { x: el.cx, y: el.cy });
    await bridge.rpc('test:type', { text: text });
    await bridge.rpc('test:wait', {});
  };

  // Key: inject a named key (e.g. 'return', 'backspace', 'escape').
  Locator.prototype.key = async function (key) {
    await bridge.rpc('test:key', { key: key });
    await bridge.rpc('test:wait', {});
  };

  Locator.prototype.text = async function () {
    var el = await this._resolve();
    return el.text;
  };

  Locator.prototype.rect = async function () {
    var el = await this._resolve();
    return { x: el.x, y: el.y, w: el.w, h: el.h };
  };

  // Return all matching nodes (array of plain objects with .text, .rect(), etc.)
  Locator.prototype.all = async function () {
    return await bridge.rpc('test:query', this._q) || [];
  };

  Locator.prototype.nth = async function (index) {
    var results = await bridge.rpc('test:query', this._q);
    if (!results || results.length <= index) {
      throw new Error('No element at index ' + index + ' for: ' + JSON.stringify(this._q));
    }
    return results[index];
  };

  // ── page ─────────────────────────────────────────────────────────────────────
  // ── AuditResult ──────────────────────────────────────────────────────────
  // Wraps the violations array from test:audit for ergonomic assertions.
  function AuditResult(violations) {
    // Empty Lua tables serialize as {} (object) not [] (array) through the bridge.
    // Normalize to array so .filter/.map always work.
    if (!Array.isArray(violations)) violations = [];
    this.violations = violations;
    this.errors   = violations.filter(function (v) { return v.severity === 'error'; });
    this.warnings = violations.filter(function (v) { return v.severity === 'warning'; });
  }

  AuditResult.prototype.byRule = function (rule) {
    return new AuditResult(this.violations.filter(function (v) { return v.rule === rule; }));
  };

  AuditResult.prototype.toString = function () {
    if (this.violations.length === 0) return 'No layout violations';
    return this.violations.map(function (v) {
      return '[' + v.severity + '] ' + v.rule + ': ' + v.message;
    }).join('\n');
  };

  globalThis.page = {
    find: function (type, props) {
      return new Locator({ type: type, props: props || {} });
    },
    screenshot: function (path) {
      return bridge.rpc('test:screenshot', { path: path });
    },
    // Crop-screenshot a specific element. Resolves the locator, gets its rect,
    // and captures just that region (plus optional padding).
    //
    // Usage:
    //   await page.snap(page.find('Box', { testId: 'sidebar' }), '/tmp/sidebar.png');
    //   await page.snap(page.find('Text', { testId: 'title' }), '/tmp/title.png', { padding: 10 });
    snap: async function (locator, path, options) {
      var el = await locator._resolve();
      return bridge.rpc('test:snap', {
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        path: path || '/tmp/rjit-snap.png',
        padding: (options && options.padding) || 4,
      });
    },
    // Explicitly wait N frames (default 1). Useful after animations.
    wait: function (frames) {
      var n = frames || 1;
      var p = Promise.resolve();
      for (var i = 0; i < n; i++) {
        p = p.then(function () { return bridge.rpc('test:wait', {}); });
      }
      return p;
    },

    // ── Layout audit ─────────────────────────────────────────────────────
    // Returns an AuditResult containing all layout violations.
    //
    // Options:
    //   scope:    { type?, props? } — limit audit to a subtree root
    //   severity: 'error' | 'warning' — filter by severity
    //   rule:     'child-overflow' | 'sibling-overlap' | 'off-viewport'
    //
    // Usage:
    //   const audit = await page.audit();
    //   await expect(audit).toHaveNoViolations();
    //
    //   const audit = await page.audit({ scope: { testId: 'sidebar' } });
    //   await expect(audit).toHaveNoViolations();
    //
    //   const overflows = await page.audit({ rule: 'child-overflow' });
    audit: async function (options) {
      var args = {};
      if (options) {
        if (options.scope) {
          args.scope = { type: options.scope.type, props: options.scope.props || options.scope };
          // Shorthand: page.audit({ scope: { testId: 'x' } }) — wrap bare props
          if (!options.scope.type && !options.scope.props) {
            args.scope = { props: options.scope };
          }
        }
        if (options.severity) args.severity = options.severity;
        if (options.rule) args.rule = options.rule;
      }
      var violations = await bridge.rpc('test:audit', args);
      return new AuditResult(violations || []);
    },
  };

  // ── expect() ─────────────────────────────────────────────────────────────────
  function Matchers(target) {
    this._t = target;
  }

  Matchers.prototype.toHaveText = async function (expected) {
    var actual = (this._t instanceof Locator)
      ? await this._t.text()
      : String(this._t);
    if (actual !== expected) {
      throw new Error(
        'Expected text "' + expected + '" but got "' + actual + '"'
      );
    }
  };

  Matchers.prototype.toContainText = async function (substring) {
    var actual = (this._t instanceof Locator)
      ? await this._t.text()
      : String(this._t);
    if (actual.indexOf(substring) === -1) {
      throw new Error(
        'Expected text to contain "' + substring + '" but got "' + actual + '"'
      );
    }
  };

  Matchers.prototype.toBeVisible = async function () {
    var el = await this._t._resolve();
    if (el.w <= 0 || el.h <= 0) {
      throw new Error('Element not visible (w=' + el.w + ' h=' + el.h + ')');
    }
  };

  Matchers.prototype.toBeFound = async function () {
    var results = await bridge.rpc('test:query', this._t._q);
    if (!results || results.length === 0) {
      throw new Error('Expected element to exist: ' + JSON.stringify(this._t._q));
    }
  };

  Matchers.prototype.toHaveRect = async function (expected) {
    var rect = await this._t.rect();
    for (var k in expected) {
      if (Math.abs(rect[k] - expected[k]) > 1) {
        throw new Error(
          'Expected rect.' + k + '=' + expected[k] + ' but got ' + rect[k]
        );
      }
    }
  };

  // Assert that an AuditResult has no layout violations.
  // Usage: await expect(await page.audit()).toHaveNoViolations()
  //
  // Options:
  //   ignoreRules: ['sibling-overlap'] — skip specific rules
  //   ignoreWarnings: true — only fail on errors
  Matchers.prototype.toHaveNoViolations = async function (options) {
    var audit = this._t;
    if (!audit || typeof audit.violations === 'undefined') {
      throw new Error('toHaveNoViolations expects an AuditResult from page.audit()');
    }
    var violations = audit.violations;
    if (options) {
      if (options.ignoreWarnings) {
        violations = violations.filter(function (v) { return v.severity !== 'warning'; });
      }
      if (options.ignoreRules) {
        var ignored = options.ignoreRules;
        violations = violations.filter(function (v) { return ignored.indexOf(v.rule) === -1; });
      }
    }
    if (violations.length > 0) {
      var summary = violations.map(function (v) {
        return '  [' + v.severity + '] ' + v.rule + ': ' + v.message;
      }).join('\n');
      throw new Error(
        violations.length + ' layout violation(s) found:\n' + summary
      );
    }
  };

  globalThis.expect = function (target) {
    return new Matchers(target);
  };

  // ── _runTests() ──────────────────────────────────────────────────────────────
  // Called by Lua after 3 frames (layout settled).
  globalThis._runTests = async function () {
    var results = [];
    for (var i = 0; i < _tests.length; i++) {
      var t = _tests[i];
      try {
        await t.fn();
        results.push({ name: t.name, passed: true });
      } catch (e) {
        results.push({
          name: t.name,
          passed: false,
          error: (e && e.message) ? e.message : String(e),
        });
      }
    }
    await bridge.rpc('test:done', { results: results });
  };
})();
