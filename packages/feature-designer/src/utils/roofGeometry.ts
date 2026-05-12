/**
 * roofGeometry.ts — Computes 2D roof plan hatching lines (ridges, hips, valleys)
 * for complex multi-shell roof systems.
 *
 * Given a list of Solid Shell TrussConfig entries (and their RoofGroups),
 * produces the SVG-ready line segments for architectural roof plan rendering.
 */

// ────────────────────────── Types ──────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

export interface Line2D {
  p1: Point2D;
  p2: Point2D;
}

export interface RoofShellBounds {
  id: string;
  /** Centre x in 2D plan (inches) */
  cx: number;
  /** Centre y in 2D plan (inches) */
  cy: number;
  /** Full width along the "length" axis (in plan) */
  w: number;
  /** Full height along the "span" axis (in plan) */
  h: number;
  /** True if ridge runs horizontally (rotation === 0) */
  isHoriz: boolean;
  pitch: number;
  overhangIn: number;
  ridgeRatio: number; // 0..1 — position of ridge across the span
  roofStyle: 'gable' | 'hip' | 'shed' | 'flat';
  edgeOverrides?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
}

export interface RoofPlanLine {
  type: 'ridge' | 'hip' | 'valley' | 'eave' | 'slope-arrow';
  p1: Point2D;
  p2: Point2D;
  shellId: string;
  /** For slope arrows, a rotation angle in degrees */
  angle?: number;
}

export interface RoofPlanAnnotation {
  type: 'pitch' | 'height' | 'label';
  pos: Point2D;
  text: string;
  angle?: number;
  shellId: string;
}

export interface RoofPlanResult {
  lines: RoofPlanLine[];
  annotations: RoofPlanAnnotation[];
}

// ────────────────────────── Helpers ─────────────────────────────────────

function lerp(a: Point2D, b: Point2D, t: number): Point2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return lerp(a, b, 0.5);
}

/**
 * Convert a TrussConfig-style shell into the simplified RoofShellBounds
 * needed for plan computation.
 */
export function shellToBounds(run: {
  id: string;
  x: number;
  y: number;
  rotation: number;
  spanFt: number;
  lengthFt: number;
  pitch: number;
  overhangIn: number;
  ridgeRatio?: number;
  roofStyle?: string;
  edgeOverrides?: {
    north?: string;
    south?: string;
    east?: string;
    west?: string;
  };
  type: string;
}): RoofShellBounds | null {
  if (run.type !== 'Solid Shell') return null;
  const isHoriz = run.rotation === 0;
  const w = isHoriz ? run.lengthFt * 12 : run.spanFt * 12;
  const h = isHoriz ? run.spanFt * 12 : run.lengthFt * 12;
  return {
    id: run.id,
    cx: run.x,
    cy: run.y,
    w,
    h,
    isHoriz,
    pitch: run.pitch,
    overhangIn: run.overhangIn || 12,
    ridgeRatio: run.ridgeRatio !== undefined ? run.ridgeRatio / 100 : 0.5,
    roofStyle: (run.roofStyle as RoofShellBounds['roofStyle']) || 'gable',
    edgeOverrides: run.edgeOverrides,
  };
}

// ────────────────────────── Per-Shell Hatching ──────────────────────────

/**
 * Compute the architectural hatch lines for a single roof shell.
 * Returns ridge, hip diagonals, slope arrows, pitch annotations, etc.
 */
function computeShellHatching(shell: RoofShellBounds): RoofPlanResult {
  const lines: RoofPlanLine[] = [];
  const annotations: RoofPlanAnnotation[] = [];
  const { id, cx, cy, w, h, isHoriz, pitch, ridgeRatio, roofStyle, overhangIn } = shell;

  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;

  // Corners
  const nw: Point2D = { x: left, y: top };
  const ne: Point2D = { x: right, y: top };
  const sw: Point2D = { x: left, y: bottom };
  const se: Point2D = { x: right, y: bottom };

  // Edge overrides
  const edgeN = shell.edgeOverrides?.north || 'auto';
  const edgeS = shell.edgeOverrides?.south || 'auto';
  const edgeE = shell.edgeOverrides?.east || 'auto';
  const edgeW = shell.edgeOverrides?.west || 'auto';

  // Compute effective edge types based on roofStyle + overrides
  const resolveEdge = (edge: string, defaultType: string): string => {
    return edge === 'auto' ? defaultType : edge;
  };

  if (roofStyle === 'gable') {
    // Ridge runs along the ridge direction
    if (isHoriz) {
      // Ridge runs horizontally (left to right), span is top-to-bottom
      const ridgeY = top + h * ridgeRatio;
      const ridgeP1: Point2D = { x: left, y: ridgeY };
      const ridgeP2: Point2D = { x: right, y: ridgeY };

      // Determine if ends are hip or gable
      const leftEnd = resolveEdge(edgeW, 'gable');
      const rightEnd = resolveEdge(edgeE, 'gable');

      if (leftEnd === 'hip') {
        // Hip: ridge starts inward, hip lines from corners to ridge start
        const inset = Math.min(h * ridgeRatio, h * (1 - ridgeRatio), w / 2);
        const ridgeStart: Point2D = { x: left + inset, y: ridgeY };
        ridgeP1.x = ridgeStart.x;
        // Hip lines from corners to ridge start
        lines.push({ type: 'hip', p1: nw, p2: ridgeStart, shellId: id });
        lines.push({ type: 'hip', p1: sw, p2: ridgeStart, shellId: id });
      }
      if (rightEnd === 'hip') {
        const inset = Math.min(h * ridgeRatio, h * (1 - ridgeRatio), w / 2);
        const ridgeEnd: Point2D = { x: right - inset, y: ridgeY };
        ridgeP2.x = ridgeEnd.x;
        lines.push({ type: 'hip', p1: ne, p2: ridgeEnd, shellId: id });
        lines.push({ type: 'hip', p1: se, p2: ridgeEnd, shellId: id });
      }

      lines.push({ type: 'ridge', p1: ridgeP1, p2: ridgeP2, shellId: id });

      // Pitch annotations on each slope
      annotations.push({
        type: 'pitch',
        pos: { x: cx, y: top + (ridgeY - top) / 2 },
        text: `${pitch}/12`,
        shellId: id,
      });
      annotations.push({
        type: 'pitch',
        pos: { x: cx, y: ridgeY + (bottom - ridgeY) / 2 },
        text: `${pitch}/12`,
        shellId: id,
      });
    } else {
      // Ridge runs vertically (top to bottom), span is left-to-right
      const ridgeX = left + w * ridgeRatio;
      const ridgeP1: Point2D = { x: ridgeX, y: top };
      const ridgeP2: Point2D = { x: ridgeX, y: bottom };

      const topEnd = resolveEdge(edgeN, 'gable');
      const bottomEnd = resolveEdge(edgeS, 'gable');

      if (topEnd === 'hip') {
        const inset = Math.min(w * ridgeRatio, w * (1 - ridgeRatio), h / 2);
        const ridgeStart: Point2D = { x: ridgeX, y: top + inset };
        ridgeP1.y = ridgeStart.y;
        lines.push({ type: 'hip', p1: nw, p2: ridgeStart, shellId: id });
        lines.push({ type: 'hip', p1: ne, p2: ridgeStart, shellId: id });
      }
      if (bottomEnd === 'hip') {
        const inset = Math.min(w * ridgeRatio, w * (1 - ridgeRatio), h / 2);
        const ridgeEnd: Point2D = { x: ridgeX, y: bottom - inset };
        ridgeP2.y = ridgeEnd.y;
        lines.push({ type: 'hip', p1: sw, p2: ridgeEnd, shellId: id });
        lines.push({ type: 'hip', p1: se, p2: ridgeEnd, shellId: id });
      }

      lines.push({ type: 'ridge', p1: ridgeP1, p2: ridgeP2, shellId: id });

      annotations.push({
        type: 'pitch',
        pos: { x: left + (ridgeX - left) / 2, y: cy },
        text: `${pitch}/12`,
        angle: -90,
        shellId: id,
      });
      annotations.push({
        type: 'pitch',
        pos: { x: ridgeX + (right - ridgeX) / 2, y: cy },
        text: `${pitch}/12`,
        angle: -90,
        shellId: id,
      });
    }
  } else if (roofStyle === 'hip') {
    // Full hip: all four edges have hip lines, ridge is shortened
    if (isHoriz) {
      const ridgeY = top + h * ridgeRatio;
      const inset = Math.min(h * ridgeRatio, h * (1 - ridgeRatio), w / 2);
      const ridgeP1: Point2D = { x: left + inset, y: ridgeY };
      const ridgeP2: Point2D = { x: right - inset, y: ridgeY };

      lines.push({ type: 'ridge', p1: ridgeP1, p2: ridgeP2, shellId: id });
      // Hip lines from all four corners
      lines.push({ type: 'hip', p1: nw, p2: ridgeP1, shellId: id });
      lines.push({ type: 'hip', p1: sw, p2: ridgeP1, shellId: id });
      lines.push({ type: 'hip', p1: ne, p2: ridgeP2, shellId: id });
      lines.push({ type: 'hip', p1: se, p2: ridgeP2, shellId: id });

      annotations.push({
        type: 'pitch', pos: { x: cx, y: top + (ridgeY - top) / 2 },
        text: `${pitch}/12`, shellId: id,
      });
      annotations.push({
        type: 'pitch', pos: { x: cx, y: ridgeY + (bottom - ridgeY) / 2 },
        text: `${pitch}/12`, shellId: id,
      });
    } else {
      const ridgeX = left + w * ridgeRatio;
      const inset = Math.min(w * ridgeRatio, w * (1 - ridgeRatio), h / 2);
      const ridgeP1: Point2D = { x: ridgeX, y: top + inset };
      const ridgeP2: Point2D = { x: ridgeX, y: bottom - inset };

      lines.push({ type: 'ridge', p1: ridgeP1, p2: ridgeP2, shellId: id });
      lines.push({ type: 'hip', p1: nw, p2: ridgeP1, shellId: id });
      lines.push({ type: 'hip', p1: ne, p2: ridgeP1, shellId: id });
      lines.push({ type: 'hip', p1: sw, p2: ridgeP2, shellId: id });
      lines.push({ type: 'hip', p1: se, p2: ridgeP2, shellId: id });

      annotations.push({
        type: 'pitch', pos: { x: left + (ridgeX - left) / 2, y: cy },
        text: `${pitch}/12`, angle: -90, shellId: id,
      });
      annotations.push({
        type: 'pitch', pos: { x: ridgeX + (right - ridgeX) / 2, y: cy },
        text: `${pitch}/12`, angle: -90, shellId: id,
      });
    }
  } else if (roofStyle === 'shed') {
    // Shed: single slope, arrow from high edge to low edge
    if (isHoriz) {
      // Slope goes from top (high) to bottom (low) by default
      const arrowStart: Point2D = { x: cx, y: top + h * 0.25 };
      const arrowEnd: Point2D = { x: cx, y: bottom - h * 0.25 };
      lines.push({ type: 'slope-arrow', p1: arrowStart, p2: arrowEnd, shellId: id, angle: 90 });
      annotations.push({
        type: 'pitch', pos: { x: cx, y: cy },
        text: `${pitch}/12`, shellId: id,
      });
    } else {
      const arrowStart: Point2D = { x: left + w * 0.25, y: cy };
      const arrowEnd: Point2D = { x: right - w * 0.25, y: cy };
      lines.push({ type: 'slope-arrow', p1: arrowStart, p2: arrowEnd, shellId: id, angle: 0 });
      annotations.push({
        type: 'pitch', pos: { x: cx, y: cy },
        text: `${pitch}/12`, angle: -90, shellId: id,
      });
    }
  } else if (roofStyle === 'flat') {
    // Flat: cross-hatch X pattern
    lines.push({ type: 'ridge', p1: nw, p2: se, shellId: id });
    lines.push({ type: 'ridge', p1: ne, p2: sw, shellId: id });
    annotations.push({
      type: 'pitch', pos: { x: cx, y: cy },
      text: 'FLAT', shellId: id,
    });
  }

  return { lines, annotations };
}

// ────────────────── Valley Detection Between Shells ────────────────────

interface Rect {
  left: number; top: number; right: number; bottom: number;
}

function rectsOverlap(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (left >= right || top >= bottom) return null;
  return { left, top, right, bottom };
}

interface PlaneDef {
  nx: number;
  ny: number;
  d: number; // z = nx * x + ny * y + d
  bounds: Rect;
}

function getShellPlanes(shell: RoofShellBounds): PlaneDef[] {
  const planes: PlaneDef[] = [];
  const { cx, cy, w, h, isHoriz, pitch, ridgeRatio, roofStyle } = shell;
  
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  
  const m = pitch / 12; // slope
  const eaveZ = 0; // relative base height
  
  if (isHoriz) {
    const ridgeY = top + h * ridgeRatio;
    
    // North slope (y from top to ridgeY)
    // z = eaveZ + (y - top) * m => z = m*y + (eaveZ - m*top)
    planes.push({
      nx: 0, ny: m, d: eaveZ - m * top,
      bounds: { left, right, top, bottom: ridgeY }
    });
    
    // South slope (y from ridgeY to bottom)
    // z = eaveZ + (bottom - y) * m => z = -m*y + (eaveZ + m*bottom)
    planes.push({
      nx: 0, ny: -m, d: eaveZ + m * bottom,
      bounds: { left, right, top: ridgeY, bottom }
    });
    
    if (roofStyle === 'hip') {
      // West hip (x from left to ridge start)
      // z = eaveZ + (x - left) * m => z = m*x + (eaveZ - m*left)
      const inset = Math.min(h * ridgeRatio, h * (1 - ridgeRatio), w / 2);
      planes.push({
        nx: m, ny: 0, d: eaveZ - m * left,
        bounds: { left, right: left + inset, top, bottom }
      });
      // East hip
      planes.push({
        nx: -m, ny: 0, d: eaveZ + m * right,
        bounds: { left: right - inset, right, top, bottom }
      });
    }
  } else {
    const ridgeX = left + w * ridgeRatio;
    
    // West slope (x from left to ridgeX)
    planes.push({
      nx: m, ny: 0, d: eaveZ - m * left,
      bounds: { left, right: ridgeX, top, bottom }
    });
    
    // East slope (x from ridgeX to right)
    planes.push({
      nx: -m, ny: 0, d: eaveZ + m * right,
      bounds: { left: ridgeX, right, top, bottom }
    });
    
    if (roofStyle === 'hip') {
      const inset = Math.min(w * ridgeRatio, w * (1 - ridgeRatio), h / 2);
      // North hip
      planes.push({
        nx: 0, ny: m, d: eaveZ - m * top,
        bounds: { left, right, top, bottom: top + inset }
      });
      // South hip
      planes.push({
        nx: 0, ny: -m, d: eaveZ + m * bottom,
        bounds: { left, right, top: bottom - inset, bottom }
      });
    }
  }
  
  return planes;
}

function clipLineToRect(p1: Point2D, p2: Point2D, rect: Rect): [Point2D, Point2D] | null {
  let t0 = 0, t1 = 1;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - rect.left, rect.right - p1.x, p1.y - rect.top, rect.bottom - p1.y];
  
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return null;
        t0 = Math.max(t0, t);
      } else {
        if (t < t0) return null;
        t1 = Math.min(t1, t);
      }
    }
  }
  
  if (t0 > t1) return null;
  return [
    { x: p1.x + t0 * dx, y: p1.y + t0 * dy },
    { x: p1.x + t1 * dx, y: p1.y + t1 * dy }
  ];
}

/**
 * Compute valley lines between two overlapping shells using true 3D plane intersections.
 */
function computeValleyLines(a: RoofShellBounds, b: RoofShellBounds): RoofPlanLine[] {
  const rectA: Rect = { left: a.cx - a.w / 2, top: a.cy - a.h / 2, right: a.cx + a.w / 2, bottom: a.cy + a.h / 2 };
  const rectB: Rect = { left: b.cx - b.w / 2, top: b.cy - b.h / 2, right: b.cx + b.w / 2, bottom: b.cy + b.h / 2 };

  const overlap = rectsOverlap(rectA, rectB);
  if (!overlap) return [];

  const valleys: RoofPlanLine[] = [];
  const planesA = getShellPlanes(a);
  const planesB = getShellPlanes(b);

  for (const pA of planesA) {
    for (const pB of planesB) {
      const faceOverlap = rectsOverlap(pA.bounds, pB.bounds);
      if (!faceOverlap) continue;

      // Intersection line: zA = zB
      // nxA * x + nyA * y + dA = nxB * x + nyB * y + dB
      // (nxA - nxB) * x + (nyA - nyB) * y + (dA - dB) = 0
      const aC = pA.nx - pB.nx;
      const bC = pA.ny - pB.ny;
      const cC = pA.d - pB.d;

      // If planes are parallel, no single intersection line
      if (Math.abs(aC) < 0.001 && Math.abs(bC) < 0.001) continue;

      // Find two points on this 2D line to clip against the face overlap rect
      let pt1: Point2D, pt2: Point2D;
      
      if (Math.abs(bC) > Math.abs(aC)) {
        // Line is more horizontal, solve for y given x
        const x1 = faceOverlap.left - 100;
        const y1 = (-aC * x1 - cC) / bC;
        const x2 = faceOverlap.right + 100;
        const y2 = (-aC * x2 - cC) / bC;
        pt1 = { x: x1, y: y1 };
        pt2 = { x: x2, y: y2 };
      } else {
        // Line is more vertical, solve for x given y
        const y1 = faceOverlap.top - 100;
        const x1 = (-bC * y1 - cC) / aC;
        const y2 = faceOverlap.bottom + 100;
        const x2 = (-bC * y2 - cC) / aC;
        pt1 = { x: x1, y: y1 };
        pt2 = { x: x2, y: y2 };
      }

      const clipped = clipLineToRect(pt1, pt2, faceOverlap);
      if (clipped) {
        valleys.push({
          type: 'valley',
          p1: clipped[0],
          p2: clipped[1],
          shellId: `${a.id}-${b.id}`
        });
      }
    }
  }

  return valleys;
}

// ────────────────────── Main API ───────────────────────────────────────

/**
 * Compute the full 2D roof plan for a set of Solid Shells.
 * Returns lines and annotations ready for SVG rendering.
 */
export function computeRoofPlan(
  shells: RoofShellBounds[],
  groupedIds?: string[][] // arrays of shell IDs that are in the same group
): RoofPlanResult {
  const allLines: RoofPlanLine[] = [];
  const allAnnotations: RoofPlanAnnotation[] = [];

  // 1. Per-shell hatching
  for (const shell of shells) {
    const result = computeShellHatching(shell);
    allLines.push(...result.lines);
    allAnnotations.push(...result.annotations);
  }

  // 2. Valley lines between grouped shells
  const groups = groupedIds || [shells.map(s => s.id)]; // default: all in one group
  for (const group of groups) {
    const groupShells = shells.filter(s => group.includes(s.id));
    for (let i = 0; i < groupShells.length; i++) {
      for (let j = i + 1; j < groupShells.length; j++) {
        const valleys = computeValleyLines(groupShells[i], groupShells[j]);
        allLines.push(...valleys);
      }
    }
  }

  return { lines: allLines, annotations: allAnnotations };
}
