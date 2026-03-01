/**
 * templates.ts — Starter templates for the playground.
 *
 * Each template is a self-contained JSX function (no imports, no TypeScript
 * types) that can be eval'd with the playground's injected scope.
 */

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  code: string;
}

export const templates: Template[] = [

  // ── Hello World ──────────────────────────────────────────

  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Interactive counter with a button',
    category: 'Starter',
    code: `function MyComponent() {
  var [count, setCount] = useState(0);

  return (
    <Box style={{
      width: '100%', height: '100%',
      backgroundColor: '#0f0f1a',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Box style={{
        width: 260,
        backgroundColor: '#1e1e2e',
        borderRadius: 16,
        padding: 24,
        gap: 16,
        alignItems: 'center',
      }}>
        <Text style={{
          color: '#cdd6f4',
          fontSize: 20,
          fontWeight: 'normal',
        }}>
          ReactJIT Playground
        </Text>
        <Text style={{
          color: '#6c7086',
          fontSize: 13,
        }}>
          Edit code on the left
        </Text>
        <Pressable
          onPress={function() { setCount(function(c) { return c + 1; }); }}
          style={{
            backgroundColor: '#89b4fa',
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{
            color: '#1e1e2e',
            fontSize: 14,
            fontWeight: 'normal',
          }}>
            {count === 0 ? 'Press me' : 'Pressed ' + count + 'x'}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
}`,
  },

  // ── Dashboard ────────────────────────────────────────────

  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Live KPIs, animated charts, tables, progress bars',
    category: 'Data',
    code: `function MyComponent() {
  var BG = '#0f172a';
  var CARD = '#1e293b';
  var BORDER = '#334155';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  function rand(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }
  function drift(base, range) {
    return Math.max(0, base + (Math.random() - 0.4) * range);
  }

  function generateRevenue() {
    return [
      { label: 'Jul', value: rand(28, 40) },
      { label: 'Aug', value: rand(35, 48) },
      { label: 'Sep', value: rand(32, 50) },
      { label: 'Oct', value: rand(45, 60) },
      { label: 'Nov', value: rand(40, 55) },
      { label: 'Dec', value: rand(50, 68) },
      { label: 'Jan', value: rand(48, 65) },
    ];
  }
  function generateSpark(base, variance) {
    return base.map(function(v) { return Math.max(1, Math.round(v + (Math.random() - 0.5) * variance)); });
  }

  var SPARK_BASE_REVENUE = [28, 32, 30, 41, 38, 45, 52, 48, 55, 61, 57, 63];
  var SPARK_BASE_USERS   = [120, 135, 142, 128, 155, 168, 172, 180, 195, 210, 225, 247];
  var SPARK_BASE_ERRORS  = [12, 8, 15, 6, 4, 9, 3, 7, 2, 5, 3, 1];
  var SPARK_BASE_LATENCY = [180, 165, 172, 155, 148, 162, 145, 138, 142, 135, 128, 142];

  function generateProducts() {
    var baseSales = [1247, 892, 634, 456, 321, 89];
    return [
      { name: 'Widget Pro', category: 'Hardware', sales: baseSales[0] + rand(-50, 80), revenue: '$' + (48.2 + (Math.random() - 0.3) * 4).toFixed(1) + 'k', status: 'active' },
      { name: 'DataSync', category: 'SaaS', sales: baseSales[1] + rand(-30, 60), revenue: '$' + (35.6 + (Math.random() - 0.3) * 3).toFixed(1) + 'k', status: 'active' },
      { name: 'CloudStore', category: 'Storage', sales: baseSales[2] + rand(-20, 50), revenue: '$' + (28.1 + (Math.random() - 0.3) * 2.5).toFixed(1) + 'k', status: 'active' },
      { name: 'NetGuard', category: 'Security', sales: baseSales[3] + rand(-15, 40), revenue: '$' + (22.8 + (Math.random() - 0.3) * 2).toFixed(1) + 'k', status: 'beta' },
      { name: 'FormBuilder', category: 'SaaS', sales: baseSales[4] + rand(-10, 30), revenue: '$' + (12.8 + (Math.random() - 0.3) * 1.5).toFixed(1) + 'k', status: 'active' },
      { name: 'OldTool', category: 'Legacy', sales: baseSales[5] + rand(-5, 15), revenue: '$' + (3.5 + (Math.random() - 0.3) * 0.8).toFixed(1) + 'k', status: 'deprecated' },
    ];
  }

  var statusVariant = function(s) {
    if (s === 'active') return 'success';
    if (s === 'beta') return 'info';
    return 'warning';
  };

  var PRODUCT_COLUMNS = [
    { key: 'name', title: 'Product' },
    { key: 'category', title: 'Category' },
    { key: 'sales', title: 'Sales', width: 60, align: 'right' },
    { key: 'revenue', title: 'Revenue', width: 70, align: 'right' },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: function(value) { return <Badge label={value} variant={statusVariant(value)} />; },
    },
  ];

  var [tick, setTick] = useState(0);
  var [revenue, setRevenue] = useState(generateRevenue);
  var [products, setProducts] = useState(generateProducts);
  var [kpis, setKpis] = useState({
    revenue: 63100, users: 1247, errors: 1, latency: 142,
    revChange: 8.2, userChange: 12.1, errChange: -72, latChange: -5.3,
  });
  var [sparks, setSparks] = useState({
    revenue: SPARK_BASE_REVENUE, users: SPARK_BASE_USERS,
    errors: SPARK_BASE_ERRORS, latency: SPARK_BASE_LATENCY,
  });
  var [targets, setTargets] = useState([
    { label: 'Revenue Goal', value: 0.78, color: '#22c55e' },
    { label: 'User Growth', value: 0.62, color: '#3b82f6' },
    { label: 'Uptime SLA', value: 0.995, color: '#06b6d4' },
    { label: 'NPS Score', value: 0.84, color: '#8b5cf6' },
    { label: 'Bug Backlog', value: 0.35, color: '#f59e0b' },
  ]);

  useEffect(function() {
    var interval = setInterval(function() {
      setTick(function(t) { return t + 1; });
      setRevenue(generateRevenue());
      setProducts(generateProducts());
      setKpis(function(prev) {
        return {
          revenue: Math.round(drift(prev.revenue, 3000)),
          users: Math.round(drift(prev.users, 80)),
          errors: Math.max(0, Math.round(drift(prev.errors, 2))),
          latency: Math.max(50, Math.round(drift(prev.latency, 20))),
          revChange: +(drift(prev.revChange, 3)).toFixed(1),
          userChange: +(drift(prev.userChange, 2)).toFixed(1),
          errChange: Math.min(0, +(drift(prev.errChange, 15)).toFixed(1)),
          latChange: Math.min(0, +(drift(prev.latChange, 3)).toFixed(1)),
        };
      });
      setSparks({
        revenue: generateSpark(SPARK_BASE_REVENUE, 10),
        users: generateSpark(SPARK_BASE_USERS, 30),
        errors: generateSpark(SPARK_BASE_ERRORS, 5),
        latency: generateSpark(SPARK_BASE_LATENCY, 25),
      });
      setTargets(function(prev) {
        return prev.map(function(t) {
          return { label: t.label, color: t.color, value: Math.max(0.05, Math.min(1, t.value + (Math.random() - 0.45) * 0.08)) };
        });
      });
    }, 3000);
    return function() { clearInterval(interval); };
  }, []);

  function KpiValue(props) {
    var animated = useSpring(props.value, { stiffness: 80, damping: 18 });
    var display = animated >= 1000
      ? (animated / 1000).toFixed(1) + 'k'
      : String(Math.round(animated));
    return ( // rjit-ignore-next-line
      <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'normal' }}>
        {props.prefix + display + props.suffix}
      </Text>
    );
  }

  var kpiCards = [
    { label: 'Revenue', raw: kpis.revenue, prefix: '$', suffix: '', data: sparks.revenue, color: '#22c55e', change: kpis.revChange },
    { label: 'Users', raw: kpis.users, prefix: '', suffix: '', data: sparks.users, color: '#3b82f6', change: kpis.userChange },
    { label: 'Errors', raw: kpis.errors, prefix: '', suffix: '', data: sparks.errors, color: '#ef4444', change: kpis.errChange },
    { label: 'Latency', raw: kpis.latency, prefix: '', suffix: 'ms', data: sparks.latency, color: '#f59e0b', change: kpis.latChange },
  ];

  var secondsAgo = tick * 3;
  var timeLabel = secondsAgo === 0 ? 'just now' : secondsAgo + 's ago';

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: BG }}>
    <Box style={{ padding: 16, gap: 12 }}>
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 18, fontWeight: 'normal' }}>Dashboard</Text>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
          <Text style={{ color: DIM, fontSize: 10 }}>Live</Text>
          <Text style={{ color: '#475569', fontSize: 10 }}>{'(' + timeLabel + ')'}</Text>
        </Box>
      </Box>

      <Divider color={BORDER} />

      <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
        {kpiCards.map(function(kpi) {
          return (
            <Box key={kpi.label} style={{
              flexGrow: 1,
              backgroundColor: CARD,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: BORDER,
              padding: 10,
              gap: 6,
            }}>
              <Text style={{ color: DIM, fontSize: 10 }}>{kpi.label}</Text>
              <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box style={{ gap: 2, width: 80, height: 30 }}>
                  <KpiValue value={kpi.raw} prefix={kpi.prefix} suffix={kpi.suffix} />
                  <Text style={{ color: kpi.color, fontSize: 10, fontWeight: 'normal' }}>
                    {(kpi.change >= 0 ? '+' : '') + kpi.change + '%'}
                  </Text>
                </Box>
                <Sparkline data={kpi.data} width={60} height={20} color={kpi.color} />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
        <Box style={{
          flexGrow: 1,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 8,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'normal' }}>Monthly Revenue ($k)</Text>
          <BarChart data={revenue} height={120} showValues color="#3b82f6" />
        </Box>

        <Box style={{
          width: 200,
          backgroundColor: CARD,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: BORDER,
          padding: 14,
          gap: 10,
        }}>
          <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'normal' }}>Targets</Text>
          {targets.map(function(metric) {
            return (
              <Box key={metric.label} style={{ gap: 3 }}>
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                  <Text style={{ color: DIM, fontSize: 10 }}>{metric.label}</Text>
                  <Text style={{ color: BRIGHT, fontSize: 10, fontWeight: 'normal' }}>
                    {Math.round(metric.value * 100) + '%'}
                  </Text>
                </Box>
                <ProgressBar value={metric.value} color={metric.color} height={6} animated />
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box style={{
        width: '100%',
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 14,
        gap: 8,
      }}>
        <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'normal' }}>Top Products</Text>
        <Table columns={PRODUCT_COLUMNS} data={products} rowKey="name" striped />
      </Box>
    </Box>
    </ScrollView>
  );
}`,
  },

  // ── Settings Panel ───────────────────────────────────────

  {
    id: 'settings',
    name: 'Settings Panel',
    description: 'Two-column layout with sliders, switches, selects, radios',
    category: 'Forms',
    code: `function MyComponent() {
  var [masterVol, setMasterVol] = useState(0.8);
  var [musicVol, setMusicVol] = useState(0.6);
  var [sfxVol, setSfxVol] = useState(0.9);
  var [resolution, setResolution] = useState('1920x1080');
  var [quality, setQuality] = useState('high');
  var [fullscreen, setFullscreen] = useState(true);
  var [vsync, setVsync] = useState(true);
  var [showFps, setShowFps] = useState(false);
  var [difficulty, setDifficulty] = useState('normal');
  var [autoSave, setAutoSave] = useState(true);
  var [tutorials, setTutorials] = useState(true);
  var [sensitivity, setSensitivity] = useState(0.5);
  var [brightness, setBrightness] = useState(0.7);

  var BG = '#0c1021';
  var CARD = '#151d30';
  var BORDER = '#1e2d45';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  function Section(props) {
    return (
      <Box style={{
        backgroundColor: CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 12,
        gap: 8,
      }}>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
          <Box style={{ width: 3, height: 14, backgroundColor: props.color, borderRadius: 2 }} />
          <Text style={{ color: BRIGHT, fontSize: 12, fontWeight: 'normal' }}>{props.title}</Text>
        </Box>
        {props.children}
      </Box>
    );
  }

  function SliderRow(props) {
    return (
      <Box style={{ gap: 2 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Text style={{ color: DIM, fontSize: 11 }}>{props.label}</Text>
          <Text style={{ color: props.color, fontSize: 11, fontWeight: 'normal' }}>
            {Math.round(props.value * 100) + '%'}
          </Text>
        </Box>
        <Slider
          value={props.value}
          onValueChange={props.onChange}
          activeTrackColor={props.color}
          thumbColor={props.color}
        />
      </Box>
    );
  }

  function ToggleRow(props) {
    return (
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Text style={{ color: BRIGHT, fontSize: 12 }}>{props.label}</Text>
        <Switch value={props.value} onValueChange={props.onChange} />
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 14, gap: 10 }}>
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'normal' }}>Settings</Text>
        <Badge label={quality.toUpperCase()} variant="info" />
      </Box>
      <Divider color={BORDER} />

      <Box style={{ flexDirection: 'row', width: '100%', gap: 10, flexGrow: 1 }}>
        <Box style={{ flexGrow: 1, gap: 10 }}>
          <Section title="Audio" color="#8b5cf6">
            <SliderRow label="Master" value={masterVol} onChange={setMasterVol} color="#8b5cf6" />
            <SliderRow label="Music" value={musicVol} onChange={setMusicVol} color="#6366f1" />
            <SliderRow label="SFX" value={sfxVol} onChange={setSfxVol} color="#a78bfa" />
          </Section>

          <Section title="Controls" color="#f59e0b">
            <SliderRow label="Mouse Sensitivity" value={sensitivity} onChange={setSensitivity} color="#f59e0b" />
            <SliderRow label="Brightness" value={brightness} onChange={setBrightness} color="#fbbf24" />
          </Section>

          <Section title="Gameplay" color="#22c55e">
            <ToggleRow label="Auto-save" value={autoSave} onChange={setAutoSave} />
            <ToggleRow label="Show Tutorials" value={tutorials} onChange={setTutorials} />
          </Section>
        </Box>

        <Box style={{ flexGrow: 1, gap: 10 }}>
          <Section title="Display" color="#3b82f6">
            <Box style={{ gap: 4 }}>
              <Text style={{ color: DIM, fontSize: 10 }}>Resolution</Text>
              <Select value={resolution} onValueChange={setResolution} options={[
                { label: '1280 x 720', value: '1280x720' },
                { label: '1920 x 1080', value: '1920x1080' },
                { label: '2560 x 1440', value: '2560x1440' },
              ]} />
            </Box>
            <Box style={{ gap: 4 }}>
              <Text style={{ color: DIM, fontSize: 10 }}>Quality</Text>
              <Select value={quality} onValueChange={setQuality} options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Ultra', value: 'ultra' },
              ]} />
            </Box>
            <Divider color={BORDER} />
            <Checkbox value={fullscreen} onValueChange={setFullscreen} label="Fullscreen" />
            <Checkbox value={vsync} onValueChange={setVsync} label="V-Sync" />
            <Checkbox value={showFps} onValueChange={setShowFps} label="Show FPS" color="#22c55e" />
          </Section>

          <Section title="Difficulty" color="#ef4444">
            <RadioGroup value={difficulty} onValueChange={setDifficulty}>
              <Radio value="easy" label="Easy" color="#22c55e" />
              <Radio value="normal" label="Normal" color="#3b82f6" />
              <Radio value="hard" label="Hard" color="#f59e0b" />
              <Radio value="nightmare" label="Nightmare" color="#ef4444" />
            </RadioGroup>
          </Section>
        </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── System Info ──────────────────────────────────────────

  {
    id: 'system-info',
    name: 'System Info',
    description: 'Neofetch-style display with pixel art',
    category: 'Widget',
    code: `function MyComponent() {
  var HEART_LINES = [
    '  xxx   xxx  ',
    ' xxxxx xxxxx ',
    'xxxxxxxxxxxxx',
    'xxxxxxxxxxxxx',
    ' xxxxxxxxxxx ',
    '  xxxxxxxxx  ',
    '   xxxxxxx   ',
    '    xxxxx    ',
    '     xxx     ',
    '      x      ',
  ];

  var HEART_GRID = HEART_LINES.map(function(line) {
    return line.split('').map(function(ch) { return ch !== ' '; });
  });

  var HEART_COLORS = [
    '#ff6b9d', '#ff5277', '#e94560', '#e94560',
    '#d63447', '#c62828', '#b71c1c', '#9a0007',
    '#7f0000', '#5d0000',
  ];

  var PX = 12;
  var ACCENT = '#e94560';
  var BRIGHT = '#e0e0f0';
  var DIM = '#444466';

  var PALETTE = [
    '#e94560', '#ff6b6b', '#533483', '#845ec2',
    '#0f3460', '#4b8bbe', '#16213e', '#1a1a2e',
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0a0a14', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{
        gap: 12,
        backgroundColor: '#0e0e18',
        borderRadius: 12,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1a1a2e',
      }}>
        <Text style={{ color: ACCENT, fontSize: 18, fontWeight: 'normal' }}>siah@archlinux</Text>
        <Divider color={DIM} />

        <Box style={{ flexDirection: 'row', gap: 24 }}>
          <Box style={{ width: 13 * PX, height: 10 * PX, paddingTop: 4 }}>
            {HEART_GRID.map(function(row, r) {
              return (
                <Box key={r} style={{ flexDirection: 'row' }}>
                  {row.map(function(filled, c) {
                    return (
                      <Box key={c} style={{
                        width: PX,
                        height: PX,
                        backgroundColor: filled ? HEART_COLORS[r] : 'transparent',
                      }} />
                    );
                  })}
                </Box>
              );
            })}
          </Box>

          <Box style={{ gap: 4 }}>
            {[
              ['OS', 'Arch Linux x86_64'],
              ['Kernel', '6.14.0-37-generic'],
              ['Uptime', '3 hours, 42 mins'],
              ['Shell', '/bin/zsh'],
              ['CPU', 'AMD Ryzen 9 7950X (32)'],
              ['Memory', '8192 MiB / 32768 MiB'],
            ].map(function(pair) {
              return (
                <Box key={pair[0]} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: ACCENT, fontSize: 14, fontWeight: 'normal' }}>{pair[0] + ':'}</Text>
                  <Text style={{ color: BRIGHT, fontSize: 14 }}>{pair[1]}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Spacer size={4} />

        <Box style={{ flexDirection: 'row', gap: 2 }}>
          {PALETTE.map(function(color, i) {
            return <Box key={i} style={{ width: 28, height: 14, backgroundColor: color, borderRadius: 2 }} />;
          })}
        </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Weather ──────────────────────────────────────────────

  {
    id: 'weather',
    name: 'Weather Station',
    description: 'Live weather station with bars, sparklines, animated data',
    category: 'Widget',
    code: `function MyComponent() {
  var state = useState({
    temp: 72, feelsLike: 70, high: 78, low: 62,
    humidity: 58, windSpeed: 12, windDir: 'NW',
    pressure: 30.12, dewPoint: 52, uvIndex: 6,
    cloudCover: 32, visibility: 10,
  });
  var w = state[0];
  var setW = state[1];

  var hourlyState = useState([64,63,62,62,63,65,67,70,72,74,75,76,78,77,76,75,73,71,70,68,67,66,65,64]);
  var hourly = hourlyState[0];
  var setHourly = hourlyState[1];

  var forecastState = useState([
    { label: 'Mon', value: 72 }, { label: 'Tue', value: 68 },
    { label: 'Wed', value: 65 }, { label: 'Thu', value: 70 },
    { label: 'Fri', value: 75 }, { label: 'Sat', value: 78 },
    { label: 'Sun', value: 74 },
  ]);
  var forecast = forecastState[0];
  var setForecast = forecastState[1];

  var tickState = useState(0);
  var tick = tickState[0];
  var setTick = tickState[1];

  function drift(base, range) {
    return base + (Math.random() - 0.5) * range;
  }

  useEffect(function() {
    var interval = setInterval(function() {
      setTick(function(t) { return t + 1; });
      setW(function(prev) { return {
        temp: Math.round(drift(prev.temp, 2)),
        feelsLike: Math.round(drift(prev.feelsLike, 2)),
        high: prev.high, low: prev.low, windDir: prev.windDir,
        dewPoint: prev.dewPoint, visibility: prev.visibility,
        humidity: Math.round(Math.max(20, Math.min(95, drift(prev.humidity, 4)))),
        windSpeed: Math.round(Math.max(2, Math.min(30, drift(prev.windSpeed, 3)))),
        pressure: +(Math.max(29.5, Math.min(30.5, drift(prev.pressure, 0.04)))).toFixed(2),
        cloudCover: Math.round(Math.max(5, Math.min(95, drift(prev.cloudCover, 5)))),
        uvIndex: Math.round(Math.max(1, Math.min(11, drift(prev.uvIndex, 1)))),
      }; });
      setHourly(function(prev) { return prev.map(function(t) { return Math.round(drift(t, 1.5)); }); });
      setForecast(function(prev) { return prev.map(function(f) {
        return { label: f.label, value: Math.round(drift(f.value, 2)) };
      }); });
    }, 3000);
    return function() { clearInterval(interval); };
  }, []);

  var animTemp = useSpring(w.temp, { stiffness: 80, damping: 18 });
  var secondsAgo = tick * 3;
  var timeLabel = secondsAgo === 0 ? 'just now' : secondsAgo + 's ago';

  /* ── pixel art sun ── */
  var SUN_LINES = [
    '  .  .  .  ',
    ' .       . ',
    '.  .   .  .',
    '   .###.   ',
    '.  #####  .',
    '   #####   ',
    '.  #####  .',
    '   .###.   ',
    '.  .   .  .',
    ' .       . ',
    '  .  .  .  ',
  ];
  var SUN_PX = 8;
  var SUN_GRID = SUN_LINES.map(function(line) {
    return line.split('').map(function(ch) {
      if (ch === '#') return 'core';
      if (ch === '.') return 'ray';
      return null;
    });
  });

  /* ── theme ── */
  var BG     = '#0e0e18';
  var CARD   = '#12121f';
  var ACCENT_C = '#FFD93D';
  var WARM   = '#F59E0B';
  var HOT    = '#EF4444';
  var COOL   = '#06B6D4';
  var GREEN  = '#4ade80';
  var BLUE   = '#60a5fa';
  var BRIGHT = '#e0e0f0';
  var MID    = '#8888aa';
  var DIM    = '#444466';
  var BORDER = '#1a1a2e';
  var PALETTE = ['#FFD93D', '#FFA726', '#EF4444', '#F59E0B', '#06B6D4', '#60a5fa', '#12121f', '#1a1a2e'];

  function tempColor(t) {
    if (t >= 85) return HOT;
    if (t >= 72) return WARM;
    if (t >= 60) return BLUE;
    if (t >= 45) return COOL;
    return '#a78bfa';
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 12, gap: 10 }}>

      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ width: 11 * SUN_PX, height: 11 * SUN_PX }}>
          {SUN_GRID.map(function(row, r) {
            return (
              <Box key={r} style={{ flexDirection: 'row' }}>
                {row.map(function(cell, c) {
                  return (
                    <Box key={c} style={{
                      width: SUN_PX, height: SUN_PX,
                      borderRadius: cell === 'core' ? 2 : cell === 'ray' ? 4 : 0,
                      backgroundColor: cell === 'core' ? '#FFD93D' : cell === 'ray' ? '#FFA726' : 'transparent',
                    }} />
                  );
                })}
              </Box>
            );
          })}
        </Box>
        <Box style={{ gap: 3 }}>
          <Text style={{ color: ACCENT_C, fontSize: 16, fontWeight: 'normal' }}>
            {Math.round(animTemp) + 'F@sanfrancisco'}
          </Text>
          <Divider color={DIM} />
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: BRIGHT }}>Sunny</Text>
            <Text style={{ fontSize: 10, color: MID }}>{'Feels like ' + w.feelsLike + 'F'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: MID }}>{'Wind ' + w.windSpeed + 'mph ' + w.windDir}</Text>
            <Text style={{ fontSize: 10, color: MID }}>{'Humidity ' + w.humidity + '%'}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 10, color: GREEN }}>{'H:' + w.high + 'F  L:' + w.low + 'F'}</Text>
            <Text style={{ fontSize: 10, color: w.uvIndex > 5 ? WARM : GREEN }}>{'UV ' + w.uvIndex}</Text>
          </Box>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 2, width: '100%', alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 1 }}>
          {PALETTE.map(function(color, i) {
            return <Box key={i} style={{ width: 14, height: 10, backgroundColor: color, borderRadius: 1 }} />;
          })}
        </Box>
        <Spacer size={8} />
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={{ fontSize: 10, color: GREEN }}>live</Text>
          <Text style={{ fontSize: 10, color: MID }}>{'(' + timeLabel + ')'}</Text>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <Box style={{ width: 280, backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
          <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'normal' }}>CONDITIONS</Text>
          <Spacer size={4} />
          {[
            { label: 'temp', val: w.temp + 'F', raw: w.temp, max: 110, color: tempColor(w.temp) },
            { label: 'high', val: w.high + 'F', raw: w.high, max: 110, color: tempColor(w.high) },
            { label: 'low', val: w.low + 'F', raw: w.low, max: 110, color: tempColor(w.low) },
            { label: 'feels', val: w.feelsLike + 'F', raw: w.feelsLike, max: 110, color: tempColor(w.feelsLike) },
            { label: 'wind', val: w.windSpeed + 'mph', raw: w.windSpeed, max: 40, color: BLUE },
            { label: 'humid', val: w.humidity + '%', raw: w.humidity, max: 100, color: COOL },
          ].map(function(row) {
            var pct = row.max > 0 ? Math.min(row.raw / row.max, 1) : 0;
            return (
              <Box key={row.label} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Box style={{ width: 36 }}><Text style={{ fontSize: 10, color: MID }}>{row.label}</Text></Box>
                <Box style={{ width: 48 }}><Text style={{ fontSize: 10, color: BRIGHT }}>{row.val}</Text></Box>
                <Box style={{ width: 130, height: 6, backgroundColor: '#1e1e30', borderRadius: 2 }}>
                  <Box style={{ width: Math.round(130 * pct), height: 6, backgroundColor: row.color, borderRadius: 2 }} />
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box style={{ flexGrow: 1, gap: 12 }}>
          <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER }}>
            <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'normal' }}>ATMOSPHERE</Text>
            <Spacer size={4} />
            {[
              { label: 'pressure', val: w.pressure + ' inHg' },
              { label: 'dewpoint', val: w.dewPoint + 'F' },
              { label: 'visibility', val: w.visibility + ' mi' },
              { label: 'uv index', val: w.uvIndex + '/11', color: w.uvIndex > 5 ? WARM : GREEN },
              { label: 'cloud', val: w.cloudCover + '%' },
              { label: 'sunrise', val: '6:42 AM', color: WARM },
              { label: 'sunset', val: '5:48 PM', color: '#F97316' },
            ].map(function(row) {
              return (
                <Box key={row.label} style={{ flexDirection: 'row', gap: 8 }}>
                  <Box style={{ width: 60 }}><Text style={{ fontSize: 10, color: MID }}>{row.label}</Text></Box>
                  <Text style={{ fontSize: 10, color: row.color || BRIGHT }}>{row.val}</Text>
                </Box>
              );
            })}
          </Box>
          <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER, gap: 4 }}>
            <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'normal' }}>24H TREND</Text>
            <Sparkline data={hourly} width={250} height={28} color={WARM} />
          </Box>
        </Box>
      </Box>

      <Box style={{ flexGrow: 1, backgroundColor: CARD, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: BORDER, gap: 6 }}>
        <Text style={{ color: ACCENT_C, fontSize: 11, fontWeight: 'normal' }}>7-DAY FORECAST</Text>
        <BarChart
          data={forecast.map(function(f) {
            return { label: f.label, value: f.value, color: tempColor(f.value) };
          })}
          height={80}
          showLabels
          showValues
          interactive
        />
      </Box>
    </Box>
  );
}`,
  },

  // ── App Shell ────────────────────────────────────────────

  {
    id: 'app-shell',
    name: 'App Shell',
    description: 'Sidebar, toolbar, breadcrumbs, tabs',
    category: 'Navigation',
    code: `function MyComponent() {
  var [activePage, setActivePage] = useState('dashboard');
  var [activeTab, setActiveTab] = useState('overview');
  var [lastAction, setLastAction] = useState('(none)');

  var NAV_SECTIONS = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'projects', label: 'Projects' },
        { id: 'team', label: 'Team' },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'profile', label: 'Profile' },
        { id: 'billing', label: 'Billing' },
      ],
    },
  ];

  var TOOLBAR_ITEMS = [
    { type: 'item', id: 'new', label: 'New' },
    { type: 'item', id: 'import', label: 'Import' },
    { type: 'divider' },
    { type: 'item', id: 'refresh', label: 'Refresh' },
  ];

  var CONTENT_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  var BREADCRUMB_MAP = {
    dashboard: [{ id: 'home', label: 'Home' }, { id: 'dashboard', label: 'Dashboard' }],
    projects: [{ id: 'home', label: 'Home' }, { id: 'projects', label: 'Projects' }],
    team: [{ id: 'home', label: 'Home' }, { id: 'team', label: 'Team' }],
    profile: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'profile', label: 'Profile' }],
    billing: [{ id: 'home', label: 'Home' }, { id: 'settings-root', label: 'Settings' }, { id: 'billing', label: 'Billing' }],
  };

  var BG = '#08080f';
  var CARD = '#1e293b';
  var BORDER = '#334155';
  var BRIGHT = '#e2e8f0';
  var DIM = '#64748b';

  var breadcrumbs = BREADCRUMB_MAP[activePage] || [{ id: 'home', label: 'Home' }];

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: BG }}>
      <NavPanel
        sections={NAV_SECTIONS}
        activeId={activePage}
        onSelect={function(id) { setActivePage(id); setActiveTab('overview'); }}
        header={<Text style={{ color: '#475569', fontSize: 10, fontWeight: 'normal' }}>ACME APP</Text>}
      />

      <Box style={{ flexGrow: 1, gap: 0 }}>
        <Box style={{ padding: 8 }}>
          <Toolbar items={TOOLBAR_ITEMS} onSelect={setLastAction} />
        </Box>
        <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
          <Breadcrumbs items={breadcrumbs} separator=">" />
        </Box>
        <Divider color={BORDER} />
        <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4 }}>
          <Tabs tabs={CONTENT_TABS} activeId={activeTab} onSelect={setActiveTab} />
        </Box>
        <Box style={{ flexGrow: 1, padding: 16, gap: 12 }}>
          <Text style={{ color: BRIGHT, fontSize: 16, fontWeight: 'normal' }}>
            {breadcrumbs[breadcrumbs.length - 1].label}
          </Text>
          <Text style={{ color: DIM, fontSize: 11 }}>
            {'Viewing: ' + activeTab + ' tab'}
          </Text>
          <Box style={{
            backgroundColor: CARD,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 16,
            flexGrow: 1,
          }}>
            <Text style={{ color: BRIGHT, fontSize: 12 }}>
              Content area for this page and tab.
            </Text>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: '#334155', fontSize: 10 }}>
              {'Last toolbar action: ' + lastAction}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Animation ────────────────────────────────────────────

  {
    id: 'animation',
    name: 'Animation',
    description: 'Spring physics with transform',
    category: 'Motion',
    code: `function MyComponent() {
  var [toggled, setToggled] = useState(false);
  var x = useSpring(toggled ? 160 : 0, { stiffness: 180, damping: 12 });
  var scale = useSpring(toggled ? 1.2 : 1.0, { stiffness: 200, damping: 10 });

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ gap: 16, padding: 24 }}>
      <Pressable
        onPress={function() { setToggled(function(t) { return !t; }); }}
        style={{
          backgroundColor: '#22c55e',
          padding: 10,
          borderRadius: 6,
          alignItems: 'center',
          width: 120,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12 }}>Toggle</Text>
      </Pressable>

      <Box style={{
        width: 60, height: 60,
        backgroundColor: '#ef4444',
        borderRadius: 30,
        transform: { translateX: x, scaleX: scale, scaleY: scale },
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ color: '#fff', fontSize: 10 }}>
          {Math.round(x)}
        </Text>
      </Box>

      <Box style={{
        padding: 8, backgroundColor: '#1e293b', borderRadius: 4, gap: 2,
      }}>
        <Text style={{ color: '#888', fontSize: 10 }}>
          {'translateX: ' + Math.round(x) + 'px'}
        </Text>
        <Text style={{ color: '#888', fontSize: 10 }}>
          {'scale: ' + scale.toFixed(2)}
        </Text>
      </Box>
      </Box>
    </Box>
  );
}`,
  },

  // ── Data Table ───────────────────────────────────────────

  {
    id: 'data-table',
    name: 'Data Table',
    description: 'Sortable table with badges and custom cells',
    category: 'Data',
    code: `function MyComponent() {
  var EMPLOYEES = [
    { name: 'Alice Chen', role: 'Engineer', status: 'active', score: 94, team: 'Platform' },
    { name: 'Bob Park', role: 'Designer', status: 'active', score: 87, team: 'Product' },
    { name: 'Carol Wu', role: 'PM', status: 'away', score: 76, team: 'Growth' },
    { name: 'Dan Kim', role: 'Engineer', status: 'active', score: 91, team: 'Platform' },
    { name: 'Eva Lopez', role: 'Data Sci', status: 'offline', score: 82, team: 'ML' },
    { name: 'Frank Lee', role: 'Engineer', status: 'active', score: 88, team: 'Infra' },
  ];

  function statusVariant(s) {
    if (s === 'active') return 'success';
    if (s === 'away') return 'warning';
    return 'error';
  }

  function scoreColor(s) {
    if (s >= 90) return '#22c55e';
    if (s >= 80) return '#3b82f6';
    if (s >= 70) return '#f59e0b';
    return '#ef4444';
  }

  var COLUMNS = [
    { key: 'name', title: 'Name', width: 100 },
    { key: 'role', title: 'Role', width: 80 },
    {
      key: 'status',
      title: 'Status',
      width: 80,
      render: function(value) { return <Badge label={value} variant={statusVariant(value)} />; },
    },
    {
      key: 'score',
      title: 'Score',
      width: 50,
      align: 'right',
      render: function(value) {
        return <Text style={{ color: scoreColor(value), fontSize: 11, fontWeight: 'normal' }}>{value}</Text>;
      },
    },
    { key: 'team', title: 'Team', width: 80 },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
      <Box style={{ gap: 20, padding: 16 }}>
        <Box style={{ gap: 6 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 'normal' }}>Team Directory</Text>
          <Text style={{ color: '#64748b', fontSize: 11 }}>Employee performance overview</Text>
        </Box>

        <Table columns={COLUMNS} data={EMPLOYEES} rowKey="name" striped />
      </Box>
    </Box>
  );
}`,
  },

  // ── AI + Audio + Controls ───────────────────────────────

  {
    id: 'ai-coproducer-studio',
    name: 'AI Co-Producer Studio',
    description: 'Step sequencer + audio rack hooks + AI co-writing loop',
    category: 'Crossover',
    code: `function MyComponent() {
  var [tempo, setTempo] = useState(118);
  var [energy, setEnergy] = useState(0.62);
  var [swing, setSwing] = useState(0.08);
  var [playing, setPlaying] = useState(false);
  var [recording, setRecording] = useState(false);
  var [step, setStep] = useState(0);

  var audioReady = useAudioInit();
  var rack = useRack({ topologyOnly: true, maxFps: 2 });

  var [pattern, setPattern] = useState([
    [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
    [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
    [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
    [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  ]);
  var [levels, setLevels] = useState([0.35, 0.22, 0.3, 0.24]);
  var [grooveHistory, setGrooveHistory] = useState([58, 61, 59, 63, 64, 60, 65, 68, 66, 70, 69, 72, 68, 71, 73, 75, 74, 77, 76, 78, 79, 80, 78, 81]);
  var [messages, setMessages] = useState([
    { role: 'assistant', content: 'Co-producer online. Ask for drums, bass, or arrangement ideas.' },
  ]);

  function density() {
    var total = 0;
    var t = 0;
    var s = 0;
    for (t = 0; t < pattern.length; t += 1) {
      for (s = 0; s < pattern[t].length; s += 1) {
        if (pattern[t][s]) total += 1;
      }
    }
    return total / (pattern.length * 16);
  }

  useEffect(function() {
    if (!playing) return;
    var msPerStep = Math.max(80, Math.round((60000 / tempo) / 4));
    var interval = setInterval(function() {
      var densNow = density();
      setStep(function(prev) {
        var next = (prev + 1) % 16;
        setLevels(function(old) {
          return old.map(function(v, trackIndex) {
            var hit = pattern[trackIndex] && pattern[trackIndex][next];
            var target = hit
              ? Math.min(1, 0.45 + energy * 0.5 + Math.random() * 0.2)
              : 0.05 + Math.random() * 0.08;
            return v * 0.42 + target * 0.58;
          });
        });
        return next;
      });
      setGrooveHistory(function(prev) {
        var next = prev.slice(1);
        next.push(Math.round(38 + densNow * 52 + energy * 16 + Math.random() * 6));
        return next;
      });
    }, msPerStep);
    return function() { clearInterval(interval); };
  }, [playing, tempo, energy, pattern]);

  function toggleStep(track, stepIndex, active) {
    setPattern(function(prev) {
      return prev.map(function(row, rowIndex) {
        if (rowIndex !== track) return row;
        return row.map(function(cell, colIndex) {
          if (colIndex !== stepIndex) return cell;
          return active;
        });
      });
    });
  }

  function buildReply(prompt) {
    var lower = prompt.toLowerCase();
    var groove = density() > 0.58
      ? 'Groove is dense; carve space on hats or lower swing.'
      : 'Groove has headroom; add syncopation on bass and hats.';
    var mood = energy > 0.7
      ? 'Energy is high, so push transient shape and short fills.'
      : 'Energy is moderate, so let the kick breathe and widen ambience.';
    var detail = 'Try ' + tempo + ' BPM with ' + Math.round(swing * 100) + '% swing.';
    if (lower.indexOf('bass') >= 0) {
      return groove + ' Bass note: mirror kick on step 1 and 9, then ghost note step 12. ' + detail;
    }
    if (lower.indexOf('drum') >= 0 || lower.indexOf('kick') >= 0) {
      return groove + ' Drum note: add one off-beat snare ghost before bar turn. ' + detail;
    }
    if (lower.indexOf('hook') >= 0 || lower.indexOf('melody') >= 0) {
      return mood + ' Hook note: keep phrase to 3 notes, then answer with a higher octave. ' + detail;
    }
    return groove + ' ' + mood + ' ' + detail;
  }

  function sendToAI(text) {
    setMessages(function(prev) {
      return prev.concat([{ role: 'user', content: text }]);
    });
    return new Promise(function(resolve) {
      setTimeout(function() {
        setMessages(function(prev) {
          return prev.concat([{ role: 'assistant', content: buildReply(text) }]);
        });
        resolve();
      }, 280);
    });
  }

  var i = 0;
  var t = 0;
  var stepBars = [];
  for (i = 0; i < 16; i += 1) {
    var hits = 0;
    for (t = 0; t < pattern.length; t += 1) {
      if (pattern[t] && pattern[t][i]) hits += 1;
    }
    stepBars.push({
      label: String(i + 1),
      value: hits,
      color: i === step ? '#fbbf24' : '#38bdf8',
    });
  }

  var grooveLine = grooveHistory.map(function(value, index) {
    return { x: String(index + 1), value: value };
  });

  var radarData = [
    Math.round((1 - swing / 0.3) * 100),
    Math.round(energy * 100),
    Math.round(density() * 100),
    Math.round((tempo - 90) / 70 * 100),
    Math.round((levels[0] + levels[1] + levels[2] + levels[3]) / 4 * 100),
  ];

  var pieData = [
    { label: 'kick', value: Math.round(levels[0] * 100), color: '#22d3ee' },
    { label: 'snare', value: Math.round(levels[1] * 100), color: '#f97316' },
    { label: 'hat', value: Math.round(levels[2] * 100), color: '#a3e635' },
    { label: 'bass', value: Math.round(levels[3] * 100), color: '#f472b6' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#090f1f', padding: 12, gap: 10 }}>
      <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 12 }}>
        <Card
          style={{ flexGrow: 1, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 10 }}
          title="AI Co-Producer Studio"
          subtitle="Compose with controls + chat loop"
        >
          <Box style={{ width: '100%', height: '100%', gap: 10 }}>
            <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                {'Audio engine: ' + (audioReady ? 'ready' : 'loading') + ' | Modules: ' + rack.modules.length + ' | Wires: ' + rack.connections.length}
              </Text>
              <Badge label={recording ? 'REC' : 'LIVE'} variant={recording ? 'error' : 'success'} />
            </Box>

            <TransportBar
              playing={playing}
              recording={recording}
              onPlay={function() { setPlaying(true); }}
              onStop={function() { setPlaying(false); }}
              onRecord={function() { setRecording(function(r) { return !r; }); }}
              bpm={Math.round(tempo)}
              position={'step ' + (step + 1) + '/16'}
            />

            <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'end' }}>
              <Knob value={tempo} onChange={setTempo} min={90} max={160} step={1} label="Tempo" />
              <Fader value={energy} onChange={setEnergy} min={0} max={1} step={0.01} label="Energy" height={70} />
              <Knob value={swing} onChange={setSwing} min={0} max={0.3} step={0.01} label="Swing" />
              <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'end', marginLeft: 8 }}>
                {levels.map(function(level, i) {
                  return (
                    <Box key={i} style={{ alignItems: 'center', gap: 4 }}>
                      <Meter value={level} peak={Math.min(1, level + 0.12)} width={12} height={60} />
                      <Text style={{ color: '#64748b', fontSize: 9 }}>{['K', 'S', 'H', 'B'][i]}</Text>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <StepSequencer
              tracks={4}
              steps={16}
              pattern={pattern}
              currentStep={step}
              onStepToggle={toggleStep}
              trackLabels={['Kick', 'Snare', 'Hat', 'Bass']}
              trackColors={['#22d3ee', '#f97316', '#a3e635', '#f472b6']}
            />

            <ActionBar
              items={[
                { key: 'tight', label: 'Tighten Groove', color: '#93c5fd' },
                { key: 'space', label: 'Add Space', color: '#86efac' },
                { key: 'hook', label: 'Write Hook', color: '#f9a8d4' },
              ]}
              onAction={function(key) {
                if (key === 'tight') sendToAI('Tighten drums and glue the groove');
                if (key === 'space') sendToAI('Create more space in arrangement');
                if (key === 'hook') sendToAI('Give me a melodic hook idea');
              }}
            />

            <Box style={{ flexDirection: 'row', width: '100%', gap: 10, flexGrow: 1 }}>
              <Box style={{
                flexGrow: 1,
                backgroundColor: '#0e1729',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#1e2d45',
                padding: 8,
                gap: 6,
              }}>
                <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'normal' }}>Groove Contour</Text>
                <AreaChart data={grooveLine} width={280} height={100} color="#22d3ee" interactive />
                <BarChart data={stepBars} height={60} showLabels={false} interactive />
              </Box>

              <Box style={{
                width: 180,
                backgroundColor: '#0e1729',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#1e2d45',
                padding: 8,
                gap: 6,
              }}>
                <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'normal' }}>Mix DNA</Text>
                <RadarChart
                  axes={[
                    { label: 'tight' },
                    { label: 'energy' },
                    { label: 'density' },
                    { label: 'pace' },
                    { label: 'headroom' },
                  ]}
                  data={radarData}
                  size={110}
                  color="#a78bfa"
                  interactive
                />
                <PieChart data={pieData} size={100} innerRadius={20} />
                <Text style={{ color: '#64748b', fontSize: 10 }}>
                  {'Pattern density: ' + Math.round(density() * 100) + '%'}
                </Text>
              </Box>
            </Box>
          </Box>
        </Card>

        <Card
          style={{ width: 280, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 8 }}
          title="AI Notes"
          subtitle="Prompt ideas and get production guidance"
        >
          <ActionBar
            items={[
              { key: 'drums', label: 'Drum Fill', color: '#93c5fd' },
              { key: 'bass', label: 'Bass Motif', color: '#f9a8d4' },
              { key: 'mix', label: 'Mix Move', color: '#86efac' },
            ]}
            onAction={function(key) {
              if (key === 'drums') sendToAI('Suggest one 16-step drum variation');
              if (key === 'bass') sendToAI('Give me a bass motif for this groove');
              if (key === 'mix') sendToAI('What is one smart mix adjustment right now');
            }}
          />
          <Box style={{ width: '100%', flexGrow: 1, minHeight: 0 }}>
            <AIMessageList messages={messages} />
          </Box>
          <AIChatInput send={sendToAI} placeholder="ex: Give me a darker bassline and tighter hats" />
        </Card>
      </Box>
    </Box>
  );
}`,
  },

  // ── AI + 3D + Visual Analytics ──────────────────────────

  {
    id: 'scene-alchemist',
    name: 'Scene Alchemist',
    description: 'Prompt-driven 3D mood board + visual telemetry',
    category: 'Crossover',
    code: `function MyComponent() {
  var [mood, setMood] = useState(0.55);
  var [chaos, setChaos] = useState(0.32);
  var [glow, setGlow] = useState(0.7);
  var [meshType, setMeshType] = useState('sphere');
  var [trace, setTrace] = useState([44, 48, 52, 50, 47, 45, 49, 53, 58, 61, 57, 54, 49, 46, 43, 45, 50, 56, 60, 63, 59, 55, 51, 48]);
  var [messages, setMessages] = useState([
    { role: 'assistant', content: 'Describe a vibe and I will reshape the scene.' },
  ]);

  var spin = useSpring(chaos * 320, { stiffness: 90, damping: 14 });
  var pulse = useSpring(0.75 + glow * 0.6, { stiffness: 85, damping: 13 });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parsePrompt(text) {
    var lower = text.toLowerCase();
    var nextMood = mood;
    var nextChaos = chaos;
    var nextGlow = glow;

    if (lower.indexOf('calm') >= 0 || lower.indexOf('ambient') >= 0) nextChaos -= 0.2;
    if (lower.indexOf('chaotic') >= 0 || lower.indexOf('glitch') >= 0) nextChaos += 0.25;
    if (lower.indexOf('dark') >= 0) nextGlow -= 0.2;
    if (lower.indexOf('bright') >= 0 || lower.indexOf('neon') >= 0) nextGlow += 0.2;
    if (lower.indexOf('warm') >= 0) nextMood -= 0.15;
    if (lower.indexOf('cool') >= 0 || lower.indexOf('ocean') >= 0) nextMood += 0.15;

    if (lower.indexOf('cube') >= 0 || lower.indexOf('box') >= 0) setMeshType('box');
    if (lower.indexOf('sphere') >= 0 || lower.indexOf('planet') >= 0) setMeshType('sphere');
    if (lower.indexOf('plane') >= 0) setMeshType('plane');

    nextMood = clamp(nextMood, 0.05, 1);
    nextChaos = clamp(nextChaos, 0, 1);
    nextGlow = clamp(nextGlow, 0, 1);

    setMood(nextMood);
    setChaos(nextChaos);
    setGlow(nextGlow);

    return 'Updated scene: mood ' + Math.round(nextMood * 100) + ', chaos ' + Math.round(nextChaos * 100) + ', glow ' + Math.round(nextGlow * 100) + '.';
  }

  function sendPrompt(text) {
    setMessages(function(prev) { return prev.concat([{ role: 'user', content: text }]); });
    return new Promise(function(resolve) {
      setTimeout(function() {
        setMessages(function(prev) {
          return prev.concat([{ role: 'assistant', content: parsePrompt(text) }]);
        });
        resolve();
      }, 260);
    });
  }

  useEffect(function() {
    var interval = setInterval(function() {
      setTrace(function(prev) {
        var next = prev.slice(1);
        var value = Math.round(30 + mood * 38 + glow * 22 + Math.sin(Date.now() / 900 + chaos * 8) * (8 + chaos * 12));
        next.push(Math.max(6, value));
        return next;
      });
    }, 850);
    return function() { clearInterval(interval); };
  }, [mood, chaos, glow]);

  var colorMain = mood > 0.5 ? '#22d3ee' : '#fb7185';
  var colorAlt = mood > 0.5 ? '#60a5fa' : '#f59e0b';
  var panelBg = mood > 0.5 ? '#06122b' : '#1d0f19';

  var lineData = trace.map(function(value, index) {
    return { x: String(index + 1), value: value };
  });

  var pulseBars = [];
  var i = 0;
  for (i = 0; i < 8; i += 1) {
    var idx = i * 3;
    var barColor = i % 2 === 0 ? colorMain : colorAlt;
    pulseBars.push({
      label: String(i + 1),
      value: Math.max(5, trace[idx] || 0),
      color: barColor,
    });
  }

  var radarData = [
    Math.round((1 - chaos) * 100),
    Math.round(glow * 100),
    Math.round(mood * 100),
    Math.round((0.35 + chaos * 0.65) * 100),
    Math.round((0.2 + glow * 0.8) * 100),
  ];

  var paletteWeight = [
    { label: 'base', value: Math.round((1 - glow) * 100), color: '#1f2937' },
    { label: 'accent', value: Math.round(glow * 100), color: colorMain },
    { label: 'contrast', value: Math.round((chaos * 0.7 + 0.15) * 100), color: colorAlt },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#070b16', padding: 12, gap: 10 }}>
      <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 12 }}>
        <Card
          style={{ flexGrow: 1, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 10 }}
          title="Scene Alchemist"
          subtitle="3D canvas + prompt steering"
        >
          <Box style={{ width: '100%', height: '100%', gap: 10 }}>
            <Scene
              style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden' }}
              backgroundColor={panelBg}
              stars={true}
              orbitControls={true}
            >
              <Camera position={[0, -2.2, 3.2]} lookAt={[0, 0, 0]} />
              <AmbientLight color={mood > 0.5 ? '#0f172a' : '#2a101f'} intensity={0.18 + glow * 0.55} />
              <DirectionalLight direction={[0.35, -1, -0.28]} color={colorMain} intensity={0.35 + glow * 0.7} />
              <Mesh
                geometry={meshType}
                color={colorMain}
                wireframe={chaos > 0.68}
                edgeColor="#0b1020"
                edgeWidth={0.03}
                scale={pulse}
                rotation={[0, spin * 0.02, chaos * 0.5]}
                position={[0, 0.2, 0]}
              />
              <Mesh
                geometry="plane"
                color={colorAlt}
                opacity={0.25}
                scale={[2.2, 2.2, 2.2]}
                rotation={[-1.57, 0, 0]}
                position={[0, -0.9, 0]}
              />
            </Scene>

            <Box style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Box style={{ gap: 2, flexGrow: 1 }}>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>{'Mood: ' + Math.round(mood * 100)}</Text>
                <Slider value={mood} onValueChange={setMood} minimumValue={0} maximumValue={1} step={0.01} />
              </Box>
              <Box style={{ gap: 2, flexGrow: 1 }}>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>{'Chaos: ' + Math.round(chaos * 100)}</Text>
                <Slider value={chaos} onValueChange={setChaos} minimumValue={0} maximumValue={1} step={0.01} />
              </Box>
              <Box style={{ gap: 2, flexGrow: 1 }}>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>{'Glow: ' + Math.round(glow * 100)}</Text>
                <Slider value={glow} onValueChange={setGlow} minimumValue={0} maximumValue={1} step={0.01} />
              </Box>
            </Box>

            <ActionBar
              items={[
                { key: 'neon-night', label: 'Neon Night', color: '#22d3ee' },
                { key: 'ember-void', label: 'Ember Void', color: '#fb7185' },
                { key: 'quiet-fog', label: 'Quiet Fog', color: '#a3e635' },
              ]}
              onAction={function(key) {
                if (key === 'neon-night') sendPrompt('neon cool futuristic city, bright and calm sphere');
                if (key === 'ember-void') sendPrompt('warm dark cinematic chaos with cube and glitch');
                if (key === 'quiet-fog') sendPrompt('calm ambient low chaos with soft plane horizon');
              }}
            />

            <Box style={{ flexDirection: 'row', width: '100%', gap: 10, flexGrow: 1 }}>
              <Box style={{
                flexGrow: 1,
                backgroundColor: '#0d1323',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#1f2a44',
                padding: 8,
                gap: 6,
              }}>
                <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'normal' }}>Atmosphere Wave</Text>
                <AreaChart data={lineData} width={280} height={100} color={colorMain} interactive />
                <BarChart data={pulseBars} height={55} showLabels={false} interactive />
              </Box>

              <Box style={{
                width: 170,
                backgroundColor: '#0d1323',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#1f2a44',
                padding: 8,
                gap: 6,
              }}>
                <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 'normal' }}>Palette Weight</Text>
                <PieChart data={paletteWeight} size={100} innerRadius={20} />
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>{'Mesh: ' + meshType}</Text>
                <Text style={{ color: '#64748b', fontSize: 10 }}>
                  {'Vibe score: ' + Math.round((mood * 0.4 + glow * 0.35 + (1 - chaos) * 0.25) * 100)}
                </Text>
              </Box>
            </Box>
          </Box>
        </Card>

        <Card
          style={{ width: 280, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 8 }}
          title="AI + Metrics"
          subtitle="Prompt log and vibe telemetry"
        >
          <Box style={{ gap: 6 }}>
            <RadarChart
              axes={[
                { label: 'focus' },
                { label: 'glow' },
                { label: 'cool' },
                { label: 'motion' },
                { label: 'depth' },
              ]}
              data={radarData}
              size={110}
              color={colorMain}
              interactive
            />
            <LineChart data={lineData.slice(8)} width={240} height={60} color={colorAlt} showArea interactive />
          </Box>

          <Box style={{ width: '100%', flexGrow: 1, minHeight: 0 }}>
            <AIMessageList messages={messages} />
          </Box>
          <AIChatInput send={sendPrompt} placeholder="ex: Make it darker, calmer, and more cinematic" />
        </Card>
      </Box>
    </Box>
  );
}`,
  },

  // ── AI + Game Systems + Controls ────────────────────────

  {
    id: 'bossfight-conductor',
    name: 'Bossfight Conductor',
    description: 'Combat systems + quest tracking + AI tactical coach',
    category: 'Crossover',
    code: `function MyComponent() {
  var hero = useCombat({
    stats: { hp: 120, maxHp: 120, attack: 18, defense: 6, mp: 42, maxMp: 42 },
  });
  var boss = useCombat({
    stats: { hp: 260, maxHp: 260, attack: 14, defense: 4, mp: 0, maxMp: 0 },
  });
  var bag = useInventory({ slots: 8, maxStack: 5 });
  var quests = useQuest([
    {
      id: 'break-shield',
      name: 'Break The Shield',
      description: 'Punch through phase one armor',
      objectives: [{ description: 'Land heavy strikes', current: 0, target: 6 }],
    },
    {
      id: 'finale',
      name: 'Finale Burst',
      description: 'Finish with controlled aggression',
      objectives: [{ description: 'Drop boss below 20% HP', current: 0, target: 1 }],
    },
  ]);

  var [booted, setBooted] = useState(false);
  var [playing, setPlaying] = useState(false);
  var [intensity, setIntensity] = useState(0.52);
  var [focus, setFocus] = useState(0.58);
  var [messages, setMessages] = useState([
    { role: 'assistant', content: 'Tactical AI online. Keep rhythm, conserve potions, finish clean.' },
  ]);

  useEffect(function() {
    if (booted) return;
    bag.add({ id: 'potion', name: 'Potion', quantity: 3, maxStack: 5 });
    bag.add({ id: 'ether', name: 'Ether', quantity: 2, maxStack: 5 });
    quests.start('break-shield');
    setBooted(true);
  }, [booted]);

  useEffect(function() {
    if (!playing) return;
    if (hero.isDead || boss.isDead) return;
    var interval = setInterval(function() {
      var incoming = Math.round(7 + Math.random() * 9 + intensity * 7);
      hero.takeDamage({ amount: incoming, type: 'void' });
      hero.update(0.9);
      boss.update(0.9);
      if (hero.isDead) setPlaying(false);
    }, 900);
    return function() { clearInterval(interval); };
  }, [playing, intensity, hero.isDead, boss.isDead]);

  function pushAI(text) {
    setMessages(function(prev) { return prev.concat([{ role: 'assistant', content: text }]); });
  }

  function strike() {
    if (hero.isDead || boss.isDead) return;
    var base = 10 + Math.random() * 8;
    var dmg = Math.round(base * (0.85 + intensity * 0.95));
    var dealt = boss.takeDamage({ amount: dmg, type: 'physical' });
    quests.incrementObjective('break-shield', 0, 1);
    if (quests.isComplete('break-shield')) quests.complete('break-shield');

    var counter = Math.round(3 + Math.random() * 5 + (1 - focus) * 5);
    hero.takeDamage({ amount: counter, type: 'counter' });

    if (boss.stats.hp <= boss.stats.maxHp * 0.2) {
      quests.start('finale');
      quests.updateObjective('finale', 0, 1);
      quests.complete('finale');
      pushAI('Window open. Final burst now while stagger is active.');
    } else {
      pushAI('Strike landed for ' + dealt + '. Keep pressure steady.');
    }
  }

  function drinkPotion() {
    if (bag.remove('potion', 1)) {
      hero.heal(28);
      pushAI('Potion consumed. Stabilize and re-enter on beat.');
    } else {
      pushAI('No potion stacks left. Play safer for the next 8 steps.');
    }
  }

  function overdrive() {
    setIntensity(function(v) { return Math.min(1, v + 0.12); });
    hero.addBuff({ id: 'overdrive', stat: 'attack', modifier: 1.2, duration: 4 });
    pushAI('Overdrive engaged. Land two precise hits before backing off.');
  }

  function askCoach(text) {
    setMessages(function(prev) { return prev.concat([{ role: 'user', content: text }]); });
    return new Promise(function(resolve) {
      setTimeout(function() {
        var hpPct = Math.round((hero.stats.hp / hero.stats.maxHp) * 100);
        var bossPct = Math.round((boss.stats.hp / boss.stats.maxHp) * 100);
        var tip = 'Hero ' + hpPct + '%, boss ' + bossPct + '%. ';
        if (hpPct < 35) tip += 'You are in danger. Potion first, strike second.';
        else if (bossPct < 30) tip += 'Boss is in collapse range. Stay aggressive but clean.';
        else tip += 'You can trade one hit, then reset focus and continue.';
        pushAI(tip);
        resolve();
      }, 260);
    });
  }

  var threat = Math.min(1, (1 - hero.stats.hp / hero.stats.maxHp) * 0.6 + intensity * 0.4);
  var phase = boss.stats.hp > boss.stats.maxHp * 0.5 ? 'Phase I' : 'Phase II';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#080d18', padding: 12 }}>
      <Box style={{ flexDirection: 'row', width: '100%', height: '100%', gap: 12 }}>
        <Card
          style={{ flexGrow: 1, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 8 }}
          title="Bossfight Conductor"
          subtitle="Run the encounter like a performance"
        >
          <Box style={{ width: '100%', height: '100%', gap: 8 }}>
            <Box style={{ gap: 4 }}>
              <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, width: 30 }}>Hero</Text>
                <HealthBar hp={hero.stats.hp} maxHp={hero.stats.maxHp} width={220} height={10} />
                <GameStatusBar value={Math.round(focus * 100)} max={100} width={80} height={6} fillColor="#38bdf8" />
              </Box>
              <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
                <Text style={{ color: '#94a3b8', fontSize: 11, width: 30 }}>Boss</Text>
                <HealthBar hp={boss.stats.hp} maxHp={boss.stats.maxHp} width={220} height={10} />
                <Badge label={phase} variant="warning" />
              </Box>
            </Box>

            <Box style={{ flexDirection: 'row', width: '100%', gap: 10 }}>
              <Box style={{ flexGrow: 1 }}>
                <QuestLog quests={quests} width={220} showCompleted />
              </Box>
              <Box style={{ gap: 4 }}>
                <Text style={{ color: '#64748b', fontSize: 10 }}>Inventory</Text>
                <InventoryGrid inventory={bag} columns={4} slotSize={28} />
              </Box>
            </Box>

            <TransportBar
              playing={playing}
              onPlay={function() { setPlaying(true); }}
              onStop={function() { setPlaying(false); }}
              bpm={Math.round(96 + intensity * 52)}
              position={phase}
            />

            <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'end' }}>
              <Knob value={intensity} onChange={setIntensity} min={0} max={1} step={0.01} label="Intensity" />
              <Fader value={focus} onChange={setFocus} min={0} max={1} step={0.01} label="Focus" height={70} />
              <Box style={{ alignItems: 'center', gap: 4 }}>
                <Meter value={threat} peak={Math.min(1, threat + 0.1)} width={12} height={60} />
                <Text style={{ color: '#94a3b8', fontSize: 9 }}>Threat</Text>
              </Box>
              <ActionBar
                size="md"
                items={[
                  { key: 'strike', label: 'Strike', color: '#93c5fd' },
                  { key: 'potion', label: 'Potion', color: '#86efac' },
                  { key: 'overdrive', label: 'Overdrive', color: '#f9a8d4' },
                ]}
                onAction={function(key) {
                  if (key === 'strike') strike();
                  if (key === 'potion') drinkPotion();
                  if (key === 'overdrive') overdrive();
                }}
              />
            </Box>
          </Box>
        </Card>

        <Card
          style={{ width: 280, height: '100%' }}
          bodyStyle={{ height: '100%', gap: 8 }}
          title="AI Coach"
          subtitle="Tactical guidance"
        >
          <ActionBar
            size="sm"
            items={[
              { key: 'assess', label: 'Assess', color: '#93c5fd' },
              { key: 'survive', label: 'Survive', color: '#86efac' },
            ]}
            onAction={function(key) {
              if (key === 'assess') askCoach('What should I do right now?');
              if (key === 'survive') askCoach('How do I survive this phase?');
            }}
          />
          <Box style={{ width: '100%', flexGrow: 1, minHeight: 0 }}>
            <AIMessageList messages={messages} />
          </Box>
          <AIChatInput send={askCoach} placeholder="ex: Should I burst or heal?" />
        </Card>
      </Box>
    </Box>
  );
}`,
  },
];
