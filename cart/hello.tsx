const React: any = require('react');
const { useState } = React;

export default function App() {
  const [count, setCount] = useState(0);

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
    </div>
  );
}
