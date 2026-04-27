import { useState } from 'react';

type MenuState = { x: number; y: number } | null;

export default function App() {
  const [menu, setMenu] = useState<MenuState>(null);
  const [log, setLog] = useState<string[]>([]);

  const items = ['Open', 'Rename', 'Duplicate', 'Delete'];

  const pick = (label: string) => {
    setLog((prev) => [`picked: ${label}`, ...prev].slice(0, 8));
    setMenu(null);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 24,
        flexDirection: 'column',
        gap: 16,
        backgroundColor: '#0b1020',
      }}
    >
      <h1 style={{ fontSize: 26, color: '#f8fafc', margin: 0 }}>
        overlay primitive — clipping test
      </h1>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
        the tile lives inside a 220×120 box with overflow:hidden.
        right-click it and the menu should escape that box.
      </p>

      <div
        style={{
          width: 220,
          height: 120,
          overflow: 'hidden',
          borderRadius: 10,
          backgroundColor: '#1d4ed8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          onRightClick={(x: number, y: number) => {
            setLog((p) => [`right-click handler fired (${x|0},${y|0})`, ...p].slice(0, 8));
            setMenu({ x, y });
          }}
          style={{
            width: 200,
            height: 100,
            backgroundColor: '#1e40af',
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
          }}
        >
          right-click me
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: '#111827',
          flexDirection: 'column',
          gap: 4,
          minHeight: 140,
        }}
      >
        <span style={{ color: '#a7f3d0', fontSize: 13 }}>log:</span>
        {log.length === 0 ? (
          <span style={{ color: '#475569', fontSize: 13 }}>(none yet)</span>
        ) : (
          log.map((line, i) => (
            <span key={i} style={{ color: '#cbd5e1', fontSize: 13 }}>
              {line}
            </span>
          ))
        )}
      </div>

      {menu && (
        <div
          overlayRoot={true}
          style={{
            position: 'absolute',
            left: menu.x,
            top: menu.y,
            backgroundColor: '#1f2937',
            borderRadius: 8,
            padding: 4,
            flexDirection: 'column',
            minWidth: 160,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 12,
          }}
        >
          {items.map((label) => (
            <div
              key={label}
              onClick={() => pick(label)}
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 4,
                color: '#e5e7eb',
                fontSize: 14,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
