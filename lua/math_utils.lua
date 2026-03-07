--[[
  math_utils.lua — Complete math library for ReactJIT

  ALL math computation lives here. The TS side is a single useMath() hook
  that calls math:call with {op, ...args}. LuaJIT JIT-compiles the hot paths.

  Modules: vec2, vec3, vec4, mat4, quat, geo, interp, noise, fft, bezier
  RPC: math:call (dispatcher), math:noise2d/3d, math:noisefield, math:fft/ifft, math:bezier, math:batch
]]

local M = {}
local floor, ceil, abs, sqrt, sin, cos, acos, asin, atan2, pi, exp, log, max, min =
  math.floor, math.ceil, math.abs, math.sqrt, math.sin, math.cos, math.acos, math.asin,
  math.atan2, math.pi, math.exp, math.log, math.max, math.min
local EPSILON = 1e-6

-- ============================================================================
-- Vec2
-- ============================================================================

local vec2 = {}
M.vec2 = vec2

function vec2.create(x, y) return {x or 0, y or 0} end
function vec2.zero() return {0, 0} end
function vec2.one() return {1, 1} end

function vec2.add(a, b) return {a[1]+b[1], a[2]+b[2]} end
function vec2.sub(a, b) return {a[1]-b[1], a[2]-b[2]} end
function vec2.mul(a, b) return {a[1]*b[1], a[2]*b[2]} end
function vec2.div(a, b) return {a[1]/b[1], a[2]/b[2]} end
function vec2.scale(v, s) return {v[1]*s, v[2]*s} end
function vec2.negate(v) return {-v[1], -v[2]} end

function vec2.dot(a, b) return a[1]*b[1] + a[2]*b[2] end
function vec2.cross(a, b) return a[1]*b[2] - a[2]*b[1] end

function vec2.length(v) return sqrt(v[1]*v[1] + v[2]*v[2]) end
function vec2.lengthSq(v) return v[1]*v[1] + v[2]*v[2] end

function vec2.distance(a, b)
  local dx, dy = a[1]-b[1], a[2]-b[2]
  return sqrt(dx*dx + dy*dy)
end
function vec2.distanceSq(a, b)
  local dx, dy = a[1]-b[1], a[2]-b[2]
  return dx*dx + dy*dy
end

function vec2.normalize(v)
  local len = sqrt(v[1]*v[1] + v[2]*v[2])
  if len > EPSILON then return {v[1]/len, v[2]/len} end
  return {0, 0}
end

function vec2.vabs(v) return {abs(v[1]), abs(v[2])} end
function vec2.vfloor(v) return {floor(v[1]), floor(v[2])} end
function vec2.vceil(v) return {ceil(v[1]), ceil(v[2])} end
function vec2.vround(v) return {floor(v[1]+0.5), floor(v[2]+0.5)} end

function vec2.vmin(a, b) return {min(a[1],b[1]), min(a[2],b[2])} end
function vec2.vmax(a, b) return {max(a[1],b[1]), max(a[2],b[2])} end
function vec2.clamp(v, lo, hi)
  return {max(lo[1], min(hi[1], v[1])), max(lo[2], min(hi[2], v[2]))}
end

function vec2.lerp(a, b, t)
  return {a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t}
end
function vec2.smoothstep(a, b, t)
  local s = t*t*(3 - 2*t)
  return {a[1]+(b[1]-a[1])*s, a[2]+(b[2]-a[2])*s}
end

function vec2.angle(v) return atan2(v[2], v[1]) end
function vec2.fromAngle(radians) return {cos(radians), sin(radians)} end

function vec2.rotate(v, radians)
  local c, s = cos(radians), sin(radians)
  return {v[1]*c - v[2]*s, v[1]*s + v[2]*c}
end

function vec2.equals(a, b) return a[1]==b[1] and a[2]==b[2] end
function vec2.almostEquals(a, b, eps)
  eps = eps or EPSILON
  return abs(a[1]-b[1]) < eps and abs(a[2]-b[2]) < eps
end

-- ============================================================================
-- Vec3
-- ============================================================================

local vec3 = {}
M.vec3 = vec3

function vec3.create(x, y, z) return {x or 0, y or 0, z or 0} end
function vec3.zero() return {0, 0, 0} end
function vec3.one() return {1, 1, 1} end
function vec3.up() return {0, 1, 0} end
function vec3.forward() return {0, 0, -1} end
function vec3.right() return {1, 0, 0} end

function vec3.add(a, b) return {a[1]+b[1], a[2]+b[2], a[3]+b[3]} end
function vec3.sub(a, b) return {a[1]-b[1], a[2]-b[2], a[3]-b[3]} end
function vec3.mul(a, b) return {a[1]*b[1], a[2]*b[2], a[3]*b[3]} end
function vec3.div(a, b) return {a[1]/b[1], a[2]/b[2], a[3]/b[3]} end
function vec3.scale(v, s) return {v[1]*s, v[2]*s, v[3]*s} end
function vec3.negate(v) return {-v[1], -v[2], -v[3]} end

function vec3.dot(a, b) return a[1]*b[1] + a[2]*b[2] + a[3]*b[3] end
function vec3.cross(a, b)
  return {a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1]}
end

function vec3.length(v) return sqrt(v[1]*v[1]+v[2]*v[2]+v[3]*v[3]) end
function vec3.lengthSq(v) return v[1]*v[1]+v[2]*v[2]+v[3]*v[3] end

function vec3.distance(a, b)
  local dx,dy,dz = a[1]-b[1], a[2]-b[2], a[3]-b[3]
  return sqrt(dx*dx+dy*dy+dz*dz)
end
function vec3.distanceSq(a, b)
  local dx,dy,dz = a[1]-b[1], a[2]-b[2], a[3]-b[3]
  return dx*dx+dy*dy+dz*dz
end

function vec3.normalize(v)
  local len = sqrt(v[1]*v[1]+v[2]*v[2]+v[3]*v[3])
  if len > EPSILON then return {v[1]/len, v[2]/len, v[3]/len} end
  return {0, 0, 0}
end

function vec3.vabs(v) return {abs(v[1]), abs(v[2]), abs(v[3])} end
function vec3.vfloor(v) return {floor(v[1]), floor(v[2]), floor(v[3])} end
function vec3.vceil(v) return {ceil(v[1]), ceil(v[2]), ceil(v[3])} end
function vec3.vround(v) return {floor(v[1]+0.5), floor(v[2]+0.5), floor(v[3]+0.5)} end

function vec3.vmin(a, b) return {min(a[1],b[1]), min(a[2],b[2]), min(a[3],b[3])} end
function vec3.vmax(a, b) return {max(a[1],b[1]), max(a[2],b[2]), max(a[3],b[3])} end
function vec3.clamp(v, lo, hi)
  return {max(lo[1],min(hi[1],v[1])), max(lo[2],min(hi[2],v[2])), max(lo[3],min(hi[3],v[3]))}
end

function vec3.lerp(a, b, t)
  return {a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t}
end
function vec3.smoothstep(a, b, t)
  local s = t*t*(3 - 2*t)
  return {a[1]+(b[1]-a[1])*s, a[2]+(b[2]-a[2])*s, a[3]+(b[3]-a[3])*s}
end

function vec3.reflect(v, normal)
  local d = 2 * vec3.dot(v, normal)
  return {v[1]-d*normal[1], v[2]-d*normal[2], v[3]-d*normal[3]}
end

function vec3.slerp(a, b, t)
  local d = vec3.dot(a, b)
  d = max(-1, min(1, d))
  local theta = acos(d) * t
  local rel = vec3.normalize(vec3.sub(b, vec3.scale(a, d)))
  return vec3.add(vec3.scale(a, cos(theta)), vec3.scale(rel, sin(theta)))
end

function vec3.equals(a, b) return a[1]==b[1] and a[2]==b[2] and a[3]==b[3] end
function vec3.almostEquals(a, b, eps)
  eps = eps or EPSILON
  return abs(a[1]-b[1])<eps and abs(a[2]-b[2])<eps and abs(a[3]-b[3])<eps
end

-- ============================================================================
-- Vec4
-- ============================================================================

local vec4 = {}
M.vec4 = vec4

function vec4.create(x, y, z, w) return {x or 0, y or 0, z or 0, w or 0} end
function vec4.zero() return {0, 0, 0, 0} end
function vec4.one() return {1, 1, 1, 1} end

function vec4.add(a, b) return {a[1]+b[1], a[2]+b[2], a[3]+b[3], a[4]+b[4]} end
function vec4.sub(a, b) return {a[1]-b[1], a[2]-b[2], a[3]-b[3], a[4]-b[4]} end
function vec4.mul(a, b) return {a[1]*b[1], a[2]*b[2], a[3]*b[3], a[4]*b[4]} end
function vec4.div(a, b) return {a[1]/b[1], a[2]/b[2], a[3]/b[3], a[4]/b[4]} end
function vec4.scale(v, s) return {v[1]*s, v[2]*s, v[3]*s, v[4]*s} end
function vec4.negate(v) return {-v[1], -v[2], -v[3], -v[4]} end

function vec4.dot(a, b) return a[1]*b[1]+a[2]*b[2]+a[3]*b[3]+a[4]*b[4] end
function vec4.length(v) return sqrt(v[1]*v[1]+v[2]*v[2]+v[3]*v[3]+v[4]*v[4]) end
function vec4.lengthSq(v) return v[1]*v[1]+v[2]*v[2]+v[3]*v[3]+v[4]*v[4] end

function vec4.normalize(v)
  local len = sqrt(v[1]*v[1]+v[2]*v[2]+v[3]*v[3]+v[4]*v[4])
  if len > EPSILON then return {v[1]/len, v[2]/len, v[3]/len, v[4]/len} end
  return {0, 0, 0, 0}
end

function vec4.lerp(a, b, t)
  return {a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t, a[4]+(b[4]-a[4])*t}
end

function vec4.vmin(a, b) return {min(a[1],b[1]), min(a[2],b[2]), min(a[3],b[3]), min(a[4],b[4])} end
function vec4.vmax(a, b) return {max(a[1],b[1]), max(a[2],b[2]), max(a[3],b[3]), max(a[4],b[4])} end
function vec4.clamp(v, lo, hi)
  return {max(lo[1],min(hi[1],v[1])), max(lo[2],min(hi[2],v[2])),
          max(lo[3],min(hi[3],v[3])), max(lo[4],min(hi[4],v[4]))}
end

function vec4.equals(a, b) return a[1]==b[1] and a[2]==b[2] and a[3]==b[3] and a[4]==b[4] end
function vec4.almostEquals(a, b, eps)
  eps = eps or EPSILON
  return abs(a[1]-b[1])<eps and abs(a[2]-b[2])<eps and abs(a[3]-b[3])<eps and abs(a[4]-b[4])<eps
end

-- ============================================================================
-- Mat4 (column-major 16-element array, indices 1-16)
-- ============================================================================

local mat4 = {}
M.mat4 = mat4

function mat4.identity()
  return {1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1}
end

function mat4.multiply(a, b)
  return {
    a[1]*b[1]+a[2]*b[5]+a[3]*b[9]+a[4]*b[13],   a[1]*b[2]+a[2]*b[6]+a[3]*b[10]+a[4]*b[14],
    a[1]*b[3]+a[2]*b[7]+a[3]*b[11]+a[4]*b[15],   a[1]*b[4]+a[2]*b[8]+a[3]*b[12]+a[4]*b[16],
    a[5]*b[1]+a[6]*b[5]+a[7]*b[9]+a[8]*b[13],    a[5]*b[2]+a[6]*b[6]+a[7]*b[10]+a[8]*b[14],
    a[5]*b[3]+a[6]*b[7]+a[7]*b[11]+a[8]*b[15],   a[5]*b[4]+a[6]*b[8]+a[7]*b[12]+a[8]*b[16],
    a[9]*b[1]+a[10]*b[5]+a[11]*b[9]+a[12]*b[13],  a[9]*b[2]+a[10]*b[6]+a[11]*b[10]+a[12]*b[14],
    a[9]*b[3]+a[10]*b[7]+a[11]*b[11]+a[12]*b[15],  a[9]*b[4]+a[10]*b[8]+a[11]*b[12]+a[12]*b[16],
    a[13]*b[1]+a[14]*b[5]+a[15]*b[9]+a[16]*b[13], a[13]*b[2]+a[14]*b[6]+a[15]*b[10]+a[16]*b[14],
    a[13]*b[3]+a[14]*b[7]+a[15]*b[11]+a[16]*b[15], a[13]*b[4]+a[14]*b[8]+a[15]*b[12]+a[16]*b[16],
  }
end

function mat4.transpose(m)
  return {m[1],m[5],m[9],m[13], m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15], m[4],m[8],m[12],m[16]}
end

function mat4.determinant(m)
  local b0 = m[1]*m[6]-m[2]*m[5]
  local b1 = m[1]*m[7]-m[3]*m[5]
  local b2 = m[1]*m[8]-m[4]*m[5]
  local b3 = m[2]*m[7]-m[3]*m[6]
  local b4 = m[2]*m[8]-m[4]*m[6]
  local b5 = m[3]*m[8]-m[4]*m[7]
  local b6 = m[9]*m[14]-m[10]*m[13]
  local b7 = m[9]*m[15]-m[11]*m[13]
  local b8 = m[9]*m[16]-m[12]*m[13]
  local b9 = m[10]*m[15]-m[11]*m[14]
  local b10 = m[10]*m[16]-m[12]*m[14]
  local b11 = m[11]*m[16]-m[12]*m[15]
  return b0*b11 - b1*b10 + b2*b9 + b3*b8 - b4*b7 + b5*b6
end

function mat4.invert(m)
  local a0,a1,a2,a3,a4,a5,a6,a7 = m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8]
  local a8,a9,a10,a11,a12,a13,a14,a15 = m[9],m[10],m[11],m[12],m[13],m[14],m[15],m[16]
  local b0=a0*a5-a1*a4; local b1=a0*a6-a2*a4; local b2=a0*a7-a3*a4
  local b3=a1*a6-a2*a5; local b4=a1*a7-a3*a5; local b5=a2*a7-a3*a6
  local b6=a8*a13-a9*a12; local b7=a8*a14-a10*a12; local b8=a8*a15-a11*a12
  local b9=a9*a14-a10*a13; local b10=a9*a15-a11*a13; local b11=a10*a15-a11*a14
  local det = b0*b11 - b1*b10 + b2*b9 + b3*b8 - b4*b7 + b5*b6
  if abs(det) < EPSILON then return nil end
  local inv = 1/det
  return {
    (a5*b11-a6*b10+a7*b9)*inv, (-a1*b11+a2*b10-a3*b9)*inv,
    (a13*b5-a14*b4+a15*b3)*inv, (-a9*b5+a10*b4-a11*b3)*inv,
    (-a4*b11+a6*b8-a7*b7)*inv, (a0*b11-a2*b8+a3*b7)*inv,
    (-a12*b5+a14*b2-a15*b1)*inv, (a8*b5-a10*b2+a11*b1)*inv,
    (a4*b10-a5*b8+a7*b6)*inv, (-a0*b10+a1*b8-a3*b6)*inv,
    (a12*b4-a13*b2+a15*b0)*inv, (-a8*b4+a9*b2-a11*b0)*inv,
    (-a4*b9+a5*b7-a6*b6)*inv, (a0*b9-a1*b7+a2*b6)*inv,
    (-a12*b3+a13*b1-a14*b0)*inv, (a8*b3-a9*b1+a10*b0)*inv,
  }
end

function mat4.translate(m, v)
  local x,y,z = v[1],v[2],v[3]
  local out = {m[1],m[2],m[3],m[4], m[5],m[6],m[7],m[8], m[9],m[10],m[11],m[12], m[13],m[14],m[15],m[16]}
  out[4] = m[1]*x + m[2]*y + m[3]*z + m[4]
  out[8] = m[5]*x + m[6]*y + m[7]*z + m[8]
  out[12] = m[9]*x + m[10]*y + m[11]*z + m[12]
  out[16] = m[13]*x + m[14]*y + m[15]*z + m[16]
  return out
end

function mat4.scale(m, v)
  local sx,sy,sz = v[1],v[2],v[3]
  return {
    m[1]*sx, m[2]*sy, m[3]*sz, m[4],
    m[5]*sx, m[6]*sy, m[7]*sz, m[8],
    m[9]*sx, m[10]*sy, m[11]*sz, m[12],
    m[13]*sx, m[14]*sy, m[15]*sz, m[16],
  }
end

function mat4.rotateX(m, radians)
  local c,s = cos(radians), sin(radians)
  local rot = {1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1}
  return mat4.multiply(m, rot)
end

function mat4.rotateY(m, radians)
  local c,s = cos(radians), sin(radians)
  local rot = {c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1}
  return mat4.multiply(m, rot)
end

function mat4.rotateZ(m, radians)
  local c,s = cos(radians), sin(radians)
  local rot = {c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1}
  return mat4.multiply(m, rot)
end

function mat4.lookAt(eye, target, up)
  local fx,fy,fz = eye[1]-target[1], eye[2]-target[2], eye[3]-target[3]
  local len = sqrt(fx*fx+fy*fy+fz*fz)
  if len > EPSILON then fx=fx/len; fy=fy/len; fz=fz/len end
  local sx = up[2]*fz - up[3]*fy
  local sy = up[3]*fx - up[1]*fz
  local sz = up[1]*fy - up[2]*fx
  len = sqrt(sx*sx+sy*sy+sz*sz)
  if len > EPSILON then sx=sx/len; sy=sy/len; sz=sz/len end
  local ux = fy*sz - fz*sy
  local uy = fz*sx - fx*sz
  local uz = fx*sy - fy*sx
  return {
    sx, sy, sz, -(sx*eye[1]+sy*eye[2]+sz*eye[3]),
    ux, uy, uz, -(ux*eye[1]+uy*eye[2]+uz*eye[3]),
    fx, fy, fz, -(fx*eye[1]+fy*eye[2]+fz*eye[3]),
    0, 0, 0, 1,
  }
end

function mat4.perspective(fovRadians, aspect, near, far)
  local f = 1/math.tan(fovRadians/2)
  local ri = 1/(near - far)
  return {
    f/aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near+far)*ri, 2*near*far*ri,
    0, 0, -1, 0,
  }
end

function mat4.ortho(left, right, bottom, top, near, far)
  local rl = 1/(right-left)
  local tb = 1/(top-bottom)
  local nf = 1/(near-far)
  return {
    2*rl, 0, 0, -(right+left)*rl,
    0, 2*tb, 0, -(top+bottom)*tb,
    0, 0, 2*nf, (far+near)*nf,
    0, 0, 0, 1,
  }
end

function mat4.transformPoint(m, v)
  local w = m[13]*v[1]+m[14]*v[2]+m[15]*v[3]+m[16]
  local invW = abs(w) > EPSILON and 1/w or 1
  return {
    (m[1]*v[1]+m[2]*v[2]+m[3]*v[3]+m[4])*invW,
    (m[5]*v[1]+m[6]*v[2]+m[7]*v[3]+m[8])*invW,
    (m[9]*v[1]+m[10]*v[2]+m[11]*v[3]+m[12])*invW,
  }
end

function mat4.transformDirection(m, v)
  return {
    m[1]*v[1]+m[2]*v[2]+m[3]*v[3],
    m[5]*v[1]+m[6]*v[2]+m[7]*v[3],
    m[9]*v[1]+m[10]*v[2]+m[11]*v[3],
  }
end

function mat4.fromQuat(q)
  local qx,qy,qz,qw = q[1],q[2],q[3],q[4]
  local x2,y2,z2 = qx+qx, qy+qy, qz+qz
  local xx,xy,xz = qx*x2, qx*y2, qx*z2
  local yy,yz,zz = qy*y2, qy*z2, qz*z2
  local wx,wy,wz = qw*x2, qw*y2, qw*z2
  return {
    1-yy-zz, xy-wz, xz+wy, 0,
    xy+wz, 1-xx-zz, yz-wx, 0,
    xz-wy, yz+wx, 1-xx-yy, 0,
    0, 0, 0, 1,
  }
end

function mat4.fromEuler(x, y, z)
  local cx,sx = cos(x), sin(x)
  local cy,sy = cos(y), sin(y)
  local cz,sz = cos(z), sin(z)
  return {
    cy*cz, cy*sz*sx-sy*cx, cy*sz*cx+sy*sx, 0,
    sy*cz, sy*sz*sx+cy*cx, sy*sz*cx-cy*sx, 0,
    -sz, cz*sx, cz*cx, 0,
    0, 0, 0, 1,
  }
end

function mat4.decompose(m)
  local sx = sqrt(m[1]*m[1]+m[5]*m[5]+m[9]*m[9])
  local sy = sqrt(m[2]*m[2]+m[6]*m[6]+m[10]*m[10])
  local sz = sqrt(m[3]*m[3]+m[7]*m[7]+m[11]*m[11])
  local isx = sx > EPSILON and 1/sx or 0
  local isy = sy > EPSILON and 1/sy or 0
  local isz = sz > EPSILON and 1/sz or 0
  local r00,r01,r02 = m[1]*isx, m[2]*isy, m[3]*isz
  local r10,r11,r12 = m[5]*isx, m[6]*isy, m[7]*isz
  local r20,r21,r22 = m[9]*isx, m[10]*isy, m[11]*isz
  local trace = r00+r11+r22
  local qx,qy,qz,qw
  if trace > 0 then
    local s = 0.5/sqrt(trace+1)
    qw = 0.25/s; qx=(r21-r12)*s; qy=(r02-r20)*s; qz=(r10-r01)*s
  elseif r00>r11 and r00>r22 then
    local s = 2*sqrt(1+r00-r11-r22)
    qw=(r21-r12)/s; qx=0.25*s; qy=(r01+r10)/s; qz=(r02+r20)/s
  elseif r11>r22 then
    local s = 2*sqrt(1+r11-r00-r22)
    qw=(r02-r20)/s; qx=(r01+r10)/s; qy=0.25*s; qz=(r12+r21)/s
  else
    local s = 2*sqrt(1+r22-r00-r11)
    qw=(r10-r01)/s; qx=(r02+r20)/s; qy=(r12+r21)/s; qz=0.25*s
  end
  return {
    translation = {m[4], m[8], m[12]},
    rotation = {qx, qy, qz, qw},
    scale = {sx, sy, sz},
  }
end

-- ============================================================================
-- Quaternion [x, y, z, w]
-- ============================================================================

local quat = {}
M.quat = quat

function quat.identity() return {0, 0, 0, 1} end
function quat.create(x, y, z, w) return {x or 0, y or 0, z or 0, w or 1} end

function quat.multiply(a, b)
  return {
    a[4]*b[1]+a[1]*b[4]+a[2]*b[3]-a[3]*b[2],
    a[4]*b[2]-a[1]*b[3]+a[2]*b[4]+a[3]*b[1],
    a[4]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[4],
    a[4]*b[4]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],
  }
end

function quat.conjugate(q) return {-q[1], -q[2], -q[3], q[4]} end

function quat.inverse(q)
  local lenSq = q[1]*q[1]+q[2]*q[2]+q[3]*q[3]+q[4]*q[4]
  if lenSq < EPSILON then return {0,0,0,1} end
  local inv = 1/lenSq
  return {-q[1]*inv, -q[2]*inv, -q[3]*inv, q[4]*inv}
end

function quat.normalize(q)
  local len = sqrt(q[1]*q[1]+q[2]*q[2]+q[3]*q[3]+q[4]*q[4])
  if len > EPSILON then return {q[1]/len, q[2]/len, q[3]/len, q[4]/len} end
  return {0,0,0,1}
end

function quat.dot(a, b) return a[1]*b[1]+a[2]*b[2]+a[3]*b[3]+a[4]*b[4] end
function quat.length(q) return sqrt(q[1]*q[1]+q[2]*q[2]+q[3]*q[3]+q[4]*q[4]) end

function quat.fromAxisAngle(axis, radians)
  local half = radians*0.5
  local s = sin(half)
  local len = sqrt(axis[1]*axis[1]+axis[2]*axis[2]+axis[3]*axis[3])
  if len < EPSILON then return {0,0,0,1} end
  local inv = s/len
  return {axis[1]*inv, axis[2]*inv, axis[3]*inv, cos(half)}
end

function quat.fromEuler(x, y, z)
  local cx,sx = cos(x*0.5), sin(x*0.5)
  local cy,sy = cos(y*0.5), sin(y*0.5)
  local cz,sz = cos(z*0.5), sin(z*0.5)
  return {
    sx*cy*cz + cx*sy*sz,
    cx*sy*cz - sx*cy*sz,
    cx*cy*sz + sx*sy*cz,
    cx*cy*cz - sx*sy*sz,
  }
end

function quat.toEuler(q)
  local x,y,z,w = q[1],q[2],q[3],q[4]
  local sinP = 2*(w*y - z*x)
  local pitch = abs(sinP) >= 1 and (sinP > 0 and pi/2 or -pi/2) or asin(sinP)
  local yaw = atan2(2*(w*z+x*y), 1-2*(y*y+z*z))
  local roll = atan2(2*(w*x+y*z), 1-2*(x*x+y*y))
  return {roll, pitch, yaw}
end

function quat.toMat4(q)
  return mat4.fromQuat(q)
end

function quat.slerp(a, b, t)
  local d = a[1]*b[1]+a[2]*b[2]+a[3]*b[3]+a[4]*b[4]
  local bx,by,bz,bw = b[1],b[2],b[3],b[4]
  if d < 0 then d=-d; bx=-bx; by=-by; bz=-bz; bw=-bw end
  if d > 1-EPSILON then
    return quat.normalize({a[1]+(bx-a[1])*t, a[2]+(by-a[2])*t, a[3]+(bz-a[3])*t, a[4]+(bw-a[4])*t})
  end
  local theta = acos(d)
  local sinTheta = sin(theta)
  local wa = sin((1-t)*theta)/sinTheta
  local wb = sin(t*theta)/sinTheta
  return {a[1]*wa+bx*wb, a[2]*wa+by*wb, a[3]*wa+bz*wb, a[4]*wa+bw*wb}
end

function quat.rotateVec3(q, v)
  local qx,qy,qz,qw = q[1],q[2],q[3],q[4]
  local tx = 2*(qy*v[3]-qz*v[2])
  local ty = 2*(qz*v[1]-qx*v[3])
  local tz = 2*(qx*v[2]-qy*v[1])
  return {v[1]+qw*tx+qy*tz-qz*ty, v[2]+qw*ty+qz*tx-qx*tz, v[3]+qw*tz+qx*ty-qy*tx}
end

-- ============================================================================
-- Geometry (BBox2, BBox3, distance helpers)
-- ============================================================================

local geo = {}
M.geo = geo

function geo.bbox2_create(minX, minY, maxX, maxY)
  return {min={minX,minY}, max={maxX,maxY}}
end

function geo.bbox2_fromPoints(points)
  if #points == 0 then return {min={0,0}, max={0,0}} end
  local mnx,mny = 1/0, 1/0
  local mxx,mxy = -1/0, -1/0
  for i=1,#points do
    local p = points[i]
    if p[1]<mnx then mnx=p[1] end
    if p[2]<mny then mny=p[2] end
    if p[1]>mxx then mxx=p[1] end
    if p[2]>mxy then mxy=p[2] end
  end
  return {min={mnx,mny}, max={mxx,mxy}}
end

function geo.bbox2_width(b) return b.max[1]-b.min[1] end
function geo.bbox2_height(b) return b.max[2]-b.min[2] end
function geo.bbox2_center(b) return {(b.min[1]+b.max[1])/2, (b.min[2]+b.max[2])/2} end

function geo.bbox2_containsPoint(b, p)
  return p[1]>=b.min[1] and p[1]<=b.max[1] and p[2]>=b.min[2] and p[2]<=b.max[2]
end

function geo.bbox2_containsBBox(outer, inner)
  return inner.min[1]>=outer.min[1] and inner.max[1]<=outer.max[1]
    and inner.min[2]>=outer.min[2] and inner.max[2]<=outer.max[2]
end

function geo.bbox2_intersects(a, b)
  return a.min[1]<=b.max[1] and a.max[1]>=b.min[1]
    and a.min[2]<=b.max[2] and a.max[2]>=b.min[2]
end

function geo.bbox2_intersection(a, b)
  local mnx = max(a.min[1], b.min[1])
  local mny = max(a.min[2], b.min[2])
  local mxx = min(a.max[1], b.max[1])
  local mxy = min(a.max[2], b.max[2])
  if mnx>mxx or mny>mxy then return nil end
  return {min={mnx,mny}, max={mxx,mxy}}
end

function geo.bbox2_union(a, b)
  return {
    min={min(a.min[1],b.min[1]), min(a.min[2],b.min[2])},
    max={max(a.max[1],b.max[1]), max(a.max[2],b.max[2])},
  }
end

function geo.bbox2_expand(b, amount)
  return {
    min={b.min[1]-amount, b.min[2]-amount},
    max={b.max[1]+amount, b.max[2]+amount},
  }
end

function geo.bbox3_create(mnx, mny, mnz, mxx, mxy, mxz)
  return {min={mnx,mny,mnz}, max={mxx,mxy,mxz}}
end

function geo.bbox3_fromPoints(points)
  if #points == 0 then return {min={0,0,0}, max={0,0,0}} end
  local mnx,mny,mnz = 1/0, 1/0, 1/0
  local mxx,mxy,mxz = -1/0, -1/0, -1/0
  for i=1,#points do
    local p = points[i]
    if p[1]<mnx then mnx=p[1] end
    if p[2]<mny then mny=p[2] end
    if p[3]<mnz then mnz=p[3] end
    if p[1]>mxx then mxx=p[1] end
    if p[2]>mxy then mxy=p[2] end
    if p[3]>mxz then mxz=p[3] end
  end
  return {min={mnx,mny,mnz}, max={mxx,mxy,mxz}}
end

function geo.bbox3_containsPoint(b, p)
  return p[1]>=b.min[1] and p[1]<=b.max[1]
    and p[2]>=b.min[2] and p[2]<=b.max[2]
    and p[3]>=b.min[3] and p[3]<=b.max[3]
end

function geo.bbox3_intersects(a, b)
  return a.min[1]<=b.max[1] and a.max[1]>=b.min[1]
    and a.min[2]<=b.max[2] and a.max[2]>=b.min[2]
    and a.min[3]<=b.max[3] and a.max[3]>=b.min[3]
end

function geo.bbox3_union(a, b)
  return {
    min={min(a.min[1],b.min[1]), min(a.min[2],b.min[2]), min(a.min[3],b.min[3])},
    max={max(a.max[1],b.max[1]), max(a.max[2],b.max[2]), max(a.max[3],b.max[3])},
  }
end

function geo.bbox3_expand(b, amount)
  return {
    min={b.min[1]-amount, b.min[2]-amount, b.min[3]-amount},
    max={b.max[1]+amount, b.max[2]+amount, b.max[3]+amount},
  }
end

function geo.distancePointToSegment(point, a, b)
  local dx,dy = b[1]-a[1], b[2]-a[2]
  local lenSq = dx*dx + dy*dy
  if lenSq == 0 then
    local px,py = point[1]-a[1], point[2]-a[2]
    return sqrt(px*px+py*py)
  end
  local t = ((point[1]-a[1])*dx + (point[2]-a[2])*dy) / lenSq
  t = max(0, min(1, t))
  local px = point[1] - (a[1]+t*dx)
  local py = point[2] - (a[2]+t*dy)
  return sqrt(px*px+py*py)
end

function geo.distancePointToRect(point, rect)
  local cx = max(rect.min[1], min(rect.max[1], point[1]))
  local cy = max(rect.min[2], min(rect.max[2], point[2]))
  local dx,dy = point[1]-cx, point[2]-cy
  return sqrt(dx*dx+dy*dy)
end

function geo.circleContainsPoint(center, radius, point)
  local dx,dy = point[1]-center[1], point[2]-center[2]
  return dx*dx+dy*dy <= radius*radius
end

function geo.circleIntersectsRect(center, radius, rect)
  return geo.distancePointToRect(center, rect) <= radius
end

function geo.lineIntersection(a1, a2, b1, b2)
  local d1x,d1y = a2[1]-a1[1], a2[2]-a1[2]
  local d2x,d2y = b2[1]-b1[1], b2[2]-b1[2]
  local cr = d1x*d2y - d1y*d2x
  if abs(cr) < 1e-10 then return nil end
  local dx,dy = b1[1]-a1[1], b1[2]-a1[2]
  local t = (dx*d2y - dy*d2x) / cr
  local u = (dx*d1y - dy*d1x) / cr
  if t<0 or t>1 or u<0 or u>1 then return nil end
  return {a1[1]+t*d1x, a1[2]+t*d1y}
end

-- ============================================================================
-- Interpolation
-- ============================================================================

local interp = {}
M.interp = interp

function interp.lerp(a, b, t) return a+(b-a)*t end

function interp.inverseLerp(a, b, value)
  if a==b then return 0 end
  return (value-a)/(b-a)
end

function interp.smoothstep(edge0, edge1, x)
  local t = max(0, min(1, (x-edge0)/(edge1-edge0)))
  return t*t*(3-2*t)
end

function interp.smootherstep(edge0, edge1, x)
  local t = max(0, min(1, (x-edge0)/(edge1-edge0)))
  return t*t*t*(t*(t*6-15)+10)
end

function interp.remap(value, inMin, inMax, outMin, outMax)
  return outMin + (outMax-outMin) * ((value-inMin)/(inMax-inMin))
end

function interp.clamp(value, lo, hi) return max(lo, min(hi, value)) end

function interp.wrap(value, lo, hi)
  local range = hi-lo
  if range == 0 then return lo end
  return lo + (((value-lo) % range) + range) % range
end

function interp.damp(a, b, smoothing, dt)
  return interp.lerp(a, b, 1-exp(-smoothing*dt))
end

function interp.step(edge, x) return x < edge and 0 or 1 end

function interp.pingPong(value, length)
  local t = interp.wrap(value, 0, length*2)
  return length - abs(t-length)
end

function interp.moveTowards(current, target, maxDelta)
  local diff = target-current
  if abs(diff) <= maxDelta then return target end
  return current + (diff > 0 and maxDelta or -maxDelta)
end

function interp.moveTowardsAngle(current, target, maxDelta)
  local diff = target-current
  while diff > pi do diff = diff - pi*2 end
  while diff < -pi do diff = diff + pi*2 end
  if abs(diff) <= maxDelta then return target end
  return current + (diff > 0 and maxDelta or -maxDelta)
end

function interp.smoothDamp(current, target, velocity, smoothTime, dt, maxSpeed)
  maxSpeed = maxSpeed or (1/0)
  local omega = 2/max(0.0001, smoothTime)
  local x = omega*dt
  local e = 1/(1+x+0.48*x*x+0.235*x*x*x)
  local change = current-target
  local maxChange = maxSpeed*smoothTime
  change = max(-maxChange, min(maxChange, change))
  local adjustedTarget = current-change
  local temp = (velocity+omega*change)*dt
  local newVel = (velocity-omega*temp)*e
  local result = adjustedTarget + (change+temp)*e
  if (target-current > 0) == (result > target) then
    result = target
    newVel = (result-target)/dt
  end
  return result, newVel
end

-- ============================================================================
-- Perlin Noise (classic gradient noise)
-- ============================================================================

local perm = {
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
  200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
  207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
  81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  254,157,115,66,180,156,126,1,20,69,173,92,52,28,56,233,
  127,236,243,215,128,205,184,176,195,204,138,222,121,114,67,29,
}

local p = {}
for i = 0, 255 do p[i] = perm[i + 1] end
for i = 256, 511 do p[i] = p[i - 256] end

local function grad2d(hash, x, y)
  local h = hash % 8
  if h == 0 then return  x + y end
  if h == 1 then return -x + y end
  if h == 2 then return  x - y end
  if h == 3 then return -x - y end
  if h == 4 then return  x     end
  if h == 5 then return -x     end
  if h == 6 then return      y end
  return -y
end

local function grad3d(hash, x, y, z)
  local h = hash % 12
  if h == 0  then return  x + y     end
  if h == 1  then return -x + y     end
  if h == 2  then return  x - y     end
  if h == 3  then return -x - y     end
  if h == 4  then return  x     + z end
  if h == 5  then return -x     + z end
  if h == 6  then return  x     - z end
  if h == 7  then return -x     - z end
  if h == 8  then return      y + z end
  if h == 9  then return     -y + z end
  if h == 10 then return      y - z end
  return -y - z
end

local function fade(t)
  return t * t * t * (t * (t * 6 - 15) + 10)
end

function M.noise2d(x, y, seed)
  seed = seed or 0
  x = x + seed * 31.7
  y = y + seed * 17.3
  local xi = floor(x) % 256
  local yi = floor(y) % 256
  local xf = x - floor(x)
  local yf = y - floor(y)
  local u = fade(xf)
  local v = fade(yf)
  local aa = p[p[xi] + yi]
  local ab = p[p[xi] + yi + 1]
  local ba = p[p[xi + 1] + yi]
  local bb = p[p[xi + 1] + yi + 1]
  local x1 = grad2d(aa, xf, yf) + (grad2d(ba, xf - 1, yf) - grad2d(aa, xf, yf)) * u
  local x2 = grad2d(ab, xf, yf - 1) + (grad2d(bb, xf - 1, yf - 1) - grad2d(ab, xf, yf - 1)) * u
  return x1 + (x2 - x1) * v
end

function M.noise3d(x, y, z, seed)
  seed = seed or 0
  x = x + seed * 31.7
  y = y + seed * 17.3
  z = z + seed * 23.1
  local xi = floor(x) % 256
  local yi = floor(y) % 256
  local zi = floor(z) % 256
  local xf = x - floor(x)
  local yf = y - floor(y)
  local zf = z - floor(z)
  local u = fade(xf)
  local v = fade(yf)
  local w = fade(zf)
  local aaa = p[p[p[xi]+yi]+zi]
  local aba = p[p[p[xi]+yi+1]+zi]
  local aab = p[p[p[xi]+yi]+zi+1]
  local abb = p[p[p[xi]+yi+1]+zi+1]
  local baa = p[p[p[xi+1]+yi]+zi]
  local bba = p[p[p[xi+1]+yi+1]+zi]
  local bab = p[p[p[xi+1]+yi]+zi+1]
  local bbb = p[p[p[xi+1]+yi+1]+zi+1]
  local x1 = grad3d(aaa,xf,yf,zf) + (grad3d(baa,xf-1,yf,zf)-grad3d(aaa,xf,yf,zf))*u
  local x2 = grad3d(aba,xf,yf-1,zf) + (grad3d(bba,xf-1,yf-1,zf)-grad3d(aba,xf,yf-1,zf))*u
  local y1 = x1 + (x2-x1)*v
  x1 = grad3d(aab,xf,yf,zf-1) + (grad3d(bab,xf-1,yf,zf-1)-grad3d(aab,xf,yf,zf-1))*u
  x2 = grad3d(abb,xf,yf-1,zf-1) + (grad3d(bbb,xf-1,yf-1,zf-1)-grad3d(abb,xf,yf-1,zf-1))*u
  local y2 = x1 + (x2-x1)*v
  return y1 + (y2-y1)*w
end

function M.fbm2d(x, y, octaves, seed, lacunarity, persistence)
  octaves = octaves or 4
  seed = seed or 0
  lacunarity = lacunarity or 2.0
  persistence = persistence or 0.5
  local total, amplitude, frequency, maxValue = 0, 1, 1, 0
  for _ = 1, octaves do
    total = total + M.noise2d(x*frequency, y*frequency, seed)*amplitude
    maxValue = maxValue + amplitude
    amplitude = amplitude * persistence
    frequency = frequency * lacunarity
  end
  return total / maxValue
end

function M.fbm3d(x, y, z, octaves, seed, lacunarity, persistence)
  octaves = octaves or 4
  seed = seed or 0
  lacunarity = lacunarity or 2.0
  persistence = persistence or 0.5
  local total, amplitude, frequency, maxValue = 0, 1, 1, 0
  for _ = 1, octaves do
    total = total + M.noise3d(x*frequency, y*frequency, z*frequency, seed)*amplitude
    maxValue = maxValue + amplitude
    amplitude = amplitude * persistence
    frequency = frequency * lacunarity
  end
  return total / maxValue
end

-- ============================================================================
-- FFT (Cooley-Tukey radix-2 DIT)
-- ============================================================================

function M.fft(samples)
  local n = #samples
  local size = 1
  while size < n do size = size * 2 end
  local re, im = {}, {}
  for i = 1, size do re[i] = samples[i] or 0; im[i] = 0 end
  local j = 1
  for i = 1, size do
    if i < j then re[i],re[j] = re[j],re[i]; im[i],im[j] = im[j],im[i] end
    local m = size/2
    while m >= 1 and j > m do j=j-m; m=m/2 end
    j = j+m
  end
  local step = 1
  while step < size do
    local halfStep = step
    step = step*2
    local angle = -pi/halfStep
    local wRe,wIm = cos(angle), sin(angle)
    for k = 1, size, step do
      local tRe,tIm = 1, 0
      for m = 0, halfStep-1 do
        local i1 = k+m; local i2 = i1+halfStep
        local uRe = re[i2]*tRe - im[i2]*tIm
        local uIm = re[i2]*tIm + im[i2]*tRe
        re[i2] = re[i1]-uRe; im[i2] = im[i1]-uIm
        re[i1] = re[i1]+uRe; im[i1] = im[i1]+uIm
        local newT = tRe*wRe - tIm*wIm
        tIm = tRe*wIm + tIm*wRe; tRe = newT
      end
    end
  end
  local mag = {}
  local halfSize = size/2
  for i = 1, halfSize do mag[i] = sqrt(re[i]*re[i]+im[i]*im[i])/size end
  return mag
end

function M.ifft(realParts, imagParts)
  local n = #realParts
  local re, im = {}, {}
  for i = 1, n do re[i]=realParts[i]; im[i]=-(imagParts[i] or 0) end
  local j = 1
  for i = 1, n do
    if i < j then re[i],re[j] = re[j],re[i]; im[i],im[j] = im[j],im[i] end
    local m = n/2
    while m >= 1 and j > m do j=j-m; m=m/2 end
    j = j+m
  end
  local step = 1
  while step < n do
    local halfStep = step; step = step*2
    local angle = -pi/halfStep
    local wRe,wIm = cos(angle), sin(angle)
    for k = 1, n, step do
      local tRe,tIm = 1, 0
      for m = 0, halfStep-1 do
        local i1 = k+m; local i2 = i1+halfStep
        local uRe = re[i2]*tRe - im[i2]*tIm
        local uIm = re[i2]*tIm + im[i2]*tRe
        re[i2]=re[i1]-uRe; im[i2]=im[i1]-uIm
        re[i1]=re[i1]+uRe; im[i1]=im[i1]+uIm
        local newT = tRe*wRe - tIm*wIm
        tIm = tRe*wIm + tIm*wRe; tRe = newT
      end
    end
  end
  local result = {}
  for i = 1, n do result[i] = re[i]/n end
  return result
end

-- ============================================================================
-- Bezier Curve Evaluation
-- ============================================================================

function M.bezier(points, segments)
  local n = #points
  if n < 2 then return points end
  segments = segments or 32
  local result = {}
  for i = 0, segments do
    local t = i/segments
    local work = {}
    for j = 1, n do work[j] = {points[j][1], points[j][2]} end
    for level = n-1, 1, -1 do
      for j = 1, level do
        work[j][1] = work[j][1] + (work[j+1][1]-work[j][1])*t
        work[j][2] = work[j][2] + (work[j+1][2]-work[j][2])*t
      end
    end
    result[#result+1] = {work[1][1], work[1][2]}
  end
  return result
end

-- ============================================================================
-- math:call dispatcher — single RPC endpoint for ALL math operations
-- ============================================================================

local ops = {}

-- Vec2 ops
ops["vec2.create"]       = function(a) return vec2.create(a.x, a.y) end
ops["vec2.zero"]         = function() return vec2.zero() end
ops["vec2.one"]          = function() return vec2.one() end
ops["vec2.add"]          = function(a) return vec2.add(a.a, a.b) end
ops["vec2.sub"]          = function(a) return vec2.sub(a.a, a.b) end
ops["vec2.mul"]          = function(a) return vec2.mul(a.a, a.b) end
ops["vec2.div"]          = function(a) return vec2.div(a.a, a.b) end
ops["vec2.scale"]        = function(a) return vec2.scale(a.v, a.s) end
ops["vec2.negate"]       = function(a) return vec2.negate(a.v) end
ops["vec2.dot"]          = function(a) return vec2.dot(a.a, a.b) end
ops["vec2.cross"]        = function(a) return vec2.cross(a.a, a.b) end
ops["vec2.length"]       = function(a) return vec2.length(a.v) end
ops["vec2.lengthSq"]     = function(a) return vec2.lengthSq(a.v) end
ops["vec2.distance"]     = function(a) return vec2.distance(a.a, a.b) end
ops["vec2.distanceSq"]   = function(a) return vec2.distanceSq(a.a, a.b) end
ops["vec2.normalize"]    = function(a) return vec2.normalize(a.v) end
ops["vec2.abs"]          = function(a) return vec2.vabs(a.v) end
ops["vec2.floor"]        = function(a) return vec2.vfloor(a.v) end
ops["vec2.ceil"]         = function(a) return vec2.vceil(a.v) end
ops["vec2.round"]        = function(a) return vec2.vround(a.v) end
ops["vec2.min"]          = function(a) return vec2.vmin(a.a, a.b) end
ops["vec2.max"]          = function(a) return vec2.vmax(a.a, a.b) end
ops["vec2.clamp"]        = function(a) return vec2.clamp(a.v, a.lo, a.hi) end
ops["vec2.lerp"]         = function(a) return vec2.lerp(a.a, a.b, a.t) end
ops["vec2.smoothstep"]   = function(a) return vec2.smoothstep(a.a, a.b, a.t) end
ops["vec2.angle"]        = function(a) return vec2.angle(a.v) end
ops["vec2.fromAngle"]    = function(a) return vec2.fromAngle(a.radians) end
ops["vec2.rotate"]       = function(a) return vec2.rotate(a.v, a.radians) end
ops["vec2.equals"]       = function(a) return vec2.equals(a.a, a.b) end
ops["vec2.almostEquals"] = function(a) return vec2.almostEquals(a.a, a.b, a.epsilon) end

-- Vec3 ops
ops["vec3.create"]       = function(a) return vec3.create(a.x, a.y, a.z) end
ops["vec3.zero"]         = function() return vec3.zero() end
ops["vec3.one"]          = function() return vec3.one() end
ops["vec3.up"]           = function() return vec3.up() end
ops["vec3.forward"]      = function() return vec3.forward() end
ops["vec3.right"]        = function() return vec3.right() end
ops["vec3.add"]          = function(a) return vec3.add(a.a, a.b) end
ops["vec3.sub"]          = function(a) return vec3.sub(a.a, a.b) end
ops["vec3.mul"]          = function(a) return vec3.mul(a.a, a.b) end
ops["vec3.div"]          = function(a) return vec3.div(a.a, a.b) end
ops["vec3.scale"]        = function(a) return vec3.scale(a.v, a.s) end
ops["vec3.negate"]       = function(a) return vec3.negate(a.v) end
ops["vec3.dot"]          = function(a) return vec3.dot(a.a, a.b) end
ops["vec3.cross"]        = function(a) return vec3.cross(a.a, a.b) end
ops["vec3.length"]       = function(a) return vec3.length(a.v) end
ops["vec3.lengthSq"]     = function(a) return vec3.lengthSq(a.v) end
ops["vec3.distance"]     = function(a) return vec3.distance(a.a, a.b) end
ops["vec3.distanceSq"]   = function(a) return vec3.distanceSq(a.a, a.b) end
ops["vec3.normalize"]    = function(a) return vec3.normalize(a.v) end
ops["vec3.abs"]          = function(a) return vec3.vabs(a.v) end
ops["vec3.floor"]        = function(a) return vec3.vfloor(a.v) end
ops["vec3.ceil"]         = function(a) return vec3.vceil(a.v) end
ops["vec3.round"]        = function(a) return vec3.vround(a.v) end
ops["vec3.min"]          = function(a) return vec3.vmin(a.a, a.b) end
ops["vec3.max"]          = function(a) return vec3.vmax(a.a, a.b) end
ops["vec3.clamp"]        = function(a) return vec3.clamp(a.v, a.lo, a.hi) end
ops["vec3.lerp"]         = function(a) return vec3.lerp(a.a, a.b, a.t) end
ops["vec3.smoothstep"]   = function(a) return vec3.smoothstep(a.a, a.b, a.t) end
ops["vec3.reflect"]      = function(a) return vec3.reflect(a.v, a.normal) end
ops["vec3.slerp"]        = function(a) return vec3.slerp(a.a, a.b, a.t) end
ops["vec3.equals"]       = function(a) return vec3.equals(a.a, a.b) end
ops["vec3.almostEquals"] = function(a) return vec3.almostEquals(a.a, a.b, a.epsilon) end

-- Vec4 ops
ops["vec4.create"]       = function(a) return vec4.create(a.x, a.y, a.z, a.w) end
ops["vec4.zero"]         = function() return vec4.zero() end
ops["vec4.one"]          = function() return vec4.one() end
ops["vec4.add"]          = function(a) return vec4.add(a.a, a.b) end
ops["vec4.sub"]          = function(a) return vec4.sub(a.a, a.b) end
ops["vec4.mul"]          = function(a) return vec4.mul(a.a, a.b) end
ops["vec4.div"]          = function(a) return vec4.div(a.a, a.b) end
ops["vec4.scale"]        = function(a) return vec4.scale(a.v, a.s) end
ops["vec4.negate"]       = function(a) return vec4.negate(a.v) end
ops["vec4.dot"]          = function(a) return vec4.dot(a.a, a.b) end
ops["vec4.length"]       = function(a) return vec4.length(a.v) end
ops["vec4.lengthSq"]     = function(a) return vec4.lengthSq(a.v) end
ops["vec4.normalize"]    = function(a) return vec4.normalize(a.v) end
ops["vec4.lerp"]         = function(a) return vec4.lerp(a.a, a.b, a.t) end
ops["vec4.min"]          = function(a) return vec4.vmin(a.a, a.b) end
ops["vec4.max"]          = function(a) return vec4.vmax(a.a, a.b) end
ops["vec4.clamp"]        = function(a) return vec4.clamp(a.v, a.lo, a.hi) end
ops["vec4.equals"]       = function(a) return vec4.equals(a.a, a.b) end
ops["vec4.almostEquals"] = function(a) return vec4.almostEquals(a.a, a.b, a.epsilon) end

-- Mat4 ops
ops["mat4.identity"]          = function() return mat4.identity() end
ops["mat4.multiply"]          = function(a) return mat4.multiply(a.a, a.b) end
ops["mat4.transpose"]         = function(a) return mat4.transpose(a.m) end
ops["mat4.determinant"]       = function(a) return mat4.determinant(a.m) end
ops["mat4.invert"]            = function(a) return mat4.invert(a.m) end
ops["mat4.translate"]         = function(a) return mat4.translate(a.m, a.v) end
ops["mat4.scale"]             = function(a) return mat4.scale(a.m, a.v) end
ops["mat4.rotateX"]           = function(a) return mat4.rotateX(a.m, a.radians) end
ops["mat4.rotateY"]           = function(a) return mat4.rotateY(a.m, a.radians) end
ops["mat4.rotateZ"]           = function(a) return mat4.rotateZ(a.m, a.radians) end
ops["mat4.lookAt"]            = function(a) return mat4.lookAt(a.eye, a.target, a.up) end
ops["mat4.perspective"]       = function(a) return mat4.perspective(a.fov, a.aspect, a.near, a.far) end
ops["mat4.ortho"]             = function(a) return mat4.ortho(a.left, a.right, a.bottom, a.top, a.near, a.far) end
ops["mat4.transformPoint"]    = function(a) return mat4.transformPoint(a.m, a.v) end
ops["mat4.transformDirection"] = function(a) return mat4.transformDirection(a.m, a.v) end
ops["mat4.fromQuat"]          = function(a) return mat4.fromQuat(a.q) end
ops["mat4.fromEuler"]         = function(a) return mat4.fromEuler(a.x, a.y, a.z) end
ops["mat4.decompose"]         = function(a) return mat4.decompose(a.m) end

-- Quat ops
ops["quat.identity"]      = function() return quat.identity() end
ops["quat.create"]         = function(a) return quat.create(a.x, a.y, a.z, a.w) end
ops["quat.multiply"]       = function(a) return quat.multiply(a.a, a.b) end
ops["quat.conjugate"]      = function(a) return quat.conjugate(a.q) end
ops["quat.inverse"]        = function(a) return quat.inverse(a.q) end
ops["quat.normalize"]      = function(a) return quat.normalize(a.q) end
ops["quat.dot"]            = function(a) return quat.dot(a.a, a.b) end
ops["quat.length"]         = function(a) return quat.length(a.q) end
ops["quat.fromAxisAngle"]  = function(a) return quat.fromAxisAngle(a.axis, a.radians) end
ops["quat.fromEuler"]      = function(a) return quat.fromEuler(a.x, a.y, a.z) end
ops["quat.toEuler"]        = function(a) return quat.toEuler(a.q) end
ops["quat.toMat4"]         = function(a) return quat.toMat4(a.q) end
ops["quat.slerp"]          = function(a) return quat.slerp(a.a, a.b, a.t) end
ops["quat.rotateVec3"]     = function(a) return quat.rotateVec3(a.q, a.v) end

-- Geometry ops
ops["geo.bbox2_create"]         = function(a) return geo.bbox2_create(a.minX, a.minY, a.maxX, a.maxY) end
ops["geo.bbox2_fromPoints"]     = function(a) return geo.bbox2_fromPoints(a.points) end
ops["geo.bbox2_width"]          = function(a) return geo.bbox2_width(a.b) end
ops["geo.bbox2_height"]         = function(a) return geo.bbox2_height(a.b) end
ops["geo.bbox2_center"]         = function(a) return geo.bbox2_center(a.b) end
ops["geo.bbox2_containsPoint"]  = function(a) return geo.bbox2_containsPoint(a.b, a.p) end
ops["geo.bbox2_containsBBox"]   = function(a) return geo.bbox2_containsBBox(a.outer, a.inner) end
ops["geo.bbox2_intersects"]     = function(a) return geo.bbox2_intersects(a.a, a.b) end
ops["geo.bbox2_intersection"]   = function(a) return geo.bbox2_intersection(a.a, a.b) end
ops["geo.bbox2_union"]          = function(a) return geo.bbox2_union(a.a, a.b) end
ops["geo.bbox2_expand"]         = function(a) return geo.bbox2_expand(a.b, a.amount) end
ops["geo.bbox3_create"]         = function(a) return geo.bbox3_create(a.minX,a.minY,a.minZ,a.maxX,a.maxY,a.maxZ) end
ops["geo.bbox3_fromPoints"]     = function(a) return geo.bbox3_fromPoints(a.points) end
ops["geo.bbox3_containsPoint"]  = function(a) return geo.bbox3_containsPoint(a.b, a.p) end
ops["geo.bbox3_intersects"]     = function(a) return geo.bbox3_intersects(a.a, a.b) end
ops["geo.bbox3_union"]          = function(a) return geo.bbox3_union(a.a, a.b) end
ops["geo.bbox3_expand"]         = function(a) return geo.bbox3_expand(a.b, a.amount) end
ops["geo.distancePointToSegment"] = function(a) return geo.distancePointToSegment(a.point, a.a, a.b) end
ops["geo.distancePointToRect"]  = function(a) return geo.distancePointToRect(a.point, a.rect) end
ops["geo.circleContainsPoint"]  = function(a) return geo.circleContainsPoint(a.center, a.radius, a.point) end
ops["geo.circleIntersectsRect"] = function(a) return geo.circleIntersectsRect(a.center, a.radius, a.rect) end
ops["geo.lineIntersection"]     = function(a) return geo.lineIntersection(a.a1, a.a2, a.b1, a.b2) end

-- Interpolation ops
ops["interp.lerp"]             = function(a) return interp.lerp(a.a, a.b, a.t) end
ops["interp.inverseLerp"]      = function(a) return interp.inverseLerp(a.a, a.b, a.value) end
ops["interp.smoothstep"]       = function(a) return interp.smoothstep(a.edge0, a.edge1, a.x) end
ops["interp.smootherstep"]     = function(a) return interp.smootherstep(a.edge0, a.edge1, a.x) end
ops["interp.remap"]            = function(a) return interp.remap(a.value, a.inMin, a.inMax, a.outMin, a.outMax) end
ops["interp.clamp"]            = function(a) return interp.clamp(a.value, a.min, a.max) end
ops["interp.wrap"]             = function(a) return interp.wrap(a.value, a.min, a.max) end
ops["interp.damp"]             = function(a) return interp.damp(a.a, a.b, a.smoothing, a.dt) end
ops["interp.step"]             = function(a) return interp.step(a.edge, a.x) end
ops["interp.pingPong"]         = function(a) return interp.pingPong(a.value, a.length) end
ops["interp.moveTowards"]      = function(a) return interp.moveTowards(a.current, a.target, a.maxDelta) end
ops["interp.moveTowardsAngle"] = function(a) return interp.moveTowardsAngle(a.current, a.target, a.maxDelta) end
ops["interp.smoothDamp"]       = function(a)
  local result, newVel = interp.smoothDamp(a.current, a.target, a.velocity, a.smoothTime, a.dt, a.maxSpeed)
  return {result = result, velocity = newVel}
end

-- Noise ops (aliased into call dispatcher)
ops["noise2d"]    = function(a)
  local oct = a.octaves
  if oct and oct > 1 then return M.fbm2d(a.x or 0, a.y or 0, oct, a.seed, a.lacunarity, a.persistence) end
  return M.noise2d(a.x or 0, a.y or 0, a.seed)
end
ops["noise3d"]    = function(a)
  local oct = a.octaves
  if oct and oct > 1 then return M.fbm3d(a.x or 0, a.y or 0, a.z or 0, oct, a.seed, a.lacunarity, a.persistence) end
  return M.noise3d(a.x or 0, a.y or 0, a.z or 0, a.seed)
end
ops["noisefield"] = function(a)
  local w = a.width or 16; local h = a.height or 16
  local ox = a.offsetX or 0; local oy = a.offsetY or 0
  local sc = a.scale or 1; local seed = a.seed or 0
  local oct = a.octaves or 4; local lac = a.lacunarity or 2.0; local per = a.persistence or 0.5
  local field = {}
  local idx = 1
  for row = 0, h-1 do
    for col = 0, w-1 do
      field[idx] = M.fbm2d((col+ox)*sc, (row+oy)*sc, oct, seed, lac, per)
      idx = idx+1
    end
  end
  return field
end
ops["fft"]  = function(a) return M.fft(a.samples or {}) end
ops["ifft"] = function(a) return M.ifft(a.real or {}, a.imag or {}) end
ops["bezier"] = function(a)
  local points = a.points or {}
  local luaPts = {}
  for i = 1, #points do
    local pt = points[i]
    if pt[1] then luaPts[i] = {pt[1], pt[2]}
    else luaPts[i] = {pt.x or 0, pt.y or 0} end
  end
  return M.bezier(luaPts, a.segments or 32)
end

-- ============================================================================
-- RPC Handler registry (backward-compat + math:call dispatcher)
-- ============================================================================

local handlers = {}

-- Unified dispatcher — all ops through one endpoint
-- Single: { op: 'vec2.add', a: [...], b: [...] }
-- Batch:  { batch: [{ op: 'vec2.add', a: [...], b: [...] }, ...] }
handlers["math:call"] = function(args)
  -- Batch mode
  if args.batch then
    local results = {}
    for i = 1, #args.batch do
      local entry = args.batch[i]
      local fn = ops[entry.op]
      if fn then results[i] = fn(entry) else results[i] = false end
    end
    return results
  end
  -- Single op mode
  local op = args.op
  if not op then return nil end
  local fn = ops[op]
  if fn then return fn(args) end
  return nil
end

-- Backward-compat handlers (existing consumers use these directly)
handlers["math:noise2d"]    = ops["noise2d"]
handlers["math:noise3d"]    = ops["noise3d"]
handlers["math:noisefield"] = ops["noisefield"]
handlers["math:fft"]        = ops["fft"]
handlers["math:ifft"]       = ops["ifft"]
handlers["math:bezier"]     = ops["bezier"]

handlers["math:batch"] = function(args)
  local batch = args.ops or {}
  local results = {}
  for i = 1, #batch do
    local entry = batch[i]
    local op = entry.op
    local opArgs = entry.args or {}
    -- Try unified ops first, then backward-compat handlers
    local fn = ops[op] or handlers[op]
    if fn then results[i] = fn(opArgs) else results[i] = nil end
  end
  return results
end

function M.getHandlers()
  return handlers
end

return M
