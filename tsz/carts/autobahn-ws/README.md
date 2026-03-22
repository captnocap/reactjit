# Autobahn WebSocket Conformance

Tests the tsz WebSocket server against the Autobahn fuzzing test suite (~500 RFC 6455 test cases).

## Setup

```bash
pip3 install 'autobahn[twisted]'
```

## Run

```bash
# Terminal 1: start echo server
cd tsz
zig build-exe carts/autobahn-ws/echo_server.zig -I framework && ./echo_server

# Terminal 2: run fuzzing client
cd tsz/carts/autobahn-ws
python3 run_autobahn.py
```

## Results

Open `reports/server/index.html` in a browser. Each test case gets a verdict:
- **Pass** — correct RFC 6455 behavior
- **Non-strict** — technically works but not ideal
- **Fail** — wrong behavior

## Test categories

| Group | What it tests |
|-------|--------------|
| 1.x | Framing |
| 2.x | Pings/pongs |
| 3.x | Reserved bits |
| 4.x | Opcodes |
| 5.x | Fragmentation |
| 6.x | UTF-8 handling |
| 7.x | Close handling |
| 9.x | Limits/performance |
| 10.x | Misc |
| 12-13.x | WebSocket compression (permessage-deflate) |
