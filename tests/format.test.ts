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
    // after T: aa, bb, cc ... zz, then aaa (every step x1000, never runs out)
    expect(fmt(1e15)).toBe('1.00aa');
    expect(fmt(2.5e18)).toBe('2.50bb');
    expect(fmt(999e27)).toBe('999ee');
    expect(fmt(1e30)).toBe('1.00ff');
    expect(fmt(1e90)).toBe('1.00zz');
    expect(fmt(1e93)).toBe('1.00aaa');
    expect(fmt(999.9e12)).toBe('1.00aa');
  });
  it('formats time', () => {
    expect(fmtTime(45)).toBe('45s');
    expect(fmtTime(125)).toBe('2m 5s');
    expect(fmtTime(7500)).toBe('2h 5m');
  });
});
