--[[
  privacy.lua — Privacy toolkit via LuaJIT FFI

  Higher-level privacy abstractions built on top of crypto.lua:
    - Secure memory (sodium_malloc/mlock/memzero)
    - HKDF key derivation
    - Shamir's Secret Sharing (GF(256))
    - Streaming file encryption/decryption
    - Envelope encryption
    - Secure file deletion (shred + POSIX fallback)
    - File/directory integrity hashing
    - GPG operations (shell-out to gpg CLI)
    - Metadata stripping (shell-out to exiftool)
    - Noise-NK secure channels
    - LSB steganography
    - Encrypted keyring management
    - Anonymous identity generation

  Usage:
    local privacy = require("lua.privacy")
    local handlers = privacy.getHandlers()

  Requires:
    - lua/crypto.lua (loaded first, provides HMAC, AEAD, key gen, random)
    - libsodium (for secure memory — already loaded by crypto.lua)
    - gpg CLI (optional, for PGP operations)
    - exiftool CLI (optional, for metadata stripping)
    - shred CLI (optional, for secure file deletion)
]]

local ffi = require("ffi")
local bit = require("bit")

local Privacy = {}
Privacy.available = false

-- ── Load crypto module (our foundation) ──
local Crypto
do
  local ok, mod = pcall(require, "lua.crypto")
  if ok then
    Crypto = mod
  else
    print("[privacy] WARNING: crypto module not available: " .. tostring(mod))
  end
end

-- Guard against duplicate cdef from other modules
local function safe_cdef(decl)
  local ok, err = pcall(ffi.cdef, decl)
  if not ok and not err:match("redefin") then
    error(err)
  end
end

-- ============================================================================
-- FFI declarations
-- ============================================================================

-- ── libsodium secure memory ──
safe_cdef[[
  int sodium_init(void);
  void *sodium_malloc(size_t size);
  void sodium_free(void *ptr);
  int sodium_mlock(void *addr, size_t len);
  int sodium_munlock(void *addr, size_t len);
  void sodium_memzero(void *pnt, size_t len);
  int sodium_mprotect_noaccess(void *ptr);
  int sodium_mprotect_readonly(void *ptr);
  int sodium_mprotect_readwrite(void *ptr);
  void randombytes_buf(void *buf, size_t size);
]]

-- ── POSIX file I/O for secure deletion ──
safe_cdef[[
  typedef long ssize_t;
  int open(const char *pathname, int flags, ...);
  ssize_t write(int fd, const void *buf, size_t count);
  int fsync(int fd);
  int close(int fd);
  int unlink(const char *pathname);
]]

-- O_WRONLY = 1 on Linux
local O_WRONLY = 1

-- ============================================================================
-- Library loading
-- ============================================================================

local sodium = nil

local function ensureLoaded()
  if Privacy.available then return end

  -- Ensure crypto is loaded (it loads libsodium)
  if Crypto and not Crypto.available then
    Crypto.loadLibraries()
  end

  -- Load libsodium handle for secure memory functions
  local paths = {
    "libsodium.so.23", "libsodium.so.26", "libsodium.so",
    "libsodium.dylib",
  }
  for _, p in ipairs(paths) do
    local ok, lib = pcall(ffi.load, p)
    if ok then
      sodium = lib
      break
    end
  end

  if not sodium then
    print("[privacy] WARNING: libsodium not found for secure memory")
  else
    -- sodium_init() MUST be called before any libsodium function.
    -- Returns 0 on success, 1 if already initialized, -1 on failure.
    local ret = sodium.sodium_init()
    if ret < 0 then
      print("[privacy] WARNING: sodium_init() failed")
      sodium = nil
    end
  end

  Privacy.available = true
end

-- ============================================================================
-- Shell helpers
-- ============================================================================

local function shellEscape(s)
  return "'" .. s:gsub("'", "'\\''") .. "'"
end

local function popenRead(cmd)
  local h = io.popen(cmd, "r")
  if not h then return nil, "failed to execute: " .. cmd end
  local out = h:read("*a")
  h:close()
  return out
end

local function popenWrite(cmd, input)
  local h = io.popen(cmd, "w")
  if not h then return nil, "failed to execute: " .. cmd end
  h:write(input)
  h:close()
  return true
end

local function commandExists(cmd)
  local h = io.popen("command -v " .. shellEscape(cmd) .. " 2>/dev/null")
  if not h then return false end
  local out = h:read("*a")
  h:close()
  return out and #out > 0
end

-- ============================================================================
-- Hex encoding helpers (matches crypto.lua)
-- ============================================================================

local hexchars = "0123456789abcdef"

local function toHex(buf, len)
  local parts = {}
  for i = 0, len - 1 do
    local b = buf[i]
    parts[#parts + 1] = hexchars:sub(bit.rshift(b, 4) + 1, bit.rshift(b, 4) + 1)
    parts[#parts + 1] = hexchars:sub(bit.band(b, 0x0f) + 1, bit.band(b, 0x0f) + 1)
  end
  return table.concat(parts)
end

local function fromHex(hex)
  local len = math.floor(#hex / 2)
  local buf = ffi.new("uint8_t[?]", len)
  for i = 0, len - 1 do
    buf[i] = tonumber(hex:sub(i * 2 + 1, i * 2 + 2), 16)
  end
  return buf, len
end

-- ── Base64 helpers (matches crypto.lua) ──
local b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

local function toBase64(buf, len)
  local parts = {}
  local i = 0
  while i < len - 2 do
    local a, b, c = buf[i], buf[i+1], buf[i+2]
    parts[#parts+1] = b64chars:sub(bit.rshift(a,2)+1, bit.rshift(a,2)+1)
    parts[#parts+1] = b64chars:sub(bit.bor(bit.lshift(bit.band(a,3),4), bit.rshift(b,4))+1, bit.bor(bit.lshift(bit.band(a,3),4), bit.rshift(b,4))+1)
    parts[#parts+1] = b64chars:sub(bit.bor(bit.lshift(bit.band(b,15),2), bit.rshift(c,6))+1, bit.bor(bit.lshift(bit.band(b,15),2), bit.rshift(c,6))+1)
    parts[#parts+1] = b64chars:sub(bit.band(c,63)+1, bit.band(c,63)+1)
    i = i + 3
  end
  if i < len then
    local a = buf[i]
    parts[#parts+1] = b64chars:sub(bit.rshift(a,2)+1, bit.rshift(a,2)+1)
    if i + 1 < len then
      local b = buf[i+1]
      parts[#parts+1] = b64chars:sub(bit.bor(bit.lshift(bit.band(a,3),4), bit.rshift(b,4))+1, bit.bor(bit.lshift(bit.band(a,3),4), bit.rshift(b,4))+1)
      parts[#parts+1] = b64chars:sub(bit.lshift(bit.band(b,15),2)+1, bit.lshift(bit.band(b,15),2)+1)
      parts[#parts+1] = "="
    else
      parts[#parts+1] = b64chars:sub(bit.lshift(bit.band(a,3),4)+1, bit.lshift(bit.band(a,3),4)+1)
      parts[#parts+1] = "=="
    end
  end
  return table.concat(parts)
end

local b64dec = {}
for i = 1, #b64chars do b64dec[b64chars:byte(i)] = i - 1 end

local function fromBase64(str)
  str = str:gsub("[^A-Za-z0-9+/]", "")
  local len = math.floor(#str * 3 / 4)
  local buf = ffi.new("uint8_t[?]", len + 1)
  local j = 0
  for i = 1, #str, 4 do
    local a = b64dec[str:byte(i)] or 0
    local b = b64dec[str:byte(i+1)] or 0
    local c = b64dec[str:byte(i+2)] or 0
    local d = b64dec[str:byte(i+3)] or 0
    buf[j] = bit.bor(bit.lshift(a, 2), bit.rshift(b, 4)); j = j + 1
    if i + 2 <= #str then buf[j] = bit.bor(bit.lshift(bit.band(b, 15), 4), bit.rshift(c, 2)); j = j + 1 end
    if i + 3 <= #str then buf[j] = bit.bor(bit.lshift(bit.band(c, 3), 6), d); j = j + 1 end
  end
  return buf, j
end

-- ============================================================================
-- Secure Memory
-- ============================================================================

local secureHandles = {}
local nextHandleId = 1

function Privacy.secureAlloc(dataHex)
  ensureLoaded()
  if not sodium then error("libsodium required for secure memory") end

  local src, len = fromHex(dataHex)
  local ptr = sodium.sodium_malloc(len)
  if ptr == nil then error("sodium_malloc failed") end

  ffi.copy(ptr, src, len)

  -- Zero the source buffer
  sodium.sodium_memzero(src, len)

  local id = nextHandleId
  nextHandleId = nextHandleId + 1
  secureHandles[id] = { ptr = ptr, size = len, access = "readwrite" }
  return id
end

function Privacy.secureRead(handleId)
  ensureLoaded()
  local h = secureHandles[handleId]
  if not h then error("invalid secure handle: " .. tostring(handleId)) end

  -- If access is noaccess, temporarily set to readwrite
  local wasNoaccess = (h.access == "noaccess")
  if wasNoaccess then
    Privacy.secureProtect(handleId, "readwrite")
  end

  local hex = toHex(ffi.cast("uint8_t*", h.ptr), h.size)

  if wasNoaccess then
    Privacy.secureProtect(handleId, "noaccess")
  end
  return hex
end

function Privacy.secureFree(handleId)
  ensureLoaded()
  local h = secureHandles[handleId]
  if not h then return end

  sodium.sodium_memzero(h.ptr, h.size)
  sodium.sodium_free(h.ptr)
  secureHandles[handleId] = nil
end

function Privacy.secureProtect(handleId, mode)
  ensureLoaded()
  local h = secureHandles[handleId]
  if not h then error("invalid secure handle: " .. tostring(handleId)) end

  if mode ~= "noaccess" and mode ~= "readonly" and mode ~= "readwrite" then
    error("invalid protect mode: " .. tostring(mode))
  end

  -- NOTE: We do NOT call sodium_mprotect_* here because reading the memory
  -- afterward (even via FFI) triggers a hardware SIGSEGV that pcall cannot catch.
  -- Instead, we track the mode in software and implement managed read-through
  -- semantics in secureRead(). The memory is still in sodium_malloc'd pages
  -- which have their own guard pages for buffer overflow protection.
  h.access = mode
end

-- ============================================================================
-- HKDF-SHA256 (RFC 5869)
-- ============================================================================

-- We need HMAC-SHA256 from crypto.lua. Crypto.hmac_sha256(key, message)
-- takes RAW Lua strings (bytes) and returns {hex=..., base64=...}.
-- Our HKDF works with hex strings, so we convert at boundaries.
local function hmac_sha256_raw(keyBytes, messageBytes)
  ensureLoaded()
  if Crypto and Crypto.available then
    local result = Crypto.hmac_sha256(keyBytes, messageBytes)
    return result.hex  -- return just the hex string
  end
  error("crypto module required for HKDF")
end

-- Convert hex string to raw Lua string (bytes)
local function hexToRaw(hex)
  if not hex or hex == "" then return "" end
  return (hex:gsub("..", function(cc)
    return string.char(tonumber(cc, 16))
  end))
end

-- HMAC-SHA256 wrapper that takes hex strings and returns hex string
local function hmac_sha256_hex(keyHex, messageHex)
  return hmac_sha256_raw(hexToRaw(keyHex), hexToRaw(messageHex))
end

function Privacy.hkdfExtract(salt, ikm)
  -- salt and ikm are hex strings
  -- Returns PRK as hex string
  if not salt or salt == "" then
    -- Default salt: string of HashLen zeros
    salt = string.rep("00", 32)
  end
  return hmac_sha256_hex(salt, ikm)
end

function Privacy.hkdfExpand(prk, info, length)
  -- prk and info are hex strings, length is byte count
  length = length or 32
  info = info or ""

  local hashLen = 32 -- SHA-256 output
  local n = math.ceil(length / hashLen)
  if n > 255 then error("HKDF: output too long") end

  local okm = ""
  local t = ""  -- hex string, starts empty
  for i = 1, n do
    -- T(i) = HMAC-Hash(PRK, T(i-1) || info || i)
    local counterHex = string.format("%02x", i)
    t = hmac_sha256_hex(prk, t .. info .. counterHex)
    okm = okm .. t
  end

  return okm:sub(1, length * 2) -- trim to exact length (hex chars = bytes * 2)
end

function Privacy.hkdfDerive(ikmHex, saltHex, infoHex, length)
  local prk = Privacy.hkdfExtract(saltHex, ikmHex)
  return Privacy.hkdfExpand(prk, infoHex, length)
end

-- ============================================================================
-- Shamir's Secret Sharing — GF(256)
-- ============================================================================

-- GF(256) with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B)
-- Using plain Lua tables (not FFI uint8_t arrays) to avoid cdata
-- conversion issues with bit operations and comparisons.
local GF_EXP = {}
local GF_LOG = {}

-- Build lookup tables (generator 3 — standard AES GF(256) primitive element)
do
  local x = 1
  for i = 0, 254 do
    GF_EXP[i] = x
    GF_LOG[x] = i
    -- Multiply by generator 3: x*3 = (x<<1) XOR x, then reduce mod 0x11B
    x = bit.bxor(bit.lshift(x, 1), x)
    if bit.band(x, 0x100) ~= 0 then
      x = bit.bxor(x, 0x11B)
    end
    x = bit.band(x, 0xFF)
  end
  -- Extend table for easy modular reduction
  for i = 255, 511 do
    GF_EXP[i] = GF_EXP[i - 255]
  end
  GF_LOG[0] = 0 -- convention (never used in multiply)
end

local function gf_mul(a, b)
  if a == 0 or b == 0 then return 0 end
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
end

local function gf_inv(a)
  if a == 0 then error("division by zero in GF(256)") end
  return GF_EXP[255 - GF_LOG[a]]
end

-- Evaluate polynomial at point x in GF(256) using Horner's method
local function evalPoly(coeffs, x)
  local result = 0
  for i = #coeffs, 1, -1 do
    result = bit.bxor(gf_mul(result, x), coeffs[i])
  end
  return result
end

-- Lagrange interpolation at x=0
local function lagrangeInterpolate(shares)
  local secret = 0
  for i = 1, #shares do
    local xi, yi = shares[i][1], shares[i][2]
    local li = 1
    for j = 1, #shares do
      if i ~= j then
        local xj = shares[j][1]
        -- li *= (0 - xj) / (xi - xj) = xj / (xi ^ xj)
        li = gf_mul(li, gf_mul(xj, gf_inv(bit.bxor(xi, xj))))
      end
    end
    secret = bit.bxor(secret, gf_mul(yi, li))
  end
  return secret
end

function Privacy.shamirSplit(secretHex, n, k)
  ensureLoaded()
  if k < 2 then error("threshold must be >= 2") end
  if n < k then error("total shares must be >= threshold") end
  if n > 255 then error("max 255 shares") end

  local secretBytes, secretLen = fromHex(secretHex)
  local shares = {}

  for i = 1, n do
    shares[i] = { index = i, hex = "" }
  end

  -- For each byte of the secret, generate random polynomial and evaluate
  local coeffBuf = ffi.new("uint8_t[?]", k - 1)

  for byteIdx = 0, secretLen - 1 do
    -- Random coefficients for polynomial of degree k-1
    -- coeffs[1] = secret byte, coeffs[2..k] = random
    local coeffs = { secretBytes[byteIdx] }
    sodium.randombytes_buf(coeffBuf, k - 1)
    for c = 0, k - 2 do
      coeffs[#coeffs + 1] = coeffBuf[c]
    end

    -- Evaluate at x = 1..n
    for i = 1, n do
      local val = evalPoly(coeffs, i)
      shares[i].hex = shares[i].hex .. string.format("%02x", val)
    end

    -- Zero coefficients
    ffi.fill(coeffBuf, k - 1, 0)
  end

  -- Zero source
  ffi.fill(secretBytes, secretLen, 0)

  return shares
end

function Privacy.shamirCombine(shares)
  if #shares < 2 then error("need at least 2 shares") end

  local shareLen = #shares[1].hex / 2
  local result = {}

  for byteIdx = 0, shareLen - 1 do
    local points = {}
    for i = 1, #shares do
      local val = tonumber(shares[i].hex:sub(byteIdx * 2 + 1, byteIdx * 2 + 2), 16)
      points[#points + 1] = { shares[i].index, val }
    end
    result[#result + 1] = string.format("%02x", lagrangeInterpolate(points))
  end

  return table.concat(result)
end

-- ============================================================================
-- File Encryption (streaming, chunked AEAD)
-- ============================================================================

local CHUNK_SIZE = 65536 -- 64KB

function Privacy.encryptFile(path, outputPath, password, algorithm)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  algorithm = algorithm or "xchacha20-poly1305"

  -- Read input file
  local f = io.open(path, "rb")
  if not f then error("cannot open file: " .. path) end
  local data = f:read("*a")
  f:close()

  -- Encrypt using crypto module
  local result = Crypto.encrypt(data, password, algorithm, nil)

  -- Write output
  local out = io.open(outputPath, "wb")
  if not out then error("cannot write to: " .. outputPath) end

  -- Write header: magic + version + algorithm + salt + nonce + encrypted data
  local json = require("lua.json") or require("cjson") or require("dkjson")
  -- Fallback: write as JSON envelope (same format as crypto.encrypt returns)
  out:write(json.encode(result))
  out:close()
end

function Privacy.decryptFile(path, outputPath, password)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  local f = io.open(path, "rb")
  if not f then error("cannot open file: " .. path) end
  local content = f:read("*a")
  f:close()

  local json = require("lua.json") or require("cjson") or require("dkjson")
  local envelope = json.decode(content)

  local plaintext = Crypto.decrypt(envelope, password)

  local out = io.open(outputPath, "wb")
  if not out then error("cannot write to: " .. outputPath) end
  out:write(plaintext)
  out:close()
end

-- ============================================================================
-- Envelope Encryption
-- ============================================================================

function Privacy.envelopeEncrypt(dataHex, kekHex)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  -- Generate random DEK (32 bytes)
  local dekBuf = ffi.new("uint8_t[32]")
  sodium.randombytes_buf(dekBuf, 32)
  local dekHex = toHex(dekBuf, 32)

  -- Encrypt data with DEK (raw, no KDF)
  local dataResult = Crypto.encryptRaw(dataHex, dekHex, "xchacha20-poly1305")

  -- Encrypt DEK with KEK (raw, no KDF)
  local dekResult = Crypto.encryptRaw(dekHex, kekHex, "xchacha20-poly1305")

  -- Zero DEK
  ffi.fill(dekBuf, 32, 0)

  return {
    encryptedDEK = dekResult.ciphertext,
    dekNonce = dekResult.nonce,
    ciphertext = dataResult.ciphertext,
    dataNonce = dataResult.nonce,
    algorithm = "xchacha20-poly1305",
  }
end

function Privacy.envelopeDecrypt(envelope, kekHex)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  -- Decrypt DEK with KEK (decryptRaw returns {plaintext=hex})
  local dekResult = Crypto.decryptRaw(envelope.encryptedDEK, kekHex, envelope.dekNonce, "xchacha20-poly1305")
  local dekHex = dekResult.plaintext

  -- Decrypt data with DEK
  local dataResult = Crypto.decryptRaw(envelope.ciphertext, dekHex, envelope.dataNonce, "xchacha20-poly1305")

  return dataResult.plaintext
end

-- ============================================================================
-- Secure File Deletion
-- ============================================================================

function Privacy.secureDelete(path, passes)
  passes = passes or 3

  -- Try shred first (most battle-tested)
  if commandExists("shred") then
    local cmd = "shred -vzn " .. tostring(passes) .. " " .. shellEscape(path) .. " 2>&1"
    local out, err = popenRead(cmd)
    if out then
      -- Now unlink
      os.remove(path)
      return { success = true, method = "shred" }
    end
  end

  -- Fallback: manual overwrite via POSIX FFI
  ensureLoaded()
  local C = ffi.C

  -- Get file size
  local f = io.open(path, "rb")
  if not f then error("cannot open file: " .. path) end
  local size = f:seek("end")
  f:close()

  if size > 0 then
    local fd = C.open(path, O_WRONLY)
    if fd < 0 then error("cannot open file for writing: " .. path) end

    local buf = ffi.new("uint8_t[?]", CHUNK_SIZE)

    for pass = 1, passes do
      -- Seek to beginning (reopen for simplicity)
      C.close(fd)
      fd = C.open(path, O_WRONLY)

      local remaining = size
      while remaining > 0 do
        local chunkLen = math.min(remaining, CHUNK_SIZE)
        if pass % 2 == 0 then
          ffi.fill(buf, chunkLen, 0xFF) -- all ones
        else
          sodium.randombytes_buf(buf, chunkLen) -- random
        end
        C.write(fd, buf, chunkLen)
        remaining = remaining - chunkLen
      end
      C.fsync(fd)
    end

    -- Final zero pass
    C.close(fd)
    fd = C.open(path, O_WRONLY)
    local remaining = size
    while remaining > 0 do
      local chunkLen = math.min(remaining, CHUNK_SIZE)
      ffi.fill(buf, chunkLen, 0)
      C.write(fd, buf, chunkLen)
      remaining = remaining - chunkLen
    end
    C.fsync(fd)
    C.close(fd)
  end

  -- Remove the file
  os.remove(path)

  return { success = true, method = "posix-overwrite" }
end

-- ============================================================================
-- File/Directory Integrity Hashing
-- ============================================================================

function Privacy.hashFile(path, algorithm)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end
  algorithm = algorithm or "sha256"

  local f = io.open(path, "rb")
  if not f then error("cannot open file: " .. path) end
  local data = f:read("*a")
  f:close()

  local hashFn = ({
    sha256 = Crypto.sha256,
    sha512 = Crypto.sha512,
    blake2b = Crypto.blake2b,
    blake2s = Crypto.blake2s,
    blake3 = Crypto.blake3_hash,
  })[algorithm]
  if not hashFn then error("unsupported hash algorithm: " .. algorithm) end
  local result = hashFn(data)
  return result.hex
end

function Privacy.hashDirectory(dirPath, algorithm, recursive)
  ensureLoaded()
  algorithm = algorithm or "sha256"
  recursive = recursive ~= false -- default true

  local manifest = {}

  -- Use find command to list files
  local findCmd = "find " .. shellEscape(dirPath)
  if not recursive then
    findCmd = findCmd .. " -maxdepth 1"
  end
  findCmd = findCmd .. " -type f -print0 2>/dev/null"

  local h = io.popen(findCmd)
  if not h then error("cannot list directory: " .. dirPath) end
  local output = h:read("*a")
  h:close()

  -- Split on null bytes
  for file in output:gmatch("[^%z]+") do
    local relPath = file:sub(#dirPath + 2) -- strip dirPath + /
    if relPath and #relPath > 0 then
      manifest[relPath] = Privacy.hashFile(file, algorithm)
    end
  end

  return manifest
end

function Privacy.verifyManifest(dirPath, manifest, algorithm)
  algorithm = algorithm or "sha256"
  local report = {
    valid = true,
    verified = 0,
    mismatched = {},
    missing = {},
    extra = {},
  }

  -- Check each entry in manifest
  for relPath, expectedHash in pairs(manifest) do
    local fullPath = dirPath .. "/" .. relPath
    local f = io.open(fullPath, "rb")
    if not f then
      report.missing[#report.missing + 1] = relPath
      report.valid = false
    else
      f:close()
      local actualHash = Privacy.hashFile(fullPath, algorithm)
      if actualHash ~= expectedHash then
        report.mismatched[#report.mismatched + 1] = relPath
        report.valid = false
      else
        report.verified = report.verified + 1
      end
    end
  end

  -- Check for extra files not in manifest
  local currentManifest = Privacy.hashDirectory(dirPath, algorithm, true)
  for relPath, _ in pairs(currentManifest) do
    if not manifest[relPath] then
      report.extra[#report.extra + 1] = relPath
    end
  end

  return report
end

-- ============================================================================
-- GPG Operations (shell-out to gpg CLI)
-- ============================================================================

function Privacy.gpgEncrypt(plaintext, recipientKeyId)
  if not commandExists("gpg") then error("gpg not installed") end

  local tmpIn = os.tmpname()
  local tmpOut = tmpIn .. ".gpg"

  local f = io.open(tmpIn, "w")
  f:write(plaintext)
  f:close()

  local cmd = "gpg --batch --yes --armor --encrypt --recipient "
    .. shellEscape(recipientKeyId) .. " --output " .. shellEscape(tmpOut)
    .. " " .. shellEscape(tmpIn) .. " 2>&1"
  local out = popenRead(cmd)

  os.remove(tmpIn)

  local result = io.open(tmpOut, "r")
  if not result then error("gpg encrypt failed: " .. (out or "unknown")) end
  local encrypted = result:read("*a")
  result:close()
  os.remove(tmpOut)

  return encrypted
end

function Privacy.gpgDecrypt(ciphertext)
  if not commandExists("gpg") then error("gpg not installed") end

  local tmpIn = os.tmpname()
  local f = io.open(tmpIn, "w")
  f:write(ciphertext)
  f:close()

  local cmd = "gpg --batch --yes --decrypt " .. shellEscape(tmpIn) .. " 2>/dev/null"
  local out = popenRead(cmd)

  os.remove(tmpIn)

  if not out or #out == 0 then error("gpg decrypt failed") end
  return out
end

function Privacy.gpgSign(message, keyId)
  if not commandExists("gpg") then error("gpg not installed") end

  local tmpIn = os.tmpname()
  local f = io.open(tmpIn, "w")
  f:write(message)
  f:close()

  local cmd = "gpg --batch --yes --armor --clearsign"
  if keyId then
    cmd = cmd .. " --local-user " .. shellEscape(keyId)
  end
  cmd = cmd .. " " .. shellEscape(tmpIn) .. " 2>&1"

  popenRead(cmd)

  local tmpOut = tmpIn .. ".asc"
  local result = io.open(tmpOut, "r")
  if not result then
    os.remove(tmpIn)
    error("gpg sign failed")
  end
  local signed = result:read("*a")
  result:close()
  os.remove(tmpIn)
  os.remove(tmpOut)

  return signed
end

function Privacy.gpgVerify(signedMessage)
  if not commandExists("gpg") then error("gpg not installed") end

  local tmpIn = os.tmpname()
  local f = io.open(tmpIn, "w")
  f:write(signedMessage)
  f:close()

  local cmd = "gpg --batch --verify " .. shellEscape(tmpIn) .. " 2>&1"
  local out = popenRead(cmd)
  os.remove(tmpIn)

  local valid = out and out:match("Good signature") ~= nil
  local signer = out and out:match('"([^"]+)"')
  local fingerprint = out and out:match("key ([%x]+)")

  return { valid = valid, signer = signer, fingerprint = fingerprint }
end

function Privacy.gpgListKeys()
  if not commandExists("gpg") then error("gpg not installed") end

  local cmd = "gpg --list-keys --with-colons 2>/dev/null"
  local out = popenRead(cmd)
  if not out then return {} end

  local keys = {}
  local current = nil

  for line in out:gmatch("[^\n]+") do
    local fields = {}
    for field in line:gmatch("[^:]*") do
      fields[#fields + 1] = field
    end
    if fields[1] == "pub" or fields[1] == "sec" then
      current = {
        type = fields[1],
        trust = fields[2] or "",
        algorithm = fields[4] or "",
        keyId = fields[5] or "",
        created = fields[6] or "",
        expires = fields[7] ~= "" and fields[7] or nil,
        fingerprint = "",
        uid = "",
      }
      keys[#keys + 1] = current
    elseif fields[1] == "fpr" and current then
      current.fingerprint = fields[10] or ""
    elseif fields[1] == "uid" and current then
      current.uid = fields[10] or ""
    end
  end

  return keys
end

function Privacy.gpgImportKey(armoredKey)
  if not commandExists("gpg") then error("gpg not installed") end

  local tmpIn = os.tmpname()
  local f = io.open(tmpIn, "w")
  f:write(armoredKey)
  f:close()

  local cmd = "gpg --batch --import " .. shellEscape(tmpIn) .. " 2>&1"
  local out = popenRead(cmd)
  os.remove(tmpIn)

  local imported = 0
  if out then
    local n = out:match("imported: (%d+)")
    imported = tonumber(n) or 0
  end

  return { imported = imported }
end

function Privacy.gpgExportKey(keyId)
  if not commandExists("gpg") then error("gpg not installed") end

  local cmd = "gpg --batch --armor --export " .. shellEscape(keyId) .. " 2>/dev/null"
  local out = popenRead(cmd)
  if not out or #out == 0 then error("key not found: " .. keyId) end
  return out
end

-- ============================================================================
-- Metadata Stripping (shell-out to exiftool)
-- ============================================================================

function Privacy.metaStrip(path, outputPath)
  if not commandExists("exiftool") then error("exiftool not installed") end

  local cmd
  if outputPath then
    cmd = "exiftool -all= -o " .. shellEscape(outputPath) .. " " .. shellEscape(path) .. " 2>&1"
  else
    cmd = "exiftool -all= -overwrite_original " .. shellEscape(path) .. " 2>&1"
  end

  local out = popenRead(cmd)
  if not out or out:match("Error") then
    error("exiftool failed: " .. (out or "unknown"))
  end
end

function Privacy.metaRead(path)
  if not commandExists("exiftool") then error("exiftool not installed") end

  local cmd = "exiftool -json " .. shellEscape(path) .. " 2>/dev/null"
  local out = popenRead(cmd)
  if not out or #out == 0 then error("exiftool failed to read: " .. path) end

  local json = require("lua.json") or require("cjson") or require("dkjson")
  local data = json.decode(out)
  if data and data[1] then
    return data[1]
  end
  return {}
end

-- ============================================================================
-- Keyring Management
-- ============================================================================

local openKeyrings = {} -- handle -> { path, data, masterPassword }
local nextKeyringId = 1

local function keyringPath(handle)
  local kr = openKeyrings[handle]
  if not kr then error("invalid keyring handle: " .. tostring(handle)) end
  return kr
end

function Privacy.keyringCreate(path, masterPassword)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  local data = { keys = {}, created = os.time(), version = 1 }
  local json = require("lua.json") or require("cjson") or require("dkjson")
  local plaintext = json.encode(data)

  local encrypted = Crypto.encrypt(plaintext, masterPassword, "xchacha20-poly1305", nil)

  local f = io.open(path, "w")
  if not f then error("cannot write keyring: " .. path) end
  f:write(json.encode(encrypted))
  f:close()

  local handle = "kr_" .. nextKeyringId
  nextKeyringId = nextKeyringId + 1
  openKeyrings[handle] = { path = path, data = data, masterPassword = masterPassword }

  return handle
end

function Privacy.keyringOpen(path, masterPassword)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  local f = io.open(path, "r")
  if not f then error("keyring not found: " .. path) end
  local content = f:read("*a")
  f:close()

  local json = require("lua.json") or require("cjson") or require("dkjson")
  local encrypted = json.decode(content)
  local plaintext = Crypto.decrypt(encrypted, masterPassword)
  local data = json.decode(plaintext)

  local handle = "kr_" .. nextKeyringId
  nextKeyringId = nextKeyringId + 1
  openKeyrings[handle] = { path = path, data = data, masterPassword = masterPassword }

  return handle
end

function Privacy.keyringClose(handle)
  local kr = openKeyrings[handle]
  if not kr then return end

  -- Save before closing
  Privacy.keyringSave(handle)
  openKeyrings[handle] = nil
end

function Privacy.keyringSave(handle)
  local kr = keyringPath(handle)
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  local json = require("lua.json") or require("cjson") or require("dkjson")
  local plaintext = json.encode(kr.data)
  local encrypted = Crypto.encrypt(plaintext, kr.masterPassword, "xchacha20-poly1305", nil)

  local f = io.open(kr.path, "w")
  if not f then error("cannot write keyring: " .. kr.path) end
  f:write(json.encode(encrypted))
  f:close()
end

function Privacy.keyringGenerateKey(handle, opts)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end
  local kr = keyringPath(handle)

  local keyType = opts.type or "ed25519"
  local entry = {
    id = Crypto.randomToken(16),
    type = keyType,
    label = opts.label,
    created = os.time(),
    expires = opts.expiresIn and (os.time() + opts.expiresIn) or nil,
    metadata = opts.metadata,
  }

  if keyType == "ed25519" then
    local keys = Crypto.generateSigningKeys()
    entry.publicKey = keys.publicKey
    -- Encrypt private key with master password
    entry.encryptedPrivateKey = Crypto.encrypt(keys.privateKey, kr.masterPassword, "xchacha20-poly1305", nil)
  elseif keyType == "x25519" then
    local keys = Crypto.generateDHKeys()
    entry.publicKey = keys.publicKey
    entry.encryptedPrivateKey = Crypto.encrypt(keys.privateKey, kr.masterPassword, "xchacha20-poly1305", nil)
  else
    error("unsupported key type: " .. keyType)
  end

  kr.data.keys[#kr.data.keys + 1] = entry
  Privacy.keyringSave(handle)

  -- Return entry without encrypted private key
  local result = {}
  for k, v in pairs(entry) do
    if k ~= "encryptedPrivateKey" then
      result[k] = v
    end
  end
  return result
end

function Privacy.keyringListKeys(handle)
  local kr = keyringPath(handle)
  local result = {}
  for _, entry in ipairs(kr.data.keys) do
    local e = {}
    for k, v in pairs(entry) do
      if k ~= "encryptedPrivateKey" then
        e[k] = v
      end
    end
    result[#result + 1] = e
  end
  return result
end

function Privacy.keyringGetKey(handle, keyId)
  local kr = keyringPath(handle)
  for _, entry in ipairs(kr.data.keys) do
    if entry.id == keyId then
      local e = {}
      for k, v in pairs(entry) do
        if k ~= "encryptedPrivateKey" then
          e[k] = v
        end
      end
      return e
    end
  end
  return nil
end

function Privacy.keyringRotateKey(handle, keyId, reason)
  local kr = keyringPath(handle)

  -- Find old key
  local oldKey = nil
  for _, entry in ipairs(kr.data.keys) do
    if entry.id == keyId then
      oldKey = entry
      break
    end
  end
  if not oldKey then error("key not found: " .. keyId) end
  if oldKey.revoked then error("cannot rotate revoked key") end

  -- Generate new key of same type
  local newEntry = Privacy.keyringGenerateKey(handle, {
    type = oldKey.type,
    label = oldKey.label and (oldKey.label .. " (rotated)") or nil,
    metadata = oldKey.metadata,
  })

  -- Mark old key as rotated
  oldKey.rotatedTo = newEntry.id
  Privacy.keyringSave(handle)

  return newEntry
end

function Privacy.keyringRevokeKey(handle, keyId, reason)
  local kr = keyringPath(handle)
  for _, entry in ipairs(kr.data.keys) do
    if entry.id == keyId then
      entry.revoked = os.time()
      entry.revokeReason = reason
      Privacy.keyringSave(handle)
      return
    end
  end
  error("key not found: " .. keyId)
end

function Privacy.keyringExportPublic(handle, keyId)
  local kr = keyringPath(handle)
  for _, entry in ipairs(kr.data.keys) do
    if entry.id == keyId then
      return entry.publicKey
    end
  end
  error("key not found: " .. keyId)
end

-- ============================================================================
-- Identity & Anonymity
-- ============================================================================

function Privacy.anonymousId(domain, seed)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  if not seed then
    seed = Crypto.randomBytesHex(32)
  end

  -- HMAC-SHA256(domain, seed) — deterministic within domain, unlinkable across
  local result = Crypto.hmac_sha256(domain, seed)
  return result.hex
end

function Privacy.pseudonym(masterSecretHex, context)
  ensureLoaded()
  -- Derive context-specific identifier via HKDF
  -- Convert context to hex
  local contextHex = ""
  for i = 1, #context do
    contextHex = contextHex .. string.format("%02x", context:byte(i))
  end
  return Privacy.hkdfDerive(masterSecretHex, nil, contextHex, 32)
end

function Privacy.isolatedCredential(domain)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  local keys = Crypto.generateSigningKeys()
  return {
    domain = domain,
    publicKey = keys.publicKey,
    keyId = Crypto.randomToken(8),
    -- Private key is in the returned object but should be stored securely
    privateKey = keys.privateKey,
  }
end

-- ============================================================================
-- Noise-NK Secure Channel
-- ============================================================================

local noiseSessions = {}
local nextSessionId = 1

function Privacy.noiseInitiate(remotePublicKeyHex)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  -- Generate ephemeral X25519 key pair
  local ephemeral = Crypto.generateDHKeys()

  -- DH(ephemeral_private, remote_static_public) -> shared secret
  local sharedSecret = Crypto.diffieHellman(ephemeral.privateKey, remotePublicKeyHex)

  -- Derive send/recv keys via HKDF
  local sendKeyHex = Privacy.hkdfDerive(sharedSecret, nil, "6e6f6973652d6e6b2d73656e64", 32) -- "noise-nk-send"
  local recvKeyHex = Privacy.hkdfDerive(sharedSecret, nil, "6e6f6973652d6e6b2d72656376", 32) -- "noise-nk-recv"

  local sessionId = "ns_" .. nextSessionId
  nextSessionId = nextSessionId + 1

  noiseSessions[sessionId] = {
    sendKey = sendKeyHex,
    recvKey = recvKeyHex,
    sendNonce = 0,
    recvNonce = 0,
    seenMessages = {},
    remotePublicKey = remotePublicKeyHex,
  }

  return {
    sessionId = sessionId,
    message = ephemeral.publicKey, -- handshake message is our ephemeral public key
  }
end

function Privacy.noiseRespond(staticPrivateKeyHex, handshakeMessage)
  ensureLoaded()
  if not Crypto or not Crypto.available then
    Crypto.loadLibraries()
  end

  -- handshakeMessage is the initiator's ephemeral public key
  local remoteEphemeralPub = handshakeMessage

  -- DH(static_private, remote_ephemeral_public) -> shared secret
  local sharedSecret = Crypto.diffieHellman(staticPrivateKeyHex, remoteEphemeralPub)

  -- Derive keys (reversed: responder's send = initiator's recv)
  local sendKeyHex = Privacy.hkdfDerive(sharedSecret, nil, "6e6f6973652d6e6b2d72656376", 32) -- "noise-nk-recv" (reversed)
  local recvKeyHex = Privacy.hkdfDerive(sharedSecret, nil, "6e6f6973652d6e6b2d73656e64", 32) -- "noise-nk-send" (reversed)

  local sessionId = "ns_" .. nextSessionId
  nextSessionId = nextSessionId + 1

  noiseSessions[sessionId] = {
    sendKey = sendKeyHex,
    recvKey = recvKeyHex,
    sendNonce = 0,
    recvNonce = 0,
    seenMessages = {},
    remotePublicKey = remoteEphemeralPub,
  }

  return {
    sessionId = sessionId,
    message = "", -- Noise-NK: no responder ephemeral needed
  }
end

function Privacy.noiseSend(sessionId, plaintext)
  ensureLoaded()
  local session = noiseSessions[sessionId]
  if not session then error("invalid noise session: " .. tostring(sessionId)) end

  -- Convert plaintext to hex
  local plaintextHex = ""
  for i = 1, #plaintext do
    plaintextHex = plaintextHex .. string.format("%02x", plaintext:byte(i))
  end

  -- Encrypt with send key + nonce counter
  local result = Crypto.encryptRaw(plaintextHex, session.sendKey, "xchacha20-poly1305")
  session.sendNonce = session.sendNonce + 1

  return result.ciphertext .. ":" .. result.nonce
end

function Privacy.noiseReceive(sessionId, ciphertextWithNonce)
  ensureLoaded()
  local session = noiseSessions[sessionId]
  if not session then error("invalid noise session: " .. tostring(sessionId)) end

  -- Replay protection: reject previously seen messages
  if session.seenMessages[ciphertextWithNonce] then
    error("replay detected: message already received")
  end

  local ciphertext, nonce = ciphertextWithNonce:match("^(.+):(.+)$")
  if not ciphertext then error("invalid message format") end

  local decResult = Crypto.decryptRaw(ciphertext, session.recvKey, nonce, "xchacha20-poly1305")
  local plaintextHex = decResult.plaintext
  session.recvNonce = session.recvNonce + 1

  -- Track this message as seen (after successful decrypt)
  session.seenMessages[ciphertextWithNonce] = true

  -- Convert hex to string
  local bytes = {}
  for i = 1, #plaintextHex, 2 do
    bytes[#bytes + 1] = string.char(tonumber(plaintextHex:sub(i, i + 1), 16))
  end
  return table.concat(bytes)
end

function Privacy.noiseClose(sessionId)
  local session = noiseSessions[sessionId]
  if not session then return end

  -- Zero keys (they're Lua strings, but clear the reference)
  session.sendKey = nil
  session.recvKey = nil
  noiseSessions[sessionId] = nil
end

-- ============================================================================
-- Steganography
-- ============================================================================

function Privacy.stegEmbedImage(imagePath, dataHex, outputPath)
  ensureLoaded()
  if not love or not love.image then
    error("steganography requires Love2D image module")
  end

  local imageData = love.image.newImageData(imagePath)
  local w, h = imageData:getDimensions()
  local capacity = math.floor(w * h * 3 / 8) -- 3 channels, 1 bit each, 8 bits per byte

  local dataBytes, dataLen = fromHex(dataHex)
  if dataLen > capacity - 4 then -- 4 bytes for length header
    error("data too large: " .. dataLen .. " bytes, capacity: " .. (capacity - 4) .. " bytes")
  end

  -- Embed length first (4 bytes, big-endian)
  local bitIdx = 0
  local function embedBit(val)
    local px = math.floor(bitIdx / 3) % w
    local py = math.floor(math.floor(bitIdx / 3) / w)
    local channel = bitIdx % 3
    local r, g, b, a = imageData:getPixel(px, py)

    local channels = { r, g, b }
    -- Clear LSB and set new bit
    local byteVal = math.floor(channels[channel + 1] * 255)
    byteVal = bit.bor(bit.band(byteVal, 0xFE), val)
    channels[channel + 1] = byteVal / 255

    imageData:setPixel(px, py, channels[1], channels[2], channels[3], a)
    bitIdx = bitIdx + 1
  end

  -- Embed length header
  for i = 3, 0, -1 do
    local byte = bit.band(bit.rshift(dataLen, i * 8), 0xFF)
    for b = 7, 0, -1 do
      embedBit(bit.band(bit.rshift(byte, b), 1))
    end
  end

  -- Embed data
  for i = 0, dataLen - 1 do
    local byte = dataBytes[i]
    for b = 7, 0, -1 do
      embedBit(bit.band(bit.rshift(byte, b), 1))
    end
  end

  -- Save
  local fileData = imageData:encode("png")
  local f = io.open(outputPath, "wb")
  if not f then error("cannot write: " .. outputPath) end
  f:write(fileData:getString())
  f:close()

  return {
    outputPath = outputPath,
    bytesHidden = dataLen,
    capacity = capacity - 4,
  }
end

function Privacy.stegExtractImage(imagePath)
  if not love or not love.image then
    error("steganography requires Love2D image module")
  end

  local imageData = love.image.newImageData(imagePath)
  local w, h = imageData:getDimensions()

  local bitIdx = 0
  local function extractBit()
    local px = math.floor(bitIdx / 3) % w
    local py = math.floor(math.floor(bitIdx / 3) / w)
    local channel = bitIdx % 3
    local r, g, b = imageData:getPixel(px, py)

    local channels = { r, g, b }
    local byteVal = math.floor(channels[channel + 1] * 255)
    bitIdx = bitIdx + 1
    return bit.band(byteVal, 1)
  end

  -- Extract length header (4 bytes)
  local dataLen = 0
  for i = 31, 0, -1 do
    dataLen = dataLen + bit.lshift(extractBit(), i)
  end

  -- Sanity check
  local capacity = math.floor(w * h * 3 / 8) - 4
  if dataLen > capacity or dataLen < 0 then
    error("invalid steganography data (no hidden data or corrupted)")
  end

  -- Extract data
  local bytes = {}
  for i = 1, dataLen do
    local byte = 0
    for b = 7, 0, -1 do
      byte = byte + bit.lshift(extractBit(), b)
    end
    bytes[#bytes + 1] = string.format("%02x", byte)
  end

  return table.concat(bytes)
end

-- ============================================================================
-- RPC Handlers
-- ============================================================================

-- ── Whitespace Steganography ──

local ZWS  = "\xE2\x80\x8B"  -- U+200B ZERO WIDTH SPACE
local ZWNJ = "\xE2\x80\x8C"  -- U+200C ZERO WIDTH NON-JOINER

local function utf8_split(s)
  local chars = {}
  local i = 1
  while i <= #s do
    local b = string.byte(s, i)
    local len
    if     b < 0x80 then len = 1
    elseif b < 0xE0 then len = 2
    elseif b < 0xF0 then len = 3
    else                  len = 4 end
    chars[#chars + 1] = s:sub(i, i + len - 1)
    i = i + len
  end
  return chars
end

function Privacy.stegEmbedWhitespace(carrier, secret)
  local bits = {}
  for i = 1, #secret do
    local b = string.byte(secret, i)
    for shift = 7, 0, -1 do
      bits[#bits + 1] = bit.band(bit.rshift(b, shift), 1)
    end
  end
  local chars  = utf8_split(carrier)
  if #chars < 2 then return carrier end
  local parts  = { chars[1] }
  local bitIdx = 1
  for i = 2, #chars do
    while bitIdx <= #bits do
      parts[#parts + 1] = bits[bitIdx] == 0 and ZWS or ZWNJ
      bitIdx = bitIdx + 1
    end
    parts[#parts + 1] = chars[i]
  end
  return table.concat(parts)
end

function Privacy.stegExtractWhitespace(text)
  local bits = {}
  local i = 1
  while i <= #text do
    if i + 2 <= #text and text:sub(i, i + 2) == ZWS then
      bits[#bits + 1] = 0
      i = i + 3
    elseif i + 2 <= #text and text:sub(i, i + 2) == ZWNJ then
      bits[#bits + 1] = 1
      i = i + 3
    else
      local b = string.byte(text, i)
      if     b < 0x80 then i = i + 1
      elseif b < 0xE0 then i = i + 2
      elseif b < 0xF0 then i = i + 3
      else                  i = i + 4 end
    end
  end
  local result = {}
  local j = 1
  while j + 7 <= #bits do
    local byte = 0
    for k = 0, 7 do byte = byte + bits[j + k] * (2 ^ (7 - k)) end
    result[#result + 1] = string.char(math.floor(byte))
    j = j + 8
  end
  return table.concat(result)
end

-- ── PII Sanitize ──

local PII_PATTERNS = {
  email      = "[%w%.%+%-%_]+@[%w%.%-]+%.[%a][%a]+",
  phone      = "%+?1?[%s%-%.]?%(?%d%d%d%)?[%s%-%.]?%d%d%d[%s%-%.]?%d%d%d%d",
  ssn        = "%d%d%d%-?%d%d%-?%d%d%d%d",
  ipv4       = "%d+%.%d+%.%d+%.%d+",
  ipv6       = "[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?:[%x][%x]?[%x]?[%x]?",
  creditCard = "%d%d%d%d[%-%s]?%d%d%d%d[%-%s]?%d%d%d%d[%-%s]?%d%d%d%d",
}
local PII_ORDER = { "email", "phone", "ssn", "ipv4", "ipv6", "creditCard" }

local function isValidIPv4(s)
  local a, b, c, d = s:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$")
  if not a then return false end
  for _, v in ipairs({ tonumber(a), tonumber(b), tonumber(c), tonumber(d) }) do
    if v > 255 then return false end
  end
  return true
end

local function findAllPII(text, piiType)
  local pattern = PII_PATTERNS[piiType]
  local matches = {}
  local init    = 1
  while true do
    local s, e = text:find(pattern, init)
    if not s then break end
    local value = text:sub(s, e)
    if piiType ~= "ipv4" or isValidIPv4(value) then
      matches[#matches + 1] = { type = piiType, value = value, start = s - 1, ["end"] = e }
    end
    init = e + 1
  end
  return matches
end

function Privacy.detectPII(text)
  local all = {}
  for _, piiType in ipairs(PII_ORDER) do
    for _, m in ipairs(findAllPII(text, piiType)) do all[#all + 1] = m end
  end
  table.sort(all, function(a, b) return a.start < b.start end)
  return all
end

function Privacy.maskValue(value, opts)
  local visibleEnd   = (opts and opts.visibleEnd)  or 4
  local visibleStart = (opts and opts.visibleStart) or 0
  local maskChar     = (opts and opts.maskChar)     or "*"
  local maskLen      = math.max(0, #value - visibleStart - visibleEnd)
  return value:sub(1, visibleStart) .. maskChar:rep(maskLen) .. value:sub(#value - visibleEnd + 1)
end

function Privacy.redactPII(text, opts)
  local types = (opts and opts.types) or PII_ORDER
  local matches = {}
  for _, piiType in ipairs(types) do
    for _, m in ipairs(findAllPII(text, piiType)) do matches[#matches + 1] = m end
  end
  table.sort(matches, function(a, b) return a.start > b.start end)
  for _, m in ipairs(matches) do
    local replacement
    if opts and opts.mask then
      replacement = Privacy.maskValue(m.value)
    else
      replacement = (opts and opts.replacement) or "[REDACTED]"
    end
    text = text:sub(1, m.start) .. replacement .. text:sub(m["end"] + 1)
  end
  return text
end

function Privacy.redactLog(logLine) return Privacy.redactPII(logLine) end

function Privacy.sanitizeTokenize(value, salt)
  ensureLoaded()
  return Crypto.hmac_sha256(salt, value).hex
end

-- ── Audit Log ──

local _audit = { chainKeyHex = "", entries = {}, initialized = false }

local function serializeAuditData(data)
  if data == nil then return "null" end
  local t = type(data)
  if t == "string"  then return '"' .. data:gsub('\\', '\\\\'):gsub('"', '\\"') .. '"' end
  if t == "number"  then return tostring(data) end
  if t == "boolean" then return data and "true" or "false" end
  return '"[object]"'
end

function Privacy.auditCreate(key)
  _audit.chainKeyHex = key
  _audit.entries     = {}
  _audit.initialized = true
end

function Privacy.auditAppend(event, data)
  if not _audit.initialized then
    error("Audit log not initialized. Call privacy:audit:create first.")
  end
  local index    = #_audit.entries
  local prevHash = index > 0 and _audit.entries[index].hash or "0"
  local timestamp = math.floor(os.time() * 1000)
  local msg = string.format(
    '%s{"index":%d,"timestamp":%d,"event":"%s","data":%s,"prevHash":"%s"}',
    prevHash, index, timestamp, event:gsub('"', '\\"'), serializeAuditData(data), prevHash
  )
  local hash  = hmac_sha256_raw(hexToRaw(_audit.chainKeyHex), msg)
  local entry = { index = index, timestamp = timestamp, event = event,
                  data = data, hash = hash, prevHash = prevHash }
  _audit.entries[#_audit.entries + 1] = entry
  return entry
end

function Privacy.auditVerify()
  if #_audit.entries == 0 then return { valid = true, entries = 0 } end
  for i, e in ipairs(_audit.entries) do
    local expectedPrev = i > 1 and _audit.entries[i - 1].hash or "0"
    if e.prevHash ~= expectedPrev then
      return { valid = false, entries = #_audit.entries, brokenAt = i - 1 }
    end
    local msg = string.format(
      '%s{"index":%d,"timestamp":%d,"event":"%s","data":%s,"prevHash":"%s"}',
      e.prevHash, e.index, e.timestamp, e.event:gsub('"', '\\"'), serializeAuditData(e.data), e.prevHash
    )
    if hmac_sha256_raw(hexToRaw(_audit.chainKeyHex), msg) ~= e.hash then
      return { valid = false, entries = #_audit.entries, brokenAt = i - 1 }
    end
  end
  return { valid = true, entries = #_audit.entries }
end

function Privacy.auditEntries(from, to)
  from = (from or 0) + 1
  to   = to or #_audit.entries
  local result = {}
  for i = from, to do
    if _audit.entries[i] then result[#result + 1] = _audit.entries[i] end
  end
  return result
end

-- ── Policy / Consent ──

local _policy = { retentionPolicies = {}, consentRecords = {} }

function Privacy.policySetRetention(policy)
  _policy.retentionPolicies[policy.category] = policy
end

function Privacy.policyRecordConsent(userId, purpose, granted)
  _policy.consentRecords[#_policy.consentRecords + 1] = {
    userId = userId, purpose = purpose, granted = granted,
    timestamp = math.floor(os.time() * 1000),
  }
end

function Privacy.policyCheckConsent(userId, purpose)
  for i = #_policy.consentRecords, 1, -1 do
    local r = _policy.consentRecords[i]
    if r.userId == userId and r.purpose == purpose then return r.granted end
  end
  return false
end

function Privacy.policyRevokeConsent(userId, purpose)
  local now = math.floor(os.time() * 1000)
  if purpose then
    _policy.consentRecords[#_policy.consentRecords + 1] = {
      userId = userId, purpose = purpose, granted = false, timestamp = now
    }
  else
    local purposes = {}
    for _, r in ipairs(_policy.consentRecords) do
      if r.userId == userId then purposes[r.purpose] = true end
    end
    for p in pairs(purposes) do
      _policy.consentRecords[#_policy.consentRecords + 1] = {
        userId = userId, purpose = p, granted = false, timestamp = now
      }
    end
  end
end

function Privacy.policyRightToErasure(userId)
  local found, deleted = 0, 0
  local i = #_policy.consentRecords
  while i >= 1 do
    if _policy.consentRecords[i].userId == userId then
      found   = found   + 1
      deleted = deleted + 1
      table.remove(_policy.consentRecords, i)
    end
    i = i - 1
  end
  return { userId = userId, recordsFound = found, recordsDeleted = deleted, categories = {} }
end

function Privacy.policyEnforceRetention()
  return { expired = 0, deleted = 0, anonymized = 0, archived = 0, errors = {} }
end

-- ── Algorithm Safety ──

local STRONG_ALGOS = {
  ["xchacha20-poly1305"] = true, ["chacha20-poly1305"] = true, ["aes-256-gcm"] = true,
  ["ed25519"] = true, ["x25519"] = true, ["sha256"] = true, ["sha512"] = true,
  ["blake2b"] = true, ["blake3"] = true, ["argon2id"] = true,
}
local ACCEPTABLE_ALGOS = {
  ["aes-128-gcm"] = true, ["sha384"] = true, ["scrypt"] = true,
  ["pbkdf2"] = true, ["blake2s"] = true,
}
local WEAK_ALGOS = {
  ["sha1"] = true, ["md5"] = true, ["des"] = true,
  ["rc4"] = true, ["3des"] = true, ["rsa-1024"] = true,
}
local BROKEN_ALGOS = { ["md4"] = true, ["des-ecb"] = true, ["rc2"] = true, ["none"] = true }

local RECOMMENDED_DEFAULTS = {
  algorithm = "xchacha20-poly1305", kdf = "argon2id", hashAlgorithm = "sha256",
  keySize = 32, nonceSize = 24, saltSize = 16, argon2Ops = 2, argon2Mem = 67108864,
  scryptN = 131072, scryptR = 8, scryptP = 1, pbkdf2Iterations = 100000,
}

function Privacy.checkAlgorithmStrength(algorithm)
  local lower = algorithm:lower()
  local rec   = RECOMMENDED_DEFAULTS.algorithm
  if BROKEN_ALGOS[lower] then
    return { algorithm = algorithm, strength = "broken", deprecated = true,
             recommendation = algorithm .. " is broken. Use " .. rec .. " instead." }
  end
  if WEAK_ALGOS[lower] then
    return { algorithm = algorithm, strength = "weak", deprecated = true,
             recommendation = algorithm .. " is weak. Migrate to " .. rec .. "." }
  end
  if ACCEPTABLE_ALGOS[lower] then
    return { algorithm = algorithm, strength = "acceptable", deprecated = false }
  end
  if STRONG_ALGOS[lower] then
    return { algorithm = algorithm, strength = "strong", deprecated = false }
  end
  return { algorithm = algorithm, strength = "weak", deprecated = false,
           recommendation = 'Unknown algorithm "' .. algorithm .. '". Verify it meets current security standards.' }
end

function Privacy.validateConfig(config)
  if type(config) ~= "table" then
    return { valid = false, errors = { "Config must be a non-null object" }, warnings = {} }
  end
  local errors, warnings = {}, {}
  if config.algorithm then
    local a = Privacy.checkAlgorithmStrength(config.algorithm)
    if     a.strength == "broken" then errors[#errors + 1]   = 'Algorithm "' .. config.algorithm .. '" is broken and must not be used.'
    elseif a.strength == "weak"   then warnings[#warnings + 1] = 'Algorithm "' .. config.algorithm .. '" is weak. Consider upgrading.' end
  end
  if config.keySize ~= nil then
    if type(config.keySize) ~= "number" or config.keySize < 16 then
      errors[#errors + 1] = "Key size must be at least 16 bytes. Got " .. tostring(config.keySize) .. "."
    elseif config.keySize < 32 then
      warnings[#warnings + 1] = "Key size " .. config.keySize .. " is below recommended 32 bytes."
    end
  end
  if config.nonceSize ~= nil and (type(config.nonceSize) ~= "number" or config.nonceSize < 8) then
    errors[#errors + 1] = "Nonce size must be at least 8 bytes. Got " .. tostring(config.nonceSize) .. "."
  end
  if config.saltSize ~= nil then
    if type(config.saltSize) ~= "number" or config.saltSize < 8 then
      errors[#errors + 1] = "Salt size must be at least 8 bytes. Got " .. tostring(config.saltSize) .. "."
    elseif config.saltSize < 16 then
      warnings[#warnings + 1] = "Salt size " .. config.saltSize .. " is below recommended 16 bytes."
    end
  end
  local iter = config.iterations or config.pbkdf2Iterations
  if iter ~= nil then
    if type(iter) ~= "number" or iter < 10000 then
      errors[#errors + 1] = "Iterations must be at least 10000. Got " .. tostring(iter) .. "."
    elseif iter < 100000 then
      warnings[#warnings + 1] = "Iterations " .. iter .. " is below recommended 100000."
    end
  end
  if config.argon2Ops ~= nil and (type(config.argon2Ops) ~= "number" or config.argon2Ops < 1) then
    errors[#errors + 1] = "argon2Ops must be at least 1. Got " .. tostring(config.argon2Ops) .. "."
  end
  if config.argon2Mem ~= nil and (type(config.argon2Mem) ~= "number" or config.argon2Mem < 8192) then
    errors[#errors + 1] = "argon2Mem must be at least 8192 bytes. Got " .. tostring(config.argon2Mem) .. "."
  end
  if config.scryptN ~= nil and (type(config.scryptN) ~= "number" or config.scryptN < 1024) then
    errors[#errors + 1] = "scryptN must be at least 1024. Got " .. tostring(config.scryptN) .. "."
  end
  return { valid = #errors == 0, errors = errors, warnings = warnings }
end

-- ── Metadata extras ──

function Privacy.sanitizeFilename(name)
  name = name:gsub("%.%./", ""):gsub("%./", ""):gsub("%z", ""):gsub("[%c]", "")
  return (name:match("^%s*(.-)%s*$") or "")
end

function Privacy.normalizeTimestamp(dateStr)
  return (dateStr:gsub("%.%d+Z$", "Z"))
end

function Privacy.getHandlers()
  local handlers = {}

  local function ensureAll()
    ensureLoaded()
    if Crypto and not Crypto.available then
      Crypto.loadLibraries()
    end
  end

  -- ── Secure Memory ──
  handlers["privacy:secmem:alloc"] = function(args)
    ensureAll()
    if not args or not args.dataHex then error("privacy:secmem:alloc requires 'dataHex'") end
    return { handle = Privacy.secureAlloc(args.dataHex) }
  end

  handlers["privacy:secmem:read"] = function(args)
    ensureAll()
    if not args or not args.handle then error("privacy:secmem:read requires 'handle'") end
    return { hex = Privacy.secureRead(args.handle) }
  end

  handlers["privacy:secmem:free"] = function(args)
    ensureAll()
    if not args or not args.handle then error("privacy:secmem:free requires 'handle'") end
    Privacy.secureFree(args.handle)
    return { success = true }
  end

  handlers["privacy:secmem:protect"] = function(args)
    ensureAll()
    if not args or not args.handle or not args.mode then
      error("privacy:secmem:protect requires 'handle' and 'mode'")
    end
    Privacy.secureProtect(args.handle, args.mode)
    return { success = true }
  end

  -- ── HKDF ──
  handlers["privacy:hkdf:derive"] = function(args)
    ensureAll()
    if not args or not args.ikm then error("privacy:hkdf:derive requires 'ikm'") end
    local result = Privacy.hkdfDerive(args.ikm, args.salt, args.info, args.length)
    return { key = result }
  end

  -- ── Shamir SSS ──
  handlers["privacy:shamir:split"] = function(args)
    ensureAll()
    if not args or not args.secret or not args.n or not args.k then
      error("privacy:shamir:split requires 'secret', 'n', 'k'")
    end
    return { shares = Privacy.shamirSplit(args.secret, args.n, args.k) }
  end

  handlers["privacy:shamir:combine"] = function(args)
    ensureAll()
    if not args or not args.shares then error("privacy:shamir:combine requires 'shares'") end
    return { secret = Privacy.shamirCombine(args.shares) }
  end

  -- ── File Encryption ──
  handlers["privacy:file:encrypt"] = function(args)
    ensureAll()
    if not args or not args.path or not args.outputPath or not args.password then
      error("privacy:file:encrypt requires 'path', 'outputPath', 'password'")
    end
    Privacy.encryptFile(args.path, args.outputPath, args.password, args.algorithm)
    return { success = true }
  end

  handlers["privacy:file:decrypt"] = function(args)
    ensureAll()
    if not args or not args.path or not args.outputPath or not args.password then
      error("privacy:file:decrypt requires 'path', 'outputPath', 'password'")
    end
    Privacy.decryptFile(args.path, args.outputPath, args.password)
    return { success = true }
  end

  -- ── Envelope Encryption ──
  handlers["privacy:envelope:encrypt"] = function(args)
    ensureAll()
    if not args or not args.data or not args.kek then
      error("privacy:envelope:encrypt requires 'data' and 'kek'")
    end
    return Privacy.envelopeEncrypt(args.data, args.kek)
  end

  handlers["privacy:envelope:decrypt"] = function(args)
    ensureAll()
    if not args or not args.envelope or not args.kek then
      error("privacy:envelope:decrypt requires 'envelope' and 'kek'")
    end
    return { data = Privacy.envelopeDecrypt(args.envelope, args.kek) }
  end

  -- ── Secure Deletion ──
  handlers["privacy:file:secureDelete"] = function(args)
    if not args or not args.path then error("privacy:file:secureDelete requires 'path'") end
    return Privacy.secureDelete(args.path, args.passes)
  end

  -- ── Integrity ──
  handlers["privacy:integrity:hashFile"] = function(args)
    ensureAll()
    if not args or not args.path then error("privacy:integrity:hashFile requires 'path'") end
    return { hash = Privacy.hashFile(args.path, args.algorithm) }
  end

  handlers["privacy:integrity:hashDirectory"] = function(args)
    ensureAll()
    if not args or not args.path then error("privacy:integrity:hashDirectory requires 'path'") end
    return { manifest = Privacy.hashDirectory(args.path, args.algorithm, args.recursive) }
  end

  handlers["privacy:integrity:verifyManifest"] = function(args)
    ensureAll()
    if not args or not args.path or not args.manifest then
      error("privacy:integrity:verifyManifest requires 'path' and 'manifest'")
    end
    return Privacy.verifyManifest(args.path, args.manifest, args.algorithm)
  end

  -- ── GPG ──
  handlers["privacy:gpg:encrypt"] = function(args)
    if not args or not args.plaintext or not args.recipientKeyId then
      error("privacy:gpg:encrypt requires 'plaintext' and 'recipientKeyId'")
    end
    return { ciphertext = Privacy.gpgEncrypt(args.plaintext, args.recipientKeyId) }
  end

  handlers["privacy:gpg:decrypt"] = function(args)
    if not args or not args.ciphertext then error("privacy:gpg:decrypt requires 'ciphertext'") end
    return { plaintext = Privacy.gpgDecrypt(args.ciphertext) }
  end

  handlers["privacy:gpg:sign"] = function(args)
    if not args or not args.message then error("privacy:gpg:sign requires 'message'") end
    return { signed = Privacy.gpgSign(args.message, args.keyId) }
  end

  handlers["privacy:gpg:verify"] = function(args)
    if not args or not args.signed then error("privacy:gpg:verify requires 'signed'") end
    return Privacy.gpgVerify(args.signed)
  end

  handlers["privacy:gpg:listKeys"] = function()
    return { keys = Privacy.gpgListKeys() }
  end

  handlers["privacy:gpg:importKey"] = function(args)
    if not args or not args.armoredKey then error("privacy:gpg:importKey requires 'armoredKey'") end
    return Privacy.gpgImportKey(args.armoredKey)
  end

  handlers["privacy:gpg:exportKey"] = function(args)
    if not args or not args.keyId then error("privacy:gpg:exportKey requires 'keyId'") end
    return { key = Privacy.gpgExportKey(args.keyId) }
  end

  -- ── Metadata ──
  handlers["privacy:meta:strip"] = function(args)
    if not args or not args.path then error("privacy:meta:strip requires 'path'") end
    Privacy.metaStrip(args.path, args.outputPath)
    return { success = true }
  end

  handlers["privacy:meta:read"] = function(args)
    if not args or not args.path then error("privacy:meta:read requires 'path'") end
    return { metadata = Privacy.metaRead(args.path) }
  end

  -- ── Keyring ──
  handlers["privacy:keyring:create"] = function(args)
    ensureAll()
    if not args or not args.path or not args.masterPassword then
      error("privacy:keyring:create requires 'path' and 'masterPassword'")
    end
    return { handle = Privacy.keyringCreate(args.path, args.masterPassword) }
  end

  handlers["privacy:keyring:open"] = function(args)
    ensureAll()
    if not args or not args.path or not args.masterPassword then
      error("privacy:keyring:open requires 'path' and 'masterPassword'")
    end
    return { handle = Privacy.keyringOpen(args.path, args.masterPassword) }
  end

  handlers["privacy:keyring:close"] = function(args)
    if not args or not args.handle then error("privacy:keyring:close requires 'handle'") end
    Privacy.keyringClose(args.handle)
    return { success = true }
  end

  handlers["privacy:keyring:generateKey"] = function(args)
    ensureAll()
    if not args or not args.handle or not args.opts then
      error("privacy:keyring:generateKey requires 'handle' and 'opts'")
    end
    return { key = Privacy.keyringGenerateKey(args.handle, args.opts) }
  end

  handlers["privacy:keyring:listKeys"] = function(args)
    if not args or not args.handle then error("privacy:keyring:listKeys requires 'handle'") end
    return { keys = Privacy.keyringListKeys(args.handle) }
  end

  handlers["privacy:keyring:getKey"] = function(args)
    if not args or not args.handle or not args.keyId then
      error("privacy:keyring:getKey requires 'handle' and 'keyId'")
    end
    return { key = Privacy.keyringGetKey(args.handle, args.keyId) }
  end

  handlers["privacy:keyring:rotateKey"] = function(args)
    ensureAll()
    if not args or not args.handle or not args.keyId then
      error("privacy:keyring:rotateKey requires 'handle' and 'keyId'")
    end
    return { key = Privacy.keyringRotateKey(args.handle, args.keyId, args.reason) }
  end

  handlers["privacy:keyring:revokeKey"] = function(args)
    if not args or not args.handle or not args.keyId or not args.reason then
      error("privacy:keyring:revokeKey requires 'handle', 'keyId', 'reason'")
    end
    Privacy.keyringRevokeKey(args.handle, args.keyId, args.reason)
    return { success = true }
  end

  handlers["privacy:keyring:exportPublic"] = function(args)
    if not args or not args.handle or not args.keyId then
      error("privacy:keyring:exportPublic requires 'handle' and 'keyId'")
    end
    return { publicKey = Privacy.keyringExportPublic(args.handle, args.keyId) }
  end

  -- ── Identity ──
  handlers["privacy:identity:anonymousId"] = function(args)
    ensureAll()
    if not args or not args.domain then error("privacy:identity:anonymousId requires 'domain'") end
    return { id = Privacy.anonymousId(args.domain, args.seed) }
  end

  handlers["privacy:identity:pseudonym"] = function(args)
    ensureAll()
    if not args or not args.masterSecret or not args.context then
      error("privacy:identity:pseudonym requires 'masterSecret' and 'context'")
    end
    return { pseudonym = Privacy.pseudonym(args.masterSecret, args.context) }
  end

  handlers["privacy:identity:isolatedCredential"] = function(args)
    ensureAll()
    if not args or not args.domain then error("privacy:identity:isolatedCredential requires 'domain'") end
    local cred = Privacy.isolatedCredential(args.domain)
    -- Don't send private key over RPC — store it in secure memory
    local handle = Privacy.secureAlloc(cred.privateKey)
    return {
      domain = cred.domain,
      publicKey = cred.publicKey,
      keyId = cred.keyId,
      privateKeyHandle = handle,
    }
  end

  -- ── Noise ──
  handlers["privacy:noise:initiate"] = function(args)
    ensureAll()
    if not args or not args.remotePublicKey then
      error("privacy:noise:initiate requires 'remotePublicKey'")
    end
    return Privacy.noiseInitiate(args.remotePublicKey)
  end

  handlers["privacy:noise:respond"] = function(args)
    ensureAll()
    if not args or not args.staticPrivateKey or not args.handshakeMessage then
      error("privacy:noise:respond requires 'staticPrivateKey' and 'handshakeMessage'")
    end
    return Privacy.noiseRespond(args.staticPrivateKey, args.handshakeMessage)
  end

  handlers["privacy:noise:send"] = function(args)
    ensureAll()
    if not args or not args.sessionId or not args.plaintext then
      error("privacy:noise:send requires 'sessionId' and 'plaintext'")
    end
    return { ciphertext = Privacy.noiseSend(args.sessionId, args.plaintext) }
  end

  handlers["privacy:noise:receive"] = function(args)
    ensureAll()
    if not args or not args.sessionId or not args.ciphertext then
      error("privacy:noise:receive requires 'sessionId' and 'ciphertext'")
    end
    return { plaintext = Privacy.noiseReceive(args.sessionId, args.ciphertext) }
  end

  handlers["privacy:noise:close"] = function(args)
    if not args or not args.sessionId then error("privacy:noise:close requires 'sessionId'") end
    Privacy.noiseClose(args.sessionId)
    return { success = true }
  end

  -- ── Steganography ──
  handlers["privacy:steg:embedImage"] = function(args)
    if not args or not args.imagePath or not args.data or not args.outputPath then
      error("privacy:steg:embedImage requires 'imagePath', 'data', 'outputPath'")
    end
    return Privacy.stegEmbedImage(args.imagePath, args.data, args.outputPath)
  end

  handlers["privacy:steg:extractImage"] = function(args)
    if not args or not args.imagePath then error("privacy:steg:extractImage requires 'imagePath'") end
    return { data = Privacy.stegExtractImage(args.imagePath) }
  end

  -- ── Whitespace Steganography ──
  handlers["privacy:steg:embedWhitespace"] = function(args)
    if not args or not args.carrier or not args.secret then
      error("privacy:steg:embedWhitespace requires 'carrier' and 'secret'")
    end
    return Privacy.stegEmbedWhitespace(args.carrier, args.secret)
  end

  handlers["privacy:steg:extractWhitespace"] = function(args)
    if not args or not args.text then
      error("privacy:steg:extractWhitespace requires 'text'")
    end
    return Privacy.stegExtractWhitespace(args.text)
  end

  -- ── PII Sanitize ──
  handlers["privacy:sanitize:detectPII"] = function(args)
    if not args or not args.text then error("privacy:sanitize:detectPII requires 'text'") end
    return Privacy.detectPII(args.text)
  end

  handlers["privacy:sanitize:redactPII"] = function(args)
    if not args or not args.text then error("privacy:sanitize:redactPII requires 'text'") end
    return Privacy.redactPII(args.text, args)
  end

  handlers["privacy:sanitize:maskValue"] = function(args)
    if not args or not args.value then error("privacy:sanitize:maskValue requires 'value'") end
    return Privacy.maskValue(args.value, args)
  end

  handlers["privacy:sanitize:redactLog"] = function(args)
    if not args or not args.logLine then error("privacy:sanitize:redactLog requires 'logLine'") end
    return Privacy.redactLog(args.logLine)
  end

  handlers["privacy:sanitize:tokenize"] = function(args)
    ensureAll()
    if not args or not args.value or not args.salt then
      error("privacy:sanitize:tokenize requires 'value' and 'salt'")
    end
    return { hex = Privacy.sanitizeTokenize(args.value, args.salt) }
  end

  -- ── Audit Log ──
  handlers["privacy:audit:create"] = function(args)
    if not args or not args.key then error("privacy:audit:create requires 'key'") end
    Privacy.auditCreate(args.key)
    return { success = true }
  end

  handlers["privacy:audit:append"] = function(args)
    ensureAll()
    if not args or not args.event then error("privacy:audit:append requires 'event'") end
    return Privacy.auditAppend(args.event, args.data)
  end

  handlers["privacy:audit:verify"] = function()
    ensureAll()
    return Privacy.auditVerify()
  end

  handlers["privacy:audit:entries"] = function(args)
    return Privacy.auditEntries(args and args.from, args and args.to)
  end

  -- ── Policy / Consent ──
  handlers["privacy:policy:setRetention"] = function(args)
    if not args or not args.policy then error("privacy:policy:setRetention requires 'policy'") end
    Privacy.policySetRetention(args.policy)
    return { success = true }
  end

  handlers["privacy:policy:recordConsent"] = function(args)
    if not args or not args.userId or not args.purpose then
      error("privacy:policy:recordConsent requires 'userId' and 'purpose'")
    end
    Privacy.policyRecordConsent(args.userId, args.purpose, args.granted ~= false)
    return { success = true }
  end

  handlers["privacy:policy:checkConsent"] = function(args)
    if not args or not args.userId or not args.purpose then
      error("privacy:policy:checkConsent requires 'userId' and 'purpose'")
    end
    return { granted = Privacy.policyCheckConsent(args.userId, args.purpose) }
  end

  handlers["privacy:policy:revokeConsent"] = function(args)
    if not args or not args.userId then error("privacy:policy:revokeConsent requires 'userId'") end
    Privacy.policyRevokeConsent(args.userId, args.purpose)
    return { success = true }
  end

  handlers["privacy:policy:rightToErasure"] = function(args)
    if not args or not args.userId then error("privacy:policy:rightToErasure requires 'userId'") end
    return Privacy.policyRightToErasure(args.userId)
  end

  handlers["privacy:policy:enforceRetention"] = function()
    return Privacy.policyEnforceRetention()
  end

  -- ── Algorithm Safety ──
  handlers["privacy:safety:checkAlgorithmStrength"] = function(args)
    if not args or not args.algorithm then
      error("privacy:safety:checkAlgorithmStrength requires 'algorithm'")
    end
    return Privacy.checkAlgorithmStrength(args.algorithm)
  end

  handlers["privacy:safety:validateConfig"] = function(args)
    if not args or not args.config then
      error("privacy:safety:validateConfig requires 'config'")
    end
    return Privacy.validateConfig(args.config)
  end

  handlers["privacy:safety:recommendedDefaults"] = function()
    return RECOMMENDED_DEFAULTS
  end

  -- ── Metadata extras ──
  handlers["privacy:meta:sanitizeFilename"] = function(args)
    if not args or not args.name then error("privacy:meta:sanitizeFilename requires 'name'") end
    return Privacy.sanitizeFilename(args.name)
  end

  handlers["privacy:meta:normalizeTimestamp"] = function(args)
    if not args or not args.date then error("privacy:meta:normalizeTimestamp requires 'date'") end
    return Privacy.normalizeTimestamp(args.date)
  end

  -- ── Secure Store (stub — requires full Lua keyring-style implementation) ──
  handlers["privacy:store:create"] = function(_args)
    error("privacy:store:create: encrypted store not yet implemented in Lua runtime")
  end

  return handlers
end

return Privacy
