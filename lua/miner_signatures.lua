--[[
  miner_signatures.lua — Crypto miner detection signature database

  Comprehensive pattern database for detecting cryptocurrency mining code
  across all layers: JavaScript source, native binaries, WASM modules,
  and network protocols.

  This file is the updateable source of truth. Hardcoded fallback patterns
  are also embedded directly in quarantine.lua and the CLI lint rule for
  defense in depth — tampering with this file alone cannot disable detection.

  To add new signatures:
    1. Add entries to the appropriate category table below
    2. Run `make cli-setup` to sync to cli/runtime/
    3. For CartridgeOS: signatures propagate at next cart launch

  Categories:
    - libraries:            Known npm/JS mining package names
    - pool_domains:         Mining pool hostnames (substring match)
    - protocol_markers:     Stratum and mining RPC protocol strings
    - behavioral_patterns:  Code structure patterns (Lua string.find patterns)
    - binary_hashes:        SHA-256 of known mining binaries
    - symbol_names:         Function/symbol names found in mining binaries
    - algorithm_constants:  Byte-level constants from mining algorithms
    - wasm_hashes:          SHA-256 of known mining WASM modules
]]

return {

  -- =========================================================================
  -- JS-LEVEL PATTERNS
  -- =========================================================================

  --- Known mining library / npm package names (lowercase, substring match)
  libraries = {
    -- Browser miners (defunct and active)
    "coinhive",
    "coin-hive",
    "coinimp",
    "crypto-loot",
    "cryptoloot",
    "deepminer",
    "jsecoin",
    "perfektstart",
    "monerominer",
    "minero",
    "webmr",
    "webmine",
    "mineralt",
    "cryptonight-wasm",
    "cryptonight-asmjs",
    "xmr-miner",
    "nicehash",
    -- Node.js miners
    "node-cryptonight",
    "node-xmr",
    "xmrig-node",
    "node-multi-hashing",
    -- Generic patterns
    "browser-miner",
    "webminer",
    "browserminer",
  },

  --- Known mining pool domains (substring match on URLs/strings)
  pool_domains = {
    -- Major Monero pools
    "moneroocean.stream",
    "gulf.moneroocean.stream",
    "supportxmr.com",
    "minexmr.com",
    "xmrpool.eu",
    "hashvault.pro",
    "herominers.com",
    "nanopool.org",
    "dwarfpool.com",
    "pool.minergate.com",
    "xmr.pool.zcash.co",
    "mine.zpool.ca",
    "p2pool.io",
    "miningocean.org",
    -- Browser miner services (mostly defunct but patterns still in the wild)
    "coinhive.com",
    "coin-hive.com",
    "authedmine.com",
    "crypto-loot.com",
    "cryptoloot.pro",
    "2giga.link",
    "webmine.cz",
    "minr.pw",
    -- Multi-algo pools
    "unmineable.com",
    "prohashing.com",
    "miningpoolhub.com",
    "zpool.ca",
    "zergpool.com",
    "mining-dutch.nl",
    -- Bitcoin pools (for completeness)
    "antpool.com",
    "f2pool.com",
    "poolin.com",
    "btc.com/pool",
    "viabtc.com",
    "slushpool.com",
    "braiins.com/pool",
    -- Stratum proxy services
    "stratum.slushpool.com",
    "xmr-us-east1.nanopool.org",
    "xmr-eu1.nanopool.org",
    "xmr-asia1.nanopool.org",
    -- Known malicious pool proxies
    "webassembly.stream",
    "www.datasecu.download",
    "www.hostingcloud.download",
  },

  --- Mining protocol markers (exact or substring match)
  protocol_markers = {
    -- Stratum protocol
    "stratum+tcp://",
    "stratum+ssl://",
    "stratum+tls://",
    "stratum://",
    -- JSON-RPC mining methods
    "mining.configure",
    "mining.notify",
    "mining.submit",
    "mining.subscribe",
    "mining.authorize",
    "mining.set_target",
    "mining.set_difficulty",
    -- Stratum v2
    "mining.set_extranonce",
    -- Job submission patterns
    "\"method\":\"submit\"",
    "\"method\":\"login\"",
  },

  --- Behavioral code patterns (Lua string.find patterns)
  --- These match structural patterns in mining code, not just strings
  behavioral_patterns = {
    -- Algorithm names
    "CryptoNight",
    "cryptonight",
    "RandomX",
    "randomx",
    "Ethash",
    "ethash",
    "Equihash",
    "equihash",
    "Scrypt",
    "KawPow",
    "kawpow",
    "ProgPow",
    "progpow",
    -- Mining terminology in code
    "hashrate",
    "hash_rate",
    "hashRate",
    "nonce.*submit",
    "submit.*nonce",
    "mining.*pool",
    "pool.*mining",
    "stratum.*proxy",
    "miner.*wasm",
    "wasm.*miner",
    "mining.*worker",
    "worker.*mining",
    -- Throttle patterns (miners try to hide CPU usage)
    "throttle.*mining",
    "mining.*throttle",
    "cpuThrottle",
    "cpu_throttle",
    -- Hardware detection for mining
    "hardwareConcurrency.*miner",
    "hardwareConcurrency.*hash",
    "hardwareConcurrency.*thread.*mining",
  },

  -- =========================================================================
  -- BINARY-LEVEL PATTERNS
  -- =========================================================================

  --- SHA-256 hashes of known mining binaries (.so, .dll, .dylib)
  --- Format: hash = { name = "...", source = "...", version = "..." }
  --- Populate with Gemini deep research + manual verification
  binary_hashes = {
    -- xmrig releases — add SHA-256 of libxmrig.so, xmrig binary, etc.
    -- Example entry (populate with actual hashes):
    -- ["abc123..."] = {
    --   name = "xmrig-6.21.0-linux-x64",
    --   source = "github.com/xmrig/xmrig/releases",
    --   version = "6.21.0",
    -- },

    -- p2pool releases
    -- ["def456..."] = { name = "p2pool-v3.10-linux-x64", ... },

    -- Known malicious mining libraries
    -- These will be populated from threat intelligence feeds
  },

  --- Function/symbol names found in mining ELF binaries
  --- These survive in symbol tables and string sections even in stripped binaries
  symbol_names = {
    -- xmrig core functions
    "rx_slow_hash",
    "cn_slow_hash",
    "cryptonight_hash",
    "cryptonight_double_hash",
    "cryptonight_triple_hash",
    "cryptonight_quad_hash",
    -- RandomX functions
    "randomx_create_vm",
    "randomx_calculate_hash",
    "randomx_calculate_hash_first",
    "randomx_calculate_hash_next",
    "randomx_calculate_hash_last",
    "randomx_create_cache",
    "randomx_init_cache",
    "randomx_create_dataset",
    "randomx_init_dataset",
    "randomx_dataset_init",
    "randomx_alloc_cache",
    "randomx_alloc_dataset",
    "randomx_release_cache",
    "randomx_release_dataset",
    "randomx_destroy_vm",
    "randomx_vm_set_cache",
    "randomx_vm_set_dataset",
    "randomx_get_flags",
    "randomx_set_flags",
    -- CryptoNight functions
    "cn_aes_pseudo_round",
    "cn_aes_single_round",
    "cn_implode_scratchpad",
    "cn_explode_scratchpad",
    "CryptoNight_hash",
    -- Argon2 (used by RandomX)
    "argon2_hash",
    "argon2d_hash_raw",
    "argon2id_hash_raw",
    "argon2_fill_segment",
    "argon2_fill_memory_blocks",
    -- Blake2b (used by RandomX)
    "blake2b_init",
    "blake2b_update",
    "blake2b_final",
    "blake2b_long",
    -- AES-NI intrinsics wrappers (common in miners)
    "soft_aes_round",
    "aes_round",
    "aesenc",
    "aesdec",
    -- xmrig configuration
    "xmrig_algo",
    "xmrig_config",
    -- Mining pool communication
    "stratum_connect",
    "stratum_send",
    "stratum_recv",
    "pool_connect",
    "submit_share",
    "submit_result",
    "mining_submit",
    -- Multi-hashing (common in mining libraries)
    "scryptn_hash",
    "scrypt_hash",
    "yescrypt_hash",
    "equihash_verify",
    "ethash_compute",
    "kawpow_compute",
    "progpow_hash",
  },

  --- Algorithm-level constants found in mining code
  --- These are byte-level patterns from the mathematical core of mining algorithms
  algorithm_constants = {
    -- RandomX constants
    {
      name = "RandomX scratchpad size",
      -- 2MB (2097152 = 0x200000) and 256KB (262144 = 0x40000)
      -- These appear as immediate values in the code
      hex_values = { "00002000", "00000400" },  -- big-endian representations
      description = "RandomX uses a 2MB scratchpad + 256KB cache",
    },
    {
      name = "RandomX dataset size",
      -- 2GB dataset (2147483648 = 0x80000000)
      hex_values = { "00000080" },  -- upper 32 bits
      description = "RandomX full dataset is exactly 2GB",
    },
    {
      name = "RandomX SuperscalarHash",
      -- Number of rounds and register count are distinctive
      string_values = { "SuperscalarHash", "superscalar_hash" },
      description = "RandomX's unique SuperscalarHash function name",
    },

    -- CryptoNight constants
    {
      name = "CryptoNight scratchpad size",
      -- 2MB = 2097152 = 0x200000 (same as RandomX but different context)
      -- CryptoNight variants use 1MB or 2MB
      hex_values = { "00002000", "00001000" },
      description = "CryptoNight 2MB or 1MB scratchpad allocation",
    },
    {
      name = "CryptoNight iteration count",
      -- CryptoNight: 524288 iterations (0x80000)
      -- CryptoNight-Lite: 262144 (0x40000)
      -- CryptoNight-Heavy: 786432 (0xC0000)
      hex_values = { "00080000", "00040000", "000C0000" },
      description = "CryptoNight main loop iteration counts (variant-specific)",
    },

    -- Keccak constants (used by CryptoNight and RandomX)
    {
      name = "Keccak round constants",
      -- First few Keccak-f[1600] round constants (distinctive 64-bit values)
      string_values = {
        "0x0000000000000001",
        "0x0000000000008082",
        "0x800000000000808a",
        "0x8000000080008000",
      },
      description = "Keccak-f[1600] round constants — present in all CryptoNight implementations",
    },

    -- AES S-box constants (present in software AES implementations used by miners)
    {
      name = "AES S-box fragment",
      -- First 16 bytes of the AES S-box (distinctive pattern)
      -- 63 7c 77 7b f2 6b 6f c5 30 01 67 2b fe d7 ab 76
      hex_values = { "637c777bf26b6fc530016" },
      description = "AES S-box lookup table fragment — present in software AES implementations",
    },
  },

  -- =========================================================================
  -- WASM-LEVEL PATTERNS
  -- =========================================================================

  --- SHA-256 hashes of known mining WASM modules
  --- Format: hash = { name = "...", source = "..." }
  wasm_hashes = {
    -- Populate from Gemini research + threat intelligence
    -- Example:
    -- ["abc123..."] = { name = "coinhive-wasm-v7", source = "coinhive.com" },
  },

  --- WASM section patterns (mining modules often have distinctive structures)
  wasm_patterns = {
    -- Known exported function names in mining WASM modules
    export_names = {
      "_hash_cn",
      "_cryptonight_hash",
      "_hash_cn_dark",
      "_hash",       -- too generic alone, but combined with other signals...
      "hash_cn",
      "randomx_hash",
      "cn_hash",
    },
  },

  -- =========================================================================
  -- NETWORK PATTERNS (for runtime URL/WebSocket monitoring)
  -- =========================================================================

  --- Patterns checked against WebSocket URLs and fetch destinations at runtime
  network_patterns = {
    -- WebSocket mining pool patterns
    ws_indicators = {
      "stratum",
      "mining",
      "pool",
      "miner",
      "/proxy",
    },
    -- Port numbers commonly used by mining pools
    mining_ports = {
      3333, 4444, 5555, 7777, 8888, 9999,   -- common stratum ports
      14433, 14444,                           -- SSL stratum
      10034, 10128, 10256,                    -- moneroocean
      18081,                                  -- Monero RPC (legitimate, but context matters)
      45700,                                  -- common alt-pool port
    },
  },
}
