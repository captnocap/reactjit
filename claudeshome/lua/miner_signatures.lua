--[[
  miner_signatures.lua — Crypto miner detection signature database

  Comprehensive pattern database for detecting cryptocurrency mining code
  across all layers: JavaScript source, native binaries, WASM modules,
  and network protocols.

  This file is the updateable source of truth. Hardcoded fallback patterns
  are also embedded directly in quarantine.lua and the CLI lint rule for
  defense in depth — tampering with this file alone cannot disable detection.

  Confidence model:
    - "hard" triggers quarantine on a single match (exact hash, clear protocol)
    - "composite" triggers require 2+ matches across categories to quarantine
    This reduces false positives while maintaining high recall.

  Sources:
    - XMRig official release SHA-256s (github.com/xmrig/xmrig/releases)
    - Public YARA rulebases (cryptominer detection rules)
    - MalwareBazaar threat intelligence (miner-tagged samples)
    - Academic: MineSweeper (WASM CryptoNight analysis)
    - Quarkslab RandomX security assessment (personalization strings)
    - CryptoNote Stratum protocol documentation
    - G DATA / ANY.RUN sample IOCs (WASM miner fingerprints)

  To add new signatures:
    1. Add entries to the appropriate category table below
    2. Run `make cli-setup` to sync to cli/runtime/
    3. For CartridgeOS: signatures propagate at next cart launch

  Categories:
    - libraries:              Known npm/JS mining package names
    - pool_domains:           Mining pool hostnames (substring match)
    - protocol_markers:       Stratum and mining RPC protocol strings
    - behavioral_patterns:    Code structure patterns (Lua string.find patterns)
    - miner_config_tokens:    Config/CLI strings stable across miner builds
    - binary_hashes:          SHA-256 of known mining release archives
    - malware_sample_hashes:  SHA-256 of known-in-the-wild miner samples
    - symbol_names:           Function/symbol names found in mining binaries
    - randomx_personalization: RandomX-specific personalization/salt strings
    - algorithm_constants:    Byte-level constants from mining algorithms
    - wasm_hashes:            SHA-256 of known mining WASM modules
    - stratum_json_rpc:       CryptoNote Stratum JSON-RPC method/field patterns
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
    -- Stratum protocol URI schemes
    "stratum+tcp://",
    "stratum+ssl://",
    "stratum+tls://",
    "stratum+udp://",
    "stratum://",
    -- Classic Stratum JSON-RPC methods
    "mining.configure",
    "mining.notify",
    "mining.submit",
    "mining.subscribe",
    "mining.authorize",
    "mining.set_target",
    "mining.set_difficulty",
    "mining.set_extranonce",
    -- Job submission patterns in JSON
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

  --- Miner-specific config/CLI tokens stable across builds
  --- Source: YARA rulebases, xmrig documentation
  --- These appear in help text, config files, and binary string tables
  miner_config_tokens = {
    -- XMRig user-agent and branding (survives in binaries)
    "XMRig/%s libuv/",
    "XMRig/",
    -- XMRig CLI flags (appear in help text embedded in binaries)
    "--cpu-affinity",
    "--donate-level",
    "--randomx-init",
    "--randomx-no-numa",
    "--randomx-1gb-pages",
    "--cpu-max-threads-hint",
    -- XMRig interactive console help text
    "'h' hashrate, 'p' pause, 'r' resume",
    -- Config JSON fragments
    "\"algo\": \"cryptonight\"",
    "\"algo\":\"cryptonight\"",
    "\"nicehash\": false",
    "\"nicehash\":false",
    "\"donate-level\"",
    "\"donate-over-proxy\"",
    -- CoinIMP browser miner configuration
    "forceASMJS",
    -- Generic miner config patterns
    "cpuminer",
    "xmrig",
  },

  -- =========================================================================
  -- BINARY-LEVEL PATTERNS
  -- =========================================================================

  --- SHA-256 hashes of official XMRig release archives
  --- Source: github.com/xmrig/xmrig/releases (verbatim SHA-256 sums)
  --- HARD TRIGGER: single match = quarantine (byte-identical upstream release)
  binary_hashes = {
    -- XMRig v6.25.0
    ["1673bfa501aeac47217f6a786da5e9da9f12c831c932e667316f8e49ad0318c1"] = {
      name = "xmrig-6.25.0-focal-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["6ce9151b33b0a2c625fc0e2371efc836f04fa214efaf287646a4c6356a7a860c"] = {
      name = "xmrig-6.25.0-freebsd-static-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["8e6d744526a54d510a66879db3a1cd197c5e60d8bbe01f28e59e6b1af65dca16"] = {
      name = "xmrig-6.25.0-jammy-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["4732cee498a3046519b7f791904f234cdd60d51348e8afe3b13bb256f9586a61"] = {
      name = "xmrig-6.25.0-linux-static-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["a8ae9575ed5259c45b5fd2a6cf99dacae05dcc4a0dd6b7f0ba01f42edeb82f69"] = {
      name = "xmrig-6.25.0-macos-arm64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["4704aad210fefcc86c9d753e3bcf3eac20d7c9ae3806496fd73afd29574ef3c7"] = {
      name = "xmrig-6.25.0-macos-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["55a253500546805b8f8ca5a2f33659f7707e59c74e139cdc12d188ff3be234dd"] = {
      name = "xmrig-6.25.0-noble-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["d2efa485556d67b3d0c1ae39d6c36c7a46afb7d473e0bf258337f933d3b871cc"] = {
      name = "xmrig-6.25.0-windows-arm64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["3d4b59dad84f983b7bc24b4653965ede7d0eed959da16be1cb3920a7d542e128"] = {
      name = "xmrig-6.25.0-windows-gcc-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },
    ["1ad8694cd802e0cd780daf401e5345b3b5d5d2d0440e2a2ad8ee5d16611900f6"] = {
      name = "xmrig-6.25.0-windows-x64",
      source = "github.com/xmrig/xmrig/releases/v6.25.0",
      version = "6.25.0",
    },

    -- XMRig v6.24.0
    ["23b4e8788c92c9b628feda74cb20b9e7afeea2ac6c2202f282c05bd02192b74d"] = {
      name = "xmrig-6.24.0-focal-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["a8685ca003fa7d3a23e8748b72cede8e78a970efd8dc64dc8af46c86f445a6fd"] = {
      name = "xmrig-6.24.0-freebsd-static-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["58d9658ac6e85bb6336b4e4ff3dee011cc6457cf99050cbcd67de10093149770"] = {
      name = "xmrig-6.24.0-jammy-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["129cfbfbe4c37a970abab20202639c1481ed0674ff9420d507f6ca4f2ed7796a"] = {
      name = "xmrig-6.24.0-linux-static-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["fd41f8936c391a668fff282ba8a348d5722f98e1c70d30c5428559787b99348a"] = {
      name = "xmrig-6.24.0-macos-arm64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["cd3026587f710aaa44d58dffeeb7f40cb5acc9d51bebc56f74a578c7fa3d088d"] = {
      name = "xmrig-6.24.0-macos-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["2f223420661789e9ddc263ddbc288366ced5ce1d9184d60d7d2d2468d54df40a"] = {
      name = "xmrig-6.24.0-noble-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["f211aabe350d7e77866720cbf1bd12d8cc6ce544c15572fbf2fa46a10df30f5d"] = {
      name = "xmrig-6.24.0-windows-arm64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["c7714b0ecbcc5ffb79b6bf0f5f8dd846b757004b69885e4ec2fee85ca958ae37"] = {
      name = "xmrig-6.24.0-windows-gcc-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
    ["d0d751a3bc265db85a7bc351a7792068a8c46a002b703624b64b77920f869350"] = {
      name = "xmrig-6.24.0-windows-x64",
      source = "github.com/xmrig/xmrig/releases/v6.24.0",
      version = "6.24.0",
    },
  },

  --- SHA-256 hashes of known-in-the-wild miner samples
  --- Source: public YARA rules, MalwareBazaar, threat intelligence
  --- HARD TRIGGER: single match = quarantine
  malware_sample_hashes = {
    ["5c13a274adb9590249546495446bb6be5f2a08f9dcd2fc8a2049d9dc471135c0"] = {
      name = "cryptominer-yara-sample-1",
      source = "YARA rulebase",
    },
    ["08b55f9b7dafc53dfc43f7f70cdd7048d231767745b76dc4474370fb323d7ae7"] = {
      name = "cryptominer-yara-sample-2",
      source = "YARA rulebase",
    },
    ["f3f2703a7959183b010d808521b531559650f6f347a5830e47f8e3831b10bad5"] = {
      name = "cryptominer-yara-sample-3",
      source = "YARA rulebase",
    },
    ["0972ea3a41655968f063c91a6dbd31788b20e64ff272b27961d12c681e40b2d2"] = {
      name = "cryptominer-yara-sample-4",
      source = "YARA rulebase",
    },
    ["10a72f9882fc0ca141e39277222a8d33aab7f7a4b524c109506a407cd10d738c"] = {
      name = "cryptominer-yara-sample-5",
      source = "YARA rulebase",
    },
    ["ede858683267c61e710e367993f5e589fcb4b4b57b09d023a67ea63084c54a05"] = {
      name = "cryptominer-yara-sample-6",
      source = "YARA rulebase",
    },
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

  --- RandomX personalization strings (high-signal byte patterns)
  --- Source: Quarkslab RandomX security assessment
  --- These are hardcoded salt/key derivation strings inside RandomX.
  --- Unusual in general-purpose software, stable across builds, and
  --- directly tied to algorithm correctness.
  --- COMPOSITE TRIGGER: 2+ of these = strong RandomX indicator
  randomx_personalization = {
    "RandomX\\x03",              -- RANDOMX_ARGON_SALT (with escaped null region)
    "RandomX\003",               -- same, literal byte
    "RandomX AesGenerator1R keys",
    "RandomX AesGenerator4R keys 0-3",
    "RandomX AesGenerator4R keys 4-7",
    "RandomX AesHash1R state",
    "RandomX AesHash1R xkeys",
    "RandomX SuperScalarHash initialize",
  },

  --- Algorithm-level constants found in mining code
  --- These are byte-level patterns from the mathematical core of mining algorithms
  algorithm_constants = {
    -- RandomX constants
    {
      name = "RandomX scratchpad size",
      hex_values = { "00002000", "00000400" },
      description = "RandomX uses a 2MB scratchpad + 256KB cache",
    },
    {
      name = "RandomX dataset size",
      hex_values = { "00000080" },
      description = "RandomX full dataset is exactly 2GB",
    },
    {
      name = "RandomX SuperscalarHash",
      string_values = { "SuperscalarHash", "superscalar_hash" },
      description = "RandomX's unique SuperscalarHash function name",
    },

    -- CryptoNight constants
    {
      name = "CryptoNight scratchpad size",
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
      string_values = {
        "0x0000000000000001",
        "0x0000000000008082",
        "0x800000000000808a",
        "0x8000000080008000",
      },
      description = "Keccak-f[1600] round constants",
    },

    -- AES S-box constants (present in software AES implementations used by miners)
    {
      name = "AES S-box fragment",
      hex_values = { "637c777bf26b6fc530016" },
      description = "AES S-box lookup table fragment",
    },
  },

  -- =========================================================================
  -- WASM-LEVEL PATTERNS
  -- =========================================================================

  --- SHA-256 hashes of known mining WASM modules
  --- Source: G DATA IOCs, ANY.RUN public reports
  --- HARD TRIGGER: single match = quarantine
  wasm_hashes = {
    -- CryptoNight WASM (G DATA IOC)
    ["3f5961a80d3aa7cb06520fd8e89558170936a1a4a3fe16e9fc84c379518c0759"] = {
      name = "cryptonight-wasm-gdata",
      source = "G DATA threat intelligence",
    },
    -- _cryptonight.wasm (ANY.RUN public report)
    ["47d299593572faf8941351f3ef8e46bc18eb684f679d87f9194bb635dd8aabc0"] = {
      name = "cryptonight-wasm-anyrun",
      source = "ANY.RUN public analysis",
    },
  },

  --- WASM section patterns (mining modules often have distinctive structures)
  wasm_patterns = {
    -- Known exported function names in mining WASM modules
    export_names = {
      "_hash_cn",
      "_cryptonight_hash",
      "_hash_cn_dark",
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
      3333, 4444, 5555, 7777, 8888, 9999,
      14433, 14444,
      10034, 10128, 10256,
      18081,
      45700,
    },
  },

  --- CryptoNote Stratum JSON-RPC patterns (for WebSocket frame inspection)
  --- Source: XMRig-proxy protocol documentation, Akamai analysis
  --- These are the specific JSON-RPC methods and fields used by
  --- CryptoNote-family miners communicating with pools.
  --- HARD TRIGGER when seen as JSON-RPC in WebSocket traffic
  stratum_json_rpc = {
    -- Method names (CryptoNote Stratum)
    methods = {
      "login",       -- miner → pool: authenticate with wallet address
      "job",         -- pool → miner: new mining job notification
      "submit",      -- miner → pool: share submission
      "keepalived",  -- miner → pool: keep connection alive
    },
    -- Distinctive field names in Stratum messages
    fields = {
      "job_id",      -- mining job identifier
      "nonce",       -- proof-of-work nonce
      "result",      -- hash result for submitted share
      "params.login",  -- wallet address field
      "params.pass",   -- pool password field
      "params.agent",  -- miner user-agent (often "XMRig/...")
    },
    -- Agent string patterns (miner self-identification)
    agent_patterns = {
      "XMRig/",
      "xmrig/",
      "cpuminer/",
      "ccminer/",
    },
  },
}
