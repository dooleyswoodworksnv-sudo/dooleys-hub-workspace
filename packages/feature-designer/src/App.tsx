import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, Settings, Code, Home, DoorOpen, AppWindow, Plus, Trash2, Hammer, LayoutGrid, Magnet, Eye, Camera, Undo2, Redo2, ChevronDown, ChevronRight, ChevronLeft, Construction, Triangle, FileText, Upload, Move, RotateCw, Layers, Ruler, Lock, Unlock, Save, FolderOpen, Calculator, Globe, Cloud, Sun, Moon } from 'lucide-react';
import Preview2D from './components/Preview2D';
import Preview3D from './components/Preview3D';
import { SYMBOL_CATALOG, SYMBOL_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, getSymbolById } from './components/SymbolCatalog';
import MaterialsEstimate from './components/MaterialsEstimate';
import AssetLibrary from './components/assets/AssetLibrary';
import { Box } from 'lucide-react';
import { convertPDFToImages } from './services/pdfService';
import { generateSketchUpCode, GenerationSection } from './utils/sketchupGenerator';
import { analyzeBlueprint } from './services/aiService';
import { detectBays, formatBayDimensions } from './utils/bayDetection';
import { Loader2, Sparkles, Link2, Unlink } from 'lucide-react';
import { sanitize } from './utils/math';
import { computeEstimate } from './utils/computeEstimate';
import { AssetManager } from './components/AssetManager';

export interface BumpoutConfig {
  id: string;
  wall: number;
  xFt: number;
  xInches: number;
  yFt?: number;
  yInches?: number;
  widthIn: number;
  depthIn: number;
  floorIndex?: number;
}

export interface Guide {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  distanceIn: number;
}

export interface SnapPoint {
  pos: number;
  crossPos?: number;
  type: 'end' | 'mid';
}

export interface DoorConfig {
  id: string;
  wall: number;
  xFt: number;
  xInches: number;
  yFt?: number;
  yInches?: number;
  widthIn: number;
  heightIn: number;
  floorIndex?: number;
  modelUrl?: string;
  modelFileName?: string;
}

export interface WindowConfig {
  id: string;
  wall: number;
  xFt: number;
  xInches: number;
  yFt?: number;
  yInches?: number;
  widthIn: number;
  heightIn: number;
  sillHeightIn: number;
  floorIndex?: number;
  modelUrl?: string;
  modelFileName?: string;
}

export interface InteriorWallConfig {
  id: number;
  orientation: 'horizontal' | 'vertical';
  xFt: number;
  xInches: number;
  yFt: number;
  yInches: number;
  lengthFt: number;
  lengthInches: number;
  thicknessIn: number;
  floorIndex?: number;
}

export interface ExteriorWallConfig {
  id: number;
  orientation: 'horizontal' | 'vertical';
  xFt: number;
  xInches: number;
  yFt: number;
  yInches: number;
  lengthFt: number;
  lengthInches: number;
  thicknessIn: number;
  exteriorSide: 1 | -1;
  floorIndex?: number;
}

export interface CustomCostItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

export type RoofFinish = 'none' | 'asphalt-3tab' | 'architectural-shingles' | 'metal-standing-seam' | 'clay-tile' | 'slate' | 'wood-shakes' | 'tpo-membrane' | 'roof-paint';
export type InteriorFinish = 'none' | 'paint-standard' | 'paint-premium' | 'wallpaper' | 'tile' | 'wood-paneling' | 'wainscoting';
export type FoundationFinish = 'none' | 'paint' | 'waterproof-coating' | 'stucco-parging' | 'stone-veneer';

export interface MaterialCosts {
  stud: number;
  plate: number;
  sheathing: number;
  drywall: number;
  insulation: number;
  concrete: number;
  joist: number;
  joistPerLF2x6: number;
  joistPerLF2x8: number;
  joistPerLF2x10: number;
  joistPerLF2x12: number;
  subfloor: number;
  door: number;
  window: number;
  truss: number;
  roofSheathing: number;
  lumber: number;
  rebar: number;
  nails: number;
  hurricaneTies: number;
  anchorBolts: number;
  joistHangers: number;
  adhesive: number;
  roofUnderlayment: number;
  houseWrap: number;
  header: number;
  woodSiding: number;
  vinylSiding: number;
  hardieBoard: number;
  brick: number;
  stucco: number;
  // Roof finishes
  asphalt3Tab: number;
  architecturalShingles: number;
  metalStandingSeam: number;
  clayTile: number;
  slateTile: number;
  woodShakes: number;
  tpoMembrane: number;
  roofPaint: number;
  // Interior finishes
  paintStandard: number;
  paintPremium: number;
  wallpaper: number;
  interiorTile: number;
  woodPaneling: number;
  wainscoting: number;
  // Foundation finishes
  foundationPaint: number;
  waterproofCoating: number;
  stuccoParging: number;
  stoneVeneer: number;
}

export const DEFAULT_MATERIAL_COSTS: MaterialCosts = {
  stud: 4.50,
  plate: 4.50,
  sheathing: 25.00,
  drywall: 15.00,
  insulation: 30.00,
  concrete: 150.00,
  joist: 12.00,
  joistPerLF2x6: 0.65,
  joistPerLF2x8: 1.00,
  joistPerLF2x10: 1.40,
  joistPerLF2x12: 1.85,
  subfloor: 35.00,
  door: 200.00,
  window: 300.00,
  truss: 150.00,
  roofSheathing: 25.00,
  lumber: 5.00,
  rebar: 10.00,
  nails: 45.00,
  hurricaneTies: 1.50,
  anchorBolts: 2.50,
  joistHangers: 2.00,
  adhesive: 6.00,
  roofUnderlayment: 45.00,
  houseWrap: 150.00,
  header: 15.00,
  woodSiding: 3.50,
  vinylSiding: 2.00,
  hardieBoard: 4.50,
  brick: 8.00,
  stucco: 6.00,
  // Roof finishes (per sq ft — Nevada market rates)
  asphalt3Tab: 4.00,
  architecturalShingles: 5.50,
  metalStandingSeam: 10.00,
  clayTile: 12.00,
  slateTile: 18.00,
  woodShakes: 9.00,
  tpoMembrane: 7.00,
  roofPaint: 2.50,
  // Interior finishes (per sq ft)
  paintStandard: 1.75,
  paintPremium: 3.00,
  wallpaper: 3.50,
  interiorTile: 10.00,
  woodPaneling: 6.00,
  wainscoting: 14.00,
  // Foundation finishes (per sq ft)
  foundationPaint: 2.00,
  waterproofCoating: 3.00,
  stuccoParging: 5.00,
  stoneVeneer: 18.00
};

export interface InteriorAsset {
  id: string;
  type: string;
  category: 'kitchen' | 'bathroom' | 'furniture' | 'bedroom' | 'living' | 'misc';
  name: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  floorIndex: number;
  widthIn?: number;
  depthIn?: number;
  heightIn?: number;
  modelUrl?: string;
  modelFileName?: string;
}

export interface RoofPart {
  id: string;
  type: 'gable' | 'hip' | 'shed' | 'flat';
  pitch: number;
  widthIn: number;
  lengthIn: number;
  ridgeDirection: 'horizontal' | 'vertical';
  x: number;
  y: number;
}

export interface DormerConfig {
  id: string;
  x: number;
  y: number;
  widthIn: number;
  depthIn: number;
  rotation: number;
  pitch: number;
  overhangIn: number;
  fasciaIn: number;
  wallHeightIn: number;
  // Legacy single-window properties
  hasWindow?: boolean;
  windowWidthIn?: number;
  windowHeightIn?: number;
  windowSillHeightIn?: number;
}

export interface CustomCamera {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  floorIndex?: number;
}

export type RoofEdgeType = 'hip' | 'gable' | 'valley' | 'wall' | 'auto';

export interface TrussConfig {
  id: string;
  x: number;
  y: number;
  rotation: number;
  type: string;
  customScript?: string;
  hasPlywood?: boolean;
  spanFt: number;
  pitch: number;
  lengthFt: number;
  spacingIn: number;
  overhangIn: number;
  heelHeightIn: number;
  plies: number;
  ridgeRatio?: number;
  fasciaIn?: number;
  // Roof style for Solid Shells (hip/gable/shed/flat)
  roofStyle?: 'gable' | 'hip' | 'shed' | 'flat';
  // Per-edge type overrides (hip end, gable end, valley, wall flush)
  edgeOverrides?: {
    north?: RoofEdgeType;
    south?: RoofEdgeType;
    east?: RoofEdgeType;
    west?: RoofEdgeType;
  };
  // Explicit ridge height override in inches (auto-calculated from pitch if omitted)
  ridgeHeightIn?: number;
  // Which roof group this shell belongs to
  groupId?: string;
  // Per-corner offsets for custom shapes (modifier key mode)
  // Each corner stores dx,dy offset from its default rectangular position
  customCorners?: {
    nw: { dx: number; dy: number };
    ne: { dx: number; dy: number };
    sw: { dx: number; dy: number };
    se: { dx: number; dy: number };
  };
}

export interface RoofGroup {
  id: string;
  name: string;
  shellIds: string[];
  autoIntersect: boolean;
}

export interface AppState {
  shape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom';
  widthFt: number;
  widthInches: number;
  lengthFt: number;
  lengthInches: number;
  lRightDepthFt: number;
  lRightDepthInches: number;
  lBackWidthFt: number;
  lBackWidthInches: number;
  hLeftBarWidthFt: number;
  hLeftBarWidthInches: number;
  hRightBarWidthFt: number;
  hRightBarWidthInches: number;
  hMiddleBarHeightFt: number;
  hMiddleBarHeightInches: number;
  hMiddleBarOffsetFt: number;
  hMiddleBarOffsetInches: number;
  tTopWidthFt: number;
  tTopWidthInches: number;
  tTopLengthFt: number;
  tTopLengthInches: number;
  tStemWidthFt: number;
  tStemWidthInches: number;
  tStemLengthFt: number;
  tStemLengthInches: number;
  uWalls: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number; w7: number; w8: number };
  uWallsInches: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number; w7: number; w8: number };
  uDirection: 'back' | 'front' | 'left' | 'right';
  lDirection: 'front-left' | 'front-right' | 'back-right' | 'back-left';
  wallHeightFt: number;
  wallHeightInches: number;
  wallThicknessIn: number;
  bumpouts: BumpoutConfig[];
  doors: DoorConfig[];
  windows: WindowConfig[];
  interiorWalls: InteriorWallConfig[];
  exteriorWalls: ExteriorWallConfig[];
  assets: InteriorAsset[];
  roofParts: RoofPart[];
  trussRuns: TrussConfig[];
  dormers: DormerConfig[];
  customCameras: CustomCamera[];
  studSpacing: number;
  studThickness: number;
  headerType: 'single' | 'double' | 'lvl';
  headerHeight: number;
  bottomPlates: number;
  topPlates: number;
  doorRoAllowance: number;
  windowRoAllowance: number;
  openingHeaderHeightIn: number;
  addSheathing: boolean;
  sheathingThickness: number;
  addInsulation: boolean;
  insulationThickness: number;
  addDrywall: boolean;
  drywallThickness: number;
  wallFinishes: Record<number, 'none' | 'wood-siding' | 'vinyl-siding' | 'hardie-board' | 'brick' | 'stucco'>;
  roofFinish: RoofFinish;
  interiorFinish: InteriorFinish;
  foundationFinish: FoundationFinish;
  generationSection: GenerationSection;
  // PDF Reference
  pdfImages: string[];
  selectedPdfIndex: number;
  selectedRoofPartId: string | null;
  pdfScale: number;
  pdfOffset: { x: number; y: number };
  pdfRotation: number;
  pdfOpacity: number;
  isBlueprintLocked: boolean;
  pdfCalibration: { p1: { x: number; y: number } | null; p2: { x: number; y: number } | null; realLengthIn: number };
  // Foundation
  foundationType: 'none' | 'slab' | 'slab-on-grade' | 'stem-wall';
  slabThicknessIn: number;
  thickenedEdgeDepthIn: number;
  stemWallHeightIn: number;
  stemWallThicknessIn: number;
  footingWidthIn: number;
  footingThicknessIn: number;
  foundationShape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom';
  // Floor Framing
  addFloorFraming: boolean;
  joistSpacing: number;
  joistSize: '2x6' | '2x8' | '2x10' | '2x12';
  joistDirection: 'x' | 'y';
  floorBays: import('./utils/bayDetection').FloorBay[];
  addSubfloor: boolean;
  subfloorThickness: number;
  subfloorMaterial: 'plywood' | 'osb';
  rimJoistThickness: number;
  generateDimensions: boolean;
  solidWallsOnly: boolean;
  noFramingFloorOnly: boolean;
  enableGirderSystem: boolean;
  girderSpanThresholdFt: number;
  girderPostSpacingFt: number;
  girderSize: '2-2x10' | '3-2x10' | '4-2x10' | '6x6' | '6x8';
  girderPostSize: '4x4' | '6x6';
  girderPierSize: '12" Round' | '16" Square';
  addPocketBeams: boolean;
  pocketBeamsOnlyAtGirderEnds: boolean;
  // 3D Environment
  showGround: boolean;
  showSky: boolean;
  showSun: boolean;
  sunHour: number;
  sunMonth: number;
  siteLatitude: number;
  hdriPreset: string;
  customHdriUrl: string;
  // Roof Framing
  roofType: 'gable' | 'hip' | 'shed' | 'flat';
  roofPitch: number;
  roofOverhangIn: number;
  trussSpacing: number;
  trussType: 'standard' | 'scissor' | 'vaulted';
  customTrussScript?: string;
  roofSheathingThickness: number;
  roofWidthIn: number;
  roofHeightIn: number;
  // Multi-story
  additionalStories: number;
  currentFloorIndex: number;
  upperFloorWallHeightFt: number;
  upperFloorWallHeightIn: number;
  upperFloorJoistSize: '2x6' | '2x8' | '2x10' | '2x12';
  combinedBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  shapeBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  materialCosts: MaterialCosts;
  roofGroups: RoofGroup[];
  // Per-surface painted materials — tracks texture URL, area in sq ft, and detected finish type
  paintedSurfaces: Record<string, { url: string; areaSqFt: number; finishType: string }>;
  customCostItems: CustomCostItem[];
}

const DEFAULT_APP_STATE: AppState = {
  shape: 'rectangle',
  widthFt: 20,
  widthInches: 0,
  lengthFt: 40,
  lengthInches: 0,
  lRightDepthFt: 0,
  lRightDepthInches: 0,
  lBackWidthFt: 0,
  lBackWidthInches: 0,
  hLeftBarWidthFt: 0,
  hLeftBarWidthInches: 0,
  hRightBarWidthFt: 0,
  hRightBarWidthInches: 0,
  hMiddleBarHeightFt: 0,
  hMiddleBarHeightInches: 0,
  hMiddleBarOffsetFt: 0,
  hMiddleBarOffsetInches: 0,
  tTopWidthFt: 0,
  tTopWidthInches: 0,
  tTopLengthFt: 0,
  tTopLengthInches: 0,
  tStemWidthFt: 0,
  tStemWidthInches: 0,
  tStemLengthFt: 0,
  tStemLengthInches: 0,
  uWalls: { w1: 30, w2: 40, w3: 10, w4: 20, w5: 10, w6: 20, w7: 10, w8: 40 },
  uWallsInches: { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, w8: 0 },
  uDirection: 'back',
  lDirection: 'front-left',
  wallHeightFt: 8,
  wallHeightInches: 0,
  wallThicknessIn: 5.5,
  bumpouts: [],
  doors: [],
  windows: [],
  interiorWalls: [],
  exteriorWalls: [],
  assets: [],
  roofParts: [],
  trussRuns: [],
  dormers: [],
  customCameras: [],
  studSpacing: 16,
  studThickness: 1.5,
  headerType: 'double',
  headerHeight: 80,
  bottomPlates: 1,
  topPlates: 2,
  doorRoAllowance: 2,
  windowRoAllowance: 2,
  openingHeaderHeightIn: 82,
  addSheathing: true,
  sheathingThickness: 0.5,
  addInsulation: true,
  insulationThickness: 3.5,
  addDrywall: true,
  drywallThickness: 0.5,
  wallFinishes: {},
  paintedSurfaces: {},
  roofFinish: 'none' as RoofFinish,
  interiorFinish: 'none' as InteriorFinish,
  foundationFinish: 'none' as FoundationFinish,
  generationSection: 'all',
  pdfImages: [],
  selectedPdfIndex: 0,
  pdfScale: 1,
  pdfOffset: { x: 0, y: 0 },
  pdfRotation: 0,
  pdfOpacity: 0.5,
  isBlueprintLocked: false,
  pdfCalibration: { p1: null, p2: null, realLengthIn: 0 },
  foundationType: 'slab',
  slabThicknessIn: 4,
  thickenedEdgeDepthIn: 12,
  stemWallHeightIn: 0,
  stemWallThicknessIn: 0,
  footingWidthIn: 0,
  footingThicknessIn: 0,
  foundationShape: 'rectangle',
  addFloorFraming: false,
  joistSpacing: 16,
  joistSize: '2x10',
  joistDirection: 'x',
  floorBays: [],
  addSubfloor: false,
  subfloorThickness: 0.75,
  subfloorMaterial: 'plywood',
  rimJoistThickness: 1.5,
  generateDimensions: true,
  solidWallsOnly: false,
  noFramingFloorOnly: true,
  enableGirderSystem: false,
  girderSpanThresholdFt: 12,
  girderPostSpacingFt: 8,
  girderSize: '3-2x10',
  girderPostSize: '6x6',
  girderPierSize: '12" Round',
  addPocketBeams: true,
  pocketBeamsOnlyAtGirderEnds: false,
  showGround: true,
  showSky: true,
  showSun: true,
  sunHour: 14,
  sunMonth: 6,
  siteLatitude: 39.5,
  hdriPreset: 'city',
  customHdriUrl: '',
  additionalStories: 0,
  currentFloorIndex: 0,
  upperFloorWallHeightFt: 8,
  upperFloorWallHeightIn: 0,
  upperFloorJoistSize: '2x10',
  combinedBlocks: [],
  shapeBlocks: [],
  materialCosts: {
    stud: 4.50,
    plate: 4.50,
    sheathing: 25.00,
    drywall: 15.00,
    insulation: 30.00,
    concrete: 150.00,
    joist: 12.00,
    joistPerLF2x6: 0.65,
    joistPerLF2x8: 1.00,
    joistPerLF2x10: 1.40,
    joistPerLF2x12: 1.85,
    subfloor: 35.00,
    door: 200.00,
    window: 300.00,
    truss: 150.00,
    roofSheathing: 25.00,
    lumber: 5.00,
    rebar: 10.00,
    nails: 45.00,
    hurricaneTies: 1.50,
    anchorBolts: 2.50,
    joistHangers: 2.00,
    adhesive: 6.00,
    roofUnderlayment: 45.00,
    houseWrap: 150.00,
    header: 15.00,
    woodSiding: 3.50,
    vinylSiding: 2.00,
    hardieBoard: 4.50,
    brick: 8.00,
    stucco: 6.00,
    asphalt3Tab: 4.00,
    architecturalShingles: 5.50,
    metalStandingSeam: 10.00,
    clayTile: 12.00,
    slateTile: 18.00,
    woodShakes: 9.00,
    tpoMembrane: 7.00,
    roofPaint: 2.50,
    paintStandard: 1.75,
    paintPremium: 3.00,
    wallpaper: 3.50,
    interiorTile: 10.00,
    woodPaneling: 6.00,
    wainscoting: 14.00,
    foundationPaint: 2.00,
    waterproofCoating: 3.00,
    stuccoParging: 5.00,
    stoneVeneer: 18.00
  },
  roofType: 'gable',
  roofPitch: 4,
  roofOverhangIn: 12,
  trussSpacing: 24,
  trussType: 'standard',
  customTrussScript: '',
  roofSheathingThickness: 0.5,
  roofWidthIn: 240,
  roofHeightIn: 120,
  selectedRoofPartId: null,
  roofGroups: [],
  customCostItems: []
};

interface ProjectIdentity {
  id: string;
  name: string;
  projectNumber: string;
  createdAt: string;
  budget?: number;
  area?: number;
}

interface AppProps {
  onDesignChange?: (payload: import('./index').DesignerBridgePayload) => void;
  currentProject?: ProjectIdentity | null;
  setCurrentProject?: (project: ProjectIdentity | null) => void;
  /** All blueprint page images from the Blueprint Reader, auto-loaded into reference panel */
  blueprintImageUrls?: string[] | null;
  initialState?: any;
  /** Unified save — provided by Hub wrapper to save the entire project bundle */
  hubSaveToFile?: () => Promise<void>;
  /** Unified load — provided by Hub wrapper to load an entire project bundle */
  hubLoadFromFile?: (file?: File) => Promise<void>;
}

const splitInches = (val: number) => {
  const ft = Math.trunc(val / 12);
  const inches = Math.round(val % 12);
  return { ft, inches };
};

export default function App({ onDesignChange, currentProject, setCurrentProject, blueprintImageUrls, initialState, hubSaveToFile, hubLoadFromFile }: AppProps = {}) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dbs-dark-mode');
      if (saved !== null) return saved === 'true';
    }
    // Default to dark to match the Construction Hub theme
    return true;
  });

  // Sync dark class on <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('dbs-dark-mode', String(darkMode));
  }, [darkMode]);

  const [showPluginModal, setShowPluginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | '3d' | 'code'>('preview');
  const [generationSection, setGenerationSection] = useState<GenerationSection>('all');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    foundation: false,
    walls: false,
    roof: false,
    pdf: false,
    materials: false,
    threeD: false,
    assets: false,
    cameras: false
  });
  const [activeWallSection, setActiveWallSection] = useState<string | null>(null);
  const [assets, setAssets] = useState<InteriorAsset[]>([]);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const isOpen = prev[section];
      if (isOpen) {
        return { ...prev, [section]: false };
      }
      // Close all others and open the selected one
      return {
        foundation: section === 'foundation',
        walls: section === 'walls',
        roof: section === 'roof',
        pdf: section === 'pdf',
        materials: section === 'materials',
        threeD: section === 'threeD',
        assets: section === 'assets',
        cameras: section === 'cameras'
      };
    });
  };
  // Shell Dimensions
  const [shape, setShape] = useState<'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom'>('rectangle');
  const [widthFt, setWidthFt] = useState<number>(20);
  const [widthInches, setWidthInches] = useState<number>(0);
  const [lengthFt, setLengthFt] = useState<number>(40);
  const [lengthInches, setLengthInches] = useState<number>(0);
  const [lRightDepthFt, setLRightDepthFt] = useState<number>(20);
  const [lRightDepthInches, setLRightDepthInches] = useState<number>(0);
  const [lBackWidthFt, setLBackWidthFt] = useState<number>(15);
  const [lBackWidthInches, setLBackWidthInches] = useState<number>(0);

  // H-Shape
  const [hLeftBarWidthFt, setHLeftBarWidthFt] = useState<number>(10);
  const [hLeftBarWidthInches, setHLeftBarWidthInches] = useState<number>(0);
  const [hRightBarWidthFt, setHRightBarWidthFt] = useState<number>(10);
  const [hRightBarWidthInches, setHRightBarWidthInches] = useState<number>(0);
  const [hMiddleBarHeightFt, setHMiddleBarHeightFt] = useState<number>(10);
  const [hMiddleBarHeightInches, setHMiddleBarHeightInches] = useState<number>(0);
  const [hMiddleBarOffsetFt, setHMiddleBarOffsetFt] = useState<number>(15);
  const [hMiddleBarOffsetInches, setHMiddleBarOffsetInches] = useState<number>(0);

  // T-Shape
  const [tTopWidthFt, setTTopWidthFt] = useState<number>(30);
  const [tTopWidthInches, setTTopWidthInches] = useState<number>(0);
  const [tTopLengthFt, setTTopLengthFt] = useState<number>(10);
  const [tTopLengthInches, setTTopLengthInches] = useState<number>(0);
  const [tStemWidthFt, setTStemWidthFt] = useState<number>(10);
  const [tStemWidthInches, setTStemWidthInches] = useState<number>(0);
  const [tStemLengthFt, setTStemLengthFt] = useState<number>(20);
  const [tStemLengthInches, setTStemLengthInches] = useState<number>(0);

  const [uWalls, setUWalls] = useState({
    w1: 30, w2: 40, w3: 10, w4: 20, w5: 10, w6: 20, w7: 10, w8: 40
  });
  const [uWallsInches, setUWallsInches] = useState({
    w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, w8: 0
  });
  const [uDirection, setUDirection] = useState<'back' | 'front' | 'left' | 'right'>('back');
  const [lDirection, setLDirection] = useState<'front-left' | 'front-right' | 'back-right' | 'back-left'>('front-left');
  const [wallHeightFt, setWallHeightFt] = useState<number>(8);
  const [wallHeightInches, setWallHeightInches] = useState<number>(0);
  const [wallThicknessIn, setWallThicknessIn] = useState<number>(6);
  const [generateDimensions, setGenerateDimensions] = useState<boolean>(true);
  const [solidWallsOnly, setSolidWallsOnly] = useState<boolean>(false);
  const [noFramingFloorOnly, setNoFramingFloorOnly] = useState<boolean>(true);
  
  // Multi-story
  const [additionalStories, setAdditionalStories] = useState<number>(0);
  const [currentFloorIndex, setCurrentFloorIndex] = useState<number>(0);
  const [upperFloorWallHeightFt, setUpperFloorWallHeightFt] = useState<number>(8);
  const [upperFloorWallHeightIn, setUpperFloorWallHeightIn] = useState<number>(0);
  const [upperFloorJoistSize, setUpperFloorJoistSize] = useState<'2x6' | '2x8' | '2x10' | '2x12'>('2x10');

  // Materials
  const [materialCosts, setMaterialCosts] = useState<MaterialCosts>(DEFAULT_MATERIAL_COSTS);
  const [customCostItems, setCustomCostItems] = useState<CustomCostItem[]>([]);

  // Foundation
  const [foundationType, setFoundationType] = useState<'none' | 'slab' | 'slab-on-grade' | 'stem-wall'>('stem-wall');
  const [stemWallHeightIn, setStemWallHeightIn] = useState<number>(24);
  const [stemWallThicknessIn, setStemWallThicknessIn] = useState<number>(8);
  const [slabThicknessIn, setSlabThicknessIn] = useState<number>(4);
  const [thickenedEdgeDepthIn, setThickenedEdgeDepthIn] = useState<number>(12);
  const [footingWidthIn, setFootingWidthIn] = useState<number>(16);
  const [footingThicknessIn, setFootingThicknessIn] = useState<number>(8);
  const [foundationShape, setFoundationShape] = useState<'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom'>('rectangle');

  useEffect(() => {
    if (isRestoring.current) return;
    setFoundationShape(shape);
    setFloorBays([]); // Clear per-bay data when shape changes
  }, [shape]);

  // Clear per-bay data when building dimensions change (bay coordinates become stale)
  useEffect(() => {
    if (isRestoring.current) return;
    setFloorBays([]);
  }, [widthFt, widthInches, lengthFt, lengthInches, lRightDepthFt, lRightDepthInches, lBackWidthFt, lBackWidthInches]);

  // Bumpouts
  const [bumpouts, setBumpouts] = useState<BumpoutConfig[]>([]);

  // Door Placement (Multiple)
  const [doors, setDoors] = useState<DoorConfig[]>([]);

  // Window Placement (Multiple)
  const [windows, setWindows] = useState<WindowConfig[]>([]);

  // Interior Walls
  const [interiorWalls, setInteriorWalls] = useState<InteriorWallConfig[]>([]);
  const [expandedWallId, setExpandedWallId] = useState<number | null>(null);

  // Custom Exterior Walls
  const [exteriorWalls, setExteriorWalls] = useState<ExteriorWallConfig[]>([]);
  const [expandedExtWallId, setExpandedExtWallId] = useState<number | null>(null);

  // Shape Blocks for combining
  const [shapeBlocks, setShapeBlocks] = useState<{ id: string, x: number, y: number, w: number, h: number }[]>([]);
  const [combinedBlocks, setCombinedBlocks] = useState<{ id: string, x: number, y: number, w: number, h: number }[]>([]);

  // Framing Options
  const [studSpacing, setStudSpacing] = useState<number>(16);
  const [studThickness, setStudThickness] = useState<number>(1.5);
  const [headerType, setHeaderType] = useState<'single' | 'double' | 'lvl'>('double');
  const [headerHeight, setHeaderHeight] = useState<number>(5.5);
  const [bottomPlates, setBottomPlates] = useState<number>(1);
  const [topPlates, setTopPlates] = useState<number>(2);
  const [doorRoAllowance, setDoorRoAllowance] = useState<number>(2);
  const [windowRoAllowance, setWindowRoAllowance] = useState<number>(0);
  const [openingHeaderHeightIn, setOpeningHeaderHeightIn] = useState<number>(80);
  const [addSheathing, setAddSheathing] = useState<boolean>(true);
  const [sheathingThickness, setSheathingThickness] = useState<number>(0.5);
  const [addInsulation, setAddInsulation] = useState<boolean>(true);
  const [insulationThickness, setInsulationThickness] = useState<number>(3.5);
  const [addDrywall, setAddDrywall] = useState<boolean>(true);
  const [drywallThickness, setDrywallThickness] = useState<number>(0.5);
  const [wallFinishes, setWallFinishes] = useState<Record<number, 'none' | 'wood-siding' | 'vinyl-siding' | 'hardie-board' | 'brick' | 'stucco'>>({});
  const [paintedSurfaces, setPaintedSurfaces] = useState<Record<string, { url: string; areaSqFt: number; finishType: string }>>({});
  const [roofFinish, setRoofFinish] = useState<RoofFinish>('none');
  const [interiorFinish, setInteriorFinish] = useState<InteriorFinish>('none');
  const [foundationFinish, setFoundationFinish] = useState<FoundationFinish>('none');

  // PDF Reference State
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [selectedPdfIndex, setSelectedPdfIndex] = useState<number>(0);
  const [selectedRoofPartId, setSelectedRoofPartId] = useState<string | null>(null);
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [pdfOffset, setPdfOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pdfRotation, setPdfRotation] = useState<number>(0);
  const [pdfOpacity, setPdfOpacity] = useState<number>(0.5);
  const [isBlueprintLocked, setIsBlueprintLocked] = useState<boolean>(false);
  const [pdfCalibration, setPdfCalibration] = useState<{ p1: { x: number; y: number } | null; p2: { x: number; y: number } | null; realLengthIn: number }>({
    p1: null,
    p2: null,
    realLengthIn: 0
  });
  const [appliedCalibration, setAppliedCalibration] = useState<{ p1: { x: number; y: number }; p2: { x: number; y: number }; realLengthIn: number } | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProjectLoading, setIsProjectLoading] = useState<boolean>(false);
  const [calibrationLength, setCalibrationLength] = useState<string>("");
  const [guides, setGuides] = useState<Guide[]>([]);

  // ── Bridge: auto-load all blueprint pages from Blueprint Reader ──
  const lastBlueprintCountRef = useRef<number>(0);
  useEffect(() => {
    if (
      blueprintImageUrls &&
      blueprintImageUrls.length > 0 &&
      blueprintImageUrls.length !== lastBlueprintCountRef.current &&
      pdfImages.length === 0 // Only auto-load if no blueprint is already loaded
    ) {
      lastBlueprintCountRef.current = blueprintImageUrls.length;
      setPdfImages(blueprintImageUrls);
      setSelectedPdfIndex(0);
    }
  }, [blueprintImageUrls]);

  // 3D Environment Options
  const [showGround, setShowGround] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showSky, setShowSky] = useState<boolean>(true);
  const [showSun, setShowSun] = useState<boolean>(true);
  const [sunHour, setSunHour] = useState<number>(14);
  const [sunMonth, setSunMonth] = useState<number>(6);
  const [siteLatitude, setSiteLatitude] = useState<number>(39.5);
  const [hdriPreset, setHdriPreset] = useState<string>('city');
  const [customHdriUrl, setCustomHdriUrl] = useState<string>('');
  const [hdriFiles, setHdriFiles] = useState<{name: string; url: string; size: number}[]>([]);
  const [hdriUploading, setHdriUploading] = useState(false);
  const [showRoof, setShowRoof] = useState<boolean>(true);

  // Roof Framing
  const [roofType, setRoofType] = useState<'gable' | 'hip' | 'shed' | 'flat'>('gable');
  const [roofParts, setRoofParts] = useState<RoofPart[]>([]);
  const [trussRuns, setTrussRuns] = useState<TrussConfig[]>([]);
  const [roofGroups, setRoofGroups] = useState<RoofGroup[]>([]);
  const [selectedTrussRunId, setSelectedTrussRunId] = useState<string | null>(null);
  
  // Dormers
  const [dormers, setDormers] = useState<DormerConfig[]>([]);
  const [selectedDormerId, setSelectedDormerId] = useState<string | null>(null);
  const [currentDormerWidthFt, setCurrentDormerWidthFt] = useState<number>(5);
  const [currentDormerWidthIn, setCurrentDormerWidthIn] = useState<number>(0);
  const [currentDormerDepthFt, setCurrentDormerDepthFt] = useState<number>(5);
  const [currentDormerDepthIn, setCurrentDormerDepthIn] = useState<number>(0);
  const [currentDormerPitch, setCurrentDormerPitch] = useState<number>(6);
  const [currentDormerOverhangIn, setCurrentDormerOverhangIn] = useState<number>(18);
  const [currentDormerFasciaIn, setCurrentDormerFasciaIn] = useState<number>(6);
  const [currentDormerWallHeightIn, setCurrentDormerWallHeightIn] = useState<number>(48);

  // Custom Cameras
  const [customCameras, setCustomCameras] = useState<CustomCamera[]>([]);
  const [importedRubyFiles, setImportedRubyFiles] = useState<{name: string, content: string}[]>([]);
  const [roofPitch, setRoofPitch] = useState<number>(4);
  const [roofOverhangIn, setRoofOverhangIn] = useState<number>(12);
  const [roofWidthIn, setRoofWidthIn] = useState<number>(240);
  const [roofHeightIn, setRoofHeightIn] = useState<number>(120);
  const [trussSpacing, setTrussSpacing] = useState<number>(24);
  const [trussType, setTrussType] = useState<'standard' | 'scissor' | 'vaulted'>('standard');
  const [customTrussScript, setCustomTrussScript] = useState<string>('');
  const [currentTrussSettings, setCurrentTrussSettings] = useState<Omit<TrussConfig, 'id' | 'x' | 'y'>>({
    type: 'Fink (W)',
    spanFt: 24,
    pitch: 6,
    lengthFt: 30,
    spacingIn: 24,
    overhangIn: 18,
    heelHeightIn: 4,
    plies: 1,
    rotation: 0
  });
  const [roofSheathingThickness, setRoofSheathingThickness] = useState<number>(0.5);
  const [isTrussBuilderOpen, setIsTrussBuilderOpen] = useState<boolean>(true);
  const [isSolidShellOpen, setIsSolidShellOpen] = useState<boolean>(true);
  const [isAddCanvasOpen, setIsAddCanvasOpen] = useState<boolean>(true);

  const [currentSolidShellSettings, setCurrentSolidShellSettings] = useState<Omit<TrussConfig, 'id' | 'x' | 'y'>>({
    type: 'Solid Shell',
    spanFt: 24,
    pitch: 6,
    lengthFt: 30,
    spacingIn: 24,
    overhangIn: 18,
    heelHeightIn: 4,
    plies: 1,
    rotation: 0,
    fasciaIn: 6,
    roofStyle: 'gable'
  });

  const [flashingWallId, setFlashingWallId] = useState<number | null>(null);
  const [chainToLastWall, setChainToLastWall] = useState<boolean>(true);
  const [lastWallType, setLastWallType] = useState<'exterior' | 'interior'>('exterior');

  const lastWallEndPoint = useMemo(() => {
    const list = lastWallType === 'exterior' ? exteriorWalls : interiorWalls;
    if (list.length === 0) return null;
    const lastWall = list[list.length - 1];
    const x = lastWall.xFt * 12 + lastWall.xInches;
    const y = lastWall.yFt * 12 + lastWall.yInches;
    const len = lastWall.lengthFt * 12 + lastWall.lengthInches;
    if (lastWall.orientation === 'horizontal') {
      return { x: x + len, y: y };
    } else {
      return { x: x, y: y + len };
    }
  }, [exteriorWalls, interiorWalls, lastWallType]);

  // Auto-fill calibration length when measuring
  useEffect(() => {
    if (appliedCalibration && pdfCalibration.p1 && pdfCalibration.p2) {
      const dx = pdfCalibration.p2.x - pdfCalibration.p1.x;
      const dy = pdfCalibration.p2.y - pdfCalibration.p1.y;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      
      const { ft, inches } = splitInches(pixelDist);
      setCalibrationLength(`${ft}' ${inches}"`);
    }
  }, [pdfCalibration.p1, pdfCalibration.p2, appliedCalibration]);

  // Automatically adjust floor framing based on foundation type
  useEffect(() => {
    if (isRestoring.current) return;
    if (foundationType === 'stem-wall') {
      setAddFloorFraming(true);
      setAddSubfloor(true);
      setOpenSections(prev => ({ ...prev, walls: true }));
      setActiveWallSection('floor');
    } else if (foundationType === 'slab' || foundationType === 'slab-on-grade') {
      // Slab foundations don't have a wood floor system — the concrete pad IS the floor
      setAddFloorFraming(false);
      setNoFramingFloorOnly(false);
    }
  }, [foundationType]);

  // Auto-fetch available custom HDRI files
  useEffect(() => {
    fetch('/api/hdri')
      .then(r => r.json())
      .then(d => setHdriFiles(d.hdriFiles || []))
      .catch(() => {}); // Server may not be running
  }, []);

  const handleApplyCalibration = () => {
    if (!pdfCalibration.p1 || !pdfCalibration.p2 || !calibrationLength) return;

    let realIn = 0;
    if (calibrationLength.includes("'")) {
      const [ftStr, inStr] = calibrationLength.split("'");
      const ft = parseFloat(ftStr) || 0;
      const inc = parseFloat(inStr?.replace(/[^0-9.]/g, '') || "0");
      realIn = ft * 12 + inc;
    } else {
      realIn = parseFloat(calibrationLength);
    }

    if (!isNaN(realIn) && realIn > 0) {
      if (appliedCalibration) {
        // Add Guide Mode
        setGuides(prev => [...prev, {
          p1: pdfCalibration.p1!,
          p2: pdfCalibration.p2!,
          distanceIn: realIn
        }]);
      } else {
        // Initial Calibration Mode
        const dx = pdfCalibration.p2.x - pdfCalibration.p1.x;
        const dy = pdfCalibration.p2.y - pdfCalibration.p1.y;
        const pixelDist = Math.sqrt(dx * dx + dy * dy);
        
        const newScale = (realIn / pixelDist) * pdfScale;
        setPdfScale(newScale);
        
        // Store applied calibration for AI
        setAppliedCalibration({
          p1: pdfCalibration.p1,
          p2: pdfCalibration.p2,
          realLengthIn: realIn
        });
        
        // Lock the blueprint
        setIsBlueprintLocked(true);
      }
      
      // Reset calibration UI
      setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
      setIsCalibrating(false);
      setCalibrationLength("");
    } else {
      alert("Please enter a valid length (e.g. 10' 6\" or 126)");
    }
  };

  const handleSaveToDevice = async () => {
    // When running inside the Hub, use the unified project save
    if (hubSaveToFile) {
      try {
        await hubSaveToFile();
      } catch (err) {
        console.error('Failed to save project:', err);
      }
      return;
    }

    // Standalone: save only designer state
    const projectData = {
      version: '1.0',
      state: {
        shape, widthFt, widthInches, lengthFt, lengthInches,
        lRightDepthFt, lRightDepthInches, lBackWidthFt, lBackWidthInches,
        uWalls, uWallsInches, uDirection, lDirection,
        wallHeightFt, wallHeightInches, wallThicknessIn,
        generateDimensions, solidWallsOnly, noFramingFloorOnly,
        additionalStories, upperFloorWallHeightFt, upperFloorWallHeightIn, upperFloorJoistSize,
        foundationType, stemWallHeightIn, stemWallThicknessIn, slabThicknessIn, thickenedEdgeDepthIn, footingWidthIn, footingThicknessIn, foundationShape,
        bumpouts, doors, windows, interiorWalls, exteriorWalls, assets,
        showGround, showSky, showSun, sunHour, sunMonth, siteLatitude, hdriPreset, customHdriUrl,
        studSpacing, studThickness, headerType, headerHeight, bottomPlates, topPlates,
        doorRoAllowance, windowRoAllowance, openingHeaderHeightIn,
        addSheathing, sheathingThickness, addInsulation, insulationThickness, addDrywall, drywallThickness,
        pdfImages, selectedPdfIndex, pdfScale, pdfOffset, pdfRotation, pdfOpacity, isBlueprintLocked, pdfCalibration, appliedCalibration,
        guides, chainToLastWall, lastWallType,
        addFloorFraming, joistSpacing, joistSize, joistDirection, addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness,
        enableGirderSystem, girderSpanThresholdFt, girderPostSpacingFt, girderSize, girderPostSize, girderPierSize, addPocketBeams, pocketBeamsOnlyAtGirderEnds,
        generationSection
      }
    };

    try {
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'woodworks-project.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const handleLoadFromDevice = async () => {
    // When running inside the Hub, use the unified project load
    if (hubLoadFromFile) {
      try {
        await hubLoadFromFile();
      } catch (err: any) {
        if (err?.message) {
          console.error('Failed to load project:', err);
          alert(`Failed to load project: ${err.message}`);
        }
      }
      return;
    }

    // Standalone: load only designer state
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsProjectLoading(true);
      console.log('Starting project load:', file.name, file.size);

      try {
        const contents = await file.text();
        console.log('File read complete, parsing JSON...');
        const projectData = JSON.parse(contents);

        if (projectData.state) {
          const s = projectData.state;
          console.log('State found, restoring...', s);
          performRestore(s);
          
          console.log('State restoration complete.');
          setSuccessMessage("Project Loaded Successfully");
          setTimeout(() => setSuccessMessage(null), 3000);

          setTimeout(() => {
            setIsProjectLoading(false);
          }, 500);
        } else {
          throw new Error("Invalid project file format: 'state' property missing.");
        }
      } catch (err) {
        console.error('Failed to load file:', err);
        alert(`Failed to load project: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsProjectLoading(false);
      }
    };

    input.click();
  };

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ghostWall, setGhostWall] = useState<{ x: number, y: number, w: number, h: number, type: 'exterior' | 'interior' } | null>(null);

  const handleAddAsWall = (type: 'exterior' | 'interior' = 'exterior') => {
    if (!pdfCalibration.p1 || !pdfCalibration.p2 || !calibrationLength) return;

    let realIn = 0;
    if (calibrationLength.includes("'")) {
      const [ftStr, inStr] = calibrationLength.split("'");
      const ft = parseFloat(ftStr) || 0;
      const inc = parseFloat(inStr?.replace(/[^0-9.]/g, '') || "0");
      realIn = ft * 12 + inc;
    } else {
      realIn = parseFloat(calibrationLength);
    }

    if (isNaN(realIn) || realIn <= 0) {
      alert("Please enter a valid length");
      return;
    }

    // Determine orientation
    const dx = pdfCalibration.p2.x - pdfCalibration.p1.x;
    const dy = pdfCalibration.p2.y - pdfCalibration.p1.y;
    const orientation: 'horizontal' | 'vertical' = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';

    // Determine direction-based sign for length
    let signedRealIn = realIn;
    if (orientation === 'horizontal') {
      if (pdfCalibration.p2.x < pdfCalibration.p1.x) signedRealIn = -realIn;
    } else {
      if (pdfCalibration.p2.y < pdfCalibration.p1.y) signedRealIn = -realIn;
    }

    // Add wall if shape is custom
    if (shape === 'custom') {
      const newId = Math.max(0, ...exteriorWalls.map(w => w.id), ...interiorWalls.map(w => w.id)) + 1;
      
      let startX = pdfCalibration.p1.x;
      let startY = pdfCalibration.p1.y;

      if (chainToLastWall && lastWallEndPoint && lastWallType === type) {
        startX = lastWallEndPoint.x;
        startY = lastWallEndPoint.y;
      }

      const startXRounded = Math.round(startX);
      const startYRounded = Math.round(startY);

      let calculatedExteriorSide: 1 | -1 = 1;
      if (orientation === 'horizontal') {
        calculatedExteriorSide = dx >= 0 ? -1 : 1;
      } else {
        calculatedExteriorSide = dy >= 0 ? 1 : -1;
      }

      const wallConfig = {
        id: newId,
        orientation,
        xFt: splitInches(startXRounded).ft,
        xInches: splitInches(startXRounded).inches,
        yFt: splitInches(startYRounded).ft,
        yInches: splitInches(startYRounded).inches,
        lengthFt: splitInches(signedRealIn).ft,
        lengthInches: splitInches(signedRealIn).inches,
        thicknessIn: type === 'exterior' ? wallThicknessIn : 4.5,
        floorIndex: currentFloorIndex
      };

      if (type === 'exterior') {
        setExteriorWalls(prev => [...prev, { ...wallConfig, exteriorSide: calculatedExteriorSide }]);
        setActiveWallSection('exterior');
      } else {
        setInteriorWalls(prev => [...prev, wallConfig]);
        setActiveWallSection('interior');
      }
      
      setLastWallType(type);

      // Expand sidebar
      setOpenSections(prev => ({ ...prev, walls: true }));
      
      // Success feedback
      setSuccessMessage(`${type === 'exterior' ? 'Exterior' : 'Interior'} Wall Added`);
      setTimeout(() => setSuccessMessage(null), 3000);

      // Ghost wall effect
      setGhostWall({
        x: startX,
        y: startY,
        w: orientation === 'horizontal' ? signedRealIn : (type === 'exterior' ? wallThicknessIn : 4.5),
        h: orientation === 'vertical' ? signedRealIn : (type === 'exterior' ? wallThicknessIn : 4.5),
        type
      });
      setTimeout(() => setGhostWall(null), 1000);

      // Flash effect
      setFlashingWallId(newId);
      setTimeout(() => setFlashingWallId(null), 2000);

      // Scroll to it
      setTimeout(() => {
        const element = document.getElementById(`wall-entry-${newId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    } else {
      alert("Please switch to 'Custom' mode to add individual walls.");
    }

    // Reset calibration UI
    setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
    setIsCalibrating(false);
    setCalibrationLength("");
  };

  // Floor Options
  const [addFloorFraming, setAddFloorFraming] = useState<boolean>(false);
  const [joistSpacing, setJoistSpacing] = useState<number>(16);
  const [joistSize, setJoistSize] = useState<'2x6' | '2x8' | '2x10' | '2x12'>('2x10');
  const [joistDirection, setJoistDirection] = useState<'x' | 'y'>('y');
  const [floorBays, setFloorBays] = useState<import('./utils/bayDetection').FloorBay[]>([]);
  const [addSubfloor, setAddSubfloor] = useState<boolean>(true);
  const [subfloorThickness, setSubfloorThickness] = useState<number>(0.75);
  const [subfloorMaterial, setSubfloorMaterial] = useState<'plywood' | 'osb'>('osb');
  const [rimJoistThickness, setRimJoistThickness] = useState<number>(1.5);

  // Floor Girder Support System Options
  const [enableGirderSystem, setEnableGirderSystem] = useState<boolean>(false);
  const [girderSpanThresholdFt, setGirderSpanThresholdFt] = useState<number>(12);
  const [girderPostSpacingFt, setGirderPostSpacingFt] = useState<number>(8);
  const [girderSize, setGirderSize] = useState<'2-2x10' | '3-2x10' | '4-2x10' | '6x6' | '6x8'>('3-2x10');
  const [girderPostSize, setGirderPostSize] = useState<'4x4' | '6x6'>('6x6');
  const [girderPierSize, setGirderPierSize] = useState<'12" Round' | '16" Square'>('12" Round');
  const [addPocketBeams, setAddPocketBeams] = useState<boolean>(true);
  const [pocketBeamsOnlyAtGirderEnds, setPocketBeamsOnlyAtGirderEnds] = useState<boolean>(false);

  const handleAutoGenerateWalls = async () => {
    if (pdfImages.length === 0) return;
    
    setIsAnalyzing(true);
    
    // Clear existing data to provide visual feedback that generation is starting
    setInteriorWalls([]);
    setExteriorWalls([]);
    setDoors([]);
    setWindows([]);
    setBumpouts([]);
    
    try {
      const result = await analyzeBlueprint(pdfImages[selectedPdfIndex], appliedCalibration || undefined);
      
      // Basic Dimensions
      setShape(result.shape);
      setWidthFt(result.widthFt);
      setWidthInches(result.widthIn);
      setLengthFt(result.lengthFt);
      setLengthInches(result.lengthIn);
      
      if (result.wallThicknessIn) {
        setWallThicknessIn(result.wallThicknessIn);
      }
      
      // Shape Specifics
      if (result.shape === 'l-shape') {
        if (result.lRightDepthFt !== undefined) setLRightDepthFt(result.lRightDepthFt);
        if (result.lRightDepthIn !== undefined) setLRightDepthInches(result.lRightDepthIn);
        if (result.lBackWidthFt !== undefined) setLBackWidthFt(result.lBackWidthFt);
        if (result.lBackWidthIn !== undefined) setLBackWidthInches(result.lBackWidthIn);
      } else if (result.shape === 'u-shape') {
        const w1 = result.widthFt;
        const w2 = result.uRightWingDepthFt || result.lengthFt;
        const w8 = result.uLeftWingDepthFt || result.lengthFt;
        const w3 = result.uRightWingWidthFt || 12;
        const w7 = result.uLeftWingWidthFt || 12;
        const w4 = Math.max(w2 - 12, 10);
        const w6 = Math.max(w8 - 12, 10);
        const w5 = Math.max(w1 - w3 - w7, 10);
        setUWalls({ w1, w2, w3, w4, w5, w6, w7, w8 });
        setUWallsInches({ w1: result.widthIn, w2: result.lengthIn, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, w8: 0 });
      }

      // Populate individual walls if available
      if (result.exteriorWalls && result.exteriorWalls.length > 0) {
        setExteriorWalls(result.exteriorWalls.map(w => ({
          ...w,
          xInches: w.xIn,
          yInches: w.yIn,
          lengthInches: w.lengthIn
        })));
        // If we have custom walls, we might want to default to 'custom' shape to avoid the parametric shell
        if (result.shape === 'custom') {
          setShape('custom');
        }
      }

      if (result.interiorWalls && result.interiorWalls.length > 0) {
        setInteriorWalls(result.interiorWalls.map(w => ({
          ...w,
          xInches: w.xIn,
          yInches: w.yIn,
          lengthInches: w.lengthIn
        })));
      }

      if (result.doors && result.doors.length > 0) {
        setDoors(result.doors.map(d => ({
          ...d,
          xInches: d.xIn
        })));
      }

      if (result.windows && result.windows.length > 0) {
        setWindows(result.windows.map(w => ({
          ...w,
          xInches: w.xIn
        })));
      }
      
      // Switch to 2D preview to show results
      setActiveTab('preview');
      // Open Walls section to show updated values
      setOpenSections(prev => ({ ...prev, walls: true }));
      
    } catch (error) {
      console.error("Failed to auto-generate walls:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to analyze blueprint: ${message}. Please try again or enter measurements manually.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBlueprintUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let imageUrls: string[] = [];
      
      if (file.type === 'application/pdf') {
        const images = await convertPDFToImages(file);
        imageUrls = images.map(img => img.url);
      } else if (file.type.startsWith('image/')) {
        // Handle PNG, JPG, JPEG
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        imageUrls = [dataUrl];
      } else {
        alert("Unsupported file type. Please upload a PDF, PNG, or JPG.");
        setIsUploading(false);
        return;
      }

      if (imageUrls.length === 0) {
        alert("No pages could be extracted from the PDF. Please try another file.");
        setIsUploading(false);
        return;
      }

      setPdfImages(imageUrls);
      setSelectedPdfIndex(0);
      setPdfScale(1);
      setPdfOffset({ x: 0, y: 0 });
      setPdfRotation(0);
      setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
      setAppliedCalibration(null);
      setIsBlueprintLocked(false);
      setOpenSections(prev => ({ ...prev, pdf: true }));
    } catch (error) {
      console.error("Error uploading blueprint:", error);
      alert("Failed to process file. Please try another one.");
    } finally {
      setIsUploading(false);
    }
  };

  const clearAllWalls = () => {
    setInteriorWalls([]);
    setExteriorWalls([]);
    setDoors([]);
    setWindows([]);
    setBumpouts([]);
    setShape('custom');
    setAddFloorFraming(false);
    setShapeBlocks([]);
    setCombinedBlocks([]);
  };

  const getWallLength = useCallback((wallId: number) => {
    const customWall = exteriorWalls.find(w => w.id === wallId);
    if (customWall) {
      return customWall.lengthFt * 12 + customWall.lengthInches;
    }

    const w = widthFt * 12 + widthInches;
    const l = lengthFt * 12 + lengthInches;
    const t = wallThicknessIn;

    if (shape === 'rectangle') {
      if (wallId === 1 || wallId === 3) return w;
      if (wallId === 2 || wallId === 4) return l - 2 * t;
    } else if (shape === 'l-shape') {
      const l1 = lRightDepthFt * 12 + lRightDepthInches;
      const w2 = lBackWidthFt * 12 + lBackWidthInches;
      if (wallId === 1) return w;
      if (wallId === 2) return l1 - t;
      if (wallId === 3) return w - w2 - t;
      if (wallId === 4) return l - l1 - t;
      if (wallId === 5) return w2 + t;
      if (wallId === 6) return l - 2 * t;
    } else if (shape === 'u-shape') {
      const u_w1 = uWalls.w1 * 12 + uWallsInches.w1;
      const u_w2 = uWalls.w2 * 12 + uWallsInches.w2;
      const u_w3 = uWalls.w3 * 12 + uWallsInches.w3;
      const u_w4 = uWalls.w4 * 12 + uWallsInches.w4;
      const u_w5 = uWalls.w5 * 12 + uWallsInches.w5;
      const u_w6 = uWalls.w6 * 12 + uWallsInches.w6;
      const u_w7 = uWalls.w7 * 12 + uWallsInches.w7;
      const u_w8 = uWalls.w8 * 12 + uWallsInches.w8;
      
      if (wallId === 1) return u_w1;
      if (wallId === 2) return u_w2 - t;
      if (wallId === 3) return u_w3 - t;
      if (wallId === 4) return u_w4 - t;
      if (wallId === 5) return u_w5 + 2 * t;
      if (wallId === 6) return u_w6 - t;
      if (wallId === 7) return u_w7;
      if (wallId === 8) return u_w8 - 2 * t;
    }
    return 0;
  }, [exteriorWalls, widthFt, widthInches, lengthFt, lengthInches, wallThicknessIn, shape, lRightDepthFt, lRightDepthInches, lBackWidthFt, lBackWidthInches, uWalls, uWallsInches]);

  // Build list of available wall options for door/window dropdowns
  const getAvailableWallOptions = useMemo(() => {
    const options: { id: number, label: string }[] = [];
    
    if (shape === 'rectangle') {
      for (let i = 1; i <= 4; i++) options.push({ id: i, label: `Wall ${i}` });
    } else if (shape === 'l-shape') {
      for (let i = 1; i <= 6; i++) options.push({ id: i, label: `Wall ${i}` });
    } else if (shape === 'u-shape') {
      for (let i = 1; i <= 8; i++) options.push({ id: i, label: `Wall ${i}` });
    } else if (shape === 'h-shape') {
      for (let i = 1; i <= 12; i++) options.push({ id: i, label: `Wall ${i}` });
    } else if (shape === 't-shape') {
      for (let i = 1; i <= 8; i++) options.push({ id: i, label: `Wall ${i}` });
    }
    // For 'custom' shape, only use exterior walls (combined shape walls)
    
    // Add custom exterior walls (from combined shapes)
    exteriorWalls.forEach(w => {
      // Avoid duplicating IDs already listed
      if (!options.some(o => o.id === w.id)) {
        const wLen = w.lengthFt * 12 + w.lengthInches;
        const wOrient = w.orientation === 'horizontal' ? 'H' : 'V';
        const { ft, inches } = splitInches(wLen);
        options.push({ id: w.id, label: `Ext ${w.id} (${wOrient} ${ft}'${inches}")` });
      }
    });
    
    // Add interior walls
    interiorWalls.forEach(w => {
      const len = w.lengthFt * 12 + w.lengthInches;
      const orient = w.orientation === 'horizontal' ? 'H' : 'V';
      const { ft, inches } = splitInches(len);
      options.push({ id: w.id, label: `Int ${w.id} (${orient} ${ft}'${inches}")` });
    });
    
    return options;
  }, [shape, exteriorWalls, interiorWalls]);

  // Ensure doors and windows fit within their walls and reassign orphaned ones
  useEffect(() => {
    if (isRestoring.current) return;
    if (getAvailableWallOptions.length === 0) return;

    const availableIds = new Set(getAvailableWallOptions.map(o => o.id));
    const firstWallId = getAvailableWallOptions[0].id;

    let doorsChanged = false;
    const validatedDoors = doors.map(d => {
      let updated = d;
      // Reassign door to first available wall if its wall no longer exists
      if (!availableIds.has(d.wall)) {
        doorsChanged = true;
        updated = { ...updated, wall: firstWallId, xFt: 0, xInches: 0 };
      }
      const wallLen = getWallLength(updated.wall);
      const x = updated.xFt * 12 + updated.xInches;
      const maxPos = Math.max(0, wallLen - updated.widthIn);
      
      if (x > maxPos) {
        doorsChanged = true;
        return { ...updated, xFt: Math.floor(maxPos / 12), xInches: maxPos % 12 };
      }
      return updated;
    });

    if (doorsChanged) setDoors(validatedDoors);

    let windowsChanged = false;
    const validatedWindows = windows.map(w => {
      let updated = w;
      // Skip dormer windows (wall >= 9000) — they use special IDs
      if (w.wall >= 9000) return updated;
      // Reassign window to first available wall if its wall no longer exists
      if (!availableIds.has(w.wall)) {
        windowsChanged = true;
        updated = { ...updated, wall: firstWallId, xFt: 0, xInches: 0 };
      }
      const wallLen = getWallLength(updated.wall);
      const x = updated.xFt * 12 + updated.xInches;
      const maxPos = Math.max(0, wallLen - updated.widthIn);
      
      if (x > maxPos) {
        windowsChanged = true;
        return { ...updated, xFt: Math.floor(maxPos / 12), xInches: maxPos % 12 };
      }
      return updated;
    });

    if (windowsChanged) setWindows(validatedWindows);
  }, [doors, windows, getWallLength, getAvailableWallOptions]);

  const [copied, setCopied] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  const currentState = useMemo<AppState>(() => ({
    shape, widthFt, widthInches, lengthFt, lengthInches,
    lRightDepthFt, lRightDepthInches, lBackWidthFt, lBackWidthInches,
    hLeftBarWidthFt, hLeftBarWidthInches, hRightBarWidthFt, hRightBarWidthInches,
    hMiddleBarHeightFt, hMiddleBarHeightInches, hMiddleBarOffsetFt, hMiddleBarOffsetInches,
    tTopWidthFt, tTopWidthInches, tTopLengthFt, tTopLengthInches,
    tStemWidthFt, tStemWidthInches, tStemLengthFt, tStemLengthInches,
    uWalls, uWallsInches, uDirection, lDirection,
    wallHeightFt, wallHeightInches, wallThicknessIn,
    bumpouts, doors, windows, interiorWalls, exteriorWalls, assets,
    studSpacing, studThickness, headerType, headerHeight,
    bottomPlates, topPlates, doorRoAllowance, windowRoAllowance,
    openingHeaderHeightIn, addSheathing, sheathingThickness, addInsulation, insulationThickness, addDrywall, drywallThickness, wallFinishes, roofFinish, interiorFinish, foundationFinish, generationSection,
    showGround, showSky, showSun, sunHour, sunMonth, siteLatitude, hdriPreset, customHdriUrl,
    pdfImages, selectedPdfIndex, pdfScale, pdfOffset, pdfRotation, pdfOpacity, isBlueprintLocked, pdfCalibration,
    foundationType, slabThicknessIn, thickenedEdgeDepthIn, stemWallHeightIn, stemWallThicknessIn, footingWidthIn, footingThicknessIn, foundationShape,
    addFloorFraming, joistSpacing, joistSize, joistDirection, floorBays, addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness, generateDimensions, solidWallsOnly, noFramingFloorOnly,
    enableGirderSystem, girderSpanThresholdFt, girderPostSpacingFt, girderSize, girderPostSize, girderPierSize, addPocketBeams, pocketBeamsOnlyAtGirderEnds,
    additionalStories, currentFloorIndex, upperFloorWallHeightFt, upperFloorWallHeightIn, upperFloorJoistSize,
    combinedBlocks, shapeBlocks, materialCosts, customCostItems,
    roofType, roofPitch, roofOverhangIn, trussSpacing, trussType, customTrussScript, roofSheathingThickness,
    roofWidthIn, roofHeightIn, selectedRoofPartId,
    roofParts, trussRuns, dormers, customCameras, roofGroups, paintedSurfaces
  }), [
    shape, widthFt, widthInches, lengthFt, lengthInches,
    lRightDepthFt, lRightDepthInches, lBackWidthFt, lBackWidthInches,
    hLeftBarWidthFt, hLeftBarWidthInches, hRightBarWidthFt, hRightBarWidthInches,
    hMiddleBarHeightFt, hMiddleBarHeightInches, hMiddleBarOffsetFt, hMiddleBarOffsetInches,
    tTopWidthFt, tTopWidthInches, tTopLengthFt, tTopLengthInches,
    tStemWidthFt, tStemWidthInches, tStemLengthFt, tStemLengthInches,
    uWalls, uWallsInches, uDirection, lDirection,
    wallHeightFt, wallHeightInches, wallThicknessIn,
    bumpouts, doors, windows, interiorWalls, exteriorWalls, assets,
    studSpacing, studThickness, headerType, headerHeight,
    bottomPlates, topPlates, doorRoAllowance, windowRoAllowance,
    openingHeaderHeightIn, addSheathing, sheathingThickness, addInsulation, insulationThickness, addDrywall, drywallThickness, wallFinishes, roofFinish, interiorFinish, foundationFinish, generationSection,
    showGround, showSky, showSun, sunHour, sunMonth, siteLatitude, hdriPreset, customHdriUrl,
    pdfImages, selectedPdfIndex, pdfScale, pdfOffset, pdfRotation, pdfOpacity, isBlueprintLocked, pdfCalibration,
    foundationType, slabThicknessIn, thickenedEdgeDepthIn, stemWallHeightIn, stemWallThicknessIn, footingWidthIn, footingThicknessIn, foundationShape,
    addFloorFraming, joistSpacing, joistSize, joistDirection, floorBays, addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness, generateDimensions, solidWallsOnly, noFramingFloorOnly,
    enableGirderSystem, girderSpanThresholdFt, girderPostSpacingFt, girderSize, girderPostSize, girderPierSize, addPocketBeams, pocketBeamsOnlyAtGirderEnds,
    additionalStories, currentFloorIndex, upperFloorWallHeightFt, upperFloorWallHeightIn, upperFloorJoistSize,
    combinedBlocks, shapeBlocks, materialCosts, customCostItems,
    roofType, roofPitch, roofOverhangIn, trussSpacing, trussType, customTrussScript, roofSheathingThickness,
    roofWidthIn, roofHeightIn, selectedRoofPartId,
    roofParts, trussRuns, dormers, customCameras, roofGroups, paintedSurfaces
  ]);

  // ── State management refs (must be declared before bridge effect) ──
  const [past, setPast] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  const isRestoring = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Bridge: sync design data to shared ProjectContext (debounced, one-way out) ──
  const bridgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBridgingRef = useRef(false);
  const lastBridgedStateRef = useRef<any>(null);
  useEffect(() => {
    if (!onDesignChange) return;

    if (bridgeTimerRef.current) clearTimeout(bridgeTimerRef.current);

    bridgeTimerRef.current = setTimeout(() => {
      // Check isRestoring at execution time, not at setup time
      if (isRestoring.current) return;

      const estimate = computeEstimate(currentState, getWallLength, getAvailableWallOptions);

      // Compute floor area — for custom shapes, derive from exterior wall bounding box
      let floorArea = currentState.widthFt * currentState.lengthFt;
      if (currentState.shape === 'custom' && currentState.exteriorWalls.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        currentState.exteriorWalls.forEach(wall => {
          const wx = wall.xFt * 12 + wall.xInches;
          const wy = wall.yFt * 12 + wall.yInches;
          const wlen = wall.lengthFt * 12 + wall.lengthInches;
          if (wall.orientation === 'horizontal') {
            minX = Math.min(minX, wx, wx + wlen);
            maxX = Math.max(maxX, wx, wx + wlen);
            minY = Math.min(minY, wy);
            maxY = Math.max(maxY, wy);
          } else {
            minX = Math.min(minX, wx);
            maxX = Math.max(maxX, wx);
            minY = Math.min(minY, wy, wy + wlen);
            maxY = Math.max(maxY, wy, wy + wlen);
          }
        });
        const effW = Math.max(1, maxX - minX);
        const effL = Math.max(1, maxY - minY);
        floorArea = Math.round((effW / 12) * (effL / 12));
      }

      // Track the state reference we're sending out so the hydration
      // effect can recognise its own echo and skip re-hydration.
      lastBridgedStateRef.current = currentState;

      isBridgingRef.current = true;
      onDesignChange({
        widthFt: currentState.widthFt,
        lengthFt: currentState.lengthFt,
        wallHeightFt: currentState.wallHeightFt,
        stories: 1 + currentState.additionalStories,
        roofType: currentState.roofType,
        roofPitch: currentState.roofPitch,
        floorArea,
        materialEstimate: {
          totalCost: estimate.totalCost,
          lineItems: estimate.lineItems,
        },
        designerState: currentState,
      });
      // Allow next frame to settle before accepting inbound hydration
      requestAnimationFrame(() => { isBridgingRef.current = false; });
    }, 300);

    return () => {
      if (bridgeTimerRef.current) clearTimeout(bridgeTimerRef.current);
    };
  }, [currentState, onDesignChange, getWallLength, getAvailableWallOptions]);

  const restoreState = useCallback((state: AppState) => {
    setShape(state.shape);
    setWidthFt(state.widthFt);
    setWidthInches(state.widthInches);
    setLengthFt(state.lengthFt);
    setLengthInches(state.lengthInches);
    setLRightDepthFt(state.lRightDepthFt);
    setLRightDepthInches(state.lRightDepthInches);
    setLBackWidthFt(state.lBackWidthFt);
    setLBackWidthInches(state.lBackWidthInches);

    // H-Shape
    setHLeftBarWidthFt(state.hLeftBarWidthFt ?? 10);
    setHLeftBarWidthInches(state.hLeftBarWidthInches ?? 0);
    setHRightBarWidthFt(state.hRightBarWidthFt ?? 10);
    setHRightBarWidthInches(state.hRightBarWidthInches ?? 0);
    setHMiddleBarHeightFt(state.hMiddleBarHeightFt ?? 10);
    setHMiddleBarHeightInches(state.hMiddleBarHeightInches ?? 0);
    setHMiddleBarOffsetFt(state.hMiddleBarOffsetFt ?? 15);
    setHMiddleBarOffsetInches(state.hMiddleBarOffsetInches ?? 0);

    // T-Shape
    setTTopWidthFt(state.tTopWidthFt ?? 30);
    setTTopWidthInches(state.tTopWidthInches ?? 0);
    setTTopLengthFt(state.tTopLengthFt ?? 10);
    setTTopLengthInches(state.tTopLengthInches ?? 0);
    setTStemWidthFt(state.tStemWidthFt ?? 10);
    setTStemWidthInches(state.tStemWidthInches ?? 0);
    setTStemLengthFt(state.tStemLengthFt ?? 20);
    setTStemLengthInches(state.tStemLengthInches ?? 0);

    setUWalls(state.uWalls || { w1: 30, w2: 40, w3: 10, w4: 20, w5: 10, w6: 20, w7: 10, w8: 40 });
    setUWallsInches(state.uWallsInches || { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0, w7: 0, w8: 0 });
    setUDirection(state.uDirection);
    setLDirection(state.lDirection);
    setWallHeightFt(state.wallHeightFt);
    setWallHeightInches(state.wallHeightInches);
    setWallThicknessIn(state.wallThicknessIn);
    setBumpouts(state.bumpouts || []);
    setDoors(state.doors);
    setWindows(state.windows);
    setInteriorWalls(state.interiorWalls);
    setExteriorWalls(state.exteriorWalls || []);
    setStudSpacing(state.studSpacing);
    setStudThickness(state.studThickness);
    setHeaderType(state.headerType);
    setHeaderHeight(state.headerHeight);
    setBottomPlates(state.bottomPlates);
    setTopPlates(state.topPlates);
    setDoorRoAllowance(state.doorRoAllowance);
    setWindowRoAllowance(state.windowRoAllowance);
    setOpeningHeaderHeightIn(state.openingHeaderHeightIn);
    setAddSheathing(state.addSheathing ?? true);
    setSheathingThickness(state.sheathingThickness ?? 0.5);
    setAddInsulation(state.addInsulation ?? true);
    setInsulationThickness(state.insulationThickness ?? 3.5);
    setAddDrywall(state.addDrywall ?? true);
    setDrywallThickness(state.drywallThickness ?? 0.5);
    setWallFinishes(state.wallFinishes || {});
    setPaintedSurfaces(state.paintedSurfaces || {});
    setRoofFinish(state.roofFinish || 'none');
    setInteriorFinish(state.interiorFinish || 'none');
    setFoundationFinish(state.foundationFinish || 'none');
    setGenerationSection(state.generationSection || 'all');
    setPdfImages(state.pdfImages || []);
    setSelectedPdfIndex(state.selectedPdfIndex ?? 0);
    setPdfScale(state.pdfScale ?? 1);
    setPdfOffset(state.pdfOffset || { x: 0, y: 0 });
    setPdfRotation(state.pdfRotation ?? 0);
    setPdfOpacity(state.pdfOpacity ?? 0.5);
    setIsBlueprintLocked(state.isBlueprintLocked ?? false);
    setPdfCalibration(state.pdfCalibration || { p1: null, p2: null, realLengthIn: 0 });
    setFoundationType(state.foundationType || 'stem-wall');
    setShowGround(state.showGround ?? true);
    setShowSky(state.showSky ?? true);
    setShowSun(state.showSun ?? true);
    setSunHour(state.sunHour ?? 14);
    setSunMonth(state.sunMonth ?? 6);
    setSiteLatitude(state.siteLatitude ?? 39.5);
    setHdriPreset(state.hdriPreset || 'city');
    setCustomHdriUrl(state.customHdriUrl || '');
    setSlabThicknessIn(state.slabThicknessIn ?? 4);
    setThickenedEdgeDepthIn(state.thickenedEdgeDepthIn ?? 12);
    setStemWallHeightIn(state.stemWallHeightIn ?? 24);
    setStemWallThicknessIn(state.stemWallThicknessIn ?? 8);
    setFootingWidthIn(state.footingWidthIn ?? 16);
    setFootingThicknessIn(state.footingThicknessIn ?? 8);
    setFoundationShape(state.foundationShape || 'rectangle');
    setAddFloorFraming(state.addFloorFraming ?? false);
    setJoistSpacing(state.joistSpacing ?? 16);
    setJoistSize(state.joistSize || '2x10');
    setJoistDirection(state.joistDirection || 'y');
    setFloorBays(state.floorBays || []);
    setAddSubfloor(state.addSubfloor ?? true);
    setSubfloorThickness(state.subfloorThickness ?? 0.75);
    setSubfloorMaterial(state.subfloorMaterial || 'osb');
    setRimJoistThickness(state.rimJoistThickness ?? 1.5);
    setGenerateDimensions(state.generateDimensions ?? true);
    setSolidWallsOnly(state.solidWallsOnly ?? false);
    setNoFramingFloorOnly(state.noFramingFloorOnly ?? false);
    setEnableGirderSystem(state.enableGirderSystem ?? false);
    setGirderSpanThresholdFt(state.girderSpanThresholdFt ?? 12);
    setGirderPostSpacingFt(state.girderPostSpacingFt ?? 8);
    setGirderSize(state.girderSize || '3-2x10');
    setGirderPostSize(state.girderPostSize || '6x6');
    setGirderPierSize(state.girderPierSize || '12" Round');
    setAddPocketBeams(state.addPocketBeams ?? true);
    setPocketBeamsOnlyAtGirderEnds(state.pocketBeamsOnlyAtGirderEnds ?? false);
    setAdditionalStories(state.additionalStories ?? 0);
    setCurrentFloorIndex(state.currentFloorIndex ?? 0);
    setUpperFloorWallHeightFt(state.upperFloorWallHeightFt ?? 8);
    setUpperFloorWallHeightIn(state.upperFloorWallHeightIn ?? 0);
    setUpperFloorJoistSize(state.upperFloorJoistSize || '2x10');
    setCombinedBlocks(state.combinedBlocks || []);
    setShapeBlocks(state.shapeBlocks || []);
    setMaterialCosts({ ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) });
    setCustomCostItems(state.customCostItems || []);
    setAssets(state.assets || []);
    setDormers(state.dormers || []);
    setRoofGroups(state.roofGroups || []);

    // Roof properties
    setRoofType(state.roofType || 'gable');
    setRoofPitch(state.roofPitch ?? 4);
    setRoofOverhangIn(state.roofOverhangIn ?? 12);
    setTrussSpacing(state.trussSpacing ?? 24);
    setTrussType(state.trussType || 'standard');
    setCustomTrussScript(state.customTrussScript || '');
    setRoofSheathingThickness(state.roofSheathingThickness ?? 0.5);
    setRoofWidthIn(state.roofWidthIn ?? 240);
    setRoofHeightIn(state.roofHeightIn ?? 120);
    setRoofParts(state.roofParts || []);
    setTrussRuns(state.trussRuns || []);
    setCustomCameras(state.customCameras || []);
    setSelectedRoofPartId(state.selectedRoofPartId || null);
  }, []);

  useEffect(() => {
    if (isRestoring.current) {
      return;
    }

    // Clear future immediately on new user action
    setFuture([]);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setPast(prev => {
        const lastState = prev[prev.length - 1];
        if (!lastState || JSON.stringify(lastState) !== JSON.stringify(currentState)) {
          return [...prev, currentState];
        }
        return prev;
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentState]);

  const performRestore = useCallback((state: AppState) => {
    isRestoring.current = true;
    restoreState(state);
    setTimeout(() => {
      isRestoring.current = false;
    }, 500);
  }, [restoreState]);

  // Hydrate state from global context payload (initialState).
  // Runs on initial mount AND when initialState changes from external sources
  // (file load, project reset). Skips re-hydration from the bridge's own writes.
  const lastHydratedRef = useRef<any>(null);
  useEffect(() => {
    // Skip if initialState hasn't actually changed (same object reference)
    if (initialState === lastHydratedRef.current) return;
    lastHydratedRef.current = initialState;

    // Skip if this is the bridge's own write echoing back — the bridge
    // stores the currentState ref it sent out in lastBridgedStateRef.
    // File loads produce a freshly-deserialized object that won't match.
    if (initialState === lastBridgedStateRef.current) return;

    if (!initialState) return; // No saved state to hydrate

    isRestoring.current = true;
    restoreState(initialState);
    setPast([]);
    setFuture([]);
    setTimeout(() => {
      isRestoring.current = false;
    }, 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  const handleUndo = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const lastSavedState = past[past.length - 1];
    if (!lastSavedState) return;

    const isUnsaved = JSON.stringify(currentState) !== JSON.stringify(lastSavedState);

    if (isUnsaved) {
      setFuture(prev => [currentState, ...prev]);
      performRestore(lastSavedState);
    } else {
      if (past.length <= 1) return;
      
      const newPast = [...past];
      const stateToMove = newPast.pop();
      const stateToRestore = newPast[newPast.length - 1];
      
      setPast(newPast);
      if (stateToMove) {
        setFuture(prev => [stateToMove, ...prev]);
      }
      if (stateToRestore) {
        performRestore(stateToRestore);
      }
    }
  };

  const handleRedo = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (future.length === 0) return;
    
    const newFuture = [...future];
    const stateToRestore = newFuture.shift();
    
    if (stateToRestore) {
      setFuture(newFuture);
      setPast(prev => [...prev, stateToRestore]);
      performRestore(stateToRestore);
    }
  };

  const handleClearCode = () => {
    if (window.confirm("Are you sure you want to clear all data and reset to defaults?")) {
      const defaultState: AppState = DEFAULT_APP_STATE;
    performRestore(defaultState);
    setPast([defaultState]);
    setFuture([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveToDevice();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleLoadFromDevice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveToDevice, handleLoadFromDevice]);

  const addBumpout = () => {
    const newId = `bumpout-${Date.now()}`;
    setBumpouts([...bumpouts, { id: newId, wall: 1, xFt: 10, xInches: 0, yFt: 0, yInches: 0, widthIn: 48, depthIn: 24, floorIndex: currentFloorIndex }]);
  };

  const removeBumpout = (id: string) => {
    setBumpouts(bumpouts.filter(b => b.id !== id));
  };

  const updateBumpout = (id: string, field: keyof BumpoutConfig, value: any) => {
    setBumpouts(bumpouts.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const updateBumpoutFields = (id: string, updates: Partial<BumpoutConfig>) => {
    setBumpouts(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const addDoor = () => {
    const newId = `door-${Date.now()}`;
    // Pick the first available wall
    const wallId = getAvailableWallOptions.length > 0 ? getAvailableWallOptions[0].id : 1;
    const wallLen = getWallLength(wallId);
    const widthIn = 36;
    let xFt = 10;
    let xInches = 0;
    
    if (xFt * 12 + xInches + widthIn > wallLen) {
      const remaining = Math.max(0, wallLen - widthIn);
      xFt = Math.floor(remaining / 12);
      xInches = remaining % 12;
    }

    setDoors([...doors, { id: newId, wall: wallId, xFt, xInches, yFt: 0, yInches: 0, widthIn, heightIn: openingHeaderHeightIn, floorIndex: currentFloorIndex }]);
  };

  const removeDoor = (id: string) => {
    setDoors(doors.filter(d => d.id !== id));
  };

  const updateDoor = (id: string, field: keyof DoorConfig, value: number | string | undefined) => {
    setDoors(doors.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        const wallLen = getWallLength(updated.wall);
        const x = updated.xFt * 12 + updated.xInches;
        
        if (x + updated.widthIn > wallLen) {
          const maxPos = Math.max(0, wallLen - updated.widthIn);
          updated.xFt = Math.floor(maxPos / 12);
          updated.xInches = maxPos % 12;
        }
        return updated;
      }
      return d;
    }));
  };

  const addWindow = () => {
    const newId = `win-${Date.now()}`;
    // Pick the first available wall
    const wallId = getAvailableWallOptions.length > 0 ? getAvailableWallOptions[0].id : 1;
    const wallLen = getWallLength(wallId);
    const widthIn = 48;
    let xFt = 15;
    let xInches = 0;

    if (xFt * 12 + xInches + widthIn > wallLen) {
      const remaining = Math.max(0, wallLen - widthIn);
      xFt = Math.floor(remaining / 12);
      xInches = remaining % 12;
    }

    setWindows([...windows, { id: newId, wall: wallId, xFt, xInches, yFt: 0, yInches: 0, widthIn, heightIn: 48, sillHeightIn: openingHeaderHeightIn - 48, floorIndex: currentFloorIndex }]);
  };

  const removeWindow = (id: string) => {
    setWindows(windows.filter(w => w.id !== id));
  };

  const updateWindow = (id: string, field: keyof WindowConfig, value: number | string | undefined) => {
    setWindows(windows.map(w => {
      if (w.id === id) {
        const updated = { ...w, [field]: value };
        if (field === 'heightIn') {
          updated.sillHeightIn = openingHeaderHeightIn - Number(value);
        }
        
        const wallLen = getWallLength(updated.wall);
        const x = updated.xFt * 12 + updated.xInches;
        
        if (x + updated.widthIn > wallLen) {
          const maxPos = Math.max(0, wallLen - updated.widthIn);
          updated.xFt = Math.floor(maxPos / 12);
          updated.xInches = maxPos % 12;
        }
        return updated;
      }
      return w;
    }));
  };

  const addCustomCamera = () => {
    const newId = `camera-${Date.now()}`;
    const cx = (widthFt * 12 + widthInches) / 2 || 120;
    const cy = (lengthFt * 12 + lengthInches) / 2 || 120;
    
    setCustomCameras([...customCameras, { 
      id: newId, 
      name: `View ${customCameras.length + 1}`, 
      x: cx, 
      y: cy, 
      rotation: 0, 
      floorIndex: currentFloorIndex 
    }]);
  };

  const removeCustomCamera = (id: string) => {
    setCustomCameras(customCameras.filter(c => c.id !== id));
  };

  const updateCustomCamera = (id: string, field: keyof CustomCamera, value: string | number) => {
    setCustomCameras(customCameras.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const handleHeaderHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = Number(e.target.value);
    setOpeningHeaderHeightIn(newHeight);
    setDoors(doors.map(d => ({ ...d, heightIn: newHeight })));
    setWindows(windows.map(w => ({ ...w, sillHeightIn: newHeight - w.heightIn })));
  };

  const handleHeaderTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as 'single' | 'double' | 'lvl';
    setHeaderType(newType);
    if (newType === 'lvl') {
      setHeaderHeight(9.5);
    } else {
      setHeaderHeight(5.5);
    }
  };

  const handleUWallChange = (wall: string, value: string) => {
    const v = Number(value);
    setUWalls(prev => {
      const next = { ...prev, [wall]: v };
      
      // Helper to get total inches for a wall
      const getTotalInches = (w: string, currentNext: any) => {
        return (currentNext[w] * 12) + uWallsInches[w as keyof typeof uWallsInches];
      };

      // Helper to set feet and inches from total inches
      const setFromTotal = (w: string, total: number, targetWalls: any, targetInches: any) => {
        const ft = Math.floor(Math.max(0, total) / 12);
        const inc = Math.max(0, total) % 12;
        targetWalls[w] = ft;
        targetInches[w] = inc;
      };

      const nextInches = { ...uWallsInches };

      if (['w1', 'w3', 'w7'].includes(wall)) {
        const total1 = getTotalInches('w1', next);
        const total3 = getTotalInches('w3', next);
        const total7 = getTotalInches('w7', next);
        
        if (wall === 'w1') {
          const total5 = total1 - total3 - total7;
          setFromTotal('w5', total5, next, nextInches);
        } else {
          const total5 = getTotalInches('w5', next);
          const newTotal1 = total3 + total5 + total7;
          setFromTotal('w1', newTotal1, next, nextInches);
        }
      }
      
      if (wall === 'w5') {
        const total3 = getTotalInches('w3', next);
        const total5 = getTotalInches('w5', next);
        const total7 = getTotalInches('w7', next);
        const newTotal1 = total3 + total5 + total7;
        setFromTotal('w1', newTotal1, next, nextInches);
      }

      if (['w2', 'w4', 'w8'].includes(wall)) {
        const total2 = getTotalInches('w2', next);
        const total4 = getTotalInches('w4', next);
        const total8 = getTotalInches('w8', next);
        
        // Relationship: w8 - w6 = w2 - w4  => w6 = w8 - (w2 - w4)
        const total6 = total8 - (total2 - total4);
        setFromTotal('w6', total6, next, nextInches);
      }
      
      if (wall === 'w6') {
        const total2 = getTotalInches('w2', next);
        const total4 = getTotalInches('w4', next);
        const total6 = getTotalInches('w6', next);
        // w8 = w6 + (w2 - w4)
        const total8 = total6 + (total2 - total4);
        setFromTotal('w8', total8, next, nextInches);
      }

      setUWallsInches(nextInches);
      return next;
    });
  };

  const handleUWallInchesChange = (wall: string, value: string) => {
    const v = Number(value);
    setUWallsInches(prev => {
      const nextInches = { ...prev, [wall]: v };
      
      const nextWalls = { ...uWalls };
      
      const getTotalInches = (w: string, currentInches: any) => {
        return (uWalls[w as keyof typeof uWalls] * 12) + currentInches[w];
      };

      const setFromTotal = (w: string, total: number, targetWalls: any, targetInches: any) => {
        const ft = Math.floor(Math.max(0, total) / 12);
        const inc = Math.max(0, total) % 12;
        targetWalls[w] = ft;
        targetInches[w] = inc;
      };

      if (['w1', 'w3', 'w7'].includes(wall)) {
        const total1 = getTotalInches('w1', nextInches);
        const total3 = getTotalInches('w3', nextInches);
        const total7 = getTotalInches('w7', nextInches);
        
        if (wall === 'w1') {
          const total5 = total1 - total3 - total7;
          setFromTotal('w5', total5, nextWalls, nextInches);
        } else {
          const total5 = getTotalInches('w5', nextInches);
          const newTotal1 = total3 + total5 + total7;
          setFromTotal('w1', newTotal1, nextWalls, nextInches);
        }
      }
      
      if (wall === 'w5') {
        const total3 = getTotalInches('w3', nextInches);
        const total5 = getTotalInches('w5', nextInches);
        const total7 = getTotalInches('w7', nextInches);
        const newTotal1 = total3 + total5 + total7;
        setFromTotal('w1', newTotal1, nextWalls, nextInches);
      }

      if (['w2', 'w4', 'w8'].includes(wall)) {
        const total2 = getTotalInches('w2', nextInches);
        const total4 = getTotalInches('w4', nextInches);
        const total8 = getTotalInches('w8', nextInches);
        const total6 = total8 - (total2 - total4);
        setFromTotal('w6', total6, nextWalls, nextInches);
      }
      
      if (wall === 'w6') {
        const total2 = getTotalInches('w2', nextInches);
        const total4 = getTotalInches('w4', nextInches);
        const total6 = getTotalInches('w6', nextInches);
        const total8 = total6 + (total2 - total4);
        setFromTotal('w8', total8, nextWalls, nextInches);
      }

      setUWalls(nextWalls);
      return nextInches;
    });
  };

  const addInteriorWall = () => {
    const nextId = interiorWalls.length > 0 ? Math.max(...interiorWalls.map(w => w.id)) + 1 : 100;
    
    let newX = 120; // Default 10ft
    let newY = 120; // Default 10ft
    let newOrientation: 'horizontal' | 'vertical' = 'horizontal';

    if (interiorWalls.length > 0) {
      const lastWall = interiorWalls[interiorWalls.length - 1];
      const lastLen = lastWall.lengthFt * 12 + lastWall.lengthInches;
      const lastX = lastWall.xFt * 12 + lastWall.xInches;
      const lastY = lastWall.yFt * 12 + lastWall.yInches;
      
      if (lastWall.orientation === 'horizontal') {
        newX = lastX + lastLen;
        newY = lastY;
        newOrientation = 'vertical';
      } else {
        newX = lastX;
        newY = lastY + lastLen;
        newOrientation = 'horizontal';
      }
    }

    setInteriorWalls([
      ...interiorWalls,
      { 
        id: nextId, 
        orientation: newOrientation, 
        xFt: Math.floor(newX / 12), 
        xInches: newX % 12, 
        yFt: Math.floor(newY / 12), 
        yInches: newY % 12, 
        lengthFt: 10, 
        lengthInches: 0, 
        thicknessIn: 4.5,
        floorIndex: currentFloorIndex
      }
    ]);
    setExpandedWallId(nextId);
    setActiveWallSection('interior');
  };

  const updateInteriorWall = (id: number, field: keyof InteriorWallConfig, value: any) => {
    setInteriorWalls(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const updateInteriorWallFields = (id: number, updates: Partial<InteriorWallConfig>) => {
    setInteriorWalls(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const removeInteriorWall = (id: number) => {
    setInteriorWalls(prev => prev.filter(w => w.id !== id));
  };

  const addExteriorWall = () => {
    const nextId = exteriorWalls.length > 0 ? Math.max(...exteriorWalls.map(w => w.id)) + 1 : 200;
    
    let newX = 0;
    let newY = 0;
    let newOrientation: 'horizontal' | 'vertical' = 'horizontal';
    
    if (exteriorWalls.length > 0) {
      const lastWall = exteriorWalls[exteriorWalls.length - 1];
      const lastLen = lastWall.lengthFt * 12 + lastWall.lengthInches;
      const lastX = lastWall.xFt * 12 + lastWall.xInches;
      const lastY = lastWall.yFt * 12 + lastWall.yInches;
      
      if (lastWall.orientation === 'horizontal') {
        newX = lastX + lastLen;
        newY = lastY;
        newOrientation = 'vertical';
      } else {
        newX = lastX;
        newY = lastY + lastLen;
        newOrientation = 'horizontal';
      }
    }

    setExteriorWalls([
      ...exteriorWalls,
      { 
        id: nextId, 
        orientation: newOrientation, 
        xFt: Math.floor(newX / 12), 
        xInches: newX % 12, 
        yFt: Math.floor(newY / 12), 
        yInches: newY % 12, 
        lengthFt: 10, 
        lengthInches: 0, 
        thicknessIn: 6, 
        exteriorSide: 1,
        floorIndex: currentFloorIndex
      }
    ]);
    setExpandedExtWallId(nextId);
    setActiveWallSection('exterior');
  };

  const updateExteriorWall = (id: number, field: keyof ExteriorWallConfig, value: any) => {
    setExteriorWalls(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const updateExteriorWallFields = (id: number, updates: Partial<ExteriorWallConfig>) => {
    setExteriorWalls(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const combineExteriorWalls = () => {
    // Treat each wall as a thin rectangle to find union? 
    // No, better: find all closed loops and union them.
    // Simpler: if we have shapeBlocks, use them.
    
    const rects = shapeBlocks.length > 0 ? [...shapeBlocks] : [];
    
    // If no shape blocks, try to infer them from current exteriorWalls or base shape
    if (rects.length === 0 && shape !== 'custom') {
      const w = widthFt * 12 + widthInches;
      const l = lengthFt * 12 + lengthInches;
      if (w > 0 && l > 0) {
        rects.push({ id: 'base', x: 0, y: 0, w, h: l });
      }
    }

    if (rects.length === 0) return;

    const xCoords = new Set<number>();
    const yCoords = new Set<number>();
    rects.forEach(r => {
      xCoords.add(r.x);
      xCoords.add(r.x + r.w);
      yCoords.add(r.y);
      yCoords.add(r.y + r.h);
    });
    
    const sortedX = Array.from(xCoords).sort((a, b) => a - b);
    const sortedY = Array.from(yCoords).sort((a, b) => a - b);
    
    const grid: boolean[][] = Array(sortedX.length - 1).fill(0).map(() => Array(sortedY.length - 1).fill(false));
    
    rects.forEach(r => {
      const x1 = sortedX.indexOf(r.x);
      const x2 = sortedX.indexOf(r.x + r.w);
      const y1 = sortedY.indexOf(r.y);
      const y2 = sortedY.indexOf(r.y + r.h);
      for (let i = x1; i < x2; i++) {
        for (let j = y1; j < y2; j++) {
          grid[i][j] = true;
        }
      }
    });
    
    const newWalls: ExteriorWallConfig[] = [];
    let wallId = 200;

    // Horizontal segments
    for (let j = 0; j < sortedY.length; j++) {
      let startX: number | null = null;
      let currentSide: 1 | -1 = 1;

      for (let i = 0; i < sortedX.length - 1; i++) {
        const above = j > 0 ? grid[i][j-1] : false;
        const below = j < sortedY.length - 1 ? grid[i][j] : false;
        
        if (above !== below) {
          const side: 1 | -1 = below ? -1 : 1;
          if (startX === null || side !== currentSide) {
            if (startX !== null) {
              const segLen = sortedX[i] - startX;
              if (segLen > 0) {
                newWalls.push({
                  id: wallId++,
                  orientation: 'horizontal',
                  xFt: Math.floor(startX / 12),
                  xInches: startX % 12,
                  yFt: Math.floor(sortedY[j] / 12),
                  yInches: sortedY[j] % 12,
                  lengthFt: Math.floor(segLen / 12),
                  lengthInches: segLen % 12,
                  thicknessIn: wallThicknessIn,
                  exteriorSide: currentSide,
                  floorIndex: currentFloorIndex
                });
              }
            }
            startX = sortedX[i];
            currentSide = side;
          }
        } else {
          if (startX !== null) {
            const segLen2 = sortedX[i] - startX;
            if (segLen2 > 0) {
              newWalls.push({
                id: wallId++,
                orientation: 'horizontal',
                xFt: Math.floor(startX / 12),
                xInches: startX % 12,
                yFt: Math.floor(sortedY[j] / 12),
                yInches: sortedY[j] % 12,
                lengthFt: Math.floor(segLen2 / 12),
                lengthInches: segLen2 % 12,
                thicknessIn: wallThicknessIn,
                exteriorSide: currentSide,
                floorIndex: currentFloorIndex
              });
            }
            startX = null;
          }
        }
      }
      if (startX !== null) {
        const segLen3 = sortedX[sortedX.length-1] - startX;
        if (segLen3 > 0) {
          newWalls.push({
            id: wallId++,
            orientation: 'horizontal',
            xFt: Math.floor(startX / 12),
            xInches: startX % 12,
            yFt: Math.floor(sortedY[j] / 12),
            yInches: sortedY[j] % 12,
            lengthFt: Math.floor(segLen3 / 12),
            lengthInches: segLen3 % 12,
            thicknessIn: wallThicknessIn,
            exteriorSide: currentSide,
            floorIndex: currentFloorIndex
          });
        }
      }
    }

    // Vertical segments
    for (let i = 0; i < sortedX.length; i++) {
      let startY: number | null = null;
      let currentSide: 1 | -1 = 1;

      for (let j = 0; j < sortedY.length - 1; j++) {
        const left = i > 0 ? grid[i-1][j] : false;
        const right = i < sortedX.length - 1 ? grid[i][j] : false;
        
        if (left !== right) {
          const side: 1 | -1 = right ? -1 : 1;
          if (startY === null || side !== currentSide) {
            if (startY !== null) {
              const vSegLen = sortedY[j] - startY;
              if (vSegLen > 0) {
                newWalls.push({
                  id: wallId++,
                  orientation: 'vertical',
                  xFt: Math.floor(sortedX[i] / 12),
                  xInches: sortedX[i] % 12,
                  yFt: Math.floor(startY / 12),
                  yInches: startY % 12,
                  lengthFt: Math.floor(vSegLen / 12),
                  lengthInches: vSegLen % 12,
                  thicknessIn: wallThicknessIn,
                  exteriorSide: currentSide,
                  floorIndex: currentFloorIndex
                });
              }
            }
            startY = sortedY[j];
            currentSide = side;
          }
        } else {
          if (startY !== null) {
            const vSegLen2 = sortedY[j] - startY;
            if (vSegLen2 > 0) {
              newWalls.push({
                id: wallId++,
                orientation: 'vertical',
                xFt: Math.floor(sortedX[i] / 12),
                xInches: sortedX[i] % 12,
                yFt: Math.floor(startY / 12),
                yInches: startY % 12,
                lengthFt: Math.floor(vSegLen2 / 12),
                lengthInches: vSegLen2 % 12,
                thicknessIn: wallThicknessIn,
                exteriorSide: currentSide,
                floorIndex: currentFloorIndex
              });
            }
            startY = null;
          }
        }
      }
      if (startY !== null) {
        const vSegLen3 = sortedY[sortedY.length-1] - startY;
        if (vSegLen3 > 0) {
          newWalls.push({
            id: wallId++,
            orientation: 'vertical',
            xFt: Math.floor(sortedX[i] / 12),
            xInches: sortedX[i] % 12,
            yFt: Math.floor(startY / 12),
            yInches: startY % 12,
            lengthFt: Math.floor(vSegLen3 / 12),
            lengthInches: vSegLen3 % 12,
            thicknessIn: wallThicknessIn,
            exteriorSide: currentSide,
            floorIndex: currentFloorIndex
          });
        }
      }
    }

    setShape('custom');
    setFoundationShape('custom');
    setExteriorWalls(newWalls);
    setCombinedBlocks([...rects]);
    setShapeBlocks([]); // Clear blocks after combining
  };

  const removeExteriorWall = (id: number) => {
    setExteriorWalls(prev => prev.filter(w => w.id !== id));
  };

  const updateDoorFields = (id: string, updates: Partial<DoorConfig>) => {
    setDoors(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updates };
        const wallLen = getWallLength(updated.wall);
        const x = updated.xFt * 12 + updated.xInches;
        if (x + updated.widthIn > wallLen) {
          const maxPos = Math.max(0, wallLen - updated.widthIn);
          updated.xFt = Math.floor(maxPos / 12);
          updated.xInches = maxPos % 12;
        }
        return updated;
      }
      return d;
    }));
  };

  const updateWindowFields = (id: string, updates: Partial<WindowConfig>) => {
    setWindows(prev => prev.map(w => {
      if (w.id === id) {
        const updated = { ...w, ...updates };
        const wallLen = getWallLength(updated.wall);
        const x = updated.xFt * 12 + updated.xInches;
        if (x + updated.widthIn > wallLen) {
          const maxPos = Math.max(0, wallLen - updated.widthIn);
          updated.xFt = Math.floor(maxPos / 12);
          updated.xInches = maxPos % 12;
        }
        return updated;
      }
      return w;
    }));
  };

  const getSnapPoints = (axis: 'x' | 'y', excludeWallId?: number, excludeOpeningId?: string): SnapPoint[] => {
    const points: SnapPoint[] = [];
    const addPoint = (pos: number, crossPos?: number, type: 'end' | 'mid' = 'end') => {
      const existingIdx = points.findIndex(p => Math.abs(p.pos - pos) < 0.1);
      if (existingIdx !== -1) {
        if (type === 'mid') {
          points[existingIdx].type = 'mid';
          points[existingIdx].crossPos = crossPos;
        }
        return;
      }
      points.push({ pos, crossPos, type });
    };
    const w = widthFt * 12 + widthInches;
    const l = lengthFt * 12 + lengthInches;
    const t = wallThicknessIn;

    if (shape === 'rectangle') {
      if (axis === 'x') {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(w - t, t);
        addPoint(w, 0);
        addPoint(w / 2, 0, 'mid');
        addPoint(w / 2, l, 'mid');
        addPoint(w / 2, t, 'mid');
        addPoint(w / 2, l - t, 'mid');
      } else {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(l - t, l - t);
        addPoint(l, l);
        addPoint(l / 2, 0, 'mid');
        addPoint(l / 2, w, 'mid');
        addPoint(l / 2, t, 'mid');
        addPoint(l / 2, w - t, 'mid');
      }
    } else if (shape === 'l-shape') {
      const l1 = lRightDepthFt * 12 + lRightDepthInches;
      const w2 = lBackWidthFt * 12 + lBackWidthInches;
      if (axis === 'x') {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(w - t, t);
        addPoint(w, 0);
        addPoint(w2, l1);
        addPoint(w2 + t, l1 - t);
        addPoint(w / 2, 0, 'mid');
        addPoint(w2 / 2, l, 'mid');
        addPoint((w + w2) / 2, l1, 'mid');
      } else {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(l - t, l - t);
        addPoint(l, l);
        addPoint(l1 - t, l1 - t);
        addPoint(l1, l1);
        addPoint(l / 2, 0, 'mid');
        addPoint(l1 / 2, w, 'mid');
        addPoint((l + l1) / 2, w2, 'mid');
      }
    } else if (shape === 'u-shape') {
      const u_w1 = uWalls.w1 * 12 + uWallsInches.w1;
      const u_w2 = uWalls.w2 * 12 + uWallsInches.w2;
      const u_w3 = uWalls.w3 * 12 + uWallsInches.w3;
      const u_w4 = uWalls.w4 * 12 + uWallsInches.w4;
      const u_w7 = uWalls.w7 * 12 + uWallsInches.w7;
      const u_w8 = uWalls.w8 * 12 + uWallsInches.w8;
      
      if (axis === 'x') {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(u_w1, 0);
        addPoint(u_w1 - t, t);
        addPoint(u_w1 - u_w3, u_w2);
        addPoint(u_w1 - u_w3 + t, u_w2 - t);
        addPoint(u_w7 - t, u_w2 - u_w4 + t);
        addPoint(u_w7, u_w2 - u_w4);
        addPoint(u_w1 / 2, 0, 'mid');
        addPoint((u_w1 - u_w3 + u_w1) / 2, u_w2, 'mid');
        addPoint((u_w1 - u_w3) / 2, u_w2 - u_w4, 'mid');
      } else {
        addPoint(0, 0);
        addPoint(t, t);
        addPoint(u_w2, u_w1);
        addPoint(u_w2 - t, u_w1 - t);
        addPoint(u_w2 - u_w4, u_w1 - u_w3);
        addPoint(u_w2 - u_w4 - t, u_w1 - u_w3 + t);
        addPoint(u_w8, u_w7);
        addPoint(u_w8 - t, u_w7 - t);
        addPoint(u_w2 / 2, u_w1, 'mid');
        addPoint((u_w2 - u_w4 + u_w2) / 2, u_w1 - u_w3, 'mid');
        addPoint((u_w2 - u_w4) / 2, u_w7, 'mid');
      }
    }

    interiorWalls.forEach(wall => {
      if (wall.id === excludeWallId) return;
      const wx = wall.xFt * 12 + wall.xInches;
      const wy = wall.yFt * 12 + wall.yInches;
      const wlen = wall.lengthFt * 12 + wall.lengthInches;
      const wth = wall.thicknessIn;

      if (axis === 'x') {
        addPoint(wx, wy);
        addPoint(wx + (wall.orientation === 'horizontal' ? wlen : wth), wy);
        addPoint(wx + (wall.orientation === 'horizontal' ? wlen / 2 : wth / 2), wy, 'mid');
      } else {
        addPoint(wy, wx);
        addPoint(wy + (wall.orientation === 'vertical' ? wlen : wth), wx);
        addPoint(wy + (wall.orientation === 'vertical' ? wlen / 2 : wth / 2), wx, 'mid');
      }
    });

    exteriorWalls.forEach(wall => {
      if (wall.id === excludeWallId) return;
      let wx = wall.xFt * 12 + wall.xInches;
      let wy = wall.yFt * 12 + wall.yInches;
      const wlen = wall.lengthFt * 12 + wall.lengthInches;
      const wth = wall.thicknessIn;

      // Apply exteriorSide shift to match Preview2D rendering
      if (wall.orientation === 'horizontal') {
        if (wall.exteriorSide === 1) wy -= wth;
      } else {
        if (wall.exteriorSide === 1) wx -= wth;
      }

      if (axis === 'x') {
        addPoint(wx, wy);
        addPoint(wx + (wall.orientation === 'horizontal' ? wlen : wth), wy);
        addPoint(wx + (wall.orientation === 'horizontal' ? wlen / 2 : wth / 2), wy, 'mid');
      } else {
        addPoint(wy, wx);
        addPoint(wy + (wall.orientation === 'vertical' ? wlen : wth), wx);
        addPoint(wy + (wall.orientation === 'vertical' ? wlen / 2 : wth / 2), wx, 'mid');
      }
    });

    // Bumpout Snap Points
    bumpouts.forEach(b => {
      const wallId = b.wall;
      // We need to know the wall's position and orientation
      // For simplicity, we'll check standard walls and custom exterior walls
      let wx = 0, wy = 0, isHoriz = true, extDir = 1;
      
      const extWall = exteriorWalls.find(w => w.id === wallId);
      if (extWall) {
        wx = extWall.xFt * 12 + extWall.xInches;
        wy = extWall.yFt * 12 + extWall.yInches;
        isHoriz = extWall.orientation === 'horizontal';
        extDir = extWall.exteriorSide;
      } else {
        // Standard walls (1-4 for rectangle, etc.)
        const t = wallThicknessIn;
        const w = widthFt * 12 + widthInches;
        const l = lengthFt * 12 + lengthInches;
        if (wallId === 1) { wx = 0; wy = 0; isHoriz = true; extDir = -1; }
        else if (wallId === 2) { wx = w - t; wy = t; isHoriz = false; extDir = 1; }
        else if (wallId === 3) { wx = 0; wy = l - t; isHoriz = true; extDir = 1; }
        else if (wallId === 4) { wx = 0; wy = t; isHoriz = false; extDir = -1; }
        // ... add more for L and U shapes if needed, but this covers most cases
      }

      const bx = b.xFt * 12 + b.xInches;
      const bw = b.widthIn;
      const bd = b.depthIn;
      const t = wallThicknessIn;

      if (isHoriz) {
        if (axis === 'x') {
          addPoint(wx + bx, wy);
          addPoint(wx + bx + bw, wy);
          addPoint(wx + bx + bw / 2, wy, 'mid');
        } else {
          const y = wy + extDir * (bd - t);
          addPoint(y, wx + bx + bw / 2);
          addPoint(y + t, wx + bx + bw / 2);
        }
      } else {
        if (axis === 'x') {
          const x = wx + extDir * (bd - t);
          addPoint(x, wy + bx + bw / 2);
          addPoint(x + t, wy + bx + bw / 2);
        } else {
          addPoint(wy + bx, wx);
          addPoint(wy + bx + bw, wx);
          addPoint(wy + bx + bw / 2, wx, 'mid');
        }
      }
    });
    
    // Opening Snap Points
    doors.forEach(d => {
      if (d.id === excludeOpeningId) return;
      const wallId = d.wall;
      const extWall = exteriorWalls.find(w => w.id === wallId);
      const intWall = interiorWalls.find(w => w.id === wallId);
      let wx = 0, wy = 0, isHoriz = true;
      if (extWall) {
        wx = extWall.xFt * 12 + extWall.xInches;
        wy = extWall.yFt * 12 + extWall.yInches;
        isHoriz = extWall.orientation === 'horizontal';
      } else if (intWall) {
        wx = intWall.xFt * 12 + intWall.xInches;
        wy = intWall.yFt * 12 + intWall.yInches;
        isHoriz = intWall.orientation === 'horizontal';
      } else {
        const t = wallThicknessIn;
        const w = widthFt * 12 + widthInches;
        const l = lengthFt * 12 + lengthInches;
        if (wallId === 1) { wx = 0; wy = 0; isHoriz = true; }
        else if (wallId === 2) { wx = w - t; wy = t; isHoriz = false; }
        else if (wallId === 3) { wx = 0; wy = l - t; isHoriz = true; }
        else if (wallId === 4) { wx = 0; wy = t; isHoriz = false; }
      }
      const ox = d.xFt * 12 + d.xInches;
      const ow = d.widthIn;
      if (isHoriz && axis === 'x') {
        addPoint(wx + ox, wy);
        addPoint(wx + ox + ow, wy);
        addPoint(wx + ox + ow / 2, wy, 'mid');
      } else if (!isHoriz && axis === 'y') {
        addPoint(wy + ox, wx);
        addPoint(wy + ox + ow, wx);
        addPoint(wy + ox + ow / 2, wx, 'mid');
      }
    });

    windows.forEach(w => {
      if (w.id === excludeOpeningId) return;
      const wallId = w.wall;
      const extWall = exteriorWalls.find(wall => wall.id === wallId);
      const intWall = interiorWalls.find(wall => wall.id === wallId);
      let wx = 0, wy = 0, isHoriz = true;
      if (extWall) {
        wx = extWall.xFt * 12 + extWall.xInches;
        wy = extWall.yFt * 12 + extWall.yInches;
        isHoriz = extWall.orientation === 'horizontal';
      } else if (intWall) {
        wx = intWall.xFt * 12 + intWall.xInches;
        wy = intWall.yFt * 12 + intWall.yInches;
        isHoriz = intWall.orientation === 'horizontal';
      } else {
        const t = wallThicknessIn;
        const width = widthFt * 12 + widthInches;
        const length = lengthFt * 12 + lengthInches;
        if (wallId === 1) { wx = 0; wy = 0; isHoriz = true; }
        else if (wallId === 2) { wx = width - t; wy = t; isHoriz = false; }
        else if (wallId === 3) { wx = 0; wy = length - t; isHoriz = true; }
        else if (wallId === 4) { wx = 0; wy = t; isHoriz = false; }
      }
      const ox = w.xFt * 12 + w.xInches;
      const ow = w.widthIn;
      if (isHoriz && axis === 'x') {
        addPoint(wx + ox, wy);
        addPoint(wx + ox + ow, wy);
        addPoint(wx + ox + ow / 2, wy, 'mid');
      } else if (!isHoriz && axis === 'y') {
        addPoint(wy + ox, wx);
        addPoint(wy + ox + ow, wx);
        addPoint(wy + ox + ow / 2, wx, 'mid');
      }
    });

    // Add guides to snap points
    guides.forEach(guide => {
      if (axis === 'x') {
        addPoint(guide.p1.x, guide.p1.y);
        addPoint(guide.p2.x, guide.p2.y);
      } else {
        addPoint(guide.p1.y, guide.p1.x);
        addPoint(guide.p2.y, guide.p2.x);
      }
    });

    return points.sort((a, b) => a.pos - b.pos);
  };

  const handleSnap = (wallId: number, field: 'x' | 'y' | 'length') => {
    const wall = interiorWalls.find(w => w.id === wallId) || exteriorWalls.find(w => w.id === wallId);
    if (!wall) return;

    const isInterior = interiorWalls.some(w => w.id === wallId);
    const updateFields = isInterior ? updateInteriorWallFields : updateExteriorWallFields;

    const currentX = wall.xFt * 12 + wall.xInches;
    const currentY = wall.yFt * 12 + wall.yInches;
    const currentLen = wall.lengthFt * 12 + wall.lengthInches;
    const th = wall.thicknessIn;

    if (field === 'x') {
      const snapPoints = getSnapPoints('x', wallId);
      if (snapPoints.length === 0) return;
      
      const width = wall.orientation === 'horizontal' ? currentLen : th;
      let bestX = currentX;
      let minDiff = Infinity;

      for (const p of snapPoints) {
        // Try snapping left edge to p
        const diffLeft = Math.abs(currentX - p.pos);
        if (diffLeft < minDiff) {
          minDiff = diffLeft;
          bestX = p.pos;
        }
        // Try snapping right edge to p
        const diffRight = Math.abs((currentX + width) - p.pos);
        if (diffRight < minDiff) {
          minDiff = diffRight;
          bestX = p.pos - width;
        }
      }
      
      updateFields(wallId, { xFt: Math.floor(Math.round(bestX) / 12), xInches: Math.round(bestX) % 12 });
    } else if (field === 'y') {
      const snapPoints = getSnapPoints('y', wallId);
      if (snapPoints.length === 0) return;
      
      const height = wall.orientation === 'vertical' ? currentLen : th;
      let bestY = currentY;
      let minDiff = Infinity;

      for (const p of snapPoints) {
        // Try snapping top edge to p
        const diffTop = Math.abs(currentY - p.pos);
        if (diffTop < minDiff) {
          minDiff = diffTop;
          bestY = p.pos;
        }
        // Try snapping bottom edge to p
        const diffBottom = Math.abs((currentY + height) - p.pos);
        if (diffBottom < minDiff) {
          minDiff = diffBottom;
          bestY = p.pos - height;
        }
      }
      
      updateFields(wallId, { yFt: Math.floor(Math.round(bestY) / 12), yInches: Math.round(bestY) % 12 });
    } else if (field === 'length') {
      const isHoriz = wall.orientation === 'horizontal';
      const snapPoints = getSnapPoints(isHoriz ? 'x' : 'y', wallId);
      if (snapPoints.length === 0) return;
      
      const currentStart = isHoriz ? currentX : currentY;
      const currentEnd = currentStart + currentLen;
      
      let bestStart = currentStart;
      let bestEnd = currentEnd;
      let minStartDiff = Infinity;
      let minEndDiff = Infinity;

      for (const p of snapPoints) {
        // Find closest point to start (left/top)
        const diffS = Math.abs(currentStart - p.pos);
        if (diffS < minStartDiff) {
          minStartDiff = diffS;
          bestStart = p.pos;
        }
        // Find closest point to end (right/bottom)
        const diffE = Math.abs(currentEnd - p.pos);
        if (diffE < minEndDiff) {
          minEndDiff = diffE;
          bestEnd = p.pos;
        }
      }
      
      const newLen = Math.round(bestEnd - bestStart);
      if (newLen > 0) {
        const updates: any = {
          lengthFt: Math.floor(newLen / 12),
          lengthInches: newLen % 12
        };
        const roundedStart = Math.round(bestStart);
        if (isHoriz) {
          updates.xFt = Math.floor(roundedStart / 12);
          updates.xInches = roundedStart % 12;
        } else {
          updates.yFt = Math.floor(roundedStart / 12);
          updates.yInches = roundedStart % 12;
        }
        updateFields(wallId, updates);
      }
    }
  };

  const handleSnapToPrevious = (wallId: number) => {
    const isInterior = interiorWalls.some(w => w.id === wallId);
    const walls = isInterior ? interiorWalls : exteriorWalls;
    const wallIndex = walls.findIndex(w => w.id === wallId);
    if (wallIndex <= 0) return; // No previous wall in this list

    const prevWall = walls[wallIndex - 1];
    const updateFields = isInterior ? updateInteriorWallFields : updateExteriorWallFields;

    const prevLen = prevWall.lengthFt * 12 + prevWall.lengthInches;
    const prevX = prevWall.xFt * 12 + prevWall.xInches;
    const prevY = prevWall.yFt * 12 + prevWall.yInches;

    let newX = prevX;
    let newY = prevY;

    if (prevWall.orientation === 'horizontal') {
      newX = prevX + prevLen;
      newY = prevY;
    } else {
      newX = prevX;
      newY = prevY + prevLen;
    }

    updateFields(wallId, {
      xFt: Math.floor(newX / 12),
      xInches: newX % 12,
      yFt: Math.floor(newY / 12),
      yInches: newY % 12
    });
  };

  const generateRubyCode = useCallback((sectionOverride?: GenerationSection) => {
    const selectedTrussScript = importedRubyFiles.find(f => f.name === currentState.customTrussScript);
    let code = generateSketchUpCode(currentState, sectionOverride || generationSection, selectedTrussScript?.content);
    
    if (importedRubyFiles.length > 0) {
      code += "\n\n# --- IMPORTED RUBY FILES ---\n";
      importedRubyFiles.forEach(file => {
        // Don't append the custom truss script again if it's already injected
        if (file.name === currentState.customTrussScript) return;
        code += `\n# --- BEGIN ${file.name} ---\n`;
        code += file.content;
        code += `\n# --- END ${file.name} ---\n`;
      });
    }
    
    return code;
  }, [currentState, generationSection, importedRubyFiles]);
    /*
update_wall_id = ${updateWallId || 'nil'}
shape = '${shape}'
width_in = ${(widthFt * 12) + widthInches}
length_in = ${(lengthFt * 12) + lengthInches}
lRightDepthIn = ${(lRightDepthFt * 12) + lRightDepthInches}
lBackWidthIn = ${(lBackWidthFt * 12) + lBackWidthInches}
u_w1 = ${(uWalls.w1 * 12) + uWallsInches.w1}
u_w2 = ${(uWalls.w2 * 12) + uWallsInches.w2}
u_w3 = ${(uWalls.w3 * 12) + uWallsInches.w3}
u_w4 = ${(uWalls.w4 * 12) + uWallsInches.w4}
u_w5 = ${(uWalls.w5 * 12) + uWallsInches.w5}
u_w6 = ${(uWalls.w6 * 12) + uWallsInches.w6}
u_w7 = ${(uWalls.w7 * 12) + uWallsInches.w7}
u_w8 = ${(uWalls.w8 * 12) + uWallsInches.w8}
u_direction = '${uDirection}'
l_direction = '${lDirection}'
wall_height_in = ${(wallHeightFt * 12) + wallHeightInches}
wall_thickness_in = ${wallThicknessIn}
add_sheathing = ${addSheathing ? 'true' : 'false'}
sheathing_thickness = ${sheathingThickness}
add_insulation = ${addInsulation ? 'true' : 'false'}
insulation_thickness = ${insulationThickness}
add_drywall = ${addDrywall ? 'true' : 'false'}
drywall_thickness = ${drywallThickness}
foundation_type = '${foundationType}'
stem_wall_height = ${stemWallHeightIn}
stem_wall_thickness = ${stemWallThicknessIn}
footing_width = ${footingWidthIn}
footing_thickness = ${footingThicknessIn}
foundation_shape = '${foundationShape}'

# --- FLOOR OPTIONS ---
add_floor_framing = ${addFloorFraming ? 'true' : 'false'}
joist_spacing = ${joistSpacing}
joist_size = '${joistSize}'
joist_direction = '${joistDirection}'
add_subfloor = ${addSubfloor ? 'true' : 'false'}
subfloor_thickness = ${subfloorThickness}
subfloor_material = '${subfloorMaterial}'
rim_joist_thickness = ${rimJoistThickness}
floor_bays = [
${floorBays.length > 0 ? floorBays.map(b => `  { label: '${b.label}', dir: '${b.joistDirection}', x: ${b.x}, y: ${b.y}, w: ${b.width}, h: ${b.height} },`).join('
') : ''}
]

# --- BUMPOUTS ---
bumpouts = [
${bumpoutsRubyArray}
]

# --- DOOR PLACEMENT ---
doors = [
${doorsRubyArray}
]

# --- WINDOW PLACEMENT ---
windows = [
${windowsRubyArray}
]

# --- INTERIOR WALLS ---
interior_walls = [
${interiorWallsRubyArray}
]

# --- CUSTOM EXTERIOR WALLS ---
custom_exterior_walls = [
${exteriorWallsRubyArray}
]

# --- FRAMING OPTIONS ---
stud_spacing = ${studSpacing}
stud_thickness = ${studThickness}
header_type = '${headerType}'
header_height = ${headerHeight}
bottom_plates = ${bottomPlates}
top_plates = ${topPlates}
plate_height = 1.5
door_ro_allowance = ${doorRoAllowance}
window_ro_allowance = ${windowRoAllowance}
# -------------------------------

# Conversion math
shape = '${shape}'
foundation_shape = '${foundationShape}'
w = width_in
l = length_in
l1 = lRightDepthIn
w2 = lBackWidthIn
h = wall_height_in
t = wall_thickness_in

model = Sketchup.active_model

# --- SETUP TAGS ---
model.layers.add("Dimensions")
model.layers.add("Notations")
model.layers.add("Floor Framing")
model.layers.add("Subfloor")

is_new_shell = false
if update_wall_id
  model.start_operation("Update Wall #{update_wall_id}", true)
  shell_group = model.active_entities.grep(Sketchup::Group).find { |g| g.get_attribute('HouseShell', 'is_shell') }
  if shell_group
    framing_group = shell_group
    shell_group.entities.grep(Sketchup::Group).each do |g|
      wid = g.get_attribute('HouseShell', 'wall_id')
      if wid == update_wall_id || (wid.is_a?(String) && wid.start_with?("#{update_wall_id}_b_"))
        g.erase!
      end
    end
  else
    framing_group = model.active_entities.add_group
    framing_group.name = "House Shell"
    framing_group.set_attribute('HouseShell', 'is_shell', true)
    is_new_shell = true
  end
else
  model.start_operation('Generate House Shell', true)
  framing_group = model.active_entities.add_group
  framing_group.name = "House Shell"
  framing_group.set_attribute('HouseShell', 'is_shell', true)
  is_new_shell = true
end

f_ents = framing_group.entities

# --- FOUNDATION GROUP ---
fd_ents = nil
if update_wall_id.nil? && foundation_type != 'none'
  foundation_group = framing_group.entities.add_group
  foundation_group.name = "Foundation"
  fd_ents = foundation_group.entities
end

# 1. Generate Framing
draw_box = -> (ents, x, y, z, w, d, h, name) {
  return if w <= 0.01 || d <= 0.01 || h <= 0.01
  g = ents.add_group
  g.name = name
  g.layer = model.layers.add(name)
  pts = [[x,y,z], [x+w,y,z], [x+w,y+d,z], [x,y+d,z]]
  face = g.entities.add_face(pts)
  if face
    face.reverse! if face.normal.z < 0
    face.pushpull(h)
  end
}

# --- FLOOR FRAMING ---
if add_floor_framing && update_wall_id.nil?
  floor_group = framing_group.entities.add_group
  floor_group.name = "Floor System"
  floor_group.layer = model.layers["Floor Framing"] || model.layers.add("Floor Framing")
  fl_ents = floor_group.entities
  
  joist_h = case joist_size
    when '2x6' then 5.5
    when '2x8' then 7.25
    when '2x10' then 9.25
    when '2x12' then 11.25
    else 9.25
  end
  
  draw_joist = -> (x, y, z, w, d, h) {
    draw_box.call(fl_ents, x, y, z, w, d, h, "Floor Joist")
  }
  
  if floor_bays.length > 0
    # --- Per-bay joist rendering ---
    floor_bays.each do |bay|
      bx = bay[:x]
      by = bay[:y]
      bw = bay[:w]
      bh = bay[:h]
      bd = bay[:dir]
      rt = rim_joist_thickness
      t = 1.5
      
      if bd == 'y'
        # Rim joists: front and back of bay
        draw_box.call(fl_ents, bx, by, -joist_h, bw, rt, joist_h, "Rim Joist")
        draw_box.call(fl_ents, bx, by + bh - rt, -joist_h, bw, rt, joist_h, "Rim Joist")
        # Joists spaced along X, each runs along Y
        num_j = (bw / joist_spacing).ceil + 1
        num_j.times do |i|
          jx = bx + i * joist_spacing
          jx = bx + bw - t if jx + t > bx + bw
          jx = bx if jx < bx
          draw_joist.call(jx, by + rt, -joist_h, t, bh - 2 * rt, joist_h)
        end
      else
        # Rim joists: left and right of bay
        draw_box.call(fl_ents, bx, by, -joist_h, rt, bh, joist_h, "Rim Joist")
        draw_box.call(fl_ents, bx + bw - rt, by, -joist_h, rt, bh, joist_h, "Rim Joist")
        # Joists spaced along Y, each runs along X
        num_j = (bh / joist_spacing).ceil + 1
        num_j.times do |i|
          jy = by + i * joist_spacing
          jy = by + bh - t if jy + t > by + bh
          jy = by if jy < by
          draw_joist.call(bx + rt, jy, -joist_h, bw - 2 * rt, t, joist_h)
        end
      end
    end
  elsif joist_direction == 'y'
    # Rim joists (front and back)
    draw_box.call(fl_ents, 0, 0, -joist_h, w, rim_joist_thickness, joist_h, "Rim Joist")
    if shape == 'rectangle'
      draw_box.call(fl_ents, 0, l - rim_joist_thickness, -joist_h, w, rim_joist_thickness, joist_h, "Rim Joist")
    elsif shape == 'l-shape'
      draw_box.call(fl_ents, 0, l - rim_joist_thickness, -joist_h, w2, rim_joist_thickness, joist_h, "Rim Joist")
      draw_box.call(fl_ents, w2, l1 - rim_joist_thickness, -joist_h, w - w2, rim_joist_thickness, joist_h, "Rim Joist")
    elsif shape == 'u-shape'
      draw_box.call(fl_ents, 0, u_w8 - rim_joist_thickness, -joist_h, u_w7, rim_joist_thickness, joist_h, "Rim Joist")
      draw_box.call(fl_ents, u_w1 - u_w3, u_w2 - rim_joist_thickness, -joist_h, u_w3, rim_joist_thickness, joist_h, "Rim Joist")
      draw_box.call(fl_ents, u_w7, u_w2 - u_w4 - rim_joist_thickness, -joist_h, u_w1 - u_w3 - u_w7, rim_joist_thickness, joist_h, "Rim Joist")
    end

    # Joists run in Y direction, spaced along X
    num_joists = (w / joist_spacing).ceil + 1
    num_joists.times do |i|
      jx = i * joist_spacing
      jx = w - 1.5 if jx + 1.5 > w
      
      if shape == 'rectangle'
        draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, l - 2 * rim_joist_thickness, joist_h)
      elsif shape == 'l-shape'
        if jx < w2
          draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, l - 2 * rim_joist_thickness, joist_h)
        else
          draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, l1 - 2 * rim_joist_thickness, joist_h)
        end
      elsif shape == 'u-shape'
        if jx < u_w7
          draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, u_w8 - 2 * rim_joist_thickness, joist_h)
        elsif jx < (u_w1 - u_w3)
          draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, u_w2 - u_w4 - 2 * rim_joist_thickness, joist_h)
        else
          draw_joist.call(jx, rim_joist_thickness, -joist_h, 1.5, u_w2 - 2 * rim_joist_thickness, joist_h)
        end
      end
    end
  else
    # Rim joists (left and right)
    draw_box.call(fl_ents, 0, 0, -joist_h, rim_joist_thickness, l, joist_h, "Rim Joist")
    if shape == 'rectangle'
      draw_box.call(fl_ents, w - rim_joist_thickness, 0, -joist_h, rim_joist_thickness, l, joist_h, "Rim Joist")
    elsif shape == 'l-shape'
      draw_box.call(fl_ents, w - rim_joist_thickness, 0, -joist_h, rim_joist_thickness, l1, joist_h, "Rim Joist")
      draw_box.call(fl_ents, w2 - rim_joist_thickness, l1, -joist_h, rim_joist_thickness, l - l1, joist_h, "Rim Joist")
    elsif shape == 'u-shape'
      draw_box.call(fl_ents, u_w1 - rim_joist_thickness, 0, -joist_h, rim_joist_thickness, u_w2, joist_h, "Rim Joist")
      draw_box.call(fl_ents, u_w7 - rim_joist_thickness, u_w2 - u_w4, -joist_h, rim_joist_thickness, u_w8 - (u_w2 - u_w4), joist_h, "Rim Joist")
    end

    # Joists run in X direction, spaced along Y
    num_joists = (l / joist_spacing).ceil + 1
    num_joists.times do |i|
      jy = i * joist_spacing
      jy = l - 1.5 if jy + 1.5 > l
      
      if shape == 'rectangle'
        draw_joist.call(rim_joist_thickness, jy, -joist_h, w - 2 * rim_joist_thickness, 1.5, joist_h)
      elsif shape == 'l-shape'
        if jy < l1
          draw_joist.call(rim_joist_thickness, jy, -joist_h, w - 2 * rim_joist_thickness, 1.5, joist_h)
        else
          draw_joist.call(rim_joist_thickness, jy, -joist_h, w2 - 2 * rim_joist_thickness, 1.5, joist_h)
        end
      elsif shape == 'u-shape'
        if jy < (u_w2 - u_w4)
          draw_joist.call(rim_joist_thickness, jy, -joist_h, u_w1 - 2 * rim_joist_thickness, 1.5, joist_h)
        else
          # Left leg
          draw_joist.call(rim_joist_thickness, jy, -joist_h, u_w7 - 2 * rim_joist_thickness, 1.5, joist_h)
          # Right leg
          draw_joist.call(u_w1 - u_w3 + rim_joist_thickness, jy, -joist_h, u_w3 - 2 * rim_joist_thickness, 1.5, joist_h)
        end
      end
    end
  end
  
  # Subfloor
  if add_subfloor
    sf_z = 0
    sf_group = fl_ents.add_group
    sf_group.name = "Subfloor"
    sf_group.layer = model.layers["Subfloor"] || model.layers.add("Subfloor")
    
    # Material
    mat_name = subfloor_material == 'plywood' ? "Subfloor_Plywood" : "Subfloor_OSB"
    mat = model.materials[mat_name] || model.materials.add(mat_name)
    if subfloor_material == 'plywood'
      mat.color = Sketchup::Color.new(222, 184, 135) # BurlyWood
    else
      mat.color = Sketchup::Color.new(205, 133, 63) # Peru
    end
    sf_group.material = mat

    if shape == 'rectangle'
      draw_box.call(sf_group.entities, 0, 0, sf_z - subfloor_thickness, w, l, subfloor_thickness, "Subfloor Panel")
    elsif shape == 'l-shape'
      pts = [[0,0, sf_z - subfloor_thickness], [w,0, sf_z - subfloor_thickness], [w,l1, sf_z - subfloor_thickness], [w2,l1, sf_z - subfloor_thickness], [w2,l, sf_z - subfloor_thickness], [0,l, sf_z - subfloor_thickness]]
      face = sf_group.entities.add_face(pts)
      face.pushpull(subfloor_thickness) if face
    elsif shape == 'u-shape'
      pts = [[0,0, sf_z - subfloor_thickness], [u_w1,0, sf_z - subfloor_thickness], [u_w1,u_w2, sf_z - subfloor_thickness], [u_w1-u_w3,u_w2, sf_z - subfloor_thickness], [u_w1-u_w3,u_w2-u_w4, sf_z - subfloor_thickness], [u_w7,u_w2-u_w4, sf_z - subfloor_thickness], [u_w7,u_w8, sf_z - subfloor_thickness], [0,u_w8, sf_z - subfloor_thickness]]
      face = sf_group.entities.add_face(pts)
      face.pushpull(subfloor_thickness) if face
    end
  end
end

draw_foundation = -> (start_x, start_y, length, depth, is_x_dir, ext_dir) {
  return if foundation_type == 'none' || fd_ents.nil?
  
  if foundation_type == 'stem-wall'
    sw_z = -stem_wall_height
    sw_h = stem_wall_height
    sw_t = stem_wall_thickness
    
    ft_z = sw_z - footing_thickness
    ft_h = footing_thickness
    ft_w = footing_width
    
    if is_x_dir
      sw_y = start_y + (depth - sw_t) / 2.0
      draw_box.call(fd_ents, start_x, sw_y, sw_z, length, sw_t, sw_h, "Stem Wall")
      
      ft_y = start_y + (depth - ft_w) / 2.0
      draw_box.call(fd_ents, start_x, ft_y, ft_z, length, ft_w, ft_h, "Footing")
    else
      sw_x = start_x + (depth - sw_t) / 2.0
      draw_box.call(fd_ents, sw_x, start_y, sw_z, sw_t, length, sw_h, "Stem Wall")
      
      ft_x = start_x + (depth - ft_w) / 2.0
      draw_box.call(fd_ents, ft_x, start_y, ft_z, ft_w, length, ft_h, "Footing")
    end
  elsif foundation_type == 'slab'
    slab_h = 4
    if is_x_dir
      draw_box.call(fd_ents, start_x, start_y, -slab_h, length, depth, slab_h, "Slab Edge")
    else
      draw_box.call(fd_ents, start_x, start_y, -slab_h, depth, length, slab_h, "Slab Edge")
    end
  end
}

draw_header = -> (ents, x, y, z, w_box, d_box, h, type, is_x) {
  if type == 'single'
    hw = is_x ? w_box : stud_thickness
    hd = is_x ? stud_thickness : d_box
    draw_box.call(ents, x, y, z, hw, hd, h, "Header (Single)")
  elsif type == 'double'
    hw = is_x ? w_box : stud_thickness
    hd = is_x ? stud_thickness : d_box
    draw_box.call(ents, x, y, z, hw, hd, h, "Header (Double Ext)")
    ix = is_x ? x : x + w_box - stud_thickness
    iy = is_x ? y + d_box - stud_thickness : y
    draw_box.call(ents, ix, iy, z, hw, hd, h, "Header (Double Int)")
  else
    draw_box.call(ents, x, y, z, w_box, d_box, h, "Header (#{type.upcase})")
  end
}

stud_h = h - (bottom_plates + top_plates) * plate_height
start_z = bottom_plates * plate_height

bumpout_walls_to_draw = []

draw_wall_framing = -> (wall_id, start_x, start_y, length, depth, is_x_dir, ext_dir, sh_start = 0, sh_end = 0, is_interior = false, add_corners = false) {
  wall_group = f_ents.add_group
  wall_group.name = "Wall #{wall_id}"
  wall_group.set_attribute('HouseShell', 'wall_id', wall_id)
  w_ents = wall_group.entities

  wall_bumpouts = bumpouts.select { |b| b[:wall] == wall_id }.map do |b|
    bx = b[:x_in]
    local_ox = bx
    { id: b[:id], local_ox: local_ox, w: b[:width_in], d: b[:depth_in] }
  end

  wall_bumpouts.each do |b|
    if is_x_dir
      sy = ext_dir == 1 ? start_y : start_y - b[:d] + depth
      # Left wall (Side 1)
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_l", start_x + b[:local_ox], sy, b[:d], depth, false, -1, 0, 0, false, true]
      # Right wall (Side 2)
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_r", start_x + b[:local_ox] + b[:w] - depth, sy, b[:d], depth, false, 1, 0, 0, false, true]
      # Front wall
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_f", start_x + b[:local_ox], start_y + ext_dir * (b[:d] - depth), b[:w], depth, true, ext_dir, depth, depth, false, true]
    else
      sx = ext_dir == 1 ? start_x : start_x - b[:d] + depth
      # Left wall (Side 1)
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_l", sx, start_y + b[:local_ox], b[:d], depth, true, -1, 0, 0, false, true]
      # Right wall (Side 2)
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_r", sx, start_y + b[:local_ox] + b[:w] - depth, b[:d], depth, true, 1, 0, 0, false, true]
      # Front wall
      bumpout_walls_to_draw << ["#{wall_id}_b_#{b[:id]}_f", start_x + ext_dir * (b[:d] - depth), start_y + b[:local_ox], b[:w], depth, false, ext_dir, depth, depth, false, true]
    end
  end

  wall_doors = doors.select { |d| d[:wall] == wall_id }.map do |d|
    dx = d[:x_in]
    local_ox = is_x_dir ? dx - start_x : dx - start_y
    { local_ox: local_ox, w: d[:width_in] + door_ro_allowance + (2 * stud_thickness), h: d[:height_in] + door_ro_allowance }
  end

  wall_bumpouts.each do |b|
    wall_doors << { local_ox: b[:local_ox] + b[:w]/2.0, w: b[:w] + (2 * stud_thickness), h: start_z + stud_h - header_height }
  end

  wall_windows = windows.select { |w| w[:wall] == wall_id }.map do |win|
    wx = win[:x_in]
    local_ox = is_x_dir ? wx - start_x : wx - start_y
    { local_ox: local_ox, w: win[:width_in] + window_ro_allowance + (2 * stud_thickness), h: win[:height_in] + window_ro_allowance, sill: win[:sill_height_in] }
  end

  subtract_intervals = -> (intervals, cut_s, cut_e) {
    res = []
    intervals.each do |s, e|
      if cut_e <= s || cut_s >= e
        res << [s, e]
      else
        res << [s, cut_s] if cut_s > s
        res << [cut_e, e] if cut_e < e
      end
    end
    res
  }

  # 1. Bottom Plates
  bp_intervals = [[0, length]]
  wall_doors.each do |door|
    os = door[:local_ox] - door[:w]/2.0
    oe = door[:local_ox] + door[:w]/2.0
    bp_intervals = subtract_intervals.call(bp_intervals, os + stud_thickness, oe - stud_thickness)
  end

  bottom_plates.times do |i|
    z = i * plate_height
    bp_intervals.each do |s, e|
      w_box = is_x_dir ? (e - s) : depth
      d_box = is_x_dir ? depth : (e - s)
      x_pos = is_x_dir ? start_x + s : start_x
      y_pos = is_x_dir ? start_y : start_y + s
      draw_box.call(w_ents, x_pos, y_pos, z, w_box, d_box, plate_height, "Bottom Plate")
    end
  end
  
  # 2. Top Plates
  top_plates.times do |i|
    z = h - (i + 1) * plate_height
    w_box = is_x_dir ? length : depth
    d_box = is_x_dir ? depth : length
    draw_box.call(w_ents, start_x, start_y, z, w_box, d_box, plate_height, "Top Plate")
  end
  
  # 3. Studs
  stud_positions = []
  num_studs = (length / stud_spacing).ceil + 1
  num_studs.times do |i|
    pos = i * stud_spacing
    pos = length - stud_thickness if pos + stud_thickness > length
    stud_positions << pos
  end

  # Add corner backing studs for through-walls
  if add_corners
    stud_positions << (depth - stud_thickness)
    stud_positions << (length - depth)
  end

  # Add king studs around openings
  wall_doors.each do |door|
    os = door[:local_ox] - door[:w]/2.0
    oe = door[:local_ox] + door[:w]/2.0
    stud_positions << (os - stud_thickness)
    stud_positions << oe
  end
  wall_windows.each do |win|
    os = win[:local_ox] - win[:w]/2.0
    oe = win[:local_ox] + win[:w]/2.0
    stud_positions << (os - stud_thickness)
    stud_positions << oe
  end

  stud_positions.sort!.uniq!
  stud_positions.reject! { |p| p < 0 || p > length - stud_thickness + 0.001 }

  stud_positions.each do |pos|
    z_intervals = [[start_z, start_z + stud_h]]
    stud_s = pos
    stud_e = pos + stud_thickness

    wall_doors.each do |door|
      os = door[:local_ox] - door[:w]/2.0
      oe = door[:local_ox] + door[:w]/2.0
      if stud_e > os + 0.001 && stud_s < oe - 0.001
        z_intervals = subtract_intervals.call(z_intervals, 0, door[:h] + header_height)
      end
    end

    wall_windows.each do |win|
      os = win[:local_ox] - win[:w]/2.0
      oe = win[:local_ox] + win[:w]/2.0
      if stud_e > os + 0.001 && stud_s < oe - 0.001
        z_intervals = subtract_intervals.call(z_intervals, win[:sill] - plate_height, win[:sill] + win[:h] + header_height)
      end
    end

    z_intervals.each do |zs, ze|
      next if ze - zs <= 0.001
      x_pos = is_x_dir ? start_x + pos : start_x
      y_pos = is_x_dir ? start_y : start_y + pos
      w_box = is_x_dir ? stud_thickness : depth
      d_box = is_x_dir ? depth : stud_thickness
      
      stud_name = "Stud"
      is_end_stud = (pos < 0.1 || (pos - (length - stud_thickness)).abs < 0.1)
      is_backing_stud = is_x_dir && ((pos - t).abs < 0.1 || (pos - (length - t - stud_thickness)).abs < 0.1)
      
      if is_end_stud || is_backing_stud
        stud_name = "Corner Stud"
      end
      stud_name = "Cripple Stud" if ze - zs < stud_h - 0.01
      
      draw_box.call(w_ents, x_pos, y_pos, zs, w_box, d_box, ze - zs, stud_name)
    end
  end

  # 4. Headers, Footers (Sills), and Trimmers
  wall_doors.each do |door|
    os = door[:local_ox] - door[:w]/2.0
    oe = door[:local_ox] + door[:w]/2.0
    x_pos = is_x_dir ? start_x + os : start_x
    y_pos = is_x_dir ? start_y : start_y + os
    w_box = is_x_dir ? door[:w] : depth
    d_box = is_x_dir ? depth : door[:w]
    
    # Header
    draw_header.call(w_ents, x_pos, y_pos, door[:h], w_box, d_box, header_height, header_type, is_x_dir) if door[:h] + header_height <= start_z + stud_h

    # Trimmer Studs (Jack Studs)
    trimmer_h = door[:h] - start_z
    if trimmer_h > 0
      # Left Trimmer
      t_x_pos_l = is_x_dir ? start_x + os : start_x
      t_y_pos_l = is_x_dir ? start_y : start_y + os
      t_w_box = is_x_dir ? stud_thickness : depth
      t_d_box = is_x_dir ? depth : stud_thickness
      draw_box.call(w_ents, t_x_pos_l, t_y_pos_l, start_z, t_w_box, t_d_box, trimmer_h, "Jack Stud")

      # Right Trimmer
      t_x_pos_r = is_x_dir ? start_x + oe - stud_thickness : start_x
      t_y_pos_r = is_x_dir ? start_y : start_y + oe - stud_thickness
      draw_box.call(w_ents, t_x_pos_r, t_y_pos_r, start_z, t_w_box, t_d_box, trimmer_h, "Jack Stud")
    end
  end

  wall_windows.each do |win|
    os = win[:local_ox] - win[:w]/2.0
    oe = win[:local_ox] + win[:w]/2.0
    x_pos = is_x_dir ? start_x + os : start_x
    y_pos = is_x_dir ? start_y : start_y + os
    w_box = is_x_dir ? win[:w] : depth
    d_box = is_x_dir ? depth : win[:w]
    
    # Footer Stud (Sill)
    s_x_pos = is_x_dir ? start_x + os + stud_thickness : start_x
    s_y_pos = is_x_dir ? start_y : start_y + os + stud_thickness
    s_w_box = is_x_dir ? win[:w] - 2*stud_thickness : depth
    s_d_box = is_x_dir ? depth : win[:w] - 2*stud_thickness
    draw_box.call(w_ents, s_x_pos, s_y_pos, win[:sill] - plate_height, s_w_box, s_d_box, plate_height, "Sill") if win[:sill] - plate_height >= start_z
    
    # Header Stud
    draw_header.call(w_ents, x_pos, y_pos, win[:sill] + win[:h], w_box, d_box, header_height, header_type, is_x_dir) if win[:sill] + win[:h] + header_height <= start_z + stud_h

    # Trimmer Studs (Jack Studs)
    trimmer_h = win[:sill] + win[:h] - start_z
    if trimmer_h > 0
      # Left Trimmer
      t_x_pos_l = is_x_dir ? start_x + os : start_x
      t_y_pos_l = is_x_dir ? start_y : start_y + os
      t_w_box = is_x_dir ? stud_thickness : depth
      t_d_box = is_x_dir ? depth : stud_thickness
      draw_box.call(w_ents, t_x_pos_l, t_y_pos_l, start_z, t_w_box, t_d_box, trimmer_h, "Jack Stud")

      # Right Trimmer
      t_x_pos_r = is_x_dir ? start_x + oe - stud_thickness : start_x
      t_y_pos_r = is_x_dir ? start_y : start_y + oe - stud_thickness
      draw_box.call(w_ents, t_x_pos_r, t_y_pos_r, start_z, t_w_box, t_d_box, trimmer_h, "Jack Stud")
    end
  end

  # Add a label on top of the wall
  mid_x = start_x + (is_x_dir ? length / 2.0 : depth / 2.0)
  mid_y = start_y + (is_x_dir ? depth / 2.0 : length / 2.0)
  txt = w_ents.add_text("Wall #{wall_id}", [mid_x, mid_y, h])
  txt.layer = model.layers["Notations"] || model.layers.add("Notations")

  if add_insulation
    ins_group = w_ents.add_group
    ins_group.name = "Insulation"
    ins_layer = model.layers["Insulation"] || model.layers.add("Insulation")
    ins_group.layer = ins_layer
    
    # Try to set a pinkish color for insulation if materials are available
    ins_mat = model.materials["Insulation_Pink"] || model.materials.add("Insulation_Pink")
    ins_mat.color = Sketchup::Color.new(255, 182, 193) # Light Pink
    ins_mat.alpha = 0.5 # Make it semi-transparent
    ins_group.material = ins_mat

    i_ents = ins_group.entities
    
    # Draw a solid block representing the wall cavity
    if is_x_dir
      ix = start_x
      iy = start_y
      iw = length
      id = depth
      
      # Draw on the X-Z plane at y = iy
      pts = [
        [ix, iy, start_z],
        [ix+iw, iy, start_z],
        [ix+iw, iy, start_z + stud_h],
        [ix, iy, start_z + stud_h]
      ]
    else
      ix = start_x
      iy = start_y
      iw = depth
      id = length
      
      # Draw on the Y-Z plane at x = ix
      pts = [
        [ix, iy, start_z],
        [ix, iy+id, start_z],
        [ix, iy+id, start_z + stud_h],
        [ix, iy, start_z + stud_h]
      ]
    end
    
    main_face = i_ents.add_face(pts)
    
    # Cut out doors and windows from the insulation block
    openings = []
    wall_doors.each { |d| openings << [d[:local_ox] - d[:w]/2.0, d[:local_ox] + d[:w]/2.0, start_z, d[:h]] }
    wall_windows.each { |w| openings << [w[:local_ox] - w[:w]/2.0, w[:local_ox] + w[:w]/2.0, w[:sill], w[:sill] + w[:h]] }
    
    openings.each do |op|
      ox1, ox2, oz1, oz2 = op
      if is_x_dir
        opts = [
          [start_x+ox1, iy, oz1],
          [start_x+ox2, iy, oz1],
          [start_x+ox2, iy, oz2],
          [start_x+ox1, iy, oz2]
        ]
      else
        opts = [
          [ix, start_y+ox1, oz1],
          [ix, start_y+ox2, oz1],
          [ix, start_y+ox2, oz2],
          [ix, start_y+ox1, oz2]
        ]
      end
      
      hole_face = i_ents.add_face(opts)
      hole_face.erase! if hole_face
    end
    
    # Pushpull the remaining faces
    i_ents.grep(Sketchup::Face).each do |f|
      if is_x_dir
        dist = (f.normal.y > 0) ? id : -id
        f.pushpull(dist)
      else
        dist = (f.normal.x > 0) ? iw : -iw
        f.pushpull(dist)
      end
    end
  end

  if add_sheathing && !is_interior
    sheathing_group = w_ents.add_group
    sheathing_group.name = "Sheathing"
    sheathing_group.layer = model.layers["Sheathing"] || model.layers.add("Sheathing")
    
    sh_mat = model.materials["OSB_Sheathing"] || model.materials.add("OSB_Sheathing")
    sh_mat.color = Sketchup::Color.new(205, 133, 63) # Peru / Wood color
    sheathing_group.material = sh_mat

    s_ents = sheathing_group.entities
    
    sh_thick = 0.4375 # 7/16"
    
    if is_x_dir
      sy = ext_dir == 1 ? start_y + depth : start_y
      sh_start_x = start_x - sh_start
      sh_len = length + sh_start + sh_end
      outer_pts = [
        [sh_start_x, sy, 0],
        [sh_start_x + sh_len, sy, 0],
        [sh_start_x + sh_len, sy, h],
        [sh_start_x, sy, h]
      ]
    else
      sx = ext_dir == 1 ? start_x + depth : start_x
      sh_start_y = start_y - sh_start
      sh_len = length + sh_start + sh_end
      outer_pts = [
        [sx, sh_start_y, 0],
        [sx, sh_start_y + sh_len, 0],
        [sx, sh_start_y + sh_len, h],
        [sx, sh_start_y, h]
      ]
    end
    
    main_face = s_ents.add_face(outer_pts)
    
    openings = []
    wall_doors.each { |d| openings << [d[:local_ox] - d[:w]/2.0, d[:local_ox] + d[:w]/2.0, 0, d[:h]] }
    wall_windows.each { |w| openings << [w[:local_ox] - w[:w]/2.0, w[:local_ox] + w[:w]/2.0, w[:sill], w[:sill] + w[:h]] }
    
    openings.each do |op|
      ox1, ox2, oz1, oz2 = op
      if is_x_dir
        pts = [[start_x+ox1, sy, oz1], [start_x+ox2, sy, oz1], [start_x+ox2, sy, oz2], [start_x+ox1, sy, oz2]]
      else
        pts = [[sx, start_y+ox1, oz1], [sx, start_y+ox2, oz1], [sx, start_y+ox2, oz2], [sx, start_y+ox1, oz2]]
      end
      
      # Draw the hole face directly on the sheathing face
      hole_face = s_ents.add_face(pts)
      
      # If the face was created, it means it successfully split the main face
      # We can just erase it to create the hole
      if hole_face
        hole_face.erase!
      end
    end
    
    # We no longer need the complex center-point checking logic
    # because we are explicitly creating and erasing the hole faces above.
    
    s_ents.grep(Sketchup::Face).each do |f|
      if is_x_dir
        dist = (f.normal.y * ext_dir > 0) ? sh_thick : -sh_thick
        f.pushpull(dist)
      else
        dist = (f.normal.x * ext_dir > 0) ? sh_thick : -sh_thick
        f.pushpull(dist)
      end
    end
  end

  if add_drywall
    dw_thick = 0.5 # 1/2" drywall
    
    sides = []
    if is_interior
      sides = [0, 1] # 0 for start side, 1 for end side
    else
      sides = [ext_dir == 1 ? 0 : 1] # Interior side is opposite of exterior side
    end
    
    sides.each do |side|
      drywall_group = w_ents.add_group
      drywall_group.name = "Drywall"
      drywall_group.layer = model.layers["Drywall"] || model.layers.add("Drywall")
      
      dw_mat = model.materials["Drywall"] || model.materials.add("Drywall")
      dw_mat.color = Sketchup::Color.new(245, 245, 240) # Off-white
      drywall_group.material = dw_mat

      d_ents = drywall_group.entities
      
      if is_x_dir
        dy = side == 1 ? start_y + depth : start_y
        dw_start_x = start_x
        dw_len = length
        outer_pts = [
          [dw_start_x, dy, 0],
          [dw_start_x + dw_len, dy, 0],
          [dw_start_x + dw_len, dy, h],
          [dw_start_x, dy, h]
        ]
      else
        dx = side == 1 ? start_x + depth : start_x
        dw_start_y = start_y
        dw_len = length
        outer_pts = [
          [dx, dw_start_y, 0],
          [dx, dw_start_y + dw_len, 0],
          [dx, dw_start_y + dw_len, h],
          [dx, dw_start_y, h]
        ]
      end
      
      main_face = d_ents.add_face(outer_pts)
      
      openings = []
      wall_doors.each { |d| openings << [d[:local_ox] - d[:w]/2.0, d[:local_ox] + d[:w]/2.0, 0, d[:h]] }
      wall_windows.each { |w| openings << [w[:local_ox] - w[:w]/2.0, w[:local_ox] + w[:w]/2.0, w[:sill], w[:sill] + w[:h]] }
      
      openings.each do |op|
        ox1, ox2, oz1, oz2 = op
        if is_x_dir
          pts = [[start_x+ox1, dy, oz1], [start_x+ox2, dy, oz1], [start_x+ox2, dy, oz2], [start_x+ox1, dy, oz2]]
        else
          pts = [[dx, start_y+ox1, oz1], [dx, start_y+ox2, oz1], [dx, start_y+ox2, oz2], [dx, start_y+ox1, oz2]]
        end
        
        hole_face = d_ents.add_face(pts)
        if hole_face
          hole_face.erase!
        end
      end
      
      d_ents.grep(Sketchup::Face).each do |f|
        if is_x_dir
          push_dir = (side == 1) ? 1 : -1
          dist = (f.normal.y * push_dir > 0) ? dw_thick : -dw_thick
          f.pushpull(dist)
        else
          push_dir = (side == 1) ? 1 : -1
          dist = (f.normal.x * push_dir > 0) ? dw_thick : -dw_thick
          f.pushpull(dist)
        end
      end
    end
  end
}

# 2. Draw Shell Walls
if shape == 'rectangle'
  # Wall 1: Front (x-dir)
  draw_wall_framing.call(1, 0, 0, w, t, true, -1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 1
  # Wall 3: Back (x-dir)
  draw_wall_framing.call(3, 0, l-t, w, t, true, 1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 3
  # Wall 4: Left (y-dir)
  draw_wall_framing.call(4, 0, t, l - 2*t, t, false, -1, t, t, false, false) if update_wall_id.nil? || update_wall_id == 4
  # Wall 2: Right (y-dir)
  draw_wall_framing.call(2, w-t, t, l - 2*t, t, false, 1, t, t, false, false) if update_wall_id.nil? || update_wall_id == 2
elsif shape == 'l-shape'
  # Wall 1: Front
  draw_wall_framing.call(1, 0, 0, w, t, true, -1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 1
  # Wall 2: Right
  draw_wall_framing.call(2, w-t, t, l1-t, t, false, 1, t, 0, false, false) if update_wall_id.nil? || update_wall_id == 2
  # Wall 3: Inner Back
  draw_wall_framing.call(3, w2, l1-t, w - w2 - t, t, true, 1, 0, t, false, true) if update_wall_id.nil? || update_wall_id == 3
  # Wall 4: Inner Left
  draw_wall_framing.call(4, w2, l1, l - l1 - t, t, false, 1, 0, t, false, false) if update_wall_id.nil? || update_wall_id == 4
  # Wall 5: Back
  draw_wall_framing.call(5, 0, l-t, w2 + t, t, true, 1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 5
  # Wall 6: Left
  draw_wall_framing.call(6, 0, t, l - 2*t, t, false, -1, t, t, false, false) if update_wall_id.nil? || update_wall_id == 6
elsif shape == 'u-shape'
  # Wall 1: Base
  draw_wall_framing.call(1, 0, 0, u_w1, t, true, -1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 1
  # Wall 2: Right outer
  draw_wall_framing.call(2, u_w1-t, t, u_w2-t, t, false, 1, t, 0, false, false) if update_wall_id.nil? || update_wall_id == 2
  # Wall 3: Right end
  draw_wall_framing.call(3, u_w1 - u_w3, u_w2-t, u_w3 - t, t, true, 1, 0, t, false, true) if update_wall_id.nil? || update_wall_id == 3
  # Wall 4: Right inner
  draw_wall_framing.call(4, u_w1 - u_w3, u_w2 - u_w4, u_w4 - t, t, false, -1, 0, t, false, false) if update_wall_id.nil? || update_wall_id == 4
  # Wall 5: Middle
  draw_wall_framing.call(5, u_w7-t, u_w2 - u_w4 - t, u_w5 + 2*t, t, true, 1, -t, -t, false, true) if update_wall_id.nil? || update_wall_id == 5
  # Wall 6: Left inner
  draw_wall_framing.call(6, u_w7-t, u_w8 - u_w6, u_w6 - t, t, false, 1, 0, t, false, false) if update_wall_id.nil? || update_wall_id == 6
  # Wall 7: Left end
  draw_wall_framing.call(7, 0, u_w8-t, u_w7, t, true, 1, 0, 0, false, true) if update_wall_id.nil? || update_wall_id == 7
  # Wall 8: Left outer
  draw_wall_framing.call(8, 0, t, u_w8 - 2*t, t, false, -1, t, t, false, false) if update_wall_id.nil? || update_wall_id == 8
end

# 3. Draw Foundation
if update_wall_id.nil? && foundation_type != 'none'
  # Draw main slab if slab type
  if foundation_type == 'slab'
    slab_h = 4
    if foundation_shape == 'rectangle'
      draw_box.call(fd_ents, 0, 0, -slab_h, w, l, slab_h, "Slab")
    elsif foundation_shape == 'l-shape'
      pts = [[0,0, -slab_h], [w,0, -slab_h], [w,l1, -slab_h], [w2,l1, -slab_h], [w2,l, -slab_h], [0,l, -slab_h]]
      face = fd_ents.add_face(pts)
      if face
        face.reverse! if face.normal.z < 0
        face.pushpull(slab_h)
      end
    elsif foundation_shape == 'u-shape'
      pts = [[0,0, -slab_h], [u_w1,0, -slab_h], [u_w1,u_w2, -slab_h], [u_w1-u_w3,u_w2, -slab_h], [u_w1-u_w3,u_w2-u_w4, -slab_h], [u_w7,u_w2-u_w4, -slab_h], [u_w7,u_w8, -slab_h], [0,u_w8, -slab_h]]
      face = fd_ents.add_face(pts)
      if face
        face.reverse! if face.normal.z < 0
        face.pushpull(slab_h)
      end
    end
  end

  # Draw perimeter foundation (only for stem-wall to avoid redundancy with slab)
  if foundation_type == 'stem-wall'
    if foundation_shape == 'rectangle'
      draw_foundation.call(0, 0, w, t, true, -1)
      draw_foundation.call(0, l-t, w, t, true, 1)
      draw_foundation.call(0, t, l - 2*t, t, false, -1)
      draw_foundation.call(w-t, t, l - 2*t, t, false, 1)
    elsif foundation_shape == 'l-shape'
      draw_foundation.call(0, 0, w, t, true, -1)
      draw_foundation.call(w-t, t, l1-t, t, false, 1)
      draw_foundation.call(w2, l1-t, w - w2 - t, t, true, 1)
      draw_foundation.call(w2, l1, l - l1 - t, t, false, 1)
      draw_foundation.call(0, l-t, w2 + t, t, true, 1)
      draw_foundation.call(0, t, l - 2*t, t, false, -1)
    elsif foundation_shape == 'u-shape'
      draw_foundation.call(0, 0, u_w1, t, true, -1)
      draw_foundation.call(u_w1-t, t, u_w2-t, t, false, 1)
      draw_foundation.call(u_w1 - u_w3, u_w2-t, u_w3 - t, t, true, 1)
      draw_foundation.call(u_w1 - u_w3, u_w2 - u_w4, u_w4 - t, t, false, -1)
      draw_foundation.call(u_w7-t, u_w2 - u_w4 - t, u_w5 + 2*t, t, true, 1)
      draw_foundation.call(u_w7-t, u_w8 - u_w6, u_w6 - t, t, false, 1)
      draw_foundation.call(0, u_w8-t, u_w7, t, true, 1)
      draw_foundation.call(0, t, u_w8 - 2*t, t, false, -1)
    end
  end

  # Draw foundation for custom exterior walls
  custom_exterior_walls.each do |ew|
    draw_foundation.call(ew[:x_in], ew[:y_in], ew[:len_in], ew[:th], ew[:is_x], ew[:ext_dir])
  end

  # Draw foundation for bumpouts
  if foundation_type == 'slab'
    slab_h = 4
    bumpouts.each do |b|
      wall_id = b[:wall]
      # Find the wall to get its orientation and position
      # We'll search in default walls and custom walls
      ext_wall = nil
      if shape == 'rectangle'
        ext_wall = [{ id: 1, x: 0, y: 0, w: w, h: t, is_x: true, ext_dir: -1 },
                    { id: 2, x: w-t, y: t, w: t, h: l-2*t, is_x: false, ext_dir: 1 },
                    { id: 3, x: 0, y: l-t, w: w, h: t, is_x: true, ext_dir: 1 },
                    { id: 4, x: 0, y: t, w: t, h: l-2*t, is_x: false, ext_dir: -1 }].find { |w| w[:id] == wall_id }
      elsif shape == 'l-shape'
        ext_wall = [{ id: 1, x: 0, y: 0, w: w, h: t, is_x: true, ext_dir: -1 },
                    { id: 2, x: w-t, y: t, w: t, h: l1-t, is_x: false, ext_dir: 1 },
                    { id: 3, x: w2, y: l1-t, w: w-w2-t, h: t, is_x: true, ext_dir: 1 },
                    { id: 4, x: w2, y: l1, w: t, h: l-l1-t, is_x: false, ext_dir: 1 },
                    { id: 5, x: 0, y: l-t, w: w2+t, h: t, is_x: true, ext_dir: 1 },
                    { id: 6, x: 0, y: t, w: t, h: l-2*t, is_x: false, ext_dir: -1 }].find { |w| w[:id] == wall_id }
      elsif shape == 'u-shape'
        ext_wall = [{ id: 1, x: 0, y: 0, w: u_w1, h: t, is_x: true, ext_dir: -1 },
                    { id: 2, x: u_w1-t, y: t, w: t, h: u_w2-t, is_x: false, ext_dir: 1 },
                    { id: 3, x: u_w1-u_w3, y: u_w2-t, w: u_w3-t, h: t, is_x: true, ext_dir: 1 },
                    { id: 4, x: u_w1-u_w3, y: u_w2-u_w4, w: t, h: u_w4-t, is_x: false, ext_dir: -1 },
                    { id: 5, x: u_w7-t, y: u_w2-u_w4-t, w: u_w5+2*t, h: t, is_x: true, ext_dir: 1 },
                    { id: 6, x: u_w7-t, y: u_w8-u_w6, w: t, h: u_w6-t, is_x: false, ext_dir: 1 },
                    { id: 7, x: 0, y: u_w8-t, w: u_w7, h: t, is_x: true, ext_dir: 1 },
                    { id: 8, x: 0, y: t, w: t, h: u_w8-2*t, is_x: false, ext_dir: -1 }].find { |w| w[:id] == wall_id }
      end
      ext_wall ||= custom_exterior_walls.find { |ew| ew[:id] == wall_id }
      
      if ext_wall
        # Normalize keys for custom walls
        wx = ext_wall[:x] || ext_wall[:x_in]
        wy = ext_wall[:y] || ext_wall[:y_in]
        is_x = ext_wall.key?(:is_x) ? ext_wall[:is_x] : ext_wall[:isHorizontal]
        
        bx = b[:x_in]
        bw = b[:width_in]
        bd = b[:depth_in]
        if is_x
          sy = ext_wall[:ext_dir] == 1 ? wy : wy - bd + t
          draw_box.call(fd_ents, wx + bx, sy, -slab_h, bw, bd, slab_h, "Bumpout Slab")
        else
          sx = ext_wall[:ext_dir] == 1 ? wx : wx - bd + t
          draw_box.call(fd_ents, sx, wy + bx, -slab_h, bd, bw, slab_h, "Bumpout Slab")
        end
      end
    end
  else
    # For stem-wall, we draw the 3 walls of each bumpout
    bumpout_walls_to_draw.each do |bw|
      # bw format: [id, start_x, start_y, length, depth, is_x_dir, ext_dir, sh_start, sh_end, is_interior, add_corners]
      draw_foundation.call(bw[1], bw[2], bw[3], bw[4], bw[5], bw[6])
    end
  end
end

# Draw Interior Walls
interior_walls.each do |iw|
  draw_wall_framing.call(iw[:id], iw[:x_in], iw[:y_in], iw[:len_in], iw[:th], iw[:is_x], 1, 0, 0, true, false) if update_wall_id.nil? || update_wall_id == iw[:id]
  # Draw foundation for interior walls if requested
  draw_foundation.call(iw[:x_in], iw[:y_in], iw[:len_in], iw[:th], iw[:is_x], 1) if update_wall_id.nil? && foundation_type != 'none'
end

# Draw Custom Exterior Walls
custom_exterior_walls.each do |ew|
  draw_wall_framing.call(ew[:id], ew[:x_in], ew[:y_in], ew[:len_in], ew[:th], ew[:is_x], ew[:ext_dir], 0, 0, false, true) if update_wall_id.nil? || update_wall_id == ew[:id]
end

# Draw Bumpout Walls
bumpout_walls_to_draw.each do |bw|
  draw_wall_framing.call(*bw) if update_wall_id.nil? || update_wall_id == bw[0].split('_')[0].to_i
end

if is_new_shell && shape == 'u-shape' && u_direction != 'back'
  angle = 0
  dx = 0
  dy = 0
  if u_direction == 'front'
    angle = 180
    dx = u_w1
    dy = [u_w2, u_w8].max
  elsif u_direction == 'left'
    angle = 90
    dx = [u_w2, u_w8].max
    dy = 0
  elsif u_direction == 'right'
    angle = 270
    dx = 0
    dy = u_w1
  end
  
  tr_rot = Geom::Transformation.rotation(ORIGIN, Z_AXIS, angle * Math::PI / 180.0)
  tr_trans = Geom::Transformation.translation([dx, dy, 0])
  framing_group.transform!(tr_trans * tr_rot)
end

if is_new_shell && shape == 'l-shape' && l_direction != 'front-left'
  angle = 0
  dx = 0
  dy = 0
  if l_direction == 'front-right'
    angle = 90
    dx = l
    dy = 0
  elsif l_direction == 'back-right'
    angle = 180
    dx = w
    dy = l
  elsif l_direction == 'back-left'
    angle = 270
    dx = 0
    dy = w
  end
  
  tr_rot = Geom::Transformation.rotation(ORIGIN, Z_AXIS, angle * Math::PI / 180.0)
  tr_trans = Geom::Transformation.translation([dx, dy, 0])
  framing_group.transform!(tr_trans * tr_rot)
end

# --- ADD DIMENSIONS ---
if is_new_shell
  dim_layer = model.layers["Dimensions"] || model.layers.add("Dimensions")
  
  if shape == 'rectangle'
    d1 = f_ents.add_dimension_linear([0, 0, 0], [w, 0, 0], [0, -24, 0])
    d1.layer = dim_layer
    d2 = f_ents.add_dimension_linear([0, 0, 0], [0, l, 0], [-24, 0, 0])
    d2.layer = dim_layer
  elsif shape == 'l-shape'
    d1 = f_ents.add_dimension_linear([0, 0, 0], [w, 0, 0], [0, -24, 0])
    d1.layer = dim_layer
    d2 = f_ents.add_dimension_linear([0, 0, 0], [0, l, 0], [-24, 0, 0])
    d2.layer = dim_layer
    d3 = f_ents.add_dimension_linear([w, 0, 0], [w, l1, 0], [24, 0, 0])
    d3.layer = dim_layer
  elsif shape == 'u-shape'
    d1 = f_ents.add_dimension_linear([0, 0, 0], [u_w1, 0, 0], [0, -24, 0])
    d1.layer = dim_layer
    d2 = f_ents.add_dimension_linear([0, 0, 0], [0, u_w8, 0], [-24, 0, 0])
    d2.layer = dim_layer
  end
end

    */
  
  const handleCopy = () => {
    navigator.clipboard.writeText(generateRubyCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWall = (wallId: number) => {
    navigator.clipboard.writeText(generateRubyCode(wallId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySection = (section: GenerationSection) => {
    navigator.clipboard.writeText(generateRubyCode(section));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isInsideSketchup = typeof (window as any).sketchup !== 'undefined';

  const handleBuildInSketchup = async (sectionOverride?: GenerationSection) => {
    if (isBuilding) return;
    setIsBuilding(true);
    console.log("Building in SketchUp...", sectionOverride);
    const code = generateRubyCode(sectionOverride);
    
    if (isInsideSketchup) {
      console.log("Generated Ruby Code:", code);
      (window as any).sketchup.execute_ruby(code);
    } else {
      alert("Please open this app inside SketchUp to build directly!");
    }
    
    setIsBuilding(false);
  };

  const handleDownloadLoader = () => {
    const element = document.createElement("a");
    const code = `require 'sketchup.rb'
require 'extensions.rb'

module DooleyBuildingSolutions
  unless file_loaded?(__FILE__)
    ex = SketchupExtension.new('Dooley Building Solutions', 'dooley_extension/main')
    ex.description = 'Professional building solutions for framing and foundations.'
    ex.version     = '1.0.0'
    ex.copyright   = 'Dooley Building Solutions © 2026'
    ex.creator     = 'Dooley'
    Sketchup.register_extension(ex, true)
    file_loaded(__FILE__)
  end
end
`;
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "dooley_loader.rb";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadMain = () => {
    const element = document.createElement("a");
    const appUrl = window.location.origin + window.location.pathname;
    const code = `require 'sketchup.rb'
require 'json'

module DooleyBuildingSolutions
  
  def self.show_dialog
    options = {
      :dialog_title => "Dooley Building Solutions",
      :preferences_key => "com.dooley.buildingsolutions",
      :scrollable => true,
      :resizable => true,
      :width => 1200,
      :height => 800,
      :left => 100,
      :top => 100,
      :style => UI::HtmlDialog::STYLE_DIALOG
    }
    @dialog = UI::HtmlDialog.new(options)
    
    # Point to the web application
    @dialog.set_url("${appUrl}")
    
    # Callback to execute generated Ruby code
    @dialog.add_action_callback("execute_ruby") { |action_context, code|
      begin
        # Use TOPLEVEL_BINDING to ensure code runs in a clean global scope
        # but can still access Sketchup constants.
        eval(code, TOPLEVEL_BINDING)
      rescue => e
        puts "Error executing Ruby code from dialog: #{e.message}"
        puts e.backtrace.join("\\n")
        UI.messagebox("Error executing script: #{e.message}\\n\\n#{e.backtrace.first}")
      end
    }

    # Callback to get current SketchUp version or other info if needed
    @dialog.add_action_callback("get_info") { |action_context|
      info = {
        version: Sketchup.version,
        units: model_units_name
      }
      @dialog.execute_script("window.receiveSketchupInfo(#{info.to_json})")
    }
    
    @dialog.show
  end

  def self.model_units_name
    case Sketchup.active_model.options['UnitsOptions']['LengthUnit']
    when 0 then "Inches"
    when 1 then "Feet"
    when 2 then "Millimeters"
    when 3 then "Centimeters"
    when 4 then "Meters"
    else "Unknown"
    end
  end

  # Menu Item
  unless file_loaded?(__FILE__)
    menu = UI.menu('Extensions')
    sub_menu = menu.add_submenu('Dooley Solutions')
    sub_menu.add_item('Launch Tool') {
      self.show_dialog
    }
    file_loaded(__FILE__)
  end

  # --- GENERATION LOGIC (Extracted from sketchupGenerator.ts) ---
  # This section provides the core geometry functions that the web app calls.
  # Note: The web app currently generates a full script, but we could also 
  # call these methods directly if we refactor the communication.
  
  # Helper to subtract intervals
  def self.subtract_intervals(intervals, cut_s, cut_e)
    res = []
    intervals.each do |s, e|
      if cut_e <= s || cut_s >= e
        res << [s, e]
      else
        res << [s, cut_s] if cut_s > s
        res << [cut_e, e] if cut_e < e
      end
    end
    res
  end

  # Helper to get or create a material
  def self.get_material(name, color_code)
    model = Sketchup.active_model
    mat = model.materials[name]
    mat ||= model.materials.add(name)
    mat.color = color_code
    mat
  end

  # Helper to draw a box
  def self.draw_box(ents, x, y, z, w, d, h, name, material=nil)
    return if w <= 0.01 || d <= 0.01 || h <= 0.01
    model = Sketchup.active_model
    g = ents.add_group
    g.name = name
    g.layer = model.layers.add(name)
    g.material = material if material
    pts = [[x,y,z], [x+w,y,z], [x+w,y+d,z], [x,y+d,z]]
    face = g.entities.add_face(pts)
    if face
      face.reverse! if face.normal.z < 0
      face.pushpull(h)
    end
    g
  end

end
`;
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "main.rb";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-[#0a0e1a] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100 overflow-hidden">
      <header className="bg-white dark:bg-[#0f1424] border-b border-zinc-200 dark:border-[#1c2240] px-6 py-4 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 dark:bg-indigo-500 p-2 rounded-lg text-white shadow-sm">
            <Home size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Dooley's Building Solutions</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Structural design, framing & materials estimation</p>
          </div>
          {setCurrentProject && (
            <>
              <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700 mx-2" />
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-bold mb-0.5">Project</label>
                  <input
                    type="text"
                    value={currentProject?.name ?? ''}
                    onChange={(e) => {
                      setCurrentProject({
                        ...(currentProject ?? { id: `prj-${Date.now()}`, projectNumber: '', createdAt: new Date().toISOString() }),
                        name: e.target.value,
                      });
                    }}
                    placeholder="Project name..."
                    className="bg-transparent border-b border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white py-0.5 w-40 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-bold mb-0.5">No.</label>
                  <input
                    type="text"
                    value={currentProject?.projectNumber ?? ''}
                    onChange={(e) => {
                      setCurrentProject({
                        ...(currentProject ?? { id: `prj-${Date.now()}`, name: '', createdAt: new Date().toISOString() }),
                        projectNumber: e.target.value,
                      });
                    }}
                    placeholder="PRJ-001"
                    className="bg-transparent border-b border-zinc-300 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white py-0.5 w-24 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
          </button>
          <button
            onClick={() => setShowPluginModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] transition-colors"
            title="Download SketchUp Plugin (.rb)"
          >
            <AppWindow size={16} />
            <span className="hidden sm:inline">Download Plugin</span>
          </button>
          <button
            onClick={() => handleBuildInSketchup()}
            disabled={isBuilding}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md text-white transition-colors shadow-sm ${isBuilding ? 'bg-emerald-500 cursor-not-allowed opacity-80' : 'bg-emerald-600 hover:bg-emerald-700'}`}
            title="Build directly in SketchUp via AI Bridge"
          >
            {isBuilding ? <Loader2 size={16} className="animate-spin" /> : <Hammer size={16} />}
            <span className="hidden sm:inline">{isBuilding ? 'Building...' : 'Build in SketchUp'}</span>
          </button>
          <button
            onClick={handleUndo}
            disabled={past.length <= 1 && JSON.stringify(currentState) === JSON.stringify(past[past.length - 1])}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Undo"
          >
            <Undo2 size={16} />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={future.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Redo"
          >
            <Redo2 size={16} />
            <span className="hidden sm:inline">Redo</span>
          </button>
          <button
            onClick={handleClearCode}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            title="Clear all data and reset to defaults"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Clear Code</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Column: Controls (Sidebar) */}
        <aside className="w-[400px] flex-shrink-0 border-r border-zinc-200 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] overflow-y-auto custom-scrollbar p-6 space-y-4">
          
          {/* Foundation Section */}
          <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
            <div 
              onClick={() => toggleSection('foundation')}
              className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#151a2e]/30 hover:bg-zinc-50 dark:hover:bg-[#1c2240]/50 transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('foundation'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg">
                  <Construction size={18} />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                    1. Foundation
                    {foundationType !== 'none' && (
                      <span className="text-amber-600 dark:text-amber-500 ml-2 font-medium">
                        - {foundationType === 'slab' ? 'Slab' : 
                           foundationType === 'slab-on-grade' ? 'Slab on Grade' :
                           foundationType === 'stem-wall' ? 'Stem Wall' : ''}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Slab, Footings, Stem Walls</p>
                </div>
                <div className="flex items-center gap-2 ml-auto mr-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCopySection('foundation'); }}
                    className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                    title="Copy code to update just the foundation"
                  >
                    <Copy size={12} /> Edit Foundation
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleBuildInSketchup('foundation'); }}
                    className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                    title="Build foundation in SketchUp"
                  >
                    <Hammer size={12} /> Build Foundation
                  </button>
                </div>
              </div>
              {openSections.foundation ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
            </div>
            {openSections.foundation && (
              <div className="border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424]">
                {/* Foundation Shape */}
                <div className="border-b border-zinc-100 dark:border-[#1c2240]">
                  <div className="px-5 py-3 flex items-center gap-2 bg-zinc-50/30 dark:bg-[#151a2e]/20">
                    <LayoutGrid size={14} className="text-zinc-500 dark:text-zinc-400" />
                    <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">Foundation Shape</h3>
                  </div>
                  <div className="p-5 space-y-4 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFoundationShape('rectangle')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 'rectangle' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Rectangle
                      </button>
                      <button
                        onClick={() => setFoundationShape('l-shape')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 'l-shape' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        L-Shape
                      </button>
                      <button
                        onClick={() => setFoundationShape('u-shape')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 'u-shape' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        U-Shape
                      </button>
                      <button
                        onClick={() => setFoundationShape('h-shape')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 'h-shape' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        H-Shape
                      </button>
                      <button
                        onClick={() => setFoundationShape('t-shape')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 't-shape' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        T-Shape
                      </button>
                      <button
                        onClick={() => setFoundationShape('custom')}
                        disabled={isAnalyzing}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationShape === 'custom' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                </div>

                {/* Foundation Type */}
                <div className="border-b border-zinc-100 dark:border-[#1c2240]">
                  <div className="px-5 py-3 flex items-center gap-2 bg-zinc-50/30 dark:bg-[#151a2e]/20">
                    <Settings size={14} className="text-zinc-500 dark:text-zinc-400" />
                    <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">Foundation Type</h3>
                  </div>
                  <div className="p-5 space-y-4 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setFoundationType('none')}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationType === 'none' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'}`}
                      >
                        None
                      </button>
                      <button
                        onClick={() => setFoundationType('slab')}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationType === 'slab' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'}`}
                      >
                        Slab
                      </button>
                      <button
                        onClick={() => setFoundationType('slab-on-grade')}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationType === 'slab-on-grade' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'}`}
                      >
                        Slab on Grade
                      </button>
                      <button
                        onClick={() => setFoundationType('stem-wall')}
                        className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${foundationType === 'stem-wall' ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'}`}
                      >
                        Stem Wall
                      </button>
                    </div>
                  </div>
                </div>

                {foundationType === 'slab' && (
                  <div className="border-b border-zinc-100 dark:border-[#1c2240]">
                    <div className="px-5 py-3 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/20">
                      <Construction size={14} className="text-amber-600 dark:text-amber-500" />
                      <h3 className="font-bold text-amber-700 dark:text-amber-500 text-[11px] uppercase tracking-wider">Slab Parameters</h3>
                    </div>
                    <div className="p-5 space-y-4 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Slab Thickness (in)</label>
                        <input 
                          type="number" 
                          value={slabThicknessIn} 
                          onChange={(e) => setSlabThicknessIn(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {foundationType === 'slab-on-grade' && (
                  <div className="border-b border-zinc-100 dark:border-[#1c2240]">
                    <div className="px-5 py-3 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/20">
                      <Construction size={14} className="text-amber-600 dark:text-amber-500" />
                      <h3 className="font-bold text-amber-700 dark:text-amber-500 text-[11px] uppercase tracking-wider">Slab on Grade Parameters</h3>
                    </div>
                    <div className="p-5 space-y-4 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Slab Thickness (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(slabThicknessIn)} 
                            onChange={(e) => setSlabThicknessIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Edge Depth (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(thickenedEdgeDepthIn)} 
                            onChange={(e) => setThickenedEdgeDepthIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {foundationType === 'stem-wall' && (
                  <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
                    <div className="px-5 py-3 flex items-center gap-2 bg-amber-50/50 dark:bg-amber-900/20">
                      <Construction size={14} className="text-amber-600 dark:text-amber-500" />
                      <h3 className="font-bold text-amber-700 dark:text-amber-500 text-[11px] uppercase tracking-wider">Stem Wall & Footing</h3>
                    </div>
                    <div className="p-5 space-y-4 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stem Height (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(stemWallHeightIn)} 
                            onChange={(e) => setStemWallHeightIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stem Thick (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(stemWallThicknessIn)} 
                            onChange={(e) => setStemWallThicknessIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Footing Width (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(footingWidthIn)} 
                            onChange={(e) => setFootingWidthIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Footing Thick (in)</label>
                          <input 
                            type="number" 
                            value={sanitize(footingThicknessIn)} 
                            onChange={(e) => setFootingThicknessIn(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                  <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
                    <div className="px-5 py-3 flex items-center gap-2 bg-zinc-50/30 dark:bg-[#151a2e]/20">
                      <Settings size={14} className="text-zinc-500 dark:text-zinc-400" />
                      <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">Foundation Finish</h3>
                    </div>
                    <div className="p-5 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                      <select
                        value={foundationFinish}
                        onChange={(e) => setFoundationFinish(e.target.value as FoundationFinish)}
                        className="w-full px-3 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="none">None</option>
                        <option value="paint">Paint</option>
                        <option value="waterproof-coating">Waterproof Coating</option>
                        <option value="stucco-parging">Stucco Parging</option>
                        <option value="stone-veneer">Stone Veneer</option>
                      </select>
                    </div>
                  </div>
              </div>
            )}
          </div>

          {/* Walls Section */}
          <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
            <div 
              onClick={() => toggleSection('walls')}
              className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('walls'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg">
                  <LayoutGrid size={18} />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                    2. Walls & Shell
                    {activeWallSection && (
                      <span className="text-indigo-600 dark:text-indigo-400 ml-2 font-medium">
                        - {activeWallSection === 'dimensions' ? 'Dimensions' : 
                           activeWallSection === 'floor' ? 'Floors' :
                           activeWallSection === 'framing' ? 'Framing' :
                           activeWallSection === 'opening_heights' ? 'Heights' :
                           activeWallSection === 'doors' ? 'Doors' :
                           activeWallSection === 'windows' ? 'Windows' : ''}
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Dimensions, Openings, Layout</p>
                </div>
              </div>
              {openSections.walls ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
            </div>
            
            {openSections.walls && (
              <div className="border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424]">
                {/* Shell Dimensions */}
                <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
                  <div 
                    onClick={() => setActiveWallSection(activeWallSection === 'dimensions' ? null : 'dimensions')}
                    className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'dimensions' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={14} className={activeWallSection === 'dimensions' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                      <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'dimensions' ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>Walls & Dimensions</h3>
                    </div>
                    {activeWallSection === 'dimensions' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />}
                  </div>
                  {activeWallSection === 'dimensions' && (
                    <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                      {/* Framing Mode Toggle */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Framing Mode</label>
                        <div className="flex bg-zinc-100 dark:bg-[#151a2e] p-1 rounded-lg">
                          <button
                            onClick={() => {
                              setSolidWallsOnly(false);
                              setNoFramingFloorOnly(false);
                            }}
                            className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                              (!solidWallsOnly && !noFramingFloorOnly) 
                                ? 'bg-white dark:bg-[#1c2240] text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                          >
                            Framing
                          </button>
                          <button
                            onClick={() => {
                              setSolidWallsOnly(true);
                              setNoFramingFloorOnly(true);
                            }}
                            className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                              (solidWallsOnly && noFramingFloorOnly) 
                                ? 'bg-white dark:bg-[#1c2240] text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                            }`}
                          >
                            No Framing
                          </button>
                        </div>
                      </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">FLOOR PLAN SHAPE</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShape('rectangle')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 'rectangle' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Rectangle
                  </button>
                  <button
                    onClick={() => setShape('l-shape')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 'l-shape' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    L-Shape
                  </button>
                  <button
                    onClick={() => setShape('u-shape')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 'u-shape' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    U-Shape
                  </button>
                  <button
                    onClick={() => setShape('h-shape')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 'h-shape' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    H-Shape
                  </button>
                  <button
                    onClick={() => setShape('t-shape')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 't-shape' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    T-Shape
                  </button>
                  <button
                    onClick={() => setShape('custom')}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${shape === 'custom' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#151a2e] border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {shape !== 'u-shape' && shape !== 'h-shape' && shape !== 't-shape' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {shape === 'l-shape' ? 'WALL 1 FRONT WIDTH' : 'WALL 1 & 3: WIDTH'}
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={sanitize(widthFt)} 
                          onChange={(e) => setWidthFt(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                      </div>
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={sanitize(widthInches)} 
                          onChange={(e) => setWidthInches(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {shape === 'l-shape' ? 'WALL 6 LEFT DEPTH' : 'WALL 2 & 4: LENGTH'}
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={sanitize(lengthFt)} 
                          onChange={(e) => setLengthFt(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                      </div>
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={sanitize(lengthInches)} 
                          onChange={(e) => setLengthInches(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shape === 'h-shape' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Width (Outer)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(widthFt)} onChange={(e) => setWidthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(widthInches)} onChange={(e) => setWidthInches(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Length (Bars)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(lengthFt)} onChange={(e) => setLengthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(lengthInches)} onChange={(e) => setLengthInches(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Left Bar Width</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input type="number" step="any" value={sanitize(hLeftBarWidthFt)} onChange={(e) => setHLeftBarWidthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Right Bar Width</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input type="number" step="any" value={sanitize(hRightBarWidthFt)} onChange={(e) => setHRightBarWidthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Middle Bar Height (Thickness)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(hMiddleBarHeightFt)} onChange={(e) => setHMiddleBarHeightFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Middle Bar Offset (from Front)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(hMiddleBarOffsetFt)} onChange={(e) => setHMiddleBarOffsetFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shape === 't-shape' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Top Bar Width</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(tTopWidthFt)} onChange={(e) => setTTopWidthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Top Bar Length (Thickness)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(tTopLengthFt)} onChange={(e) => setTTopLengthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stem Width</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(tStemWidthFt)} onChange={(e) => setTStemWidthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stem Length</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input type="number" step="any" value={sanitize(tStemLengthFt)} onChange={(e) => setTStemLengthFt(Number(e.target.value))} className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shape === 'l-shape' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Corner Position</label>
                      <select
                        value={lDirection}
                        onChange={(e) => setLDirection(e.target.value as any)}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="front-left">Front Left (Default)</option>
                        <option value="front-right">Front Right</option>
                        <option value="back-right">Back Right</option>
                        <option value="back-left">Back Left</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 2: Right Depth</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={lRightDepthFt ?? 0} 
                              onChange={(e) => setLRightDepthFt(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={lRightDepthInches ?? 0} 
                              onChange={(e) => setLRightDepthInches(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 5: Back Width</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={lBackWidthFt ?? 0} 
                              onChange={(e) => setLBackWidthFt(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={lBackWidthInches ?? 0} 
                              onChange={(e) => setLBackWidthInches(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shape === 'u-shape' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Opening Direction</label>
                    <select 
                      value={uDirection} 
                      onChange={(e) => setUDirection(e.target.value as any)}
                      className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="back">Back (Default)</option>
                      <option value="front">Front</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 1: Base</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w1 ?? 0} 
                            onChange={(e) => handleUWallChange('w1', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w1 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w1', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 2: Right Outer</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w2 ?? 0} 
                            onChange={(e) => handleUWallChange('w2', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w2 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w2', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 3: Right End</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w3 ?? 0} 
                            onChange={(e) => handleUWallChange('w3', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w3 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w3', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 4: Right Inner</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w4 ?? 0} 
                            onChange={(e) => handleUWallChange('w4', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w4 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w4', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Wall 5: Middle</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w5 ?? 0} 
                            onChange={(e) => handleUWallChange('w5', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 dark:text-indigo-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w5 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w5', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 dark:text-indigo-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Wall 6: Left Inner</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w6 ?? 0} 
                            onChange={(e) => handleUWallChange('w6', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 dark:text-indigo-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w6 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w6', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-indigo-400 dark:text-indigo-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 7: Left End</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w7 ?? 0} 
                            onChange={(e) => handleUWallChange('w7', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w7 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w7', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall 8: Left Outer</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWalls?.w8 ?? 0} 
                            onChange={(e) => handleUWallChange('w8', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                        </div>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            step="any"
                            value={uWallsInches?.w8 ?? 0} 
                            onChange={(e) => handleUWallInchesChange('w8', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">WALL HEIGHT</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="number" 
                        step="any"
                        value={wallHeightFt ?? 0} 
                        onChange={(e) => setWallHeightFt(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                    </div>
                    <div className="flex-1 relative">
                      <input 
                        type="number" 
                        step="any"
                        value={wallHeightInches ?? 0} 
                        onChange={(e) => setWallHeightInches(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">THICKNESS (IN)</label>
                  <input 
                    type="number" 
                    step="any"
                    value={wallThicknessIn ?? 0} 
                    onChange={(e) => setWallThicknessIn(Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ADDITIONAL STORIES</label>
                  <input 
                    type="number" 
                    min="0"
                    max="10"
                    value={additionalStories ?? 0} 
                    onChange={(e) => setAdditionalStories(Math.max(0, Number(e.target.value)))}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {additionalStories > 0 && (
                <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500 dark:text-indigo-400" />
                    <h4 className="font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Story Settings (Upper Levels)</h4>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider">Upper Floor Wall Height</label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={upperFloorWallHeightFt} 
                          onChange={(e) => setUpperFloorWallHeightFt(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-3 bg-white dark:bg-[#0f1424] border border-indigo-200 dark:border-indigo-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 dark:text-indigo-500 font-medium">ft</span>
                      </div>
                      <div className="flex-1 relative">
                        <input 
                          type="number" 
                          step="any"
                          value={upperFloorWallHeightIn} 
                          onChange={(e) => setUpperFloorWallHeightIn(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full pl-3 pr-8 py-3 bg-white dark:bg-[#0f1424] border border-indigo-200 dark:border-indigo-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg font-bold text-zinc-900 dark:text-zinc-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 dark:text-indigo-500 font-medium">in</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider">Upper Floor Joist Size</label>
                    <select 
                      value={upperFloorJoistSize} 
                      onChange={(e) => setUpperFloorJoistSize(e.target.value as any)}
                      className="w-full px-3 py-3 bg-white dark:bg-[#0f1424] border border-indigo-200 dark:border-indigo-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg font-bold text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="2x6">2x6</option>
                      <option value="2x8">2x8</option>
                      <option value="2x10">2x10</option>
                      <option value="2x12">2x12</option>
                    </select>
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-zinc-200 dark:border-[#1c2240]">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 border-2 border-zinc-300 dark:border-[#243052] rounded overflow-hidden group-hover:border-indigo-500 dark:group-hover:border-indigo-400 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={generateDimensions} 
                      onChange={(e) => setGenerateDimensions(e.target.checked)}
                      className="absolute opacity-0 w-full h-full cursor-pointer"
                    />
                    {generateDimensions && <div className="w-full h-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">Generate Dimensions</span>
                </label>
              </div>
            </div>
                  )}
                </div>

          {/* Floor Options */}
          <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'floor' ? null : 'floor')}
              className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'floor' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className={activeWallSection === 'floor' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'floor' ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>Floors</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCopySection('floor'); }}
                  className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Copy code to update just the floor"
                >
                  <Copy size={12} /> Edit Floor
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleBuildInSketchup('floor'); }}
                  className="text-emerald-500 hover:text-emerald-600 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Build floor in SketchUp"
                >
                  <Hammer size={12} /> Build Floor
                </button>
                {activeWallSection === 'floor' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            {activeWallSection === 'floor' && (
              <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
              <div className="flex items-center gap-2 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  checked={addFloorFraming}
                  onChange={(e) => setAddFloorFraming(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-[#243052] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-[#151a2e]"
                />
                <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Add Floor Framing</span>
              </div>
              
              {addFloorFraming && (
                <div className={`space-y-6 transition-opacity duration-200 ${noFramingFloorOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Joist Spacing (in)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={joistSpacing} 
                        onChange={(e) => setJoistSpacing(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Joist Size</label>
                      <select 
                        value={joistSize} 
                        onChange={(e) => setJoistSize(e.target.value as any)}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="2x6">2x6</option>
                        <option value="2x8">2x8</option>
                        <option value="2x10">2x10</option>
                        <option value="2x12">2x12</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Joist Direction</label>
                      <div className="flex gap-1 bg-zinc-100 dark:bg-[#151a2e]/50 p-1 rounded-lg border border-zinc-200 dark:border-[#243052]">
                        <button
                          onClick={() => setJoistDirection('x')}
                          className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                            joistDirection === 'x' 
                              ? 'bg-white dark:bg-[#151a2e] text-indigo-600 dark:text-indigo-400 shadow-sm' 
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          }`}
                        >
                          X Span
                        </button>
                        <button
                          onClick={() => setJoistDirection('y')}
                          className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all ${
                            joistDirection === 'y' 
                              ? 'bg-white dark:bg-[#151a2e] text-indigo-600 dark:text-indigo-400 shadow-sm' 
                              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                          }`}
                        >
                          Y Span
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Rim Joist Thk (in)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={rimJoistThickness} 
                        onChange={(e) => setRimJoistThickness(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  {/* ── Per-Bay Joist Direction Controls ── */}
                  {shape !== 'rectangle' && (
                    <div className="space-y-2 mt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Per-Bay Direction
                        </label>
                        <div className="flex gap-1.5">
                          {floorBays.length === 0 ? (
                            <button
                              onClick={() => {
                                const bays = detectBays(currentState);
                                if (bays.length > 0) setFloorBays(bays);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors flex items-center gap-1"
                            >
                              <Layers size={10} />
                              Auto-Detect Bays
                            </button>
                          ) : (
                            <button
                              onClick={() => setFloorBays([])}
                              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded-md transition-colors"
                            >
                              Reset to Global
                            </button>
                          )}
                        </div>
                      </div>

                      {floorBays.length > 0 && (
                        <div className="space-y-1 bg-zinc-50 dark:bg-[#151a2e]/60 rounded-lg border border-zinc-200 dark:border-[#243052] p-2">
                          {floorBays.map((bay, idx) => (
                            <div key={bay.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-white dark:bg-[#0f1424] border border-zinc-100 dark:border-[#1c2240]">
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                                  {bay.label}
                                </div>
                                <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                                  {formatBayDimensions(bay)}
                                </div>
                              </div>
                              <div className="flex gap-0.5 bg-zinc-100 dark:bg-[#151a2e]/80 p-0.5 rounded-md border border-zinc-200 dark:border-[#243052]">
                                <button
                                  onClick={() => {
                                    setFloorBays(prev => prev.map((b, i) =>
                                      i === idx ? { ...b, joistDirection: 'x' } : b
                                    ));
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    bay.joistDirection === 'x'
                                      ? 'bg-indigo-500 text-white shadow-sm'
                                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                                  }`}
                                  title="Joists span along X axis"
                                >
                                  → X
                                </button>
                                <button
                                  onClick={() => {
                                    setFloorBays(prev => prev.map((b, i) =>
                                      i === idx ? { ...b, joistDirection: 'y' } : b
                                    ));
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                    bay.joistDirection === 'y'
                                      ? 'bg-indigo-500 text-white shadow-sm'
                                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                                  }`}
                                  title="Joists span along Y axis"
                                >
                                  ↓ Y
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center mt-1 font-medium italic">
                            Each bay defaults to span the shorter dimension
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col justify-center">
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input 
                          type="checkbox" 
                          checked={addSubfloor}
                          onChange={(e) => setAddSubfloor(e.target.checked)}
                          className="rounded border-zinc-300 dark:border-[#243052] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-[#151a2e]"
                        />
                        <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Add Subfloor</span>
                      </label>
                    </div>
                    {addSubfloor && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Subfloor Thk (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={subfloorThickness} 
                          onChange={(e) => setSubfloorThickness(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}
                  </div>
                  {addSubfloor && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Subfloor Material</label>
                      <select 
                        value={subfloorMaterial} 
                        onChange={(e) => setSubfloorMaterial(e.target.value as any)}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="plywood">Plywood</option>
                        <option value="osb">OSB</option>
                      </select>
                    </div>
                  )}

                  {/* Girder Support System */}
                  <div className="border-t border-zinc-200 dark:border-[#243052] pt-4 mt-4 space-y-4">
                    <div className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        id="enableGirderSystem"
                        checked={enableGirderSystem}
                        onChange={(e) => setEnableGirderSystem(e.target.checked)}
                        className="rounded border-zinc-300 dark:border-[#243052] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-[#151a2e]"
                      />
                      <label htmlFor="enableGirderSystem" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider cursor-pointer">
                        Add Girder Support System
                      </label>
                    </div>

                    {enableGirderSystem && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Span Threshold (ft)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={girderSpanThresholdFt} 
                              onChange={(e) => setGirderSpanThresholdFt(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Post Spacing (ft)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={girderPostSpacingFt} 
                              onChange={(e) => setGirderPostSpacingFt(Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Girder Size</label>
                            <select 
                              value={girderSize} 
                              onChange={(e) => setGirderSize(e.target.value as any)}
                              className="w-full px-2 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="2-2x10">Double 2x10</option>
                              <option value="3-2x10">Triple 2x10</option>
                              <option value="4-2x10">Quad 2x10</option>
                              <option value="6x6">Solid 6x6</option>
                              <option value="6x8">Solid 6x8</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Post Size</label>
                            <select 
                              value={girderPostSize} 
                              onChange={(e) => setGirderPostSize(e.target.value as any)}
                              className="w-full px-2 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="4x4">4x4 Wood</option>
                              <option value="6x6">6x6 Wood</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pier Size</label>
                            <select 
                              value={girderPierSize} 
                              onChange={(e) => setGirderPierSize(e.target.value as any)}
                              className="w-full px-2 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="12&quot; Round">12" Round</option>
                              <option value="16&quot; Square">16" Square</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 cursor-pointer pt-2">
                          <input 
                            type="checkbox" 
                            id="addPocketBeams"
                            checked={addPocketBeams}
                            onChange={(e) => setAddPocketBeams(e.target.checked)}
                            className="rounded border-zinc-300 dark:border-[#243052] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-[#151a2e]"
                          />
                          <label htmlFor="addPocketBeams" className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider cursor-pointer">
                            Add Pocket Beams at Transitions
                          </label>
                        </div>
                        {addPocketBeams && (
                          <div className="flex items-center gap-2 cursor-pointer pl-4 pt-1">
                            <input 
                              type="checkbox" 
                              id="pocketBeamsOnlyAtGirderEnds"
                              checked={pocketBeamsOnlyAtGirderEnds}
                              onChange={(e) => setPocketBeamsOnlyAtGirderEnds(e.target.checked)}
                              className="rounded border-zinc-300 dark:border-[#243052] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:bg-[#151a2e]"
                            />
                            <label htmlFor="pocketBeamsOnlyAtGirderEnds" className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer">
                              Only at Girder Ends
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          {/* Framing Options */}
          <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'framing' ? null : 'framing')}
              className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'framing' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
            >
              <div className="flex items-center gap-2">
                <Hammer size={14} className={activeWallSection === 'framing' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'framing' ? 'text-indigo-700 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>Wall Framing Options</h3>
              </div>
              {activeWallSection === 'framing' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />}
            </div>
            {activeWallSection === 'framing' && (
              <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
                <div className={`space-y-6 transition-opacity duration-200 ${solidWallsOnly ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stud Spacing (in)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={studSpacing} 
                        onChange={(e) => setStudSpacing(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Stud Thickness (in)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={studThickness} 
                        onChange={(e) => setStudThickness(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Top Plates</label>
                      <input 
                        type="number" 
                        value={topPlates} 
                        onChange={(e) => setTopPlates(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bottom Plates</label>
                      <input 
                        type="number" 
                        value={bottomPlates} 
                        onChange={(e) => setBottomPlates(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Header Type</label>
                      <select
                        value={headerType}
                        onChange={(e) => setHeaderType(e.target.value as any)}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="single">Single</option>
                        <option value="double">Double</option>
                        <option value="lvl">LVL</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Header Height (in)</label>
                      <input 
                        type="number" 
                        step="any"
                        value={headerHeight} 
                        onChange={(e) => setHeaderHeight(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
<div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-[#243052] rounded-lg bg-zinc-50/50 dark:bg-[#151a2e]/30">
<label className="flex items-center gap-2 cursor-pointer">
<input
type="checkbox"
checked={addSheathing}
onChange={(e) => setAddSheathing(e.target.checked)}
className="rounded border-zinc-300 dark:border-[#2d3a5e] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500" />
<span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">OSB Sheathing</span>
</label>
{addSheathing&&(
<div className="flex items-center gap-2">
<span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thickness (in)</span>
<input
type="number"
step="0.125"
min="0"
value={sheathingThickness}
onChange={(e) => setSheathingThickness(Number(e.target.value))}
onFocus={(e) => e.target.select()}
className="w-20 px-2 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold text-zinc-900 dark:text-zinc-100" />
</div>
)}
</div>

<div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-[#243052] rounded-lg bg-zinc-50/50 dark:bg-[#151a2e]/30">
<label className="flex items-center gap-2 cursor-pointer">
<input
type="checkbox"
checked={addInsulation}
onChange={(e) => setAddInsulation(e.target.checked)}
className="rounded border-zinc-300 dark:border-[#2d3a5e] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500" />
<span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Insulation</span>
</label>
{addInsulation&&(
<div className="flex items-center gap-2">
<span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thickness (in)</span>
<input
type="number"
step="0.5"
min="0"
value={insulationThickness}
onChange={(e) => setInsulationThickness(Number(e.target.value))}
onFocus={(e) => e.target.select()}
className="w-20 px-2 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold text-zinc-900 dark:text-zinc-100" />
</div>
)}
</div>

<div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-[#243052] rounded-lg bg-zinc-50/50 dark:bg-[#151a2e]/30">
<label className="flex items-center gap-2 cursor-pointer">
<input
type="checkbox"
checked={addDrywall}
onChange={(e) => setAddDrywall(e.target.checked)}
className="rounded border-zinc-300 dark:border-[#2d3a5e] text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500" />
<span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Drywall</span>
</label>
{addDrywall&&(
<div className="flex items-center gap-2">
<span className="text-[11px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thickness (in)</span>
<input
type="number"
step="0.125"
min="0"
value={drywallThickness}
onChange={(e) => setDrywallThickness(Number(e.target.value))}
onFocus={(e) => e.target.select()}
className="w-20 px-2 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold text-zinc-900 dark:text-zinc-100" />
</div>
)}
</div>
                  </div>
                  
                  <div className="space-y-1.5 mb-4">
                    <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Interior Wall Finish</label>
                    <select
                      value={interiorFinish}
                      onChange={(e) => setInteriorFinish(e.target.value as InteriorFinish)}
                      className="w-full px-3 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="none">None</option>
                      <option value="paint-standard">Paint (Standard)</option>
                      <option value="paint-premium">Paint (Premium)</option>
                      <option value="wallpaper">Wallpaper</option>
                      <option value="tile">Tile</option>
                      <option value="wood-paneling">Wood Paneling</option>
                      <option value="wainscoting">Wainscoting</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 mt-4 mb-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Per-Wall Exterior Finish</label>
                        <select
                          onChange={(e) => {
                            const val = e.target.value as any;
                            if (!val) return;
                            const newFinishes = { ...wallFinishes };
                            getAvailableWallOptions.filter(o => !o.label.startsWith('Int')).forEach(o => {
                              if (val === 'none') {
                                delete newFinishes[o.id];
                              } else {
                                newFinishes[o.id] = val;
                              }
                            });
                            setWallFinishes(newFinishes);
                            e.target.value = ''; // reset after apply
                          }}
                          className="px-2 py-1 text-[10px] bg-white dark:bg-[#151a2e] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-600 dark:text-zinc-300"
                        >
                          <option value="">Bulk Apply To All...</option>
                          <option value="none">None</option>
                          <option value="wood-siding">Wood Siding</option>
                          <option value="vinyl-siding">Vinyl Siding</option>
                          <option value="hardie-board">Hardie Board</option>
                          <option value="brick">Brick</option>
                          <option value="stucco">Stucco</option>
                        </select>
                      </div>
                      
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 border border-zinc-200 dark:border-[#1c2240] rounded-lg p-2 bg-zinc-50/50 dark:bg-[#0f1424] custom-scrollbar">
                        {getAvailableWallOptions.filter(o => !o.label.startsWith('Int')).map(opt => (
                          <div key={opt.id} className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                            <select
                              value={wallFinishes[opt.id] || 'none'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setWallFinishes(prev => {
                                  const next = { ...prev };
                                  if (val === 'none') {
                                    delete next[opt.id];
                                  } else {
                                    next[opt.id] = val as any;
                                  }
                                  return next;
                                });
                              }}
                              className="w-[120px] px-2 py-1 text-xs bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="none">None</option>
                              <option value="wood-siding">Wood Siding</option>
                              <option value="vinyl-siding">Vinyl Siding</option>
                              <option value="hardie-board">Hardie Board</option>
                              <option value="brick">Brick</option>
                              <option value="stucco">Stucco</option>
                            </select>
                          </div>
                        ))}
                        {getAvailableWallOptions.filter(o => !o.label.startsWith('Int')).length === 0 && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">No exterior walls available</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Door RO Add</label>
                      <input 
                        type="number" 
                        step="any"
                        value={doorRoAllowance} 
                        onChange={(e) => setDoorRoAllowance(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Win RO Add</label>
                      <input 
                        type="number" 
                        step="any"
                        value={windowRoAllowance} 
                        onChange={(e) => setWindowRoAllowance(Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Opening Heights */}
          <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'opening_heights' ? null : 'opening_heights')}
              className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'opening_heights' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
            >
              <div className="flex items-center gap-2">
                <Settings size={14} className={activeWallSection === 'opening_heights' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'opening_heights' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>Opening Heights</h3>
              </div>
              {activeWallSection === 'opening_heights' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />}
            </div>
            {activeWallSection === 'opening_heights' && (
            <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Default Header Height (in)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    step="any"
                    value={openingHeaderHeightIn} 
                    onChange={handleHeaderHeightChange}
                    onFocus={(e) => e.target.select()}
                    className="w-32 px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Changes all doors to this height, and adjusts window sills to match.
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Door Placement */}
          <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'doors' ? null : 'doors')}
              className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'doors' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
            >
              <div className="flex items-center gap-2">
                <DoorOpen size={14} className={activeWallSection === 'doors' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'doors' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>Doors</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); addDoor(); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Door
                </button>
                {activeWallSection === 'doors' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            
            {activeWallSection === 'doors' && (
            <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
              {doors.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No doors added.</p>
              )}
              
              {doors.map((door, index) => (
                <div key={door.id} className="relative border border-zinc-100 dark:border-[#1c2240] rounded-lg p-3 bg-zinc-50/50 dark:bg-[#151a2e]/30">
                  <div className="absolute -top-2.5 left-3 bg-white dark:bg-[#0f1424] px-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Door {index + 1}
                  </div>
                  <div className="absolute -top-2.5 right-2 flex items-center gap-1 bg-white dark:bg-[#0f1424] px-1">
                    <button 
                      onClick={() => handleCopyWall(door.wall)}
                      className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                      title="Copy code to update just this wall"
                    >
                      <Copy size={12} /> Edit Wall {door.wall}
                    </button>
                    <button 
                      onClick={() => removeDoor(door.id)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full transition-colors"
                      title="Remove door"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mt-1">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall</label>
                        <select 
                          value={door.wall} 
                          onChange={(e) => updateDoor(door.id, 'wall', Number(e.target.value))}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                        >
                          {getAvailableWallOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Dist. from Left</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={door.xFt} 
                              onChange={(e) => updateDoor(door.id, 'xFt', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={door.xInches} 
                              onChange={(e) => updateDoor(door.id, 'xInches', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Width (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={door.widthIn} 
                          onChange={(e) => updateDoor(door.id, 'widthIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Height (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={door.heightIn} 
                          onChange={(e) => updateDoor(door.id, 'heightIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    {/* Link 3D Model (.glb) */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="flex items-center gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept=".glb,.gltf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                setDoors(prev => prev.map(d => d.id === door.id ? { ...d, modelUrl: url, modelFileName: file.name } : d));
                              }
                            }}
                          />
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg border border-dashed border-zinc-300 dark:border-[#2d3a5e] bg-zinc-50 dark:bg-[#151a2e]/50 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-all">
                            <Upload size={14} />
                            {door.modelUrl ? 'Change 3D Model' : 'Link 3D Model (.glb)'}
                          </div>
                        </label>
                        {door.modelUrl && (
                          <button
                            onClick={() => {
                              if (door.modelUrl) URL.revokeObjectURL(door.modelUrl);
                              setDoors(prev => prev.map(d => d.id === door.id ? { ...d, modelUrl: undefined, modelFileName: undefined } : d));
                            }}
                            className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-colors"
                            title="Remove linked model"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {door.modelFileName && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 truncate" title={door.modelFileName}>
                          ✓ {door.modelFileName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Window Placement */}
          <div className="border-b border-zinc-100 dark:border-[#1c2240] last:border-b-0">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'windows' ? null : 'windows')}
              className={`px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors ${activeWallSection === 'windows' ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#0f1424]'}`}
            >
              <div className="flex items-center gap-2">
                <AppWindow size={14} className={activeWallSection === 'windows' ? 'text-indigo-500 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wider ${activeWallSection === 'windows' ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}>Windows</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); addWindow(); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Window
                </button>
                {activeWallSection === 'windows' ? <ChevronDown size={14} className="text-indigo-400 dark:text-indigo-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            
            {activeWallSection === 'windows' && (
            <div className="p-5 space-y-6 bg-white dark:bg-[#0f1424] border-t border-zinc-100 dark:border-[#1c2240]">
              {windows.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No windows added.</p>
              )}
              
              {windows.map((win, index) => (
                <div key={win.id} className="relative border border-zinc-100 dark:border-[#1c2240] rounded-lg p-3 bg-zinc-50/50 dark:bg-[#151a2e]/30">
                  <div className="absolute -top-2.5 left-3 bg-white dark:bg-[#0f1424] px-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Window {index + 1}
                  </div>
                  <div className="absolute -top-2.5 right-2 flex items-center gap-1 bg-white dark:bg-[#0f1424] px-1">
                    <button 
                      onClick={() => handleCopyWall(win.wall)}
                      className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                      title="Copy code to update just this wall"
                    >
                      <Copy size={12} /> Edit Wall {win.wall}
                    </button>
                    <button 
                      onClick={() => removeWindow(win.id)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full transition-colors"
                      title="Remove window"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mt-1">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall</label>
                        <select 
                          value={win.wall} 
                          onChange={(e) => updateWindow(win.id, 'wall', Number(e.target.value))}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                        >
                          {getAvailableWallOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Dist. from Left</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={win.xFt} 
                              onChange={(e) => updateWindow(win.id, 'xFt', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={win.xInches} 
                              onChange={(e) => updateWindow(win.id, 'xInches', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Sill (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={win.sillHeightIn} 
                          onChange={(e) => updateWindow(win.id, 'sillHeightIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Width (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={win.widthIn} 
                          onChange={(e) => updateWindow(win.id, 'widthIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Height (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={win.heightIn} 
                          onChange={(e) => updateWindow(win.id, 'heightIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                    {/* Link 3D Model (.glb) */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="flex items-center gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept=".glb,.gltf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                setWindows(prev => prev.map(w => w.id === win.id ? { ...w, modelUrl: url, modelFileName: file.name } : w));
                              }
                            }}
                          />
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg border border-dashed border-zinc-300 dark:border-[#2d3a5e] bg-zinc-50 dark:bg-[#151a2e]/50 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-all">
                            <Upload size={14} />
                            {win.modelUrl ? 'Change 3D Model' : 'Link 3D Model (.glb)'}
                          </div>
                        </label>
                        {win.modelUrl && (
                          <button
                            onClick={() => {
                              if (win.modelUrl) URL.revokeObjectURL(win.modelUrl);
                              setWindows(prev => prev.map(w => w.id === win.id ? { ...w, modelUrl: undefined, modelFileName: undefined } : w));
                            }}
                            className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-colors"
                            title="Remove linked model"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {win.modelFileName && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 truncate" title={win.modelFileName}>
                          ✓ {win.modelFileName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>



          {/* Bumpouts */}
          <div className="bg-zinc-50/50 dark:bg-[#151a2e]/30 rounded-xl border border-zinc-200 dark:border-[#1c2240] overflow-hidden">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'bumpouts' ? null : 'bumpouts')}
              className="px-4 py-2.5 border-b border-zinc-200 dark:border-[#1c2240] flex items-center justify-between bg-white dark:bg-[#0f1424] cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Box size={14} className="text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">Bumpouts</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); addBumpout(); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Bumpout
                </button>
                {activeWallSection === 'bumpouts' ? <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            
            {activeWallSection === 'bumpouts' && (
            <div className="p-4 space-y-6">
              {bumpouts.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No bumpouts added.</p>
              )}
              
              {bumpouts.map((bump, index) => (
                <div key={bump.id} className="relative border border-zinc-100 dark:border-[#1c2240] rounded-lg p-3 bg-zinc-50/50 dark:bg-[#151a2e]/30">
                  <div className="absolute -top-2.5 left-3 bg-white dark:bg-[#0f1424] px-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Bumpout {index + 1}
                  </div>
                  <div className="absolute -top-2.5 right-2 flex items-center gap-1 bg-white dark:bg-[#0f1424] px-1">
                    <button 
                      onClick={() => removeBumpout(bump.id)}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full transition-colors"
                      title="Remove bumpout"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 mt-1">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Wall</label>
                        <select 
                          value={bump.wall} 
                          onChange={(e) => updateBumpout(bump.id, 'wall', Number(e.target.value))}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          {shape === 'l-shape' && (
                            <>
                              <option value={5}>5</option>
                              <option value={6}>6</option>
                            </>
                          )}
                          {shape === 'u-shape' && (
                            <>
                              <option value={5}>5</option>
                              <option value={6}>6</option>
                              <option value={7}>7</option>
                              <option value={8}>8</option>
                            </>
                          )}
                          {exteriorWalls.map(w => (
                            <option key={w.id} value={w.id}>Ext Wall {w.id}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Dist. from Left</label>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={bump.xFt} 
                              onChange={(e) => updateBumpout(bump.id, 'xFt', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                          </div>
                          <div className="flex-1 relative">
                            <input 
                              type="number" 
                              step="any"
                              value={bump.xInches} 
                              onChange={(e) => updateBumpout(bump.id, 'xInches', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Width (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={bump.widthIn} 
                          onChange={(e) => updateBumpout(bump.id, 'widthIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Depth (in)</label>
                        <input 
                          type="number" 
                          step="any"
                          value={bump.depthIn} 
                          onChange={(e) => updateBumpout(bump.id, 'depthIn', Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
          
          {/* Exterior Walls */}
          <div className="bg-zinc-50/50 dark:bg-[#151a2e]/30 rounded-xl border border-zinc-200 dark:border-[#1c2240] overflow-hidden">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'exterior' ? null : 'exterior')}
              className="px-4 py-2.5 border-b border-zinc-200 dark:border-[#1c2240] flex items-center justify-between bg-white dark:bg-[#0f1424] cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">
                  {shape === 'custom' ? 'Exterior Walls (Custom)' : 'Additional Exterior Walls'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCopySection('exterior'); }}
                  className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Copy code to update just the exterior walls"
                >
                  <Copy size={12} /> Edit Exterior
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleBuildInSketchup('exterior'); }}
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Build exterior walls in SketchUp"
                >
                  <Hammer size={12} /> Build Exterior
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); addExteriorWall(); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Wall
                </button>
                {activeWallSection === 'exterior' ? <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            
            {activeWallSection === 'exterior' && (
            <div className="p-4 space-y-6">
              {exteriorWalls.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No custom exterior walls added.</p>
              )}
              
              {[...exteriorWalls].reverse().map((wall) => {
                const isExpanded = expandedExtWallId === wall.id;
                const actualIndex = exteriorWalls.findIndex(w => w.id === wall.id);
                
                return (
                  <div key={wall.id} className={`relative border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-indigo-200 dark:border-indigo-800 bg-white dark:bg-[#0f1424] shadow-sm' : 'border-zinc-100 dark:border-[#1c2240] bg-zinc-50/50 dark:bg-[#151a2e]/30'}`}>
                    <div 
                      onClick={() => setExpandedExtWallId(isExpanded ? null : wall.id)}
                      className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-[#1c2240]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${wall.orientation === 'horizontal' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Ext Wall {wall.id}</span>
                        {!isExpanded && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {wall.lengthFt}' {wall.lengthInches}" • {wall.orientation === 'horizontal' ? 'H' : 'V'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeExteriorWall(wall.id); }}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full transition-colors"
                          title="Remove wall"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isExpanded ? <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 pt-1 space-y-4 border-t border-zinc-50 dark:border-[#1c2240]">
                        <div className="flex items-center gap-1 justify-end mb-2">
                          {actualIndex > 0 && (
                            <button 
                              onClick={() => handleSnapToPrevious(wall.id)}
                              className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/50 px-1.5"
                              title="Snap to end of previous wall"
                            >
                              <Magnet size={12} /> Snap to Prev
                            </button>
                          )}
                          <button
                            onClick={() => updateExteriorWallFields(wall.id, { exteriorSide: wall.exteriorSide === 1 ? -1 : 1 })}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                            title="Flip Wall Side (Inside/Outside)"
                          >
                            <Layers size={12} /> Flip Side
                          </button>
                          <button
                            onClick={() => {
                              const totalInches = wall.lengthFt * 12 + wall.lengthInches;
                              const newInches = -totalInches;
                              updateExteriorWallFields(wall.id, {
                                lengthFt: newInches >= 0 ? Math.floor(newInches / 12) : Math.ceil(newInches / 12),
                                lengthInches: Math.round(newInches % 12)
                              });
                            }}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                            title="Flip Wall Direction"
                          >
                            <Move size={12} /> Flip Dir
                          </button>
                          <button 
                            onClick={() => handleCopyWall(wall.id)}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                            title="Copy code to update just this wall"
                          >
                            <Copy size={12} /> Edit
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Orientation</label>
                            <select 
                              value={wall.orientation} 
                              onChange={(e) => updateExteriorWall(wall.id, 'orientation', e.target.value as 'horizontal' | 'vertical')}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Length</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'length')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap length to nearest walls"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.lengthFt} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'lengthFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.lengthInches} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'lengthInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">H Pos</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'x')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap H position to nearest wall"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.xFt} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'xFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.xInches} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'xInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">V Pos</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'y')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap V position to nearest wall"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.yFt} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'yFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.yInches} 
                                  onChange={(e) => updateExteriorWall(wall.id, 'yInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Ext Side</label>
                            <button 
                              onClick={() => updateExteriorWall(wall.id, 'exteriorSide', wall.exteriorSide === 1 ? -1 : 1)}
                              className={`w-full px-3 py-4 rounded-lg border text-base font-bold transition-all ${wall.exteriorSide === 1 ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-zinc-50 dark:bg-[#151a2e]/50 border-zinc-200 dark:border-[#243052] text-zinc-600 dark:text-zinc-400'}`}
                            >
                              {wall.exteriorSide === 1 ? 'Positive (+)' : 'Negative (-)'}
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thickness (in)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={wall.thicknessIn} 
                              onChange={(e) => updateExteriorWall(wall.id, 'thicknessIn', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Interior Walls */}
          <div className="bg-zinc-50/50 dark:bg-[#151a2e]/30 rounded-xl border border-zinc-200 dark:border-[#1c2240] overflow-hidden">
            <div 
              onClick={() => setActiveWallSection(activeWallSection === 'interior' ? null : 'interior')}
              className="px-4 py-2.5 border-b border-zinc-200 dark:border-[#1c2240] flex items-center justify-between bg-white dark:bg-[#0f1424] cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors"
            >
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-[11px] uppercase tracking-wider">Interior Walls</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCopySection('interior'); }}
                  className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Copy code to update just the interior walls"
                >
                  <Copy size={12} /> Edit Interior
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleBuildInSketchup('interior'); }}
                  className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                  title="Build interior walls in SketchUp"
                >
                  <Hammer size={12} /> Build Interior
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); addInteriorWall(); }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-2 py-1 rounded transition-colors"
                >
                  <Plus size={12} /> Add Wall
                </button>
                {activeWallSection === 'interior' ? <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500 ml-2" />}
              </div>
            </div>
            
            {activeWallSection === 'interior' && (
            <div className="p-4 space-y-6">
              {interiorWalls.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No interior walls added.</p>
              )}
              
              {[...interiorWalls].reverse().map((wall) => {
                const isExpanded = expandedWallId === wall.id;
                const actualIndex = interiorWalls.findIndex(w => w.id === wall.id);
                
                return (
                  <div key={wall.id} className={`relative border rounded-lg overflow-hidden transition-all ${isExpanded ? 'border-indigo-200 dark:border-indigo-800 bg-white dark:bg-[#0f1424] shadow-sm' : 'border-zinc-100 dark:border-[#1c2240] bg-zinc-50/50 dark:bg-[#151a2e]/30'}`}>
                    <div 
                      onClick={() => setExpandedWallId(isExpanded ? null : wall.id)}
                      className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-[#1c2240]/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${wall.orientation === 'horizontal' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Wall {wall.id}</span>
                        {!isExpanded && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                            {wall.lengthFt}' {wall.lengthInches}" • {wall.orientation === 'horizontal' ? 'Red' : 'Green'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeInteriorWall(wall.id); }}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full transition-colors"
                          title="Remove wall"
                        >
                          <Trash2 size={14} />
                        </button>
                        {isExpanded ? <ChevronDown size={14} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3 pt-1 space-y-4 border-t border-zinc-50 dark:border-[#1c2240]">
                        <div className="flex items-center gap-1 justify-end mb-2">
                          {actualIndex > 0 && (
                            <button 
                              onClick={() => handleSnapToPrevious(wall.id)}
                              className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider border border-indigo-100 dark:border-indigo-900/50 px-1.5"
                              title="Snap to end of previous wall"
                            >
                              <Magnet size={12} /> Snap to Prev
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const totalInches = wall.lengthFt * 12 + wall.lengthInches;
                              const newInches = -totalInches;
                              updateInteriorWallFields(wall.id, {
                                lengthFt: newInches >= 0 ? Math.floor(newInches / 12) : Math.ceil(newInches / 12),
                                lengthInches: Math.round(newInches % 12)
                              });
                            }}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                            title="Flip Wall Direction"
                          >
                            <Move size={12} /> Flip Dir
                          </button>
                          <button 
                            onClick={() => handleCopyWall(wall.id)}
                            className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded-full transition-colors flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                            title="Copy code to update just this wall"
                          >
                            <Copy size={12} /> Edit
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Orientation</label>
                            <select 
                              value={wall.orientation} 
                              onChange={(e) => updateInteriorWall(wall.id, 'orientation', e.target.value)}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="horizontal">Red (X Axis)</option>
                              <option value="vertical">Green (Y Axis)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Length</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'length')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap length to nearest wall"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.lengthFt} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'lengthFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.lengthInches} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'lengthInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">H Pos</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'x')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap H position to nearest wall"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.xFt} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'xFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.xInches} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'xInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">V Pos</label>
                              <button 
                                type="button"
                                onClick={() => handleSnap(wall.id, 'y')}
                                className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-0.5 rounded transition-colors flex items-center gap-1"
                                title="Snap V position to nearest wall"
                              >
                                <Magnet size={12} />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.yFt} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'yFt', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">ft</span>
                              </div>
                              <div className="flex-1 relative">
                                <input 
                                  type="number" 
                                  step="any"
                                  value={wall.yInches} 
                                  onChange={(e) => updateInteriorWall(wall.id, 'yInches', Number(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full pl-3 pr-8 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 dark:text-zinc-500 font-medium">in</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Thickness (in)</label>
                            <input 
                              type="number" 
                              step="any"
                              value={wall.thicknessIn} 
                              onChange={(e) => updateInteriorWall(wall.id, 'thicknessIn', Number(e.target.value))}
                              onFocus={(e) => e.target.select()}
                              className="w-full px-3 py-4 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xl font-bold text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}
    </div>

        {/* Roof Section */}
        <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
          <div 
            onClick={() => toggleSection('roof')}
            className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('roof'); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg">
                <Triangle size={18} />
              </div>
              <div className="text-left">
                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">3. Roof</h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Pitch, Overhangs, Trusses</p>
              </div>
            </div>
            {openSections.roof ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
          </div>
          {openSections.roof && (
            <div className="p-4 border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">PRESETS</label>
                <div className="flex gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <label className="cursor-pointer hover:text-indigo-500 transition-colors border-b-2 border-amber-400 pb-0.5">
                    IMPORT FOLDER
                    <input 
                      type="file" 
                      multiple 
                      accept=".rb" 
                      className="hidden" 
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const newFiles = [];
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          if (file.name.endsWith('.rb')) {
                            const text = await file.text();
                            newFiles.push({ name: file.name, content: text });
                          }
                        }
                        setImportedRubyFiles(prev => [...prev, ...newFiles]);
                        alert(`Imported ${newFiles.length} Ruby files.`);
                      }} 
                    />
                  </label>
                  <button className="hover:text-indigo-500 transition-colors">EXPORT ALL</button>
                </div>
              </div>
              
              <select className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm">
                <option>Load Preset...</option>
              </select>
              
              <div className="flex gap-2">
                <input type="text" placeholder="Preset Name" className="flex-1 px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm" />
                <button className="px-4 py-2 bg-zinc-400 text-white font-bold text-xs rounded hover:bg-zinc-500 transition-colors">SAVE</button>
              </div>

              {/* Truss Builder Accordion */}
              <div className="pt-6 border-t border-zinc-100 dark:border-[#1c2240]">
                <div 
                  onClick={() => setIsTrussBuilderOpen(!isTrussBuilderOpen)}
                  className="flex items-center justify-between mb-3 cursor-pointer group"
                >
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm group-hover:text-indigo-500 transition-colors">Truss</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                      {trussRuns.length} Added
                    </span>
                    {isTrussBuilderOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                  </div>
                </div>

                {isTrussBuilderOpen && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">TRUSS TYPE</label>
                  <select 
                    value={customTrussScript && customTrussScript !== "None (Use Default)" ? "custom" : currentTrussSettings.type}
                    onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, type: e.target.value})}
                    disabled={!!customTrussScript && customTrussScript !== "None (Use Default)"}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {customTrussScript && customTrussScript !== "None (Use Default)" ? (
                      <option value="custom">Overridden by Custom Script</option>
                    ) : (
                      <>
                        <option value="Fink (W)">Fink (W)</option>
                        <option value="Howe">Howe</option>
                        <option value="King Post">King Post</option>
                        <option value="Scissor">Scissor</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">CUSTOM TRUSS SCRIPT</label>
                  <select 
                    value={customTrussScript}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomTrussScript(val);
                      const file = importedRubyFiles.find(f => f.name === val);
                      if (file && (file.content.toLowerCase().includes('plywood') || val.toLowerCase().includes('plywood'))) {
                        setCurrentTrussSettings(prev => ({...prev, hasPlywood: true}));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="">None (Use Default)</option>
                    {importedRubyFiles.map((file, idx) => (
                      <option key={idx} value={file.name}>{file.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1 pb-2">
                  <input 
                    type="checkbox"
                    checked={currentTrussSettings.hasPlywood || false}
                    onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, hasPlywood: e.target.checked})}
                    className="accent-indigo-500 w-4 h-4 rounded border-zinc-300"
                  />
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ADD PLYWOOD SHEATHING</label>
                </div>
                
                <div className="space-y-1.5 pb-4 border-b border-zinc-100 dark:border-[#1c2240]">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ROOF MATERIAL</label>
                  <select
                    value={roofFinish}
                    onChange={(e) => setRoofFinish(e.target.value as RoofFinish)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-bold text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="none">None</option>
                    <option value="asphalt-3tab">Asphalt Shingles (3-Tab)</option>
                    <option value="architectural-shingles">Architectural Shingles</option>
                    <option value="metal-standing-seam">Metal Roofing (Standing Seam)</option>
                    <option value="clay-tile">Clay Tile</option>
                    <option value="slate">Slate</option>
                    <option value="wood-shakes">Wood Shakes</option>
                    <option value="tpo-membrane">TPO / Flat Roof Membrane</option>
                    <option value="roof-paint">Roof Paint (Elastomeric)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">SPAN (FEET)</label>
                  <input 
                    type="number" 
                    value={currentTrussSettings.spanFt}
                    onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, spanFt: Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">PITCH (X/12)</label>
                  <input 
                    type="number" 
                    value={currentTrussSettings.pitch}
                    onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, pitch: Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">LENGTH (FT)</label>
                    <input 
                      type="number" 
                      value={currentTrussSettings.lengthFt}
                      onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, lengthFt: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">SPACING (IN)</label>
                    <input 
                      type="number" 
                      value={currentTrussSettings.spacingIn}
                      onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, spacingIn: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">OVERHANG (INCHES)</label>
                  <input 
                    type="number" 
                    value={currentTrussSettings.overhangIn}
                    onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, overhangIn: Number(e.target.value)})}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">HEEL HEIGHT (IN)</label>
                    <input 
                      type="number" 
                      value={currentTrussSettings.heelHeightIn}
                      onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, heelHeightIn: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">PLIES</label>
                    <select 
                      value={currentTrussSettings.plies}
                      onChange={(e) => setCurrentTrussSettings({...currentTrussSettings, plies: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-emerald-500 text-sm"
                    >
                      <option value={1}>1-Ply</option>
                      <option value={2}>2-Ply</option>
                      <option value={3}>3-Ply</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ORIENTATION</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCurrentTrussSettings({...currentTrussSettings, rotation: 0})}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${currentTrussSettings.rotation === 0 ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#243052]'}`}
                    >
                      Horizontal
                    </button>
                    <button
                      onClick={() => setCurrentTrussSettings({...currentTrussSettings, rotation: 90})}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${currentTrussSettings.rotation === 90 ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#243052]'}`}
                    >
                      Vertical
                    </button>
                  </div>
                </div>
                  </div>
                )}
              </div>

              {/* Solid Shells Accordion */}
              <div className="pt-6 border-t border-zinc-100 dark:border-[#1c2240]">
                <div 
                  onClick={() => setIsSolidShellOpen(!isSolidShellOpen)}
                  className="flex items-center justify-between mb-3 cursor-pointer group"
                >
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm group-hover:text-amber-500 transition-colors">Solid Shells</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                      {trussRuns.filter(r => r.type === 'Solid Shell').length} Added
                    </span>
                    {isSolidShellOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                  </div>
                </div>

                {isSolidShellOpen && (() => {
                  const activeSolidShell = selectedTrussRunId ? trussRuns.find(r => r.id === selectedTrussRunId && r.type === 'Solid Shell') : null;
                  const getSolidVal = (key: keyof Omit<TrussConfig, 'id' | 'x' | 'y'>, fallback: any = 0) => {
                    const val = activeSolidShell ? activeSolidShell[key] : currentSolidShellSettings[key];
                    return val !== undefined ? val : fallback;
                  };
                  const setSolidVal = (key: keyof Omit<TrussConfig, 'id' | 'x' | 'y'>, val: any) => {
                    setCurrentSolidShellSettings(prev => ({...prev, [key]: val}));
                    if (selectedTrussRunId && activeSolidShell) {
                      setTrussRuns(prev => prev.map(r => r.id === selectedTrussRunId ? {...r, [key]: val} : r));
                    }
                  };

                  return (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">SHELL TYPE</label>
                      <select 
                        disabled
                        value="Solid Shell (No Framing)"
                        className="w-full px-3 py-2 bg-zinc-100 dark:bg-[#151a2e] border border-zinc-200 dark:border-[#243052] rounded text-sm text-zinc-500 cursor-not-allowed"
                      >
                        <option>Solid Shell (No Framing)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ROOF STYLE</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['gable', 'hip', 'shed', 'flat'] as const).map(style => (
                          <button
                            key={style}
                            onClick={() => setSolidVal('roofStyle', style)}
                            className={`px-2 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                              getSolidVal('roofStyle', 'gable') === style
                                ? 'bg-amber-500 text-white shadow-md shadow-amber-200/50 dark:shadow-none'
                                : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#243052] border border-zinc-200 dark:border-[#243052]'
                            }`}
                          >
                            {style === 'gable' ? '⌂' : style === 'hip' ? '◇' : style === 'shed' ? '⟋' : '▬'} {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">PITCH (X/12)</label>
                        <input 
                          type="number" 
                          value={getSolidVal('pitch')}
                          onChange={(e) => setSolidVal('pitch', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-amber-500 text-sm font-mono" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">OVERHANG (IN)</label>
                        <input 
                          type="number" 
                          value={getSolidVal('overhangIn')}
                          onChange={(e) => setSolidVal('overhangIn', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-amber-500 text-sm font-mono" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">FASCIA (IN)</label>
                        <input 
                          type="number" 
                          value={getSolidVal('fasciaIn', 6)}
                          onChange={(e) => setSolidVal('fasciaIn', Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-amber-500 text-sm font-mono" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">RIDGE PLACEMENT (%)</label>
                        <span className="text-[11px] font-mono text-amber-600 dark:text-amber-500">{getSolidVal('ridgeRatio', 50)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" 
                        value={getSolidVal('ridgeRatio', 50)}
                        onChange={(e) => setSolidVal('ridgeRatio', Number(e.target.value))}
                        className="w-full accent-amber-500" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ROOF ORIENTATION</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSolidVal('rotation', 0)}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${getSolidVal('rotation', 0) === 0 ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#243052]'}`}
                        >
                          Horizontal
                        </button>
                        <button
                          onClick={() => setSolidVal('rotation', 90)}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${getSolidVal('rotation', 0) === 90 ? 'bg-amber-500 text-white' : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#243052]'}`}
                        >
                          Vertical
                        </button>
                      </div>
                    </div>
                    {/* Custom Shape Info */}
                    {trussRuns.filter(r => r.type === 'Solid Shell' && r.customCorners).length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-zinc-100 dark:border-[#1c2240]">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                          ✦ CUSTOM SHAPES
                          <span className="text-[9px] font-normal normal-case text-amber-500">(Ctrl+drag corner)</span>
                        </label>
                        {trussRuns.filter(r => r.type === 'Solid Shell' && r.customCorners).map(run => (
                          <div key={run.id} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1.5">
                            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Shell #{run.id.slice(-4)}</span>
                            <button
                              onClick={() => setTrussRuns(prev => prev.map(r => r.id === run.id ? { ...r, customCorners: undefined } : r))}
                              className="text-[10px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors px-2 py-0.5 bg-red-50 dark:bg-red-900/30 rounded"
                            >
                              Reset to Rectangle
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Modifier Key Hint */}
                    <div className="bg-zinc-50 dark:bg-[#151a2e]/50 rounded-lg p-3 mt-2">
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        <span className="font-bold text-amber-600 dark:text-amber-400">Ctrl + Drag Corner</span> — Move one handle at a time to create custom shapes (triangles, trapezoids, etc.)
                      </p>
                    </div>

                    {/* Roof Groups UI */}
                    <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-[#1c2240] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">ROOF GROUPS</label>
                        <button
                          onClick={() => {
                            const newGroup = {
                              id: `group-${Date.now()}`,
                              name: `Group ${roofGroups.length + 1}`,
                              shellIds: [],
                              autoIntersect: true
                            };
                            setRoofGroups([...roofGroups, newGroup]);
                          }}
                          className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded transition-colors"
                        >
                          + New Group
                        </button>
                      </div>

                      {roofGroups.length === 0 ? (
                        <div className="text-center p-3 border border-dashed border-zinc-200 dark:border-[#243052] rounded text-[11px] text-zinc-500">
                          Create a group to auto-intersect adjacent shells.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {roofGroups.map((group, idx) => (
                            <div key={group.id} className="bg-zinc-50 dark:bg-[#151a2e]/50 border border-zinc-200 dark:border-[#243052] p-2 rounded flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{group.name}</span>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={group.autoIntersect}
                                      onChange={(e) => {
                                        setRoofGroups(prev => prev.map(g => g.id === group.id ? {...g, autoIntersect: e.target.checked} : g));
                                      }}
                                      className="accent-amber-500"
                                    />
                                    <span className="text-[9px] text-zinc-500 font-medium">Intersect</span>
                                  </label>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete ${group.name}?`)) {
                                        setRoofGroups(prev => prev.filter(g => g.id !== group.id));
                                        setTrussRuns(prev => prev.map(r => r.groupId === group.id ? { ...r, groupId: undefined } : r));
                                      }
                                    }}
                                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                                    title="Delete Group"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {group.shellIds.length === 0 ? (
                                  <span className="text-[10px] text-zinc-400 italic">No shells</span>
                                ) : (
                                  group.shellIds.map(id => (
                                    <span key={id} className="text-[9px] bg-zinc-200 dark:bg-[#1c2240] text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                                      #{id.slice(-4)}
                                    </span>
                                  ))
                                )}
                              </div>
                              {selectedTrussRunId && trussRuns.find(r => r.id === selectedTrussRunId)?.type === 'Solid Shell' && !group.shellIds.includes(selectedTrussRunId) && (
                                <button
                                  onClick={() => {
                                    setRoofGroups(prev => prev.map(g => g.id === group.id ? {...g, shellIds: [...g.shellIds, selectedTrussRunId]} : g));
                                    setTrussRuns(prev => prev.map(r => r.id === selectedTrussRunId ? {...r, groupId: group.id} : r));
                                  }}
                                  className="text-[10px] font-medium bg-amber-500 hover:bg-amber-600 text-white rounded py-1 w-full mt-1"
                                >
                                  Add Selected Shell
                                </button>
                              )}
                              {selectedTrussRunId && group.shellIds.includes(selectedTrussRunId) && (
                                <button
                                  onClick={() => {
                                    setRoofGroups(prev => prev.map(g => g.id === group.id ? {...g, shellIds: g.shellIds.filter(id => id !== selectedTrussRunId)} : g));
                                    setTrussRuns(prev => prev.map(r => r.id === selectedTrussRunId ? {...r, groupId: undefined} : r));
                                  }}
                                  className="text-[10px] font-medium bg-zinc-200 dark:bg-[#1c2240] hover:bg-zinc-300 dark:hover:bg-[#2d3a5e] text-zinc-700 dark:text-zinc-300 rounded py-1 w-full mt-1"
                                >
                                  Remove Selected Shell
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}
              </div>

              {/* Add Canvas Accordion */}
              <div className="pt-6 border-t border-zinc-100 dark:border-[#1c2240]">
                <div 
                  onClick={() => setIsAddCanvasOpen(!isAddCanvasOpen)}
                  className="flex items-center justify-between mb-3 cursor-pointer group"
                >
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm group-hover:text-indigo-500 transition-colors">Add Canvas</h3>
                  <div className="flex items-center gap-2">
                    {isAddCanvasOpen ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                  </div>
                </div>

                {isAddCanvasOpen && (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          // Simple auto-roof algorithm: Find the bounding box of exterior walls and add a shell.
                          // For complex shapes (L, T, U), we would add multiple shells.
                          // This is a basic v1 that covers the main rectangle.
                          
                          if (exteriorWalls.length < 4) {
                            alert("Please draw exterior walls first before using Auto-Roof.");
                            return;
                          }
                          
                          // Calculate building footprint
                          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                          exteriorWalls.forEach(wall => {
                            const x = wall.xFt * 12 + wall.xInches;
                            const y = wall.yFt * 12 + wall.yInches;
                            const length = wall.lengthFt * 12 + wall.lengthInches;
                            const w = wall.orientation === 'horizontal' ? length : wall.thicknessIn;
                            const h = wall.orientation === 'vertical' ? length : wall.thicknessIn;
                            
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x + w);
                            maxY = Math.max(maxY, y + h);
                          });
                          
                          const width = maxX - minX;
                          const height = maxY - minY;
                          
                          const newTrussRun: TrussConfig = {
                            ...currentSolidShellSettings,
                            id: Date.now().toString(),
                            x: minX + (width / 2),
                            y: minY + (height / 2),
                            spanFt: height / 12,
                            lengthFt: width / 12,
                            rotation: 0,
                            roofStyle: 'hip' // Default to hip for auto-roof as it naturally fits rectangular footprints
                          };
                          
                          setTrussRuns([...trussRuns, newTrussRun]);
                          setSelectedTrussRunId(newTrussRun.id);
                        }}
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <span>✨</span> Auto-Generate Roof from Walls
                      </button>
                      <div className="h-px w-full bg-zinc-200 dark:bg-[#1c2240] my-1"></div>
                      <button 
                        onClick={() => {
                          const newTrussRun: TrussConfig = {
                            ...currentSolidShellSettings,
                            id: Date.now().toString(),
                            x: 0,
                            y: 0
                          };
                          setTrussRuns([...trussRuns, newTrussRun]);
                          setSelectedTrussRunId(newTrussRun.id);
                        }}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded transition-colors text-sm"
                      >
                        + Add Solid Shell to Canvas
                      </button>
                      <button 
                        onClick={() => {
                          const newTrussRun: TrussConfig = {
                            ...currentTrussSettings,
                            id: Date.now().toString(),
                            x: 0,
                            y: 0,
                            type: customTrussScript && customTrussScript !== "None (Use Default)" ? "custom" : currentTrussSettings.type,
                            customScript: customTrussScript && customTrussScript !== "None (Use Default)" ? customTrussScript : undefined,
                            hasPlywood: currentTrussSettings.hasPlywood || false
                          };
                          setTrussRuns([...trussRuns, newTrussRun]);
                          setSelectedTrussRunId(newTrussRun.id);
                        }}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded transition-colors text-sm"
                      >
                        + Add Truss Run to Canvas
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete all truss/shell runs from the canvas?")) {
                            setTrussRuns([]);
                            setSelectedTrussRunId(null);
                          }
                        }}
                        disabled={trussRuns.length === 0}
                        className="w-full py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-bold rounded transition-colors text-sm"
                      >
                        Clear Canvas Roof Elements
                      </button>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-[#1c2240]">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">DORMER BUILDER</label>
                        <span className="text-[10px] font-bold px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                          {dormers.length} Added
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">WIDTH (FT/IN)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              value={currentDormerWidthFt}
                              onChange={(e) => setCurrentDormerWidthFt(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                              placeholder="Ft"
                            />
                            <input 
                              type="number" 
                              value={currentDormerWidthIn}
                              onChange={(e) => setCurrentDormerWidthIn(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                              placeholder="In"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">DEPTH (FT/IN)</label>
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              value={currentDormerDepthFt}
                              onChange={(e) => setCurrentDormerDepthFt(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                              placeholder="Ft"
                            />
                            <input 
                              type="number" 
                              value={currentDormerDepthIn}
                              onChange={(e) => setCurrentDormerDepthIn(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                              placeholder="In"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">PITCH (X/12)</label>
                          <input 
                            type="number" 
                            step="any"
                            value={currentDormerPitch}
                            onChange={(e) => setCurrentDormerPitch(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">OVERHANG (IN)</label>
                          <input 
                            type="number" 
                            step="any"
                            value={currentDormerOverhangIn}
                            onChange={(e) => setCurrentDormerOverhangIn(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">FASCIA (IN)</label>
                          <input 
                            type="number" 
                            step="any"
                            value={currentDormerFasciaIn}
                            onChange={(e) => setCurrentDormerFasciaIn(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">WALL HEIGHT (IN)</label>
                          <input 
                            type="number" 
                            step="any"
                            value={currentDormerWallHeightIn}
                            onChange={(e) => setCurrentDormerWallHeightIn(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded focus:outline-none focus:border-indigo-500 text-sm font-mono" 
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          const newDormer: DormerConfig = {
                            id: `dormer-${Date.now()}`,
                            x: 0,
                            y: 0,
                            widthIn: currentDormerWidthFt * 12 + currentDormerWidthIn,
                            depthIn: currentDormerDepthFt * 12 + currentDormerDepthIn,
                            rotation: 0,
                            pitch: currentDormerPitch,
                            overhangIn: currentDormerOverhangIn,
                            fasciaIn: currentDormerFasciaIn,
                            wallHeightIn: currentDormerWallHeightIn
                          };
                          setDormers([...dormers, newDormer]);
                          setSelectedDormerId(newDormer.id);
                        }}
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded transition-colors text-sm"
                      >
                        + Add Dormer to Canvas
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete all dormers from the canvas?")) {
                            setDormers([]);
                            setSelectedDormerId(null);
                            // Also remove windows assigned to dormers
                            setWindows(prev => prev.filter(w => w.wall < 9000));
                          }
                        }}
                        disabled={dormers.length === 0}
                        className="w-full py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-bold rounded transition-colors text-sm"
                      >
                        Clear Dormers
                      </button>
                    </div>

                    {/* Dormer Windows */}
                    {dormers.length > 0 && (
                      <div className="pt-4 border-t border-zinc-100 dark:border-[#1c2240] space-y-3">
                        <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">DORMER WINDOWS</label>
                        {dormers.map((dormer, dormerIndex) => {
                          const dormerWindows = windows.filter(w => w.wall === 9000 + dormerIndex);
                          return (
                            <div key={dormer.id} className="border border-zinc-200 dark:border-[#243052] rounded-lg p-3 bg-zinc-50/50 dark:bg-[#151a2e]/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                  Dormer {dormerIndex + 1} — {dormerWindows.length} window{dormerWindows.length !== 1 ? 's' : ''}
                                </span>
                                <button
                                  onClick={() => {
                                    const depthIn = dormer.depthIn;
                                    const winWidth = Math.min(24, depthIn - 4);
                                    const winHeight = Math.min(30, (dormer.wallHeightIn || 48) - 12);
                                    const sillHeight = 6;
                                    const newWin: WindowConfig = {
                                      id: `win-dormer-${Date.now()}`,
                                      wall: 9000 + dormerIndex,
                                      xFt: 0,
                                      xInches: 0,
                                      yFt: 0,
                                      yInches: 0,
                                      widthIn: winWidth,
                                      heightIn: winHeight,
                                      sillHeightIn: sillHeight,
                                      floorIndex: currentFloorIndex
                                    };
                                    setWindows(prev => [...prev, newWin]);
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2 py-1 rounded transition-colors"
                                >
                                  <Plus size={12} /> Add Window
                                </button>
                              </div>
                              {dormerWindows.map((win, winIdx) => (
                                <div key={win.id} className="flex flex-col gap-2 bg-white dark:bg-[#0f1424] rounded p-2 border border-zinc-100 dark:border-[#1c2240]">
                                  <div className="grid grid-cols-4 gap-2 items-end">
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] font-semibold text-zinc-400 uppercase" title="0 means perfectly centered on the dormer face.">Center Offset</label>
                                      <div className="flex gap-1">
                                        <input
                                          type="number"
                                          step="any"
                                          value={win.xFt}
                                          onChange={(e) => updateWindow(win.id, 'xFt', Number(e.target.value))}
                                          className="w-full px-1.5 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-mono"
                                          placeholder="ft"
                                        />
                                        <input
                                          type="number"
                                          step="any"
                                          value={win.xInches}
                                          onChange={(e) => updateWindow(win.id, 'xInches', Number(e.target.value))}
                                          className="w-full px-1.5 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-mono"
                                          placeholder="in"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] font-semibold text-zinc-400 uppercase">W (in)</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={win.widthIn}
                                        onChange={(e) => updateWindow(win.id, 'widthIn', Number(e.target.value))}
                                        className="w-full px-1.5 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-mono"
                                      />
                                    </div>
                                    <div className="space-y-0.5">
                                      <label className="text-[9px] font-semibold text-zinc-400 uppercase">H (in)</label>
                                      <input
                                        type="number"
                                        step="any"
                                        value={win.heightIn}
                                        onChange={(e) => updateWindow(win.id, 'heightIn', Number(e.target.value))}
                                        className="w-full px-1.5 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-mono"
                                      />
                                    </div>
                                    <div className="flex items-end gap-1">
                                      <div className="flex-1 space-y-0.5">
                                        <label className="text-[9px] font-semibold text-zinc-400 uppercase">Sill</label>
                                        <input
                                          type="number"
                                          step="any"
                                          value={win.sillHeightIn}
                                          onChange={(e) => updateWindow(win.id, 'sillHeightIn', Number(e.target.value))}
                                          className="w-full px-1.5 py-1 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-mono"
                                        />
                                      </div>
                                      <button
                                        onClick={() => removeWindow(win.id)}
                                        className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-colors mb-0.5"
                                        title="Remove window"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Link 3D Model (.glb) */}
                                  <div className="pt-2 border-t border-zinc-100 dark:border-[#1c2240]">
                                    <div className="flex items-center gap-2">
                                      <label className="flex-1">
                                        <input
                                          type="file"
                                          accept=".glb,.gltf"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const url = URL.createObjectURL(file);
                                              setWindows(prev => prev.map(w => w.id === win.id ? { ...w, modelUrl: url, modelFileName: file.name } : w));
                                            }
                                          }}
                                        />
                                        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md border border-dashed border-zinc-300 dark:border-[#2d3a5e] bg-zinc-50 dark:bg-[#151a2e]/50 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-all">
                                          <Link2 size={12} />
                                          {win.modelUrl ? `Change: ${win.modelFileName || '3D Model'}` : 'Link .glb Model'}
                                        </div>
                                      </label>
                                      {win.modelUrl && (
                                        <button
                                          onClick={() => {
                                            if (win.modelUrl && win.modelUrl.startsWith('blob:')) URL.revokeObjectURL(win.modelUrl);
                                            setWindows(prev => prev.map(w => w.id === win.id ? { ...w, modelUrl: undefined, modelFileName: undefined } : w));
                                          }}
                                          className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 rounded transition-colors"
                                          title="Remove linked model"
                                        >
                                          <Unlink size={13} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>

            </div>


          )}
        </div>

        {/* Blueprint Reference Section */}
        <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
          <div 
            onClick={() => toggleSection('pdf')}
            className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('pdf'); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg">
                <FileText size={18} />
              </div>
              <div className="text-left">
                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">4. Blueprint Reference</h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Upload PDF, PNG, or JPG</p>
              </div>
            </div>
            {openSections.pdf ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
          </div>
          {openSections.pdf && (
            <div className="p-4 border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-200 dark:border-[#243052] rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-[#1c2240]/50 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {isUploading ? (
                        <>
                          <Loader2 className="w-8 h-8 mb-3 text-indigo-500 dark:text-indigo-400 animate-spin" />
                          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">Processing PDF...</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">Extracting pages...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mb-3 text-zinc-400 dark:text-zinc-500" />
                          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium">Click to upload blueprint</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">PDF, PNG, or JPG</p>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="application/pdf,image/png,image/jpeg" onChange={handleBlueprintUpload} disabled={isUploading} />
                  </label>
                  <button 
                    onClick={clearAllWalls}
                    disabled={isUploading}
                    className="h-32 px-4 flex flex-col items-center justify-center border-2 border-zinc-200 dark:border-[#243052] rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 dark:hover:border-rose-800/50 transition-colors group disabled:opacity-50"
                    title="Clear All Walls"
                  >
                    <Trash2 className="w-6 h-6 mb-2 text-zinc-400 dark:text-zinc-500 group-hover:text-rose-500 dark:group-hover:text-rose-400" />
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 uppercase text-center leading-tight">Clear<br/>Walls</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={handleSaveToDevice}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 px-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all font-bold text-[10px] uppercase tracking-wider shadow-sm"
                    title="Save Project (Ctrl+S)"
                  >
                    <div className="flex items-center gap-2">
                      <Save size={14} />
                      Save Project
                    </div>
                    <span className="text-[8px] opacity-60">Ctrl+S</span>
                  </button>
                  <button 
                    onClick={handleLoadFromDevice}
                    className="flex flex-col items-center justify-center gap-1 py-2.5 px-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all font-bold text-[10px] uppercase tracking-wider shadow-sm"
                    title="Load Project (Ctrl+O)"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen size={14} />
                      Load Project
                    </div>
                    <span className="text-[8px] opacity-60">Ctrl+O</span>
                  </button>
                </div>



                {pdfImages.length > 0 && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Blueprint Controls</span>
                      <button 
                        onClick={() => {
                          setPdfImages([]);
                          setAppliedCalibration(null);
                          setIsBlueprintLocked(false);
                        }}
                        className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase hover:underline"
                      >
                        Remove Blueprint
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-[#151a2e]/50 rounded-lg border border-zinc-100 dark:border-[#1c2240]">
                      <div className="flex items-center gap-2">
                        {isBlueprintLocked ? <Lock size={14} className="text-indigo-600 dark:text-indigo-400" /> : <Unlock size={14} className="text-zinc-400 dark:text-zinc-500" />}
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">Lock Blueprint</span>
                      </div>
                      <button 
                        onClick={() => setIsBlueprintLocked(!isBlueprintLocked)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isBlueprintLocked ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isBlueprintLocked ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {pdfImages.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-zinc-50 dark:bg-[#151a2e]/50 p-2 rounded-lg border border-zinc-200 dark:border-[#1c2240]">
                          <button
                            onClick={() => setSelectedPdfIndex(Math.max(0, selectedPdfIndex - 1))}
                            disabled={selectedPdfIndex === 0}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#243052] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            Page {selectedPdfIndex + 1} of {pdfImages.length}
                          </span>
                          <button
                            onClick={() => setSelectedPdfIndex(Math.min(pdfImages.length - 1, selectedPdfIndex + 1))}
                            disabled={selectedPdfIndex === pdfImages.length - 1}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-[#243052] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-zinc-600 dark:text-zinc-400"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        <select 
                          value={selectedPdfIndex}
                          onChange={(e) => setSelectedPdfIndex(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-zinc-200"
                        >
                          {pdfImages.map((_, idx) => (
                            <option key={idx} value={idx}>Page {idx + 1}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={handleAutoGenerateWalls}
                      disabled={isAnalyzing}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg font-bold text-sm shadow-md shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Analyzing Blueprint...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Auto-Generate Walls
                        </>
                      )}
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Scale</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" step="0.01" value={pdfScale} 
                            onChange={(e) => setPdfScale(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            disabled={isBlueprintLocked}
                            className="w-full px-2 py-1.5 bg-zinc-50 dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Rotation</label>
                        <div className="flex items-center gap-2">
                          <RotateCw size={14} className="text-zinc-400 dark:text-zinc-500" />
                          <input 
                            type="number" step="90" value={pdfRotation} 
                            onChange={(e) => setPdfRotation(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            disabled={isBlueprintLocked}
                            className="w-full px-2 py-1.5 bg-zinc-50 dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Guides ({guides.length})</label>
                      <button 
                        onClick={() => setGuides([])}
                        disabled={guides.length === 0}
                        className="text-[10px] text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-bold uppercase disabled:opacity-30"
                      >
                        Clear All
                      </button>
                    </div>

                    {appliedCalibration && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Calculated Scale</span>
                          <Ruler size={12} className="text-emerald-500 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                          1px = {(1/pdfScale).toFixed(3)}"
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-500">
                          Based on {appliedCalibration.realLengthIn}" measurement
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Opacity ({Math.round(pdfOpacity * 100)}%)</label>
                      <input 
                        type="range" min="0" max="1" step="0.1" value={pdfOpacity} 
                        onChange={(e) => setPdfOpacity(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-100 dark:bg-[#151a2e] rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                        <Move size={10} /> Position Offset
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input 
                            type="number" value={pdfOffset.x} 
                            onChange={(e) => setPdfOffset(prev => ({ ...prev, x: Number(e.target.value) }))}
                            onFocus={(e) => e.target.select()}
                            disabled={isBlueprintLocked}
                            className="w-full pl-6 pr-2 py-1.5 bg-zinc-50 dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-200"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 dark:text-zinc-500">X</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" value={pdfOffset.y} 
                            onChange={(e) => setPdfOffset(prev => ({ ...prev, y: Number(e.target.value) }))}
                            onFocus={(e) => e.target.select()}
                            disabled={isBlueprintLocked}
                            className="w-full pl-6 pr-2 py-1.5 bg-zinc-50 dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-200"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 dark:text-zinc-500">Y</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-100 dark:border-[#1c2240]">
                        <button 
                          onClick={() => {
                            setIsCalibrating(!isCalibrating);
                            if (!isCalibrating) setActiveTab('preview');
                          }}
                          disabled={isBlueprintLocked}
                          className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isCalibrating 
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60' 
                              : 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-[#243052]'
                          }`}
                        >
                          {isCalibrating ? 'Cancel Calibration' : 'Calibrate Scale'}
                        </button>
                        
                        {(guides.length > 0 || isCalibrating) && (
                          <div className="mt-2 flex gap-2">
                            <button 
                              onClick={() => {
                                if (isCalibrating && pdfCalibration.p1 && !pdfCalibration.p2) {
                                  setPdfCalibration({ ...pdfCalibration, p1: null });
                                } else {
                                  setGuides(prev => prev.slice(0, -1));
                                }
                              }}
                              disabled={!guides.length && !(isCalibrating && pdfCalibration.p1)}
                              className="flex-1 py-1.5 bg-zinc-100 dark:bg-[#151a2e] hover:bg-zinc-200 dark:hover:bg-[#243052] text-zinc-600 dark:text-zinc-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 disabled:opacity-30"
                            >
                              <Undo2 size={12} /> Undo
                            </button>
                            <button 
                              onClick={() => setGuides([])}
                              disabled={!guides.length}
                              className="flex-1 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 disabled:opacity-30"
                            >
                              <Trash2 size={12} /> Clear
                            </button>
                          </div>
                        )}
                        {isCalibrating && (
                          <div className="mt-3 space-y-2">
                            {!pdfCalibration.p1 ? (
                               <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">Click start point on blueprint</p>
                            ) : !pdfCalibration.p2 ? (
                               <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">Click end point on blueprint</p>
                            ) : (
                               <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold text-center">Points selected! Enter distance in popup.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </div>
          )}
        </div>
        {/* Materials List & Cost Estimating Section */}
        <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
          <div 
            onClick={() => toggleSection('materials')}
            className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('materials'); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-lg">
                <Calculator size={18} />
              </div>
              <div className="text-left">
                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">5. Materials & Cost</h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Estimate & Quantities</p>
              </div>
            </div>
            {openSections.materials ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
          </div>
          {openSections.materials && (
            <MaterialsEstimate 
              state={currentState} 
              getWallLength={getWallLength}
              getAvailableWallOptions={getAvailableWallOptions}
              onUpdateCosts={(costs) => setMaterialCosts(costs)}
              customCostItems={customCostItems}
              onUpdateCustomItems={setCustomCostItems}
            />
          )}
        </div>

        {/* 3D Options Section */}
        <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
          <div 
            onClick={() => toggleSection('threeD')}
            className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('threeD'); }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg">
                <Box size={18} />
              </div>
              <div className="text-left">
                <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">6. 3D</h2>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Realistic Rendering & Options</p>
              </div>
            </div>
            {openSections.threeD ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
          </div>
          {openSections.threeD && (
            <div className="p-5 border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-50 dark:bg-[#0f1424]/20 text-zinc-600 dark:text-zinc-400 rounded-md">
                      <Home size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show Roof</span>
                  </div>
                  <button
                    onClick={() => setShowRoof(!showRoof)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showRoof ? 'bg-amber-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showRoof ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md">
                      <Globe size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show Ground</span>
                  </div>
                  <button
                    onClick={() => setShowGround(!showGround)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showGround ? 'bg-amber-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showGround ? 'translate-x-5.5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md">
                      <Cloud size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show Sky</span>
                  </div>
                  <button
                    onClick={() => setShowSky(!showSky)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showSky ? 'bg-amber-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showSky ? 'translate-x-5.5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-md">
                      <Sun size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show Sun & Shadows</span>
                  </div>
                  <button
                    onClick={() => setShowSun(!showSun)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showSun ? 'bg-amber-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showSun ? 'translate-x-5.5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md">
                      <Ruler size={14} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Show Axes</span>
                  </div>
                  <button
                    onClick={() => setShowAxes(!showAxes)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${showAxes ? 'bg-amber-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showAxes ? 'translate-x-5.5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-[#1c2240]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-md">
                      <Sun size={14} />
                    </div>
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider">Sun Position &amp; Shadows</h3>
                  </div>

                  {/* Time of Day */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Time of Day</label>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {(() => {
                          const h = Math.floor(sunHour);
                          const m = Math.round((sunHour - h) * 60);
                          const period = h >= 12 ? 'PM' : 'AM';
                          const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                          return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
                        })()}
                      </span>
                    </div>
                    <input
                      type="range" min={5} max={21} step={0.25} value={sunHour}
                      onChange={(e) => setSunHour(Number(e.target.value))}
                      disabled={!showSun}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: showSun
                          ? `linear-gradient(to right, #1e1b4b 0%, #f59e0b 20%, #f59e0b 60%, #f97316 80%, #1e1b4b 100%)`
                          : undefined
                      }}
                    />
                    <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500 px-0.5">
                      <span>5 AM</span>
                      <span>Noon</span>
                      <span>9 PM</span>
                    </div>
                  </div>

                  {/* Month */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Month</label>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {['January','February','March','April','May','June','July','August','September','October','November','December'][sunMonth - 1]}
                      </span>
                    </div>
                    <input
                      type="range" min={1} max={12} step={1} value={sunMonth}
                      onChange={(e) => setSunMonth(Number(e.target.value))}
                      disabled={!showSun}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: showSun
                          ? `linear-gradient(to right, #60a5fa 0%, #4ade80 25%, #facc15 50%, #f97316 75%, #60a5fa 100%)`
                          : undefined
                      }}
                    />
                    <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500 px-0.5">
                      <span>Jan</span>
                      <span>Apr</span>
                      <span>Jul</span>
                      <span>Oct</span>
                      <span>Dec</span>
                    </div>
                  </div>

                  {/* Site Latitude */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Site Latitude</label>
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                        {siteLatitude.toFixed(1)}°{siteLatitude >= 0 ? 'N' : 'S'}
                      </span>
                    </div>
                    <input
                      type="range" min={-60} max={70} step={0.5} value={siteLatitude}
                      onChange={(e) => setSiteLatitude(Number(e.target.value))}
                      disabled={!showSun}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[9px] text-zinc-400 dark:text-zinc-500 px-0.5">
                      <span>60°S</span>
                      <span>Equator</span>
                      <span>70°N</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        { label: 'Miami', lat: 25.8 },
                        { label: 'LA', lat: 34.1 },
                        { label: 'Reno', lat: 39.5 },
                        { label: 'NYC', lat: 40.7 },
                        { label: 'Chicago', lat: 41.9 },
                        { label: 'Seattle', lat: 47.6 },
                        { label: 'London', lat: 51.5 },
                        { label: 'Anchorage', lat: 61.2 },
                      ].map(p => (
                        <button
                          key={p.label}
                          onClick={() => setSiteLatitude(p.lat)}
                          disabled={!showSun}
                          className={`px-2 py-0.5 text-[9px] font-bold rounded-full border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            Math.abs(siteLatitude - p.lat) < 0.5
                              ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                              : 'border-zinc-200 dark:border-[#243052] text-zinc-500 dark:text-zinc-400 hover:border-sky-400 hover:text-sky-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!showSun && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center italic mt-1">
                      Enable "Show Sun &amp; Shadows" above to adjust sun position.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-[#1c2240]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-500 dark:text-violet-400 rounded-md">
                      <Sparkles size={14} />
                    </div>
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-[11px] uppercase tracking-wider">HDRI Environment</h3>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Controls ambient lighting and reflections. Different environments create different moods.
                  </p>

                  {/* Built-in presets */}
                  <div>
                    <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Built-in Presets</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'city', label: 'City', emoji: '🏙️', desc: 'Urban skyline' },
                        { id: 'sunset', label: 'Sunset', emoji: '🌅', desc: 'Golden hour' },
                        { id: 'dawn', label: 'Dawn', emoji: '🌄', desc: 'Early morning' },
                        { id: 'night', label: 'Night', emoji: '🌙', desc: 'Moonlit' },
                        { id: 'warehouse', label: 'Warehouse', emoji: '🏭', desc: 'Industrial' },
                        { id: 'forest', label: 'Forest', emoji: '🌲', desc: 'Natural green' },
                        { id: 'apartment', label: 'Interior', emoji: '🏠', desc: 'Indoor light' },
                        { id: 'studio', label: 'Studio', emoji: '📸', desc: 'Clean white' },
                        { id: 'park', label: 'Park', emoji: '🌳', desc: 'Open sky' },
                        { id: 'lobby', label: 'Lobby', emoji: '🏛️', desc: 'Soft ambient' },
                      ].map(env => (
                        <button
                          key={env.id}
                          onClick={() => { setHdriPreset(env.id); setCustomHdriUrl(''); }}
                          className={`flex flex-col items-center p-2 rounded-lg border transition-all text-center ${
                            hdriPreset === env.id && !customHdriUrl
                              ? 'bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500/30 shadow-sm'
                              : 'border-zinc-200 dark:border-[#243052] hover:border-violet-400/50 hover:bg-violet-50/30 dark:hover:bg-violet-900/10'
                          }`}
                        >
                          <span className="text-lg leading-none">{env.emoji}</span>
                          <span className={`text-[9px] font-bold mt-1 uppercase tracking-wider ${
                            hdriPreset === env.id && !customHdriUrl ? 'text-violet-400' : 'text-zinc-600 dark:text-zinc-400'
                          }`}>{env.label}</span>
                          <span className="text-[8px] text-zinc-400 dark:text-zinc-500 mt-0.5">{env.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom HDRI section */}
                  <div className="border-t border-zinc-100 dark:border-[#1c2240] pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Custom HDR Skydomes</p>
                      <button
                        onClick={() => {
                          fetch('/api/hdri')
                            .then(r => r.json())
                            .then(d => setHdriFiles(d.hdriFiles || []))
                            .catch(() => {});
                        }}
                        className="text-[9px] text-zinc-400 hover:text-violet-400 transition-colors"
                        title="Refresh HDRI list"
                      >
                        ↻ Refresh
                      </button>
                    </div>

                    {/* Upload button */}
                    <label className="block mb-2">
                      <input
                        type="file"
                        accept=".hdr,.exr,.hdri"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setHdriUploading(true);
                          try {
                            const formData = new FormData();
                            formData.append('hdriFile', file);
                            const res = await fetch('/api/hdri/upload', { method: 'POST', body: formData });
                            const data = await res.json();
                            if (data.success) {
                              // Refresh the list
                              const listRes = await fetch('/api/hdri');
                              const listData = await listRes.json();
                              setHdriFiles(listData.hdriFiles || []);
                              // Auto-select the newly uploaded file
                              setCustomHdriUrl(data.url);
                            }
                          } catch (err) {
                            console.error('HDRI upload failed:', err);
                          } finally {
                            setHdriUploading(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <div className={`flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border-2 border-dashed transition-all cursor-pointer ${
                        hdriUploading
                          ? 'border-violet-400 bg-violet-500/10 text-violet-400 cursor-wait'
                          : 'border-zinc-300 dark:border-[#2d3a5e] text-zinc-500 dark:text-zinc-400 hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-900/10 hover:text-violet-500'
                      }`}>
                        {hdriUploading ? (
                          <>⏳ Uploading...</>
                        ) : (
                          <>
                            <Upload size={14} />
                            Upload .HDR / .EXR File
                          </>
                        )}
                      </div>
                    </label>

                    {/* List of uploaded HDRI files */}
                    {hdriFiles.length > 0 ? (
                      <div className="space-y-1">
                        {hdriFiles.map(f => {
                          const isActive = customHdriUrl === f.url;
                          const sizeMB = (f.size / (1024 * 1024)).toFixed(1);
                          return (
                            <button
                              key={f.name}
                              onClick={() => setCustomHdriUrl(f.url)}
                              className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                                isActive
                                  ? 'bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500/30'
                                  : 'border-zinc-200 dark:border-[#243052] hover:border-violet-400/50 hover:bg-violet-50/20 dark:hover:bg-violet-900/10'
                              }`}
                            >
                              <span className="text-lg">🌐</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-bold truncate ${isActive ? 'text-violet-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                  {f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ')}
                                </p>
                                <p className="text-[8px] text-zinc-400 dark:text-zinc-500">{sizeMB} MB • {f.name.split('.').pop()?.toUpperCase()}</p>
                              </div>
                              {isActive && <span className="text-[9px] text-violet-400 font-bold flex-shrink-0">✓ Active</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                          No custom HDRIs uploaded yet.
                        </p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">
                          Download .hdr files from{' '}
                          <a href="https://polyhaven.com/hdris" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline">
                            Poly Haven
                          </a>
                          {' '}and upload them here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

          {/* 2D 3D Assets Section */}
          <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
            <div 
              onClick={() => toggleSection('assets')}
              className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('assets'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 rounded-lg">
                  <LayoutGrid size={18} />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">7. 2D 3D Assets</h2>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Manage Project Assets</p>
                </div>
              </div>
              {openSections.assets ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
            </div>
            {openSections.assets && (
              <div className="p-5 border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] space-y-4">
                <div className="border border-zinc-200 dark:border-[#1c2240] rounded-lg overflow-hidden">
                  <AssetManager />
                </div>
                <div className="h-px w-full bg-zinc-200 dark:bg-[#151a2e] my-4" />
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase tracking-wider mb-2">Local Project Environment Props</h3>
                <AssetLibrary onAddAsset={(asset) => {
                  setAssets(prev => [...prev, {
                    ...asset,
                    id: Date.now().toString(),
                    x: 120,
                    y: 120,
                    rotation: 0,
                    scale: 1,
                    floorIndex: currentFloorIndex
                  }]);
                }} />

                {/* Floor Plan Symbols */}
                <div className="h-px w-full bg-zinc-200 dark:bg-[#151a2e] my-4" />
                <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase tracking-wider mb-3">Floor Plan Symbols</h3>
                <div className="space-y-3">
                  {SYMBOL_CATEGORIES.map(cat => {
                    const catSymbols = SYMBOL_CATALOG.filter(s => s.category === cat);
                    const catColor = CATEGORY_COLORS[cat] || '#6366f1';
                    return (
                      <div key={cat}>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: catColor }}>
                          {CATEGORY_LABELS[cat] || cat}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {catSymbols.map(sym => (
                            <button
                              key={sym.id}
                              onClick={() => {
                                setAssets(prev => [...prev, {
                                  id: `sym-${Date.now()}`,
                                  type: sym.id,
                                  category: sym.category as InteriorAsset['category'],
                                  name: sym.name,
                                  widthIn: sym.widthIn,
                                  depthIn: sym.depthIn,
                                  heightIn: sym.heightIn,
                                  modelUrl: sym.glbPath,
                                  modelFileName: sym.glbPath ? sym.id + '.glb' : undefined,
                                  x: 120,
                                  y: 120,
                                  rotation: 0,
                                  scale: 1,
                                  floorIndex: currentFloorIndex
                                }]);
                              }}
                              className="flex items-center gap-2 px-2.5 py-2 text-left text-[11px] font-semibold rounded-lg border transition-all hover:shadow-sm"
                              style={{
                                borderColor: `${catColor}33`,
                                color: catColor,
                                backgroundColor: `${catColor}08`
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.backgroundColor = `${catColor}18`;
                                (e.currentTarget as HTMLElement).style.borderColor = `${catColor}66`;
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.backgroundColor = `${catColor}08`;
                                (e.currentTarget as HTMLElement).style.borderColor = `${catColor}33`;
                              }}
                            >
                              <svg width="24" height="24" viewBox={`0 0 ${sym.widthIn} ${sym.depthIn}`} className="flex-shrink-0">
                                {sym.svgPaths.map((p, i) => (
                                  <path key={i} d={p.d} fill={p.fill || 'none'} stroke={p.stroke || sym.color} strokeWidth={p.strokeWidth || 0.5} />
                                ))}
                              </svg>
                              {sym.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Placed Assets Management ── */}
                {assets.filter(a => a.floorIndex === currentFloorIndex).length > 0 && (
                  <>
                    <div className="h-px w-full bg-zinc-200 dark:bg-[#151a2e] my-4" />
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Link2 size={14} className="text-indigo-500" />
                      Placed Assets — 3D Model Links
                    </h3>
                    <div className="space-y-2">
                      {assets.filter(a => a.floorIndex === currentFloorIndex).map(asset => {
                        const sym = getSymbolById(asset.type);
                        const catColor = CATEGORY_COLORS[asset.category] || CATEGORY_COLORS['custom'] || '#6366f1';
                        const isExpanded = expandedAssetId === asset.id;
                        return (
                          <div key={asset.id} className="rounded-lg border transition-all overflow-hidden"
                            style={{ borderColor: isExpanded ? `${catColor}66` : `${catColor}33`, backgroundColor: `${catColor}06` }}
                          >
                            {/* Header row — click to expand */}
                            <div
                              className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-white/5 transition-colors"
                              onClick={() => setExpandedAssetId(isExpanded ? null : asset.id)}
                            >
                              {/* Symbol icon */}
                              {sym && (
                                <svg width="20" height="20" viewBox={`0 0 ${sym.widthIn} ${sym.depthIn}`} className="flex-shrink-0">
                                  {sym.svgPaths.map((p, i) => (
                                    <path key={i} d={p.d} fill={p.fill || 'none'} stroke={p.stroke || sym.color} strokeWidth={p.strokeWidth || 0.5} />
                                  ))}
                                </svg>
                              )}
                              {/* Name + model status */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold truncate" style={{ color: catColor }}>{asset.name}</div>
                                <div className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">
                                  {asset.modelUrl
                                    ? <span className="text-emerald-500">🧊 {asset.modelFileName || '3D Linked'}</span>
                                    : <span className="text-zinc-400">No 3D model</span>
                                  }
                                </div>
                              </div>
                              {/* Expand chevron */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
                                  {Math.round(asset.widthIn || 0)}×{Math.round(asset.depthIn || 0)}×{Math.round(asset.heightIn || 0)}"
                                </span>
                                {isExpanded
                                  ? <ChevronDown size={14} className="text-zinc-400" />
                                  : <ChevronRight size={14} className="text-zinc-400" />
                                }
                              </div>
                            </div>

                            {/* Expanded detail panel */}
                            {isExpanded && (
                              <div className="px-2.5 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: `${catColor}22` }}>

                                {/* Dimensions: W × D × H */}
                                <div>
                                  <label className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">
                                    Dimensions (inches)
                                  </label>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div className="relative">
                                      <input
                                        type="number" min={1} step={1}
                                        value={Math.round(asset.widthIn || 24)}
                                        onChange={(e) => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, widthIn: Math.max(1, Number(e.target.value)) } : a))}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full pl-5 pr-1 py-1.5 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-[11px] font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                                      />
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">W</span>
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="number" min={1} step={1}
                                        value={Math.round(asset.depthIn || 24)}
                                        onChange={(e) => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, depthIn: Math.max(1, Number(e.target.value)) } : a))}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full pl-5 pr-1 py-1.5 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-[11px] font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                                      />
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">D</span>
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="number" min={1} step={1}
                                        value={Math.round(asset.heightIn || 36)}
                                        onChange={(e) => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, heightIn: Math.max(1, Number(e.target.value)) } : a))}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full pl-5 pr-1 py-1.5 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded text-[11px] font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                                      />
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400">H</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Scale slider */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Scale</label>
                                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{(asset.scale || 1).toFixed(2)}×</span>
                                  </div>
                                  <input
                                    type="range" min={0.1} max={3} step={0.05}
                                    value={asset.scale || 1}
                                    onChange={(e) => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, scale: Number(e.target.value) } : a))}
                                    className="w-full h-1.5 bg-zinc-200 dark:bg-[#1c2240] rounded-full appearance-none cursor-pointer accent-indigo-500"
                                  />
                                  <div className="flex justify-between text-[8px] text-zinc-400 mt-0.5">
                                    <span>0.1×</span>
                                    <span>1×</span>
                                    <span>3×</span>
                                  </div>
                                </div>

                                {/* Rotation */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Rotation</label>
                                    <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{Math.round(asset.rotation || 0)}°</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="range" min={0} max={360} step={15}
                                      value={asset.rotation || 0}
                                      onChange={(e) => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, rotation: Number(e.target.value) } : a))}
                                      className="flex-1 h-1.5 bg-zinc-200 dark:bg-[#1c2240] rounded-full appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <button
                                      onClick={() => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, rotation: (a.rotation + 90) % 360 } : a))}
                                      className="p-1 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                                      title="Rotate 90°"
                                    >
                                      <RotateCw size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* 3D Model Link */}
                                <div className="flex items-center gap-1.5 pt-1 border-t" style={{ borderColor: `${catColor}15` }}>
                                  <label className="cursor-pointer flex-1">
                                    <input
                                      type="file"
                                      accept=".glb,.gltf"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const url = URL.createObjectURL(file);
                                        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, modelUrl: url, modelFileName: file.name } : a));
                                        e.target.value = '';
                                      }}
                                    />
                                    <span
                                      className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-md border transition-colors cursor-pointer"
                                      style={{
                                        borderColor: asset.modelUrl ? `${catColor}44` : `${catColor}33`,
                                        color: catColor,
                                        backgroundColor: asset.modelUrl ? `${catColor}10` : `${catColor}08`,
                                      }}
                                      title={asset.modelUrl ? 'Change linked .glb model' : 'Link a .glb 3D model'}
                                    >
                                      <Link2 size={11} />
                                      {asset.modelUrl ? `Change Model (${asset.modelFileName || '.glb'})` : 'Link .glb 3D Model'}
                                    </span>
                                  </label>
                                  {asset.modelUrl && (
                                    <button
                                      onClick={() => {
                                        if (asset.modelUrl && asset.modelUrl.startsWith('blob:')) URL.revokeObjectURL(asset.modelUrl);
                                        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, modelUrl: undefined, modelFileName: undefined } : a));
                                      }}
                                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                      title="Remove linked 3D model"
                                    >
                                      <Unlink size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remove "${asset.name}" from floor plan?`)) {
                                        if (asset.modelUrl && asset.modelUrl.startsWith('blob:')) URL.revokeObjectURL(asset.modelUrl);
                                        setAssets(prev => prev.filter(a => a.id !== asset.id));
                                        setExpandedAssetId(null);
                                      }
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    title="Delete this asset"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {/* 3D Cameras Section */}
          <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-sm border border-zinc-200 dark:border-[#1c2240] overflow-hidden shrink-0">
            <div 
              onClick={() => toggleSection('cameras')}
              className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50/50 dark:bg-[#252526] hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors cursor-pointer"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection('cameras'); }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-lg">
                  <Camera size={18} />
                </div>
                <div className="text-left">
                  <h2 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">8. Custom 3D Cameras</h2>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Save Room Viewpoints</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                  {customCameras.length} Added
                </span>
                {openSections.cameras ? <ChevronDown size={18} className="text-zinc-400 dark:text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500" />}
              </div>
            </div>
            {openSections.cameras && (
              <div className="p-5 border-t border-zinc-100 dark:border-[#1c2240] bg-white dark:bg-[#0f1424] space-y-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); addCustomCamera(); }}
                  className="w-full py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-bold rounded transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add New Camera
                </button>
                
                <div className="space-y-3 mt-4">
                  {customCameras.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-2">No cameras added.</p>
                  )}
                  
                  {customCameras.map((cam, index) => (
                    <div key={cam.id} className="relative border border-zinc-100 dark:border-[#1c2240] rounded-lg p-3 bg-zinc-50/50 dark:bg-[#151a2e]/30">
                      <div className="absolute -top-2.5 left-3 bg-white dark:bg-[#0f1424] px-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        Camera {index + 1}
                      </div>
                      <div className="absolute -top-2.5 right-2 flex items-center gap-1 bg-white dark:bg-[#0f1424] px-1">
                        <button 
                          onClick={() => removeCustomCamera(cam.id)}
                          className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full transition-colors"
                          title="Remove camera"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="space-y-4 mt-1">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Name</label>
                          <input 
                            type="text" 
                            value={cam.name} 
                            onChange={(e) => updateCustomCamera(cam.id, 'name', e.target.value)}
                            placeholder="e.g. Living Room"
                            className="w-full px-3 py-3 bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#243052] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-bold text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Column: Code Output & Preview (Expansive) */}
        <div className="flex-grow flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-6 pb-4 flex-shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                    : 'bg-white dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] border border-zinc-200 dark:border-[#243052]'
                }`}
              >
                <Eye size={18} />
                2D Preview
              </button>
              <button
                onClick={() => setActiveTab('3d')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                  activeTab === '3d'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                    : 'bg-white dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] border border-zinc-200 dark:border-[#243052]'
                }`}
              >
                <Box size={18} />
                3D Preview
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${
                  activeTab === 'code'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                    : 'bg-white dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] border border-zinc-200 dark:border-[#243052]'
                }`}
              >
                <Code size={18} />
                Ruby Code
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveToDevice}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] transition-colors"
                title="Save project to device"
              >
                <Save size={16} />
                Save Project
              </button>
              <button
                onClick={handleLoadFromDevice}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-[#243052] bg-white dark:bg-[#151a2e] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#243052] transition-colors"
                title="Load project from device"
              >
                <FolderOpen size={16} />
                Load Project
              </button>
            </div>
          </div>

          <div className="flex-grow flex flex-col min-h-0 overflow-hidden px-6 pb-6">
            {activeTab === 'preview' && (
              <Preview2D
                shape={shape}
                widthIn={widthFt * 12 + widthInches}
                lengthIn={lengthFt * 12 + lengthInches}
                thicknessIn={wallThicknessIn}
                lRightDepthIn={lRightDepthFt * 12 + lRightDepthInches}
                lBackWidthIn={lBackWidthFt * 12 + lBackWidthInches}
                uWallsIn={{
                  w1: uWalls.w1 * 12 + uWallsInches.w1,
                  w2: uWalls.w2 * 12 + uWallsInches.w2,
                  w3: uWalls.w3 * 12 + uWallsInches.w3,
                  w4: uWalls.w4 * 12 + uWallsInches.w4,
                  w5: uWalls.w5 * 12 + uWallsInches.w5,
                  w6: uWalls.w6 * 12 + uWallsInches.w6,
                  w7: uWalls.w7 * 12 + uWallsInches.w7,
                  w8: uWalls.w8 * 12 + uWallsInches.w8,
                }}
                hLeftBarWidthIn={hLeftBarWidthFt * 12 + hLeftBarWidthInches}
                hRightBarWidthIn={hRightBarWidthFt * 12 + hRightBarWidthInches}
                hMiddleBarHeightIn={hMiddleBarHeightFt * 12 + hMiddleBarHeightInches}
                hMiddleBarOffsetIn={hMiddleBarOffsetFt * 12 + hMiddleBarOffsetInches}
                tTopWidthIn={tTopWidthFt * 12 + tTopWidthInches}
                tTopLengthIn={tTopLengthFt * 12 + tTopLengthInches}
                tStemWidthIn={tStemWidthFt * 12 + tStemWidthInches}
                tStemLengthIn={tStemLengthFt * 12 + tStemLengthInches}
                interiorWalls={interiorWalls}
                exteriorWalls={exteriorWalls}
                doors={doors}
                windows={windows}
                bumpouts={bumpouts}
                updateInteriorWallFields={updateInteriorWallFields}
                updateExteriorWallFields={updateExteriorWallFields}
                updateDoorFields={updateDoorFields}
                updateWindowFields={updateWindowFields}
                updateBumpoutFields={updateBumpoutFields}
                getSnapPoints={getSnapPoints}
                addFloorFraming={addFloorFraming}
                joistSpacing={joistSpacing}
                joistSize={joistSize}
                joistDirection={joistDirection}
                floorBays={floorBays}
                addSubfloor={addSubfloor}
                subfloorThickness={subfloorThickness}
                subfloorMaterial={subfloorMaterial}
                enableGirderSystem={enableGirderSystem}
                girderSpanThresholdFt={girderSpanThresholdFt}
                girderPostSpacingFt={girderPostSpacingFt}
                girderSize={girderSize}
                girderPostSize={girderPostSize}
                girderPierSize={girderPierSize}
                addPocketBeams={addPocketBeams}
                pocketBeamsOnlyAtGirderEnds={pocketBeamsOnlyAtGirderEnds}
                pdfImages={pdfImages}
                selectedPdfIndex={selectedPdfIndex}
                pdfScale={pdfScale}
                pdfOffset={pdfOffset}
                pdfRotation={pdfRotation}
                pdfOpacity={pdfOpacity}
                isBlueprintLocked={isBlueprintLocked}
                pdfCalibration={pdfCalibration}
                setPdfScale={setPdfScale}
                setPdfOffset={setPdfOffset}
                setPdfOpacity={setPdfOpacity}
                setPdfCalibration={setPdfCalibration}
                setSelectedPdfIndex={setSelectedPdfIndex}
                onSave={handleSaveToDevice}
                onLoad={handleLoadFromDevice}
                isCalibrating={isCalibrating}
                setIsCalibrating={setIsCalibrating}
                appliedCalibration={appliedCalibration}
                guides={guides}
                onAddGuide={(guide) => setGuides(prev => [...prev, guide])}
                onDeleteLastGuide={() => setGuides(prev => prev.slice(0, -1))}
                onClearGuides={() => setGuides([])}
                setExteriorWalls={setExteriorWalls}
                setShape={setShape}
                combineExteriorWalls={combineExteriorWalls}
                shapeBlocks={shapeBlocks}
                combinedBlocks={combinedBlocks}
                setShapeBlocks={setShapeBlocks}
                lastWallEndPoint={lastWallEndPoint}
                lastWallType={lastWallType}
                ghostWall={ghostWall}
                additionalStories={additionalStories}
                currentFloorIndex={currentFloorIndex}
                setCurrentFloorIndex={setCurrentFloorIndex}
                assets={assets}
                setAssets={setAssets}
                roofParts={roofParts}
                setRoofParts={setRoofParts}
                selectedRoofPartId={selectedRoofPartId}
                setSelectedRoofPartId={setSelectedRoofPartId}
                trussRuns={trussRuns}
                setTrussRuns={setTrussRuns}
                selectedTrussRunId={selectedTrussRunId}
                setSelectedTrussRunId={setSelectedTrussRunId}
                trussSpacing={trussSpacing}
                dormers={dormers}
                setDormers={setDormers}
                selectedDormerId={selectedDormerId}
                setSelectedDormerId={setSelectedDormerId}
                lDirection={lDirection}
                customCameras={customCameras}
                setCustomCameras={setCustomCameras}
                onWallSelect={(id, type) => {
                  if (type === 'exterior') {
                    setExpandedExtWallId(id);
                    setActiveWallSection('exterior');
                  } else {
                    setExpandedWallId(id);
                    setActiveWallSection('interior');
                  }
                  if (!openSections.walls) toggleSection('walls');
                }}
                roofGroups={roofGroups}
              />
            )}

            {activeTab === '3d' && (
              <Preview3D
                shape={shape}
                widthIn={widthFt * 12 + widthInches}
                lengthIn={lengthFt * 12 + lengthInches}
                thicknessIn={wallThicknessIn}
                lRightDepthIn={lRightDepthFt * 12 + lRightDepthInches}
                lBackWidthIn={lBackWidthFt * 12 + lBackWidthInches}
                uWallsIn={{
                  w1: uWalls.w1 * 12 + uWallsInches.w1,
                  w2: uWalls.w2 * 12 + uWallsInches.w2,
                  w3: uWalls.w3 * 12 + uWallsInches.w3,
                  w4: uWalls.w4 * 12 + uWallsInches.w4,
                  w5: uWalls.w5 * 12 + uWallsInches.w5,
                  w6: uWalls.w6 * 12 + uWallsInches.w6,
                  w7: uWalls.w7 * 12 + uWallsInches.w7,
                  w8: uWalls.w8 * 12 + uWallsInches.w8,
                }}
                hLeftBarWidthIn={hLeftBarWidthFt * 12 + hLeftBarWidthInches}
                hRightBarWidthIn={hRightBarWidthFt * 12 + hRightBarWidthInches}
                hMiddleBarHeightIn={hMiddleBarHeightFt * 12 + hMiddleBarHeightInches}
                hMiddleBarOffsetIn={hMiddleBarOffsetFt * 12 + hMiddleBarOffsetInches}
                tTopWidthIn={tTopWidthFt * 12 + tTopWidthInches}
                tTopLengthIn={tTopLengthFt * 12 + tTopLengthInches}
                tStemWidthIn={tStemWidthFt * 12 + tStemWidthInches}
                tStemLengthIn={tStemLengthFt * 12 + tStemLengthInches}
                interiorWalls={interiorWalls}
                exteriorWalls={exteriorWalls}
                doors={doors}
                windows={windows}
                bumpouts={bumpouts}
                wallHeightIn={wallHeightFt * 12 + wallHeightInches}
                foundationType={foundationType}
                foundationShape={foundationShape}
                stemWallHeightIn={stemWallHeightIn}
                stemWallThicknessIn={stemWallThicknessIn}
                footingWidthIn={footingWidthIn}
                footingThicknessIn={footingThicknessIn}
                slabThicknessIn={slabThicknessIn}
                thickenedEdgeDepthIn={thickenedEdgeDepthIn}
                addFloorFraming={addFloorFraming}
                joistSpacing={joistSpacing}
                joistSize={joistSize}
                joistDirection={joistDirection}
                floorBays={floorBays}
                addSubfloor={addSubfloor}
                subfloorThickness={subfloorThickness}
                subfloorMaterial={subfloorMaterial}
                rimJoistThickness={rimJoistThickness}
                enableGirderSystem={enableGirderSystem}
                girderSpanThresholdFt={girderSpanThresholdFt}
                girderPostSpacingFt={girderPostSpacingFt}
                girderSize={girderSize}
                girderPostSize={girderPostSize}
                girderPierSize={girderPierSize}
                addPocketBeams={addPocketBeams}
                pocketBeamsOnlyAtGirderEnds={pocketBeamsOnlyAtGirderEnds}
                addInsulation={addInsulation}
                insulationThickness={insulationThickness}
                addSheathing={addSheathing}
                sheathingThickness={sheathingThickness}
                addDrywall={addDrywall}
                drywallThickness={drywallThickness}
                studSpacing={studSpacing}
                studThickness={studThickness}
                topPlates={topPlates}
                bottomPlates={bottomPlates}
                headerType={headerType}
                headerHeight={headerHeight}
                solidWallsOnly={solidWallsOnly}
                noFramingFloorOnly={noFramingFloorOnly}
                showGround={showGround}
                showSky={showSky}
                showSun={showSun}
                sunHour={sunHour}
                sunMonth={sunMonth}
                siteLatitude={siteLatitude}
                hdriPreset={hdriPreset}
                customHdriUrl={customHdriUrl}
                showRoof={showRoof}
                showAxes={showAxes}
                additionalStories={additionalStories}
                currentFloorIndex={currentFloorIndex}
                upperFloorWallHeightIn={upperFloorWallHeightFt * 12 + upperFloorWallHeightIn}
                upperFloorJoistSize={upperFloorJoistSize}
                combinedBlocks={combinedBlocks}
                shapeBlocks={shapeBlocks}
                referenceModelUrl={null}
                modelScale={1}
                modelOffset={{ x: 0, y: 0, z: 0 }}
                modelRotation={{ x: 0, y: 0, z: 0 }}
                modelOpacity={0.5}
                assets={assets}
                roofParts={roofParts}
                roofType={roofType}
                roofPitch={roofPitch}
                roofOverhangIn={roofOverhangIn}
                roofWidthIn={roofWidthIn}
                roofHeightIn={roofHeightIn}
                trussRuns={trussRuns}
                trussSpacing={trussSpacing}
                dormers={dormers}
                lDirection={lDirection}
                customCameras={customCameras}
                setCustomCameras={setCustomCameras}
                onSurfacePainted={(surfaceId, textureUrl, areaSqFt, finishType) => {
                  setPaintedSurfaces(prev => ({
                    ...prev,
                    [surfaceId]: { url: textureUrl, areaSqFt, finishType }
                  }));
                }}
              />
            )}

          {activeTab === 'code' && (
            <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-lg border border-zinc-200 dark:border-[#1c2240] flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-[#1c2240] flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-50 dark:bg-[#252526] gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                    <Code size={16} />
                    <span className="text-sm font-mono">house_shell.rb</span>
                  </div>
                  <div className="h-4 w-px bg-zinc-300 dark:bg-[#1c2240] hidden sm:block"></div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Generate:</label>
                    <select 
                      value={generationSection}
                      onChange={(e) => setGenerationSection(e.target.value as any)}
                      className="bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] text-zinc-700 dark:text-zinc-300 text-[11px] font-bold py-1 px-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="all">Full Model</option>
                      <option value="foundation">Foundation Only</option>
                      <option value="floor">Floor System Only</option>
                      <option value="exterior">Exterior Walls Only</option>
                      <option value="interior">Interior Walls Only</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBuildInSketchup()}
                    disabled={isBuilding}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium transition-colors shadow-sm ${isBuilding ? 'bg-emerald-500 opacity-80 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                  >
                    {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />}
                    {isBuilding ? 'Building...' : `Build ${generationSection === 'all' ? 'Full Model' : generationSection}`}
                  </button>
                  <button
                    onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([generateRubyCode()], {type: 'text/plain'});
                      element.href = URL.createObjectURL(file);
                      element.download = `house_shell_${generationSection}.rb`;
                      document.body.appendChild(element);
                      element.click();
                      document.body.removeChild(element);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-700 dark:text-white text-xs font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-700 dark:text-white text-xs font-medium transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy SketchUp Script'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto p-4 relative code-scrollbar bg-zinc-50 dark:bg-transparent" style={{maxHeight: 'calc(100vh - 200px)'}}>
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-white/40 dark:bg-[#0a0e1a]/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3 bg-white dark:bg-[#0f1424] p-6 rounded-xl border border-zinc-200 dark:border-[#1c2240] shadow-2xl">
                      <Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Analyzing Blueprint</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Updating Ruby Code...</p>
                      </div>
                    </div>
                  </div>
                )}
                <pre className="text-sm font-mono text-zinc-800 dark:text-zinc-300 leading-relaxed">
                  <code>{generateRubyCode()}</code>
                </pre>
              </div>
            </div>
          )}
          </div>
        </div>
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e4e4e7;
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #d4d4d8;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
        }
        .dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #52525b;
        }
        .code-scrollbar::-webkit-scrollbar {
          width: 14px;
        }
        .code-scrollbar::-webkit-scrollbar-track {
          background: #e4e4e7;
          border-radius: 7px;
        }
        .code-scrollbar::-webkit-scrollbar-thumb {
          background-color: #71717a;
          border-radius: 7px;
          border: 3px solid #e4e4e7;
        }
        .code-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #52525b;
        }
        .dark .code-scrollbar::-webkit-scrollbar-track {
          background: #27272a;
        }
        .dark .code-scrollbar::-webkit-scrollbar-thumb {
          background-color: #a1a1aa;
          border: 3px solid #27272a;
        }
        .dark .code-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #d4d4d8;
        }
      `}} />

      {/* Calibration Modal */}
      {isCalibrating && pdfCalibration.p1 && pdfCalibration.p2 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0f1424] rounded-xl shadow-2xl p-6 w-96 animate-in fade-in zoom-in-95 duration-200 border border-zinc-200 dark:border-[#1c2240]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Set Blueprint Scale</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Enter the real-world distance between the two points you clicked.</p>
              </div>
              <button 
                onClick={() => {
                  setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
                  setCalibrationLength("");
                  setIsCalibrating(false);
                }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Real World Distance</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="e.g. 10' 6&quot; or 126"
                  value={calibrationLength}
                  onChange={e => setCalibrationLength(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-[#0f1424]/50 border border-zinc-300 dark:border-[#243052] rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xl font-bold text-zinc-900 dark:text-zinc-100 placeholder:font-normal placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCalibration();
                    if (e.key === 'Escape') {
                      setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
                      setCalibrationLength("");
                    }
                  }}
                />
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                  Tip: Use feet/inches (10' 6") or just inches (126).
                </p>
              </div>

              {exteriorWalls.length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-[#151a2e]/50 rounded-lg border border-zinc-100 dark:border-[#1c2240]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${chainToLastWall ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-300 dark:bg-[#243052]'}`} />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">Chain to Last Wall</span>
                  </div>
                  <button 
                    onClick={() => setChainToLastWall(!chainToLastWall)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${chainToLastWall ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-[#1c2240]'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${chainToLastWall ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
              
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAddAsWall('exterior')}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Exterior Wall
                </button>
                <button 
                  onClick={() => handleAddAsWall('interior')}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Interior Wall
                </button>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
                    setCalibrationLength("");
                  }}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-[#151a2e] hover:bg-zinc-200 dark:hover:bg-[#243052] text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-zinc-200 dark:border-[#243052]"
                >
                  Reset Points
                </button>
                <button 
                  onClick={handleApplyCalibration}
                  className="flex-1 py-2 bg-zinc-800 dark:bg-[#1c2240] hover:bg-zinc-900 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {appliedCalibration ? 'Add Guide' : 'Apply Scale'}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Plugin Setup Modal */}
      {showPluginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0f1424] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-[#1c2240]">
            <div className="p-6 border-b border-zinc-100 dark:border-[#1c2240] bg-zinc-50/50 dark:bg-[#252526]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <AppWindow className="text-indigo-600 dark:text-indigo-400" />
                  SketchUp Plugin Setup
                </h2>
                <button 
                  onClick={() => setShowPluginModal(false)}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-[#1c2240] rounded-full transition-colors"
                >
                  <Trash2 size={18} className="text-zinc-400 dark:text-zinc-500" />
                </button>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Follow these steps to install the plugin in SketchUp.</p>
            </div>
            
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Download Loader</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">This file registers the extension in SketchUp.</p>
                    <button 
                      onClick={handleDownloadLoader}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#151a2e]/50 border border-zinc-200 dark:border-[#243052] rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors w-full justify-center text-zinc-700 dark:text-zinc-300 shadow-sm"
                    >
                      <FileText size={14} />
                      dooley_loader.rb
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Download Main Logic</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">The core functionality that connects to this app.</p>
                    <button 
                      onClick={handleDownloadMain}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#151a2e]/50 border border-zinc-200 dark:border-[#243052] rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-[#1c2240] transition-colors w-full justify-center text-zinc-700 dark:text-zinc-300 shadow-sm"
                    >
                      <FileText size={14} />
                      main.rb
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Install in SketchUp</p>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-[#151a2e]/30 p-3 rounded-lg border border-zinc-100 dark:border-[#1c2240] mt-2">
                      <ol className="list-decimal list-inside space-y-2">
                        <li>Open SketchUp Plugins folder.</li>
                        <li>Place <code className="bg-zinc-200 dark:bg-[#1c2240] px-1 rounded text-indigo-700 dark:text-indigo-400 font-mono">dooley_loader.rb</code> in the root.</li>
                        <li>Create a folder named <code className="bg-zinc-200 dark:bg-[#1c2240] px-1 rounded text-indigo-700 dark:text-indigo-400 font-mono">dooley_extension</code>.</li>
                        <li>Place <code className="bg-zinc-200 dark:bg-[#1c2240] px-1 rounded text-indigo-700 dark:text-indigo-400 font-mono">main.rb</code> inside that folder.</li>
                        <li>Restart SketchUp.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-[#252526] border-t border-zinc-100 dark:border-[#1c2240] flex justify-end">
              <button 
                onClick={() => setShowPluginModal(false)}
                className="px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white/20 p-1 rounded-full">
            {successMessage.includes("Added") ? <Plus size={16} /> : <Check size={16} />}
          </div>
          <span className="font-bold tracking-wide">{successMessage}</span>
        </div>
      )}

      {/* Project Loading Overlay */}
      {isProjectLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0f1424] border border-zinc-200 dark:border-[#1c2240] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-indigo-500 dark:text-indigo-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Restoring Project</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Please wait while we rebuild your floor plan and settings...</p>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-[#151a2e] h-1.5 rounded-full overflow-hidden mt-2">
              <div className="bg-indigo-500 h-full w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

