import { StaticSurface } from '@reactjit/runtime/primitives';

export default function App() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 40,
        backgroundColor: '#0b1020',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Local positioning context — both the captured parent and the overlay
          live inside this 480x320 box so position:absolute coords line up. */}
      <div style={{ width: 480, height: 320, position: 'relative' }}>
        <StaticSurface staticKey="transparency-parent" style={{ width: '100%', height: '100%' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#dc2626',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ color: '#ffffff', fontSize: 32 }}>BACKGROUND TEXT</span>
            <span style={{ color: '#fde68a', fontSize: 18 }}>line two — should be visible through the overlay</span>
            <div style={{ height: 12, backgroundColor: '#000000', marginTop: 8 }} />
            <div style={{ height: 12, backgroundColor: '#ffffff', marginTop: 4 }} />
            <div style={{ height: 12, backgroundColor: '#000000', marginTop: 4 }} />
            <div style={{ height: 12, backgroundColor: '#ffffff', marginTop: 4 }} />
            <span style={{ color: '#ffffff', fontSize: 16, marginTop: 8 }}>more parent content here</span>
          </div>
        </StaticSurface>

        {/* Sibling overlay — composites on top of the texture quad. */}
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: 60,
            width: 360,
            height: 200,
            backgroundColor: 'rgba(0, 100, 255, 0.4)',
            borderRadius: 8,
            borderWidth: 4,
            borderColor: '#fbbf24',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: 20 }}>OVERLAY (a=0.4)</span>
        </div>
      </div>
    </div>
  );
}
