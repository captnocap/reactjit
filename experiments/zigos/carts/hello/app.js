// Hello World cartridge for ZigOS
// This is a JS app that runs inside QuickJS, producing render commands
// that the TSZ layout engine paints.

let count = 0;

function render() {
  __hostFlush(JSON.stringify({
    kind: 'box',
    style: {
      width: 600,
      padding: 32,
      flexDirection: 'column',
      gap: 16,
      backgroundColor: '#1a1a2e',
    },
    children: [
      {
        kind: 'text',
        text: 'ZigOS — Hello from QuickJS!',
        fontSize: 28,
        color: '#e94560',
      },
      {
        kind: 'box',
        style: {
          padding: 20,
          backgroundColor: '#16213e',
          borderRadius: 8,
          flexDirection: 'column',
          gap: 8,
        },
        children: [
          {
            kind: 'text',
            text: 'This UI is rendered by the TSZ layout engine.',
            fontSize: 16,
            color: '#aabbcc',
          },
          {
            kind: 'text',
            text: 'The JavaScript runs in QuickJS, embedded in Zig.',
            fontSize: 16,
            color: '#aabbcc',
          },
          {
            kind: 'text',
            text: `Counter: ${count}`,
            fontSize: 22,
            color: '#ffffff',
          },
        ],
      },
      {
        kind: 'box',
        style: {
          flexDirection: 'row',
          gap: 12,
        },
        children: [
          {
            kind: 'box',
            style: {
              padding: 12,
              backgroundColor: '#4ec9b0',
              borderRadius: 6,
            },
            children: [{
              kind: 'text',
              text: '+ Increment',
              fontSize: 16,
              color: '#1a1a2e',
            }],
            onPressId: 1,
          },
          {
            kind: 'box',
            style: {
              padding: 12,
              backgroundColor: '#e94560',
              borderRadius: 6,
            },
            children: [{
              kind: 'text',
              text: 'Reset',
              fontSize: 16,
              color: '#ffffff',
            }],
            onPressId: 2,
          },
        ],
      },
      {
        kind: 'box',
        style: {
          padding: 16,
          backgroundColor: '#0f3460',
          borderRadius: 8,
        },
        children: [{
          kind: 'text',
          text: 'Architecture: JS (QuickJS) → JSON flush → Zig guest tree → TSZ layout → wgpu render',
          fontSize: 13,
          color: '#668899',
        }],
      },
    ],
  }));
}

// Handle press events from the host
globalThis.__onPress = function(id) {
  if (id === 1) count++;
  else if (id === 2) count = 0;
  render();
};

// Initial render
render();
console.log('Hello cartridge loaded! Counter app ready.');
