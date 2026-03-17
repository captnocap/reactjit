// Real-world dashboard — slots version
// Simulates a monitoring dashboard with live data feeds,
// computed aggregates, and multiple data views.
//
// Slot assignments:
//   0: uptime seconds (int)
//   1: cpu percent (int, 0-100)
//   2: mem used MB (int)
//   3: mem total MB (int)
//   4: network in KB/s (int)
//   5: network out KB/s (int)
//   6: request count (int)
//   7: error count (int)
//   8: avg latency ms (int)
//   9: p99 latency ms (int)
//  10: active connections (int)
//  11: queue depth (int)
//  12-21: cpu history (10 samples, ints)
//  22-31: latency history (10 samples, ints)
//  32-41: rps history (10 samples, ints)
//  42: status text (string)
//  43: alert text (string)
//  44: top endpoint (string)
//  45: db query count (int)
//  46: db avg ms (int)
//  47: cache hit rate (int, 0-100)
//  48: cache entries (int)
//  49: disk used pct (int)
//  50: gc pause ms (int)
//  51-60: top 10 endpoint names (strings)
//  61-70: top 10 endpoint rps (ints)
//  71-80: top 10 endpoint p50 (ints)
//  81-90: top 10 endpoint err rate (ints, per 1000)

// --- Simulated backend data ---

let uptime = 0;
let totalRequests = 0;
let totalErrors = 0;
let tickCount = 0;

// Simulated service endpoints
const endpoints = [
  { name: '/api/users', baseRps: 120, baseLatency: 12, errRate: 2 },
  { name: '/api/orders', baseRps: 85, baseLatency: 25, errRate: 5 },
  { name: '/api/products', baseRps: 200, baseLatency: 8, errRate: 1 },
  { name: '/api/search', baseRps: 45, baseLatency: 45, errRate: 8 },
  { name: '/api/auth', baseRps: 150, baseLatency: 5, errRate: 3 },
  { name: '/api/payments', baseRps: 30, baseLatency: 80, errRate: 12 },
  { name: '/api/notifications', baseRps: 60, baseLatency: 15, errRate: 4 },
  { name: '/api/analytics', baseRps: 25, baseLatency: 120, errRate: 6 },
  { name: '/api/uploads', baseRps: 10, baseLatency: 200, errRate: 15 },
  { name: '/api/health', baseRps: 500, baseLatency: 1, errRate: 0 },
];

// History buffers (circular)
let cpuHistory = new Array(10).fill(0);
let latencyHistory = new Array(10).fill(0);
let rpsHistory = new Array(10).fill(0);
let historyIdx = 0;

// --- Simulated metrics computation ---

function noise(base, pct) {
  return Math.floor(base + (Math.random() - 0.5) * 2 * base * pct / 100);
}

function computeMetrics() {
  const cpu = noise(45, 30);
  const memUsed = noise(3200, 10);
  const memTotal = 8192;
  const netIn = noise(12000, 40);
  const netOut = noise(8000, 35);

  // Per-second request simulation
  let frameRps = 0;
  let frameErrors = 0;
  let latencySum = 0;
  let latencyMax = 0;
  const endpointStats = [];

  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    const rps = noise(ep.baseRps, 25);
    const lat = noise(ep.baseLatency, 30);
    const errs = Math.floor(rps * noise(ep.errRate, 50) / 1000);

    frameRps += rps;
    frameErrors += errs;
    latencySum += lat * rps;
    if (lat > latencyMax) latencyMax = lat;

    endpointStats.push({ name: ep.name, rps, lat, errs, errRate: ep.errRate });
  }

  totalRequests += frameRps;
  totalErrors += frameErrors;

  const avgLatency = frameRps > 0 ? Math.floor(latencySum / frameRps) : 0;
  const p99 = Math.floor(latencyMax * 1.8);
  const connections = noise(250, 20);
  const queueDepth = noise(12, 60);
  const dbQueries = noise(800, 25);
  const dbAvg = noise(3, 40);
  const cacheHit = noise(92, 5);
  const cacheEntries = noise(45000, 10);
  const diskPct = 67 + Math.floor(uptime / 600); // slowly grows
  const gcPause = noise(2, 80);

  // Sort endpoints by RPS for top list
  endpointStats.sort((a, b) => b.rps - a.rps);

  // Status determination
  let status = 'healthy';
  let alert = '';
  if (cpu > 80) { status = 'warning'; alert = 'CPU usage high'; }
  if (frameErrors > frameRps * 0.05) { status = 'degraded'; alert = 'Error rate above 5%'; }
  if (p99 > 500) { status = 'critical'; alert = 'P99 latency > 500ms'; }
  if (queueDepth > 25) { status = 'warning'; alert = 'Queue backing up'; }

  // Update history (every tick, wrapping)
  cpuHistory[historyIdx] = cpu;
  latencyHistory[historyIdx] = avgLatency;
  rpsHistory[historyIdx] = frameRps;
  historyIdx = (historyIdx + 1) % 10;

  return {
    cpu, memUsed, memTotal, netIn, netOut,
    frameRps, frameErrors, avgLatency, p99,
    connections, queueDepth, dbQueries, dbAvg,
    cacheHit, cacheEntries, diskPct, gcPause,
    status, alert, endpointStats,
  };
}

// --- Push metrics to slots ---

function pushMetrics() {
  const m = computeMetrics();

  __setState(0, uptime);
  __setState(1, m.cpu);
  __setState(2, m.memUsed);
  __setState(3, m.memTotal);
  __setState(4, m.netIn);
  __setState(5, m.netOut);
  __setState(6, totalRequests);
  __setState(7, totalErrors);
  __setState(8, m.avgLatency);
  __setState(9, m.p99);
  __setState(10, m.connections);
  __setState(11, m.queueDepth);

  // History arrays
  for (let i = 0; i < 10; i++) {
    const idx = (historyIdx + i) % 10;
    __setState(12 + i, cpuHistory[idx]);
    __setState(22 + i, latencyHistory[idx]);
    __setState(32 + i, rpsHistory[idx]);
  }

  __setState(42, 'Status: ' + m.status.toUpperCase());
  __setState(43, m.alert || 'All systems nominal');
  __setState(44, m.endpointStats[0].name + ' (' + m.endpointStats[0].rps + ' rps)');
  __setState(45, m.dbQueries);
  __setState(46, m.dbAvg);
  __setState(47, m.cacheHit);
  __setState(48, m.cacheEntries);
  __setState(49, m.diskPct);
  __setState(50, m.gcPause);

  // Top endpoints table
  for (let i = 0; i < 10; i++) {
    const ep = m.endpointStats[i];
    __setState(51 + i, ep.name);
    __setState(61 + i, ep.rps);
    __setState(71 + i, ep.lat);
    __setState(81 + i, ep.errRate);
  }
}

// --- Tick: update once per second via timer ---

// Use setInterval for 1-second data refresh (like a real dashboard)
setInterval(function() {
  uptime++;
  pushMetrics();
}, 1000);

// Initial push
pushMetrics();

// Also do a light tick every frame to keep UI responsive
const _origTick = globalThis.__zigOS_tick;
globalThis.__zigOS_tick = function() {
  _origTick();
  tickCount++;
};

// No __onPress needed for dashboard (read-only display)
globalThis.__onPress = function(id) {
  // Could add tab switching etc later
};

console.log('Dashboard loaded. Updating metrics every 1s.');
