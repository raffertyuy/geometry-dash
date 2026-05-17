// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  svg,
  line,
  polygon,
  polyline,
  circle,
  ellipse,
  rect,
  label,
  dot,
} from './primitives';

function parsesAsXml(s: string): boolean {
  const parser = new DOMParser();
  const doc = parser.parseFromString(s, 'application/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

describe('svg() wrapper', () => {
  it('wraps content with the given viewBox and namespace', () => {
    const out = svg('0 0 320 240', '<line x1="0" y1="0" x2="100" y2="100"/>');
    expect(out).toContain('viewBox="0 0 320 240"');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('<line');
    expect(out).toContain('</svg>');
  });

  it('produces well-formed XML', () => {
    const out = svg('0 0 320 240', line(0, 0, 100, 100));
    expect(parsesAsXml(out)).toBe(true);
  });
});

describe('line()', () => {
  it('emits a <line> element with the given coordinates', () => {
    const out = line(0, 10, 50, 60);
    expect(out).toContain('x1="0"');
    expect(out).toContain('y1="10"');
    expect(out).toContain('x2="50"');
    expect(out).toContain('y2="60"');
  });

  it('applies default style (cyan stroke, width 2)', () => {
    const out = line(0, 0, 1, 1);
    expect(out).toContain('stroke="#a0e8ff"');
    expect(out).toContain('stroke-width="2"');
    expect(out).toContain('fill="none"');
  });

  it('honours stroke + width overrides', () => {
    const out = line(0, 0, 1, 1, { stroke: '#ff5050', strokeWidth: 4 });
    expect(out).toContain('stroke="#ff5050"');
    expect(out).toContain('stroke-width="4"');
  });

  it('honours strokeDasharray for dashed lines', () => {
    const out = line(0, 0, 1, 1, { strokeDasharray: '5,3' });
    expect(out).toContain('stroke-dasharray="5,3"');
  });
});

describe('polygon()', () => {
  it('emits a <polygon> with the given points', () => {
    const out = polygon([
      [0, 0],
      [100, 0],
      [50, 100],
    ]);
    expect(out).toContain('points="0,0 100,0 50,100"');
  });

  it('produces well-formed XML inside an svg wrapper', () => {
    const out = svg('0 0 200 200', polygon([[0, 0], [100, 0], [50, 100]]));
    expect(parsesAsXml(out)).toBe(true);
  });
});

describe('polyline()', () => {
  it('emits a <polyline> with the given points', () => {
    const out = polyline([
      [0, 0],
      [100, 50],
      [200, 0],
    ]);
    expect(out).toContain('<polyline');
    expect(out).toContain('points="0,0 100,50 200,0"');
  });
});

describe('circle() and ellipse()', () => {
  it('circle has cx, cy, r', () => {
    const out = circle(160, 120, 80);
    expect(out).toContain('cx="160"');
    expect(out).toContain('cy="120"');
    expect(out).toContain('r="80"');
  });

  it('ellipse has cx, cy, rx, ry', () => {
    const out = ellipse(160, 120, 80, 30);
    expect(out).toContain('rx="80"');
    expect(out).toContain('ry="30"');
  });
});

describe('rect()', () => {
  it('emits a <rect> with x, y, width, height', () => {
    const out = rect(10, 20, 100, 50);
    expect(out).toContain('<rect');
    expect(out).toContain('x="10"');
    expect(out).toContain('y="20"');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="50"');
  });
});

describe('label()', () => {
  it('emits a <text> element with the given coordinates and content', () => {
    const out = label(50, 60, 'A');
    expect(out).toContain('<text');
    expect(out).toContain('x="50"');
    expect(out).toContain('y="60"');
    expect(out).toContain('>A</text>');
  });

  it('escapes XML special characters in the label text', () => {
    const out = label(0, 0, '<bad> & "good"');
    expect(out).not.toContain('<bad>');
    expect(out).toContain('&lt;bad&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
  });

  it('applies default font-size 18 and middle anchor', () => {
    const out = label(0, 0, 'x');
    expect(out).toContain('font-size="18"');
    expect(out).toContain('text-anchor="middle"');
  });

  it('honours anchor + fontSize overrides', () => {
    const out = label(0, 0, 'x', { anchor: 'start', fontSize: 24 });
    expect(out).toContain('text-anchor="start"');
    expect(out).toContain('font-size="24"');
  });
});

describe('dot()', () => {
  it('emits a filled circle without stroke', () => {
    const out = dot(50, 50, 4, '#ff5050');
    expect(out).toContain('cx="50"');
    expect(out).toContain('cy="50"');
    expect(out).toContain('r="4"');
    expect(out).toContain('fill="#ff5050"');
    expect(out).toContain('stroke="none"');
  });
});

describe('composed svg() output parses as valid XML', () => {
  it('a complex composition of primitives parses cleanly', () => {
    const out = svg(
      '0 0 320 240',
      [
        line(40, 200, 280, 200),
        polygon([
          [40, 200],
          [280, 200],
          [160, 60],
        ]),
        circle(160, 120, 60),
        ellipse(160, 60, 80, 20),
        rect(10, 10, 50, 30),
        label(160, 220, 'base'),
        dot(160, 60, 3),
      ].join(''),
    );
    expect(parsesAsXml(out)).toBe(true);
  });
});
