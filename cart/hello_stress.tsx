const React: any = require('react');
const { useState } = React;

function CounterTile({ index }: { index: number }) {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        width: 188,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1f2937',
        backgroundColor: '#111827',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>counter {index}</p>
      <button
        onClick={() => setCount((n: number) => n + 1)}
        style={{
          alignSelf: 'stretch',
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 8,
          backgroundColor: '#2563eb',
          color: '#ffffff',
          fontSize: 14,
        }}
      >
        counter {index}: {count}
      </button>
    </div>
  );
}

export default function App() {
  const counters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 24,
        flexDirection: 'column',
        gap: 16,
        backgroundColor: '#050816',
      }}
    >
      <h1 style={{ fontSize: 28, color: '#f8fafc', margin: 0 }}>hello stress</h1>
      <p style={{ fontSize: 16, color: '#cbd5e1', margin: 0 }}>
        10 useState counters arranged as a grid.
      </p>
      <div
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          alignContent: 'flex-start',
        }}
      >
        {counters.map((index) => (
          <CounterTile key={index} index={index} />
        ))}
      </div>
    </div>
  );
}
