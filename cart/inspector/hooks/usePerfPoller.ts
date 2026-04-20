import { useState, useEffect, useCallback } from 'react';
import { PerfSample, TreeStats } from '../types';
import { TIMING } from '../constants';
import {
  getHostFps,
  getHostLayoutUs,
  getHostPaintUs,
  getHostTickUs,
  getHostTelemetry,
} from '../bridge';

export function usePerfPoller(onTreeRefresh: () => void, intervalMs: number = TIMING.pollIntervalMs) {
  const [perf, setPerf] = useState({
    fps: 0,
    layoutUs: 0,
    paintUs: 0,
    frameTotalUs: 0,
    nodes: 0,
    visible: 0,
    text: 0,
    pressable: 0,
    scroll: 0,
  });
  const [telemetry, setTelemetry] = useState<TreeStats>({
    total: 0,
    visible: 0,
    hidden: 0,
    text: 0,
    image: 0,
    pressable: 0,
    scroll: 0,
    zero: 0,
  });
  const [history, setHistory] = useState<PerfSample[]>([]);

  const tick = useCallback(() => {
    onTreeRefresh();
    const fps = getHostFps();
    const layoutUs = getHostLayoutUs();
    const paintUs = getHostPaintUs();
    const frameTotalUs = getHostTickUs();
    const tel = getHostTelemetry();

    const sample: PerfSample = {
      fps,
      layoutUs,
      paintUs,
      frameTotalUs,
      nodes: tel?.total || 0,
      visible: tel?.visible || 0,
      text: tel?.text || 0,
      pressable: tel?.pressable || 0,
      scroll: tel?.scroll || 0,
      time: performance.now(),
    };

    setHistory((prev) => {
      const next = [...prev, sample];
      if (next.length > TIMING.perfSamples * 5) next.shift();
      return next;
    });

    setPerf({
      fps,
      layoutUs,
      paintUs,
      frameTotalUs,
      nodes: tel?.total || 0,
      visible: tel?.visible || 0,
      text: tel?.text || 0,
      pressable: tel?.pressable || 0,
      scroll: tel?.scroll || 0,
    });

    setTelemetry({
      total: tel?.total || 0,
      visible: tel?.visible || 0,
      hidden: tel?.hidden || 0,
      text: tel?.text || 0,
      image: tel?.image || 0,
      pressable: tel?.pressable || 0,
      scroll: tel?.scroll || 0,
      zero: tel?.zero_size || 0,
    });
  }, [onTreeRefresh]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [tick]);

  return { perf, telemetry, history };
}
