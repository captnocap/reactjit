import { useState } from 'react';
import { useContextMenu } from '../runtime/hooks/useContextMenu';

const ITEM_H = 32;
const MENU_W = 180;

export default function App() {
  const { triggerProps, ContextMenu, close, x, y, isOpen } = useContextMenu();
  const [hovered, setHovered] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const items: Array<{ label: string; sub?: string[] }> = [
    { label: 'Open' },
    { label: 'Open With', sub: ['Editor', 'Image Viewer', 'Terminal'] },
    { label: 'Rename' },
    { label: 'Duplicate' },
    { label: 'Delete' },
  ];

  const pick = (label: string) => {
    setLog((prev) => [`picked: ${label}`, ...prev].slice(0, 8));
    setHovered(null);
    setOpenSub(null);
    close();
  };

  const hoverTop = (label: string, hasSub: boolean) => ({
    onHoverEnter: () => {
      setHovered(label);
      setOpenSub(hasSub ? label : null);
    },
  });
  const hoverSub = (label: string) => ({
    onHoverEnter: () => setHovered(label),
  });

  const itemStyle = (label: string) => ({
    height: ITEM_H,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 4,
    color: '#e5e7eb',
    fontSize: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: hovered === label ? '#374151' : 'transparent',
  });

  const submenuFor = items.find((i) => i.label === openSub && i.sub);
  const submenuParentIdx = submenuFor
    ? items.findIndex((i) => i.label === submenuFor.label)
    : -1;

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
        useContextMenu — hover + nested + dismiss
      </h1>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>
        right-click the tile. hover items to highlight; "Open With" opens a submenu.
        click outside to dismiss.
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
          {...triggerProps}
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

      <ContextMenu
        style={{
          backgroundColor: '#1f2937',
          borderRadius: 8,
          padding: 4,
          flexDirection: 'column',
          width: MENU_W,
        }}
      >
        {items.map((it) => (
          <div
            key={it.label}
            {...hoverTop(it.label, !!it.sub)}
            onClick={() => (it.sub ? null : pick(it.label))}
            style={itemStyle(it.label)}
          >
            <span style={{ color: '#e5e7eb', fontSize: 14 }}>{it.label}</span>
            {it.sub ? (
              <span style={{ color: '#9ca3af', fontSize: 14 }}>›</span>
            ) : null}
          </div>
        ))}
      </ContextMenu>

      {isOpen && submenuFor && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            // Anchor the submenu to the right edge of the parent menu, at the
            // y-position of the parent item. The hook exposes x/y of the
            // outer menu so we can compute submenu position relative to it.
            left: x + MENU_W + 2,
            top: y + 4 + submenuParentIdx * ITEM_H,
            backgroundColor: '#1f2937',
            borderRadius: 8,
            padding: 4,
            flexDirection: 'column',
            width: MENU_W,
          }}
        >
          {submenuFor.sub!.map((label) => (
            <div
              key={label}
              {...hoverSub(label)}
              onClick={() => pick(`${submenuFor.label} → ${label}`)}
              style={itemStyle(label)}
            >
              <span style={{ color: '#e5e7eb', fontSize: 14 }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
