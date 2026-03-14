// written by groverbuger for g3d
// MIT license
//
// Simplified for WebGL compatibility (no custom varyings).
// The full version with worldPosition/viewPosition/vertexNormal varyings
// is needed only for custom fragment shaders.

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;

attribute vec3 VertexNormal;

vec4 position(mat4 transformProjection, vec4 vertexPosition) {
    return projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
}
