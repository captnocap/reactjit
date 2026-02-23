import React from 'react';
import { Box, Text, Image, ScrollView, Pressable } from '@reactjit/core';

// ── Palette ──────────────────────────────────────────────
const C = {
  bg: '#08080f',
  bgCard: '#111119',
  bgCode: '#0c0c14',
  surface: '#1a1a2e',
  border: '#1e293b',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#475569',
  accent: '#3b82f6',
  accentDim: '#1d4ed8',
  purple: '#a78bfa',
  green: '#34d399',
  orange: '#fb923c',
  pink: '#f472b6',
  cyan: '#22d3ee',
  yellow: '#facc15',
};

// ── Reusable pieces ──────────────────────────────────────

function GradientBar() {
  return (
    <Box style={{ flexDirection: 'row', width: '100%', height: 2 }}>
      <Box style={{ flexGrow: 1, backgroundColor: C.accent }} />
      <Box style={{ flexGrow: 1, backgroundColor: C.purple }} />
      <Box style={{ flexGrow: 1, backgroundColor: C.pink }} />
      <Box style={{ flexGrow: 1, backgroundColor: C.orange }} />
    </Box>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color + '18',
      borderWidth: 1,
      borderColor: color + '40',
      borderRadius: 12,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 3,
      paddingBottom: 3,
    }}>
      <Text style={{ color, fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box style={{ alignItems: 'center', gap: 6, paddingBottom: 8 }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: C.textDim, fontSize: 13 }}>{subtitle}</Text>
    </Box>
  );
}

function FeatureCard({ icon, title, body, color }: {
  icon: string; title: string; body: string; color: string;
}) {
  return (
    <Box style={{
      flexGrow: 1,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 8,
      padding: 16,
      gap: 8,
    }}>
      <Box style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: color + '20',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{icon}</Text>
      </Box>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: C.textDim, fontSize: 11 }}>{body}</Text>
    </Box>
  );
}

function CodeLine({ indent, parts }: {
  indent: number;
  parts: Array<{ text: string; color: string }>;
}) {
  return (
    <Box style={{ flexDirection: 'row', paddingLeft: indent * 14 }}>
      {parts.map((p, i) => (
        <Text key={i} style={{ color: p.color, fontSize: 11 }}>{p.text}</Text>
      ))}
    </Box>
  );
}

function PackageCard({ name, desc, color }: { name: string; desc: string; color: string }) {
  return (
    <Box style={{
      width: 250,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 6,
      padding: 12,
      gap: 4,
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
        <Box style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }} />
        <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{name}</Text>
      </Box>
      <Text style={{ color: C.textMuted, fontSize: 10 }}>{desc}</Text>
    </Box>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Box style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ color: C.accent, fontSize: 28, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: C.textDim, fontSize: 11 }}>{label}</Text>
    </Box>
  );
}

// ── Sections ─────────────────────────────────────────────

function Hero() {
  return (
    <Box style={{
      alignItems: 'center',
      paddingTop: 80,
      paddingBottom: 60,
      gap: 16,
      width: '100%',
    }}>
      {/* Logo */}
      <Image
        src="data/logo.png"
        style={{ width: 120, height: 120 }}
      />

      <Text style={{ color: C.text, fontSize: 36, fontWeight: '700' }}>ReactJIT</Text>

      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: C.textDim, fontSize: 16 }}>
          React, rendered as raw geometry.
        </Text>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>
          A React reconciler that renders to pixels, not DOM.
        </Text>
        <Text style={{ color: C.textMuted, fontSize: 13 }}>
          Desktop. Browser. Embedded. One codebase.
        </Text>
      </Box>

      {/* Pills */}
      <Box style={{ flexDirection: 'row', gap: 6, paddingTop: 8, width: 400, justifyContent: 'center' }}>
        <Pill label="Love2D" color={C.purple} />
        <Pill label="SDL2" color={C.green} />
        <Pill label="WASM" color={C.orange} />
        <Pill label="OpenGL" color={C.cyan} />
      </Box>

      {/* Install line */}
      <Box style={{
        marginTop: 16,
        backgroundColor: C.bgCode,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 6,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 10,
        flexDirection: 'row',
        gap: 8,
        width: 340,
        justifyContent: 'center',
      }}>
        <Text style={{ color: C.textMuted, fontSize: 12 }}>$</Text>
        <Text style={{ color: C.text, fontSize: 12 }}>rjit init my-app</Text>
      </Box>
    </Box>
  );
}

function Features() {
  return (
    <Box style={{ width: '100%', maxWidth: 800, alignItems: 'center', gap: 16, paddingBottom: 40 }}>
      <SectionTitle
        title="Why ReactJIT?"
        subtitle="Everything you need to ship real apps without a browser."
      />
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <FeatureCard
          icon="M"
          color={C.accent}
          title="Multi-Target"
          body="One React codebase renders natively via Love2D, SDL2/OpenGL, or WASM in the browser. Swap the target table, change the renderer."
        />
        <FeatureCard
          icon="L"
          color={C.purple}
          title="Pixel-Perfect Layout"
          body="Hand-rolled flex engine in Lua. Exhaustively verified — flex distribution, cursors, and sizes are exact to the pixel."
        />
        <FeatureCard
          icon="1"
          color={C.green}
          title="One-Liner Components"
          body="Declarative capability system. Lua does the work, React wraps it in a component, schema is the documentation."
        />
      </Box>
      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <FeatureCard
          icon="J"
          color={C.orange}
          title="LuaJIT + QuickJS"
          body="Two JIT runtimes working together. LuaJIT owns the run loop and rendering. QuickJS runs React. FFI binds them at native speed."
        />
        <FeatureCard
          icon="H"
          color={C.pink}
          title="Hot Reload"
          body="Edit your TSX, save, see it live. HMR polls the bundle and hot-swaps the React tree without restarting the runtime."
        />
        <FeatureCard
          icon="A"
          color={C.cyan}
          title="AI-Native"
          body="Every capability has a schema. useCapabilities() returns them all. An LLM can discover and control your entire app without docs."
        />
      </Box>
    </Box>
  );
}

function CodeExample() {
  const kw = C.purple;
  const str = C.green;
  const fn = C.accent;
  const tag = C.orange;
  const attr = C.cyan;
  const val = C.yellow;
  const cm = C.textMuted;
  const tx = C.text;
  const br = C.textDim;

  return (
    <Box style={{ width: '100%', maxWidth: 400, alignItems: 'center', gap: 16, paddingBottom: 40 }}>
      <SectionTitle
        title="Simple by Design"
        subtitle="If someone who doesn't code can't use it in one line, wrap it until they can."
      />
      <Box style={{
        width: '100%',
        backgroundColor: C.bgCode,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        padding: 16,
        gap: 2,
      }}>
        <CodeLine indent={0} parts={[
          { text: 'import ', color: kw },
          { text: '{ Box, Text, Pressable }', color: tx },
          { text: ' from ', color: kw },
          { text: "'@reactjit/core'", color: str },
        ]} />
        <CodeLine indent={0} parts={[
          { text: 'import ', color: kw },
          { text: '{ Audio }', color: tx },
          { text: ' from ', color: kw },
          { text: "'@reactjit/core'", color: str },
        ]} />
        <Box style={{ height: 8 }} />
        <CodeLine indent={0} parts={[
          { text: 'export default function ', color: kw },
          { text: 'App', color: fn },
          { text: '() {', color: br },
        ]} />
        <CodeLine indent={1} parts={[
          { text: 'const ', color: kw },
          { text: '[on, setOn] = ', color: tx },
          { text: 'useState', color: fn },
          { text: '(false)', color: br },
        ]} />
        <Box style={{ height: 4 }} />
        <CodeLine indent={1} parts={[
          { text: 'return (', color: br },
        ]} />
        <CodeLine indent={2} parts={[
          { text: '<', color: br },
          { text: 'Box', color: tag },
          { text: ' style', color: attr },
          { text: '={{ ', color: br },
          { text: "bg: '#0f172a'", color: val },
          { text: ' }}>', color: br },
        ]} />
        <CodeLine indent={3} parts={[
          { text: '<', color: br },
          { text: 'Text', color: tag },
          { text: ' fontSize', color: attr },
          { text: '={', color: br },
          { text: '24', color: val },
          { text: '}>', color: br },
          { text: 'Hello ReactJIT', color: tx },
          { text: '</', color: br },
          { text: 'Text', color: tag },
          { text: '>', color: br },
        ]} />
        <CodeLine indent={3} parts={[
          { text: '<', color: br },
          { text: 'Audio', color: tag },
          { text: ' src', color: attr },
          { text: '=', color: br },
          { text: '"beat.mp3"', color: str },
          { text: ' playing', color: attr },
          { text: '={on}', color: br },
          { text: ' />', color: br },
        ]} />
        <CodeLine indent={3} parts={[
          { text: '<', color: br },
          { text: 'Pressable', color: tag },
          { text: ' onPress', color: attr },
          { text: '={() => ', color: br },
          { text: 'setOn', color: fn },
          { text: '(!on)}>', color: br },
        ]} />
        <CodeLine indent={4} parts={[
          { text: '<', color: br },
          { text: 'Text', color: tag },
          { text: ' fontSize', color: attr },
          { text: '={', color: br },
          { text: '16', color: val },
          { text: '}>{`', color: br },
          { text: 'Play: ${on}', color: tx },
          { text: '`}</', color: br },
          { text: 'Text', color: tag },
          { text: '>', color: br },
        ]} />
        <CodeLine indent={3} parts={[
          { text: '</', color: br },
          { text: 'Pressable', color: tag },
          { text: '>', color: br },
        ]} />
        <CodeLine indent={2} parts={[
          { text: '</', color: br },
          { text: 'Box', color: tag },
          { text: '>', color: br },
        ]} />
        <CodeLine indent={1} parts={[
          { text: ')', color: br },
        ]} />
        <CodeLine indent={0} parts={[
          { text: '}', color: br },
        ]} />
      </Box>
      <Text style={{ color: C.textMuted, fontSize: 11 }}>
        Audio playback as a React component. No bridge calls. No Lua knowledge needed.
      </Text>
    </Box>
  );
}

function Packages() {
  const pkgs: Array<{ name: string; desc: string; color: string }> = [
    { name: 'core', desc: 'Primitives, hooks, animation, layout', color: C.accent },
    { name: 'native', desc: 'Reconciler, host config, tree bridge', color: C.accent },
    { name: 'theme', desc: 'Theming system with live switching', color: C.purple },
    { name: 'audio', desc: 'Playback, synthesis, audio rack', color: C.green },
    { name: '3d', desc: 'Scene, lighting, materials, camera', color: C.orange },
    { name: 'controls', desc: 'Slider, switch, radio, select, forms', color: C.pink },
    { name: 'storage', desc: 'SQLite, docstore, persistent state', color: C.cyan },
    { name: 'ai', desc: 'LLM agent integration, tool use', color: C.yellow },
    { name: 'server', desc: 'HTTP server capabilities', color: C.green },
    { name: 'crypto', desc: 'Hashing, encryption, key generation', color: C.purple },
    { name: 'media', desc: 'Video playback, media library', color: C.orange },
    { name: 'router', desc: 'Navigation and routing', color: C.accent },
    { name: 'geo', desc: 'Geolocation, maps, coordinates', color: C.cyan },
    { name: 'rss', desc: 'RSS/Atom feed parsing', color: C.pink },
    { name: 'webhooks', desc: 'Webhook handling and dispatch', color: C.yellow },
  ];

  return (
    <Box style={{ width: '100%', maxWidth: 800, alignItems: 'center', gap: 16, paddingBottom: 40 }}>
      <SectionTitle
        title="Batteries Included"
        subtitle="15+ packages. One import away."
      />
      <Box style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        width: 774,
        justifyContent: 'center',
      }}>
        {pkgs.map(p => (
          <PackageCard key={p.name} name={p.name} desc={p.desc} color={p.color} />
        ))}
      </Box>
    </Box>
  );
}

function Pipeline() {
  const steps = [
    { label: 'React', desc: 'Your TSX components', color: C.accent },
    { label: 'Reconciler', desc: 'Mutation commands', color: C.purple },
    { label: 'QuickJS Bridge', desc: 'JS to Lua transport', color: C.green },
    { label: 'Layout Engine', desc: 'Pixel-perfect flex', color: C.orange },
    { label: 'Painter', desc: 'OpenGL / Canvas', color: C.pink },
  ];

  return (
    <Box style={{ width: '100%', maxWidth: 800, alignItems: 'center', gap: 16, paddingBottom: 40 }}>
      <SectionTitle
        title="The Pipeline"
        subtitle="From JSX to pixels in five steps."
      />
      <Box style={{ flexDirection: 'row', gap: 4, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <Box style={{
              backgroundColor: C.bgCard,
              borderWidth: 1,
              borderColor: s.color + '40',
              borderRadius: 6,
              padding: 10,
              alignItems: 'center',
              gap: 2,
              width: 130,
            }}>
              <Text style={{ color: s.color, fontSize: 11, fontWeight: '700' }}>{s.label}</Text>
              <Text style={{ color: C.textMuted, fontSize: 9 }}>{s.desc}</Text>
            </Box>
            {i < steps.length - 1 && (
              <Text style={{ color: C.textMuted, fontSize: 14 }}>-</Text>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}

function Stats() {
  return (
    <Box style={{
      width: '100%',
      maxWidth: 800,
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 20,
      paddingBottom: 40,
    }}>
      <Stat value="240" label="FPS target" />
      <Stat value="15+" label="Packages" />
      <Stat value="1" label="Single file" />
      <Stat value="0" label="DOM elements" />
    </Box>
  );
}

function Footer() {
  return (
    <Box style={{
      width: '100%',
      alignItems: 'center',
      paddingTop: 20,
      paddingBottom: 40,
      gap: 8,
    }}>
      <Box style={{ width: 200, height: 1, backgroundColor: C.border }} />
      <Box style={{ height: 8 }} />
      <Text style={{ color: C.textMuted, fontSize: 11 }}>
        github.com/captnocap/reactjit
      </Text>
      <Text style={{ color: C.textMuted, fontSize: 10 }}>
        This page is a ReactJIT app compiled to WASM.
      </Text>
      <Text style={{ color: C.textMuted, fontSize: 10 }}>
        Zero DOM elements. Pure geometry.
      </Text>
    </Box>
  );
}

// ── Root ──────────────────────────────────────────────────

export function App() {
  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
    }}>
      <GradientBar />
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{
          alignItems: 'center',
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24,
        }}>
          <Hero />
          <Stats />
          <Features />
          <Pipeline />
          <CodeExample />
          <Packages />
          <Footer />
        </Box>
      </ScrollView>
    </Box>
  );
}
