// ── Unit categories ──────────────────────────────────────

export type LengthUnit = 'mm' | 'cm' | 'm' | 'km' | 'in' | 'ft' | 'yd' | 'mi' | 'nm' | 'um';
export type WeightUnit = 'mg' | 'g' | 'kg' | 'oz' | 'lb' | 'ton' | 'tonne';
export type TemperatureUnit = 'c' | 'f' | 'k';
export type VolumeUnit = 'ml' | 'l' | 'gal' | 'qt' | 'pt' | 'cup' | 'fl_oz' | 'tbsp' | 'tsp';
export type SpeedUnit = 'mps' | 'kph' | 'mph' | 'knots';
export type AreaUnit = 'mm2' | 'cm2' | 'm2' | 'km2' | 'in2' | 'ft2' | 'yd2' | 'mi2' | 'ha' | 'acre';
export type TimeUnit = 'ms' | 's' | 'min' | 'hr' | 'day' | 'week' | 'month' | 'year';
export type DataUnit = 'b' | 'kb' | 'mb' | 'gb' | 'tb' | 'pb' | 'kib' | 'mib' | 'gib' | 'tib';
export type PressureUnit = 'pa' | 'kpa' | 'bar' | 'atm' | 'psi' | 'mmhg' | 'torr';
export type EnergyUnit = 'j' | 'kj' | 'cal' | 'kcal' | 'wh' | 'kwh' | 'btu' | 'ev';
export type AngleUnit = 'deg' | 'rad' | 'grad' | 'turn';

export type AnyUnit =
  | LengthUnit | WeightUnit | TemperatureUnit | VolumeUnit
  | SpeedUnit | AreaUnit | TimeUnit | DataUnit
  | PressureUnit | EnergyUnit | AngleUnit;

// ── Color types ──────────────────────────────────────────

export interface RGB { r: number; g: number; b: number; }
export interface RGBA { r: number; g: number; b: number; a: number; }
export interface HSL { h: number; s: number; l: number; }
export interface HSLA { h: number; s: number; l: number; a: number; }
export interface HSV { h: number; s: number; v: number; }

export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsv' | 'named';

// ── Encoding types ───────────────────────────────────────

export type EncodingFormat = 'text' | 'base64' | 'hex-enc' | 'url' | 'html';

// ── Number system types ──────────────────────────────────

export type NumberBase = 'decimal' | 'binary' | 'octal' | 'hex-num';

// ── Currency ─────────────────────────────────────────────

export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

// ── Registry types ───────────────────────────────────────

export type ConverterFn<TIn = any, TOut = any> = (value: TIn, opts?: any) => TOut | Promise<TOut>;
