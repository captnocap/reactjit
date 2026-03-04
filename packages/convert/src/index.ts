// ── Types ───────────────────────────────────────────────
export type {
  RGB, RGBA, HSL, HSLA, HSV,
  LengthUnit, WeightUnit, TemperatureUnit, VolumeUnit,
  SpeedUnit, AreaUnit, TimeUnit, DataUnit, AnyUnit,
  PressureUnit, EnergyUnit, AngleUnit,
  ColorFormat, EncodingFormat, NumberBase,
  CurrencyRates, ConverterFn,
} from './types';

// ── Bridge setup ────────────────────────────────────────
export { setConvertBridge } from './rpc';

// ── Fluent API ──────────────────────────────────────────
export { convert } from './convert';

// ── Registry ────────────────────────────────────────────
export { register, registerBidi, registerUnitGroup } from './registry';
export { canConvert, listCategories, listUnits, getConverter, registrySize } from './registry';

// ── React hooks ─────────────────────────────────────────
export { useConvert, useCurrencyRate, useUnitConvert } from './hooks';

// ── Color (direct access) ───────────────────────────────
export {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb,
  rgbToHsv, hsvToRgb, hexToHsl, hslToHex,
  hexToHsv, hsvToHex, namedToHex, hexToNamed,
} from './color';

// ── Encoding (direct access) ────────────────────────────
export {
  textToBase64, base64ToText,
  textToHex, hexToText,
  textToUrlEncoded, urlEncodedToText,
  textToHtmlEntities, htmlEntitiesToText,
} from './encoding';

// ── Number bases (direct access) ────────────────────────
export {
  decimalToBinary, binaryToDecimal,
  decimalToOctal, octalToDecimal,
  decimalToHexNum, hexNumToDecimal,
  binaryToOctal, octalToBinary,
  binaryToHexNum, hexNumToBinary,
  octalToHexNum, hexNumToOctal,
} from './numbers';

// ── Currency ────────────────────────────────────────────
export { fetchRates, convertCurrency, registerCurrencyPair } from './currency';

// ── Side effect: register all built-in converters ───────
import './units';
import './color';
import './encoding';
import './numbers';
import './currency';
