function compileLane(source, tokens, file) {
  if (isSoupLaneSource(source, file)) {
    return compileSoupLane(source, file);
  }

  if (isModuleLaneBuild()) {
    return compileModuleLane(source, file);
  }

  if (isPageLaneSource(source)) {
    return compilePageLane(source, tokens, file);
  }

  return compileAppLane(source, tokens, file);
}
