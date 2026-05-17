/**
 * Low-level SVG-string primitives. Each function returns a well-formed
 * SVG fragment that composes via string concatenation. Defaults pick up
 * the modal's Tron palette: light-cyan outlines on dark backdrop, light-
 * grey labels. Callers pass `style` overrides for emphasis (e.g., the
 * hypotenuse highlighted vs. the legs).
 *
 * The module is pure logic — no DOM, no Three.js. SVG strings are
 * eventually injected via `innerHTML` into the modal's `.problem-figure`
 * slot at render time.
 */

export interface SvgStyle {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly fill?: string;
  readonly opacity?: number;
  readonly strokeDasharray?: string;
}

export interface SvgLabelStyle extends SvgStyle {
  readonly fontSize?: number;
  readonly anchor?: 'start' | 'middle' | 'end';
  readonly baseline?: 'auto' | 'middle' | 'hanging';
}

const DEFAULT_STROKE = '#a0e8ff';
const DEFAULT_STROKE_WIDTH = 2;
const DEFAULT_LABEL_FILL = '#e8e8ef';
const DEFAULT_FONT_SIZE = 18;

function styleAttrs(style: SvgStyle | undefined): string {
  const stroke = style?.stroke ?? DEFAULT_STROKE;
  const strokeWidth = style?.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const fill = style?.fill ?? 'none';
  const parts = [
    `stroke="${stroke}"`,
    `stroke-width="${strokeWidth}"`,
    `fill="${fill}"`,
  ];
  if (style?.opacity !== undefined) parts.push(`opacity="${style.opacity}"`);
  if (style?.strokeDasharray) {
    parts.push(`stroke-dasharray="${style.strokeDasharray}"`);
  }
  return parts.join(' ');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Wrap content inside an `<svg>` element with the given viewBox. */
export function svg(viewBox: string, content: string): string {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  style?: SvgStyle,
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${styleAttrs(style)}/>`;
}

export function polygon(
  points: ReadonlyArray<readonly [number, number]>,
  style?: SvgStyle,
): string {
  const pointsAttr = points.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polygon points="${pointsAttr}" ${styleAttrs(style)}/>`;
}

export function polyline(
  points: ReadonlyArray<readonly [number, number]>,
  style?: SvgStyle,
): string {
  const pointsAttr = points.map(([x, y]) => `${x},${y}`).join(' ');
  return `<polyline points="${pointsAttr}" ${styleAttrs(style)}/>`;
}

export function circle(
  cx: number,
  cy: number,
  r: number,
  style?: SvgStyle,
): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${styleAttrs(style)}/>`;
}

export function ellipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  style?: SvgStyle,
): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${styleAttrs(style)}/>`;
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  style?: SvgStyle,
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" ${styleAttrs(style)}/>`;
}

export function label(
  x: number,
  y: number,
  text: string,
  style?: SvgLabelStyle,
): string {
  const fontSize = style?.fontSize ?? DEFAULT_FONT_SIZE;
  const anchor = style?.anchor ?? 'middle';
  const baseline = style?.baseline ?? 'middle';
  const fill = style?.fill ?? DEFAULT_LABEL_FILL;
  const parts = [
    `x="${x}"`,
    `y="${y}"`,
    `font-size="${fontSize}"`,
    `text-anchor="${anchor}"`,
    `dominant-baseline="${baseline}"`,
    `fill="${fill}"`,
    `font-family="ui-monospace, SFMono-Regular, monospace"`,
  ];
  if (style?.stroke) parts.push(`stroke="${style.stroke}"`);
  return `<text ${parts.join(' ')}>${escapeXml(text)}</text>`;
}

/**
 * A small filled circle marker, used for plotted points on coordinate
 * planes and other "vertex" emphasis.
 */
export function dot(cx: number, cy: number, r = 3, color = DEFAULT_STROKE): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`;
}
