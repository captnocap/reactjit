--[[
  media.lua — Media library scanner + indexer

  Scans directories for media files, classifies them by type,
  and optionally indexes archive contents using the archive module.

  Provides RPC handlers for directory scanning, type detection,
  and archive-aware file indexing.

  Uses: love.filesystem, os.execute for real filesystem access,
        archive.lua for looking inside rar/zip/7z/tar archives.
]]

local ok_json, json = pcall(require, "json")
if not ok_json then ok_json, json = pcall(require, "lib.json") end

local ok_archive, archive = pcall(require, "lua.archive")
if not ok_archive or not archive.available then
  archive = nil
end

local Media = {}

-- ============================================================================
-- File type classification
-- ============================================================================

local MEDIA_TYPES = {
  -- Video
  mp4 = "video", mkv = "video", avi = "video", mov = "video", wmv = "video",
  webm = "video", flv = "video", m4v = "video", mpg = "video", mpeg = "video",
  ts = "video", vob = "video", ogv = "video", ["3gp"] = "video",

  -- Audio
  mp3 = "audio", flac = "audio", ogg = "audio", wav = "audio", aac = "audio",
  m4a = "audio", wma = "audio", opus = "audio", aiff = "audio", ape = "audio",
  alac = "audio",

  -- Image
  jpg = "image", jpeg = "image", png = "image", gif = "image", bmp = "image",
  webp = "image", svg = "image", tiff = "image", tif = "image", ico = "image",
  heic = "image", heif = "image", avif = "image", raw = "image",

  -- Subtitle
  srt = "subtitle", ass = "subtitle", ssa = "subtitle", sub = "subtitle",
  vtt = "subtitle", idx = "subtitle",

  -- Document
  pdf = "document", epub = "document", mobi = "document", djvu = "document",
  txt = "document", md = "document", doc = "document", docx = "document",
  rtf = "document", odt = "document",

  -- Archive
  zip = "archive", rar = "archive", ["7z"] = "archive", tar = "archive",
  gz = "archive", bz2 = "archive", xz = "archive", zst = "archive",
  iso = "archive", cab = "archive", lz4 = "archive",

  -- NFO / metadata
  nfo = "metadata", nfo = "metadata", xml = "metadata",
}

local ARCHIVE_EXTENSIONS = {
  zip = true, rar = true, ["7z"] = true, tar = true,
  gz = true, bz2 = true, xz = true, iso = true, cab = true,
}

---Classify a filename by extension.
---@param filename string
---@return string type One of: video, audio, image, subtitle, document, archive, metadata, unknown
function Media.classify(filename)
  local ext = filename:match("%.([^%.]+)$")
  if ext then
    ext = ext:lower()
    -- Handle compound extensions like .tar.gz
    local compound = filename:match("%.tar%.(%w+)$")
    if compound then return "archive" end
    return MEDIA_TYPES[ext] or "unknown"
  end
  return "unknown"
end

---Check if a file is an archive that we can look inside.
---@param filename string
---@return boolean
function Media.isArchive(filename)
  local ext = filename:match("%.([^%.]+)$")
  if ext then return ARCHIVE_EXTENSIONS[ext:lower()] or false end
  return false
end

-- ============================================================================
-- Directory scanning via os/io (real filesystem, not Love2D sandbox)
-- ============================================================================

---Scan a directory for files. Uses `find` on Linux/macOS.
---@param dirpath string Absolute directory path
---@param recursive boolean? Whether to recurse (default true)
---@param maxDepth number? Maximum recursion depth (default 10)
---@return table[] Array of { path, name, size, mtime, type }
function Media.scanDirectory(dirpath, recursive, maxDepth)
  if recursive == nil then recursive = true end
  maxDepth = maxDepth or 10

  -- Build find command
  local depthFlag = ""
  if not recursive then
    depthFlag = "-maxdepth 1"
  elseif maxDepth then
    depthFlag = "-maxdepth " .. maxDepth
  end

  local cmd = string.format(
    'find %q %s -type f -printf "%%p\\t%%s\\t%%T@\\n" 2>/dev/null',
    dirpath, depthFlag
  )

  local handle = io.popen(cmd)
  if not handle then return {} end

  local files = {}
  for line in handle:lines() do
    local path, sizeStr, mtimeStr = line:match("^(.+)\t(%d+)\t([%d%.]+)$")
    if path then
      local name = path:match("([^/]+)$") or path
      files[#files + 1] = {
        path = path,
        name = name,
        size = tonumber(sizeStr) or 0,
        mtime = math.floor(tonumber(mtimeStr) or 0),
        type = Media.classify(name),
      }
    end
  end
  handle:close()

  return files
end

---Scan a directory and group files by media type.
---@param dirpath string
---@return table { video: file[], audio: file[], image: file[], archive: file[], ... }
function Media.scanGrouped(dirpath)
  local files = Media.scanDirectory(dirpath)
  local groups = {}

  for _, file in ipairs(files) do
    local t = file.type
    if not groups[t] then groups[t] = {} end
    groups[t][#groups[t] + 1] = file
  end

  return groups
end

---Get directory stats without returning all files.
---@param dirpath string
---@return table { total, byType: { video: n, ... }, totalSize, largestFile }
function Media.dirStats(dirpath)
  local files = Media.scanDirectory(dirpath)

  local byType = {}
  local totalSize = 0
  local largest = nil

  for _, file in ipairs(files) do
    byType[file.type] = (byType[file.type] or 0) + 1
    totalSize = totalSize + file.size
    if not largest or file.size > largest.size then
      largest = file
    end
  end

  return {
    total = #files,
    byType = byType,
    totalSize = totalSize,
    largestFile = largest,
  }
end

-- ============================================================================
-- Archive-aware indexing
-- ============================================================================

---Index a directory, including looking inside archives.
---Returns a flat list of all media files found, with archive contents expanded.
---@param dirpath string
---@param opts table? { indexArchives: boolean, archivePattern: string }
---@return table[] Array of { path, name, size, type, source, archivePath? }
function Media.indexDeep(dirpath, opts)
  opts = opts or {}
  local indexArchives = opts.indexArchives ~= false  -- default true
  local archivePattern = opts.archivePattern  -- optional filter

  local files = Media.scanDirectory(dirpath)
  local index = {}

  for _, file in ipairs(files) do
    -- Add the file itself
    index[#index + 1] = {
      path = file.path,
      name = file.name,
      size = file.size,
      mtime = file.mtime,
      type = file.type,
      source = "filesystem",
    }

    -- If it's an archive, peek inside
    if indexArchives and archive and Media.isArchive(file.name) then
      if not archivePattern or file.name:match(archivePattern) then
        local entries, err = archive.list(file.path)
        if entries then
          for _, entry in ipairs(entries) do
            if entry.type == "file" then
              local entryName = entry.path:match("([^/]+)$") or entry.path
              index[#index + 1] = {
                path = file.path .. ":" .. entry.path,
                name = entryName,
                size = entry.size,
                mtime = entry.mtime,
                type = Media.classify(entryName),
                source = "archive",
                archivePath = file.path,
                archiveEntry = entry.path,
              }
            end
          end
        end
      end
    end
  end

  return index
end

-- ============================================================================
-- Human-readable size formatting
-- ============================================================================

function Media.formatSize(bytes)
  if bytes >= 1099511627776 then
    return string.format("%.1f TB", bytes / 1099511627776)
  elseif bytes >= 1073741824 then
    return string.format("%.1f GB", bytes / 1073741824)
  elseif bytes >= 1048576 then
    return string.format("%.1f MB", bytes / 1048576)
  elseif bytes >= 1024 then
    return string.format("%.1f KB", bytes / 1024)
  else
    return bytes .. " B"
  end
end

-- ============================================================================
-- RPC Handlers
-- ============================================================================

function Media.getHandlers()
  return {
    ["media:scan"] = function(args)
      return Media.scanDirectory(args.dir, args.recursive, args.maxDepth)
    end,

    ["media:scanGrouped"] = function(args)
      return Media.scanGrouped(args.dir)
    end,

    ["media:dirStats"] = function(args)
      return Media.dirStats(args.dir)
    end,

    ["media:indexDeep"] = function(args)
      return Media.indexDeep(args.dir, {
        indexArchives = args.indexArchives,
        archivePattern = args.archivePattern,
      })
    end,

    ["media:classify"] = function(args)
      return { type = Media.classify(args.filename) }
    end,
  }
end

return Media
