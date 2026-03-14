function Preview() {
  const items = [
    { label: 'reconciler', status: 'hot', color: '#a6e3a1' },
    { label: 'lua bridge', status: 'hot', color: '#a6e3a1' },
    { label: 'layout engine', status: 'warm', color: '#f9e2af' },
    { label: 'painter', status: 'cold', color: '#6c7086' },
  ];

  return (
    <Box style={{ padding: 24, gap: 12, flexDirection: 'column' }}>
      <Text style={{ fontSize: 16, color: '#cdd6f4', fontWeight: 'bold' }}>pipeline</Text>
      {items.map((item, i) => (
        <Box key={i} style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
          backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6,
        }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
          <Text style={{ fontSize: 12, color: '#cdd6f4', flexGrow: 1 }}>{item.label}</Text>
          <Text style={{ fontSize: 10, color: item.color }}>{item.status}</Text>
        </Box>
      ))}
    </Box>
  );
}
