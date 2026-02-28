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
  void glClearDepth(double depth);

  /* Viewport & matrix */
  void glViewport(int x, int y, int width, int height);
  void glMatrixMode(unsigned int mode);
  void glLoadIdentity(void);
  void glLoadMatrixf(const float *m);
  void glMultMatrixf(const float *m);
  void glOrtho(double left, double right, double bottom, double top,
               double nearVal, double farVal);
  void glFrustum(double left, double right, double bottom, double top,
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
  void glVertex3f(float x, float y, float z);
  void glNormal3f(float nx, float ny, float nz);
  void glTexCoord2f(float s, float t);
  void glColor4f(float r, float g, float b, float a);
  void glColor3f(float r, float g, float b);
  void glPointSize(float size);

  /* Depth */
  void glDepthFunc(unsigned int func);

  /* Textures */
  void glGenTextures(int n, unsigned int *textures);
  void glDeleteTextures(int n, const unsigned int *textures);
  void glBindTexture(unsigned int target, unsigned int texture);
  void glTexImage2D(unsigned int target, int level, int internalformat,
                    int width, int height, int border,
                    unsigned int format, unsigned int type, const void *data);
  void glTexSubImage2D(unsigned int target, int level,
                       int xoffset, int yoffset, int width, int height,
                       unsigned int format, unsigned int type, const void *data);
  void glTexParameteri(unsigned int target, int pname, int param);

  /* Stencil */
  void glStencilFunc(unsigned int func, int ref, unsigned int mask);
  void glStencilOp(unsigned int fail, unsigned int zfail, unsigned int zpass);

  /* FBO (GL_EXT_framebuffer_object — core in GL 2.1 drivers) */
  void glGenFramebuffersEXT(int n, unsigned int *framebuffers);
  void glDeleteFramebuffersEXT(int n, const unsigned int *framebuffers);
  void glBindFramebufferEXT(unsigned int target, unsigned int framebuffer);
  void glFramebufferTexture2DEXT(unsigned int target, unsigned int attachment,
                                  unsigned int textarget, unsigned int texture, int level);
  void glFramebufferRenderbufferEXT(unsigned int target, unsigned int attachment,
                                     unsigned int renderbuffertarget, unsigned int renderbuffer);
  unsigned int glCheckFramebufferStatusEXT(unsigned int target);

  /* Renderbuffer (GL_EXT_framebuffer_object) */
  void glGenRenderbuffersEXT(int n, unsigned int *renderbuffers);
  void glDeleteRenderbuffersEXT(int n, const unsigned int *renderbuffers);
  void glBindRenderbufferEXT(unsigned int target, unsigned int renderbuffer);
  void glRenderbufferStorageEXT(unsigned int target, unsigned int internalformat,
                                 int width, int height);

  /* Shader program */
  unsigned int glCreateShader(unsigned int type);
  void glDeleteShader(unsigned int shader);
  void glShaderSource(unsigned int shader, int count,
                      const char **string, const int *length);
  void glCompileShader(unsigned int shader);
  void glGetShaderiv(unsigned int shader, unsigned int pname, int *params);
  void glGetShaderInfoLog(unsigned int shader, int bufSize,
                          int *length, char *infoLog);

  unsigned int glCreateProgram(void);
  void glDeleteProgram(unsigned int program);
  void glAttachShader(unsigned int program, unsigned int shader);
  void glLinkProgram(unsigned int program);
  void glUseProgram(unsigned int program);
  void glGetProgramiv(unsigned int program, unsigned int pname, int *params);
  void glGetProgramInfoLog(unsigned int program, int bufSize,
                           int *length, char *infoLog);

  int glGetUniformLocation(unsigned int program, const char *name);
  int glGetAttribLocation(unsigned int program, const char *name);

  /* Uniforms */
  void glUniform1i(int location, int v0);
  void glUniform1f(int location, float v0);
  void glUniform3f(int location, float v0, float v1, float v2);
  void glUniform4f(int location, float v0, float v1, float v2, float v3);
  void glUniformMatrix4fv(int location, int count,
                          unsigned char transpose, const float *value);

  /* Vertex attributes */
  void glEnableVertexAttribArray(unsigned int index);
  void glDisableVertexAttribArray(unsigned int index);
  void glVertexAttribPointer(unsigned int index, int size, unsigned int type,
                             unsigned char normalized, int stride, const void *pointer);

  /* VBO */
  void glGenBuffers(int n, unsigned int *buffers);
  void glDeleteBuffers(int n, const unsigned int *buffers);
  void glBindBuffer(unsigned int target, unsigned int buffer);
  void glBufferData(unsigned int target, long size,
                    const void *data, unsigned int usage);
  void glBufferSubData(unsigned int target, long offset, long size,
                       const void *data);

  /* Draw */
  void glDrawArrays(unsigned int mode, int first, int count);

  /* Fixed-function vertex arrays (GL 1.1+) */
  void glEnableClientState(unsigned int array);
  void glDisableClientState(unsigned int array);
  void glVertexPointer(int size, unsigned int type, int stride, const void *pointer);
  void glColorPointer(int size, unsigned int type, int stride, const void *pointer);
  void glTexCoordPointer(int size, unsigned int type, int stride, const void *pointer);

  /* Query */
  void glGetIntegerv(unsigned int pname, int *params);

  /* Multi-texture (GL 1.3+) */
  void glActiveTexture(unsigned int texture);

  unsigned int glGetError(void);
]]

local loader = require("lua.lib_loader")
local lib = loader.opengl()

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
  ONE                 = 0x0001,
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
  FLOAT              = 0x1406,
  LINEAR             = 0x2601,
  NEAREST            = 0x2600,
  TEXTURE_MIN_FILTER = 0x2801,
  TEXTURE_MAG_FILTER = 0x2800,
  TEXTURE_WRAP_S     = 0x2802,
  TEXTURE_WRAP_T     = 0x2803,
  CLAMP_TO_EDGE      = 0x812F,
  REPEAT             = 0x2901,
  UNPACK_ALIGNMENT   = 0x0CF5,
  -- Tests
  DEPTH_TEST   = 0x0B71,
  STENCIL_TEST = 0x0B90,
  SCISSOR_TEST = 0x0C11,
  -- Depth funcs (shared with stencil funcs)
  NEVER   = 0x0200,
  LESS    = 0x0201,
  EQUAL   = 0x0202,
  LEQUAL  = 0x0203,
  GREATER = 0x0204,
  GEQUAL  = 0x0206,
  NOTEQUAL= 0x0205,
  ALWAYS  = 0x0207,
  -- Stencil ops
  KEEP    = 0x1E00,
  REPLACE = 0x1E01,
  INCR    = 0x1E02,
  DECR    = 0x1E03,
  -- FBO
  FRAMEBUFFER_EXT         = 0x8D40,
  RENDERBUFFER_EXT        = 0x8D41,
  COLOR_ATTACHMENT0_EXT   = 0x8CE0,
  DEPTH_ATTACHMENT_EXT    = 0x8D00,
  FRAMEBUFFER_COMPLETE_EXT= 0x8CD5,
  DEPTH_COMPONENT         = 0x1902,
  DEPTH_COMPONENT16       = 0x81A5,
  DEPTH_COMPONENT24       = 0x81A6,
  -- Shader types
  VERTEX_SHADER   = 0x8B31,
  FRAGMENT_SHADER = 0x8B30,
  COMPILE_STATUS  = 0x8B81,
  LINK_STATUS     = 0x8B82,
  INFO_LOG_LENGTH = 0x8B84,
  -- Client state arrays
  VERTEX_ARRAY        = 0x8074,
  COLOR_ARRAY         = 0x8076,
  TEXTURE_COORD_ARRAY = 0x8078,
  -- VBO
  ARRAY_BUFFER  = 0x8892,
  STATIC_DRAW   = 0x88E4,
  DYNAMIC_DRAW  = 0x88E8,
  -- Multi-texture
  TEXTURE0      = 0x84C0,
  -- Query
  VIEWPORT      = 0x0BA2,
  -- Bool
  TRUE  = 1,
  FALSE = 0,
}, { __index = lib })

return GL
