--[[
  gl.lua -- OpenGL 2.1 FFI bindings + constants
  Loaded once via require(); cdef runs only on first load.
]]
local ffi = require("ffi")

ffi.cdef[[
  /* State */
  void glEnable(unsigned int cap);
  void glDisable(unsigned int cap);
  void glBlendFunc(unsigned int sfactor, unsigned int dfactor);
  void glColorMask(unsigned char r, unsigned char g, unsigned char b, unsigned char a);
  void glDepthMask(unsigned char flag);
  void glLineWidth(float width);
  void glPixelStorei(unsigned int pname, int param);
  void glScissor(int x, int y, int width, int height);

  /* Clear */
  void glClear(unsigned int mask);
  void glClearColor(float r, float g, float b, float a);
  void glClearStencil(int s);

  /* Viewport & matrix */
  void glViewport(int x, int y, int width, int height);
  void glMatrixMode(unsigned int mode);
  void glLoadIdentity(void);
  void glOrtho(double left, double right, double bottom, double top,
               double nearVal, double farVal);
  void glPushMatrix(void);
  void glPopMatrix(void);
  void glTranslatef(float x, float y, float z);
  void glRotatef(float angle, float x, float y, float z);
  void glScalef(float x, float y, float z);

  /* Immediate mode */
  void glBegin(unsigned int mode);
  void glEnd(void);
  void glVertex2f(float x, float y);
  void glTexCoord2f(float s, float t);
  void glColor4f(float r, float g, float b, float a);

  /* Textures */
  void glGenTextures(int n, unsigned int *textures);
  void glDeleteTextures(int n, const unsigned int *textures);
  void glBindTexture(unsigned int target, unsigned int texture);
  void glTexImage2D(unsigned int target, int level, int internalformat,
                    int width, int height, int border,
                    unsigned int format, unsigned int type, const void *data);
  void glTexParameteri(unsigned int target, int pname, int param);

  /* Stencil */
  void glStencilFunc(unsigned int func, int ref, unsigned int mask);
  void glStencilOp(unsigned int fail, unsigned int zfail, unsigned int zpass);

  unsigned int glGetError(void);
]]

local lib = ffi.load("GL")

-- Proxy table: GL.glEnable(...) → lib.glEnable(...)
-- Constants are direct fields.
local GL = setmetatable({
  -- Clear bits
  COLOR_BUFFER_BIT   = 0x4000,
  DEPTH_BUFFER_BIT   = 0x0100,
  STENCIL_BUFFER_BIT = 0x0400,
  -- Blend
  BLEND               = 0x0BE2,
  SRC_ALPHA           = 0x0302,
  ONE_MINUS_SRC_ALPHA = 0x0303,
  -- Matrix modes
  PROJECTION = 0x1701,
  MODELVIEW  = 0x1700,
  -- Primitives
  POINTS         = 0x0000,
  LINES          = 0x0001,
  LINE_LOOP      = 0x0002,
  LINE_STRIP     = 0x0003,
  TRIANGLES      = 0x0004,
  TRIANGLE_STRIP = 0x0005,
  TRIANGLE_FAN   = 0x0006,
  QUADS          = 0x0007,
  -- Textures
  TEXTURE_2D         = 0x0DE1,
  RGBA               = 0x1908,
  RGB                = 0x1907,
  ALPHA              = 0x1906,
  LUMINANCE          = 0x1909,
  UNSIGNED_BYTE      = 0x1401,
  LINEAR             = 0x2601,
  NEAREST            = 0x2600,
  TEXTURE_MIN_FILTER = 0x2801,
  TEXTURE_MAG_FILTER = 0x2800,
  TEXTURE_WRAP_S     = 0x2802,
  TEXTURE_WRAP_T     = 0x2803,
  CLAMP_TO_EDGE      = 0x812F,
  UNPACK_ALIGNMENT   = 0x0CF5,
  -- Tests
  STENCIL_TEST = 0x0B90,
  SCISSOR_TEST = 0x0C11,
  -- Stencil ops
  KEEP    = 0x1E00,
  REPLACE = 0x1E01,
  INCR    = 0x1E02,
  DECR    = 0x1E03,
  -- Stencil funcs
  NEVER   = 0x0200,
  LESS    = 0x0201,
  EQUAL   = 0x0202,
  LEQUAL  = 0x0203,
  GREATER = 0x0204,
  GEQUAL  = 0x0206,
  NOTEQUAL= 0x0205,
  ALWAYS  = 0x0207,
  -- Bool
  TRUE  = 1,
  FALSE = 0,
}, { __index = lib })

return GL
