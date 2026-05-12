// SymbolCatalog.ts — Built-in 2D Architectural Plan Symbols
// Each symbol has inline SVG path data (plan-view, top-down), real-world dimensions in inches,
// and a category for grouping in the sidebar picker.

export interface SymbolDefinition {
  id: string;
  name: string;
  category: 'kitchen' | 'bathroom' | 'bedroom' | 'living' | 'misc';
  widthIn: number;   // Real-world width (X axis) in inches
  depthIn: number;   // Real-world depth (Y axis) in inches
  heightIn: number;  // Real-world height for 3D, in inches
  color: string;     // Fill color for 2D symbol
  color3D: string;   // Color for 3D placeholder box
  // SVG path data: drawn in a coordinate space of (0,0) to (widthIn, depthIn)
  // Will be rendered inside a <g> scaled to the asset's dimensions
  svgPaths: { d: string; fill?: string; stroke?: string; strokeWidth?: number }[];
  // Optional extra SVG elements (circles, rects, etc.)
  svgExtras?: string;
  // Optional path to a default .glb 3D model (served via /api/serve-file)
  glbPath?: string;
}

export const SYMBOL_CATALOG: SymbolDefinition[] = [
  // ══════════════════════════════════════════════
  // BATHROOM
  // ══════════════════════════════════════════════
  {
    id: 'toilet',
    name: 'Toilet',
    category: 'bathroom',
    widthIn: 18,
    depthIn: 28,
    heightIn: 30,
    color: '#93c5fd',
    color3D: '#60a5fa',
    glbPath: '/assets/toilet/uncategorized/toilet2.glb',
    svgPaths: [
      // Tank (rectangle at back)
      { d: 'M 2 0 L 16 0 L 16 8 L 2 8 Z', fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 0.8 },
      // Bowl (oval)
      { d: 'M 9 8 C 16 8 18 16 16 22 C 14 27 4 27 2 22 C 0 16 2 8 9 8 Z', fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 0.8 },
      // Seat opening
      { d: 'M 9 11 C 14 11 15 16 13 20 C 12 23 6 23 5 20 C 3 16 4 11 9 11 Z', fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 0.5 },
    ],
  },
  {
    id: 'bathtub',
    name: 'Bathtub',
    category: 'bathroom',
    widthIn: 30,
    depthIn: 60,
    heightIn: 20,
    color: '#93c5fd',
    color3D: '#60a5fa',
    svgPaths: [
      // Outer tub body
      { d: 'M 2 2 Q 2 0 4 0 L 26 0 Q 28 0 28 2 L 28 58 Q 28 60 26 60 L 4 60 Q 2 60 2 58 Z', fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 1 },
      // Inner basin
      { d: 'M 5 4 Q 5 3 6 3 L 24 3 Q 25 3 25 4 L 25 56 Q 25 57 24 57 L 6 57 Q 5 57 5 56 Z', fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 0.5 },
      // Drain circle
      { d: 'M 15 50 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: 0.4 },
      // Faucet
      { d: 'M 13 6 L 17 6 L 17 9 L 13 9 Z', fill: '#94a3b8', stroke: '#64748b', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'vanity-sink',
    name: 'Vanity Sink',
    category: 'bathroom',
    widthIn: 24,
    depthIn: 20,
    heightIn: 34,
    color: '#93c5fd',
    color3D: '#60a5fa',
    svgPaths: [
      // Counter
      { d: 'M 0 0 L 24 0 L 24 20 L 0 20 Z', fill: '#e0e7ff', stroke: '#3b82f6', strokeWidth: 0.8 },
      // Basin (oval)
      { d: 'M 12 10 m -7 0 a 7 5 0 1 0 14 0 a 7 5 0 1 0 -14 0', fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 0.6 },
      // Faucet
      { d: 'M 11 3 L 13 3 L 13 6 L 11 6 Z', fill: '#94a3b8', stroke: '#64748b', strokeWidth: 0.3 },
    ],
  },
  {
    id: 'shower',
    name: 'Shower Stall',
    category: 'bathroom',
    widthIn: 36,
    depthIn: 36,
    heightIn: 84,
    color: '#93c5fd',
    color3D: '#60a5fa',
    svgPaths: [
      // Base
      { d: 'M 0 0 L 36 0 L 36 36 L 0 36 Z', fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 1 },
      // Drain
      { d: 'M 18 18 m -2.5 0 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0', fill: '#94a3b8', stroke: '#64748b', strokeWidth: 0.4 },
      // Door arc (quarter-circle swing)
      { d: 'M 0 0 L 0 30 A 30 30 0 0 0 30 0 Z', fill: 'rgba(147,197,253,0.15)', stroke: '#93c5fd', strokeWidth: 0.5 },
      // Shower head
      { d: 'M 30 4 m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: '#cbd5e1', stroke: '#94a3b8', strokeWidth: 0.4 },
    ],
  },

  // ══════════════════════════════════════════════
  // KITCHEN
  // ══════════════════════════════════════════════
  {
    id: 'refrigerator',
    name: 'Refrigerator',
    category: 'kitchen',
    widthIn: 36,
    depthIn: 30,
    heightIn: 70,
    color: '#fdba74',
    color3D: '#fb923c',
    svgPaths: [
      // Body
      { d: 'M 0 0 L 36 0 L 36 30 L 0 30 Z', fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 0.8 },
      // Divider line
      { d: 'M 12 0 L 12 30', fill: 'none', stroke: '#f59e0b', strokeWidth: 0.6 },
      // Left door handle
      { d: 'M 10 8 L 10 22', fill: 'none', stroke: '#d97706', strokeWidth: 1.2 },
      // Right door handle
      { d: 'M 14 8 L 14 22', fill: 'none', stroke: '#d97706', strokeWidth: 1.2 },
    ],
  },
  {
    id: 'stove',
    name: 'Stove / Range',
    category: 'kitchen',
    widthIn: 30,
    depthIn: 25,
    heightIn: 36,
    color: '#fdba74',
    color3D: '#fb923c',
    svgPaths: [
      // Body
      { d: 'M 0 0 L 30 0 L 30 25 L 0 25 Z', fill: '#fefce8', stroke: '#f59e0b', strokeWidth: 0.8 },
      // 4 burners (circles)
      { d: 'M 8 7 m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0', fill: 'none', stroke: '#d97706', strokeWidth: 0.8 },
      { d: 'M 22 7 m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0', fill: 'none', stroke: '#d97706', strokeWidth: 0.8 },
      { d: 'M 8 17 m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0', fill: 'none', stroke: '#d97706', strokeWidth: 0.8 },
      { d: 'M 22 17 m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0', fill: 'none', stroke: '#d97706', strokeWidth: 0.8 },
    ],
  },
  {
    id: 'kitchen-sink',
    name: 'Kitchen Sink',
    category: 'kitchen',
    widthIn: 33,
    depthIn: 22,
    heightIn: 36,
    color: '#fdba74',
    color3D: '#fb923c',
    svgPaths: [
      // Counter
      { d: 'M 0 0 L 33 0 L 33 22 L 0 22 Z', fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 0.8 },
      // Left basin
      { d: 'M 3 3 L 14 3 L 14 19 L 3 19 Z', fill: '#fefce8', stroke: '#eab308', strokeWidth: 0.6 },
      // Right basin
      { d: 'M 19 3 L 30 3 L 30 19 L 19 19 Z', fill: '#fefce8', stroke: '#eab308', strokeWidth: 0.6 },
      // Faucet
      { d: 'M 15 4 L 18 4 L 18 8 L 15 8 Z', fill: '#94a3b8', stroke: '#64748b', strokeWidth: 0.3 },
    ],
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher',
    category: 'kitchen',
    widthIn: 24,
    depthIn: 24,
    heightIn: 34,
    color: '#fdba74',
    color3D: '#fb923c',
    svgPaths: [
      // Body
      { d: 'M 0 0 L 24 0 L 24 24 L 0 24 Z', fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 0.8 },
      // Front panel line
      { d: 'M 2 20 L 22 20', fill: 'none', stroke: '#f59e0b', strokeWidth: 0.5 },
      // Handle
      { d: 'M 8 22 L 16 22', fill: 'none', stroke: '#d97706', strokeWidth: 1 },
      // DW label
    ],
  },

  // ══════════════════════════════════════════════
  // BEDROOM
  // ══════════════════════════════════════════════
  {
    id: 'single-bed',
    name: 'Single Bed',
    category: 'bedroom',
    widthIn: 39,
    depthIn: 75,
    heightIn: 24,
    color: '#c4b5fd',
    color3D: '#a78bfa',
    svgPaths: [
      // Frame
      { d: 'M 0 0 L 39 0 L 39 75 L 0 75 Z', fill: '#ede9fe', stroke: '#8b5cf6', strokeWidth: 1 },
      // Headboard
      { d: 'M 0 0 L 39 0 L 39 4 L 0 4 Z', fill: '#c4b5fd', stroke: '#8b5cf6', strokeWidth: 0.8 },
      // Pillow
      { d: 'M 5 7 Q 5 5 8 5 L 31 5 Q 34 5 34 7 L 34 15 Q 34 17 31 17 L 8 17 Q 5 17 5 15 Z', fill: '#f5f3ff', stroke: '#a78bfa', strokeWidth: 0.5 },
    ],
  },
  {
    id: 'queen-bed',
    name: 'Queen Bed',
    category: 'bedroom',
    widthIn: 60,
    depthIn: 80,
    heightIn: 24,
    color: '#c4b5fd',
    color3D: '#a78bfa',
    svgPaths: [
      // Frame
      { d: 'M 0 0 L 60 0 L 60 80 L 0 80 Z', fill: '#ede9fe', stroke: '#8b5cf6', strokeWidth: 1 },
      // Headboard
      { d: 'M 0 0 L 60 0 L 60 5 L 0 5 Z', fill: '#c4b5fd', stroke: '#8b5cf6', strokeWidth: 0.8 },
      // Left pillow
      { d: 'M 4 7 Q 4 6 6 6 L 26 6 Q 28 6 28 7 L 28 16 Q 28 18 26 18 L 6 18 Q 4 18 4 16 Z', fill: '#f5f3ff', stroke: '#a78bfa', strokeWidth: 0.5 },
      // Right pillow
      { d: 'M 32 7 Q 32 6 34 6 L 54 6 Q 56 6 56 7 L 56 16 Q 56 18 54 18 L 34 18 Q 32 18 32 16 Z', fill: '#f5f3ff', stroke: '#a78bfa', strokeWidth: 0.5 },
    ],
  },
  {
    id: 'king-bed',
    name: 'King Bed',
    category: 'bedroom',
    widthIn: 76,
    depthIn: 80,
    heightIn: 24,
    color: '#c4b5fd',
    color3D: '#a78bfa',
    svgPaths: [
      // Frame
      { d: 'M 0 0 L 76 0 L 76 80 L 0 80 Z', fill: '#ede9fe', stroke: '#8b5cf6', strokeWidth: 1 },
      // Headboard
      { d: 'M 0 0 L 76 0 L 76 5 L 0 5 Z', fill: '#c4b5fd', stroke: '#8b5cf6', strokeWidth: 0.8 },
      // Left pillow
      { d: 'M 4 7 Q 4 6 6 6 L 34 6 Q 36 6 36 7 L 36 16 Q 36 18 34 18 L 6 18 Q 4 18 4 16 Z', fill: '#f5f3ff', stroke: '#a78bfa', strokeWidth: 0.5 },
      // Right pillow
      { d: 'M 40 7 Q 40 6 42 6 L 70 6 Q 72 6 72 7 L 72 16 Q 72 18 70 18 L 42 18 Q 40 18 40 16 Z', fill: '#f5f3ff', stroke: '#a78bfa', strokeWidth: 0.5 },
    ],
  },

  // ══════════════════════════════════════════════
  // LIVING
  // ══════════════════════════════════════════════
  {
    id: 'sofa-3seat',
    name: '3-Seat Sofa',
    category: 'living',
    widthIn: 84,
    depthIn: 36,
    heightIn: 34,
    color: '#86efac',
    color3D: '#4ade80',
    svgPaths: [
      // Back
      { d: 'M 0 0 L 84 0 L 84 8 L 0 8 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      // Seat cushions
      { d: 'M 2 8 L 28 8 L 28 30 L 2 30 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.5 },
      { d: 'M 29 8 L 55 8 L 55 30 L 29 30 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.5 },
      { d: 'M 56 8 L 82 8 L 82 30 L 56 30 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.5 },
      // Arms
      { d: 'M 0 0 L 2 0 L 2 34 L 0 34 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      { d: 'M 82 0 L 84 0 L 84 34 L 82 34 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      // Front
      { d: 'M 0 30 L 84 30 L 84 36 L 0 36 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
    ],
  },
  {
    id: 'armchair',
    name: 'Armchair',
    category: 'living',
    widthIn: 32,
    depthIn: 34,
    heightIn: 34,
    color: '#86efac',
    color3D: '#4ade80',
    svgPaths: [
      // Back
      { d: 'M 2 0 L 30 0 L 30 8 L 2 8 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      // Seat
      { d: 'M 4 8 L 28 8 L 28 28 L 4 28 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.5 },
      // Arms
      { d: 'M 0 0 L 4 0 L 4 32 L 0 32 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      { d: 'M 28 0 L 32 0 L 32 32 L 28 32 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
      // Front
      { d: 'M 0 28 L 32 28 L 32 34 L 0 34 Z', fill: '#bbf7d0', stroke: '#22c55e', strokeWidth: 0.8 },
    ],
  },
  {
    id: 'coffee-table',
    name: 'Coffee Table',
    category: 'living',
    widthIn: 48,
    depthIn: 24,
    heightIn: 18,
    color: '#86efac',
    color3D: '#4ade80',
    svgPaths: [
      // Table top
      { d: 'M 1 1 Q 1 0 2 0 L 46 0 Q 47 0 47 1 L 47 23 Q 47 24 46 24 L 2 24 Q 1 24 1 23 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.8 },
      // Legs
      { d: 'M 3 2 L 5 2 L 5 4 L 3 4 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 43 2 L 45 2 L 45 4 L 43 4 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 3 20 L 5 20 L 5 22 L 3 22 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 43 20 L 45 20 L 45 22 L 43 22 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'dining-table',
    name: 'Dining Table',
    category: 'living',
    widthIn: 60,
    depthIn: 36,
    heightIn: 30,
    color: '#86efac',
    color3D: '#4ade80',
    svgPaths: [
      // Table top
      { d: 'M 2 1 Q 2 0 3 0 L 57 0 Q 58 0 58 1 L 58 35 Q 58 36 57 36 L 3 36 Q 2 36 2 35 Z', fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 0.8 },
      // Legs
      { d: 'M 4 3 L 7 3 L 7 6 L 4 6 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 53 3 L 56 3 L 56 6 L 53 6 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 4 30 L 7 30 L 7 33 L 4 33 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
      { d: 'M 53 30 L 56 30 L 56 33 L 53 33 Z', fill: '#86efac', stroke: '#22c55e', strokeWidth: 0.4 },
    ],
  },

  // ══════════════════════════════════════════════
  // MISC / UTILITY
  // ══════════════════════════════════════════════
  {
    id: 'washer',
    name: 'Washer',
    category: 'misc',
    widthIn: 27,
    depthIn: 27,
    heightIn: 38,
    color: '#d4d4d8',
    color3D: '#a1a1aa',
    svgPaths: [
      // Body
      { d: 'M 0 0 L 27 0 L 27 27 L 0 27 Z', fill: '#f4f4f5', stroke: '#71717a', strokeWidth: 0.8 },
      // Door circle
      { d: 'M 13.5 15 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0', fill: '#e4e4e7', stroke: '#a1a1aa', strokeWidth: 0.6 },
      // Inner drum circle
      { d: 'M 13.5 15 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0', fill: '#fafafa', stroke: '#d4d4d8', strokeWidth: 0.4 },
      // Control panel
      { d: 'M 2 0 L 25 0 L 25 5 L 2 5 Z', fill: '#e4e4e7', stroke: '#a1a1aa', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'dryer',
    name: 'Dryer',
    category: 'misc',
    widthIn: 27,
    depthIn: 27,
    heightIn: 38,
    color: '#d4d4d8',
    color3D: '#a1a1aa',
    svgPaths: [
      // Body
      { d: 'M 0 0 L 27 0 L 27 27 L 0 27 Z', fill: '#f4f4f5', stroke: '#71717a', strokeWidth: 0.8 },
      // Door circle
      { d: 'M 13.5 15 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0', fill: '#e4e4e7', stroke: '#a1a1aa', strokeWidth: 0.6 },
      // Vent pattern lines
      { d: 'M 10 12 L 17 12', fill: 'none', stroke: '#d4d4d8', strokeWidth: 0.4 },
      { d: 'M 10 15 L 17 15', fill: 'none', stroke: '#d4d4d8', strokeWidth: 0.4 },
      { d: 'M 10 18 L 17 18', fill: 'none', stroke: '#d4d4d8', strokeWidth: 0.4 },
      // Control panel
      { d: 'M 2 0 L 25 0 L 25 5 L 2 5 Z', fill: '#e4e4e7', stroke: '#a1a1aa', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'water-heater',
    name: 'Water Heater',
    category: 'misc',
    widthIn: 22,
    depthIn: 22,
    heightIn: 60,
    color: '#d4d4d8',
    color3D: '#a1a1aa',
    svgPaths: [
      // Circular body (top-down)
      { d: 'M 11 0 C 17 0 22 5 22 11 C 22 17 17 22 11 22 C 5 22 0 17 0 11 C 0 5 5 0 11 0 Z', fill: '#f4f4f5', stroke: '#71717a', strokeWidth: 0.8 },
      // Inner circle
      { d: 'M 11 3 C 15 3 19 7 19 11 C 19 15 15 19 11 19 C 7 19 3 15 3 11 C 3 7 7 3 11 3 Z', fill: '#e4e4e7', stroke: '#a1a1aa', strokeWidth: 0.5 },
      // Center dot
      { d: 'M 11 11 m -1.5 0 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0', fill: '#71717a', stroke: 'none' },
    ],
  },
];

// Helper: get all categories
export const SYMBOL_CATEGORIES = ['bathroom', 'kitchen', 'bedroom', 'living', 'misc'] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  bathroom: '🚿 Bathroom',
  kitchen: '🍳 Kitchen',
  bedroom: '🛏️ Bedroom',
  living: '🛋️ Living',
  misc: '⚙️ Utility',
};

export const CATEGORY_COLORS: Record<string, string> = {
  bathroom: '#3b82f6',
  kitchen: '#f59e0b',
  bedroom: '#8b5cf6',
  living: '#22c55e',
  misc: '#71717a',
  custom: '#6366f1',
};

export function getSymbolById(id: string): SymbolDefinition | undefined {
  return SYMBOL_CATALOG.find(s => s.id === id);
}
