function Preview() {
  const cards = [
    { label: 'Files Changed', value: '142', color: '#a6e3a1' },
    { label: 'Build Time', value: '23ms', color: '#89b4fa' },
    { label: 'Hot Reloads', value: '38', color: '#f9e2af' },
    { label: 'Errors', value: '0', color: '#f38ba8' },
  ];

  return (
    <Box style={{ padding: 20, gap: 16, flexDirection: 'column' }}>
      <Text style={{ fontSize: 18, color: '#cdd6f4', fontWeight: 'bold' }}>
        Hot Code Dashboard
      </Text>
      <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {cards.map((c, i) => (
          <Box key={i} style={{
            padding: 16,
            backgroundColor: 'rgba(30,30,50,0.8)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.color,
            minWidth: 120,
            gap: 6,
          }}>
            <Text style={{ fontSize: 24, color: c.color, fontWeight: 'bold' }}>{c.value}</Text>
            <Text style={{ fontSize: 11, color: '#6c7086' }}>{c.label}</Text>
          </Box>
        ))}
      </Box>
      <Box style={{
        padding: 14,
        backgroundColor: 'rgba(166,227,161,0.06)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(166,227,161,0.2)',
      }}>
        <Text style={{ fontSize: 12, color: '#a6e3a1' }}>
          Ctrl+click any element to steer Claude
        </Text>
      </Box>
    </Box>
  );
}
