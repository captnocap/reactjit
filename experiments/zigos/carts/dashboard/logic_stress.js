// Stress test for TSZ-compiled dashboard
// Hammers all 20 slots every frame with computed data.
// Tests: useEffect (every frame), useMemo (fibonacci), rapid setState.

let uptime = 0;
let totalRequests = 0;
let totalErrors = 0;
let frame = 0;

function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}

function noise(base, pct) {
  return Math.floor(base + (Math.random() - 0.5) * 2 * base * pct / 100);
}

function heavyCompute(seed) {
  let result = 0;
  for (let i = 0; i < 100; i++) result += fibonacci(30 + (seed % 10));
  // String churn for GC pressure
  let s = '';
  for (let i = 0; i < 50; i++) s += 'x' + i + result;
  return result;
}

function pushAllSlots() {
  const cpu = noise(55, 40);
  const memUsed = noise(3200, 15);
  const netIn = noise(12000, 40);
  const netOut = noise(8000, 35);
  let frameRps = noise(1225, 25);
  let frameErrors = noise(15, 60);
  totalRequests += frameRps;
  totalErrors += frameErrors;
  const avgLatency = noise(22, 35);
  const p99 = noise(85, 45);
  const connections = noise(250, 25);
  const queueDepth = noise(12, 70);
  const dbQueries = noise(800, 30);
  const dbAvg = noise(3, 50);
  const cacheHit = noise(92, 8);
  const cacheEntries = noise(45000, 15);
  const diskPct = 67 + Math.floor(uptime / 300);
  const gcPause = noise(2, 90);

  // Heavy compute every frame (simulates useMemo)
  const memoResult = heavyCompute(frame);
  // Rapid state: 10 extra increments per frame
  for (let i = 0; i < 10; i++) totalRequests++;

  let status = 'Status: HEALTHY';
  let alert = 'All systems nominal';
  if (cpu > 80) { status = 'Status: WARNING'; alert = 'CPU high: ' + cpu + '%'; }
  if (p99 > 150) { status = 'Status: DEGRADED'; alert = 'P99: ' + p99 + 'ms (memo: ' + memoResult + ')'; }
  if (queueDepth > 20) { status = 'Status: WARNING'; alert = 'Queue depth: ' + queueDepth; }

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

// EVERY FRAME: update all slots (useEffect with no deps)
const _origTick = globalThis.__zigOS_tick;
globalThis.__zigOS_tick = function() {
  _origTick();
  frame++;
  if (frame % 60 === 0) uptime++; // bump uptime every ~1s at 60fps
  pushAllSlots();
};

pushAllSlots();
console.log('Stress logic loaded. Updating ALL 20 slots EVERY FRAME + fibonacci + rapid state.');
