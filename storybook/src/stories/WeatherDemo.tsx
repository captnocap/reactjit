import React, { useState } from 'react';
import {
  Box, Text, Pressable, Tabs, BarChart,
  Sparkline, ProgressBar, Badge, useSpring,
} from '../../../packages/shared/src';

/* ── Pixel art weather icons ──────────────────────────── */
// '#' = primary fill, '.' = accent fill, ' ' = empty

const SUN_LINES = [
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

const CLOUD_LINES = [
  '    ###      ',
  '  #######    ',
  ' #########   ',
  '############ ',
  '#############',
  ' ########### ',
];

const RAIN_LINES = [
  '    ###      ',
  '  #######    ',
  ' #########   ',
  '############ ',
  '#############',
  ' ########### ',
  '  .    .     ',
  '   .    .  . ',
  '  .    .     ',
];

interface IconDef {
  lines: string[];
  chars: Record<string, { color: string; radius?: number }>;
}

const ICON_DEFS: Record<string, IconDef> = {
  sun: {
    lines: SUN_LINES,
    chars: {
      '.': { color: '#FFA726', radius: 3 },
      '#': { color: '#FFD93D' },
    },
  },
  cloud: {
    lines: CLOUD_LINES,
    chars: { '#': { color: '#90A4AE' } },
  },
  rain: {
    lines: RAIN_LINES,
    chars: {
      '#': { color: '#78909C' },
      '.': { color: '#60A5FA', radius: 2 },
    },
  },
};

function WeatherIcon({ type, px = 6 }: { type: string; px?: number }) {
  const def = ICON_DEFS[type];
  const width = Math.max(...def.lines.map(l => l.length));
  return (
    <Box style={{ width: width * px, height: def.lines.length * px }}>
      {def.lines.map((line, r) => (
        <Box key={r} style={{ flexDirection: 'row' }}>
          {[...line.padEnd(width)].map((ch, c) => {
            const d = def.chars[ch];
            return (
              <Box key={c} style={{
                width: px,
                height: px,
                backgroundColor: d ? d.color : 'transparent',
                borderRadius: d?.radius ?? (d ? 1 : 0),
              }} />
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

/* ── Colors ────────────────────────────────────────────── */

const BG     = '#0b1120';
const CARD   = '#111827';
const BORDER = '#1e293b';
const BRIGHT = '#e2e8f0';
const DIM    = '#64748b';
const MUTED  = '#475569';
const ACCENT = '#60A5FA';
const WARM   = '#F59E0B';
const HOT    = '#EF4444';
const COOL   = '#06B6D4';

function tempColor(t: number): string {
  if (t >= 80) return HOT;
  if (t >= 70) return WARM;
  if (t >= 60) return ACCENT;
  if (t >= 50) return COOL;
  return '#8B5CF6';
}

function formatHour(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

/* ── City weather data ────────────────────────────────── */

interface CityData {
  name: string;
  abbr: string;
  temp: number;
  feelsLike: number;
  high: number;
  low: number;
  condition: string;
  badge: 'success' | 'info' | 'warning' | 'error' | 'default';
  icon: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  cloudCover: number;
  sunrise: string;
  sunset: string;
  pressure: number;
  dewPoint: number;
  hourly: number[];
  forecast: { label: string; value: number }[];
}

const CITIES: CityData[] = [
  {
    name: 'San Francisco', abbr: 'SF',
    temp: 62, feelsLike: 59, high: 66, low: 54,
    condition: 'Partly Cloudy', badge: 'info', icon: 'cloud',
    humidity: 0.72, windSpeed: 14, uvIndex: 0.36, cloudCover: 0.65,
    sunrise: '6:52 AM', sunset: '5:48 PM', pressure: 30.12, dewPoint: 52,
    hourly: [58,57,56,55,56,58,60,62,64,65,66,64,63,62,61,60,59,58,57,56,55,55,54,55],
    forecast: [
      { label: 'Mon', value: 64 }, { label: 'Tue', value: 61 },
      { label: 'Wed', value: 58 }, { label: 'Thu', value: 63 },
      { label: 'Fri', value: 66 }, { label: 'Sat', value: 68 },
      { label: 'Sun', value: 65 },
    ],
  },
  {
    name: 'Miami', abbr: 'MIA',
    temp: 84, feelsLike: 89, high: 88, low: 76,
    condition: 'Sunny', badge: 'warning', icon: 'sun',
    humidity: 0.68, windSpeed: 8, uvIndex: 0.82, cloudCover: 0.12,
    sunrise: '6:58 AM', sunset: '6:18 PM', pressure: 30.05, dewPoint: 72,
    hourly: [78,77,76,76,77,79,81,83,85,87,88,87,86,85,84,83,82,81,80,79,78,78,77,77],
    forecast: [
      { label: 'Mon', value: 86 }, { label: 'Tue', value: 84 },
      { label: 'Wed', value: 82 }, { label: 'Thu', value: 85 },
      { label: 'Fri', value: 88 }, { label: 'Sat', value: 87 },
      { label: 'Sun', value: 83 },
    ],
  },
  {
    name: 'Seattle', abbr: 'SEA',
    temp: 48, feelsLike: 43, high: 52, low: 41,
    condition: 'Rainy', badge: 'default', icon: 'rain',
    humidity: 0.89, windSpeed: 18, uvIndex: 0.09, cloudCover: 0.92,
    sunrise: '7:12 AM', sunset: '5:32 PM', pressure: 29.85, dewPoint: 45,
    hourly: [44,43,43,42,42,43,44,46,48,49,50,51,52,51,50,49,48,47,46,45,44,43,43,42],
    forecast: [
      { label: 'Mon', value: 50 }, { label: 'Tue', value: 47 },
      { label: 'Wed', value: 45 }, { label: 'Thu', value: 48 },
      { label: 'Fri', value: 52 }, { label: 'Sat', value: 54 },
      { label: 'Sun', value: 51 },
    ],
  },
];

/* ── Animated temperature ─────────────────────────────── */

function AnimatedTemp({ value }: { value: number }) {
  const animated = useSpring(value, { stiffness: 60, damping: 14 });
  return (
    <Text style={{ color: tempColor(value), fontSize: 48, fontWeight: 'bold' }}>
      {`${Math.round(animated)}F`}
    </Text>
  );
}

/* ── Main ─────────────────────────────────────────────── */

const TAB_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'forecast', label: '7-Day Forecast' },
];

export function WeatherDemoStory() {
  const [cityIdx, setCityIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('today');
  const city = CITIES[cityIdx];

  const stats = [
    { label: 'Humidity', value: city.humidity, display: `${Math.round(city.humidity * 100)}%`, color: COOL },
    { label: 'Wind', value: Math.min(city.windSpeed / 40, 1), display: `${city.windSpeed} mph`, color: ACCENT },
    { label: 'UV Index', value: city.uvIndex, display: `${Math.round(city.uvIndex * 11)}/11`, color: city.uvIndex > 0.5 ? HOT : WARM },
    { label: 'Cloud Cover', value: city.cloudCover, display: `${Math.round(city.cloudCover * 100)}%`, color: '#90A4AE' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 14, gap: 10 }}>

      {/* ── Header: city selector + date ── */}
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {CITIES.map((c, i) => (
            <Pressable
              key={c.name}
              onPress={() => setCityIdx(i)}
              style={(state) => ({
                paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
                borderRadius: 6,
                backgroundColor: i === cityIdx ? '#334155' : state.hovered ? '#1e293b' : 'transparent',
                borderWidth: 1,
                borderColor: i === cityIdx ? ACCENT : 'transparent',
              })}
            >
              <Text style={{
                color: i === cityIdx ? BRIGHT : DIM,
                fontSize: 11,
                fontWeight: i === cityIdx ? 'bold' : 'normal',
              }}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </Box>
        <Text style={{ color: MUTED, fontSize: 10 }}>Feb 16, 2026</Text>
      </Box>

      {/* ── Hero: icon + temperature + condition + sparkline ── */}
      <Box style={{
        flexDirection: 'row',
        backgroundColor: CARD,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER,
        gap: 16,
        alignItems: 'center',
      }}>
        <WeatherIcon type={city.icon} px={6} />

        <Box style={{ flexGrow: 1, gap: 2 }}>
          <AnimatedTemp value={city.temp} />
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Badge label={city.condition} variant={city.badge} />
            <Text style={{ color: DIM, fontSize: 11 }}>
              {`Feels like ${city.feelsLike}F`}
            </Text>
          </Box>
          <Text style={{ color: MUTED, fontSize: 11 }}>
            {`H:${city.high}F  L:${city.low}F`}
          </Text>
        </Box>

        <Box style={{ gap: 4, alignItems: 'center' }}>
          <Text style={{ color: DIM, fontSize: 9 }}>24h Trend</Text>
          <Sparkline data={city.hourly} width={80} height={32} color={tempColor(city.temp)} />
        </Box>
      </Box>

      {/* ── Stats row: 4 mini cards with ProgressBar ── */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
        {stats.map((s) => (
          <Box key={s.label} style={{
            flexGrow: 1,
            backgroundColor: CARD,
            borderRadius: 8,
            padding: 10,
            gap: 6,
            borderWidth: 1,
            borderColor: BORDER,
          }}>
            <Text style={{ color: DIM, fontSize: 9 }}>{s.label}</Text>
            <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>{s.display}</Text>
            <ProgressBar value={s.value} color={s.color} height={4} animated />
          </Box>
        ))}
      </Box>

      {/* ── Tabbed content: Today / 7-Day Forecast ── */}
      <Box style={{
        flexGrow: 1,
        backgroundColor: CARD,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
      }}>
        <Box style={{ padding: 8 }}>
          <Tabs tabs={TAB_ITEMS} activeId={activeTab} onSelect={setActiveTab} variant="pill" />
        </Box>

        {activeTab === 'today' ? (
          <Box style={{ flexGrow: 1, padding: 14, gap: 8 }}>
            <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>
              Hourly Temperature
            </Text>
            <BarChart
              data={city.hourly.map((t, i) => ({
                label: i % 3 === 0 ? formatHour(i) : '',
                value: t,
                color: tempColor(t),
              }))}
              height={80}
              gap={1}
              showLabels
              interactive
            />
            <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
              {[
                { label: 'Now', temp: city.temp },
                { label: 'Peak', temp: city.high },
                { label: 'Low', temp: city.low },
              ].map((item) => (
                <Box key={item.label} style={{ flexDirection: 'row', gap: 4 }}>
                  <Text style={{ color: DIM, fontSize: 10 }}>{`${item.label}:`}</Text>
                  <Text style={{ color: tempColor(item.temp), fontSize: 10, fontWeight: 'bold' }}>
                    {`${item.temp}F`}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box style={{ flexGrow: 1, padding: 14, gap: 8 }}>
            <Text style={{ color: BRIGHT, fontSize: 13, fontWeight: 'bold' }}>
              Weekly Forecast
            </Text>
            <BarChart
              data={city.forecast.map((f) => ({
                label: f.label,
                value: f.value,
                color: tempColor(f.value),
              }))}
              height={110}
              showLabels
              showValues
              interactive
              color={ACCENT}
            />
          </Box>
        )}
      </Box>

      {/* ── Footer: sunrise, sunset, pressure, dew point ── */}
      <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { label: 'Sunrise', value: city.sunrise, color: WARM },
            { label: 'Sunset', value: city.sunset, color: '#F97316' },
            { label: 'Pressure', value: `${city.pressure} inHg`, color: DIM },
            { label: 'Dew Point', value: `${city.dewPoint}F`, color: COOL },
          ].map((item) => (
            <Box key={item.label} style={{ flexDirection: 'row', gap: 3 }}>
              <Text style={{ color: item.color, fontSize: 10, fontWeight: 'bold' }}>
                {`${item.label}:`}
              </Text>
              <Text style={{ color: BRIGHT, fontSize: 10 }}>{item.value}</Text>
            </Box>
          ))}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 2 }}>
          {[COOL, ACCENT, '#3B82F6', WARM, HOT, '#22C55E', '#8B5CF6'].map((color, i) => (
            <Box key={i} style={{ width: 16, height: 6, backgroundColor: color, borderRadius: 1 }} />
          ))}
        </Box>
      </Box>

    </Box>
  );
}
