// ── GPIO types ─────────────────────────────────────────────

export type GPIODirection = 'input' | 'output';

export type GPIOLineInfo = {
  chip: string;
  offset: number;
  name: string;
  consumer: string;
  direction: GPIODirection;
  activeLow: boolean;
  used: boolean;
};

export type GPIOChipInfo = {
  name: string;
  label: string;
  lines: number;
};

export type GPIOBoardState = {
  available: boolean;
  chips: GPIOChipInfo[];
  lines: GPIOLineInfo[];
  error: string | null;
};

export type GPIOPinState = {
  value: boolean;
  error: string | null;
};

export type PWMPinState = {
  duty: number;
  frequency: number;
  enabled: boolean;
  error: string | null;
};

export type I2CDeviceInfo = {
  bus: number;
  address: number;
  present: boolean;
};

export type SensorState = {
  devices: I2CDeviceInfo[];
  reading: number | null;
  bytes: number[];
  error: string | null;
};
