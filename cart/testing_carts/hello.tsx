import { useState } from 'react';
import { Window } from '@reactjit/runtime/primitives';

export default function App() {
  const [count, setCount] = useState(0);
  const [showWindow, setShowWindow] = useState(false);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 24,
        flexDirection: 'column',
        gap: 12,
        backgroundColor: '#0b1020',
      }}
    >
      <h1 style={{ fontSize: 28, color: '#f8fafc', margin: 0 }}>hello</h1>
      <p style={{ fontSize: 16, color: '#cbd5e1', margin: 0 }}>from jsrt</p>
      <button
        onClick={() => setCount((n: number) => n + 1)}
        style={{
          alignSelf: 'flex-start',
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 14,
          paddingRight: 14,
          borderRadius: 8,
          backgroundColor: '#1d4ed8',
          color: '#ffffff',
        }}
      >
        count: {count}
      </button>
      <button
        onClick={() => setShowWindow(true)}
        style={{
          alignSelf: 'flex-start',
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 14,
          paddingRight: 14,
          borderRadius: 8,
          backgroundColor: '#0f766e',
          color: '#ffffff',
        }}
      >
        open second window
      </button>
      {showWindow ? (
        <Window title="hello child" width={420} height={260} onClose={() => setShowWindow(false)}>
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: 24,
              flexDirection: 'column',
              gap: 12,
              backgroundColor: '#111827',
            }}
          >
            <h2 style={{ fontSize: 24, color: '#f8fafc', margin: 0 }}>second window</h2>
            <p style={{ fontSize: 15, color: '#a7f3d0', margin: 0 }}>
              this subtree is rendered in a native secondary window
            </p>
            <button
              onClick={() => setShowWindow(false)}
              style={{
                alignSelf: 'flex-start',
                paddingTop: 9,
                paddingBottom: 9,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 8,
                backgroundColor: '#374151',
                color: '#ffffff',
              }}
            >
              close window
            </button>
          </div>
        </Window>
      ) : null}
    </div>
  );
}
