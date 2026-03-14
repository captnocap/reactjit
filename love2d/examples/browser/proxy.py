#!/usr/bin/env python3
"""Local HTTP proxy that bridges ReactJIT's fetch() to browse's stealth Firefox.

Runs on localhost:9876. The Love2D app fetches from here instead of the real URL.
Browse connects to your running Firefox session and navigates with full stealth —
cookies, JS execution, bot check evasion — then returns the page content.

Usage:
    # Start your browse session first:  browse
    # Then run this proxy:
    python3 proxy.py

The Love2D app hits:  http://localhost:9876/browse?url=https://example.com
"""

import json
import sys
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, "/home/siah/creative/browse")
from browse import AgentBrowser

agent = None


def get_agent():
    global agent
    if agent is None:
        print("[proxy] Connecting to browse session...")
        agent = AgentBrowser.connect()
        print("[proxy] Connected.")
    return agent


class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/browse":
            params = parse_qs(parsed.query)
            url = params.get("url", [None])[0]
            if not url:
                self._respond(400, {"error": "Missing ?url= parameter"})
                return

            try:
                browser = get_agent()
                print(f"[proxy] Navigating to: {url}")
                content = browser.navigate(url)

                # Also grab raw HTML for rich rendering
                raw_html = browser.page_source
                if isinstance(raw_html, dict):
                    raw_html = raw_html.get("source", "")

                result = {
                    "url": content.url,
                    "title": content.title,
                    "text": content.text,
                    "html": raw_html,
                    "links": [{"text": l.text, "href": l.href}
                              for l in content.links],
                    "forms": [{"action": f.action, "method": f.method,
                               "fields": [{"name": ff.name, "type": ff.type,
                                           "value": ff.value,
                                           "placeholder": ff.placeholder}
                                          for ff in f.fields]}
                              for f in content.forms],
                }

                print(f"[proxy] OK: {content.title} "
                      f"({len(content.links)} links, "
                      f"{len(content.text)} chars)")
                self._respond(200, result)

            except Exception as e:
                traceback.print_exc()
                # Try to reconnect on next request
                global agent
                agent = None
                self._respond(500, {"error": str(e)})
            return

        if parsed.path == "/health":
            self._respond(200, {"status": "ok"})
            return

        self._respond(404, {"error": "Not found. Use /browse?url=..."})

    def _respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Quieter logging
        pass


def main():
    port = 9876
    server = HTTPServer(("127.0.0.1", port), ProxyHandler)
    print(f"[proxy] Listening on http://127.0.0.1:{port}")
    print(f"[proxy] Usage: http://127.0.0.1:{port}/browse?url=https://example.com")
    print(f"[proxy] Make sure your browse session is running first.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[proxy] Shutting down.")
        if agent:
            agent.detach()
        server.server_close()


if __name__ == "__main__":
    main()
