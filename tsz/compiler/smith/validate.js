// ── Post-parse validation ──
// Pure read-only function. Runs after parseJSXElement (ctx fully populated),
// before emitOutput. Validates ctx for Class A (detectable) and Class B
// (silent wrong-output) bugs.

function validate(ctx) {
  const errors = [];
  const warnings = [];
  const intents = derivePreflightIntents(ctx);
  const scan = buildPreflightScanState(ctx, intents);

  checkEmptyHandlers(ctx, warnings);
  checkMapHandlerDispatch(ctx, warnings);
  checkDuplicateHandlerNames(ctx, errors);
  checkColorPlaceholders(ctx, scan, errors, warnings);
  checkMapObjectArrays(ctx, errors);
  checkScriptHandlerCalls(ctx, scan, errors);
  checkLuaSyntaxLeaks(ctx, scan, errors);
  checkHandlerReferences(scan, errors);
  checkObjectArrayFieldReferences(ctx, scan, warnings);
  checkUnresolvedDynTexts(ctx, errors);
  warnOnUnusedMapLuaPtrs(ctx, warnings);
  warnOnUnreadStateSlots(ctx, scan, warnings);
  checkTagLeakTextNodes(scan, errors);
  checkJSSyntaxLeaks(scan, errors);
  checkItemReferenceLeaks(ctx, scan, errors, warnings);
  checkUnresolvedClassifierComponents(ctx, errors);
  checkDroppedExpressions(ctx, errors);
  warnOnUnknownSubsystemTags(ctx, warnings);
  checkIgnoredModuleBlocks(ctx, errors);
  checkUndefinedJSCalls(ctx, errors);
  checkDuplicateJSVars(ctx, errors);
  checkUnimplementedJSXBlocks(errors);

  // ── Route plan validation ──
  // The route plan was built BEFORE parse (in the lane compiler).
  // Here we just check if it flagged any ambiguities.
  if (ctx._routePlan && ctx._routePlan.ambiguous.length > 0) {
    for (var ai = 0; ai < ctx._routePlan.ambiguous.length; ai++) {
      errors.push('ROUTE: ' + ctx._routePlan.ambiguous[ai]);
    }
  }

  // --strict: promote all warnings to errors
  if (globalThis.__strict === 1 && warnings.length > 0) {
    for (var wi = 0; wi < warnings.length; wi++) {
      errors.push('STRICT: ' + warnings[wi]);
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    lane: scan.lane,
    intents: intents,
    plan: ctx._routePlan || null,
  };
}

// Generate @compileError Zig output for validation failures
function validateErrorZig(result, file) {
  var out = '//! VALIDATE BLOCKED: tsz compiler detected errors in ' + file + '\n';
  for (var i = 0; i < result.errors.length; i++) {
    out += '//! FATAL: ' + result.errors[i] + '\n';
  }
  for (var i = 0; i < result.warnings.length; i++) {
    out += '//! WARN: ' + result.warnings[i] + '\n';
  }
  out += 'comptime { @compileError("Smith validate failed — ' + result.errors.length + ' error(s). See diagnostics above."); }\n';
  return out;
}
