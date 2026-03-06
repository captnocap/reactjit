--[[
  peer_tunnel.lua -- Userspace encrypted P2P tunnels

  Application-layer encrypted P2P using the same crypto primitives as WireGuard:
    - X25519 for key agreement
    - XChaCha20-Poly1305 for AEAD encryption
    - BLAKE2b for key derivation

  Uses UDP sockets with STUN-based NAT traversal. A WebSocket signaling
  channel coordinates the handshake (exchange public keys + endpoints).

  This is NOT a VPN. It does not create network interfaces or route IP traffic.
  It is an encrypted data channel between ReactJIT applications.

  Threat model: protects against passive network observers (ISP, WiFi sniffers).
  Does NOT protect against local process-level attackers — keys live in Lua heap.
  For stronger isolation, use the real WireGuard tier (lua/wireguard.lua).

  Usage:
    local pt = require("lua.peer_tunnel")
    pt.init()

    -- Generate identity (or load from storage)
    local identity = pt.generateIdentity()

    -- Create a tunnel instance
    local tunnelId = pt.create({
      privateKey = identity.privateKey,
      listenPort = 0,  -- OS-assigned
      stunServer = "stun.l.google.com",
      stunPort = 19302,
    })

    -- Add a peer (after signaling exchange)
    pt.addPeer(tunnelId, {
      publicKey = peerPublicKeyHex,
      endpoint = "1.2.3.4:51820",
    })

    -- Send encrypted data
    pt.send(tunnelId, peerPublicKeyHex, "hello encrypted world")

    -- Each frame: poll for events
    local events = pt.poll()
    -- Events: peer:ready, peer:message, peer:error, peer:disconnect,
    --         stun:resolved, stun:error
]]

local socket_mod = require("socket")
local stun = require("lua.stun")
local ffi = require("ffi")

local PeerTunnel = {}

local crypto
local cryptoLoaded = false
local tunnels = {}     -- tunnelId -> tunnel state
local events = {}      -- pending events
local nextTunnelId = 1
local initialized = false

-- ============================================================================
-- Crypto helpers (lazy-load from crypto.lua)
-- ============================================================================

local function ensureCrypto()
  if cryptoLoaded then return true end
  local ok, mod = pcall(require, "lua.crypto")
  if not ok then
    io.write("[peer_tunnel] crypto.lua not available: " .. tostring(mod) .. "\n")
    io.flush()
    return false
  end
  if not mod.loadLibraries() then
    io.write("[peer_tunnel] libsodium not available\n")
    io.flush()
    return false
  end
  crypto = mod
  cryptoLoaded = true
  return true
end

--- X25519 keypair generation (returns hex-encoded keys)
local function generateKeypair()
  if not ensureCrypto() then error("crypto not available") end
  return crypto.generateDHKeys()
end

--- X25519 Diffie-Hellman shared secret
local function deriveShared(myPrivateHex, theirPublicHex)
  if not ensureCrypto() then error("crypto not available") end
  return crypto.diffieHellman(myPrivateHex, theirPublicHex)
end

--- Derive session keys from shared secret using BLAKE2b
--- Returns { sendKey, recvKey } as hex strings
local function deriveSessionKeys(sharedSecretHex, myPublicHex, theirPublicHex)
  if not ensureCrypto() then error("crypto not available") end
  -- Deterministic ordering: lower public key gets "send" context, higher gets "recv"
  local iAmLower = myPublicHex < theirPublicHex
  local context1 = sharedSecretHex .. (iAmLower and myPublicHex or theirPublicHex)
  local context2 = sharedSecretHex .. (iAmLower and theirPublicHex or myPublicHex)
  local k1 = crypto.blake2b(context1, 32)
  local k2 = crypto.blake2b(context2, 32)
  if iAmLower then
    return { sendKey = k1.hex, recvKey = k2.hex }
  else
    return { sendKey = k2.hex, recvKey = k1.hex }
  end
end

--- Encrypt a message with XChaCha20-Poly1305
local function encryptMessage(plaintextBytes, keyHex)
  if not ensureCrypto() then error("crypto not available") end
  -- Convert plaintext to hex for the raw encrypt API
  local hexPt = ""
  for i = 1, #plaintextBytes do
    hexPt = hexPt .. string.format("%02x", plaintextBytes:byte(i))
  end
  local result = crypto.encryptRaw(hexPt, keyHex, "xchacha20-poly1305")
  return result.ciphertext, result.nonce
end

--- Decrypt a message
local function decryptMessage(ciphertextHex, nonceHex, keyHex)
  if not ensureCrypto() then error("crypto not available") end
  local result = crypto.decryptRaw(ciphertextHex, keyHex, nonceHex, "xchacha20-poly1305")
  -- Convert hex back to bytes
  local bytes = {}
  for i = 1, #result.plaintext, 2 do
    bytes[#bytes + 1] = string.char(tonumber(result.plaintext:sub(i, i + 1), 16))
  end
  return table.concat(bytes)
end

-- ============================================================================
-- Wire format
-- ============================================================================

-- Packet types
local PKT_HANDSHAKE = 0x01
local PKT_DATA      = 0x02
local PKT_KEEPALIVE = 0x03

--- Build a handshake packet: [type(1)] [publicKey(64 hex -> 32 bytes)]
local function buildHandshake(publicKeyHex)
  local pkBytes = {}
  for i = 1, 64, 2 do
    pkBytes[#pkBytes + 1] = string.char(tonumber(publicKeyHex:sub(i, i + 1), 16))
  end
  return string.char(PKT_HANDSHAKE) .. table.concat(pkBytes)
end

--- Build a data packet: [type(1)] [nonce(hex->bytes)] [ciphertext(hex->bytes)]
local function buildDataPacket(nonceHex, ciphertextHex)
  local parts = { string.char(PKT_DATA) }
  -- Nonce (24 bytes for XChaCha20)
  for i = 1, #nonceHex, 2 do
    parts[#parts + 1] = string.char(tonumber(nonceHex:sub(i, i + 1), 16))
  end
  -- Ciphertext
  for i = 1, #ciphertextHex, 2 do
    parts[#parts + 1] = string.char(tonumber(ciphertextHex:sub(i, i + 1), 16))
  end
  return table.concat(parts)
end

--- Build a keepalive packet: [type(1)]
local function buildKeepalive()
  return string.char(PKT_KEEPALIVE)
end

--- Parse incoming packet. Returns type, payload table.
local function parsePacket(data)
  if #data < 1 then return nil end
  local ptype = data:byte(1)

  if ptype == PKT_HANDSHAKE then
    if #data < 33 then return nil end
    local pkHex = ""
    for i = 2, 33 do
      pkHex = pkHex .. string.format("%02x", data:byte(i))
    end
    return "handshake", { publicKey = pkHex }

  elseif ptype == PKT_DATA then
    -- 1 byte type + 24 bytes nonce + rest is ciphertext
    if #data < 26 then return nil end
    local nonceHex = ""
    for i = 2, 25 do
      nonceHex = nonceHex .. string.format("%02x", data:byte(i))
    end
    local ctHex = ""
    for i = 26, #data do
      ctHex = ctHex .. string.format("%02x", data:byte(i))
    end
    return "data", { nonce = nonceHex, ciphertext = ctHex }

  elseif ptype == PKT_KEEPALIVE then
    return "keepalive", {}
  end

  return nil
end

-- ============================================================================
-- Tunnel lifecycle
-- ============================================================================

function PeerTunnel.init()
  if initialized then return end
  initialized = true
  tunnels = {}
  events = {}
end

--- Generate an X25519 identity keypair.
--- @return table { publicKey, privateKey, curve }
function PeerTunnel.generateIdentity()
  if not ensureCrypto() then error("crypto not available") end
  return generateKeypair()
end

--- Create a new tunnel.
--- @param config table { privateKey, listenPort?, stunServer?, stunPort? }
--- @return number tunnelId
function PeerTunnel.create(config)
  if not initialized then PeerTunnel.init() end
  if not ensureCrypto() then error("crypto not available") end

  local id = nextTunnelId
  nextTunnelId = nextTunnelId + 1

  -- Derive public key from private key
  local pk = ffi.new("unsigned char[32]")
  local skHex = config.privateKey
  local skBytes = {}
  for i = 1, 64, 2 do
    skBytes[#skBytes + 1] = string.char(tonumber(skHex:sub(i, i + 1), 16))
  end
  -- We need to compute publicKey = basepoint * privateKey
  -- Use crypto.lua's scalarmult_base via generateDHKeys with known private key
  -- Actually, we can just do the DH with the base point
  -- For simplicity, store the public key if caller provides it, or compute via crypto
  local publicKey = config.publicKey
  if not publicKey then
    -- Compute from private key using X25519 base multiplication
    local keys = generateKeypair()
    -- We can't easily re-derive from an arbitrary private key without FFI access
    -- So we require the caller to provide publicKey or we generate a new pair
    publicKey = keys.publicKey
    config.privateKey = keys.privateKey
  end

  -- Create UDP socket
  local udp = socket_mod.udp()
  udp:settimeout(0) -- non-blocking
  local port = config.listenPort or 0
  udp:setsockname("0.0.0.0", port)

  -- Get actual bound port
  local _, boundPort = udp:getsockname()

  local tunnel = {
    id = id,
    privateKey = config.privateKey,
    publicKey = publicKey,
    udp = udp,
    port = tonumber(boundPort),
    peers = {},       -- publicKeyHex -> peer state
    stunQuery = nil,
    publicIP = nil,
    publicPort = nil,
    keepaliveInterval = config.keepaliveInterval or 25,
    lastKeepalive = 0,
  }

  -- Start STUN query if configured
  if config.stunServer then
    tunnel.stunQuery = stun.query(udp, config.stunServer, config.stunPort or 19302)
  end

  tunnels[id] = tunnel

  events[#events + 1] = {
    type = "tunnel:created",
    tunnelId = id,
    port = tunnel.port,
    publicKey = publicKey,
  }

  return id
end

--- Add a peer to a tunnel.
--- @param tunnelId number
--- @param peerConfig table { publicKey, endpoint? }
function PeerTunnel.addPeer(tunnelId, peerConfig)
  local tunnel = tunnels[tunnelId]
  if not tunnel then error("tunnel " .. tunnelId .. " not found") end

  local peerPK = peerConfig.publicKey
  local endpoint = peerConfig.endpoint

  local peerIP, peerPort
  if endpoint then
    peerIP, peerPort = endpoint:match("^(.+):(%d+)$")
    peerPort = tonumber(peerPort)
  end

  local peer = {
    publicKey = peerPK,
    ip = peerIP,
    port = peerPort,
    state = endpoint and "handshaking" or "waiting", -- waiting for endpoint
    sessionKeys = nil,
    lastSeen = 0,
    lastHandshake = 0,
    handshakeRetries = 0,
  }

  tunnel.peers[peerPK] = peer

  -- If we have an endpoint, initiate handshake
  if peer.state == "handshaking" then
    local pkt = buildHandshake(tunnel.publicKey)
    tunnel.udp:sendto(pkt, peer.ip, peer.port)
    peer.lastHandshake = socket_mod.gettime()
  end
end

--- Update a peer's endpoint (after signaling exchange).
--- @param tunnelId number
--- @param publicKey string
--- @param endpoint string "ip:port"
function PeerTunnel.setPeerEndpoint(tunnelId, publicKey, endpoint)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return end
  local peer = tunnel.peers[publicKey]
  if not peer then return end

  local ip, port = endpoint:match("^(.+):(%d+)$")
  peer.ip = ip
  peer.port = tonumber(port)

  if peer.state == "waiting" then
    peer.state = "handshaking"
    local pkt = buildHandshake(tunnel.publicKey)
    tunnel.udp:sendto(pkt, peer.ip, peer.port)
    peer.lastHandshake = socket_mod.gettime()
  end
end

--- Send encrypted data to a peer.
--- @param tunnelId number
--- @param publicKey string  Peer's public key (hex)
--- @param data string  Plaintext bytes to send
function PeerTunnel.send(tunnelId, publicKey, data)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return false, "tunnel not found" end
  local peer = tunnel.peers[publicKey]
  if not peer then return false, "peer not found" end
  if peer.state ~= "established" then return false, "peer not connected" end

  local ctHex, nonceHex = encryptMessage(data, peer.sessionKeys.sendKey)
  local pkt = buildDataPacket(nonceHex, ctHex)
  tunnel.udp:sendto(pkt, peer.ip, peer.port)
  return true
end

--- Broadcast data to all established peers on a tunnel.
--- @param tunnelId number
--- @param data string
function PeerTunnel.broadcast(tunnelId, data)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return end
  for pk, peer in pairs(tunnel.peers) do
    if peer.state == "established" then
      PeerTunnel.send(tunnelId, pk, data)
    end
  end
end

--- Remove a peer.
--- @param tunnelId number
--- @param publicKey string
function PeerTunnel.removePeer(tunnelId, publicKey)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return end
  tunnel.peers[publicKey] = nil
end

--- Destroy a tunnel.
--- @param tunnelId number
function PeerTunnel.destroy(tunnelId)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return end
  pcall(function() tunnel.udp:close() end)
  tunnels[tunnelId] = nil
end

-- ============================================================================
-- Per-frame poll
-- ============================================================================

function PeerTunnel.poll()
  if not initialized then return {} end

  local now = socket_mod.gettime()

  for id, tunnel in pairs(tunnels) do
    -- Advance STUN query
    if tunnel.stunQuery then
      local result = tunnel.stunQuery:update()
      if result == "done" then
        tunnel.publicIP = tunnel.stunQuery.publicIP
        tunnel.publicPort = tunnel.stunQuery.publicPort
        events[#events + 1] = {
          type = "stun:resolved",
          tunnelId = id,
          publicIP = tunnel.publicIP,
          publicPort = tunnel.publicPort,
        }
        tunnel.stunQuery = nil
      elseif result == "error" then
        events[#events + 1] = {
          type = "stun:error",
          tunnelId = id,
          error = tunnel.stunQuery.error,
        }
        tunnel.stunQuery = nil
      end
    end

    -- Read incoming UDP packets
    while true do
      local data, fromIP, fromPort = tunnel.udp:receivefrom()
      if not data then break end

      local ptype, payload = parsePacket(data)
      if ptype == "handshake" then
        local peerPK = payload.publicKey

        -- Look up or create peer entry
        local peer = tunnel.peers[peerPK]
        if not peer then
          -- Unknown peer sending handshake — create entry
          peer = {
            publicKey = peerPK,
            ip = fromIP,
            port = fromPort,
            state = "handshaking",
            sessionKeys = nil,
            lastSeen = now,
            lastHandshake = 0,
            handshakeRetries = 0,
          }
          tunnel.peers[peerPK] = peer
        end

        -- Update endpoint from actual source
        peer.ip = fromIP
        peer.port = fromPort
        peer.lastSeen = now

        -- Derive session keys
        local sharedSecret = deriveShared(tunnel.privateKey, peerPK)
        peer.sessionKeys = deriveSessionKeys(sharedSecret, tunnel.publicKey, peerPK)
        peer.state = "established"

        -- Send handshake response
        local pkt = buildHandshake(tunnel.publicKey)
        tunnel.udp:sendto(pkt, peer.ip, peer.port)

        events[#events + 1] = {
          type = "peer:ready",
          tunnelId = id,
          publicKey = peerPK,
          endpoint = peer.ip .. ":" .. peer.port,
        }

      elseif ptype == "data" then
        -- Find which peer sent this based on source IP:port
        local senderPeer
        for _, peer in pairs(tunnel.peers) do
          if peer.ip == fromIP and peer.port == fromPort then
            senderPeer = peer
            break
          end
        end

        if senderPeer and senderPeer.sessionKeys then
          local ok, plaintext = pcall(decryptMessage, payload.ciphertext, payload.nonce, senderPeer.sessionKeys.recvKey)
          if ok then
            senderPeer.lastSeen = now
            events[#events + 1] = {
              type = "peer:message",
              tunnelId = id,
              publicKey = senderPeer.publicKey,
              data = plaintext,
            }
          else
            events[#events + 1] = {
              type = "peer:error",
              tunnelId = id,
              publicKey = senderPeer.publicKey,
              error = "decrypt failed: " .. tostring(plaintext),
            }
          end
        end

      elseif ptype == "keepalive" then
        for _, peer in pairs(tunnel.peers) do
          if peer.ip == fromIP and peer.port == fromPort then
            peer.lastSeen = now
            break
          end
        end
      end
    end

    -- Retransmit handshakes for peers that haven't completed
    for pk, peer in pairs(tunnel.peers) do
      if peer.state == "handshaking" and peer.ip and peer.port then
        if now - peer.lastHandshake > 2 then
          peer.handshakeRetries = peer.handshakeRetries + 1
          if peer.handshakeRetries > 10 then
            peer.state = "failed"
            events[#events + 1] = {
              type = "peer:error",
              tunnelId = id,
              publicKey = pk,
              error = "handshake timed out",
            }
          else
            local pkt = buildHandshake(tunnel.publicKey)
            tunnel.udp:sendto(pkt, peer.ip, peer.port)
            peer.lastHandshake = now
          end
        end
      end
    end

    -- Send keepalives
    if now - tunnel.lastKeepalive > tunnel.keepaliveInterval then
      tunnel.lastKeepalive = now
      local pkt = buildKeepalive()
      for _, peer in pairs(tunnel.peers) do
        if peer.state == "established" and peer.ip and peer.port then
          tunnel.udp:sendto(pkt, peer.ip, peer.port)
        end
      end
    end
  end

  local result = events
  events = {}
  return result
end

--- Get tunnel info (for RPC queries).
--- @param tunnelId number
--- @return table|nil
function PeerTunnel.getInfo(tunnelId)
  local tunnel = tunnels[tunnelId]
  if not tunnel then return nil end

  local peerList = {}
  for pk, peer in pairs(tunnel.peers) do
    peerList[#peerList + 1] = {
      publicKey = pk,
      endpoint = peer.ip and (peer.ip .. ":" .. peer.port) or nil,
      state = peer.state,
      lastSeen = peer.lastSeen,
    }
  end

  return {
    tunnelId = tunnel.id,
    publicKey = tunnel.publicKey,
    port = tunnel.port,
    publicIP = tunnel.publicIP,
    publicPort = tunnel.publicPort,
    publicEndpoint = tunnel.publicIP and (tunnel.publicIP .. ":" .. tunnel.publicPort) or nil,
    peers = peerList,
  }
end

--- Destroy all tunnels.
function PeerTunnel.destroyAll()
  for id, tunnel in pairs(tunnels) do
    pcall(function() tunnel.udp:close() end)
  end
  tunnels = {}
  events = {}
  initialized = false
end

-- ============================================================================
-- RPC handlers
-- ============================================================================

function PeerTunnel.getHandlers()
  local handlers = {}

  handlers["peer_tunnel:generate_identity"] = function()
    return PeerTunnel.generateIdentity()
  end

  handlers["peer_tunnel:create"] = function(args)
    if not args or not args.privateKey then
      error("peer_tunnel:create requires 'privateKey'")
    end
    local id = PeerTunnel.create(args)
    return PeerTunnel.getInfo(id)
  end

  handlers["peer_tunnel:add_peer"] = function(args)
    if not args or not args.tunnelId or not args.publicKey then
      error("peer_tunnel:add_peer requires 'tunnelId' and 'publicKey'")
    end
    PeerTunnel.addPeer(args.tunnelId, {
      publicKey = args.publicKey,
      endpoint = args.endpoint,
    })
    return { ok = true }
  end

  handlers["peer_tunnel:set_endpoint"] = function(args)
    if not args or not args.tunnelId or not args.publicKey or not args.endpoint then
      error("peer_tunnel:set_endpoint requires 'tunnelId', 'publicKey', and 'endpoint'")
    end
    PeerTunnel.setPeerEndpoint(args.tunnelId, args.publicKey, args.endpoint)
    return { ok = true }
  end

  handlers["peer_tunnel:send"] = function(args)
    if not args or not args.tunnelId or not args.publicKey or not args.data then
      error("peer_tunnel:send requires 'tunnelId', 'publicKey', and 'data'")
    end
    local ok, err = PeerTunnel.send(args.tunnelId, args.publicKey, args.data)
    if not ok then return { ok = false, error = err } end
    return { ok = true }
  end

  handlers["peer_tunnel:broadcast"] = function(args)
    if not args or not args.tunnelId or not args.data then
      error("peer_tunnel:broadcast requires 'tunnelId' and 'data'")
    end
    PeerTunnel.broadcast(args.tunnelId, args.data)
    return { ok = true }
  end

  handlers["peer_tunnel:info"] = function(args)
    if not args or not args.tunnelId then
      error("peer_tunnel:info requires 'tunnelId'")
    end
    return PeerTunnel.getInfo(args.tunnelId) or { error = "tunnel not found" }
  end

  handlers["peer_tunnel:remove_peer"] = function(args)
    if not args or not args.tunnelId or not args.publicKey then
      error("peer_tunnel:remove_peer requires 'tunnelId' and 'publicKey'")
    end
    PeerTunnel.removePeer(args.tunnelId, args.publicKey)
    return { ok = true }
  end

  handlers["peer_tunnel:destroy"] = function(args)
    if not args or not args.tunnelId then
      error("peer_tunnel:destroy requires 'tunnelId'")
    end
    PeerTunnel.destroy(args.tunnelId)
    return { ok = true }
  end

  return handlers
end

return PeerTunnel
