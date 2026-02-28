/**
 * GPIO hooks — imperative wrappers around declarative GPIO components.
 *
 * These hooks render invisible capability components internally and return
 * state + controls. Perfect for when you want to interact with hardware
 * without writing JSX for the hardware parts.
 *
 * @example
 * const { value, setValue } = usePin(17, 'output');
 * const { duty, setDuty } = usePWM(18);
 * const { lastLine, send } = useSerial('/dev/ttyUSB0', 115200);
 * const { value: temp } = useI2C(1, 0x48, { register: 0x00 });
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Pin, PWM, SerialPort, I2CDevice } from './capabilities';
import type { LoveEvent } from './types';

// ── usePin ────────────────────────────────────────────────

export interface UsePinOptions {
  chip?: string;
  pull?: 'none' | 'up' | 'down';
  edge?: 'none' | 'rising' | 'falling' | 'both';
  activeLow?: boolean;
}

export interface UsePinResult {
  value: boolean;
  setValue: (v: boolean) => void;
  lastEdge: string | null;
  /** Render this in your component tree */
  element: React.ReactElement;
}

export function usePin(
  pin: number,
  mode: 'input' | 'output' = 'input',
  opts?: UsePinOptions,
): UsePinResult {
  const [value, setValueState] = useState(false);
  const [lastEdge, setLastEdge] = useState<string | null>(null);

  const setValue = useCallback((v: boolean) => {
    setValueState(v);
  }, []);

  const handleChange = useCallback((e: LoveEvent) => {
    setValueState(!!e.value);
    if (e.edgeType) setLastEdge(e.edgeType as string);
  }, []);

  const element = (
    <Pin
      pin={pin}
      mode={mode}
      value={value}
      chip={opts?.chip}
      pull={opts?.pull}
      edge={opts?.edge ?? (mode === 'input' ? 'both' : 'none')}
      activeLow={opts?.activeLow}
      onChange={mode === 'input' ? handleChange : undefined}
    />
  );

  return { value, setValue, lastEdge, element };
}

// ── usePWM ────────────────────────────────────────────────

export interface UsePWMOptions {
  chip?: string;
  frequency?: number;
  enabled?: boolean;
}

export interface UsePWMResult {
  duty: number;
  setDuty: (d: number) => void;
  frequency: number;
  setFrequency: (f: number) => void;
  element: React.ReactElement;
}

export function usePWM(
  pin: number,
  opts?: UsePWMOptions,
): UsePWMResult {
  const [duty, setDuty] = useState(0);
  const [frequency, setFrequency] = useState(opts?.frequency ?? 1000);

  const element = (
    <PWM
      pin={pin}
      chip={opts?.chip}
      duty={duty}
      frequency={frequency}
      enabled={opts?.enabled}
    />
  );

  return { duty, setDuty, frequency, setFrequency, element };
}

// ── useSerial ─────────────────────────────────────────────

export interface UseSerialOptions {
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
}

export interface UseSerialResult {
  lastLine: string | null;
  lines: string[];
  lastData: string | null;
  send: (data: string) => void;
  element: React.ReactElement;
}

export function useSerial(
  port: string,
  baud: number = 9600,
  opts?: UseSerialOptions,
): UseSerialResult {
  const [lastLine, setLastLine] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [lastData, setLastData] = useState<string | null>(null);
  const sendBufferRef = useRef<string[]>([]);

  const handleLine = useCallback((e: LoveEvent) => {
    const line = (e as any).line as string;
    setLastLine(line);
    setLines(prev => [...prev, line]);
  }, []);

  const handleData = useCallback((e: LoveEvent) => {
    setLastData((e as any).data as string);
  }, []);

  // send is a no-op placeholder — serial writes need to go through the
  // capability's Lua side. For now, users can use bridge.rpc() for writes.
  const send = useCallback((_data: string) => {
    sendBufferRef.current.push(_data);
  }, []);

  const element = (
    <SerialPort
      port={port}
      baud={baud}
      dataBits={opts?.dataBits}
      stopBits={opts?.stopBits}
      parity={opts?.parity}
      flowControl={opts?.flowControl}
      onLine={handleLine}
      onData={handleData}
    />
  );

  return { lastLine, lines, lastData, send, element };
}

// ── useI2C ────────────────────────────────────────────────

export interface UseI2COptions {
  register?: number;
  readLength?: number;
  pollInterval?: number;
  enabled?: boolean;
}

export interface UseI2CResult {
  value: number;
  bytes: number[];
  element: React.ReactElement;
}

export function useI2C(
  bus: number,
  address: number,
  opts?: UseI2COptions,
): UseI2CResult {
  const [value, setValue] = useState(0);
  const [bytes, setBytes] = useState<number[]>([]);

  const handleData = useCallback((e: LoveEvent) => {
    const ev = e as any;
    if (ev.value !== undefined) setValue(ev.value);
    if (ev.bytes) setBytes(ev.bytes);
  }, []);

  const element = (
    <I2CDevice
      bus={bus}
      address={address}
      register={opts?.register}
      readLength={opts?.readLength}
      pollInterval={opts?.pollInterval}
      enabled={opts?.enabled}
      onData={handleData}
    />
  );

  return { value, bytes, element };
}
