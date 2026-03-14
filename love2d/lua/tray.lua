--[[
  tray.lua — System tray icon via libayatana-appindicator3

  Uses LuaJIT FFI to create a system tray indicator with a context menu.
  GTK events are pumped from love.update() — no separate thread needed.

  Usage from Lua:
    local tray = require("lua.tray")
    tray.create({
      id    = "my-app",
      icon  = "/path/to/icon.png",   -- absolute path to PNG
      title = "My App",
      menu  = {
        { label = "Open",     action = "open" },
        { label = "Settings", action = "settings" },
        { separator = true },
        { label = "Quit",     action = "quit" },
      }
    })

  From React (via bridge RPC):
    bridge.rpc("tray:create", { id, icon, title, menu })
    bridge.rpc("tray:update_menu", { id, menu })
    bridge.rpc("tray:set_status", { id, status })  -- "active"|"passive"|"attention"
    bridge.rpc("tray:destroy", { id })

  Menu item clicks push events: { type = "tray:action", id = <tray_id>, action = <action_string> }
]]

local ffi = require("ffi")

-- ============================================================================
-- FFI declarations
-- ============================================================================

ffi.cdef[[
  // GLib/GObject basics
  typedef void* gpointer;
  typedef const void* gconstpointer;
  typedef char gchar;
  typedef int gint;
  typedef unsigned int guint;
  typedef int gboolean;
  typedef unsigned long gulong;
  typedef void (*GCallback)(void);
  typedef void (*GClosureNotify)(gpointer data, void *closure);
  typedef enum { G_CONNECT_AFTER = 1, G_CONNECT_SWAPPED = 2 } GConnectFlags;

  // GObject
  void g_object_unref(gpointer object);
  gulong g_signal_connect_data(gpointer instance, const gchar *signal,
    GCallback handler, gpointer data, GClosureNotify destroy, GConnectFlags flags);

  // GTK
  void gtk_init(int *argc, char ***argv);
  gboolean gtk_events_pending(void);
  gboolean gtk_main_iteration_do(gboolean blocking);

  // GtkWidget
  void gtk_widget_show(void *widget);
  void gtk_widget_show_all(void *widget);
  void gtk_widget_destroy(void *widget);

  // GtkMenu
  void* gtk_menu_new(void);
  void gtk_menu_shell_append(void *menu_shell, void *child);

  // GtkMenuItem
  void* gtk_menu_item_new_with_label(const gchar *label);

  // GtkSeparatorMenuItem
  void* gtk_separator_menu_item_new(void);

  // GtkCheckMenuItem (for toggle items)
  void* gtk_check_menu_item_new_with_label(const gchar *label);
  void  gtk_check_menu_item_set_active(void *item, gboolean active);
  gboolean gtk_check_menu_item_get_active(void *item);

  // AppIndicator
  typedef struct _AppIndicator AppIndicator;

  AppIndicator* app_indicator_new(const gchar *id, const gchar *icon_name,
    int category);
  AppIndicator* app_indicator_new_with_path(const gchar *id,
    const gchar *icon_name, int category, const gchar *icon_theme_path);
  void app_indicator_set_status(AppIndicator *self, int status);
  void app_indicator_set_menu(AppIndicator *self, void *menu);
  void app_indicator_set_icon_full(AppIndicator *self, const gchar *icon_name,
    const gchar *icon_desc);
  void app_indicator_set_title(AppIndicator *self, const gchar *title);
  void app_indicator_set_label(AppIndicator *self, const gchar *label,
    const gchar *guide);
  void app_indicator_set_attention_icon_full(AppIndicator *self,
    const gchar *icon_name, const gchar *icon_desc);
]]

-- ============================================================================
-- Library loading
-- ============================================================================

local gtk, gobject, indicator
local loaded = false

local function load_libs()
  if loaded then return true end
  local ok, err = pcall(function()
    gobject   = ffi.load("gobject-2.0")
    gtk       = ffi.load("gtk-3")
    indicator = ffi.load("ayatana-appindicator3")
  end)
  if not ok then
    print("[tray] Failed to load libraries: " .. tostring(err))
    return false
  end
  -- Initialize GTK (safe to call multiple times)
  gtk.gtk_init(nil, nil)
  loaded = true
  return true
end

-- ============================================================================
-- State
-- ============================================================================

local tray = {}

-- Active indicators keyed by id
local indicators = {}
-- Callback references (prevent GC of ffi callbacks)
local callbacks = {}

-- Status enum mapping
local STATUS = {
  passive   = 0,  -- APP_INDICATOR_STATUS_PASSIVE
  active    = 1,  -- APP_INDICATOR_STATUS_ACTIVE
  attention = 2,  -- APP_INDICATOR_STATUS_ATTENTION
}

-- Category enum mapping
local CATEGORY = {
  application    = 0,  -- APP_INDICATOR_CATEGORY_APPLICATION_STATUS
  communications = 1,  -- APP_INDICATOR_CATEGORY_COMMUNICATIONS
  system         = 2,  -- APP_INDICATOR_CATEGORY_SYSTEM_SERVICES
  hardware       = 3,  -- APP_INDICATOR_CATEGORY_HARDWARE
  other          = 4,  -- APP_INDICATOR_CATEGORY_OTHER
}

-- Bridge event push function (set by init.lua)
local pushEvent = nil

-- ============================================================================
-- Menu building
-- ============================================================================

local function build_menu(tray_id, items)
  local menu = gtk.gtk_menu_new()
  -- Clean up old callbacks for this tray
  callbacks[tray_id] = {}

  for i, item in ipairs(items) do
    local widget
    if item.separator then
      widget = gtk.gtk_separator_menu_item_new()
    elseif item.toggle then
      widget = gtk.gtk_check_menu_item_new_with_label(item.label or "")
      if item.checked then
        gtk.gtk_check_menu_item_set_active(widget, 1)
      end
      if item.action then
        local action = item.action
        local cb = ffi.cast("GCallback", function()
          if pushEvent then
            local checked = gtk.gtk_check_menu_item_get_active(widget) ~= 0
            pushEvent({
              type    = "tray:action",
              id      = tray_id,
              action  = action,
              checked = checked,
            })
          end
        end)
        callbacks[tray_id][i] = cb  -- prevent GC
        gobject.g_signal_connect_data(widget, "activate", cb, nil, nil, 0)
      end
    else
      widget = gtk.gtk_menu_item_new_with_label(item.label or "")
      if item.action then
        local action = item.action
        local cb = ffi.cast("GCallback", function()
          if pushEvent then
            pushEvent({
              type   = "tray:action",
              id     = tray_id,
              action = action,
            })
          end
        end)
        callbacks[tray_id][i] = cb  -- prevent GC
        gobject.g_signal_connect_data(widget, "activate", cb, nil, nil, 0)
      end
    end
    gtk.gtk_menu_shell_append(menu, widget)
  end

  gtk.gtk_widget_show_all(menu)
  return menu
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Create a new tray indicator.
--- @param opts table { id, icon, title, menu, category }
---   icon: absolute path to a PNG file (without extension for icon themes,
---         or use icon_path for absolute file paths)
---   menu: array of { label, action, separator, toggle, checked }
---   category: "application"|"communications"|"system"|"hardware"|"other"
function tray.create(opts)
  if not load_libs() then
    return false, "Failed to load GTK/appindicator libraries"
  end

  local id       = opts.id or "reactjit-app"
  local title    = opts.title or id
  local category = CATEGORY[opts.category or "application"] or 0

  -- Destroy existing indicator with same id
  if indicators[id] then
    tray.destroy(id)
  end

  local ind
  if opts.icon then
    -- For absolute paths, we need to split into directory + filename (no ext)
    local dir, name = opts.icon:match("^(.+)/([^/]+)$")
    if dir and name then
      -- Strip extension for icon name
      local icon_name = name:match("^(.+)%..+$") or name
      ind = indicator.app_indicator_new_with_path(id, icon_name, category, dir)
    else
      ind = indicator.app_indicator_new(id, opts.icon, category)
    end
  else
    -- Default: use "application-default-icon" from system theme
    ind = indicator.app_indicator_new(id, "application-default-icon", category)
  end

  indicator.app_indicator_set_title(ind, title)
  indicator.app_indicator_set_status(ind, STATUS.active)

  -- Build and attach menu
  if opts.menu then
    local menu = build_menu(id, opts.menu)
    indicator.app_indicator_set_menu(ind, menu)
  end

  indicators[id] = {
    indicator = ind,
    menu_widget = nil,  -- GtkMenu reference
  }

  print("[tray] Created indicator: " .. id)
  return true
end

--- Update the menu of an existing indicator.
--- @param id string
--- @param items table[] array of menu items
function tray.update_menu(id, items)
  local entry = indicators[id]
  if not entry then
    print("[tray] No indicator with id: " .. tostring(id))
    return false
  end
  local menu = build_menu(id, items)
  indicator.app_indicator_set_menu(entry.indicator, menu)
  return true
end

--- Set the status of an indicator.
--- @param id string
--- @param status string "active"|"passive"|"attention"
function tray.set_status(id, status)
  local entry = indicators[id]
  if not entry then return false end
  local s = STATUS[status]
  if s then
    indicator.app_indicator_set_status(entry.indicator, s)
  end
  return true
end

--- Set the icon of an indicator.
--- @param id string
--- @param icon_path string absolute path to icon
function tray.set_icon(id, icon_path)
  local entry = indicators[id]
  if not entry then return false end
  indicator.app_indicator_set_icon_full(entry.indicator, icon_path, "")
  return true
end

--- Set the label (text shown next to the icon).
--- @param id string
--- @param label string
function tray.set_label(id, label)
  local entry = indicators[id]
  if not entry then return false end
  indicator.app_indicator_set_label(entry.indicator, label, "")
  return true
end

--- Destroy a tray indicator.
--- @param id string
function tray.destroy(id)
  local entry = indicators[id]
  if not entry then return false end

  -- Set passive to hide
  indicator.app_indicator_set_status(entry.indicator, STATUS.passive)
  -- Unref the GObject
  gobject.g_object_unref(entry.indicator)
  -- Clean up callback references
  callbacks[id] = nil
  indicators[id] = nil

  print("[tray] Destroyed indicator: " .. id)
  return true
end

--- Destroy all tray indicators.
function tray.destroy_all()
  for id, _ in pairs(indicators) do
    tray.destroy(id)
  end
end

--- Pump GTK events. Call this from love.update().
--- Processes all pending GTK events without blocking.
function tray.update()
  if not loaded then return end
  -- Process all pending GTK events (non-blocking)
  while gtk.gtk_events_pending() ~= 0 do
    gtk.gtk_main_iteration_do(0)  -- 0 = non-blocking
  end
end

--- Set the event push function (called by init.lua).
--- @param fn function(event_table)
function tray.setPushEvent(fn)
  pushEvent = fn
end

--- Check if tray support is available on this system.
--- @return boolean
function tray.available()
  return load_libs()
end

--- Get list of active indicator IDs.
--- @return string[]
function tray.list()
  local ids = {}
  for id, _ in pairs(indicators) do
    ids[#ids + 1] = id
  end
  return ids
end

return tray
