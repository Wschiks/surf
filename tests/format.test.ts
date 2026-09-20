import { describe, expect, it } from 'vitest';
import { fmt, fmtTime } from '../src/ui/format';

describe('number format', () => {
  it('shortens big numbers', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(7)).toBe('7');
    expect(fmt(999)).toBe('999');
    expect(fmt(1500)).toBe('1.50K');
    expect(fmt(12500)).toBe('12.5K');
    expect(fmt(2.5e6)).toBe('2.50M');
    expect(fmt(3e12)).toBe('3.00T');
  });
  it('formats time', () => {
    expect(fmtTime(45)).toBe('45s');
    expect(fmtTime(125)).toBe('2m 5s');
    expect(fmtTime(7500)).toBe('2h 5m');
  });
});
