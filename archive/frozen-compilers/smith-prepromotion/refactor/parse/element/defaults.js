// ── JSX element default field setup ───────────────────────────────

function initElementParseState(rawTag, tag) {
  let styleFields = [];
  let nodeFields = [];

  if (rawTag === 'Graph') nodeFields.push('.graph_container = true');
  if (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path') nodeFields.push('.canvas_path = true');
  if (tag === 'ScrollView' || rawTag === 'ScrollView') styleFields.push('.overflow = .scroll');
  if (rawTag === 'Canvas') {
    nodeFields.push('.graph_container = true');
    nodeFields.push('.canvas_type = "canvas"');
  }
  if (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node') {
    nodeFields.push('.canvas_node = true');
  }
  if (rawTag === 'Canvas.Clamp') nodeFields.push('.canvas_clamp = true');
  if (rawTag === 'Canvas.Overlay') {
    styleFields.push('.position = .absolute');
    styleFields.push('.top = 0');
    styleFields.push('.left = 0');
    styleFields.push('.right = 0');
    styleFields.push('.bottom = 0');
  }
  if (rawTag === 'Terminal') {
    if (!ctx.terminalCount) ctx.terminalCount = 0;
    nodeFields.push(`.terminal_id = ${ctx.terminalCount}`);
    ctx.terminalCount++;
  }
  if (rawTag === 'TextInput' || rawTag === 'TextArea') {
    if (!ctx.inputCount) ctx.inputCount = 0;
    nodeFields.push(`.input_id = ${ctx.inputCount}`);
    ctx.inputCount++;
  }
  if (rawTag === 'Scene3D' || rawTag === '3D.View') nodeFields.push('.scene3d = true');
  if (rawTag === '3D.Mesh') nodeFields.push('.scene3d_mesh = true');
  if (rawTag === '3D.Camera') nodeFields.push('.scene3d_camera = true');
  if (rawTag === '3D.Light') nodeFields.push('.scene3d_light = true');
  if (rawTag === '3D.Floor') {
    nodeFields.push('.scene3d_mesh = true');
    nodeFields.push('.scene3d_geometry = "plane"');
  }
  if (rawTag === '3D.Cube') {
    nodeFields.push('.scene3d_mesh = true');
    nodeFields.push('.scene3d_geometry = "box"');
  }
  if (rawTag === '3D.Sphere') {
    nodeFields.push('.scene3d_mesh = true');
    nodeFields.push('.scene3d_geometry = "sphere"');
  }
  if (rawTag === '3D.Cylinder') {
    nodeFields.push('.scene3d_mesh = true');
    nodeFields.push('.scene3d_geometry = "cylinder"');
  }
  if (rawTag === 'Physics.World') nodeFields.push('.physics_world = true');
  if (rawTag === 'Physics.Body') nodeFields.push('.physics_body = true');
  if (rawTag === 'Physics.Collider') nodeFields.push('.physics_collider = true');
  if (rawTag === 'Physics.Wall') {
    nodeFields.push('.physics_body = true');
    nodeFields.push('.physics_body_type = 0');
    nodeFields.push('.physics_collider = true');
  }
  if (rawTag === 'Physics.Ball') {
    nodeFields.push('.physics_body = true');
    nodeFields.push('.physics_body_type = 2');
    nodeFields.push('.physics_collider = true');
    nodeFields.push('.physics_shape = 1');
  }
  if (rawTag === 'Physics.Box') {
    nodeFields.push('.physics_body = true');
    nodeFields.push('.physics_body_type = 2');
    nodeFields.push('.physics_collider = true');
    nodeFields.push('.physics_shape = 0');
  }

  return {
    styleFields,
    nodeFields,
    ascriptScript: null,
    ascriptOnResult: null,
    effectiveTag: rawTag === 'ascript' ? 'Pressable' : tag,
    handlerRef: null,
  };
}
