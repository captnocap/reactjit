// d152 — Mathematical Cascade Configurator
// The cart Smith literally cannot compile: recursive component with per-instance
// useState at runtime-determined depth. Ported verbatim from
// tsz/carts/conformance/mixed/d152_cascade_configurator.tsz, with the top-level
// hooks moved inside App() (mixed-lane hoists them; React requires them in a FC).

const React: any = require('react');
const { useState, useEffect, useRef } = React;
import { Box, Text, Pressable, ScrollView } from '../runtime/primitives';

// ── Math utilities ─────────────────────────────────────────────────

function isPrime(n: number): boolean {
  if (n < 2) return false;
  const limit = Math.floor(Math.sqrt(n));
  for (let i = 2; i <= limit; i++) if (n % i === 0) return false;
  return true;
}
function isFibonacci(n: number): boolean {
  if (n < 0) return false;
  const a = 5 * n * n + 4;
  const b = 5 * n * n - 4;
  const sqrtA = Math.floor(Math.sqrt(a));
  const sqrtB = Math.floor(Math.sqrt(b));
  return (sqrtA * sqrtA === a) || (sqrtB * sqrtB === b);
}
function fib(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) { const t = a + b; a = b; b = t; }
  return b;
}
function getCardType(val: number, isVoid: number): string {
  if (isVoid === 1) return 'void';
  if (isPrime(val)) return 'prime';
  if (isFibonacci(val)) return 'fibonacci';
  if (val % 2 === 0) return 'harmonic';
  return 'chaotic';
}
function getDigits(val: number): number[] {
  const s = String(Math.abs(val));
  const r: number[] = [];
  for (let i = 0; i < s.length; i++) r.push(parseInt(s[i]));
  return r;
}
function cardBg(t: string) { return t === 'void' ? '#0a0a0a' : t === 'prime' ? '#3b0a0a' : t === 'fibonacci' ? '#0a2e0a' : t === 'harmonic' ? '#0a1e3b' : '#3b2a0a'; }
function cardBorder(t: string) { return t === 'void' ? '#333333' : t === 'prime' ? '#ef4444' : t === 'fibonacci' ? '#22c55e' : t === 'harmonic' ? '#3b82f6' : '#f59e0b'; }
function cardBorderWidth(t: string) { return t === 'prime' ? 2 : t === 'fibonacci' ? 2 : t === 'chaotic' ? 3 : 1; }

// ── Node model ─────────────────────────────────────────────────────

type N = { id: string; value: number; isVoid: number; children: N[] };

const initialNodes: N[] = [
  { id: 'root', value: 10, isVoid: 0, children: [
    { id: 'c1', value: 5, isVoid: 0, children: [] },
    { id: 'c2', value: 7, isVoid: 0, children: [
      { id: 'c2-1', value: 3, isVoid: 0, children: [] },
    ]},
  ]},
];

// ── DigitChip ──────────────────────────────────────────────────────

function DigitChip({ digit }: { digit: number }) {
  const r = digit * 25, g = digit * 10, b = 255 - digit * 25;
  return (
    <Box style={{ width: 16, height: 16, borderRadius: 2, backgroundColor: `rgb(${r}, ${g}, ${b})`, justifyContent: 'center', alignItems: 'center' }}>
      <Text fontSize={7} color="#ffffff">{String(digit)}</Text>
    </Box>
  );
}

// ── RecursiveCard — per-instance useState ─────────────────────────

type RCProps = {
  node: N;
  depth: number;
  nodes: N[];
  setNodes: (n: N[]) => void;
  nextVoidNum: number;
  setNextVoidNum: (n: number) => void;
  rootValue: number;
  setRootValue: (n: number) => void;
  chainA: number;
  chainC: number;
  remountCount: number;
  recalcChain: (n: number) => void;
};

function RecursiveCard(p: RCProps): any {
  const { node, depth, nodes, setNodes, nextVoidNum, setNextVoidNum,
          rootValue, chainA, chainC, remountCount, setRootValue, recalcChain } = p;

  const [localVal, setLocalVal] = useState(node.value);
  const [isExpanded, setIsExpanded] = useState(0);
  const [subMapIndex, setSubMapIndex] = useState(0);
  const [renderCount, setRenderCount] = useState(0);

  const cType = getCardType(localVal, node.isVoid);
  const digits = getDigits(localVal);
  const depthColor = isPrime(depth) ? '#ef4444' : '#334155';
  const keyLabel = `${node.id}-${localVal % 2 === 0 ? 'even' : 'odd'}-${depth}-${remountCount}`;
  const metaText = depth === 0 ? `ROOT (pi x ${rootValue})`
                 : depth > 3 ? `DEEP LEVEL ${depth} - CHAIN: ${chainA}`
                 : `Level ${depth}: ${cType.toUpperCase()}`;

  const mapNodes = (arr: N[], targetId: string, updaterType: string, updaterVal: number): N[] => {
    return arr.map((n) => {
      if (n.id === targetId) return applyUpdate(n, updaterType, updaterVal);
      if (n.children.length > 0) return { ...n, children: mapNodes(n.children, targetId, updaterType, updaterVal) };
      return n;
    });
  };

  function applyUpdate(n: N, updaterType: string, updaterVal: number): N {
    if (updaterType === 'double') return { ...n, value: n.value * 2 };
    if (updaterType === 'kill') return { ...n, value: 0, children: [] };
    if (updaterType === 'mod') {
      const nv = (n.value + updaterVal) % 100;
      let kids = n.children;
      if (updaterVal > 50) { kids = n.children.slice(); kids.push(createVoid()); }
      return { ...n, value: nv, children: kids };
    }
    if (updaterType === 'chaos') {
      const cv = Math.floor(Math.random() * 100);
      const kids = n.children.length === 0 ? [createVoid()] : n.children.map((c) => ({ ...c, value: c.value * -1 }));
      return { ...n, value: cv, children: kids };
    }
    if (updaterType === 'summon') {
      const kids = n.children.slice();
      kids.push({ id: 'new-' + nextVoidNum, value: 1, isVoid: 0, children: [] });
      setNextVoidNum(nextVoidNum + 1);
      return { ...n, children: kids };
    }
    if (updaterType === 'setval') return { ...n, value: updaterVal };
    return n;
  }

  function createVoid(): N {
    const vId = 'void-' + nextVoidNum;
    setNextVoidNum(nextVoidNum + 1);
    return { id: vId, value: -999, isVoid: 1, children: [] };
  }

  const bumpLocal = () => {
    const nv = localVal + 1;
    setLocalVal(nv);
    setNodes(mapNodes(nodes, node.id, 'setval', nv));
    if (nv % 7 === 0 && nv > 0) { setRootValue(nv); recalcChain(nv); }
  };
  const syncWithChain = () => {
    const s = (localVal + chainC) % 100;
    setLocalVal(s);
  };

  return (
    <Box style={{ backgroundColor: cardBg(cType), borderWidth: cardBorderWidth(cType), borderColor: cardBorder(cType), borderRadius: depth === 0 ? 8 : 4, padding: depth === 0 ? 12 : 8, margin: 4, gap: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Text fontSize={depth === 0 ? 10 : 8} color={depth > 3 ? '#ef4444' : '#94a3b8'}>{metaText}</Text>
        <Text fontSize={6} color="#475569">{`renders: ${renderCount}`}</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Pressable
          testID={depth === 0 ? 'press:bumpLocal' : undefined}
          onPress={() => bumpLocal()}
          style={{ width: 44 - depth * 4, backgroundColor: '#0f172a', borderRadius: 3, padding: 4, alignItems: 'center' }}
        >
          <Text fontSize={12 - depth} color="#e2e8f0">{String(localVal)}</Text>
        </Pressable>
        <Box style={{ flexDirection: 'row', gap: 3 }}>
          {[
            { label: 'x2', action: 'double', bg: '#334155' },
            { label: 'KILL', action: 'kill', bg: '#dc2626' },
            { label: 'MOD', action: 'mod', bg: '#334155' },
            { label: 'CHAOS', action: 'chaos', bg: '#f59e0b' },
          ].map((btn) => (
            <Pressable key={btn.label} onPress={() => {
              if (btn.action === 'mod') setNodes(mapNodes(nodes, node.id, 'mod', 25));
              else setNodes(mapNodes(nodes, node.id, btn.action, 0));
              setRenderCount(renderCount + 1);
            }} style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderRadius: 3, backgroundColor: btn.bg }}>
              <Text fontSize={8 + depth} color="#ffffff">{btn.label}</Text>
            </Pressable>
          ))}
        </Box>
        <Pressable
          testID={depth === 0 ? 'press:syncWithChain' : undefined}
          onPress={() => syncWithChain()}
          style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 3, backgroundColor: '#1e1b4b' }}
        >
          <Text fontSize={6} color="#818cf8">sync</Text>
        </Pressable>
        <Text fontSize={5} color="#475569">{keyLabel}</Text>
      </Box>

      {depth === 0 && (
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          {[10, 25, 51, 75].map((mv) => (
            <Pressable key={mv} onPress={() => { setNodes(mapNodes(nodes, node.id, 'mod', mv)); setRenderCount(renderCount + 1); }} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 3, backgroundColor: mv > 50 ? '#92400e' : '#334155' }}>
              <Text fontSize={7} color="#ffffff">{`MOD +${mv}`}</Text>
            </Pressable>
          ))}
          <Text fontSize={6} color="#475569">{'(>50 spawns void child)'}</Text>
        </Box>
      )}

      <Pressable
        testID={depth === 0 ? 'press:setIsExpanded_11' : undefined}
        onPress={() => { setIsExpanded(isExpanded === 1 ? 0 : 1); setRenderCount(renderCount + 1); }}
        style={{ flexDirection: 'row', gap: 6, alignItems: 'center', padding: 4 }}
      >
        <Text fontSize={8} color="#64748b">{isExpanded === 1 ? '[-] Collapse' : '[+] Expand'}</Text>
        <Text fontSize={7} color="#475569">{`${node.children.length} children`}</Text>
      </Pressable>

      {isExpanded === 1 && (
        <Box style={{ marginLeft: 16, borderLeftWidth: 2, borderColor: depthColor, paddingLeft: 4, gap: 2 }}>
          {node.children.length === 0 ? (
            <Pressable onPress={() => { setNodes(mapNodes(nodes, node.id, 'summon', 0)); setRenderCount(renderCount + 1); }} style={{ padding: 16, borderWidth: 2, borderColor: '#334155', borderRadius: 6, alignItems: 'center' }}>
              <Text fontSize={10} color="#475569">{`+ Summon Node (Math: ${chainC % 10})`}</Text>
            </Pressable>
          ) : (
            node.children.map((child) => (
              <RecursiveCard key={child.id} {...p} node={child} depth={depth + 1} />
            ))
          )}

          {node.children.length > 0 && (
            <Box style={{ gap: 4, marginTop: 4 }}>
              <Box style={{ flexDirection: 'row', gap: 4 }}>
                {node.children.map((_, li) => (
                  <Pressable key={li} onPress={() => setSubMapIndex(li)} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: 3, backgroundColor: li === subMapIndex ? '#3b82f6' : '#334155', opacity: li === subMapIndex ? 1 : 0.5 }}>
                    <Text fontSize={7} color="#ffffff">{`Child ${li}`}</Text>
                  </Pressable>
                ))}
              </Box>
              {node.children[subMapIndex] && (
                <Box style={{ paddingLeft: 8, gap: 2 }}>
                  <Text fontSize={7} color="#64748b">{`id: ${node.children[subMapIndex].id}`}</Text>
                  <Text fontSize={7} color="#64748b">{`value: ${node.children[subMapIndex].value}`}</Text>
                  <Text fontSize={7} color="#64748b">{`grandchildren: ${node.children[subMapIndex].children.length}`}</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      <Box style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
        {digits.map((d, di) => <DigitChip key={di} digit={d} />)}
      </Box>
    </Box>
  );
}

// ── App ────────────────────────────────────────────────────────────

export default function App() {
  const [rootValue, setRootValue] = useState(1);
  const [chainA, setChainA] = useState(0);
  const [chainB, setChainB] = useState(0);
  const [chainC, setChainC] = useState(0);
  const [remountCount, setRemountCount] = useState(0);
  const [nodes, setNodes] = useState<N[]>(initialNodes);
  const [nextVoidNum, setNextVoidNum] = useState(1);

  const recalcChain = (root: number) => {
    const a = Math.floor(root * 3.14159);
    setChainA(a);
    const b = a * a;
    setChainB(b);
    let ca = a; if (ca > 10) ca = 10; if (ca < 0) ca = 0;
    const cc = Math.floor(Math.sqrt(b) + fib(ca));
    setChainC(cc);
    if (isPrime(cc)) setRemountCount(remountCount + 1);
  };
  const cascadeDestruction = () => {
    const d = nodes.map((n) => ({ ...n, value: Math.floor(Math.random() * 100), children: n.children.map((c) => ({ ...c, value: c.value * -1, children: [] })) }));
    setNodes(d);
    setRemountCount(remountCount + 1);
  };

  const mounted = useRef(false);
  if (!mounted.current) {
    mounted.current = true;
    recalcChain(1);
  }

  const cardProps = { nodes, setNodes, nextVoidNum, setNextVoidNum, rootValue, setRootValue, chainA, chainC, remountCount, recalcChain };

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', padding: 16, gap: 12 }}>
      <Text fontSize={16} color="#e2e8f0">Mathematical Cascade Configurator</Text>

      <Box style={{ backgroundColor: '#1e293b', borderRadius: 8, padding: 12, gap: 4 }}>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color="#94a3b8">Root:</Text>
          <Box style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 5, 7, 11, 13].map((v) => (
              <Pressable key={v} onPress={() => { setRootValue(v); recalcChain(v); }} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, backgroundColor: rootValue === v ? '#3b82f6' : '#334155' }}>
                <Text fontSize={9} color="#ffffff">{String(v)}</Text>
              </Pressable>
            ))}
          </Box>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Box style={{ gap: 2 }}>
            <Text fontSize={8} color="#64748b">Chain A (x pi)</Text>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text fontSize={12} color="#e2e8f0">{String(chainA)}</Text>
              {isPrime(chainA) && (
                <Box style={{ backgroundColor: '#dc2626', borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
                  <Text fontSize={6} color="#ffffff">PRIME - REMOUNTING</Text>
                </Box>
              )}
            </Box>
          </Box>
          <Box style={{ gap: 2 }}>
            <Text fontSize={8} color="#64748b">Chain B (squared)</Text>
            <Text fontSize={12} color="#e2e8f0">{String(chainB)}</Text>
          </Box>
          <Box style={{ gap: 2 }}>
            <Text fontSize={8} color="#64748b">Chain C (sqrt + fib)</Text>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text fontSize={12} color="#e2e8f0">{String(chainC)}</Text>
              {isFibonacci(chainC) && (
                <Box style={{ backgroundColor: '#22c55e', borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
                  <Text fontSize={6} color="#ffffff">FIBONACCI</Text>
                </Box>
              )}
            </Box>
          </Box>
          <Box style={{ gap: 2 }}>
            <Text fontSize={8} color="#64748b">Remounts</Text>
            <Text fontSize={12} color={remountCount > 0 ? '#f59e0b' : '#22c55e'}>{String(remountCount)}</Text>
          </Box>
        </Box>
      </Box>

      <ScrollView style={{ flexGrow: 1, gap: 4 }}>
        {nodes.map((n) => (
          <RecursiveCard key={n.id} {...cardProps} node={n} depth={0} />
        ))}
      </ScrollView>

      <Pressable
        testID="press:cascadeDestruction"
        onPress={() => cascadeDestruction()}
        style={{ padding: 12, backgroundColor: '#dc2626', borderRadius: 8, alignItems: 'center', gap: 2 }}
      >
        <Text fontSize={14} color="#ffffff">CASCADE DESTRUCTION</Text>
        <Text fontSize={7} color="#fca5a5">maps over nodes: randomize values, negate children, empty grandchildren</Text>
      </Pressable>

      <Box style={{ flexDirection: 'row', justifyContent: 'spaceBetween' }}>
        <Text fontSize={7} color="#475569">{`root=${rootValue} · A=${chainA} · B=${chainB} · C=${chainC} · remounts=${remountCount}`}</Text>
        <Text fontSize={7} color="#475569">{`nodes: ${nodes.length} root · void counter: ${nextVoidNum}`}</Text>
      </Box>
    </Box>
  );
}
