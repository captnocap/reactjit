--[[
  gl.lua -- OpenGL 2.1 FFI bindings + constants
  Self-contained copy for the CartridgeOS initramfs.
]]
local ffi = require("ffi")

ffi.cdef[[
  void glEnable(unsigned int cap);
  void glDisable(unsigned int cap);
  void glBlendFunc(unsigned int sfactor, unsigned int dfactor);
  void glColorMask(unsigned char r, unsigned char g, unsigned char b, unsigned char a);
  void glDepthMask(unsigned char flag);
  void glLineWidth(float width);
  void glPixelStorei(unsigned int pname, int param);
  void glScissor(int x, int y, int width, int height);
  void glClear(unsigned int mask);
  void glClearColor(float r, float g, float b, float a);
  void glClearStencil(int s);
  void glViewport(int x, int y, int width, int height);
  void glMatrixMode(unsigned int mode);
  void glLoadIdentity(void);
  void glOrtho(double left, double right, double bottom, double top,
               double nearVal, double farVal);
  void glPushMatrix(void);
  void glPopMatrix(void);
  void glTranslatef(float x, float y, float z);
  void glBegin(unsigned int mode);
  void glEnd(void);
  void glVertex2f(float x, float y);
  void glTexCoord2f(float s, float t);
  void glColor4f(float r, float g, float b, float a);
  void glGenTextures(int n, unsigned int *textures);
  void glDeleteTextures(int n, const unsigned int *textures);
  void glBindTexture(unsigned int target, unsigned int texture);
  void glTexImage2D(unsigned int target, int level, int internalformat,
                    int width, int height, int border,
                    unsigned int format, unsigned int type, const void *data);
  void glTexParameteri(unsigned int target, int pname, int param);
  void glStencilFunc(unsigned int func, int ref, unsigned int mask);
  void glStencilOp(unsigned int fail, unsigned int zfail, unsigned int zpass);
  unsigned int glGetError(void);
]]

-- Alpine ships libGL.so.1 (versioned soname only, no dev symlink).
-- Try the unversioned name first (works on most distros), fall back to soname.
local ok, lib = pcall(ffi.load, "GL")
if not ok then lib = ffi.load("libGL.so.1") end

local GL = setmetatable({
  COLOR_BUFFER_BIT   = 0x4000,
  STENCIL_BUFFER_BIT = 0x0400,
  BLEND               = 0x0BE2,
  SRC_ALPHA           = 0x0302,
  ONE_MINUS_SRC_ALPHA = 0x0303,
  PROJECTION = 0x1701,
  MODELVIEW  = 0x1700,
  TRIANGLES      = 0x0004,
  TRIANGLE_FAN   = 0x0006,
  TRIANGLE_STRIP = 0x0005,
  QUADS          = 0x0007,
  TEXTURE_2D         = 0x0DE1,
  RGBA               = 0x1908,
  ALPHA              = 0x1906,
  UNSIGNED_BYTE      = 0x1401,
  LINEAR             = 0x2601,
  NEAREST            = 0x2600,
  TEXTURE_MIN_FILTER = 0x2801,
  TEXTURE_MAG_FILTER = 0x2800,
  TEXTURE_WRAP_S     = 0x2802,
  TEXTURE_WRAP_T     = 0x2803,
  CLAMP_TO_EDGE      = 0x812F,
  UNPACK_ALIGNMENT   = 0x0CF5,
  STENCIL_TEST = 0x0B90,
  SCISSOR_TEST = 0x0C11,
  KEEP    = 0x1E00,
  REPLACE = 0x1E01,
  ALWAYS  = 0x0207,
  EQUAL   = 0x0202,
  LEQUAL  = 0x0203,
}, { __index = lib })

return GL
