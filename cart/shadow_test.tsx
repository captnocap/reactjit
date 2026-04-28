// Side-by-side test of both shadow methods.
//
//   left  card: shadowMethod: 'sdf'  → WGSL fragment shader (drawRectShadow)
//   right card: shadowMethod: 'rect' → multi-rect fade (N expanded drawRect calls)
//
// Identical color / offset / blur / radius on both. Visual diff = method diff.
// SDF should look smooth and continuous; rect should show faint ring banding,
// especially at higher blur values.

import { useState } from 'react';

const SHADOW_COLOR = 'rgba(0,0,0,0.55)';

function ShadowCard({
  label,
  method,
  blur,
}: {
  label: string;
  method: 'sdf' | 'rect';
  blur: number;
}) {
  return (
    <div
      style={{
        width: 220,
        height: 140,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: SHADOW_COLOR,
        shadowOffsetX: 0,
        shadowOffsetY: 8,
        shadowBlur: blur,
        shadowMethod: method,
      } as any}
    >
      <span style={{ fontSize: 16, color: '#0f172a', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
        blur {blur}
      </span>
    </div>
  );
}

export default function App() {
  const [blur, setBlur] = useState(24);

  const stepDown = () => setBlur((b) => Math.max(0, b - 4));
  const stepUp = () => setBlur((b) => Math.min(64, b + 4));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 32,
        flexDirection: 'column',
        gap: 32,
        backgroundColor: '#1e293b',
      }}
    >
      <div style={{ flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 22, color: '#f8fafc', fontWeight: 700 }}>
          shadow method test
        </span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          left = sdf (wgsl shader) · right = rect (multi-rect fade) · same color/offset/blur
        </span>
      </div>

      <div style={{ flexDirection: 'row', gap: 64, alignItems: 'center' }}>
        <ShadowCard label="SDF (wgsl)" method="sdf" blur={blur} />
        <ShadowCard label="multi-rect" method="rect" blur={blur} />
      </div>

      <div style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <button
          onClick={stepDown}
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 14,
            paddingRight: 14,
            borderRadius: 8,
            backgroundColor: '#334155',
            color: '#f8fafc',
          }}
        >
          blur −
        </button>
        <button
          onClick={stepUp}
          style={{
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 14,
            paddingRight: 14,
            borderRadius: 8,
            backgroundColor: '#334155',
            color: '#f8fafc',
          }}
        >
          blur +
        </button>
        <span style={{ fontSize: 14, color: '#cbd5e1' }}>
          shadowBlur = {blur}px
        </span>
      </div>

      <div style={{ flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 14, color: '#94a3b8' }}>
          extreme blur sweep (sdf top row, rect bottom row):
        </span>
        <div style={{ flexDirection: 'row', gap: 24 }}>
          {[8, 24, 48].map((b) => (
            <ShadowCard key={`sdf-${b}`} label="sdf" method="sdf" blur={b} />
          ))}
        </div>
        <div style={{ flexDirection: 'row', gap: 24 }}>
          {[8, 24, 48].map((b) => (
            <ShadowCard key={`rect-${b}`} label="rect" method="rect" blur={b} />
          ))}
        </div>
      </div>
    </div>
  );
}
