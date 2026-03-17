// Dashboard logic for TSZ-compiled UI
// Slot mapping matches Dashboard.tsz useState order:
//   0: uptime       8: avgLatency    16: diskPct
//   1: cpu          9: p99           17: gcPause
//   2: memUsed     10: connections   18: statusText (string)
//   3: memTotal    11: queueDepth    19: alertText (string)
//   4: netIn       12: dbQueries
//   5: netOut      13: dbAvg
//   6: requests    14: cacheHit
//   7: errors      15: cacheEntries

let uptime = 0;
let totalRequests = 0;
let totalErrors = 0;

function noise(base, pct) {
  return Math.floor(base + (Math.random() - 0.5) * 2 * base * pct / 100);
}

function pushMetrics() {
  const cpu = noise(45, 30);
  const memUsed = noise(3200, 10);
  const netIn = noise(12000, 40);
  const netOut = noise(8000, 35);

  let frameRps = noise(1225, 20);
  let frameErrors = noise(15, 50);
  totalRequests += frameRps;
  totalErrors += frameErrors;

  const avgLatency = noise(22, 30);
  const p99 = noise(85, 40);
  const connections = noise(250, 20);
  const queueDepth = noise(12, 60);
  const dbQueries = noise(800, 25);
  const dbAvg = noise(3, 40);
  const cacheHit = noise(92, 5);
  const cacheEntries = noise(45000, 10);
  const diskPct = 67 + Math.floor(uptime / 600);
  const gcPause = noise(2, 80);

  let status = 'Status: HEALTHY';
  let alert = 'All systems nominal';
  if (cpu > 80) { status = 'Status: WARNING'; alert = 'CPU usage high'; }
  if (frameErrors > frameRps * 0.05) { status = 'Status: DEGRADED'; alert = 'Error rate above 5%'; }
  if (p99 > 200) { status = 'Status: CRITICAL'; alert = 'P99 latency > 200ms'; }

  __setState(0, uptime);
  __setState(1, cpu);
  __setState(2, memUsed);
  __setState(3, 8192);
  __setState(4, netIn);
  __setState(5, netOut);
  __setState(6, totalRequests);
  __setState(7, totalErrors);
  __setState(8, avgLatency);
  __setState(9, p99);
  __setState(10, connections);
  __setState(11, queueDepth);
  __setState(12, dbQueries);
  __setState(13, dbAvg);
  __setState(14, cacheHit);
  __setState(15, cacheEntries);
  __setState(16, diskPct);
  __setState(17, gcPause);
  __setStateString(18, status);
  __setStateString(19, alert);
}

setInterval(function() {
  uptime++;
  pushMetrics();
}, 1000);

pushMetrics();
console.log('Dashboard (TSZ) logic loaded. 20 slots, updating every 1s.');
