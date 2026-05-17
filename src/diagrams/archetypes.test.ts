// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  circleFigure,
  compositeRectangleTriangle,
  coneSilhouette,
  coordinatePlane,
  cubeSilhouette,
  cylinderSilhouette,
  equilateralTriangleFigure,
  pyramidSilhouette,
  rectangleFigure,
  rectangularPrismSilhouette,
  regularPolygonFigure,
  rightTriangle,
  sphereSilhouette,
  squareFigure,
  trapezoid,
  triangleBaseHeight,
  triangleGeneric,
} from './archetypes';

function parsesAsXml(s: string): boolean {
  const parser = new DOMParser();
  const doc = parser.parseFromString(s, 'application/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

function hasViewBox(s: string): boolean {
  return /viewBox="0 0 320 240"/.test(s);
}

describe('rightTriangle()', () => {
  it('produces valid SVG with viewBox', () => {
    const out = rightTriangle({ legA: 3, legB: 4 });
    expect(parsesAsXml(out)).toBe(true);
    expect(hasViewBox(out)).toBe(true);
  });

  it('labels match the input leg values', () => {
    const out = rightTriangle({ legA: 8, legB: 15 });
    expect(out).toContain('>8</text>');
    expect(out).toContain('>15</text>');
  });

  it('honours the labelHyp override (?, 5, etc.)', () => {
    const out = rightTriangle({ legA: 3, legB: 4, labelHyp: '?' });
    expect(out).toContain('>?</text>');
  });

  it('contains a right-angle marker (a rect element)', () => {
    const out = rightTriangle({ legA: 3, legB: 4 });
    expect(out).toContain('<rect ');
  });
});

describe('triangleGeneric()', () => {
  it('produces valid SVG for a 5-5-6 triangle', () => {
    const out = triangleGeneric({ a: 5, b: 5, c: 6 });
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>5</text>');
    expect(out).toContain('>6</text>');
  });

  it('produces valid SVG for a 7-8-9 triangle', () => {
    const out = triangleGeneric({ a: 7, b: 8, c: 9 });
    expect(parsesAsXml(out)).toBe(true);
  });

  it('produces valid SVG for a 13-14-15 triangle', () => {
    const out = triangleGeneric({ a: 13, b: 14, c: 15 });
    expect(parsesAsXml(out)).toBe(true);
  });
});

describe('trapezoid()', () => {
  it('produces valid SVG with all three labels', () => {
    const out = trapezoid({ topSide: 5, bottomSide: 9, height: 6 });
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>5</text>');
    expect(out).toContain('>9</text>');
    expect(out).toContain('>6</text>');
  });

  it('honours showAltitude option', () => {
    const out = trapezoid({ topSide: 5, bottomSide: 7, height: 4, showAltitude: true });
    expect(out).toContain('stroke-dasharray');
  });
});

describe('squareFigure() and rectangleFigure()', () => {
  it('square labels the side value', () => {
    const out = squareFigure(7);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>7</text>');
  });

  it('rectangle labels both dimensions', () => {
    const out = rectangleFigure(5, 8);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>5</text>');
    expect(out).toContain('>8</text>');
  });
});

describe('equilateralTriangleFigure() and triangleBaseHeight()', () => {
  it('equilateral labels the side', () => {
    const out = equilateralTriangleFigure(6);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>6</text>');
  });

  it('triangleBaseHeight labels base and height', () => {
    const out = triangleBaseHeight(8, 5);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>8</text>');
    expect(out).toContain('>5</text>');
  });
});

describe('circleFigure() and regularPolygonFigure()', () => {
  it('circle labels the radius', () => {
    const out = circleFigure(5);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('<circle ');
    expect(out).toContain('>5</text>');
  });

  it('regular polygon emits a polygon with N vertices for N=6', () => {
    const out = regularPolygonFigure(6);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('<polygon ');
    // The polygon points-attr should have 6 comma-separated pairs.
    const m = out.match(/points="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(m![1]!.split(' ').length).toBe(6);
  });

  it('regular polygon honours custom label', () => {
    const out = regularPolygonFigure(8, 'Octagon');
    expect(out).toContain('>Octagon</text>');
  });
});

describe('coordinatePlane()', () => {
  it('plots labelled points', () => {
    const out = coordinatePlane({
      points: [
        { x: 0, y: 0, label: 'A (0, 0)' },
        { x: 3, y: 4, label: 'B (3, 4)' },
      ],
    });
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('A (0, 0)');
    expect(out).toContain('B (3, 4)');
  });

  it('draws a connecting line when drawLineBetweenFirstTwo is set', () => {
    const out = coordinatePlane({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 3 },
      ],
      drawLineBetweenFirstTwo: true,
    });
    // Connector line uses amber stroke color (Tron accent).
    expect(out).toContain('#ff8a30');
  });

  it('renders gridlines and axes', () => {
    const out = coordinatePlane({
      points: [{ x: 0, y: 0 }, { x: 4, y: 4 }],
    });
    // Multiple line elements expected (gridlines + axes).
    const lineCount = (out.match(/<line /g) ?? []).length;
    expect(lineCount).toBeGreaterThan(4);
  });
});

describe('3D-solid silhouettes', () => {
  it('sphereSilhouette parses and labels the radius', () => {
    const out = sphereSilhouette(6);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('r = 6');
  });

  it('cylinderSilhouette parses and labels r + h', () => {
    const out = cylinderSilhouette(3, 8);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('r = 3');
    expect(out).toContain('h = 8');
  });

  it('coneSilhouette parses and labels r + h', () => {
    const out = coneSilhouette(3, 4);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('r = 3');
    expect(out).toContain('h = 4');
  });

  it('pyramidSilhouette parses and labels base + height', () => {
    const out = pyramidSilhouette(6, 8);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>6</text>');
    expect(out).toContain('>8</text>');
  });

  it('rectangularPrismSilhouette parses and labels l, w, h', () => {
    const out = rectangularPrismSilhouette(4, 5, 6);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>4</text>');
    expect(out).toContain('>5</text>');
    expect(out).toContain('>6</text>');
  });

  it('cubeSilhouette labels the side three times (l == w == h)', () => {
    const out = cubeSilhouette(7);
    expect(parsesAsXml(out)).toBe(true);
    // The side label "7" should appear three times (one per labelled edge).
    const matches = out.match(/>7</g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('compositeRectangleTriangle()', () => {
  it('produces valid SVG with three labels', () => {
    const out = compositeRectangleTriangle(6, 4, 3);
    expect(parsesAsXml(out)).toBe(true);
    expect(out).toContain('>6</text>');
    expect(out).toContain('>4</text>');
    expect(out).toContain('>3</text>');
  });

  it('contains both rectangle and triangle elements', () => {
    const out = compositeRectangleTriangle(8, 5, 4);
    expect(out).toContain('<rect ');
    expect(out).toContain('<polygon ');
  });
});
