import { describe, expect, it } from 'vitest';
import { divTrunc, formatFixed, fromInt, makeScale, mulTrunc, parseFixed } from '../../src/fixed';

describe('fixed-point arithmetic', () => {
  it('scales by a power of ten', () => {
    expect(makeScale(4)).toBe(10_000n);
    expect(fromInt(3, 4)).toBe(30_000n);
    expect(fromInt(3n, 2)).toBe(300n);
  });

  it('truncates the Minneapolis surplus fraction to 4 places', () => {
    const fraction = divTrunc(fromInt(34085 - 28338, 4), fromInt(34085, 4), 4);
    expect(formatFixed(fraction, 4)).toBe('0.1686');
  });

  it('truncates products', () => {
    expect(formatFixed(mulTrunc(parseFixed('0.1686', 4), fromInt(28338, 4), 4), 4)).toBe('4777.7868');
    expect(formatFixed(mulTrunc(parseFixed('0.1111', 4), parseFixed('0.2258', 4), 4), 4)).toBe('0.0250');
  });

  it('prints whole values without a decimal point', () => {
    expect(formatFixed(fromInt(7, 4), 4)).toBe('7');
    expect(formatFixed(0n, 4)).toBe('0');
  });

  it('prints fractional values at full scale like RCTab', () => {
    expect(formatFixed(parseFixed('7.2501', 4), 4)).toBe('7.2501');
    expect(formatFixed(parseFixed('2.333', 4), 4)).toBe('2.3330');
    expect(formatFixed(parseFixed('0.0003', 4), 4)).toBe('0.0003');
  });

  it('can force full scale for whole values that carry transferred fractions', () => {
    expect(formatFixed(fromInt(8, 4), 4, true)).toBe('8.0000');
    expect(formatFixed(0n, 4, true)).toBe('0.0000');
  });

  it('parses integers and decimals', () => {
    expect(parseFixed('12', 4)).toBe(120_000n);
    expect(parseFixed('12.5', 4)).toBe(125_000n);
    expect(parseFixed('0.00019', 4)).toBe(1n);
    expect(() => parseFixed('1e3', 4)).toThrow();
  });

  it('refuses to divide by zero', () => {
    expect(() => divTrunc(fromInt(1, 4), 0n, 4)).toThrow(RangeError);
  });
});
