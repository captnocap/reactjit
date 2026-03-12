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
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

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
                text = text_iface.get_text(0, min(count, 500))
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

    result = {
        "role": role,
        "name": name,
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

    # Recurse into children (cap per node to keep responses small)
    max_children = max_depth - depth <= 1 and 50 or 200  # fewer at leaf depth
    children = []
    for i in range(min(child_count, max_children)):
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


def do_action(app_name, path, action_index):
    """Execute an action on a node."""
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
            self.send_json(tree)

        elif path.startswith('/subtree/'):
            # /subtree/<app>?path=0,1,2&depth=2 — fetch a subtree by index path
            # Default depth=2 (node + direct children) keeps responses small
            app_name = path[9:]  # strip '/subtree/'
            depth = int(qs.get('depth', ['2'])[0])
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
            self.send_json(tree)

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
