import { getConverter, canConvert } from './registry';

interface ConversionBuilder<T = any> {
  to(target: string): T;
  canConvertTo(target: string): boolean;
}

/**
 * Start a conversion.
 *
 * @example
 * convert(5, 'miles').to('km')        // 8.04672
 * convert('#ff0000').to('rgb')        // { r: 255, g: 0, b: 0 }
 * convert(100, 'usd').to('eur')       // Promise<number>
 * convert('Hello').to('base64')       // 'SGVsbG8='
 * convert(255, 'decimal').to('binary') // '11111111'
 */
export function convert(value: any, from?: string): ConversionBuilder {
  const fromType = from ?? detectType(value);

  return {
    to(target: string) {
      const fn = getConverter(fromType, target);
      if (!fn) {
        throw new Error(
          `@reactjit/convert: no converter for "${fromType}" -> "${target}". ` +
          `Use register('${fromType}', '${target}', fn) to add one.`
        );
      }
      return fn(value);
    },
    canConvertTo(target: string) {
      return canConvert(fromType, target);
    },
  };
}

function detectType(value: any): string {
  if (typeof value === 'string') {
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return 'hex';
    if (/^rgb\(/i.test(value)) return 'rgb-string';
    if (/^hsl\(/i.test(value)) return 'hsl-string';
    return 'text';
  }
  return 'unknown';
}
