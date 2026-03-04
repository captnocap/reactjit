import { register } from './registry';

export function decimalToBinary(n: number): string { return Math.floor(n).toString(2); }
export function binaryToDecimal(s: string): number { return parseInt(s, 2); }
export function decimalToOctal(n: number): string { return Math.floor(n).toString(8); }
export function octalToDecimal(s: string): number { return parseInt(s, 8); }
export function decimalToHexNum(n: number): string { return Math.floor(n).toString(16); }
export function hexNumToDecimal(s: string): number { return parseInt(s, 16); }

// Cross conversions (binary ↔ octal, binary ↔ hex, octal ↔ hex)
export function binaryToOctal(s: string): string { return parseInt(s, 2).toString(8); }
export function octalToBinary(s: string): string { return parseInt(s, 8).toString(2); }
export function binaryToHexNum(s: string): string { return parseInt(s, 2).toString(16); }
export function hexNumToBinary(s: string): string { return parseInt(s, 16).toString(2); }
export function octalToHexNum(s: string): string { return parseInt(s, 8).toString(16); }
export function hexNumToOctal(s: string): string { return parseInt(s, 16).toString(8); }

// ── Registry registration ───────────────────────────────

register('decimal', 'binary', decimalToBinary, 'number-base');
register('binary', 'decimal', binaryToDecimal, 'number-base');
register('decimal', 'octal', decimalToOctal, 'number-base');
register('octal', 'decimal', octalToDecimal, 'number-base');
register('decimal', 'hex-num', decimalToHexNum, 'number-base');
register('hex-num', 'decimal', hexNumToDecimal, 'number-base');
register('binary', 'octal', binaryToOctal, 'number-base');
register('octal', 'binary', octalToBinary, 'number-base');
register('binary', 'hex-num', binaryToHexNum, 'number-base');
register('hex-num', 'binary', hexNumToBinary, 'number-base');
register('octal', 'hex-num', octalToHexNum, 'number-base');
register('hex-num', 'octal', hexNumToOctal, 'number-base');
