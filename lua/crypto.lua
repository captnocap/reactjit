--[[
  crypto.lua — Cryptography via LuaJIT FFI

  Full crypto suite using battle-tested C libraries:
    - libsodium: SHA-256/512, BLAKE2b, HMAC, XChaCha20/ChaCha20-Poly1305,
                 AES-256-GCM, scrypt, Argon2id, Ed25519, X25519, random bytes
    - libcrypto (OpenSSL): BLAKE2s, PBKDF2
    - libblake3: BLAKE3 hashing

  All crypto operations run in Lua/C via FFI, completely bypassing the
  QuickJS JavaScript runtime. This prevents the bridge stall that occurs
  when doing heavy crypto (scrypt KDF, etc.) in the JS event loop.

  Usage:
    local crypto = require("lua.crypto")
    local handlers = crypto.getHandlers()

  Requires:
    - libsodium (apt install libsodium-dev)
    - libcrypto / OpenSSL (apt install libssl-dev)
    - lib/libblake3.so (make build-blake3)
]]

local ffi = require("ffi")
local bit = require("bit")

local Crypto = {}
Crypto.available = false

-- ============================================================================
-- FFI declarations
-- ============================================================================

-- Guard against duplicate cdef from other modules
local function safe_cdef(decl)
  local ok, err = pcall(ffi.cdef, decl)
  if not ok and not err:match("redefin") then
    error(err)
  end
end

-- ── libsodium ──────────────────────────────────────────

safe_cdef[[
  int sodium_init(void);

  /* Random */
  void randombytes_buf(void *buf, size_t size);

  /* SHA-256 */
  int crypto_hash_sha256(unsigned char *out, const unsigned char *in, unsigned long long inlen);

  /* SHA-512 */
  int crypto_hash_sha512(unsigned char *out, const unsigned char *in, unsigned long long inlen);

  /* BLAKE2b (generic hash) */
  int crypto_generichash(unsigned char *out, size_t outlen,
                         const unsigned char *in, unsigned long long inlen,
                         const unsigned char *key, size_t keylen);

  /* HMAC-SHA256 */
  typedef struct crypto_auth_hmacsha256_state {
    unsigned char opaque[208];
  } crypto_auth_hmacsha256_state;
  int crypto_auth_hmacsha256_init(crypto_auth_hmacsha256_state *state,
                                  const unsigned char *key, size_t keylen);
  int crypto_auth_hmacsha256_update(crypto_auth_hmacsha256_state *state,
                                    const unsigned char *in, unsigned long long inlen);
  int crypto_auth_hmacsha256_final(crypto_auth_hmacsha256_state *state, unsigned char *out);

  /* HMAC-SHA512 */
  typedef struct crypto_auth_hmacsha512_state {
    unsigned char opaque[416];
  } crypto_auth_hmacsha512_state;
  int crypto_auth_hmacsha512_init(crypto_auth_hmacsha512_state *state,
                                  const unsigned char *key, size_t keylen);
  int crypto_auth_hmacsha512_update(crypto_auth_hmacsha512_state *state,
                                    const unsigned char *in, unsigned long long inlen);
  int crypto_auth_hmacsha512_final(crypto_auth_hmacsha512_state *state, unsigned char *out);

  /* XChaCha20-Poly1305 (IETF AEAD) */
  size_t crypto_aead_xchacha20poly1305_ietf_keybytes(void);
  size_t crypto_aead_xchacha20poly1305_ietf_npubbytes(void);
  size_t crypto_aead_xchacha20poly1305_ietf_abytes(void);
  int crypto_aead_xchacha20poly1305_ietf_encrypt(
    unsigned char *c, unsigned long long *clen_p,
    const unsigned char *m, unsigned long long mlen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *nsec, const unsigned char *npub, const unsigned char *k);
  int crypto_aead_xchacha20poly1305_ietf_decrypt(
    unsigned char *m, unsigned long long *mlen_p,
    unsigned char *nsec,
    const unsigned char *c, unsigned long long clen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *npub, const unsigned char *k);

  /* ChaCha20-Poly1305 (IETF AEAD) */
  size_t crypto_aead_chacha20poly1305_ietf_npubbytes(void);
  size_t crypto_aead_chacha20poly1305_ietf_abytes(void);
  int crypto_aead_chacha20poly1305_ietf_encrypt(
    unsigned char *c, unsigned long long *clen_p,
    const unsigned char *m, unsigned long long mlen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *nsec, const unsigned char *npub, const unsigned char *k);
  int crypto_aead_chacha20poly1305_ietf_decrypt(
    unsigned char *m, unsigned long long *mlen_p,
    unsigned char *nsec,
    const unsigned char *c, unsigned long long clen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *npub, const unsigned char *k);

  /* AES-256-GCM */
  int crypto_aead_aes256gcm_is_available(void);
  size_t crypto_aead_aes256gcm_npubbytes(void);
  size_t crypto_aead_aes256gcm_abytes(void);
  int crypto_aead_aes256gcm_encrypt(
    unsigned char *c, unsigned long long *clen_p,
    const unsigned char *m, unsigned long long mlen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *nsec, const unsigned char *npub, const unsigned char *k);
  int crypto_aead_aes256gcm_decrypt(
    unsigned char *m, unsigned long long *mlen_p,
    unsigned char *nsec,
    const unsigned char *c, unsigned long long clen,
    const unsigned char *ad, unsigned long long adlen,
    const unsigned char *npub, const unsigned char *k);

  /* scrypt KDF */
  int crypto_pwhash_scryptsalsa208sha256_ll(
    const uint8_t *passwd, size_t passwdlen,
    const uint8_t *salt, size_t saltlen,
    uint64_t N, uint32_t r, uint32_t p,
    uint8_t *buf, size_t buflen);

  /* Argon2id KDF */
  int crypto_pwhash(unsigned char *out, unsigned long long outlen,
                    const char *passwd, unsigned long long passwdlen,
                    const unsigned char *salt,
                    unsigned long long opslimit, size_t memlimit, int alg);
  size_t crypto_pwhash_saltbytes(void);
  int crypto_pwhash_alg_default(void);
  int crypto_pwhash_alg_argon2id13(void);

  /* Ed25519 signing */
  size_t crypto_sign_publickeybytes(void);
  size_t crypto_sign_secretkeybytes(void);
  size_t crypto_sign_seedbytes(void);
  size_t crypto_sign_bytes(void);
  int crypto_sign_seed_keypair(unsigned char *pk, unsigned char *sk, const unsigned char *seed);
  int crypto_sign_detached(unsigned char *sig, unsigned long long *siglen_p,
                           const unsigned char *m, unsigned long long mlen,
                           const unsigned char *sk);
  int crypto_sign_verify_detached(const unsigned char *sig,
                                  const unsigned char *m, unsigned long long mlen,
                                  const unsigned char *pk);
  int crypto_sign_ed25519_sk_to_pk(unsigned char *pk, const unsigned char *sk);

  /* X25519 DH */
  size_t crypto_scalarmult_bytes(void);
  size_t crypto_scalarmult_scalarbytes(void);
  int crypto_scalarmult_base(unsigned char *q, const unsigned char *n);
  int crypto_scalarmult(unsigned char *q, const unsigned char *n, const unsigned char *p);

  /* Hex encoding */
  char *sodium_bin2hex(char *hex, size_t hex_maxlen,
                       const unsigned char *bin, size_t bin_len);
  int sodium_hex2bin(unsigned char *bin, size_t bin_maxlen,
                     const char *hex, size_t hex_len,
                     const char *ignore, size_t *bin_len, const char **hex_end);

  /* Base64 encoding */
  size_t sodium_base64_encoded_len(size_t bin_len, int variant);
  char *sodium_bin2base64(char *b64, size_t b64_maxlen,
                          const unsigned char *bin, size_t bin_len, int variant);
  int sodium_base642bin(unsigned char *bin, size_t bin_maxlen,
                        const char *b64, size_t b64_len,
                        const char *ignore, size_t *bin_len, const char **b64_end,
                        int variant);

  /* Constant-time comparison */
  int sodium_memcmp(const void *b1, const void *b2, size_t len);

  /* Memory zeroing */
  void sodium_memzero(void *pnt, size_t len);
]]

-- ── OpenSSL libcrypto ──────────────────────────────────

safe_cdef[[
  /* EVP digest interface — for BLAKE2s */
  typedef struct evp_md_ctx_st EVP_MD_CTX;
  typedef struct evp_md_st EVP_MD;
  typedef struct engine_st ENGINE;

  const EVP_MD *EVP_blake2s256(void);
  EVP_MD_CTX *EVP_MD_CTX_new(void);
  void EVP_MD_CTX_free(EVP_MD_CTX *ctx);
  int EVP_DigestInit_ex(EVP_MD_CTX *ctx, const EVP_MD *type, ENGINE *impl);
  int EVP_DigestUpdate(EVP_MD_CTX *ctx, const void *d, size_t cnt);
  int EVP_DigestFinal_ex(EVP_MD_CTX *ctx, unsigned char *md, unsigned int *s);

  /* PBKDF2 */
  int PKCS5_PBKDF2_HMAC(const char *pass, int passlen,
                         const unsigned char *salt, int saltlen,
                         int iter, const EVP_MD *digest,
                         int keylen, unsigned char *out);
  const EVP_MD *EVP_sha256(void);
  const EVP_MD *EVP_sha512(void);
]]

-- ── BLAKE3 ─────────────────────────────────────────────

safe_cdef[[
  typedef struct {
    uint32_t key[8];
    /* chunk state */
    uint32_t cv[8];
    uint64_t chunk_counter;
    uint8_t buf[64];
    uint8_t buf_len;
    uint8_t blocks_compressed;
    uint8_t flags;
    /* stack */
    uint8_t cv_stack_len;
    uint8_t cv_stack[1760];
  } blake3_hasher;

  void blake3_hasher_init(blake3_hasher *self);
  void blake3_hasher_update(blake3_hasher *self, const void *input, size_t input_len);
  void blake3_hasher_finalize(const blake3_hasher *self, uint8_t *out, size_t out_len);
]]

-- ============================================================================
-- Load libraries
-- ============================================================================

local sodium, crypto_lib, blake3

-- libsodium
local function loadSodium()
  local paths = { "sodium", "libsodium.so.23", "libsodium.so" }
  -- Try project-local lib/ first
  local cwd = love and love.filesystem.getSource() or "."
  table.insert(paths, 1, cwd .. "/lib/libsodium.so")
  for _, p in ipairs(paths) do
    local ok, lib = pcall(ffi.load, p)
    if ok then return lib end
  end
  return nil
end

-- OpenSSL libcrypto
local function loadCrypto()
  local paths = { "crypto", "libcrypto.so.3", "libcrypto.so" }
  local cwd = love and love.filesystem.getSource() or "."
  table.insert(paths, 1, cwd .. "/lib/libcrypto.so")
  for _, p in ipairs(paths) do
    local ok, lib = pcall(ffi.load, p)
    if ok then return lib end
  end
  return nil
end

-- BLAKE3
local function loadBlake3()
  local paths = {}
  local cwd = love and love.filesystem.getSource() or "."
  table.insert(paths, cwd .. "/lib/libblake3.so")
  table.insert(paths, "blake3")
  table.insert(paths, "libblake3.so")
  for _, p in ipairs(paths) do
    local ok, lib = pcall(ffi.load, p)
    if ok then return lib end
  end
  return nil
end

sodium = loadSodium()
if not sodium then
  io.write("[crypto] libsodium not found — crypto module disabled\n"); io.flush()
  return Crypto
end

if sodium.sodium_init() < 0 then
  io.write("[crypto] sodium_init() failed — crypto module disabled\n"); io.flush()
  return Crypto
end

crypto_lib = loadCrypto()
if not crypto_lib then
  io.write("[crypto] libcrypto (OpenSSL) not found — BLAKE2s and PBKDF2 unavailable\n"); io.flush()
end

blake3 = loadBlake3()
if not blake3 then
  io.write("[crypto] libblake3 not found — BLAKE3 unavailable\n"); io.flush()
end

Crypto.available = true

-- Base64 variant constants (libsodium)
local BASE64_VARIANT_ORIGINAL = 1

-- ============================================================================
-- Helpers
-- ============================================================================

local function bin2hex(buf, len)
  local hexlen = len * 2 + 1
  local hexbuf = ffi.new("char[?]", hexlen)
  sodium.sodium_bin2hex(hexbuf, hexlen, buf, len)
  return ffi.string(hexbuf, len * 2)
end

local function hex2bin(hexstr)
  local hexlen = #hexstr
  local binlen = math.floor(hexlen / 2)
  local bin = ffi.new("unsigned char[?]", binlen)
  local actual_len = ffi.new("size_t[1]")
  local ret = sodium.sodium_hex2bin(bin, binlen, hexstr, hexlen, nil, actual_len, nil)
  if ret ~= 0 then error("hex2bin failed") end
  return bin, tonumber(actual_len[0])
end

local function bin2base64(buf, len)
  local b64len = tonumber(sodium.sodium_base64_encoded_len(len, BASE64_VARIANT_ORIGINAL))
  local b64buf = ffi.new("char[?]", b64len)
  sodium.sodium_bin2base64(b64buf, b64len, buf, len, BASE64_VARIANT_ORIGINAL)
  -- Strip trailing null
  local s = ffi.string(b64buf)
  return s
end

local function base642bin(b64str)
  local maxlen = math.floor(#b64str * 3 / 4) + 4
  local bin = ffi.new("unsigned char[?]", maxlen)
  local actual_len = ffi.new("size_t[1]")
  local ret = sodium.sodium_base642bin(bin, maxlen, b64str, #b64str,
                                       nil, actual_len, nil, BASE64_VARIANT_ORIGINAL)
  if ret ~= 0 then error("base642bin failed") end
  return bin, tonumber(actual_len[0])
end

local function randombytes(n)
  local buf = ffi.new("unsigned char[?]", n)
  sodium.randombytes_buf(buf, n)
  return buf
end

-- ============================================================================
-- Hash functions
-- ============================================================================

function Crypto.sha256(input)
  local out = ffi.new("unsigned char[32]")
  sodium.crypto_hash_sha256(out, input, #input)
  return { hex = bin2hex(out, 32), base64 = bin2base64(out, 32) }
end

function Crypto.sha512(input)
  local out = ffi.new("unsigned char[64]")
  sodium.crypto_hash_sha512(out, input, #input)
  return { hex = bin2hex(out, 64), base64 = bin2base64(out, 64) }
end

function Crypto.blake2b(input, outputBytes)
  outputBytes = outputBytes or 32
  if outputBytes < 16 or outputBytes > 64 then
    error("BLAKE2b output must be 16-64 bytes")
  end
  local out = ffi.new("unsigned char[?]", outputBytes)
  local ret = sodium.crypto_generichash(out, outputBytes, input, #input, nil, 0)
  if ret ~= 0 then error("BLAKE2b hash failed") end
  return { hex = bin2hex(out, outputBytes), base64 = bin2base64(out, outputBytes) }
end

function Crypto.blake2s(input)
  if not crypto_lib then error("BLAKE2s requires OpenSSL libcrypto") end
  local md = crypto_lib.EVP_blake2s256()
  local ctx = crypto_lib.EVP_MD_CTX_new()
  if ctx == nil then error("EVP_MD_CTX_new failed") end

  local out = ffi.new("unsigned char[32]")
  local outlen = ffi.new("unsigned int[1]")
  local ok = true

  if crypto_lib.EVP_DigestInit_ex(ctx, md, nil) ~= 1 then ok = false end
  if ok and crypto_lib.EVP_DigestUpdate(ctx, input, #input) ~= 1 then ok = false end
  if ok and crypto_lib.EVP_DigestFinal_ex(ctx, out, outlen) ~= 1 then ok = false end

  crypto_lib.EVP_MD_CTX_free(ctx)
  if not ok then error("BLAKE2s hash failed") end

  local len = tonumber(outlen[0])
  return { hex = bin2hex(out, len), base64 = bin2base64(out, len) }
end

function Crypto.blake3_hash(input, outputBytes)
  if not blake3 then error("BLAKE3 requires libblake3") end
  outputBytes = outputBytes or 32
  local hasher = ffi.new("blake3_hasher")
  blake3.blake3_hasher_init(hasher)
  blake3.blake3_hasher_update(hasher, input, #input)
  local out = ffi.new("uint8_t[?]", outputBytes)
  blake3.blake3_hasher_finalize(hasher, out, outputBytes)
  return { hex = bin2hex(out, outputBytes), base64 = bin2base64(out, outputBytes) }
end

-- ============================================================================
-- HMAC
-- ============================================================================

function Crypto.hmac_sha256(key, message)
  local state = ffi.new("crypto_auth_hmacsha256_state")
  if sodium.crypto_auth_hmacsha256_init(state, key, #key) ~= 0 then
    error("HMAC-SHA256 init failed")
  end
  if sodium.crypto_auth_hmacsha256_update(state, message, #message) ~= 0 then
    error("HMAC-SHA256 update failed")
  end
  local out = ffi.new("unsigned char[32]")
  if sodium.crypto_auth_hmacsha256_final(state, out) ~= 0 then
    error("HMAC-SHA256 final failed")
  end
  return { hex = bin2hex(out, 32), base64 = bin2base64(out, 32) }
end

function Crypto.hmac_sha512(key, message)
  local state = ffi.new("crypto_auth_hmacsha512_state")
  if sodium.crypto_auth_hmacsha512_init(state, key, #key) ~= 0 then
    error("HMAC-SHA512 init failed")
  end
  if sodium.crypto_auth_hmacsha512_update(state, message, #message) ~= 0 then
    error("HMAC-SHA512 update failed")
  end
  local out = ffi.new("unsigned char[64]")
  if sodium.crypto_auth_hmacsha512_final(state, out) ~= 0 then
    error("HMAC-SHA512 final failed")
  end
  return { hex = bin2hex(out, 64), base64 = bin2base64(out, 64) }
end

-- ============================================================================
-- AEAD encryption / decryption
-- ============================================================================

local AEAD = {}

AEAD["xchacha20-poly1305"] = {
  nonce_bytes = function() return tonumber(sodium.crypto_aead_xchacha20poly1305_ietf_npubbytes()) end,
  tag_bytes = function() return tonumber(sodium.crypto_aead_xchacha20poly1305_ietf_abytes()) end,
  encrypt = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt,
  decrypt = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt,
}

AEAD["chacha20-poly1305"] = {
  nonce_bytes = function() return tonumber(sodium.crypto_aead_chacha20poly1305_ietf_npubbytes()) end,
  tag_bytes = function() return tonumber(sodium.crypto_aead_chacha20poly1305_ietf_abytes()) end,
  encrypt = sodium.crypto_aead_chacha20poly1305_ietf_encrypt,
  decrypt = sodium.crypto_aead_chacha20poly1305_ietf_decrypt,
}

if sodium.crypto_aead_aes256gcm_is_available() ~= 0 then
  AEAD["aes-256-gcm"] = {
    nonce_bytes = function() return tonumber(sodium.crypto_aead_aes256gcm_npubbytes()) end,
    tag_bytes = function() return tonumber(sodium.crypto_aead_aes256gcm_abytes()) end,
    encrypt = sodium.crypto_aead_aes256gcm_encrypt,
    decrypt = sodium.crypto_aead_aes256gcm_decrypt,
  }
else
  io.write("[crypto] AES-256-GCM not available (no AES-NI) — using ChaCha20/XChaCha20 only\n")
  io.flush()
end

local function aead_encrypt(plaintext, key, algo)
  algo = algo or "xchacha20-poly1305"
  local aead = AEAD[algo]
  if not aead then error("Unsupported AEAD algorithm: " .. tostring(algo)) end

  local nonce_len = aead.nonce_bytes()
  local tag_len = aead.tag_bytes()
  local nonce = randombytes(nonce_len)
  local ct_len = #plaintext + tag_len
  local ct = ffi.new("unsigned char[?]", ct_len)
  local actual_len = ffi.new("unsigned long long[1]")

  local ret = aead.encrypt(ct, actual_len, plaintext, #plaintext,
                           nil, 0, nil, nonce, key)
  if ret ~= 0 then error("AEAD encrypt failed") end

  return ct, tonumber(actual_len[0]), nonce, nonce_len
end

local function aead_decrypt(ciphertext, ct_len, nonce, nonce_len, key, algo)
  algo = algo or "xchacha20-poly1305"
  local aead = AEAD[algo]
  if not aead then error("Unsupported AEAD algorithm: " .. tostring(algo)) end

  local pt_maxlen = ct_len
  local pt = ffi.new("unsigned char[?]", pt_maxlen > 0 and pt_maxlen or 1)
  local actual_len = ffi.new("unsigned long long[1]")

  local ret = aead.decrypt(pt, actual_len, nil,
                           ciphertext, ct_len, nil, 0, nonce, key)
  if ret ~= 0 then error("AEAD decrypt failed — wrong password or corrupted data") end

  return ffi.string(pt, tonumber(actual_len[0]))
end

-- ============================================================================
-- KDF (Key Derivation)
-- ============================================================================

local function derive_key_scrypt(password, salt, salt_len, params)
  local N = params.N or 131072  -- 2^17
  local r = params.r or 8
  local p = params.p or 1
  local key = ffi.new("uint8_t[32]")
  local ret = sodium.crypto_pwhash_scryptsalsa208sha256_ll(
    password, #password, salt, salt_len, N, r, p, key, 32)
  if ret ~= 0 then error("scrypt KDF failed") end
  return key
end

local function derive_key_argon2id(password, salt, salt_len, params)
  local opslimit = params.opslimit or 2  -- moderate
  local memlimit = params.memlimit or 67108864  -- 64 MB
  local key = ffi.new("unsigned char[32]")
  local alg = sodium.crypto_pwhash_alg_argon2id13()
  local ret = sodium.crypto_pwhash(key, 32, password, #password, salt, opslimit, memlimit, alg)
  if ret ~= 0 then error("Argon2id KDF failed") end
  return key
end

local function derive_key_pbkdf2(password, salt, salt_len, params)
  if not crypto_lib then error("PBKDF2 requires OpenSSL libcrypto") end
  local iterations = params.iterations or 100000
  local digest = crypto_lib.EVP_sha256()
  local key = ffi.new("unsigned char[32]")
  local ret = crypto_lib.PKCS5_PBKDF2_HMAC(password, #password, salt, salt_len,
                                             iterations, digest, 32, key)
  if ret ~= 1 then error("PBKDF2 failed") end
  return key
end

-- ============================================================================
-- Password-based encryption
-- ============================================================================

function Crypto.encrypt(plaintext, password, options)
  options = options or {}
  local algo = options.algorithm or "xchacha20-poly1305"
  local kdf_type = options.kdf or "argon2id"
  local kdf_params = options.kdfParams or {}

  -- Generate salt
  local salt_len = 32
  local salt = randombytes(salt_len)

  -- Derive key
  local key
  if kdf_type == "scrypt" then
    key = derive_key_scrypt(password, salt, salt_len, kdf_params)
  elseif kdf_type == "argon2id" then
    key = derive_key_argon2id(password, salt, salt_len, kdf_params)
  elseif kdf_type == "pbkdf2" then
    key = derive_key_pbkdf2(password, salt, salt_len, kdf_params)
  else
    error("Unsupported KDF: " .. tostring(kdf_type))
  end

  -- Encrypt
  local ct, ct_len, nonce, nonce_len = aead_encrypt(plaintext, key, algo)

  -- Build response envelope (base64-encoded, JSON-serializable)
  local result = {
    algorithm = algo,
    ciphertext = bin2base64(ct, ct_len),
    nonce = bin2base64(nonce, nonce_len),
    salt = bin2base64(salt, salt_len),
    kdf = kdf_type,
    kdfParams = {},
  }

  if kdf_type == "scrypt" then
    result.kdfParams = {
      N = kdf_params.N or 131072,
      r = kdf_params.r or 8,
      p = kdf_params.p or 1,
    }
  elseif kdf_type == "argon2id" then
    result.kdfParams = {
      opslimit = kdf_params.opslimit or 2,
      memlimit = kdf_params.memlimit or 67108864,
    }
  elseif kdf_type == "pbkdf2" then
    result.kdfParams = {
      iterations = kdf_params.iterations or 100000,
    }
  end

  -- Zero the key
  sodium.sodium_memzero(key, 32)

  return result
end

function Crypto.decrypt(data, password)
  -- Decode base64 fields
  local salt, salt_len = base642bin(data.salt)
  local nonce, nonce_len = base642bin(data.nonce)
  local ct, ct_len = base642bin(data.ciphertext)

  local algo = data.algorithm or "xchacha20-poly1305"
  local kdf_type = data.kdf or "argon2id"
  local kdf_params = data.kdfParams or {}

  -- Derive key
  local key
  if kdf_type == "scrypt" then
    key = derive_key_scrypt(password, salt, salt_len, kdf_params)
  elseif kdf_type == "argon2id" then
    key = derive_key_argon2id(password, salt, salt_len, kdf_params)
  elseif kdf_type == "pbkdf2" then
    key = derive_key_pbkdf2(password, salt, salt_len, kdf_params)
  else
    error("Unsupported KDF: " .. tostring(kdf_type))
  end

  -- Decrypt
  local plaintext = aead_decrypt(ct, ct_len, nonce, nonce_len, key, algo)

  -- Zero the key
  sodium.sodium_memzero(key, 32)

  return plaintext
end

-- ============================================================================
-- Raw encryption (no KDF — caller manages key)
-- ============================================================================

function Crypto.encryptRaw(plaintext_hex, key_hex, algo)
  algo = algo or "xchacha20-poly1305"
  local pt, pt_len = hex2bin(plaintext_hex)
  local key, key_len = hex2bin(key_hex)
  if key_len ~= 32 then error("Key must be 32 bytes (64 hex chars)") end

  local ct, ct_len, nonce, nonce_len = aead_encrypt(
    ffi.string(pt, pt_len), key, algo)

  return {
    ciphertext = bin2hex(ct, ct_len),
    nonce = bin2hex(nonce, nonce_len),
  }
end

function Crypto.decryptRaw(ciphertext_hex, key_hex, nonce_hex, algo)
  algo = algo or "xchacha20-poly1305"
  local ct, ct_len = hex2bin(ciphertext_hex)
  local key, key_len = hex2bin(key_hex)
  local nonce, nonce_len = hex2bin(nonce_hex)
  if key_len ~= 32 then error("Key must be 32 bytes (64 hex chars)") end

  local plaintext = aead_decrypt(
    ffi.string(ct, ct_len), ct_len, nonce, nonce_len, key, algo)

  local pt_buf = ffi.cast("const unsigned char *", plaintext)
  return { plaintext = bin2hex(pt_buf, #plaintext) }
end

-- ============================================================================
-- Ed25519 signing
-- ============================================================================

function Crypto.generateSigningKeys()
  local seed = randombytes(32)
  local pk = ffi.new("unsigned char[32]")
  local sk = ffi.new("unsigned char[64]")
  if sodium.crypto_sign_seed_keypair(pk, sk, seed) ~= 0 then
    error("Ed25519 keypair generation failed")
  end
  local result = {
    publicKey = bin2hex(pk, 32),
    privateKey = bin2hex(sk, 64),
    curve = "ed25519",
  }
  sodium.sodium_memzero(sk, 64)
  return result
end

function Crypto.sign(privateKeyHex, message)
  local sk, sk_len = hex2bin(privateKeyHex)
  if sk_len ~= 64 then error("Ed25519 secret key must be 64 bytes (128 hex chars)") end

  local sig = ffi.new("unsigned char[64]")
  local siglen = ffi.new("unsigned long long[1]")
  if sodium.crypto_sign_detached(sig, siglen, message, #message, sk) ~= 0 then
    error("Ed25519 sign failed")
  end

  -- Extract public key from secret key
  local pk = ffi.new("unsigned char[32]")
  sodium.crypto_sign_ed25519_sk_to_pk(pk, sk)

  return {
    message = message,
    signature = bin2hex(sig, 64),
    publicKey = bin2hex(pk, 32),
    algorithm = "ed25519",
  }
end

function Crypto.verify(message, signatureHex, publicKeyHex)
  local sig, sig_len = hex2bin(signatureHex)
  local pk, pk_len = hex2bin(publicKeyHex)
  if sig_len ~= 64 then error("Ed25519 signature must be 64 bytes") end
  if pk_len ~= 32 then error("Ed25519 public key must be 32 bytes") end

  local ret = sodium.crypto_sign_verify_detached(sig, message, #message, pk)
  return ret == 0
end

-- ============================================================================
-- X25519 Diffie-Hellman
-- ============================================================================

function Crypto.generateDHKeys()
  local sk = randombytes(32)
  local pk = ffi.new("unsigned char[32]")
  if sodium.crypto_scalarmult_base(pk, sk) ~= 0 then
    error("X25519 keypair generation failed")
  end
  local result = {
    publicKey = bin2hex(pk, 32),
    privateKey = bin2hex(sk, 32),
    curve = "x25519",
  }
  sodium.sodium_memzero(sk, 32)
  return result
end

function Crypto.diffieHellman(privateKeyHex, publicKeyHex)
  local sk, sk_len = hex2bin(privateKeyHex)
  local pk, pk_len = hex2bin(publicKeyHex)
  if sk_len ~= 32 then error("X25519 private key must be 32 bytes") end
  if pk_len ~= 32 then error("X25519 public key must be 32 bytes") end

  local shared = ffi.new("unsigned char[32]")
  if sodium.crypto_scalarmult(shared, sk, pk) ~= 0 then
    error("X25519 DH failed")
  end
  local result = bin2hex(shared, 32)
  sodium.sodium_memzero(sk, 32)
  sodium.sodium_memzero(shared, 32)
  return result
end

-- ============================================================================
-- Random / Tokens
-- ============================================================================

function Crypto.randomToken(bytes)
  bytes = bytes or 32
  local buf = randombytes(bytes)
  return bin2hex(buf, bytes)
end

function Crypto.randomBase64(bytes)
  bytes = bytes or 32
  local buf = randombytes(bytes)
  return bin2base64(buf, bytes)
end

function Crypto.randomId(length)
  length = length or 16
  local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  local nchars = #chars
  local buf = randombytes(length)
  local result = {}
  for i = 0, length - 1 do
    local idx = (buf[i] % nchars) + 1
    result[i + 1] = chars:sub(idx, idx)
  end
  return table.concat(result)
end

function Crypto.randomBytesHex(count)
  count = count or 32
  local buf = randombytes(count)
  return bin2hex(buf, count)
end

-- ============================================================================
-- Constant-time comparison
-- ============================================================================

function Crypto.timingSafeEqual(a, b)
  if #a ~= #b then return false end
  return sodium.sodium_memcmp(a, b, #a) == 0
end

-- ============================================================================
-- RPC handlers
-- ============================================================================

function Crypto.getHandlers()
  local handlers = {}

  -- Hash
  handlers["crypto:hash"] = function(args)
    if not args or not args.input then error("crypto:hash requires 'input'") end
    local algo = args.algorithm or "sha256"
    if algo == "sha256" then
      return Crypto.sha256(args.input)
    elseif algo == "sha512" then
      return Crypto.sha512(args.input)
    elseif algo == "blake2b" then
      return Crypto.blake2b(args.input, args.outputBytes)
    elseif algo == "blake2s" then
      return Crypto.blake2s(args.input)
    elseif algo == "blake3" then
      return Crypto.blake3_hash(args.input, args.outputBytes)
    else
      error("Unsupported hash algorithm: " .. tostring(algo))
    end
  end

  -- HMAC
  handlers["crypto:hmac"] = function(args)
    if not args or not args.key or not args.message then
      error("crypto:hmac requires 'key' and 'message'")
    end
    local algo = args.algorithm or "sha256"
    if algo == "sha256" then
      return Crypto.hmac_sha256(args.key, args.message)
    elseif algo == "sha512" then
      return Crypto.hmac_sha512(args.key, args.message)
    else
      error("Unsupported HMAC algorithm: " .. tostring(algo))
    end
  end

  -- Encrypt (password-based)
  handlers["crypto:encrypt"] = function(args)
    if not args or not args.plaintext or not args.password then
      error("crypto:encrypt requires 'plaintext' and 'password'")
    end
    return Crypto.encrypt(args.plaintext, args.password, {
      algorithm = args.algorithm,
      kdf = args.kdf,
      kdfParams = args.kdfParams,
    })
  end

  -- Decrypt
  handlers["crypto:decrypt"] = function(args)
    if not args or not args.data or not args.password then
      error("crypto:decrypt requires 'data' and 'password'")
    end
    return { plaintext = Crypto.decrypt(args.data, args.password) }
  end

  -- Raw encrypt
  handlers["crypto:encryptRaw"] = function(args)
    if not args or not args.plaintext or not args.key then
      error("crypto:encryptRaw requires 'plaintext' and 'key' (hex)")
    end
    return Crypto.encryptRaw(args.plaintext, args.key, args.algorithm)
  end

  -- Raw decrypt
  handlers["crypto:decryptRaw"] = function(args)
    if not args or not args.ciphertext or not args.key or not args.nonce then
      error("crypto:decryptRaw requires 'ciphertext', 'key', and 'nonce' (hex)")
    end
    return Crypto.decryptRaw(args.ciphertext, args.key, args.nonce, args.algorithm)
  end

  -- Sign
  handlers["crypto:sign"] = function(args)
    if not args or not args.privateKey or not args.message then
      error("crypto:sign requires 'privateKey' and 'message'")
    end
    return Crypto.sign(args.privateKey, args.message)
  end

  -- Verify
  handlers["crypto:verify"] = function(args)
    if not args or not args.message or not args.signature or not args.publicKey then
      error("crypto:verify requires 'message', 'signature', and 'publicKey'")
    end
    return { valid = Crypto.verify(args.message, args.signature, args.publicKey) }
  end

  -- Generate signing keys
  handlers["crypto:generateSigningKeys"] = function()
    return Crypto.generateSigningKeys()
  end

  -- Generate DH keys
  handlers["crypto:generateDHKeys"] = function()
    return Crypto.generateDHKeys()
  end

  -- Diffie-Hellman
  handlers["crypto:diffieHellman"] = function(args)
    if not args or not args.privateKey or not args.publicKey then
      error("crypto:diffieHellman requires 'privateKey' and 'publicKey'")
    end
    return { sharedSecret = Crypto.diffieHellman(args.privateKey, args.publicKey) }
  end

  -- Random tokens
  handlers["crypto:randomToken"] = function(args)
    return { token = Crypto.randomToken(args and args.bytes) }
  end

  handlers["crypto:randomBase64"] = function(args)
    return { token = Crypto.randomBase64(args and args.bytes) }
  end

  handlers["crypto:randomId"] = function(args)
    return { id = Crypto.randomId(args and args.length) }
  end

  handlers["crypto:randomBytes"] = function(args)
    local count = args and args.count or 32
    return { bytes = Crypto.randomBytesHex(count) }
  end

  -- Timing-safe compare
  handlers["crypto:timingSafeEqual"] = function(args)
    if not args or not args.a or not args.b then
      error("crypto:timingSafeEqual requires 'a' and 'b'")
    end
    return { equal = Crypto.timingSafeEqual(args.a, args.b) }
  end

  return handlers
end

io.write("[crypto] Loaded — libsodium")
if crypto_lib then io.write(" + libcrypto") end
if blake3 then io.write(" + libblake3") end
io.write("\n"); io.flush()

return Crypto
