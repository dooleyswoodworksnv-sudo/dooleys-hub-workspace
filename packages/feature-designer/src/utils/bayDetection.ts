/**
 * Bay Detection — decomposes building shapes into rectangular bays
 * for per-bay joist direction management.
 *
 * Each bay is a rectangular region with its own joist direction.
 * Bays are detected from the building shape and dimensions.
 */

import { AppState } from '../App';

export interface FloorBay {
  id: string;
  label: string;
  joistDirection: 'x' | 'y';
  /** Bay origin X in inches (relative to building origin) */
  x: number;
  /** Bay origin Y in inches */
  y: number;
  /** Bay width in inches (X axis) */
  width: number;
  /** Bay height in inches (Y axis) */
  height: number;
  foundationType?: 'default' | 'none' | 'slab' | 'slab-on-grade' | 'stem-wall';
}

/**
 * Returns the optimal joist direction for a bay: joists should span
 * the SHORTER dimension for structural efficiency.
 *
 * If the bay is wider than tall, joists span along Y (each joist runs
 * in the Y direction, distributed along X) — i.e., direction = 'x'.
 * If taller than wide, joists run along X, distributed along Y — direction = 'y'.
 *
 * Wait — let's be precise about the existing convention:
 *   joistDirection = 'y' → joists are SPACED along Y axis, each RUNS along X
 *   joistDirection = 'x' → joists are SPACED along X axis, each RUNS along Y
 *
 * So for structural optimality, joists should RUN along the shorter dimension.
 *   If width < height → joists run along X (shorter) → spaced along Y → direction = 'y'
 *   If height < width → joists run along Y (shorter) → spaced along X → direction = 'x'
 */
function optimalDirection(widthIn: number, heightIn: number): 'x' | 'y' {
  // To span the shorter side of the bay:
  // - If width (X) is shorter than height (Y), we want joists to run along X -> 'x'
  // - If height (Y) is shorter than width (X), we want joists to run along Y -> 'y'
  return widthIn <= heightIn ? 'x' : 'y';
}

/**
 * Labels bays based on count and relative position.
 */
function labelBays(bays: Omit<FloorBay, 'label'>[]): FloorBay[] {
  if (bays.length === 1) {
    return [{ ...bays[0], label: 'Main Floor' }];
  }

  if (bays.length === 2) {
    // Sort by area descending — largest is "Main", other is "Wing"
    const sorted = [...bays].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    return [
      { ...sorted[0], label: 'Main Section' },
      { ...sorted[1], label: 'Wing' },
    ];
  }

  if (bays.length === 3) {
    // For H/U/I shapes: determine left/center/right or top/center/bottom
    const sorted = [...bays].sort((a, b) => a.x - b.x || a.y - b.y);

    // Check if this is a left-center-right arrangement (H-shape)
    const xPositions = sorted.map(b => b.x);
    const allDifferentX = new Set(xPositions).size === 3;

    if (allDifferentX) {
      return [
        { ...sorted[0], label: 'Left Wing' },
        { ...sorted[1], label: 'Center Bay' },
        { ...sorted[2], label: 'Right Wing' },
      ];
    }

    // Check for top-center-bottom (vertical arrangement)
    const yPositions = sorted.map(b => b.y);
    const allDifferentY = new Set(yPositions).size === 3;

    if (allDifferentY) {
      const ySorted = [...bays].sort((a, b) => a.y - b.y);
      return [
        { ...ySorted[0], label: 'Front Section' },
        { ...ySorted[1], label: 'Center Bay' },
        { ...ySorted[2], label: 'Back Section' },
      ];
    }

    // Generic fallback
    return sorted.map((b, i) => ({
      ...b,
      label: `Bay ${i + 1}`,
    }));
  }

  // 4+ bays: use generic numbering
  return bays.map((b, i) => ({ ...b, label: `Bay ${i + 1}` }));
}

/**
 * Format a bay's dimensions as a human-readable string.
 * e.g., "15' × 24'" or "15' 6\" × 24'"
 */
export function formatBayDimensions(bay: FloorBay): string {
  const wFt = Math.floor(bay.width / 12);
  const wIn = Math.round(bay.width % 12);
  const hFt = Math.floor(bay.height / 12);
  const hIn = Math.round(bay.height % 12);

  const wStr = wIn > 0 ? `${wFt}' ${wIn}"` : `${wFt}'`;
  const hStr = hIn > 0 ? `${hFt}' ${hIn}"` : `${hFt}'`;

  return `${wStr} × ${hStr}`;
}

/**
 * Detect rectangular bays from the building shape.
 *
 * Priority:
 *   1. If `combinedBlocks` exist (custom/combined shapes), use them directly
 *   2. Otherwise, decompose the shape from its type-specific dimensions
 *   3. Each bay gets the structurally optimal joist direction (span short side)
 *
 * All coordinates are in inches.
 */
export function detectBays(state: AppState): FloorBay[] {
  // ── Priority 1: use combinedBlocks if they exist ──
  if (state.combinedBlocks && state.combinedBlocks.length > 0) {
    const bays: Omit<FloorBay, 'label'>[] = state.combinedBlocks.map((block, i) => ({
      id: `bay-${block.id || i}`,
      joistDirection: optimalDirection(block.w, block.h),
      x: block.x,
      y: block.y,
      width: block.w,
      height: block.h,
    }));
    return labelBays(bays);
  }

  const w = state.widthFt * 12 + (state.widthInches || 0);
  const l = state.lengthFt * 12 + (state.lengthInches || 0);

  if (w <= 0 || l <= 0) return [];

  // ── Priority 2: decompose from shape type ──
  switch (state.shape) {
    case 'rectangle':
      return labelBays([{
        id: 'bay-main',
        joistDirection: optimalDirection(w, l),
        x: 0,
        y: 0,
        width: w,
        height: l,
      }]);

    case 'l-shape': {
      const l1 = (state.lRightDepthFt || 0) * 12 + (state.lRightDepthInches || 0);
      const w2 = (state.lBackWidthFt || 0) * 12 + (state.lBackWidthInches || 0);

      if (l1 <= 0 || w2 <= 0) {
        // Degenerate L — treat as rectangle
        return labelBays([{
          id: 'bay-main',
          joistDirection: optimalDirection(w, l),
          x: 0, y: 0, width: w, height: l,
        }]);
      }

      // L-shape = 2 rectangles:
      //   Bay 1 (top bar): full width × right depth
      //   Bay 2 (left stem): back width × remaining length
      // Layout depends on lDirection, but the default is 'back-right':
      //   ┌──────────┐
      //   │  Bay 1   │ (w × l1)
      //   ├────┐     │
      //   │Bay2│     │ — wait, this isn't right.
      //   └────┘     │
      //
      // Actually for back-right L:
      //   ┌──────┐
      //   │      │ ← full width w, depth l1
      //   ├──┐   │
      //   │  │   └── the right portion stops at l1
      //   │  │       
      //   └──┘ ← back width w2, from l1 to l
      //
      // So: Bay 1 = top (0,0, w, l1), Bay 2 = bottom-left (0, l1, w2, l - l1)
      return labelBays([
        {
          id: 'bay-top',
          joistDirection: optimalDirection(w, l1),
          x: 0, y: 0, width: w, height: l1,
        },
        {
          id: 'bay-stem',
          joistDirection: optimalDirection(w2, l - l1),
          x: 0, y: l1, width: w2, height: l - l1,
        },
      ]);
    }

    case 't-shape': {
      const topW = (state.tTopWidthFt || 0) * 12 + (state.tTopWidthInches || 0);
      const topL = (state.tTopLengthFt || 0) * 12 + (state.tTopLengthInches || 0);
      const stemW = (state.tStemWidthFt || 0) * 12 + (state.tStemWidthInches || 0);
      const stemL = (state.tStemLengthFt || 0) * 12 + (state.tStemLengthInches || 0);

      if (topW <= 0 || topL <= 0 || stemW <= 0 || stemL <= 0) {
        return labelBays([{
          id: 'bay-main',
          joistDirection: optimalDirection(w, l),
          x: 0, y: 0, width: w, height: l,
        }]);
      }

      // T-shape: top bar + stem
      //   ┌────────────┐
      //   │   Top Bar   │ (topW × topL)
      //   └──┬──────┬───┘
      //      │ Stem │     (stemW × stemL)
      //      └──────┘
      const stemX = (topW - stemW) / 2;
      return labelBays([
        {
          id: 'bay-top',
          joistDirection: optimalDirection(topW, topL),
          x: 0, y: 0, width: topW, height: topL,
        },
        {
          id: 'bay-stem',
          joistDirection: optimalDirection(stemW, stemL),
          x: stemX, y: topL, width: stemW, height: stemL,
        },
      ]);
    }

    case 'h-shape': {
      const hLeftW = (state.hLeftBarWidthFt || 0) * 12 + (state.hLeftBarWidthInches || 0);
      const hRightW = (state.hRightBarWidthFt || 0) * 12 + (state.hRightBarWidthInches || 0);
      const hMidH = (state.hMiddleBarHeightFt || 0) * 12 + (state.hMiddleBarHeightInches || 0);
      const hMidOff = (state.hMiddleBarOffsetFt || 0) * 12 + (state.hMiddleBarOffsetInches || 0);
      const centerW = w - hLeftW - hRightW;

      if (hLeftW <= 0 || hRightW <= 0 || hMidH <= 0 || centerW <= 0) {
        return labelBays([{
          id: 'bay-main',
          joistDirection: optimalDirection(w, l),
          x: 0, y: 0, width: w, height: l,
        }]);
      }

      // H-shape: left wing + center bar + right wing
      //   ┌────┐──────┌────┐
      //   │Left│Center│Right│
      //   │Wing│ Bar  │Wing │
      //   └────┘──────└────┘
      return labelBays([
        {
          id: 'bay-left',
          joistDirection: optimalDirection(hLeftW, l),
          x: 0, y: 0, width: hLeftW, height: l,
        },
        {
          id: 'bay-center',
          joistDirection: optimalDirection(centerW, hMidH),
          x: hLeftW, y: hMidOff, width: centerW, height: hMidH,
        },
        {
          id: 'bay-right',
          joistDirection: optimalDirection(hRightW, l),
          x: hLeftW + centerW, y: 0, width: hRightW, height: l,
        },
      ]);
    }

    case 'u-shape': {
      // U-shape uses 8 wall segments (w1-w8)
      // Standard U-shape geometry (back opening):
      //   ┌────────────────┐ ← w1 (top/front)
      //   │                │
      //   │ w8     w2 (left│side)
      //   │                │
      //   │   ┌────────┐   │
      //   │   │  void  │   │ ← w5 (inner top)
      //   │   │        │   │
      //   └───┘        └───┘
      //   w7 (bottom-left)  w3 (inner right side)
      //
      // The U decomposes into 3 bays:
      //   Bay 1 (top bar): w1 × w8 (or thickness of top)
      //   Bay 2 (left wing): w7 × (w2 - something)
      //   Bay 3 (right wing): similar
      //
      // For simplicity, use the wall dimensions to compute:
      const u_w1 = (state.uWalls?.w1 || 0) * 12 + (state.uWallsInches?.w1 || 0); // top width
      const u_w2 = (state.uWalls?.w2 || 0) * 12 + (state.uWallsInches?.w2 || 0); // left height
      const u_w3 = (state.uWalls?.w3 || 0) * 12 + (state.uWallsInches?.w3 || 0); // inner right width
      const u_w4 = (state.uWalls?.w4 || 0) * 12 + (state.uWallsInches?.w4 || 0); // inner left height
      const u_w5 = (state.uWalls?.w5 || 0) * 12 + (state.uWallsInches?.w5 || 0); // inner top width
      const u_w7 = (state.uWalls?.w7 || 0) * 12 + (state.uWallsInches?.w7 || 0); // left wing width
      const u_w8 = (state.uWalls?.w8 || 0) * 12 + (state.uWallsInches?.w8 || 0); // bottom

      // Left wing width
      const leftWingW = u_w1 - u_w3 - u_w5; // or just use the gap
      const rightWingW = u_w3;
      const innerH = u_w2 - u_w4;
      const topBarH = u_w4;

      if (u_w1 <= 0 || u_w2 <= 0) {
        return labelBays([{
          id: 'bay-main',
          joistDirection: optimalDirection(w, l),
          x: 0, y: 0, width: w, height: l,
        }]);
      }

      // 3 bays: top bar spanning full width, left wing, right wing
      return labelBays([
        {
          id: 'bay-top',
          joistDirection: optimalDirection(u_w1, topBarH),
          x: 0, y: 0, width: u_w1, height: topBarH,
        },
        {
          id: 'bay-left',
          joistDirection: optimalDirection(u_w7, innerH),
          x: 0, y: topBarH, width: u_w7, height: innerH,
        },
        {
          id: 'bay-right',
          joistDirection: optimalDirection(rightWingW, innerH),
          x: u_w1 - rightWingW, y: topBarH, width: rightWingW, height: innerH,
        },
      ]);
    }

    case 'custom':
    default:
      // Custom shapes without combinedBlocks — single bounding box
      return labelBays([{
        id: 'bay-main',
        joistDirection: state.joistDirection || optimalDirection(w, l),
        x: 0,
        y: 0,
        width: w,
        height: l,
      }]);
  }
}

export interface BoundarySegment {
  id: string;
  dir: 'x' | 'y'; // 'x' means horizontal line (y = const), 'y' means vertical line (x = const)
  coord: number;  // x coordinate if dir='y', y coordinate if dir='x'
  start: number;  // yStart if dir='y', xStart if dir='x'
  end: number;    // yEnd if dir='y', xEnd if dir='x'
}

export interface GirderLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  isSpanY: boolean;
  posts: { x: number; y: number; id: string }[];
  brackets: { x: number; y: number; id: string; type: 'start' | 'end'; isWoodToWood?: boolean }[];
}

export interface PocketBeam {
  id: string;
  dir: 'x' | 'y';
  coord: number;
  start: number;
  end: number;
  length: number;
  posts: { x: number; y: number; id: string }[];
  brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[];
}

export interface FramingSupportSystem {
  girders: GirderLine[];
  pocketBeams: PocketBeam[];
  totalGirderLF: number;
  totalPocketBeamLF: number;
  totalSupportPosts: number;
  totalPiers: number;
  totalSimpsonBrackets: number;
  totalWoodToWoodBrackets: number;
}

/**
 * Detect shared boundary segments between adjacent rectangular bays.
 */
export function detectInteriorBoundaries(bays: FloorBay[]): BoundarySegment[] {
  const boundaries: BoundarySegment[] = [];
  if (bays.length <= 1) return boundaries;

  for (let i = 0; i < bays.length; i++) {
    for (let j = i + 1; j < bays.length; j++) {
      const bayA = bays[i];
      const bayB = bays[j];

      // Check vertical touch
      // Case 1: A is to the left of B
      if (Math.abs((bayA.x + bayA.width) - bayB.x) < 0.1) {
        const yStart = Math.max(bayA.y, bayB.y);
        const yEnd = Math.min(bayA.y + bayA.height, bayB.y + bayB.height);
        if (yStart < yEnd - 0.1) {
          boundaries.push({
            id: `boundary-v-${i}-${j}`,
            dir: 'y',
            coord: bayB.x,
            start: yStart,
            end: yEnd
          });
        }
      }
      // Case 2: B is to the left of A
      else if (Math.abs((bayB.x + bayB.width) - bayA.x) < 0.1) {
        const yStart = Math.max(bayA.y, bayB.y);
        const yEnd = Math.min(bayA.y + bayA.height, bayB.y + bayB.height);
        if (yStart < yEnd - 0.1) {
          boundaries.push({
            id: `boundary-v-${j}-${i}`,
            dir: 'y',
            coord: bayA.x,
            start: yStart,
            end: yEnd
          });
        }
      }

      // Check horizontal touch
      // Case 1: A is above B
      if (Math.abs((bayA.y + bayA.height) - bayB.y) < 0.1) {
        const xStart = Math.max(bayA.x, bayB.x);
        const xEnd = Math.min(bayA.x + bayA.width, bayB.x + bayB.width);
        if (xStart < xEnd - 0.1) {
          boundaries.push({
            id: `boundary-h-${i}-${j}`,
            dir: 'x',
            coord: bayB.y,
            start: xStart,
            end: xEnd
          });
        }
      }
      // Case 2: B is above A
      else if (Math.abs((bayB.y + bayB.height) - bayA.y) < 0.1) {
        const xStart = Math.max(bayA.x, bayB.x);
        const xEnd = Math.min(bayA.x + bayA.width, bayB.x + bayB.width);
        if (xStart < xEnd - 0.1) {
          boundaries.push({
            id: `boundary-h-${j}-${i}`,
            dir: 'x',
            coord: bayA.y,
            start: xStart,
            end: xEnd
          });
        }
      }
    }
  }

  return boundaries;
}

/**
 * Helper to check if a point lies on an interior boundary line.
 */
export function isPointOnInteriorBoundary(x: number, y: number, boundaries: BoundarySegment[]): boolean {
  for (const b of boundaries) {
    if (b.dir === 'y') {
      if (Math.abs(x - b.coord) < 0.5 && y >= b.start - 0.5 && y <= b.end + 0.5) {
        return true;
      }
    } else {
      if (Math.abs(y - b.coord) < 0.5 && x >= b.start - 0.5 && x <= b.end + 0.5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes all girder start/end coordinate points across all bays.
 */
export function getGirderEndpoints(state: any, bays: FloorBay[]): { x: number; y: number }[] {
  const endpoints: { x: number; y: number }[] = [];
  if (!state.enableGirderSystem || !state.addFloorFraming) return endpoints;

  const thresholdIn = state.girderSpanThresholdFt * 12;

  bays.forEach((bay) => {
    const isSpanY = bay.joistDirection === 'y';
    const spanIn = isSpanY ? bay.height : bay.width;

    if (spanIn <= thresholdIn) return;

    const numSpaces = Math.ceil(spanIn / thresholdIn);
    const numGirders = numSpaces - 1;

    for (let i = 1; i <= numGirders; i++) {
      const offset = i * (spanIn / numSpaces);
      if (isSpanY) {
        endpoints.push({ x: bay.x, y: bay.y + offset });
        endpoints.push({ x: bay.x + bay.width, y: bay.y + offset });
      } else {
        endpoints.push({ x: bay.x + offset, y: bay.y });
        endpoints.push({ x: bay.x + offset, y: bay.y + bay.height });
      }
    }
  });

  return endpoints;
}

/**
 * Checks if a boundary segment contains any girder endpoints.
 */
export function boundaryContainsEndpoint(b: BoundarySegment, endpoints: { x: number; y: number }[]): boolean {
  for (const ep of endpoints) {
    if (b.dir === 'y') {
      if (Math.abs(ep.x - b.coord) < 0.5 && ep.y >= b.start - 0.5 && ep.y <= b.end + 0.5) {
        return true;
      }
    } else {
      if (Math.abs(ep.y - b.coord) < 0.5 && ep.x >= b.start - 0.5 && ep.x <= b.end + 0.5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes the complete floor framing support system (girders and pocket beams).
 */
export function computeFramingSupportSystem(state: any, bays: FloorBay[]): FramingSupportSystem {
  const girders: GirderLine[] = [];
  const pocketBeams: PocketBeam[] = [];
  
  let totalGirderLF = 0;
  let totalPocketBeamLF = 0;
  let totalSupportPosts = 0;
  let totalPiers = 0;
  let totalSimpsonBrackets = 0;
  let totalWoodToWoodBrackets = 0;

  if (!state.enableGirderSystem || !state.addFloorFraming || bays.length === 0) {
    return {
      girders,
      pocketBeams,
      totalGirderLF,
      totalPocketBeamLF,
      totalSupportPosts,
      totalPiers,
      totalSimpsonBrackets,
      totalWoodToWoodBrackets
    };
  }

  const thresholdIn = state.girderSpanThresholdFt * 12;
  const postSpacingIn = state.girderPostSpacingFt * 12;

  // 1. Detect interior boundaries if pocket beams are enabled
  let boundaries = state.addPocketBeams !== false ? detectInteriorBoundaries(bays) : [];
  if (state.pocketBeamsOnlyAtGirderEnds && boundaries.length > 0) {
    const endpoints = getGirderEndpoints(state, bays);
    boundaries = boundaries.filter(b => boundaryContainsEndpoint(b, endpoints));
  }

  // 2. Generate Pocket Beams along interior boundaries
  boundaries.forEach((b, idx) => {
    const pocketBeamLen = b.end - b.start;
    if (pocketBeamLen < 6) return; // ignore tiny segments

    const lf = Math.round(pocketBeamLen / 12);
    totalPocketBeamLF += lf;

    const numPostSpaces = Math.max(1, Math.ceil(pocketBeamLen / postSpacingIn));
    
    // Support posts along the pocket beam length
    const posts: { x: number; y: number; id: string }[] = [];
    for (let k = 1; k < numPostSpaces; k++) {
      const pOffset = k * (pocketBeamLen / numPostSpaces);
      const px = b.dir === 'y' ? b.coord : b.start + pOffset;
      const py = b.dir === 'y' ? b.start + pOffset : b.coord;
      posts.push({ x: px, y: py, id: `pocket-post-${idx}-${k}` });
      totalSupportPosts++;
      totalPiers++;
    }

    // Pocket beams terminate at perimeter walls, so they always get Simpson concrete wall brackets
    const brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[] = [
      {
        x: b.dir === 'y' ? b.coord : b.start,
        y: b.dir === 'y' ? b.start : b.coord,
        id: `pocket-bracket-${idx}-start`,
        type: 'start'
      },
      {
        x: b.dir === 'y' ? b.coord : b.end,
        y: b.dir === 'y' ? b.end : b.coord,
        id: `pocket-bracket-${idx}-end`,
        type: 'end'
      }
    ];
    totalSimpsonBrackets += 2;

    pocketBeams.push({
      id: `pocket-beam-${idx}`,
      dir: b.dir,
      coord: b.coord,
      start: b.start,
      end: b.end,
      length: pocketBeamLen,
      posts,
      brackets
    });
  });

  // 3. Generate standard Girders for each bay
  bays.forEach((bay, bIdx) => {
    const bayFoundation = (bay.foundationType && bay.foundationType !== 'default') ? bay.foundationType : state.foundationType;
    if (bayFoundation === 'slab' || bayFoundation === 'slab-on-grade' || bayFoundation === 'none') {
      return; // Skip floor girders inside concrete slabs or no-foundation zones
    }

    const isSpanY = bay.joistDirection === 'y';
    const spanIn = isSpanY ? bay.height : bay.width;
    const girderLengthIn = isSpanY ? bay.width : bay.height;

    if (spanIn <= thresholdIn) return;

    const numSpaces = Math.ceil(spanIn / thresholdIn);
    const numGirders = numSpaces - 1;

    for (let i = 1; i <= numGirders; i++) {
      const offset = i * (spanIn / numSpaces);
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

      if (isSpanY) {
        x1 = bay.x;
        y1 = bay.y + offset;
        x2 = bay.x + bay.width;
        y2 = y1;
      } else {
        x1 = bay.x + offset;
        y1 = bay.y;
        x2 = x1;
        y2 = bay.y + bay.height;
      }

      totalGirderLF += Math.round(girderLengthIn / 12);

      const numPostSpaces = Math.max(1, Math.ceil(girderLengthIn / postSpacingIn));
      
      // Posts and piers along the girder
      const posts: { x: number; y: number; id: string }[] = [];
      for (let j = 1; j < numPostSpaces; j++) {
        const pOffset = j * (girderLengthIn / numPostSpaces);
        const px = isSpanY ? x1 + pOffset : x1;
        const py = isSpanY ? y1 : y1 + pOffset;
        posts.push({ x: px, y: py, id: `post-${bIdx}-${i}-${j}` });
        totalSupportPosts++;
        totalPiers++;
      }

      // Check endpoints to decide wood-to-wood vs concrete wall bracket
      const startOnBoundary = isPointOnInteriorBoundary(x1, y1, boundaries);
      const endOnBoundary = isPointOnInteriorBoundary(x2, y2, boundaries);

      if (startOnBoundary) totalWoodToWoodBrackets++; else totalSimpsonBrackets++;
      if (endOnBoundary) totalWoodToWoodBrackets++; else totalSimpsonBrackets++;

      const brackets: GirderLine['brackets'] = [
        {
          x: x1,
          y: y1,
          id: `bracket-${bIdx}-${i}-start`,
          type: 'start',
          isWoodToWood: startOnBoundary
        },
        {
          x: x2,
          y: y2,
          id: `bracket-${bIdx}-${i}-end`,
          type: 'end',
          isWoodToWood: endOnBoundary
        }
      ];

      girders.push({
        id: `girder-${bIdx}-${i}`,
        x1,
        y1,
        x2,
        y2,
        length: girderLengthIn,
        isSpanY,
        posts,
        brackets
      });
    }
  });

  return {
    girders,
    pocketBeams,
    totalGirderLF,
    totalPocketBeamLF,
    totalSupportPosts,
    totalPiers,
    totalSimpsonBrackets,
    totalWoodToWoodBrackets
  };
}
