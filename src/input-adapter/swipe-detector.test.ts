import { describe, expect, it } from 'vitest';
import { detectSwipe } from './swipe-detector';

function pt(x: number, y: number, tMs: number): {
  x: number;
  y: number;
  tMs: number;
} {
  return { x, y, tMs };
}

describe('detectSwipe', () => {
  it('recognises a fast horizontal right swipe', () => {
    expect(detectSwipe(pt(100, 500, 0), pt(150, 500, 200))).toBe('right');
  });

  it('recognises a fast horizontal left swipe', () => {
    expect(detectSwipe(pt(150, 500, 0), pt(100, 500, 200))).toBe('left');
  });

  it('returns null when horizontal distance is below threshold (< 30 px)', () => {
    expect(detectSwipe(pt(100, 500, 0), pt(125, 500, 200))).toBeNull();
  });

  it('exactly meets the 30 px threshold (>= 30 px)', () => {
    expect(detectSwipe(pt(100, 500, 0), pt(130, 500, 200))).toBe('right');
  });

  it('returns null when the gesture is too slow (> 500 ms)', () => {
    expect(detectSwipe(pt(100, 500, 0), pt(200, 500, 600))).toBeNull();
  });

  it('returns null when the gesture is dominantly vertical (dx / dy < 2)', () => {
    // 50 px horizontal vs 40 px vertical -> 1.25 ratio -> not horizontal-dominant.
    expect(detectSwipe(pt(100, 500, 0), pt(150, 540, 200))).toBeNull();
  });

  it('still recognises when horizontal dominance is exactly satisfied (dx / dy >= 2)', () => {
    // 50 px horizontal, 25 px vertical -> ratio 2.0 -> horizontal-dominant.
    expect(detectSwipe(pt(100, 500, 0), pt(150, 525, 200))).toBe('right');
  });

  it('returns null when start and end times are equal but distance is zero', () => {
    expect(detectSwipe(pt(100, 500, 0), pt(100, 500, 0))).toBeNull();
  });
});
