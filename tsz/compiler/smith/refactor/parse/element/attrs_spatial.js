// ── JSX subsystem spatial attr helpers ───────────────────────────

function tryParseSpatialAttr(c, attr, rawTag, styleFields, nodeFields) {
  if (attr === 'position' && (rawTag.startsWith('3D.') || rawTag === 'Scene3D')) {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'scene3d_pos', ['x', 'y', 'z'], vals);
    return true;
  }

  if (attr === 'scale' && rawTag.startsWith('3D.')) {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'scene3d_scale', ['x', 'y', 'z'], vals);
    return true;
  }

  if (attr === 'lookAt' && rawTag === '3D.Camera') {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'scene3d_look', ['x', 'y', 'z'], vals);
    return true;
  }

  if (attr === 'fov' && rawTag === '3D.Camera') {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.scene3d_fov = ${value}`);
    return true;
  }

  if (attr === 'intensity' && rawTag === '3D.Light') {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.scene3d_intensity = ${value}`);
    return true;
  }

  if (attr === 'shape' && rawTag === '3D.Mesh') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.scene3d_geometry = "${c.text().slice(1, -1)}"`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return true;
  }

  if (attr === 'at' && (rawTag.startsWith('3D.') || rawTag.startsWith('Physics.'))) {
    const vals = parseBracedVectorValues(c, false);
    if (vals) {
      if (rawTag.startsWith('Physics.')) {
        pushAxisFields(nodeFields, 'physics', ['x', 'y'], vals);
      } else {
        pushAxisFields(nodeFields, 'scene3d_pos', ['x', 'y', 'z'], vals);
      }
    }
    return true;
  }

  if (attr === 'size' && rawTag.startsWith('Physics.')) {
    const vals = parseBracedVectorValues(c, true);
    if (vals) {
      if (vals[0]) styleFields.push(`.width = ${vals[0]}`);
      if (vals[1]) styleFields.push(`.height = ${vals[1]}`);
    }
    return true;
  }

  if (attr === 'size' && rawTag.startsWith('3D.')) {
    const saved = c.save();
    const vals = parseBracedVectorValues(c, true);
    if (vals) {
      pushAxisFields(nodeFields, 'scene3d_size', ['x', 'y', 'z'], vals);
      return true;
    }
    c.restore(saved);

    const scalar = parseNumericAttrValue(c, false);
    if (scalar !== null) {
      pushUniformAxisFields(nodeFields, 'scene3d_size', ['x', 'y', 'z'], scalar);
    }
    return true;
  }

  if (attr === 'radius' && rawTag.startsWith('Physics.')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.physics_radius = ${value}`);
    return true;
  }

  if (attr === 'radius' && rawTag.startsWith('3D.')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.scene3d_radius = ${value}`);
    return true;
  }

  if (attr === 'height' && rawTag.startsWith('3D.')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.scene3d_size_y = ${value}`);
    return true;
  }

  if (attr === 'bounce' && rawTag.startsWith('Physics.')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.physics_restitution = ${value}`);
    return true;
  }

  if (attr === 'mass' && rawTag.startsWith('Physics.')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.physics_density = ${value}`);
    return true;
  }

  if (attr === 'gravity' && rawTag === 'Physics.World') {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'physics_gravity', ['x', 'y'], vals);
    return true;
  }

  if (attr === 'paused' && rawTag === 'Physics.World') {
    if (c.kind() === TK.lbrace) skipBraces(c);
    else if (c.kind() === TK.identifier) c.advance();
    return true;
  }

  if (attr === 'rotate' && rawTag.startsWith('3D.')) {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'scene3d_rot', ['x', 'y', 'z'], vals);
    return true;
  }

  if (attr === 'type' && rawTag === '3D.Light') {
    if (c.kind() === TK.string) {
      nodeFields.push(`.scene3d_light_type = "${c.text().slice(1, -1)}"`);
      c.advance();
    }
    return true;
  }

  if (attr === 'direction' && rawTag === '3D.Light') {
    const vals = parseBracedVectorValues(c, true);
    if (vals) pushAxisFields(nodeFields, 'scene3d_dir', ['x', 'y', 'z'], vals);
    return true;
  }

  return false;
}
