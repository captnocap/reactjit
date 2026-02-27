/**
 * useWeather — fetches current conditions from wttr.in every 10 minutes.
 *
 * Uses shell:exec + curl so it works inside Love2D with no browser fetch.
 * Format: `%c %t %C` → emoji + temp + condition description.
 * Falls back gracefully if curl fails or network is unavailable.
 */
import { useState, useEffect, useRef } from 'react';
import { useLoveRPC, useLuaInterval } from '@reactjit/core';

const POLL_MS = 10 * 60 * 1000;   // 10 minutes
const TIMEOUT = 8;                  // curl timeout in seconds

// wttr.in custom format — emoji icon, temp in Celsius, condition text
const URL = 'wttr.in/?format=%c+%t+%C';

export interface WeatherData {
  icon:      string;   // weather emoji
  temp:      string;   // e.g. "+18°C"
  condition: string;   // e.g. "Partly cloudy"
  raw:       string;
  loading:   boolean;
  error:     boolean;
  lastFetch: number;
}

const LOADING: WeatherData = {
  icon: '', temp: '', condition: '', raw: '', loading: true, error: false, lastFetch: 0,
};
const EMPTY: WeatherData = {
  icon: '?', temp: '--', condition: '', raw: '', loading: false, error: true, lastFetch: 0,
};

function parse(raw: string): WeatherData {
  const text = raw.trim();
  if (!text) return EMPTY;

  // wttr.in format="%c %t %C" → "⛅ +18°C Partly cloudy"
  // The emoji is the first grapheme cluster, temp follows, rest is condition
  const match = text.match(/^(\S+)\s+([+-]?\d+°[CF])\s+(.+)$/);
  if (match) {
    return {
      icon:      match[1],
      temp:      match[2],
      condition: match[3].replace(/\s+/g, ' ').trim(),
      raw:       text,
      loading:   false,
      error:     false,
      lastFetch: Date.now(),
    };
  }

  // Fallback: just show raw output trimmed
  return {
    icon: '~', temp: text.slice(0, 10), condition: '', raw: text,
    loading: false, error: false, lastFetch: Date.now(),
  };
}

export function useWeather(): WeatherData {
  const rpcExec = useLoveRPC('shell:exec');
  const rpcRef  = useRef(rpcExec);
  rpcRef.current = rpcExec;

  const [data, setData] = useState<WeatherData>(LOADING);

  useEffect(() => {
    let alive = true;

    const fetch = async () => {
      try {
        const res = await rpcRef.current({
          command:   `curl -s --max-time ${TIMEOUT} "${URL}" 2>/dev/null`,
          maxOutput: 256,
        }) as any;

        if (!alive) return;

        if (res?.ok && res?.output?.trim()) {
          setData(parse(res.output));
        } else {
          setData(prev => ({ ...EMPTY, lastFetch: Date.now(), icon: prev.icon || '?' }));
        }
      } catch {
        if (alive) setData(EMPTY);
      }
    };

    fetch();
    return () => { alive = false; };
  }, []);

  useLuaInterval(POLL_MS, async () => {
    try {
      const res = await rpcRef.current({
        command:   `curl -s --max-time ${TIMEOUT} "${URL}" 2>/dev/null`,
        maxOutput: 256,
      }) as any;

      if (res?.ok && res?.output?.trim()) {
        setData(parse(res.output));
      } else {
        setData(prev => ({ ...EMPTY, lastFetch: Date.now(), icon: prev.icon || '?' }));
      }
    } catch {
      setData(EMPTY);
    }
  });

  return data;
}
