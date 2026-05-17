import {
  circle,
  dot,
  ellipse,
  label,
  line,
  polygon,
  rect,
  svg,
  type SvgStyle,
} from './primitives';

const VB_W = 320;
const VB_H = 240;
const PAD = 40;

/**
 * Right triangle. legA is the horizontal leg, legB the vertical leg. The
 * right angle sits at the bottom-left. Auto-scales to fit the viewBox
 * while preserving aspect ratio. Labels next to each leg + the
 * hypotenuse (default "?" since it's typically the unknown).
 */
export interface RightTriangleParams {
  readonly legA: number;
  readonly legB: number;
  readonly labelA?: string;
  readonly labelB?: string;
  readonly labelHyp?: string;
}
export function rightTriangle(p: RightTriangleParams): string {
  const maxSpace = Math.min(VB_W - 2 * PAD, VB_H - 2 * PAD);
  const scale = maxSpace / Math.max(p.legA, p.legB);
  const sA = p.legA * scale;
  const sB = p.legB * scale;
  const x0 = PAD;
  const y0 = VB_H - PAD;
  const xA = x0 + sA;
  const yB = y0 - sB;
  const SQ = 12;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Triangle outline.
      polygon([
        [x0, y0],
        [xA, y0],
        [x0, yB],
      ]),
      // Right-angle marker.
      rect(x0, y0 - SQ, SQ, SQ),
      // Labels.
      label((x0 + xA) / 2, y0 + 22, p.labelA ?? String(p.legA)),
      label(x0 - 22, (y0 + yB) / 2, p.labelB ?? String(p.legB), { anchor: 'end' }),
      label(
        (xA + x0) / 2 + 22,
        (y0 + yB) / 2 - 8,
        p.labelHyp ?? '?',
        { anchor: 'start' },
      ),
    ].join(''),
  );
}

/**
 * Generic triangle from three side lengths. Uses the law of cosines to
 * compute interior angles, then places vertices. Auto-scales. Labels on
 * each side.
 */
export interface TriangleGenericParams {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly labelA?: string;
  readonly labelB?: string;
  readonly labelC?: string;
}
export function triangleGeneric(p: TriangleGenericParams): string {
  // Place side c along the bottom from (x0, y0) to (x0 + c, y0).
  // Vertex A at (x0, y0), B at (x0 + c, y0), C above.
  // Use law of cosines to find angle at A: cos A = (b² + c² - a²) / 2bc.
  const cosA = (p.b * p.b + p.c * p.c - p.a * p.a) / (2 * p.b * p.c);
  const angA = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const Cx = p.b * Math.cos(angA);
  const Cy = p.b * Math.sin(angA);
  // Compute bounding box of the triangle in raw units.
  const minX = Math.min(0, Cx);
  const maxX = Math.max(p.c, Cx);
  const maxY = Math.max(0, Cy);
  const rawW = maxX - minX;
  const rawH = maxY;
  const maxSpace = Math.min(VB_W - 2 * PAD, VB_H - 2 * PAD);
  const scale = maxSpace / Math.max(rawW, rawH);
  const offX = PAD - minX * scale;
  const offY = VB_H - PAD;
  const Ax = offX;
  const Ay = offY;
  const Bx = offX + p.c * scale;
  const By = offY;
  const Cx2 = offX + Cx * scale;
  const Cy2 = offY - Cy * scale;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      polygon([
        [Ax, Ay],
        [Bx, By],
        [Cx2, Cy2],
      ]),
      // Side labels positioned at each side's midpoint.
      // c = AB (bottom)
      label((Ax + Bx) / 2, By + 22, p.labelC ?? String(p.c)),
      // b = AC (left)
      label((Ax + Cx2) / 2 - 18, (Ay + Cy2) / 2, p.labelB ?? String(p.b), {
        anchor: 'end',
      }),
      // a = BC (right)
      label((Bx + Cx2) / 2 + 18, (By + Cy2) / 2, p.labelA ?? String(p.a), {
        anchor: 'start',
      }),
    ].join(''),
  );
}

/**
 * Isoceles trapezoid. `topSide` is the shorter parallel side at the top;
 * `bottomSide` is the longer one at the bottom. Optional dashed altitude
 * line through the centre.
 */
export interface TrapezoidParams {
  readonly topSide: number;
  readonly bottomSide: number;
  readonly height: number;
  readonly labels?: {
    readonly top?: string;
    readonly bottom?: string;
    readonly height?: string;
  };
  readonly showAltitude?: boolean;
}
export function trapezoid(p: TrapezoidParams): string {
  const widthRange = Math.max(p.bottomSide, p.height * 2);
  const scale = Math.min(
    (VB_W - 2 * PAD) / widthRange,
    (VB_H - 2 * PAD) / p.height,
  );
  const bw = p.bottomSide * scale;
  const tw = p.topSide * scale;
  const h = p.height * scale;
  const cx = VB_W / 2;
  const yB = VB_H - PAD;
  const yT = yB - h;
  const xBL = cx - bw / 2;
  const xBR = cx + bw / 2;
  const xTL = cx - tw / 2;
  const xTR = cx + tw / 2;
  const altitudeLine = p.showAltitude
    ? line(cx, yB, cx, yT, { strokeDasharray: '4,4', stroke: '#a0e8ff', strokeWidth: 1.5 })
    : '';
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      polygon([
        [xBL, yB],
        [xBR, yB],
        [xTR, yT],
        [xTL, yT],
      ]),
      altitudeLine,
      label(cx, yT - 14, p.labels?.top ?? String(p.topSide)),
      label(cx, yB + 22, p.labels?.bottom ?? String(p.bottomSide)),
      label(cx + 14, (yB + yT) / 2, p.labels?.height ?? String(p.height), {
        anchor: 'start',
      }),
    ].join(''),
  );
}

/**
 * Square with side labels. The displayed square is always the same
 * visual size; the side label shows the numeric value.
 */
export function squareFigure(side: number, labelText?: string): string {
  const SIZE = 160;
  const x0 = (VB_W - SIZE) / 2;
  const y0 = (VB_H - SIZE) / 2;
  const lbl = labelText ?? String(side);
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      rect(x0, y0, SIZE, SIZE),
      label(x0 + SIZE / 2, y0 + SIZE + 22, lbl),
    ].join(''),
  );
}

/**
 * Rectangle with width and height labels. Auto-scales to maintain the
 * actual aspect ratio.
 */
export function rectangleFigure(
  w: number,
  h: number,
  labelW?: string,
  labelH?: string,
): string {
  const maxSpace = Math.min(VB_W - 2 * PAD, VB_H - 2 * PAD);
  const scale = maxSpace / Math.max(w, h);
  const sw = w * scale;
  const sh = h * scale;
  const x0 = (VB_W - sw) / 2;
  const y0 = (VB_H - sh) / 2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      rect(x0, y0, sw, sh),
      label(x0 + sw / 2, y0 + sh + 22, labelW ?? String(w)),
      label(x0 - 18, y0 + sh / 2, labelH ?? String(h), { anchor: 'end' }),
    ].join(''),
  );
}

/**
 * Equilateral triangle with a single side label. Always rendered at a
 * fixed visual size; the label shows the side value.
 */
export function equilateralTriangleFigure(side: number): string {
  const SIDE_PX = 160;
  const h = (SIDE_PX * Math.sqrt(3)) / 2;
  const cx = VB_W / 2;
  const yB = (VB_H + h) / 2;
  const yT = yB - h;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      polygon([
        [cx - SIDE_PX / 2, yB],
        [cx + SIDE_PX / 2, yB],
        [cx, yT],
      ]),
      label(cx, yB + 22, String(side)),
    ].join(''),
  );
}

/**
 * Triangle with explicit base and altitude (for "find area given base
 * and height" problems).
 */
export function triangleBaseHeight(
  base: number,
  height: number,
  labelBase?: string,
  labelHeight?: string,
): string {
  const maxSpace = Math.min(VB_W - 2 * PAD, VB_H - 2 * PAD);
  const scale = maxSpace / Math.max(base, height);
  const sb = base * scale;
  const sh = height * scale;
  const cx = VB_W / 2;
  const yB = VB_H - PAD;
  const yT = yB - sh;
  const xL = cx - sb / 2;
  const xR = cx + sb / 2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      polygon([
        [xL, yB],
        [xR, yB],
        [cx, yT],
      ]),
      // Dashed altitude.
      line(cx, yB, cx, yT, { strokeDasharray: '4,4', strokeWidth: 1.5 }),
      label(cx, yB + 22, labelBase ?? String(base)),
      label(cx + 14, (yB + yT) / 2, labelHeight ?? String(height), {
        anchor: 'start',
      }),
    ].join(''),
  );
}

/**
 * Circle with a labelled radius arrow from centre to the right edge.
 */
export function circleFigure(radius: number, labelText?: string): string {
  const R = 80;
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      circle(cx, cy, R),
      // Radius line.
      line(cx, cy, cx + R, cy, { strokeDasharray: '4,3' }),
      // Centre dot.
      dot(cx, cy, 3),
      label(cx + R / 2, cy - 12, labelText ?? String(radius), { anchor: 'middle' }),
    ].join(''),
  );
}

/**
 * Regular N-gon centred in the viewBox. Optional centre label showing
 * the side count.
 */
export function regularPolygonFigure(
  sides: number,
  labelText?: string,
): string {
  const R = 80;
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const points: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    // Rotate so a flat side is at the bottom (more natural look for
    // even-side polygons). Start angle = -π/2 - π/sides.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    points.push([cx + R * Math.cos(angle), cy + R * Math.sin(angle)]);
  }
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      polygon(points),
      label(cx, cy, labelText ?? `n = ${sides}`),
    ].join(''),
  );
}

/**
 * Coordinate plane with axes, gridlines, and labelled points. Optional
 * line connecting the first two points (for slope / distance problems).
 */
export interface CoordinatePlaneParams {
  readonly points: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly label?: string;
  }>;
  readonly drawLineBetweenFirstTwo?: boolean;
  /** Override the auto-computed range. */
  readonly xRange?: readonly [number, number];
  readonly yRange?: readonly [number, number];
}
export function coordinatePlane(p: CoordinatePlaneParams): string {
  // Auto-compute the range from the points, padded by 2 in each direction.
  const xs = p.points.map((q) => q.x);
  const ys = p.points.map((q) => q.y);
  const xMin = p.xRange?.[0] ?? Math.min(0, ...xs) - 2;
  const xMax = p.xRange?.[1] ?? Math.max(0, ...xs) + 2;
  const yMin = p.yRange?.[0] ?? Math.min(0, ...ys) - 2;
  const yMax = p.yRange?.[1] ?? Math.max(0, ...ys) + 2;
  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const innerW = VB_W - 2 * PAD;
  const innerH = VB_H - 2 * PAD;
  const sx = (x: number): number => PAD + ((x - xMin) / xSpan) * innerW;
  const sy = (y: number): number => VB_H - PAD - ((y - yMin) / ySpan) * innerH;
  // Gridlines at integer values.
  const gridStyle: SvgStyle = {
    stroke: '#18c8ff',
    strokeWidth: 0.5,
    opacity: 0.3,
  };
  const gridLines: string[] = [];
  for (let gx = Math.ceil(xMin); gx <= Math.floor(xMax); gx++) {
    gridLines.push(line(sx(gx), sy(yMin), sx(gx), sy(yMax), gridStyle));
  }
  for (let gy = Math.ceil(yMin); gy <= Math.floor(yMax); gy++) {
    gridLines.push(line(sx(xMin), sy(gy), sx(xMax), sy(gy), gridStyle));
  }
  // Axes (where they fall inside the visible region).
  const axes: string[] = [];
  if (yMin <= 0 && yMax >= 0) {
    axes.push(line(sx(xMin), sy(0), sx(xMax), sy(0), { strokeWidth: 1.5 }));
  }
  if (xMin <= 0 && xMax >= 0) {
    axes.push(line(sx(0), sy(yMin), sx(0), sy(yMax), { strokeWidth: 1.5 }));
  }
  // Plotted points + labels.
  const dots: string[] = [];
  const labels: string[] = [];
  for (const q of p.points) {
    dots.push(dot(sx(q.x), sy(q.y), 4, '#ff8a30')); // amber, matches Tron accent
    labels.push(
      label(sx(q.x) + 8, sy(q.y) - 8, q.label ?? `(${q.x},${q.y})`, {
        anchor: 'start',
        fontSize: 14,
      }),
    );
  }
  // Connecting line between first two points (for slope / distance).
  const connector: string[] = [];
  if (p.drawLineBetweenFirstTwo && p.points.length >= 2) {
    const a = p.points[0]!;
    const b = p.points[1]!;
    connector.push(
      line(sx(a.x), sy(a.y), sx(b.x), sy(b.y), {
        stroke: '#ff8a30',
        strokeWidth: 2,
      }),
    );
  }
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [...gridLines, ...axes, ...connector, ...dots, ...labels].join(''),
  );
}

/**
 * Sphere silhouette: a circle with a subtle inner ellipse to suggest
 * the equator/3D form. Radius label.
 */
export function sphereSilhouette(radius: number, labelText?: string): string {
  const R = 80;
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      circle(cx, cy, R),
      // Inner ellipse suggesting the equator (3D depth).
      ellipse(cx, cy, R, R * 0.25, { stroke: '#a0e8ff', strokeWidth: 1, opacity: 0.55 }),
      // Radius arrow.
      line(cx, cy, cx + R, cy, { strokeDasharray: '4,3', strokeWidth: 1.5 }),
      dot(cx, cy, 3),
      label(cx + R / 2, cy - 12, labelText ?? `r = ${radius}`),
    ].join(''),
  );
}

/**
 * Cylinder silhouette: top + bottom ellipses + connecting vertical sides.
 * Back arc dashed for 3D suggestion. Labels for radius (top) and height (side).
 */
export function cylinderSilhouette(
  r: number,
  h: number,
  labelR?: string,
  labelH?: string,
): string {
  const maxR = 60;
  const maxH = 150;
  const scale = Math.min(maxR / r, maxH / h);
  const rR = r * scale;
  const hH = h * scale;
  const cx = VB_W / 2;
  const cyTop = (VB_H - hH) / 2;
  const cyBot = cyTop + hH;
  const ry = rR * 0.3; // ellipse vertical-radius for 3D illusion
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Body sides.
      line(cx - rR, cyTop, cx - rR, cyBot),
      line(cx + rR, cyTop, cx + rR, cyBot),
      // Bottom ellipse (back arc dashed, front solid).
      ellipse(cx, cyBot, rR, ry, { strokeDasharray: '3,3', strokeWidth: 1 }),
      // Top ellipse - full visible.
      ellipse(cx, cyTop, rR, ry),
      // Radius marker on top ellipse.
      line(cx, cyTop, cx + rR, cyTop, { strokeDasharray: '3,2', strokeWidth: 1.2 }),
      label(cx + rR / 2, cyTop - 8, labelR ?? `r = ${r}`),
      // Height marker on the right side.
      label(cx + rR + 16, (cyTop + cyBot) / 2, labelH ?? `h = ${h}`, { anchor: 'start' }),
    ].join(''),
  );
}

/**
 * Cone silhouette: triangle body + ellipse base. Labels for radius
 * (across the base) and height (dashed vertical).
 */
export function coneSilhouette(
  r: number,
  h: number,
  labelR?: string,
  labelH?: string,
): string {
  const maxR = 60;
  const maxH = 150;
  const scale = Math.min(maxR / r, maxH / h);
  const rR = r * scale;
  const hH = h * scale;
  const cx = VB_W / 2;
  const apexY = (VB_H - hH) / 2;
  const baseY = apexY + hH;
  const ry = rR * 0.3;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Body sides.
      line(cx, apexY, cx - rR, baseY),
      line(cx, apexY, cx + rR, baseY),
      // Base ellipse (back dashed for 3D).
      ellipse(cx, baseY, rR, ry, { strokeDasharray: '3,3' }),
      // Height marker (dashed vertical).
      line(cx, apexY, cx, baseY, { strokeDasharray: '3,3', strokeWidth: 1.2 }),
      // Radius marker on base.
      line(cx, baseY, cx + rR, baseY, { strokeDasharray: '3,2', strokeWidth: 1.2 }),
      label(cx + rR / 2, baseY + 18, labelR ?? `r = ${r}`),
      label(cx + 14, (apexY + baseY) / 2, labelH ?? `h = ${h}`, { anchor: 'start' }),
    ].join(''),
  );
}

/**
 * Square-based pyramid silhouette in oblique projection.
 */
export function pyramidSilhouette(
  baseEdge: number,
  height: number,
  labelBase?: string,
  labelH?: string,
): string {
  const maxB = 120;
  const maxH = 140;
  const scale = Math.min(maxB / baseEdge, maxH / height);
  const sB = baseEdge * scale;
  const sH = height * scale;
  const cx = VB_W / 2;
  const baseY = (VB_H + sH) / 2 + 10;
  const apexY = baseY - sH;
  // Oblique base: a parallelogram suggesting perspective.
  const skew = sB * 0.4;
  const x_BL = cx - sB / 2;
  const x_BR = cx + sB / 2;
  const x_BBL = x_BL + skew * 0.5;
  const x_BBR = x_BR + skew * 0.5;
  const y_BB = baseY - skew * 0.2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Apex to four base corners (only two visible solid).
      line(cx, apexY, x_BL, baseY),
      line(cx, apexY, x_BR, baseY),
      line(cx, apexY, x_BBR, y_BB),
      line(cx, apexY, x_BBL, y_BB, { strokeDasharray: '3,3' }),
      // Base edges.
      line(x_BL, baseY, x_BR, baseY), // front edge
      line(x_BR, baseY, x_BBR, y_BB), // right edge
      line(x_BBR, y_BB, x_BBL, y_BB, { strokeDasharray: '3,3' }), // back edge (hidden)
      line(x_BBL, y_BB, x_BL, baseY, { strokeDasharray: '3,3' }), // left edge (hidden)
      // Labels.
      label(cx, baseY + 22, labelBase ?? String(baseEdge)),
      label(cx + 14, (apexY + baseY) / 2, labelH ?? String(height), {
        anchor: 'start',
      }),
    ].join(''),
  );
}

/**
 * Rectangular prism in oblique projection. Labels for L, W, H on three
 * perpendicular edges.
 */
export function rectangularPrismSilhouette(
  l: number,
  w: number,
  h: number,
  labels?: { l?: string; w?: string; h?: string },
): string {
  const maxL = 130;
  const maxH = 100;
  const maxW = 70;
  const scale = Math.min(maxL / l, maxH / h, maxW / w);
  const sl = l * scale;
  const sh = h * scale;
  const sw = w * scale;
  // Front face top-left corner.
  const x0 = (VB_W - sl - sw * 0.7) / 2;
  const y0 = (VB_H - sh - sw * 0.5) / 2;
  const dx = sw * 0.7; // depth-x offset
  const dy = sw * 0.5; // depth-y offset
  // Front face corners.
  const F_TL: [number, number] = [x0, y0];
  const F_TR: [number, number] = [x0 + sl, y0];
  const F_BL: [number, number] = [x0, y0 + sh];
  const F_BR: [number, number] = [x0 + sl, y0 + sh];
  // Back face corners (offset by dx, dy).
  const B_TL: [number, number] = [F_TL[0] + dx, F_TL[1] - dy];
  const B_TR: [number, number] = [F_TR[0] + dx, F_TR[1] - dy];
  const B_BR: [number, number] = [F_BR[0] + dx, F_BR[1] - dy];
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Front face.
      polygon([F_TL, F_TR, F_BR, F_BL]),
      // Top face edges.
      line(F_TL[0], F_TL[1], B_TL[0], B_TL[1]),
      line(F_TR[0], F_TR[1], B_TR[0], B_TR[1]),
      line(B_TL[0], B_TL[1], B_TR[0], B_TR[1]),
      // Right face edges.
      line(F_BR[0], F_BR[1], B_BR[0], B_BR[1]),
      line(B_TR[0], B_TR[1], B_BR[0], B_BR[1]),
      // Labels.
      label((F_BL[0] + F_BR[0]) / 2, F_BR[1] + 22, labels?.l ?? String(l)),
      label(F_BL[0] - 16, (F_TL[1] + F_BL[1]) / 2, labels?.h ?? String(h), {
        anchor: 'end',
      }),
      label((F_BR[0] + B_BR[0]) / 2 + 18, (F_BR[1] + B_BR[1]) / 2 + 6, labels?.w ?? String(w), {
        anchor: 'start',
      }),
    ].join(''),
  );
}

/**
 * Cube silhouette (special case of rectangular prism with equal sides).
 */
export function cubeSilhouette(side: number, labelText?: string): string {
  const lbl = labelText ?? String(side);
  return rectangularPrismSilhouette(side, side, side, { l: lbl, w: lbl, h: lbl });
}

/**
 * "House" composite: rectangle (w x h) with a triangle on top (same base,
 * triangle height t). Used by the composite area template.
 */
export function compositeRectangleTriangle(
  w: number,
  h: number,
  t: number,
  labels?: { w?: string; h?: string; t?: string },
): string {
  const maxW = VB_W - 2 * PAD;
  const maxH = VB_H - 2 * PAD;
  const scale = Math.min(maxW / w, maxH / (h + t));
  const sw = w * scale;
  const sh = h * scale;
  const st = t * scale;
  const cx = VB_W / 2;
  const yB = (VB_H + sh + st) / 2;
  const yMid = yB - sh;
  const yT = yMid - st;
  const xL = cx - sw / 2;
  const xR = cx + sw / 2;
  return svg(
    `0 0 ${VB_W} ${VB_H}`,
    [
      // Rectangle (w x h) sitting at the bottom.
      rect(xL, yMid, sw, sh),
      // Triangle on top.
      polygon([
        [xL, yMid],
        [xR, yMid],
        [cx, yT],
      ]),
      // Labels.
      label(cx, yB + 22, labels?.w ?? String(w)),
      label(xL - 16, (yB + yMid) / 2, labels?.h ?? String(h), { anchor: 'end' }),
      label(cx + 14, (yMid + yT) / 2, labels?.t ?? String(t), { anchor: 'start' }),
    ].join(''),
  );
}
