#!/usr/bin/env python3
"""
AT-SPI2 Accessibility Tree Server

Serves the desktop accessibility tree as JSON over HTTP.
Supports reading the tree and executing actions on elements.

Usage:
    python3 tools/a11y_server.py [--port 9876]

Endpoints:
    GET  /apps              — list all accessible applications
    GET  /tree/<app_name>   — full tree for an app (optional ?depth=N, default 10)
    POST /action            — execute an action: { "path": [indices...], "action": 0 }
    GET  /health            — server status
"""

import json
import sys
import argparse
import traceback
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.setrecursionlimit(5000)

import gi
gi.require_version('Atspi', '2.0')
from gi.repository import Atspi


def get_desktop():
    return Atspi.get_desktop(0)


def node_to_dict(node, depth=0, max_depth=10, path=None):
    """Convert an AT-SPI node to a JSON-serializable dict."""
    if not node or depth > max_depth:
        return None

    if path is None:
        path = []

    role = node.get_role_name()
    name = node.get_name() or ""
    child_count = node.get_child_count()

    # Bounding box
    rect = None
    try:
        comp = node.get_component_iface()
        if comp:
            r = comp.get_extents(Atspi.CoordType.SCREEN)
            # INT32_MIN means not rendered
            if r.x != -2147483648:
                rect = {"x": r.x, "y": r.y, "w": r.width, "h": r.height}
    except:
        pass

    # Actions
    actions = []
    try:
        action_iface = node.get_action_iface()
        if action_iface:
            for i in range(action_iface.get_n_actions()):
                actions.append({
                    "index": i,
                    "name": action_iface.get_action_name(i),
                    "description": action_iface.get_action_description(i),
                })
    except:
        pass

    # States
    states = []
    try:
        state_set = node.get_state_set()
        for s in [Atspi.StateType.VISIBLE, Atspi.StateType.SHOWING,
                  Atspi.StateType.FOCUSED, Atspi.StateType.SELECTED,
                  Atspi.StateType.SELECTABLE, Atspi.StateType.ACTIVE,
                  Atspi.StateType.EDITABLE, Atspi.StateType.ENABLED,
                  Atspi.StateType.EXPANDABLE, Atspi.StateType.EXPANDED,
                  Atspi.StateType.CHECKED]:
            if state_set.contains(s):
                states.append(s.value_nick)
    except:
        pass

    # Text content
    text = None
    try:
        text_iface = node.get_text_iface()
        if text_iface:
            count = text_iface.get_character_count()
            if count > 0:
                text = Atspi.Text.get_text(text_iface, 0, min(count, 500))
    except:
        pass

    # Value (for sliders, progress bars, etc.)
    value = None
    try:
        value_iface = node.get_value_iface()
        if value_iface:
            value = {
                "current": value_iface.get_current_value(),
                "min": value_iface.get_minimum_value(),
                "max": value_iface.get_maximum_value(),
            }
    except:
        pass

    # If node has no name, peek at direct children via AT-SPI (not recursion)
    # to find a label. GTK table rows bury the text in the last named child cell.
    # This runs regardless of max_depth since it uses the live AT-SPI tree, not dict recursion.
    inferred_name = name
    if not name and child_count > 0 and child_count <= 20:
        # Scan children in reverse — label is often the last child
        for ci in range(child_count - 1, -1, -1):
            try:
                ch = node.get_child_at_index(ci)
                if ch:
                    ch_name = ch.get_name() or ""
                    if ch_name:
                        inferred_name = ch_name
                        break
            except:
                pass

    result = {
        "role": role,
        "name": inferred_name,
        "path": path,
        "rect": rect,
        "actions": actions,
        "states": states,
        "childCount": child_count,
    }

    if text:
        result["text"] = text
    if value:
        result["value"] = value

    # Recurse into children
    # For large lists (file managers, etc.) scan all children but prioritize
    # ones with screen rects (visible). This catches visible items regardless
    # of their index in the child list.
    cap = 30
    children = []

    if child_count > cap:
        # Large list: scan all children, collect visible ones (with rects)
        visible = []
        non_visible = []
        for i in range(child_count):
            try:
                child = node.get_child_at_index(i)
                if not child:
                    continue
                # Quick check: does this child have a screen rect?
                has_rect = False
                try:
                    comp = child.get_component_iface()
                    if comp:
                        r = comp.get_extents(Atspi.CoordType.SCREEN)
                        has_rect = r.x != -2147483648 and r.width > 0
                except:
                    pass

                if has_rect:
                    child_dict = node_to_dict(child, depth + 1, max_depth, path + [i])
                    if child_dict:
                        visible.append(child_dict)
                elif len(non_visible) < 10:
                    # Keep a few non-visible for context (column headers, etc.)
                    child_dict = node_to_dict(child, depth + 1, max_depth, path + [i])
                    if child_dict:
                        non_visible.append(child_dict)
            except:
                pass
        children = visible + non_visible
        result["truncated"] = True
        result["shownChildren"] = len(children)
        result["visibleChildren"] = len(visible)
    else:
        for i in range(child_count):
            try:
                child = node.get_child_at_index(i)
                child_dict = node_to_dict(child, depth + 1, max_depth, path + [i])
                if child_dict:
                    children.append(child_dict)
            except:
                pass

    if children:
        result["children"] = children

    return result


# ── Human-readable tree filter ───────────────────────────────────────
# Collapses the raw widget tree into what a person would actually see.
# Rules:
#   1. Skip noise roles entirely (filler, separator, scroll bar, table column header)
#   2. Collapse unnamed single-child containers (panel, split pane, scroll pane)
#      — promote the child up, preserving the parent's rect if child has none
#   3. Skip hidden elements (no visible/showing state AND no rect AND no name)
#   4. Flatten table cell rows — a table cell group becomes one node with the inferred name
#   5. Promote children of skipped nodes up to the parent

NOISE_ROLES = {
    'filler', 'separator', 'scroll bar', 'table column header',
    'tearoff menu item', 'redundant object', 'unknown',
}

CONTAINER_ROLES = {
    'panel', 'split pane', 'scroll pane', 'viewport', 'layered pane',
}


def simplify_tree(node):
    """Post-process a node_to_dict tree into a human-readable form."""
    if not node:
        return None

    role = node.get("role", "")
    name = node.get("name", "")
    children = node.get("children", [])

    # Skip noise roles entirely — promote their children
    if role in NOISE_ROLES:
        if children:
            results = []
            for c in children:
                s = simplify_tree(c)
                if s:
                    results.append(s)
            return results  # return list to be flattened by parent
        return None

    # Recursively simplify children, flattening lists from skipped nodes
    simplified_children = []
    for c in children:
        result = simplify_tree(c)
        if result is None:
            continue
        if isinstance(result, list):
            simplified_children.extend(result)
        else:
            simplified_children.append(result)

    # Collapse unnamed single-child containers
    if role in CONTAINER_ROLES and not name and len(simplified_children) == 1:
        child = simplified_children[0]
        if isinstance(child, dict):
            # Preserve parent rect if child doesn't have one
            if not child.get("rect") and node.get("rect"):
                child["rect"] = node["rect"]
            # Preserve parent path for action routing
            if node.get("path"):
                child["_originalPath"] = node["path"]
            return child

    # Skip completely empty hidden nodes
    is_visible = ("visible" in node.get("states", []) or
                  "showing" in node.get("states", []))
    if not name and not is_visible and not node.get("rect") and not simplified_children:
        return None

    # Build simplified node
    result = {
        "role": role,
        "name": name,
        "path": node.get("path", []),
        "rect": node.get("rect"),
        "actions": node.get("actions", []),
        "states": node.get("states", []),
        "childCount": len(simplified_children),
    }

    if node.get("text"):
        result["text"] = node["text"]
    if node.get("value"):
        result["value"] = node["value"]
    if simplified_children:
        result["children"] = simplified_children

    return result


def find_app(name):
    """Find an application by name (case-insensitive)."""
    desktop = get_desktop()
    name_lower = name.lower()
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app:
            app_name = (app.get_name() or "").lower()
            if app_name == name_lower:
                return app
    return None


def navigate_to_node(app, path):
    """Navigate to a node by index path."""
    node = app
    for idx in path:
        if idx < node.get_child_count():
            node = node.get_child_at_index(idx)
            if not node:
                return None
        else:
            return None
    return node


def do_action(app_name, path, action_index, refocus=True):
    """Execute an action on a node, optionally refocusing the caller's window."""
    # Remember active window so we can refocus after the action
    prev_window = None
    if refocus:
        try:
            prev_window = subprocess.check_output(
                ['xdotool', 'getactivewindow'], stderr=subprocess.DEVNULL
            ).strip()
        except Exception:
            pass

    app = find_app(app_name)
    if not app:
        return {"error": f"App '{app_name}' not found"}

    node = navigate_to_node(app, path)
    if not node:
        return {"error": f"Node not found at path {path}"}

    action_iface = node.get_action_iface()
    if not action_iface:
        return {"error": "Node has no action interface"}

    if action_index >= action_iface.get_n_actions():
        return {"error": f"Action index {action_index} out of range"}

    action_name = action_iface.get_action_name(action_index)
    result = action_iface.do_action(action_index)

    # Refocus the caller's window after the action
    if prev_window:
        try:
            subprocess.run(
                ['xdotool', 'windowactivate', prev_window],
                stderr=subprocess.DEVNULL, timeout=1
            )
        except Exception:
            pass

    return {"ok": True, "action": action_name, "result": result}


class A11yHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet logging
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == '/health':
            self.send_json({"status": "ok"})

        elif path == '/apps':
            desktop = get_desktop()
            apps = []
            for i in range(desktop.get_child_count()):
                app = desktop.get_child_at_index(i)
                if app:
                    name = app.get_name() or "(unnamed)"
                    windows = app.get_child_count()
                    if windows > 0:
                        apps.append({"name": name, "windows": windows})
            self.send_json({"apps": apps})

        elif path.startswith('/tree/'):
            app_name = path[6:]  # strip '/tree/'
            depth = int(qs.get('depth', ['10'])[0])
            app = find_app(app_name)
            if not app:
                self.send_json({"error": f"App '{app_name}' not found"}, 404)
                return
            tree = node_to_dict(app, max_depth=depth)
            if 'human' in qs.get('filter', []):
                try:
                    tree = simplify_tree(tree)
                    if isinstance(tree, list):
                        tree = {"role": "root", "name": app_name, "path": [], "children": tree, "childCount": len(tree), "rect": None, "actions": [], "states": []}
                    if not tree:
                        tree = {"role": "application", "name": app_name, "path": [], "children": [], "childCount": 0, "rect": None, "actions": [], "states": []}
                except Exception as e:
                    traceback.print_exc()
                    self.send_json({"error": f"simplify failed: {e}"}, 500)
                    return
            self.send_json(tree)

        elif path.startswith('/subtree/'):
            # /subtree/<app>?path=0,1,2&depth=2 — fetch a subtree by index path
            # Default depth=2 (node + direct children) keeps responses small
            app_name = path[9:]  # strip '/subtree/'
            depth = int(qs.get('depth', ['1'])[0])
            path_str = qs.get('path', [''])[0]
            index_path = [int(x) for x in path_str.split(',') if x]
            app = find_app(app_name)
            if not app:
                self.send_json({"error": f"App '{app_name}' not found"}, 404)
                return
            node = navigate_to_node(app, index_path)
            if not node:
                self.send_json({"error": f"Node not found at path {index_path}"}, 404)
                return
            tree = node_to_dict(node, max_depth=depth, path=index_path)
            if 'human' in qs.get('filter', []):
                try:
                    tree = simplify_tree(tree)
                    if isinstance(tree, list):
                        tree = {"role": "group", "name": "", "path": index_path, "children": tree, "childCount": len(tree), "rect": None, "actions": [], "states": []}
                    if not tree:
                        tree = {"role": "empty", "name": "", "path": index_path, "children": [], "childCount": 0, "rect": None, "actions": [], "states": []}
                except Exception as e:
                    traceback.print_exc()
                    self.send_json({"error": f"simplify failed: {e}"}, 500)
                    return
            self.send_json(tree)

        elif path.startswith('/text/'):
            # /text/<app>?path=0,1,2 — get full text content from a text widget
            app_name = path[6:]
            path_str = qs.get('path', [''])[0]
            index_path = [int(x) for x in path_str.split(',') if x]
            max_chars = int(qs.get('max', ['50000'])[0])
            app = find_app(app_name)
            if not app:
                self.send_json({"error": f"App '{app_name}' not found"}, 404)
                return
            node = navigate_to_node(app, index_path)
            if not node:
                self.send_json({"error": f"Node not found at path {index_path}"}, 404)
                return
            text_iface = node.get_text_iface()
            if not text_iface:
                self.send_json({"error": "Node has no text interface"}, 400)
                return
            count = text_iface.get_character_count()
            text = Atspi.Text.get_text(text_iface, 0, min(count, max_chars))
            result = {
                "text": text,
                "length": count,
                "truncated": count > max_chars,
            }
            # Caret position
            try:
                result["caret"] = text_iface.get_caret_offset()
            except:
                pass
            # Selection
            try:
                n_sel = text_iface.get_n_selections()
                if n_sel > 0:
                    sel = Atspi.Text.get_selection(text_iface, 0)
                    result["selection"] = {
                        "start": sel.start_offset,
                        "end": sel.end_offset,
                    }
            except:
                pass
            self.send_json(result)

        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == '/action':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            app_name = body.get('app', '')
            path = body.get('path', [])
            action_index = body.get('action', 0)
            result = do_action(app_name, path, action_index)
            self.send_json(result)
        else:
            self.send_json({"error": "Not found"}, 404)


def main():
    parser = argparse.ArgumentParser(description='AT-SPI2 Accessibility Server')
    parser.add_argument('--port', type=int, default=9876)
    args = parser.parse_args()

    server = HTTPServer(('127.0.0.1', args.port), A11yHandler)
    print(f"[a11y] Serving on http://127.0.0.1:{args.port}")
    print(f"[a11y] Endpoints:")
    print(f"  GET  /apps          — list apps with windows")
    print(f"  GET  /tree/<name>   — app tree as JSON (?depth=N)")
    print(f"  POST /action        — execute action")
    print(f"  GET  /health        — server status")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[a11y] Shutting down")
        server.shutdown()


if __name__ == '__main__':
    main()
