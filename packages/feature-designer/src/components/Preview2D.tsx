import React, { useRef, useState, useEffect, useMemo } from 'react';
import { sanitize } from '../utils/math';
import { InteriorWallConfig, ExteriorWallConfig, DoorConfig, WindowConfig, BumpoutConfig, Guide, SnapPoint, InteriorAsset, RoofPart, TrussConfig, DormerConfig, CustomCamera, RoofGroup } from '../App';
import { getSymbolById, CATEGORY_COLORS } from './SymbolCatalog';
import { computeRoofPlan, shellToBounds, RoofShellBounds } from '../utils/roofGeometry';
import { detectBays, computeFramingSupportSystem } from '../utils/bayDetection';
import { ZoomIn, ZoomOut, Maximize, Minimize, Focus, Hand, ChevronLeft, ChevronRight, Ruler, Trash2, Undo2, Search, Lock, MousePointer2, Save, FolderOpen, ChevronDown, ChevronUp, Square, Box as BoxIcon, Combine, Layers, Home, Grid, Camera } from 'lucide-react';

interface Preview2DProps {
  shape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom';
  widthIn: number;
  lengthIn: number;
  thicknessIn: number;
  lRightDepthIn: number;
  lBackWidthIn: number;
  uWallsIn: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number; w7: number; w8: number };
  hLeftBarWidthIn: number;
  hRightBarWidthIn: number;
  hMiddleBarHeightIn: number;
  hMiddleBarOffsetIn: number;
  tTopWidthIn: number;
  tTopLengthIn: number;
  tStemWidthIn: number;
  tStemLengthIn: number;
  interiorWalls: InteriorWallConfig[];
  exteriorWalls: ExteriorWallConfig[];
  doors: DoorConfig[];
  windows: WindowConfig[];
  bumpouts: BumpoutConfig[];
  updateInteriorWallFields: (id: number, updates: Partial<InteriorWallConfig>) => void;
  updateExteriorWallFields: (id: number, updates: Partial<ExteriorWallConfig>) => void;
  updateDoorFields: (id: string, updates: Partial<DoorConfig>) => void;
  updateWindowFields: (id: string, updates: Partial<WindowConfig>) => void;
  updateBumpoutFields: (id: string, updates: Partial<BumpoutConfig>) => void;
  getSnapPoints: (axis: 'x' | 'y', excludeWallId?: number, excludeOpeningId?: string) => SnapPoint[];
  addFloorFraming: boolean;
  joistSpacing: number;
  joistSize: string;
  joistDirection: 'x' | 'y';
  floorBays?: { id: string; label: string; joistDirection: 'x' | 'y'; x: number; y: number; width: number; height: number }[];
  addSubfloor: boolean;
  subfloorThickness: number;
  subfloorMaterial: 'plywood' | 'osb';
  enableGirderSystem?: boolean;
  girderSpanThresholdFt?: number;
  girderPostSpacingFt?: number;
  girderSize?: '2-2x10' | '3-2x10' | '4-2x10' | '6x6' | '6x8';
  girderPostSize?: '4x4' | '6x6';
  girderPierSize?: '12" Round' | '16" Square';
  addPocketBeams?: boolean;
  pocketBeamsOnlyAtGirderEnds?: boolean;
  foundationType?: 'none' | 'slab' | 'slab-on-grade' | 'stem-wall';
  // PDF Reference
  pdfImages: string[];
  selectedPdfIndex: number;
  pdfScale: number;
  pdfOffset: { x: number; y: number };
  pdfRotation: number;
  pdfOpacity: number;
  isBlueprintLocked: boolean;
  pdfCalibration: { p1: { x: number; y: number } | null; p2: { x: number; y: number } | null; realLengthIn: number };
  setPdfScale: (scale: number) => void;
  setPdfOffset: (offset: { x: number; y: number }) => void;
  setPdfOpacity: (opacity: number) => void;
  setPdfCalibration: (cal: any) => void;
  setSelectedPdfIndex: (index: number) => void;
  onSave?: () => void;
  onLoad?: () => void;
  isCalibrating: boolean;
  setIsCalibrating: (isCalibrating: boolean) => void;
  appliedCalibration: { p1: { x: number; y: number }; p2: { x: number; y: number }; realLengthIn: number } | null;
  guides: Guide[];
  onAddGuide: (guide: Guide) => void;
  onDeleteLastGuide: () => void;
  onClearGuides: () => void;
  setExteriorWalls: (walls: ExteriorWallConfig[]) => void;
  setShape: (shape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom') => void;
  combineExteriorWalls: () => void;
  shapeBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  combinedBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  setShapeBlocks: React.Dispatch<React.SetStateAction<{ id: string, x: number, y: number, w: number, h: number }[]>>;
  lastWallEndPoint?: { x: number, y: number } | null;
  lastWallType: 'exterior' | 'interior';
  ghostWall: { x: number, y: number, w: number, h: number, type: 'exterior' | 'interior' } | null;
  additionalStories: number;
  currentFloorIndex: number;
  setCurrentFloorIndex: (index: number) => void;
  assets: InteriorAsset[];
  setAssets: React.Dispatch<React.SetStateAction<InteriorAsset[]>>;
  roofParts: RoofPart[];
  setRoofParts: React.Dispatch<React.SetStateAction<RoofPart[]>>;
  selectedRoofPartId: string | null;
  setSelectedRoofPartId: (id: string | null) => void;
  trussRuns: TrussConfig[];
  setTrussRuns: React.Dispatch<React.SetStateAction<TrussConfig[]>>;
  selectedTrussRunId: string | null;
  setSelectedTrussRunId: (id: string | null) => void;
  trussSpacing: number;
  dormers: DormerConfig[];
  setDormers: React.Dispatch<React.SetStateAction<DormerConfig[]>>;
  selectedDormerId: string | null;
  setSelectedDormerId: (id: string | null) => void;
  lDirection?: 'front-left' | 'front-right' | 'back-right' | 'back-left';
  customCameras: CustomCamera[];
  setCustomCameras: React.Dispatch<React.SetStateAction<CustomCamera[]>>;
  onWallSelect?: (id: number, type: 'interior' | 'exterior') => void;
  roofGroups?: RoofGroup[];
}

interface GirderData {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  posts: { x: number; y: number; id: string }[];
  brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[];
}

export function computeGirdersForBay(
  bay: { x: number; y: number; width: number; height: number; joistDirection: 'x' | 'y' },
  enableGirderSystem: boolean,
  girderSpanThresholdFt: number,
  girderPostSpacingFt: number
): GirderData[] {
  if (!enableGirderSystem) return [];

  const thresholdIn = girderSpanThresholdFt * 12;
  const postSpacingIn = girderPostSpacingFt * 12;

  const isSpanY = bay.joistDirection === 'y';
  const spanIn = isSpanY ? bay.height : bay.width;
  const girderLengthIn = isSpanY ? bay.width : bay.height;

  if (spanIn <= thresholdIn) return [];

  // Split the span equally
  const numSpaces = Math.ceil(spanIn / thresholdIn);
  const numGirders = numSpaces - 1;
  const girders: GirderData[] = [];

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

    const numPostSpaces = Math.max(1, Math.ceil(girderLengthIn / postSpacingIn));
    const posts: { x: number; y: number; id: string }[] = [];
    const brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[] = [];

    for (let j = 0; j <= numPostSpaces; j++) {
      const pOffset = j * (girderLengthIn / numPostSpaces);
      let px = 0, py = 0;
      if (isSpanY) {
        px = bay.x + pOffset;
        py = y1;
      } else {
        px = x1;
        py = bay.y + pOffset;
      }

      if (j === 0) {
        brackets.push({ x: px, y: py, id: `bracket-${i}-start`, type: 'start' });
      } else if (j === numPostSpaces) {
        brackets.push({ x: px, y: py, id: `bracket-${i}-end`, type: 'end' });
      } else {
        posts.push({
          x: px,
          y: py,
          id: `post-${i}-${j}`
        });
      }
    }

    girders.push({
      id: `girder-${i}`,
      x1,
      y1,
      x2,
      y2,
      length: girderLengthIn,
      posts,
      brackets
    });
  }

  return girders;
}

export default function Preview2D({
  shape, widthIn, lengthIn, thicknessIn, lRightDepthIn, lBackWidthIn, uWallsIn,
  hLeftBarWidthIn, hRightBarWidthIn, hMiddleBarHeightIn, hMiddleBarOffsetIn,
  tTopWidthIn, tTopLengthIn, tStemWidthIn, tStemLengthIn,
  interiorWalls, exteriorWalls, doors, windows, bumpouts, updateInteriorWallFields, updateExteriorWallFields, updateDoorFields, updateWindowFields, updateBumpoutFields, getSnapPoints,
  addFloorFraming, joistSpacing, joistSize, joistDirection, floorBays = [], addSubfloor, subfloorThickness, subfloorMaterial,
  enableGirderSystem = false,
  foundationType = 'stem-wall',
  girderSpanThresholdFt = 12,
  girderPostSpacingFt = 8,
  girderSize = '3-2x10',
  girderPostSize = '6x6',
  girderPierSize = '12" Round',
  addPocketBeams = true,
  pocketBeamsOnlyAtGirderEnds = false,
  pdfImages, selectedPdfIndex, pdfScale, pdfOffset, pdfRotation, pdfOpacity, isBlueprintLocked, pdfCalibration, setPdfScale, setPdfOffset, setPdfOpacity, setPdfCalibration, setSelectedPdfIndex,
  onSave, onLoad,
  isCalibrating, setIsCalibrating, appliedCalibration, guides, onAddGuide, onDeleteLastGuide, onClearGuides,
  setExteriorWalls, setShape, combineExteriorWalls,
  shapeBlocks, combinedBlocks, setShapeBlocks,
  lastWallEndPoint,
  lastWallType,
  ghostWall,
  additionalStories,
  currentFloorIndex,
  setCurrentFloorIndex,
  assets,
  setAssets,
  roofParts,
  setRoofParts,
  selectedRoofPartId,
  setSelectedRoofPartId,
  trussRuns,
  setTrussRuns,
  selectedTrussRunId,
  setSelectedTrussRunId,
  trussSpacing,
  dormers,
  setDormers,
  selectedDormerId,
  setSelectedDormerId,
  lDirection = 'front-left',
  customCameras,
  setCustomCameras,
  onWallSelect,
  roofGroups = [],
}: Preview2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingWall, setDraggingWall] = useState<{ id: number, type: 'interior' | 'exterior', initialY: number } | null>(null);
  const [draggingOpening, setDraggingOpening] = useState<{ id: string, type: 'door' | 'window', initialOx: number } | null>(null);
  const [draggingBumpout, setDraggingBumpout] = useState<{ id: string, initialOx: number } | null>(null);
  const [draggingCameraId, setDraggingCameraId] = useState<string | null>(null);
  const [rotatingCameraId, setRotatingCameraId] = useState<string | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [rotatingAssetId, setRotatingAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<number | null>(null);
  const [selectedWallType, setSelectedWallType] = useState<'interior' | 'exterior' | null>(null);
  const [draggingPdf, setDraggingPdf] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPt, setDragStartPt] = useState({ x: 0, y: 0 });
  const [dragAxis, setDragAxis] = useState<'x' | 'y' | null>(null);
  const [snapLines, setSnapLines] = useState<{ axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[]>([]);
  // const [isCalibrating, setIsCalibrating] = useState(false); // Moved to App.tsx
  const [calibratingPoint, setCalibratingPoint] = useState<'p1' | 'p2' | null>(null);
  
  // Zoom & Pan
  const [zoom, setZoom] = useState(0.8);
  const [targetZoom, setTargetZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [targetPan, setTargetPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const [isShiftDown, setIsShiftDown] = useState(false);
  const [isCtrlDown, setIsCtrlDown] = useState(false);
  const [resizingCornerOnly, setResizingCornerOnly] = useState(false);
  const [isZoomSelectionMode, setIsZoomSelectionMode] = useState(false);
  const [zoomSelectionStart, setZoomSelectionStart] = useState<{ x: number, y: number } | null>(null);
  const [zoomSelectionEnd, setZoomSelectionEnd] = useState<{ x: number, y: number } | null>(null);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeToolbarGroup, setActiveToolbarGroup] = useState<string | null>('tools');
  const [viewMode, setViewMode] = useState<'floor' | 'roof'>('floor');
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [svgAspect, setSvgAspect] = useState(1);
  
  const magnifierGroupRef = useRef<SVGGElement>(null);
  const magnifierUseRef = useRef<SVGUseElement>(null);

  // ─── Compute 2D Roof Plan hatching geometry ─────────────────────────
  const roofPlanResult = useMemo(() => {
    const solidShells = trussRuns
      .filter(r => r.type === 'Solid Shell')
      .map(r => shellToBounds(r))
      .filter((b): b is RoofShellBounds => b !== null);
    
    if (solidShells.length === 0) return { lines: [], annotations: [] };

    // Build group arrays from roofGroups
    const groupedIds = roofGroups.length > 0
      ? roofGroups.map(g => g.shellIds)
      : [solidShells.map(s => s.id)]; // default: all in one group
    
    return computeRoofPlan(solidShells, groupedIds);
  }, [trussRuns, roofGroups]);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const lastZoomedPdf = useRef<string | null>(null);
  const prevBaseSize = useRef<number | null>(null);
  const prevCx = useRef<number | null>(null);
  const prevCy = useRef<number | null>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect.height > 0) {
          setSvgAspect(entry.contentRect.width / entry.contentRect.height);
        }
      }
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    panRef.current = pan;
    zoomRef.current = zoom;
  }, [pan, zoom]);

  // Smooth Panning and Zooming
  useEffect(() => {
    let rafId: number;
    const smooth = () => {
      const currentPan = panRef.current;
      const currentZoom = zoomRef.current;
      
      const dx = targetPan.x - currentPan.x;
      const dy = targetPan.y - currentPan.y;
      const dz = targetZoom - currentZoom;
      
      const needsPan = Math.abs(dx) >= 0.01 || Math.abs(dy) >= 0.01;
      const needsZoom = Math.abs(dz) >= 0.001;
      
      if (needsPan) {
        const newPan = {
          x: currentPan.x + dx * 0.2,
          y: currentPan.y + dy * 0.2
        };
        setPan(newPan);
        panRef.current = newPan;
      } else if (currentPan.x !== targetPan.x || currentPan.y !== targetPan.y) {
        setPan(targetPan);
        panRef.current = targetPan;
      }
      
      if (needsZoom) {
        const newZoom = currentZoom + dz * 0.2;
        setZoom(newZoom);
        zoomRef.current = newZoom;
      } else if (currentZoom !== targetZoom) {
        setZoom(targetZoom);
        zoomRef.current = targetZoom;
      }
      
      if (needsPan || needsZoom) {
        rafId = requestAnimationFrame(smooth);
      }
    };
    rafId = requestAnimationFrame(smooth);
    return () => cancelAnimationFrame(rafId);
  }, [targetPan, targetZoom]);

  useEffect(() => {
    if (!isCalibrating) setIsRulerMode(false);
  }, [isCalibrating]);

  const getLockedPoint = (start: { x: number, y: number }, current: { x: number, y: number }) => {
    if (!isCalibrating) return { ...current, axis: null };
    const dx = Math.abs(current.x - start.x);
    const dy = Math.abs(current.y - start.y);
    const threshold = 20; 
    
    if (isShiftDown) {
      if (dx > dy) return { x: current.x, y: start.y, axis: 'x' as const };
      return { x: start.x, y: current.y, axis: 'y' as const };
    }

    if (dy < threshold) return { x: current.x, y: start.y, axis: 'x' as const }; // Horizontal
    if (dx < threshold) return { x: start.x, y: current.y, axis: 'y' as const }; // Vertical
    return { ...current, axis: null };
  };

  // Calculate exterior walls
  const extWalls: { id: number, x: number, y: number, w: number, h: number, isHorizontal: boolean, exteriorSide: 1 | -1 }[] = [];
  const ghostWalls: { id: string, x: number, y: number, w: number, h: number, isHorizontal: boolean, type: 'exterior' | 'interior' }[] = [];
  const bumpoutWalls: { id: string, x: number, y: number, w: number, h: number, isHorizontal: boolean, exteriorSide: 1 | -1 }[] = [];
  let maxX = 0;
  let maxY = 0;

  const formatDim = (inches: number) => {
    const totalRounded = Math.round(Math.abs(inches));
    const ft = Math.floor(totalRounded / 12);
    const inc = totalRounded % 12;
    if (ft === 0) return `${inc}"`;
    if (inc === 0) return `${ft}'`;
    return `${ft}'-${inc}"`;
  };

  const dimensions: { x1: number, y1: number, x2: number, y2: number, label: string, offset: number, isHorizontal: boolean, isOpening?: boolean, isPlacement?: boolean }[] = [];

  if (shape === 'rectangle') {
    maxX = widthIn;
    maxY = lengthIn;
    extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 }); // Wall 1
    extWalls.push({ id: 3, x: 0, y: lengthIn - thicknessIn, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 3
    extWalls.push({ id: 4, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 }); // Wall 4
    extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 }); // Wall 2
    
    dimensions.push({ x1: 0, y1: 0, x2: widthIn, y2: 0, label: formatDim(widthIn), offset: -16, isHorizontal: true });
    dimensions.push({ x1: 0, y1: 0, x2: 0, y2: lengthIn, label: formatDim(lengthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: 0, y1: lengthIn, x2: widthIn, y2: lengthIn, label: formatDim(widthIn), offset: 16, isHorizontal: true });
    dimensions.push({ x1: widthIn, y1: 0, x2: widthIn, y2: lengthIn, label: formatDim(lengthIn), offset: 16, isHorizontal: false });
  } else if (shape === 'l-shape') {
    maxX = widthIn;
    maxY = lengthIn;
    extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 }); // Wall 1
    extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lRightDepthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 }); // Wall 2
    extWalls.push({ id: 3, x: lBackWidthIn - thicknessIn, y: lRightDepthIn - thicknessIn, w: widthIn - lBackWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 3
    extWalls.push({ id: 4, x: lBackWidthIn - thicknessIn, y: lRightDepthIn, w: thicknessIn, h: lengthIn - lRightDepthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 }); // Wall 4
    extWalls.push({ id: 5, x: 0, y: lengthIn - thicknessIn, w: lBackWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 5
    extWalls.push({ id: 6, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 }); // Wall 6
    
    dimensions.push({ x1: 0, y1: 0, x2: widthIn, y2: 0, label: formatDim(widthIn), offset: -16, isHorizontal: true });
    dimensions.push({ x1: 0, y1: 0, x2: 0, y2: lengthIn, label: formatDim(lengthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: widthIn, y1: 0, x2: widthIn, y2: lRightDepthIn, label: formatDim(lRightDepthIn), offset: 16, isHorizontal: false });
    dimensions.push({ x1: lBackWidthIn, y1: lRightDepthIn, x2: widthIn, y2: lRightDepthIn, label: formatDim(widthIn - lBackWidthIn), offset: 16, isHorizontal: true });
    dimensions.push({ x1: lBackWidthIn, y1: lRightDepthIn, x2: lBackWidthIn, y2: lengthIn, label: formatDim(lengthIn - lRightDepthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: 0, y1: lengthIn, x2: lBackWidthIn, y2: lengthIn, label: formatDim(lBackWidthIn), offset: 16, isHorizontal: true });
  } else if (shape === 'u-shape') {
    maxX = uWallsIn.w1;
    maxY = Math.max(uWallsIn.w2, uWallsIn.w8);
    extWalls.push({ id: 1, x: 0, y: 0, w: uWallsIn.w1, h: thicknessIn, isHorizontal: true, exteriorSide: -1 }); // Wall 1
    extWalls.push({ id: 2, x: uWallsIn.w1 - thicknessIn, y: thicknessIn, w: thicknessIn, h: uWallsIn.w2 - thicknessIn, isHorizontal: false, exteriorSide: 1 }); // Wall 2
    extWalls.push({ id: 3, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - thicknessIn, w: uWallsIn.w3 - thicknessIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 3
    extWalls.push({ id: 4, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - uWallsIn.w4, w: thicknessIn, h: uWallsIn.w4 - thicknessIn, isHorizontal: false, exteriorSide: -1 }); // Wall 4
    extWalls.push({ id: 5, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w2 - uWallsIn.w4 - thicknessIn, w: uWallsIn.w5 + 2 * thicknessIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 5
    extWalls.push({ id: 6, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w8 - uWallsIn.w6, w: thicknessIn, h: uWallsIn.w6 - thicknessIn, isHorizontal: false, exteriorSide: 1 }); // Wall 6
    extWalls.push({ id: 7, x: 0, y: uWallsIn.w8 - thicknessIn, w: uWallsIn.w7, h: thicknessIn, isHorizontal: true, exteriorSide: 1 }); // Wall 7
    extWalls.push({ id: 8, x: 0, y: thicknessIn, w: thicknessIn, h: uWallsIn.w8 - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 }); // Wall 8
    
    dimensions.push({ x1: 0, y1: 0, x2: uWallsIn.w1, y2: 0, label: formatDim(uWallsIn.w1), offset: -16, isHorizontal: true });
    dimensions.push({ x1: uWallsIn.w1, y1: 0, x2: uWallsIn.w1, y2: uWallsIn.w2, label: formatDim(uWallsIn.w2), offset: 16, isHorizontal: false });
    dimensions.push({ x1: uWallsIn.w1 - uWallsIn.w3, y1: uWallsIn.w2, x2: uWallsIn.w1, y2: uWallsIn.w2, label: formatDim(uWallsIn.w3), offset: 16, isHorizontal: true });
    dimensions.push({ x1: uWallsIn.w1 - uWallsIn.w3, y1: uWallsIn.w2 - uWallsIn.w4, x2: uWallsIn.w1 - uWallsIn.w3, y2: uWallsIn.w2, label: formatDim(uWallsIn.w4), offset: -16, isHorizontal: false });
    dimensions.push({ x1: uWallsIn.w7, y1: uWallsIn.w2 - uWallsIn.w4, x2: uWallsIn.w1 - uWallsIn.w3, y2: uWallsIn.w2 - uWallsIn.w4, label: formatDim(uWallsIn.w5), offset: -16, isHorizontal: true });
    dimensions.push({ x1: uWallsIn.w7, y1: uWallsIn.w8 - uWallsIn.w6, x2: uWallsIn.w7, y2: uWallsIn.w2 - uWallsIn.w4, label: formatDim(uWallsIn.w6), offset: 16, isHorizontal: false });
    dimensions.push({ x1: 0, y1: uWallsIn.w8, x2: uWallsIn.w7, y2: uWallsIn.w8, label: formatDim(uWallsIn.w7), offset: 16, isHorizontal: true });
    dimensions.push({ x1: 0, y1: 0, x2: 0, y2: uWallsIn.w8, label: formatDim(uWallsIn.w8), offset: -16, isHorizontal: false });
  } else if (shape === 'h-shape') {
    maxX = widthIn;
    maxY = lengthIn;
    // Left Bar
    extWalls.push({ id: 1, x: 0, y: 0, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
    extWalls.push({ id: 2, x: hLeftBarWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
    extWalls.push({ id: 3, x: hLeftBarWidthIn - thicknessIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false, exteriorSide: 1 });
    extWalls.push({ id: 4, x: 0, y: lengthIn - thicknessIn, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
    extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });

    // Middle Bar
    extWalls.push({ id: 6, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
    extWalls.push({ id: 7, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn - thicknessIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });

    // Right Bar
    extWalls.push({ id: 8, x: widthIn - hRightBarWidthIn, y: 0, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
    extWalls.push({ id: 9, x: widthIn - hRightBarWidthIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false, exteriorSide: -1 });
    extWalls.push({ id: 10, x: widthIn - hRightBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false, exteriorSide: -1 });
    extWalls.push({ id: 11, x: widthIn - hRightBarWidthIn, y: lengthIn - thicknessIn, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
    extWalls.push({ id: 12, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 });

    dimensions.push({ x1: 0, y1: 0, x2: widthIn, y2: 0, label: formatDim(widthIn), offset: -16, isHorizontal: true });
    dimensions.push({ x1: 0, y1: 0, x2: 0, y2: lengthIn, label: formatDim(lengthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: widthIn, y1: 0, x2: widthIn, y2: lengthIn, label: formatDim(lengthIn), offset: 16, isHorizontal: false });
    dimensions.push({ x1: 0, y1: lengthIn, x2: widthIn, y2: lengthIn, label: formatDim(widthIn), offset: 16, isHorizontal: true });
  } else if (shape === 't-shape') {
    maxX = tTopWidthIn;
    maxY = tTopLengthIn + tStemLengthIn;
    const stemX = (tTopWidthIn - tStemWidthIn) / 2;

    // Top Bar
    extWalls.push({ id: 1, x: 0, y: 0, w: tTopWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
    extWalls.push({ id: 2, x: tTopWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 });
    extWalls.push({ id: 3, x: stemX + tStemWidthIn, y: tTopLengthIn - thicknessIn, w: tTopWidthIn - (stemX + tStemWidthIn), h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
    extWalls.push({ id: 4, x: 0, y: tTopLengthIn - thicknessIn, w: stemX, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
    extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });

    // Stem
    extWalls.push({ id: 6, x: stemX, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false, exteriorSide: -1 });
    extWalls.push({ id: 7, x: stemX + tStemWidthIn - thicknessIn, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
    extWalls.push({ id: 8, x: stemX, y: tTopLengthIn + tStemLengthIn - thicknessIn, w: tStemWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });

    dimensions.push({ x1: 0, y1: 0, x2: tTopWidthIn, y2: 0, label: formatDim(tTopWidthIn), offset: -16, isHorizontal: true });
    dimensions.push({ x1: 0, y1: 0, x2: 0, y2: tTopLengthIn, label: formatDim(tTopLengthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: stemX, y1: tTopLengthIn, x2: stemX, y2: tTopLengthIn + tStemLengthIn, label: formatDim(tStemLengthIn), offset: -16, isHorizontal: false });
    dimensions.push({ x1: stemX, y1: tTopLengthIn + tStemLengthIn, x2: stemX + tStemWidthIn, y2: tTopLengthIn + tStemLengthIn, label: formatDim(tStemWidthIn), offset: 16, isHorizontal: true });
  } else if (shape === 'custom') {
    // Custom shape doesn't have a fixed bounding box based on width/length
    // We'll calculate it from all walls
  }

  // Add custom exterior walls to extWalls
  exteriorWalls.forEach(wall => {
    const wallFloor = wall.floorIndex || 0;
    const x = wall.xFt * 12 + wall.xInches;
    const y = wall.yFt * 12 + wall.yInches;
    const len = wall.lengthFt * 12 + wall.lengthInches;
    const isHorizontal = wall.orientation === 'horizontal';
    
    let w = isHorizontal ? len : wall.thicknessIn;
    let h = isHorizontal ? wall.thicknessIn : len;
    let finalX = x;
    let finalY = y;

    if (w < 0) {
      finalX += w;
      w = Math.abs(w);
    }
    if (h < 0) {
      finalY += h;
      h = Math.abs(h);
    }

    if (isHorizontal) {
      if (wall.exteriorSide === 1) finalY -= wall.thicknessIn;
    } else {
      if (wall.exteriorSide === 1) finalX -= wall.thicknessIn;
    }

    if (wallFloor === currentFloorIndex) {
      extWalls.push({
        id: wall.id,
        x: finalX,
        y: finalY,
        w,
        h,
        isHorizontal,
        exteriorSide: wall.exteriorSide
      });
    } else if (wallFloor === currentFloorIndex - 1) {
      ghostWalls.push({
        id: `ghost-ext-${wall.id}`,
        x: finalX,
        y: finalY,
        w,
        h,
        isHorizontal,
        type: 'exterior'
      });
    }
  });

  // Calculate bumpout walls
  bumpouts.forEach(b => {
    const bFloor = b.floorIndex || 0;
    if (bFloor !== currentFloorIndex) return;
    
    const wallId = b.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    if (!extWall) return;

    const bx = b.xFt * 12 + b.xInches;
    const bw = b.widthIn;
    const bd = b.depthIn;
    const t = thicknessIn;

    if (extWall.isHorizontal) {
      const sy = extWall.exteriorSide === 1 ? extWall.y : extWall.y - bd + t;
      // Left wall
      bumpoutWalls.push({ id: `${b.id}-l`, x: extWall.x + bx, y: sy, w: t, h: bd, isHorizontal: false, exteriorSide: -1 });
      // Right wall
      bumpoutWalls.push({ id: `${b.id}-r`, x: extWall.x + bx + bw - t, y: sy, w: t, h: bd, isHorizontal: false, exteriorSide: 1 });
      // Front wall
      bumpoutWalls.push({ id: `${b.id}-f`, x: extWall.x + bx, y: extWall.y + extWall.exteriorSide * (bd - t), w: bw, h: t, isHorizontal: true, exteriorSide: extWall.exteriorSide });
    } else {
      const sx = extWall.exteriorSide === 1 ? extWall.x : extWall.x - bd + t;
      // Left wall
      bumpoutWalls.push({ id: `${b.id}-l`, x: sx, y: extWall.y + bx, w: bd, h: t, isHorizontal: true, exteriorSide: -1 });
      // Right wall
      bumpoutWalls.push({ id: `${b.id}-r`, x: sx, y: extWall.y + bx + bw - t, w: bd, h: t, isHorizontal: true, exteriorSide: 1 });
      // Front wall
      bumpoutWalls.push({ id: `${b.id}-f`, x: extWall.x + extWall.exteriorSide * (bd - t), y: extWall.y + bx, w: t, h: bw, isHorizontal: false, exteriorSide: extWall.exteriorSide });
    }
  });

  // Calculate maxX and maxY from all walls across all floors for stability
  const allElements = [
    ...exteriorWalls.map(w => {
      const x = w.xFt * 12 + w.xInches;
      const y = w.yFt * 12 + w.yInches;
      const len = w.lengthFt * 12 + w.lengthInches;
      const isHorizontal = w.orientation === 'horizontal';
      return { x, y, w: isHorizontal ? len : w.thicknessIn, h: isHorizontal ? w.thicknessIn : len };
    }),
    ...interiorWalls.map(w => {
      const x = w.xFt * 12 + w.xInches;
      const y = w.yFt * 12 + w.yInches;
      const len = w.lengthFt * 12 + w.lengthInches;
      const isHorizontal = w.orientation === 'horizontal';
      return { x, y, w: isHorizontal ? len : w.thicknessIn, h: isHorizontal ? w.thicknessIn : len };
    })
  ];

  if (shape === 'rectangle') {
    allElements.push({ x: 0, y: 0, w: widthIn, h: lengthIn });
  } else if (shape === 'l-shape') {
    allElements.push({ x: 0, y: 0, w: widthIn, h: lengthIn });
  } else if (shape === 'u-shape') {
    allElements.push({ x: 0, y: 0, w: uWallsIn.w1, h: Math.max(uWallsIn.w2, uWallsIn.w8) });
  } else if (shape === 'h-shape') {
    allElements.push({ x: 0, y: 0, w: widthIn, h: lengthIn });
  } else if (shape === 't-shape') {
    allElements.push({ x: 0, y: 0, w: tTopWidthIn, h: tTopLengthIn + tStemLengthIn });
  }

  allElements.forEach(w => {
    maxX = Math.max(maxX, w.x + (w.w || 0));
    maxY = Math.max(maxY, w.y + (w.h || 0));
  });

  // Ensure minimum canvas size (20ft x 20ft)
  maxX = Math.max(maxX, 240);
  maxY = Math.max(maxY, 240);

  interiorWalls.forEach(wall => {
    const wallFloor = wall.floorIndex || 0;
    const x = wall.xFt * 12 + wall.xInches;
    const y = wall.yFt * 12 + wall.yInches;
    const len = wall.lengthFt * 12 + wall.lengthInches;
    const isHorizontal = wall.orientation === 'horizontal';
    
    let w = isHorizontal ? len : wall.thicknessIn;
    let h = isHorizontal ? wall.thicknessIn : len;
    let finalX = x;
    let finalY = y;

    if (w < 0) {
      finalX += w;
      w = Math.abs(w);
    }
    if (h < 0) {
      finalY += h;
      h = Math.abs(h);
    }

    if (wallFloor === currentFloorIndex - 1) {
      ghostWalls.push({
        id: `ghost-int-${wall.id}`,
        x: finalX,
        y: finalY,
        w,
        h,
        isHorizontal,
        type: 'interior'
      });
    }

    if (wallFloor !== currentFloorIndex) return;

    dimensions.push({
      x1: finalX,
      y1: finalY + (isHorizontal ? wall.thicknessIn : 0),
      x2: finalX + (isHorizontal ? w : 0),
      y2: finalY + (isHorizontal ? wall.thicknessIn : h),
      label: formatDim(len),
      offset: 10,
      isHorizontal
    });

    // X placement
    if (finalX > 0) {
      dimensions.push({
        x1: 0,
        y1: finalY + (isHorizontal ? wall.thicknessIn / 2 : 0),
        x2: finalX,
        y2: finalY + (isHorizontal ? wall.thicknessIn / 2 : 0),
        label: formatDim(finalX),
        offset: isHorizontal ? -10 : -10,
        isHorizontal: true,
        isPlacement: true
      });
    }

    // Y placement
    if (finalY > 0) {
      dimensions.push({
        x1: finalX + (isHorizontal ? 0 : wall.thicknessIn / 2),
        y1: 0,
        x2: finalX + (isHorizontal ? 0 : wall.thicknessIn / 2),
        y2: finalY,
        label: formatDim(finalY),
        offset: isHorizontal ? -10 : -10,
        isHorizontal: false,
        isPlacement: true
      });
    }
  });

  exteriorWalls.forEach(wall => {
    if ((wall.floorIndex || 0) !== currentFloorIndex) return;
    const x = wall.xFt * 12 + wall.xInches;
    const y = wall.yFt * 12 + wall.yInches;
    const len = wall.lengthFt * 12 + wall.lengthInches;
    const isHorizontal = wall.orientation === 'horizontal';
    
    // Compute the same visual position as the wall rect (accounting for exteriorSide offset)
    let visualX = x;
    let visualY = y;
    if (isHorizontal) {
      if (wall.exteriorSide === 1) visualY -= wall.thicknessIn;
    } else {
      if (wall.exteriorSide === 1) visualX -= wall.thicknessIn;
    }
    
    // Length Dimension — aligned with the visual wall rect
    dimensions.push({
      x1: isHorizontal ? visualX : visualX + wall.thicknessIn,
      y1: isHorizontal ? visualY + wall.thicknessIn : visualY,
      x2: isHorizontal ? visualX + len : visualX + wall.thicknessIn,
      y2: isHorizontal ? visualY + wall.thicknessIn : visualY + len,
      label: formatDim(len),
      offset: 12,
      isHorizontal
    });

    // X placement
    if (visualX > 0) {
      dimensions.push({
        x1: 0,
        y1: visualY + (isHorizontal ? wall.thicknessIn / 2 : 0),
        x2: visualX,
        y2: visualY + (isHorizontal ? wall.thicknessIn / 2 : 0),
        label: formatDim(visualX),
        offset: -12,
        isHorizontal: true,
        isPlacement: true
      });
    }

    // Y placement
    if (visualY > 0) {
      dimensions.push({
        x1: visualX + (isHorizontal ? 0 : wall.thicknessIn / 2),
        y1: 0,
        x2: visualX + (isHorizontal ? 0 : wall.thicknessIn / 2),
        y2: visualY,
        label: formatDim(visualY),
        offset: -12,
        isHorizontal: false,
        isPlacement: true
      });
    }
  });

  [...doors, ...windows].forEach(opening => {
    if ((opening.floorIndex || 0) !== currentFloorIndex) return;
    const isDoor = 'heightIn' in opening;
    const wallId = opening.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    const intWall = interiorWalls.find(w => w.id === wallId);
    
    let x = 0;
    let y = 0;
    let isHorizontal = true;
    let wallStartX = 0;
    let wallStartY = 0;
    
    const ox = opening.xFt * 12 + opening.xInches;
    const ow = opening.widthIn;

    if (extWall) {
      isHorizontal = extWall.isHorizontal;
      wallStartX = extWall.x;
      wallStartY = extWall.y;
      if (isHorizontal) {
        x = extWall.x + ox;
        y = extWall.y;
      } else {
        x = extWall.x;
        y = extWall.y + ox;
      }
    } else if (intWall) {
      isHorizontal = intWall.orientation === 'horizontal';
      wallStartX = intWall.xFt * 12 + intWall.xInches;
      wallStartY = intWall.yFt * 12 + intWall.yInches;
      if (isHorizontal) {
        x = wallStartX + ox;
        y = wallStartY;
      } else {
        x = wallStartX;
        y = wallStartY + ox;
      }
    } else {
      return;
    }

    const offsetVal = isHorizontal ? (extWall && extWall.y === 0 ? -10 : 10) : (extWall && extWall.x === 0 ? -10 : 10);

    dimensions.push({
      x1: x,
      y1: y,
      x2: x + (isHorizontal ? ow : 0),
      y2: y + (isHorizontal ? 0 : ow),
      label: formatDim(ow),
      offset: offsetVal,
      isHorizontal,
      isOpening: true
    });

    if (ox > 0) {
      dimensions.push({
        x1: wallStartX,
        y1: wallStartY,
        x2: isHorizontal ? x : wallStartX,
        y2: isHorizontal ? wallStartY : y,
        label: formatDim(ox),
        offset: offsetVal,
        isHorizontal,
        isPlacement: true
      });
    }
  });

  // Bumpout Dimensions
  bumpouts.forEach(b => {
    if ((b.floorIndex || 0) !== currentFloorIndex) return;
    const wallId = b.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    if (!extWall) return;

    const bx = b.xFt * 12 + b.xInches;
    const bw = b.widthIn;
    const bd = b.depthIn;
    const t = thicknessIn;

    const isHorizontal = extWall.isHorizontal;
    const offsetVal = isHorizontal ? (extWall.exteriorSide === 1 ? 15 : -15) : (extWall.exteriorSide === 1 ? 15 : -15);

    if (isHorizontal) {
      const x = extWall.x + bx;
      const y = extWall.y + extWall.exteriorSide * (bd - t);
      // Width
      dimensions.push({
        x1: x,
        y1: y,
        x2: x + bw,
        y2: y,
        label: formatDim(bw),
        offset: offsetVal,
        isHorizontal: true,
        isOpening: true
      });
      // Depth
      dimensions.push({
        x1: x,
        y1: extWall.y,
        x2: x,
        y2: y,
        label: formatDim(bd),
        offset: -10,
        isHorizontal: false,
        isPlacement: true
      });
    } else {
      const x = extWall.x + extWall.exteriorSide * (bd - t);
      const y = extWall.y + bx;
      // Width (along the wall)
      dimensions.push({
        x1: x,
        y1: y,
        x2: x,
        y2: y + bw,
        label: formatDim(bw),
        offset: offsetVal,
        isHorizontal: false,
        isOpening: true
      });
      // Depth
      dimensions.push({
        x1: extWall.x,
        y1: y,
        x2: x,
        y2: y,
        label: formatDim(bd),
        offset: -10,
        isHorizontal: true,
        isPlacement: true
      });
    }
  });

  // Calculate bounding box center
  const cx = maxX / 2;
  const cy = maxY / 2;
  
  // Base view size (max dimension + padding)
  const padding = 36;
  const baseSize = Math.max(maxX, maxY) + padding * 2; // 6ft padding
  
  // Stabilize view when house dimensions change
  useEffect(() => {
    if (prevBaseSize.current !== null && prevCx.current !== null && prevCy.current !== null) {
      if (Math.abs(prevBaseSize.current - baseSize) > 0.1 || Math.abs(prevCx.current - cx) > 0.1 || Math.abs(prevCy.current - cy) > 0.1) {
        const scaleFactor = baseSize / prevBaseSize.current;
        const dx = cx - prevCx.current;
        const dy = cy - prevCy.current;

        setTargetZoom(prev => {
          const newVal = prev * scaleFactor;
          setZoom(newVal);
          zoomRef.current = newVal;
          return newVal;
        });
        
        setTargetPan(prev => {
          const newVal = { x: prev.x + dx, y: prev.y + dy };
          setPan(newVal);
          panRef.current = newVal;
          return newVal;
        });
      }
    }
    prevBaseSize.current = baseSize;
    prevCx.current = cx;
    prevCy.current = cy;
  }, [baseSize, cx, cy]);

  useEffect(() => {
    const currentPdf = pdfImages[selectedPdfIndex];
    if (currentPdf && currentPdf !== lastZoomedPdf.current) {
      let currentAspect = svgAspect;
      if (svgRef.current) {
        const { width, height } = svgRef.current.getBoundingClientRect();
        if (height > 0) currentAspect = width / height;
      } else if (typeof window !== 'undefined') {
        currentAspect = window.innerWidth / window.innerHeight;
      }
      
      const img = new Image();
      img.onload = () => {
        const imgAspect = img.width / img.height;
        const pdfW = 1200 * pdfScale;
        const pdfH = pdfW / imgAspect;
        
        let targetViewSize = Math.min(pdfW, pdfH);
        if (currentAspect > 1) {
          targetViewSize = Math.min(pdfW / currentAspect, pdfH);
        } else {
          targetViewSize = Math.min(pdfW, pdfH * currentAspect);
        }
        
        const newZoom = Math.max(0.1, Math.min(10, baseSize / targetViewSize));
        
        setTargetZoom(newZoom);
        setTargetPan({
          x: cx - (pdfOffset.x + pdfW / 2),
          y: cy - (pdfOffset.y + pdfH / 2)
        });
        
        lastZoomedPdf.current = currentPdf;
      };
      img.src = currentPdf;
    }
  }, [pdfImages, selectedPdfIndex, pdfScale, pdfOffset, baseSize, cx, cy, svgAspect]);

  // Apply zoom
  const viewSize = baseSize / zoom;
  
  // Calculate view box origin (top-left) based on center and pan
  let viewWidth = viewSize;
  let viewHeight = viewSize;
  if (svgAspect > 1) {
    viewWidth = viewSize * svgAspect;
  } else {
    viewHeight = viewSize / svgAspect;
  }
  const vx = cx - (viewWidth / 2) - pan.x;
  const vy = cy - (viewHeight / 2) - pan.y;
  
  const viewBox = `${vx} ${vy} ${viewWidth} ${viewHeight}`;

  const getSvgPoint = (e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      setTargetZoom(z => Math.max(0.1, Math.min(10, z * scale)));
    } else {
      // Pan
      let ratio = 1;
      if (svgRef.current) {
        const { width } = svgRef.current.getBoundingClientRect();
        ratio = viewWidth / width;
      }
      setTargetPan(p => ({ x: p.x - e.deltaX * ratio, y: p.y - e.deltaY * ratio }));
    }
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    // Deselect asset when clicking background
    if (selectedAssetId && e.button === 0 && !e.altKey && !isSpaceDown && !isPanMode && !isZoomSelectionMode && !e.shiftKey) {
      setSelectedAssetId(null);
    }
    // Deselect wall when clicking background
    if (selectedWallId && e.button === 0 && !e.altKey && !isSpaceDown && !isPanMode && !isZoomSelectionMode && !e.shiftKey) {
      setSelectedWallId(null);
      setSelectedWallType(null);
    }
    if ((isZoomSelectionMode || e.shiftKey) && e.button === 0) {
      e.preventDefault();
      const pt = getSvgPoint(e);
      setZoomSelectionStart(pt);
      setZoomSelectionEnd(pt);
      return;
    }
    if (e.button === 1 || (e.button === 0 && (e.altKey || isSpaceDown || isPanMode))) { // Middle click, Alt+Click, or Space+Click or Pan Mode
      e.preventDefault();
      setIsPanning(true);
    }
  };

  const handleCalibrationClick = (e: React.MouseEvent) => {
    const pt = mousePos;
    
    if (!pdfCalibration.p1) {
      setPdfCalibration({ ...pdfCalibration, p1: pt });
    } else if (!pdfCalibration.p2) {
      // Always set p2 to trigger the popup in App.tsx
      const locked = getLockedPoint(pdfCalibration.p1, pt);
      setPdfCalibration({ ...pdfCalibration, p2: { x: locked.x, y: locked.y } });
    }
  };

  const handleMouseDown = (e: React.MouseEvent, wall: InteriorWallConfig | ExteriorWallConfig, type: 'interior' | 'exterior') => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    const wallX = wall.xFt * 12 + wall.xInches;
    const wallY = wall.yFt * 12 + wall.yInches;
    setDragOffset({ x: pt.x - wallX, y: pt.y - wallY });
    setDragStartPt({ x: pt.x, y: pt.y });
    setDragAxis(null);
    setDraggingWall({ id: wall.id, type, initialY: wallY });
    setSelectedWallId(wall.id);
    setSelectedWallType(type);
    if (onWallSelect) onWallSelect(wall.id, type);
  };

  const handleOpeningMouseDown = (e: React.MouseEvent, opening: DoorConfig | WindowConfig, type: 'door' | 'window', x: number, y: number) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    const wallId = opening.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    const intWall = interiorWalls.find(w => w.id === wallId);
    let isHorizontal = true;
    if (extWall) isHorizontal = extWall.isHorizontal;
    else if (intWall) isHorizontal = intWall.orientation === 'horizontal';

    const ox = opening.xFt * 12 + opening.xInches;

    // We only care about the offset along the wall's axis
    if (isHorizontal) {
      setDragOffset({ x: pt.x - ox, y: 0 });
    } else {
      setDragOffset({ x: 0, y: pt.y - ox });
    }
    setDragStartPt({ x: pt.x, y: pt.y });
    setDraggingOpening({ id: opening.id, type, initialOx: ox });
  };

  const handleBumpoutMouseDown = (e: React.MouseEvent, bumpout: BumpoutConfig) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    const wallId = bumpout.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    let isHorizontal = true;
    if (extWall) isHorizontal = extWall.isHorizontal;

    const ox = isHorizontal ? (bumpout.xFt * 12 + bumpout.xInches) : (bumpout.yFt * 12 + bumpout.yInches);

    if (isHorizontal) {
      setDragOffset({ x: pt.x - ox, y: 0 });
    } else {
      setDragOffset({ x: 0, y: pt.y - ox });
    }
    setDragStartPt({ x: pt.x, y: pt.y });
    setDraggingBumpout({ id: bumpout.id, initialOx: ox });
  };

  const handleCameraMouseDown = (e: React.MouseEvent, cam: CustomCamera) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    setDraggingCameraId(cam.id);
    setSelectedCameraId(cam.id);
    setSelectedAssetId(null);
    setDragOffset({ x: pt.x - cam.x, y: pt.y - cam.y });
  };

  const handleCameraRotateMouseDown = (e: React.MouseEvent, cam: CustomCamera) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    setRotatingCameraId(cam.id);
  };

  const handleAssetMouseDown = (e: React.MouseEvent, asset: InteriorAsset) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    setDraggingAssetId(asset.id);
    setSelectedAssetId(asset.id);
    setSelectedCameraId(null);
    setDragOffset({ x: pt.x - asset.x, y: pt.y - asset.y });
    setDragStartPt(pt);
    setDragAxis(null);
  };

  const handleAssetRotateMouseDown = (e: React.MouseEvent, asset: InteriorAsset) => {
    if (isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    setRotatingAssetId(asset.id);
  };

  const handlePdfMouseDown = (e: React.MouseEvent) => {
    if (isBlueprintLocked || isCalibrating || isZoomSelectionMode || e.button === 1 || isSpaceDown || isPanMode) return;
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    setDraggingPdf(true);
    setDragOffset({ x: pt.x - pdfOffset.x, y: pt.y - pdfOffset.y });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const pt = getSvgPoint(e);
      
      if (isPanning) {
        if (svgRef.current) {
          const { width } = svgRef.current.getBoundingClientRect();
          const ratio = viewWidth / width;
          setTargetPan(p => ({ x: p.x + e.movementX * ratio, y: p.y + e.movementY * ratio }));
        }
        setMousePos(pt);
        return;
      }

      if (zoomSelectionStart) {
        let dx = pt.x - zoomSelectionStart.x;
        let dy = pt.y - zoomSelectionStart.y;
        
        // Constrain selection box to match the viewport's aspect ratio
        let signX = Math.sign(dx) || 1;
        let signY = Math.sign(dy) || 1;
        if (Math.abs(dx) > Math.abs(dy) * svgAspect) {
          dy = signY * Math.abs(dx) / svgAspect;
        } else {
          dx = signX * Math.abs(dy) * svgAspect;
        }
        
        setZoomSelectionEnd({ x: zoomSelectionStart.x + dx, y: zoomSelectionStart.y + dy });
        return;
      }

      if (isCalibrating) {
        const snapDist = 10;
        const snapPointsX = getSnapPoints('x');
        const snapPointsY = getSnapPoints('y');
        
        let targetX = pt.x;
        let targetY = pt.y;
        const newSnapLines: { axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[] = [];
        
        // Only snap if NOT holding Alt AND we are in "Tape Measure" mode
        if (!e.altKey && appliedCalibration && isRulerMode) {
          for (const p of snapPointsX) {
            if (Math.abs(pt.x - p.pos) < snapDist) {
              targetX = p.pos;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }
          for (const p of snapPointsY) {
            if (Math.abs(pt.y - p.pos) < snapDist) {
              targetY = p.pos;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }
        }
        
        setMousePos({ x: targetX, y: targetY });
        setSnapLines(newSnapLines);
        return;
      }

      setMousePos(pt);
      if (snapLines.length > 0) setSnapLines([]);

      if (draggingWall) {
        const wall = draggingWall.type === 'interior' 
          ? interiorWalls.find(w => w.id === draggingWall.id)
          : exteriorWalls.find(w => w.id === draggingWall.id);
        
        if (!wall) return;

        // Determine drag axis if not set
        let currentDragAxis = dragAxis;
        if (!currentDragAxis) {
          const dx = Math.abs(pt.x - dragStartPt.x);
          const dy = Math.abs(pt.y - dragStartPt.y);
          if (dx > 5 || dy > 5) {
            currentDragAxis = dx > dy ? 'x' : 'y';
            setDragAxis(currentDragAxis);
          } else {
            return; // Wait until threshold is met
          }
        }

        let newX = wall.xFt * 12 + wall.xInches;
        let newY = wall.yFt * 12 + wall.yInches;

        if (currentDragAxis === 'x') {
          newX = pt.x - dragOffset.x;
        } else {
          newY = pt.y - dragOffset.y;
        }

        // Snapping logic
        const snapDist = 12; // Snap within 12 inches
        const snapPointsX = getSnapPoints('x', wall.id);
        const snapPointsY = getSnapPoints('y', wall.id);
        
        const wallLen = wall.lengthFt * 12 + wall.lengthInches;
        const wallTh = wall.thicknessIn;
        const w = wall.orientation === 'horizontal' ? wallLen : wallTh;
        const h = wall.orientation === 'vertical' ? wallLen : wallTh;

        let snappedX = false;
        let snappedY = false;
        const newSnapLines: { axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[] = [];

        // Try snapping X (left or right edge)
        if (!e.altKey) {
          for (const p of snapPointsX) {
            if (Math.abs(newX - p.pos) < snapDist) {
              newX = p.pos;
              snappedX = true;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            if (Math.abs((newX + w) - p.pos) < snapDist) {
              newX = p.pos - w;
              snappedX = true;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap center to midpoint
            if (p.type === 'mid' && Math.abs((newX + w / 2) - p.pos) < snapDist) {
              newX = p.pos - w / 2;
              snappedX = true;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }

          // Try snapping Y (top or bottom edge)
          for (const p of snapPointsY) {
            if (Math.abs(newY - p.pos) < snapDist) {
              newY = p.pos;
              snappedY = true;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            if (Math.abs((newY + h) - p.pos) < snapDist) {
              newY = p.pos - h;
              snappedY = true;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap center to midpoint
            if (p.type === 'mid' && Math.abs((newY + h / 2) - p.pos) < snapDist) {
              newY = p.pos - h / 2;
              snappedY = true;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }
        }

        setSnapLines(newSnapLines);

        // Constrain to positive coordinates roughly
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);

        const totalInchesX = Math.round(newX);
        const totalInchesY = Math.round(newY);

        const updates = {
          xFt: Math.floor(totalInchesX / 12),
          xInches: totalInchesX % 12,
          yFt: Math.floor(totalInchesY / 12),
          yInches: totalInchesY % 12
        };

        if (draggingWall.type === 'interior') {
          updateInteriorWallFields(wall.id, updates);
        } else {
          updateExteriorWallFields(wall.id, updates);
        }
      } else if (draggingOpening !== null) {
        const pt = getSvgPoint(e);
        const isDoor = draggingOpening.type === 'door';
        const opening = isDoor 
          ? doors.find(d => d.id === draggingOpening.id)
          : windows.find(w => w.id === draggingOpening.id);
        
        if (!opening) return;

        const wallId = opening.wall;
        const extWall = extWalls.find(w => w.id === wallId);
        const intWall = interiorWalls.find(w => w.id === wallId);
        
        let isHorizontal = true;
        let wallLen = 0;
        let wallStartX = 0;
        let wallStartY = 0;
        
        if (extWall) {
          isHorizontal = extWall.isHorizontal;
          wallLen = isHorizontal ? extWall.w : extWall.h;
          wallStartX = extWall.x;
          wallStartY = extWall.y;
        } else if (intWall) {
          isHorizontal = intWall.orientation === 'horizontal';
          wallLen = intWall.lengthFt * 12 + intWall.lengthInches;
          wallStartX = intWall.xFt * 12 + intWall.xInches;
          wallStartY = intWall.yFt * 12 + intWall.yInches;
        } else {
          return;
        }

        let newOx = 0;
        if (isHorizontal) {
          newOx = pt.x - dragOffset.x;
        } else {
          newOx = pt.y - dragOffset.y;
        }

        // Snapping logic
        const snapDist = 12; // Snap within 12 inches
        const axis = isHorizontal ? 'x' : 'y';
        const snapPoints = getSnapPoints(axis, undefined, opening.id);
        const ow = opening.widthIn;
        const newSnapLines: { axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[] = [];
        
        // Calculate absolute position
        let absPos = isHorizontal ? wallStartX + newOx : wallStartY + newOx;
        
        for (const p of snapPoints) {
          // Snap left/top edge
          if (Math.abs(absPos - p.pos) < snapDist) {
            absPos = p.pos;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
          // Snap right/bottom edge
          if (Math.abs((absPos + ow) - p.pos) < snapDist) {
            absPos = p.pos - ow;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
          // Snap center to midpoint
          if (p.type === 'mid' && Math.abs((absPos + ow / 2) - p.pos) < snapDist) {
            absPos = p.pos - ow / 2;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
        }
        
        setSnapLines(newSnapLines);
        
        newOx = absPos - (isHorizontal ? wallStartX : wallStartY);

        // Constrain to wall bounds
        newOx = Math.max(0, Math.min(newOx, wallLen - opening.widthIn));

        const totalInchesO = Math.round(newOx);

        const updates = {
          xFt: Math.floor(totalInchesO / 12),
          xInches: totalInchesO % 12
        };

        if (isDoor) {
          updateDoorFields(opening.id, updates);
        } else {
          updateWindowFields(opening.id, updates);
        }
      } else if (draggingBumpout !== null) {
        const pt = getSvgPoint(e);
        const bumpout = bumpouts.find(b => b.id === draggingBumpout.id);
        if (!bumpout) return;

        const wallId = bumpout.wall;
        const extWall = extWalls.find(w => w.id === wallId);
        if (!extWall) return;

        const isHorizontal = extWall.isHorizontal;
        const wallLen = isHorizontal ? extWall.w : extWall.h;
        const wallStartX = extWall.x;
        const wallStartY = extWall.y;

        let newOx = 0;
        if (isHorizontal) {
          newOx = pt.x - dragOffset.x;
        } else {
          newOx = draggingBumpout.initialOx + (pt.y - dragStartPt.y);
        }

        // Snapping logic
        const snapDist = 12;
        const axis = isHorizontal ? 'x' : 'y';
        const snapPoints = getSnapPoints(axis, undefined, bumpout.id);
        const bw = bumpout.widthIn;
        const newSnapLines: { axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[] = [];
        
        // Calculate absolute position
        let absPos = isHorizontal ? wallStartX + newOx : wallStartY + newOx;
        
        for (const p of snapPoints) {
          if (Math.abs(absPos - p.pos) < snapDist) {
            absPos = p.pos;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
          if (Math.abs((absPos + bw) - p.pos) < snapDist) {
            absPos = p.pos - bw;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
          // Snap center to midpoint
          if (p.type === 'mid' && Math.abs((absPos + bw / 2) - p.pos) < snapDist) {
            absPos = p.pos - bw / 2;
            newSnapLines.push({ axis, pos: p.pos, crossPos: p.crossPos, type: p.type });
            break;
          }
        }
        
        setSnapLines(newSnapLines);
        newOx = absPos - (isHorizontal ? wallStartX : wallStartY);

        // Constrain to wall bounds
        newOx = Math.max(0, Math.min(newOx, wallLen - bumpout.widthIn));

        const totalInchesO = Math.round(newOx);

        const updates = {
          xFt: Math.floor(totalInchesO / 12),
          xInches: totalInchesO % 12
        };

        updateBumpoutFields(bumpout.id, updates);
      } else if (draggingCameraId !== null) {
        const pt = getSvgPoint(e);
        const cam = customCameras.find(c => c.id === draggingCameraId);
        if (!cam) return;
        
        let newX = pt.x - dragOffset.x;
        let newY = pt.y - dragOffset.y;
        
        setCustomCameras(prev => prev.map(c => c.id === cam.id ? { ...c, x: newX, y: newY } : c));
      } else if (rotatingCameraId !== null) {
        const pt = getSvgPoint(e);
        const cam = customCameras.find(c => c.id === rotatingCameraId);
        if (!cam) return;
        
        const dx = pt.x - cam.x;
        const dy = pt.y - cam.y;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (e.shiftKey) {
          angle = Math.round(angle / 45) * 45;
        }
        
        setCustomCameras(prev => prev.map(c => c.id === cam.id ? { ...c, rotation: angle } : c));
      } else if (draggingAssetId !== null) {
        const pt = getSvgPoint(e);
        const asset = assets.find(a => a.id === draggingAssetId);
        if (!asset) return;

        // Axis-constrained dragging (unless Alt is held for free movement)
        let currentDragAxis = dragAxis;
        if (!e.altKey) {
          if (!currentDragAxis) {
            const dx = Math.abs(pt.x - dragStartPt.x);
            const dy = Math.abs(pt.y - dragStartPt.y);
            if (dx > 5 || dy > 5) {
              currentDragAxis = dx > dy ? 'x' : 'y';
              setDragAxis(currentDragAxis);
            } else {
              return; // Wait until threshold is met
            }
          }
        } else {
          // Alt held — allow free movement, clear any locked axis
          currentDragAxis = null;
          if (dragAxis !== null) setDragAxis(null);
        }

        let newX = currentDragAxis === 'y' ? asset.x : pt.x - dragOffset.x;
        let newY = currentDragAxis === 'x' ? asset.y : pt.y - dragOffset.y;

        // Snap to wall / opening endpoints
        const snapDist = 12;
        const assetW = (asset.widthIn || 24) * asset.scale;
        const assetD = (asset.depthIn || 24) * asset.scale;
        const snapPointsX = getSnapPoints('x');
        const snapPointsY = getSnapPoints('y');
        const newSnapLines: { axis: 'x' | 'y', pos: number, crossPos?: number, type?: 'end' | 'mid' }[] = [];

        if (currentDragAxis !== 'y') {
          for (const p of snapPointsX) {
            // Snap center
            if (Math.abs(newX - p.pos) < snapDist) {
              newX = p.pos;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap left edge
            if (Math.abs((newX - assetW / 2) - p.pos) < snapDist) {
              newX = p.pos + assetW / 2;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap right edge
            if (Math.abs((newX + assetW / 2) - p.pos) < snapDist) {
              newX = p.pos - assetW / 2;
              newSnapLines.push({ axis: 'x', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }
        }

        if (currentDragAxis !== 'x') {
          for (const p of snapPointsY) {
            // Snap center
            if (Math.abs(newY - p.pos) < snapDist) {
              newY = p.pos;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap top edge
            if (Math.abs((newY - assetD / 2) - p.pos) < snapDist) {
              newY = p.pos + assetD / 2;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
            // Snap bottom edge
            if (Math.abs((newY + assetD / 2) - p.pos) < snapDist) {
              newY = p.pos - assetD / 2;
              newSnapLines.push({ axis: 'y', pos: p.pos, crossPos: p.crossPos, type: p.type });
              break;
            }
          }
        }

        setSnapLines(newSnapLines);
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, x: newX, y: newY } : a));
      } else if (rotatingAssetId !== null) {
        const pt = getSvgPoint(e);
        const asset = assets.find(a => a.id === rotatingAssetId);
        if (!asset) return;
        
        const dx = pt.x - asset.x;
        const dy = pt.y - asset.y;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (e.altKey) {
          // Alt held — free rotation, no snapping
        } else if (e.shiftKey) {
          // Shift — snap to 45° increments
          angle = Math.round(angle / 45) * 45;
        } else {
          // Default — snap to 90° (axis-aligned)
          angle = Math.round(angle / 90) * 90;
        }
        
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, rotation: angle } : a));
      } else if (draggingPdf) {
        const pt = getSvgPoint(e);
        setPdfOffset({
          x: pt.x - dragOffset.x,
          y: pt.y - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      if (zoomSelectionStart && zoomSelectionEnd) {
        const x1 = Math.min(zoomSelectionStart.x, zoomSelectionEnd.x);
        const y1 = Math.min(zoomSelectionStart.y, zoomSelectionEnd.y);
        const x2 = Math.max(zoomSelectionStart.x, zoomSelectionEnd.x);
        const y2 = Math.max(zoomSelectionStart.y, zoomSelectionEnd.y);
        
        const w = x2 - x1;
        const h = y2 - y1;
        
        if (w > 5 && h > 5) {
          let targetViewSize = Math.max(w, h);
          if (svgRef.current) {
            const { width: svgW, height: svgH } = svgRef.current.getBoundingClientRect();
            const svgAspect = svgW / svgH;
            if (svgAspect > 1) {
              targetViewSize = Math.max(w / svgAspect, h);
            } else {
              targetViewSize = Math.max(w, h * svgAspect);
            }
          }
          
          const newZoom = Math.max(0.1, Math.min(10, baseSize / targetViewSize));
          
          const scx = (x1 + x2) / 2;
          const scy = (y1 + y2) / 2;
          
          setTargetZoom(newZoom);
          setTargetPan({
            x: cx - scx,
            y: cy - scy
          });
        }
        
        setZoomSelectionStart(null);
        setZoomSelectionEnd(null);
        setIsZoomSelectionMode(false);
      }

      setDraggingWall(null);
      setDraggingOpening(null);
      setDraggingBumpout(null);
      setDraggingCameraId(null);
      setRotatingCameraId(null);
      setDraggingAssetId(null);
      setRotatingAssetId(null);
      setDraggingPdf(false);
      setDragAxis(null);
      setSnapLines([]);
      setIsPanning(false);
    };

    if (draggingWall !== null || draggingOpening !== null || draggingBumpout !== null || draggingCameraId !== null || rotatingCameraId !== null || draggingAssetId !== null || rotatingAssetId !== null || draggingPdf || isPanning || isCalibrating || isSpaceDown || isZoomSelectionMode || zoomSelectionStart !== null || isPanMode) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseUp);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftDown(true);
      }
      if (e.key === 'Control') {
        setIsCtrlDown(true);
      }
      if (e.code === 'Space') {
        if (!isSpaceDown) setIsSpaceDown(true);
        // Prevent scrolling
        if (document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
        }
      }
      if (e.key.toLowerCase() === 'm' && document.activeElement?.tagName !== 'INPUT') {
        setIsMagnifierActive(prev => !prev);
      }
      if (e.key.toLowerCase() === 'f' && document.activeElement?.tagName !== 'INPUT') {
        if (isFullscreen || zoom > 1) {
          setIsFullscreen(false);
          setTargetZoom(1);
          setPan({ x: 0, y: 0 });
          setTargetPan({ x: 0, y: 0 });
        } else {
          setIsFullscreen(true);
        }
      }
      if (e.key.toLowerCase() === 't' && document.activeElement?.tagName !== 'INPUT') {
        const newCalib = !isCalibrating;
        setIsCalibrating(newCalib);
        setIsRulerMode(newCalib);
        if (!newCalib) {
          setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
        }
      }
      if (e.key.toLowerCase() === 'z' && document.activeElement?.tagName !== 'INPUT') {
        setIsZoomSelectionMode(prev => !prev);
      }
      if (e.key.toLowerCase() === 'h' && document.activeElement?.tagName !== 'INPUT') {
        setIsPanMode(prev => !prev);
      }
      if ((e.key === '=' || e.key === '+') && document.activeElement?.tagName !== 'INPUT') {
        setTargetZoom(z => Math.min(10, z * 1.2));
      }
      if ((e.key === '-' || e.key === '_') && document.activeElement?.tagName !== 'INPUT') {
        setTargetZoom(z => Math.max(0.1, z / 1.2));
      }
      if (e.key === '0' && document.activeElement?.tagName !== 'INPUT') {
        setTargetZoom(0.8);
        setTargetPan({ x: 0, y: 0 });
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && document.activeElement?.tagName !== 'INPUT') {
        if (selectedAssetId) {
          setAssets(prev => prev.filter(a => a.id !== selectedAssetId));
          setSelectedAssetId(null);
        } else if (isCalibrating && pdfCalibration.p1 && !pdfCalibration.p2) {
          setPdfCalibration({ ...pdfCalibration, p1: null });
        } else if (guides.length > 0) {
          onDeleteLastGuide();
        }
      }
      // Arrow keys — move selected wall
      if (selectedWallId && selectedWallType && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const step = e.shiftKey ? 12 : 1; // 12 inches if shift is held, else 1 inch
        
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        const wall = selectedWallType === 'interior' 
          ? interiorWalls.find(w => w.id === selectedWallId)
          : exteriorWalls.find(w => w.id === selectedWallId);

        if (wall) {
            const currentXInches = wall.xFt * 12 + wall.xInches;
            const currentYInches = wall.yFt * 12 + wall.yInches;
            const newXInches = Math.max(0, currentXInches + dx);
            const newYInches = Math.max(0, currentYInches + dy);

            const updates = {
                xFt: Math.floor(newXInches / 12),
                xInches: newXInches % 12,
                yFt: Math.floor(newYInches / 12),
                yInches: newYInches % 12
            };

            if (selectedWallType === 'interior') {
                updateInteriorWallFields(wall.id, updates);
            } else {
                updateExteriorWallFields(wall.id, updates);
            }
        }
      }
      // Arrow keys — rotate selected asset
      if (selectedAssetId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const step = e.altKey ? 1 : e.shiftKey ? 45 : 90;
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        setAssets(prev => prev.map(a => a.id === selectedAssetId ? { ...a, rotation: a.rotation + dir * step } : a));
      }
      // Arrow keys — rotate selected camera
      if (selectedCameraId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const step = e.altKey ? 1 : e.shiftKey ? 45 : 90;
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        setCustomCameras(prev => prev.map(c => c.id === selectedCameraId ? { ...c, rotation: c.rotation + dir * step } : c));
      }
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        onSave?.();
      }
      if (e.key.toLowerCase() === 'o' && (e.ctrlKey || e.metaKey) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        onLoad?.();
      }
      if (e.key === 'Escape') {
        if (selectedAssetId) {
          setSelectedAssetId(null);
        } else if (selectedCameraId) {
          setSelectedCameraId(null);
        } else if (selectedWallId) {
          setSelectedWallId(null);
          setSelectedWallType(null);
        } else {
          setIsFullscreen(false);
          setTargetZoom(1);
          setPan({ x: 0, y: 0 });
          setTargetPan({ x: 0, y: 0 });
          setIsCalibrating(false);
          setIsZoomSelectionMode(false);
          setIsPanMode(false);
          setZoomSelectionStart(null);
          setZoomSelectionEnd(null);
          setDraggingWall(null);
          setDraggingOpening(null);
          setDraggingBumpout(null);
          setDraggingPdf(false);
          setIsMagnifierActive(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftDown(false);
      }
      if (e.code === 'Space') {
        setIsSpaceDown(false);
      }
      if (e.key === 'Control') {
        setIsCtrlDown(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isCalibrating || draggingWall || draggingOpening || draggingBumpout || draggingPdf || isZoomSelectionMode || zoomSelectionStart || isPanMode) {
        e.preventDefault();
        setIsCalibrating(false);
        setIsZoomSelectionMode(false);
        setIsPanMode(false);
        setZoomSelectionStart(null);
        setZoomSelectionEnd(null);
        setDraggingWall(null);
        setDraggingOpening(null);
        setDraggingBumpout(null);
        setDraggingPdf(false);
        setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [draggingWall, draggingOpening, draggingBumpout, draggingPdf, isPanning, isCalibrating, isRulerMode, isSpaceDown, isShiftDown, isZoomSelectionMode, zoomSelectionStart, zoomSelectionEnd, appliedCalibration, dragOffset, interiorWalls, doors, windows, bumpouts, getSnapPoints, updateInteriorWallFields, updateDoorFields, updateWindowFields, updateBumpoutFields, setPdfOffset, viewSize, viewWidth, svgAspect, setIsCalibrating, setPdfCalibration, baseSize, cx, cy, isPanMode, selectedAssetId, selectedCameraId]);

  return (
    <div className={`bg-white dark:bg-[#0f1424] shadow-lg border border-zinc-200 dark:border-[#1c2240] flex flex-col overflow-hidden select-none relative ${isFullscreen || zoom > 1 ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-full rounded-xl'}`}>
      {/* Floor Tabs */}
      {additionalStories > 0 && (
        <div className="flex items-center gap-1 p-2 bg-zinc-50 dark:bg-[#252526] border-b border-zinc-200 dark:border-[#1c2240] overflow-x-auto no-scrollbar">
          {Array.from({ length: additionalStories + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentFloorIndex(idx)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                currentFloorIndex === idx
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                  : 'bg-white dark:bg-[#151a2e] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#243052] border border-zinc-200 dark:border-[#243052]'
              }`}
            >
              Floor {idx + 1}
            </button>
          ))}
        </div>
      )}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-[#1c2240] flex items-center justify-between bg-zinc-50 dark:bg-[#252526]">
        <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
          <span className="text-sm font-medium">2D Floor Plan Preview</span>
          {pdfImages.length > 1 && (
            <div className="flex items-center gap-2 border-l border-zinc-300 dark:border-[#243052] pl-4">
              <button
                onClick={() => setSelectedPdfIndex(Math.max(0, selectedPdfIndex - 1))}
                disabled={selectedPdfIndex === 0}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-[#243052] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>
              <select 
                value={sanitize(selectedPdfIndex)}
                onChange={(e) => setSelectedPdfIndex(Number(e.target.value))}
                className="bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded text-[10px] font-mono px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-900 dark:text-white"
              >
                {pdfImages.map((_, idx) => (
                  <option key={idx} value={idx}>P. {idx + 1}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedPdfIndex(Math.min(pdfImages.length - 1, selectedPdfIndex + 1))}
                disabled={selectedPdfIndex === pdfImages.length - 1}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-[#243052] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-500">
          {isCalibrating 
            ? (appliedCalibration ? 'Tape Measure: Click two points. Hold ALT to bypass snapping.' : 'Calibration: Click two points on PDF to set scale.') 
            : 'Drag walls, doors, and windows to position them. Hold ALT to bypass snapping.'}
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-zinc-100 dark:bg-[#0f1424]/50 relative">
        {isBlueprintLocked && pdfImages.length > 0 && (
          <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-[#0f1424]/80 backdrop-blur-sm border border-zinc-200 dark:border-[#243052]/50 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg pointer-events-none">
            <Lock size={14} className="text-indigo-500 dark:text-indigo-400" />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Blueprint Locked</span>
          </div>
        )}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10 items-end">
          {/* Project Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'project' ? null : 'project')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'project' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="Project Tools"
            >
              <FolderOpen size={22} />
            </button>
            {activeToolbarGroup === 'project' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => onSave?.()}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center justify-center"
                  title="Save Project (Ctrl+S)"
                >
                  <Save size={22} />
                </button>
                <button 
                  onClick={() => onLoad?.()}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Load Project (Ctrl+O)"
                >
                  <FolderOpen size={22} />
                </button>
              </div>
            )}
          </div>

          {/* View Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'view' ? null : 'view')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'view' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="View Mode"
            >
              <Layers size={22} />
            </button>
            {activeToolbarGroup === 'view' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => setViewMode('floor')}
                  className={`p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] transition-colors flex items-center justify-center ${viewMode === 'floor' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title="Floor Plan"
                >
                  <Grid size={22} />
                </button>
                <button 
                  onClick={() => setViewMode('roof')}
                  className={`p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center ${viewMode === 'roof' ? 'text-pink-500 dark:text-pink-400' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title="Roof Plan"
                >
                  <Home size={22} />
                </button>
              </div>
            )}
          </div>

          {/* Tools Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'tools' ? null : 'tools')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'tools' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="Measurement & Edit Tools"
            >
              <Ruler size={22} />
            </button>
            {activeToolbarGroup === 'tools' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => setIsMagnifierActive(!isMagnifierActive)}
                  className={`p-4 transition-colors flex items-center justify-center ${isMagnifierActive ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title="Magnifier (M)"
                >
                  <Search size={22} />
                </button>
                <button 
                  onClick={() => {
                    const newCalib = !isCalibrating;
                    setIsCalibrating(newCalib);
                    setIsRulerMode(newCalib);
                    if (!newCalib) {
                      setPdfCalibration({ p1: null, p2: null, realLengthIn: 0 });
                    }
                  }}
                  className={`p-4 transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center ${isCalibrating ? 'bg-emerald-100 dark:bg-emerald-600 text-emerald-700 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title={appliedCalibration ? "Tape Measure Tool (T)" : "Measurement Tool (Calibrate Scale)"}
                >
                  <Ruler size={22} />
                </button>
                <button 
                  onClick={() => {
                    if (isCalibrating && pdfCalibration.p1 && !pdfCalibration.p2) {
                      setPdfCalibration({ ...pdfCalibration, p1: null });
                    } else {
                      onDeleteLastGuide();
                    }
                  }}
                  disabled={!guides.length && !(isCalibrating && pdfCalibration.p1)}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Delete Last (Guide or Point) (Backspace)"
                >
                  <Undo2 size={22} />
                </button>
                <button 
                  onClick={onClearGuides}
                  disabled={!guides.length}
                  className="p-4 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors disabled:opacity-20 disabled:cursor-not-allowed border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Clear All Guides"
                >
                  <Trash2 size={22} />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'nav' ? null : 'nav')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'nav' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="Navigation Tools"
            >
              <Hand size={22} />
            </button>
            {activeToolbarGroup === 'nav' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => setIsZoomSelectionMode(!isZoomSelectionMode)}
                  className={`p-4 transition-colors flex items-center justify-center ${isZoomSelectionMode ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title="Manual Zoom (Drag area to zoom) (Z)"
                >
                  <MousePointer2 size={22} />
                </button>
                <button 
                  onClick={() => setIsPanMode(!isPanMode)}
                  className={`p-4 transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center ${isPanMode ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                  title="Pan Tool (H)"
                >
                  <Hand size={22} />
                </button>
              </div>
            )}
          </div>

          {/* Zoom Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'zoom' ? null : 'zoom')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'zoom' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="Zoom Controls"
            >
              <ZoomIn size={22} />
            </button>
            {activeToolbarGroup === 'zoom' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => setTargetZoom(z => Math.max(0.1, z / 1.2))}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center justify-center"
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={22} />
                </button>
                <button 
                  onClick={() => { setTargetZoom(0.8); setTargetPan({ x: 0, y: 0 }); }}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Reset View (0)"
                >
                  <Focus size={22} />
                </button>
                <button 
                  onClick={() => setTargetZoom(z => Math.min(10, z * 1.2))}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Zoom In (+)"
                >
                  <ZoomIn size={22} />
                </button>
              </div>
            )}
          </div>

          {/* View Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => {
                if (isFullscreen || zoom > 1) {
                  setIsFullscreen(false);
                  setTargetZoom(1);
                  setPan({ x: 0, y: 0 });
                  setTargetPan({ x: 0, y: 0 });
                } else {
                  setIsFullscreen(true);
                }
              }}
              className={`p-4 transition-colors flex items-center justify-center ${isFullscreen || zoom > 1 ? 'bg-indigo-100 dark:bg-indigo-600 text-indigo-700 dark:text-white' : 'hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen || zoom > 1 ? <Minimize size={22} /> : <Maximize size={22} />}
            </button>
          </div>

          {/* Shapes Group */}
          <div className="bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-sm rounded-2xl border border-zinc-200 dark:border-[#243052] overflow-hidden flex flex-col w-14 shadow-xl dark:shadow-2xl">
            <button 
              onClick={() => setActiveToolbarGroup(activeToolbarGroup === 'shapes' ? null : 'shapes')}
              className={`p-4 transition-colors flex items-center justify-center ${activeToolbarGroup === 'shapes' ? 'bg-zinc-100 dark:bg-[#1c2240] text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-[#243052] hover:text-zinc-900 dark:hover:text-white'}`}
              title="Add & Combine Shapes"
            >
              <Square size={22} />
            </button>
            {activeToolbarGroup === 'shapes' && (
              <div className="flex flex-col border-t border-zinc-200 dark:border-[#243052] bg-zinc-50/50 dark:bg-[#0f1424]/50">
                <button 
                  onClick={() => {
                    const newBlock = {
                      id: `block-${Date.now()}`,
                      x: 120, // 10ft
                      y: 120, // 10ft
                      w: 240, // 20ft
                      h: 240, // 20ft
                    };
                    setShapeBlocks([...shapeBlocks, newBlock]);
                    setShape('custom');
                  }}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center justify-center"
                  title="Add Rectangle"
                >
                  <Square size={22} />
                </button>
                <button 
                  onClick={() => combineExteriorWalls()}
                  className="p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Combine Shapes (Union)"
                >
                  <Combine size={22} />
                </button>
                <button 
                  onClick={() => {
                    // Placeholder for roof combination logic
                    console.log("Combine Roof Parts");
                  }}
                  className="p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Combine Roof Parts"
                >
                  <Combine size={22} className="text-emerald-600" />
                </button>
                <button 
                  onClick={() => {
                    setShapeBlocks([]);
                    setExteriorWalls([]);
                    setShape('rectangle');
                  }}
                  className="p-4 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors border-t border-zinc-200/50 dark:border-[#243052]/50 flex items-center justify-center"
                  title="Clear All Shapes"
                >
                  <Trash2 size={22} />
                </button>
              </div>
            )}
          </div>
        </div>

        <svg 
          ref={svgRef}
          viewBox={viewBox} 
          className="w-full h-full drop-shadow-xl"
          style={{ cursor: isMagnifierActive ? 'none' : isPanning ? 'grabbing' : (isSpaceDown || isPanMode) ? 'grab' : (isZoomSelectionMode || zoomSelectionStart || isShiftDown) ? 'zoom-in' : isCalibrating ? 'crosshair' : draggingWall ? 'grabbing' : 'default' }}
          onClick={handleCalibrationClick}
          onWheel={handleWheel}
          onMouseDown={handleMouseDownPan}
          onMouseMove={(e) => {
            const pt = getSvgPoint(e);
            
            if (draggingBlockId) {
              const isRoofPart = roofParts.some(r => r.id === draggingBlockId);
              const isTrussRun = trussRuns.some(t => t.id === draggingBlockId);
              const isDormer = dormers.some(d => d.id === draggingBlockId);
              let newX = pt.x - dragOffset.x;
              let newY = pt.y - dragOffset.y;

              if (isShiftDown) {
                const dx = Math.abs(pt.x - dragStartPt.x);
                const dy = Math.abs(pt.y - dragStartPt.y);
                if (dx > dy) newY = dragStartPt.y - dragOffset.y;
                else newX = dragStartPt.x - dragOffset.x;
              }

              if (isRoofPart) {
                setRoofParts(prev => prev.map(r => 
                  r.id === draggingBlockId 
                    ? { ...r, x: newX, y: newY } 
                    : r
                ));
              } else if (isTrussRun) {
                setTrussRuns(prev => prev.map(t => 
                  t.id === draggingBlockId 
                    ? { ...t, x: newX, y: newY } 
                    : t
                ));
              } else if (isDormer) {
                setDormers(prev => prev.map(d => 
                  d.id === draggingBlockId 
                    ? { ...d, x: newX, y: newY } 
                    : d
                ));
              } else {
                setShapeBlocks(prev => prev.map(b => 
                  b.id === draggingBlockId 
                    ? { ...b, x: newX, y: newY } 
                    : b
                ));
              }
              return;
            }

            if (resizingBlockId && resizeHandle) {
              const isRoofPart = roofParts.some(r => r.id === resizingBlockId);
              const isTrussRun = trussRuns.some(t => t.id === resizingBlockId);
              const isDormer = dormers.some(d => d.id === resizingBlockId);
              if (isRoofPart) {
                setRoofParts(prev => prev.map(r => {
                  if (r.id !== resizingBlockId) return r;
                  const newPart = { ...r };
                  const isHoriz = r.ridgeDirection === 'horizontal';
                  
                  const w = isHoriz ? r.widthIn : r.lengthIn;
                  const l = isHoriz ? r.lengthIn : r.widthIn;
                  
                  const x_nw = r.x - w / 2;
                  const y_nw = r.y - l / 2;
                  const x_se = r.x + w / 2;
                  const y_se = r.y + l / 2;
                  
                  let newW = w;
                  let newL = l;
                  let newX = r.x;
                  let newY = r.y;
                  
                  if (resizeHandle === 'nw') {
                    newW = x_se - pt.x;
                    newL = y_se - pt.y;
                    newX = x_se - newW / 2;
                    newY = y_se - newL / 2;
                  } else if (resizeHandle === 'ne') {
                    newW = pt.x - (r.x - w / 2);
                    newL = y_se - pt.y;
                    newX = (r.x - w / 2) + newW / 2;
                    newY = y_se - newL / 2;
                  } else if (resizeHandle === 'sw') {
                    newW = x_se - pt.x;
                    newL = pt.y - (r.y - l / 2);
                    newX = x_se - newW / 2;
                    newY = (r.y - l / 2) + newL / 2;
                  } else if (resizeHandle === 'se') {
                    newW = pt.x - x_nw;
                    newL = pt.y - y_nw;
                    newX = x_nw + newW / 2;
                    newY = y_nw + newL / 2;
                  }
                  
                  if (isHoriz) {
                    newPart.widthIn = Math.max(10, newW);
                    newPart.lengthIn = Math.max(10, newL);
                  } else {
                    newPart.lengthIn = Math.max(10, newW);
                    newPart.widthIn = Math.max(10, newL);
                  }
                  newPart.x = newX;
                  newPart.y = newY;
                  
                  return newPart;
                }));
              } else if (isTrussRun) {
                setTrussRuns(prev => prev.map(t => {
                  if (t.id !== resizingBlockId) return t;
                  const newRun = { ...t };
                  const isHoriz = t.rotation === 0;
                  
                  const w = isHoriz ? t.lengthFt * 12 : t.spanFt * 12;
                  const l = isHoriz ? t.spanFt * 12 : t.lengthFt * 12;
                  
                  const x_nw = t.x - w / 2;
                  const y_nw = t.y - l / 2;
                  const x_se = t.x + w / 2;
                  const y_se = t.y + l / 2;

                  // ── Individual corner mode (Ctrl + drag on Solid Shell) ──
                  if (resizingCornerOnly && t.type === 'Solid Shell') {
                    const corners = t.customCorners || {
                      nw: { dx: 0, dy: 0 },
                      ne: { dx: 0, dy: 0 },
                      sw: { dx: 0, dy: 0 },
                      se: { dx: 0, dy: 0 },
                    };
                    
                    // Calculate the corner's default position and the offset from the mouse
                    if (resizeHandle === 'nw') {
                      corners.nw = { dx: pt.x - x_nw, dy: pt.y - y_nw };
                    } else if (resizeHandle === 'ne') {
                      corners.ne = { dx: pt.x - x_se, dy: pt.y - y_nw };
                    } else if (resizeHandle === 'sw') {
                      corners.sw = { dx: pt.x - x_nw, dy: pt.y - y_se };
                    } else if (resizeHandle === 'se') {
                      corners.se = { dx: pt.x - x_se, dy: pt.y - y_se };
                    }
                    
                    newRun.customCorners = { ...corners };
                    return newRun;
                  }
                  
                  // ── Normal proportional resize ──
                  let newW = w;
                  let newL = l;
                  let newX = t.x;
                  let newY = t.y;
                  
                  if (resizeHandle === 'nw') {
                    newW = x_se - pt.x;
                    newL = y_se - pt.y;
                    newX = x_se - newW / 2;
                    newY = y_se - newL / 2;
                  } else if (resizeHandle === 'ne') {
                    newW = pt.x - (t.x - w / 2);
                    newL = y_se - pt.y;
                    newX = (t.x - w / 2) + newW / 2;
                    newY = y_se - newL / 2;
                  } else if (resizeHandle === 'sw') {
                    newW = x_se - pt.x;
                    newL = pt.y - (t.y - l / 2);
                    newX = x_se - newW / 2;
                    newY = (t.y - l / 2) + newL / 2;
                  } else if (resizeHandle === 'se') {
                    newW = pt.x - x_nw;
                    newL = pt.y - y_nw;
                    newX = x_nw + newW / 2;
                    newY = y_nw + newL / 2;
                  }
                  
                  if (isHoriz) {
                    newRun.lengthFt = Math.max(1, newW / 12);
                    newRun.spanFt = Math.max(1, newL / 12);
                  } else {
                    newRun.spanFt = Math.max(1, newW / 12);
                    newRun.lengthFt = Math.max(1, newL / 12);
                  }
                  newRun.x = newX;
                  newRun.y = newY;
                  
                  return newRun;
                }));
              } else if (isDormer) {
                setDormers(prev => prev.map(d => {
                  if (d.id !== resizingBlockId) return d;
                  const newDormer = { ...d };
                  const isHoriz = d.rotation === 0;
                  
                  const w = isHoriz ? d.widthIn : d.depthIn;
                  const h = isHoriz ? d.depthIn : d.widthIn;
                  
                  const x_nw = d.x - w / 2;
                  const y_nw = d.y - h / 2;
                  const x_se = d.x + w / 2;
                  const y_se = d.y + h / 2;
                  
                  let newW = w;
                  let newH = h;
                  let newX = d.x;
                  let newY = d.y;
                  
                  if (resizeHandle === 'nw') {
                    newW = x_se - pt.x;
                    newH = y_se - pt.y;
                    newX = x_se - newW / 2;
                    newY = y_se - newH / 2;
                  } else if (resizeHandle === 'ne') {
                    newW = pt.x - (d.x - w / 2);
                    newH = y_se - pt.y;
                    newX = (d.x - w / 2) + newW / 2;
                    newY = y_se - newH / 2;
                  } else if (resizeHandle === 'sw') {
                    newW = x_se - pt.x;
                    newH = pt.y - (d.y - h / 2);
                    newX = x_se - newW / 2;
                    newY = (d.y - h / 2) + newH / 2;
                  } else if (resizeHandle === 'se') {
                    newW = pt.x - x_nw;
                    newH = pt.y - y_nw;
                    newX = x_nw + newW / 2;
                    newY = y_nw + newH / 2;
                  }
                  
                  if (isHoriz) {
                    newDormer.widthIn = Math.max(12, newW);
                    newDormer.depthIn = Math.max(12, newH);
                  } else {
                    newDormer.widthIn = Math.max(12, newH);
                    newDormer.depthIn = Math.max(12, newW);
                  }
                  newDormer.x = newX;
                  newDormer.y = newY;
                  
                  return newDormer;
                }));
              } else {
                setShapeBlocks(prev => prev.map(b => {
                  if (b.id !== resizingBlockId) return b;
                  const newBlock = { ...b };
                  
                  let targetX = pt.x;
                  let targetY = pt.y;

                  // Aspect ratio lock (square) if shift is held
                  if (isShiftDown) {
                    const dx = Math.abs(pt.x - b.x);
                    const dy = Math.abs(pt.y - b.y);
                    const size = Math.max(dx, dy);
                    if (resizeHandle.includes('right')) targetX = b.x + size;
                    if (resizeHandle.includes('bottom')) targetY = b.y + size;
                    if (resizeHandle.includes('left')) targetX = b.x + b.w - size;
                    if (resizeHandle.includes('top')) targetY = b.y + b.h - size;
                  }

                  if (resizeHandle.includes('right')) newBlock.w = Math.max(12, targetX - b.x);
                  if (resizeHandle.includes('bottom')) newBlock.h = Math.max(12, targetY - b.y);
                  if (resizeHandle.includes('left')) {
                    const newX = targetX;
                    const diff = b.x - newX;
                    if (b.w + diff > 12) {
                      newBlock.x = newX;
                      newBlock.w = b.w + diff;
                    }
                  }
                  if (resizeHandle.includes('top')) {
                    const newY = targetY;
                    const diff = b.y - newY;
                    if (b.h + diff > 12) {
                      newBlock.y = newY;
                      newBlock.h = b.h + diff;
                    }
                  }
                  return newBlock;
                }));
              }
              return;
            }

            if (!isMagnifierActive) return;
            if (magnifierGroupRef.current && magnifierUseRef.current) {
              magnifierGroupRef.current.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
              magnifierUseRef.current.setAttribute('transform', `scale(2.5) translate(${-pt.x}, ${-pt.y})`);
            }
          }}
          onMouseUp={() => {
            setDraggingBlockId(null);
            setResizingBlockId(null);
            setResizeHandle(null);
            setResizingCornerOnly(false);
          }}
        >
          <g id="main-content">
            {/* PDF Reference Layer */}
          {pdfImages.length > 0 && (
            <g 
              transform={`translate(${pdfOffset.x}, ${pdfOffset.y}) scale(${pdfScale}) rotate(${pdfRotation})`}
              opacity={pdfOpacity}
              style={{ pointerEvents: isCalibrating ? 'none' : 'auto' }}
              onMouseDown={handlePdfMouseDown}
              className={isCalibrating || isBlueprintLocked ? "" : "cursor-move"}
            >
              <image 
                href={pdfImages[selectedPdfIndex]} 
                x="0" y="0" 
                width={1200} // Fixed base width (100ft) to prevent resizing when house dimensions change
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          )}

          {/* Shape Blocks Layer */}
          {shapeBlocks.map(block => (
            <g key={block.id} className="shape-block-group">
              <rect
                x={sanitize(block.x)}
                y={sanitize(block.y)}
                width={sanitize(block.w)}
                height={sanitize(block.h)}
                fill="rgba(79, 70, 229, 0.15)"
                stroke="#4f46e5"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="cursor-move hover:fill-indigo-500/30 transition-colors"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const pt = getSvgPoint(e);
                  setDraggingBlockId(block.id);
                  setDragStartPt(pt);
                  setDragAxis(null);
                  setDragOffset({ x: pt.x - block.x, y: pt.y - block.y });
                }}
              />
              {/* Dimensions */}
              <text
                x={block.x + block.w / 2}
                y={block.y - 10}
                textAnchor="middle"
                transform={`rotate(180, ${block.x + block.w / 2}, ${block.y - 10})`}
                className="text-[12px] font-bold fill-indigo-600"
              >
                {Math.floor(block.w / 12)}' {block.w % 12}"
              </text>
              <text
                x={block.x - 10}
                y={block.y + block.h / 2}
                textAnchor="end"
                transform={`rotate(90, ${block.x - 10}, ${block.y + block.h / 2})`}
                className="text-[12px] font-bold fill-indigo-600"
              >
                {Math.floor(block.h / 12)}' {block.h % 12}"
              </text>
              {/* Delete Button */}
              <g 
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShapeBlocks(prev => prev.filter(b => b.id !== block.id));
                }}
              >
                <circle cx={block.x + block.w} cy={block.y} r="10" fill="#ef4444" />
                <line x1={sanitize(block.x + block.w - 4)} y1={sanitize(block.y - 4)} x2={sanitize(block.x + block.w + 4)} y2={sanitize(block.y + 4)} stroke="white" strokeWidth="2" />
                <line x1={sanitize(block.x + block.w + 4)} y1={sanitize(block.y - 4)} x2={sanitize(block.x + block.w - 4)} y2={sanitize(block.y + 4)} stroke="white" strokeWidth="2" />
              </g>

              {/* Resize Handles */}
              {[
                { x: block.x, y: block.y, cursor: 'nw-resize', handle: 'top-left' },
                { x: block.x + block.w, y: block.y, cursor: 'ne-resize', handle: 'top-right' },
                { x: block.x, y: block.y + block.h, cursor: 'sw-resize', handle: 'bottom-left' },
                { x: block.x + block.w, y: block.y + block.h, cursor: 'se-resize', handle: 'bottom-right' }
              ].map((h, i) => (
                <circle
                  key={i}
                  cx={h.x}
                  cy={h.y}
                  r="6"
                  fill="white"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  style={{ cursor: h.cursor }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingBlockId(block.id);
                    setResizeHandle(h.handle);
                  }}
                />
              ))}
            </g>
          ))}

          {/* Combined Blocks Layer (Final Shape) */}
          {combinedBlocks.map(block => (
            <rect
              key={`combined-${block.id}`}
              x={block.x}
              y={block.y}
              width={block.w}
              height={block.h}
              fill="rgba(79, 70, 229, 0.05)"
              stroke="rgba(79, 70, 229, 0.2)"
              strokeWidth="1"
              pointerEvents="none"
            />
          ))}

          {/* Zoom Selection Overlay */}
          {(isZoomSelectionMode || zoomSelectionStart) && zoomSelectionStart && zoomSelectionEnd && (
            <g className="zoom-selection-layer">
              <rect
                x={Math.min(zoomSelectionStart.x, zoomSelectionEnd.x)}
                y={Math.min(zoomSelectionStart.y, zoomSelectionEnd.y)}
                width={Math.abs(zoomSelectionEnd.x - zoomSelectionStart.x)}
                height={Math.abs(zoomSelectionEnd.y - zoomSelectionStart.y)}
                fill="rgba(99, 102, 241, 0.2)"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </g>
          )}

          {/* Calibration Layer (Outside flipped group for correct coordinate alignment) */}
          {isCalibrating && pdfCalibration.p1 && (
            <g className="calibration-layer">
              {pdfCalibration.p2 ? (
                <>
                  <line 
                    x1={sanitize(pdfCalibration.p1.x)} y1={sanitize(pdfCalibration.p1.y)} 
                    x2={sanitize(pdfCalibration.p2.x)} y2={sanitize(pdfCalibration.p2.y)} 
                    stroke={appliedCalibration ? "#3b82f6" : "#10b981"} strokeWidth="3" 
                    strokeDasharray="4 2"
                  />
                  {/* Architectural Ticks (Diagonal 45deg lines) */}
                  <line 
                    x1={pdfCalibration.p1.x - 8} y1={pdfCalibration.p1.y + 8} 
                    x2={pdfCalibration.p1.x + 8} y2={pdfCalibration.p1.y - 8} 
                    stroke={appliedCalibration ? "#3b82f6" : "#10b981"} strokeWidth="3" 
                  />
                  <line 
                    x1={pdfCalibration.p2.x - 8} y1={pdfCalibration.p2.y + 8} 
                    x2={pdfCalibration.p2.x + 8} y2={pdfCalibration.p2.y - 8} 
                    stroke={appliedCalibration ? "#3b82f6" : "#10b981"} strokeWidth="3" 
                  />
                </>
              ) : (
                <>
                  <circle cx={pdfCalibration.p1.x} cy={pdfCalibration.p1.y} r="6" fill={appliedCalibration ? "#3b82f6" : "#10b981"} className="animate-pulse" />
                  {/* Live Line to Cursor */}
                  {(() => {
                    const locked = getLockedPoint(pdfCalibration.p1, mousePos);
                    let stroke = appliedCalibration ? "#3b82f6" : "#10b981";
                    if (locked.axis === 'x') stroke = "#ef4444"; // Red for horizontal
                    if (locked.axis === 'y') stroke = "#22c55e"; // Green for vertical

                    return (
                      <>
                        <line 
                          x1={pdfCalibration.p1.x} y1={pdfCalibration.p1.y} 
                          x2={locked.x} y2={locked.y} 
                          stroke={stroke} strokeWidth="2" 
                          strokeDasharray="4 4"
                          opacity="0.8"
                        />
                        {/* Visual Target for Chaining */}
                        {lastWallEndPoint && (
                          <g className="chaining-target">
                            <circle 
                              cx={sanitize(lastWallEndPoint.x)} 
                              cy={sanitize(lastWallEndPoint.y)} 
                              r="8" 
                              fill={lastWallType === 'exterior' ? "rgba(79, 70, 229, 0.2)" : "rgba(16, 185, 129, 0.2)"} 
                              stroke={lastWallType === 'exterior' ? "#4f46e5" : "#10b981"} 
                              strokeWidth="2" 
                              strokeDasharray="2 2"
                              className="animate-pulse"
                            />
                            <line 
                              x1={sanitize(lastWallEndPoint.x - 12)} y1={sanitize(lastWallEndPoint.y)} 
                              x2={sanitize(lastWallEndPoint.x + 12)} y2={sanitize(lastWallEndPoint.y)} 
                              stroke={lastWallType === 'exterior' ? "#4f46e5" : "#10b981"} strokeWidth="1" 
                            />
                            <line 
                              x1={sanitize(lastWallEndPoint.x)} y1={sanitize(lastWallEndPoint.y - 12)} 
                              x2={sanitize(lastWallEndPoint.x)} y2={sanitize(lastWallEndPoint.y + 12)} 
                              stroke={lastWallType === 'exterior' ? "#4f46e5" : "#10b981"} strokeWidth="1" 
                            />
                          </g>
                        )}

                        {/* Live Tooltip */}
                        {appliedCalibration && (
                          <g transform={`translate(${locked.x + 15}, ${locked.y - 15})`}>
                            <rect x="0" y="-20" width="80" height="24" rx="4" fill="rgba(0,0,0,0.8)" />
                            <text x="40" y="-4" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">
                              {(() => {
                                const dx = locked.x - pdfCalibration.p1.x;
                                const dy = locked.y - pdfCalibration.p1.y;
                                const pixelDist = Math.sqrt(dx * dx + dy * dy);
                                const distIn = pixelDist;
                                const ft = Math.floor(distIn / 12);
                                const inc = Math.round(distIn % 12);
                                return `${ft}' ${inc}"`;
                              })()}
                            </text>
                          </g>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </g>
          )}

          {/* Persistent Guides */}
          <g className="guides-layer">
            {guides.map((guide, idx) => {
              const isSnapped = snapLines.some(sl => 
                (sl.axis === 'x' && (Math.abs(sl.pos - guide.p1.x) < 0.1 || Math.abs(sl.pos - guide.p2.x) < 0.1)) ||
                (sl.axis === 'y' && (Math.abs(sl.pos - guide.p1.y) < 0.1 || Math.abs(sl.pos - guide.p2.y) < 0.1))
              );
              const strokeColor = isSnapped ? "#fbbf24" : "#3b82f6";

              return (
                <g key={`guide-${idx}`}>
                  <line 
                    x1={guide.p1.x} y1={guide.p1.y} 
                    x2={guide.p2.x} y2={guide.p2.y} 
                    stroke={strokeColor} strokeWidth={isSnapped ? "3" : "2"} 
                    strokeDasharray="6 4"
                    opacity={isSnapped ? "1" : "0.7"}
                  />
                  {/* Ticks */}
                  <line 
                    x1={guide.p1.x - 6} y1={guide.p1.y + 6} 
                    x2={guide.p1.x + 6} y2={guide.p1.y - 6} 
                    stroke={strokeColor} strokeWidth="2" 
                    opacity="0.7"
                  />
                  <line 
                    x1={guide.p2.x - 6} y1={guide.p2.y + 6} 
                    x2={guide.p2.x + 6} y2={guide.p2.y - 6} 
                    stroke={strokeColor} strokeWidth="2" 
                    opacity="0.7"
                  />
                  {/* Distance Label */}
                  <g transform={`translate(${(guide.p1.x + guide.p2.x) / 2}, ${(guide.p1.y + guide.p2.y) / 2}) rotate(180)`}>
                    <rect x="-25" y="-12" width="50" height="18" rx="2" fill={isSnapped ? "rgba(120,53,15,0.9)" : "rgba(30,41,59,0.9)"} />
                    <text x="0" y="1" fill={isSnapped ? "#fef3c7" : "#93c5fd"} fontSize="10" fontWeight="bold" textAnchor="middle">
                      {Math.floor(guide.distanceIn / 12)}' {Math.round(guide.distanceIn % 12)}"
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* Default SVG coordinate space natively mapping SketchUp coordinates (X=Right, Y=Down) */}
          <g>
            
            {/* Grid (optional, maybe 1ft grid) */}
            <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
            <rect x={-padding} y={-padding} width={maxX + padding * 2} height={maxY + padding * 2} fill="url(#grid)" />

            {addFloorFraming && viewMode === 'floor' && (
              <g className="floor-joists" opacity="0.3">
                {floorBays && floorBays.length > 0 ? (
                  <>
                    {floorBays.map((bay) => {
                      const bayFoundation = (bay.foundationType && bay.foundationType !== 'default') ? bay.foundationType : foundationType;
                      if (bayFoundation === 'slab' || bayFoundation === 'slab-on-grade' || bayFoundation === 'none') {
                        let labelSuffix = 'Slab';
                        if (bayFoundation === 'slab-on-grade') labelSuffix = 'Slab on Grade';
                        if (bayFoundation === 'none') labelSuffix = 'No Foundation';
                        
                        return (
                          <g key={bay.id}>
                            {/* Bay boundary with concrete/none pattern fill */}
                            <rect
                              x={bay.x} y={bay.y} width={bay.width} height={bay.height}
                              fill={bayFoundation === 'none' ? "rgba(244, 63, 94, 0.05)" : "rgba(148, 163, 184, 0.15)"} 
                              stroke={bayFoundation === 'none' ? "#f43f5e" : "#64748b"} 
                              strokeWidth="1.5" 
                              strokeDasharray={bayFoundation === 'none' ? "4 4" : "none"}
                            />
                            {/* Shading/texture effect */}
                            {bayFoundation !== 'none' && (
                              <rect
                                x={bay.x + 2} y={bay.y + 2} width={bay.width - 4} height={bay.height - 4}
                                fill="none" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" strokeDasharray="3 3"
                              />
                            )}
                            {/* Bay label */}
                            <text
                              x={bay.x + bay.width / 2} y={bay.y + bay.height / 2}
                              textAnchor="middle" dominantBaseline="central"
                              fill={bayFoundation === 'none' ? "#f43f5e" : "#475569"} 
                              fontSize="10" fontWeight="bold" opacity="0.8"
                            >
                              {bay.label} ({labelSuffix})
                            </text>
                          </g>
                        );
                      }
                      
                      return (
                        <g key={bay.id}>
                          {/* Bay boundary */}
                          <rect
                            x={bay.x} y={bay.y} width={bay.width} height={bay.height}
                            fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="6 3" opacity="0.4"
                          />
                          {/* Bay label */}
                          <text
                            x={bay.x + bay.width / 2} y={bay.y + bay.height / 2}
                            textAnchor="middle" dominantBaseline="central"
                            fill="#6366f1" fontSize="10" fontWeight="bold" opacity="0.5"
                          >
                            {bay.label}
                          </text>
                          {bay.joistDirection === 'y' ? (
                            <>
                              {/* Rim joists front/back */}
                              <rect x={bay.x} y={bay.y} width={bay.width} height={1.5} fill="#52525b" />
                              <rect x={bay.x} y={bay.y + bay.height - 1.5} width={bay.width} height={1.5} fill="#52525b" />
                              {/* Joists spaced along X */}
                              {Array.from({ length: Math.ceil(bay.width / joistSpacing) + 1 }).map((_, i) => {
                                let jx = bay.x + i * joistSpacing;
                                if (jx + 1.5 > bay.x + bay.width) jx = bay.x + bay.width - 1.5;
                                if (jx < bay.x) jx = bay.x;
                                return <rect key={`j-${bay.id}-${i}`} x={jx} y={bay.y + 1.5} width={1.5} height={bay.height - 3} fill="#71717a" />;
                              })}
                            </>
                          ) : (
                            <>
                              {/* Rim joists left/right */}
                              <rect x={bay.x} y={bay.y} width={1.5} height={bay.height} fill="#52525b" />
                              <rect x={bay.x + bay.width - 1.5} y={bay.y} width={1.5} height={bay.height} fill="#52525b" />
                              {/* Joists spaced along Z */}
                              {Array.from({ length: Math.ceil(bay.height / joistSpacing) + 1 }).map((_, i) => {
                                let jy = bay.y + i * joistSpacing;
                                if (jy + 1.5 > bay.y + bay.height) jy = bay.y + bay.height - 1.5;
                                if (jy < bay.y) jy = bay.y;
                                return <rect key={`j-${bay.id}-${i}`} x={bay.x + 1.5} y={jy} width={bay.width - 3} height={1.5} fill="#71717a" />;
                              })}
                            </>
                          )}
                        </g>
                      );
                    })}
                  </>
                ) : joistDirection === 'y' ? (
                  <>
                    {/* Rim joists (front and back) */}
                    <rect x={0} y={0} width={widthIn} height={1.5} fill="#52525b" />
                    {shape === 'rectangle' && <rect x={0} y={lengthIn - 1.5} width={widthIn} height={1.5} fill="#52525b" />}
                    {shape === 'l-shape' && (
                      <>
                        <rect x={0} y={lengthIn - 1.5} width={lBackWidthIn} height={1.5} fill="#52525b" />
                        <rect x={lBackWidthIn} y={lRightDepthIn - 1.5} width={widthIn - lBackWidthIn} height={1.5} fill="#52525b" />
                      </>
                    )}
                    {shape === 'u-shape' && (
                      <>
                        <rect x={0} y={uWallsIn.w8 - 1.5} width={uWallsIn.w7} height={1.5} fill="#52525b" />
                        <rect x={uWallsIn.w1 - uWallsIn.w3} y={uWallsIn.w2 - 1.5} width={uWallsIn.w3} height={1.5} fill="#52525b" />
                        <rect x={uWallsIn.w7} y={uWallsIn.w2 - uWallsIn.w4 - 1.5} width={uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7} height={1.5} fill="#52525b" />
                      </>
                    )}
                    {shape === 'h-shape' && (
                      <>
                        <rect x={0} y={0} width={hLeftBarWidthIn} height={1.5} fill="#52525b" />
                        <rect x={0} y={lengthIn - 1.5} width={hLeftBarWidthIn} height={1.5} fill="#52525b" />
                        <rect x={widthIn - hRightBarWidthIn} y={0} width={hRightBarWidthIn} height={1.5} fill="#52525b" />
                        <rect x={widthIn - hRightBarWidthIn} y={lengthIn - 1.5} width={hRightBarWidthIn} height={1.5} fill="#52525b" />
                        <rect x={hLeftBarWidthIn} y={hMiddleBarOffsetIn} width={widthIn - hLeftBarWidthIn - hRightBarWidthIn} height={1.5} fill="#52525b" />
                        <rect x={hLeftBarWidthIn} y={hMiddleBarOffsetIn + hMiddleBarHeightIn - 1.5} width={widthIn - hLeftBarWidthIn - hRightBarWidthIn} height={1.5} fill="#52525b" />
                      </>
                    )}
                    {shape === 't-shape' && (
                      <>
                        <rect x={0} y={0} width={tTopWidthIn} height={1.5} fill="#52525b" />
                        <rect x={0} y={tTopLengthIn - 1.5} width={(tTopWidthIn - tStemWidthIn) / 2} height={1.5} fill="#52525b" />
                        <rect x={(tTopWidthIn + tStemWidthIn) / 2} y={tTopLengthIn - 1.5} width={(tTopWidthIn - tStemWidthIn) / 2} height={1.5} fill="#52525b" />
                        <rect x={(tTopWidthIn - tStemWidthIn) / 2} y={tTopLengthIn + tStemLengthIn - 1.5} width={tStemWidthIn} height={1.5} fill="#52525b" />
                      </>
                    )}
                    {Array.from({ length: Math.ceil((shape === 't-shape' ? tTopWidthIn : widthIn) / joistSpacing) + 1 }).map((_, i) => {
                      const limitW = shape === 't-shape' ? tTopWidthIn : widthIn;
                      let jx = i * joistSpacing;
                      if (jx + 1.5 > limitW) jx = limitW - 1.5;
                      let h = shape === 't-shape' ? (tTopLengthIn + tStemLengthIn) : lengthIn;
                      if (shape === 'l-shape' && jx >= lBackWidthIn) h = lRightDepthIn;
                      if (shape === 'u-shape') {
                        if (jx >= uWallsIn.w7 && jx < (uWallsIn.w1 - uWallsIn.w3)) h = uWallsIn.w2 - uWallsIn.w4;
                        else if (jx < uWallsIn.w7) h = uWallsIn.w8;
                        else h = uWallsIn.w2;
                      }
                      if (shape === 'h-shape') {
                        if (jx >= hLeftBarWidthIn && jx < (widthIn - hRightBarWidthIn)) {
                           return (
                             <rect key={`j-${i}`} x={jx} y={hMiddleBarOffsetIn + 1.5} width={1.5} height={hMiddleBarHeightIn - 3} fill="#71717a" />
                           );
                        }
                      }
                      if (shape === 't-shape') {
                        if (jx < (tTopWidthIn - tStemWidthIn) / 2 || jx >= (tTopWidthIn + tStemWidthIn) / 2) {
                           h = tTopLengthIn;
                        } else {
                           h = tTopLengthIn + tStemLengthIn;
                        }
                      }
                      return <rect key={`j-${i}`} x={jx} y={1.5} width={1.5} height={h - 3} fill="#71717a" />;
                    })}
                  </>
                ) : (
                  <>
                    {/* Rim joists (left and right) */}
                    <rect x={0} y={0} width={1.5} height={lengthIn} fill="#52525b" />
                    {shape === 'rectangle' && <rect x={widthIn - 1.5} y={0} width={1.5} height={lengthIn} fill="#52525b" />}
                    {shape === 'l-shape' && (
                      <>
                        <rect x={widthIn - 1.5} y={0} width={1.5} height={lRightDepthIn} fill="#52525b" />
                        <rect x={lBackWidthIn - 1.5} y={lRightDepthIn} width={1.5} height={lengthIn - lRightDepthIn} fill="#52525b" />
                      </>
                    )}
                    {shape === 'u-shape' && (
                      <>
                        <rect x={uWallsIn.w1 - 1.5} y={0} width={1.5} height={uWallsIn.w2} fill="#52525b" />
                        <rect x={uWallsIn.w7 - 1.5} y={uWallsIn.w2 - uWallsIn.w4} width={1.5} height={uWallsIn.w8 - (uWallsIn.w2 - uWallsIn.w4)} fill="#52525b" />
                      </>
                    )}
                    {shape === 'h-shape' && (
                      <>
                        <rect x={0} y={0} width={1.5} height={lengthIn} fill="#52525b" />
                        <rect x={hLeftBarWidthIn - 1.5} y={0} width={1.5} height={hMiddleBarOffsetIn} fill="#52525b" />
                        <rect x={hLeftBarWidthIn - 1.5} y={hMiddleBarOffsetIn + hMiddleBarHeightIn} width={1.5} height={lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn)} fill="#52525b" />
                        <rect x={widthIn - hRightBarWidthIn} y={0} width={1.5} height={hMiddleBarOffsetIn} fill="#52525b" />
                        <rect x={widthIn - hRightBarWidthIn} y={hMiddleBarOffsetIn + hMiddleBarHeightIn} width={1.5} height={lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn)} fill="#52525b" />
                        <rect x={widthIn - 1.5} y={0} width={1.5} height={lengthIn} fill="#52525b" />
                      </>
                    )}
                    {shape === 't-shape' && (
                      <>
                        <rect x={0} y={0} width={1.5} height={tTopLengthIn} fill="#52525b" />
                        <rect x={tTopWidthIn - 1.5} y={0} width={1.5} height={tTopLengthIn} fill="#52525b" />
                        <rect x={(tTopWidthIn - tStemWidthIn) / 2} y={tTopLengthIn} width={1.5} height={tStemLengthIn} fill="#52525b" />
                        <rect x={(tTopWidthIn + tStemWidthIn) / 2 - 1.5} y={tTopLengthIn} width={1.5} height={tStemLengthIn} fill="#52525b" />
                      </>
                    )}
                    {Array.from({ length: Math.ceil((shape === 't-shape' ? (tTopLengthIn + tStemLengthIn) : lengthIn) / joistSpacing) + 1 }).map((_, i) => {
                      const limitL = shape === 't-shape' ? (tTopLengthIn + tStemLengthIn) : lengthIn;
                      let jy = i * joistSpacing;
                      if (jy + 1.5 > limitL) jy = limitL - 1.5;
                      let w = shape === 't-shape' ? tTopWidthIn : widthIn;
                      if (shape === 'l-shape' && jy >= lRightDepthIn) w = lBackWidthIn;
                      if (shape === 'u-shape') {
                        if (jy >= (uWallsIn.w2 - uWallsIn.w4)) {
                           return (
                             <g key={`j-${i}`}>
                               <rect x={1.5} y={jy} width={uWallsIn.w7 - 3} height={1.5} fill="#71717a" />
                               <rect x={uWallsIn.w1 - uWallsIn.w3 + 1.5} y={jy} width={uWallsIn.w3 - 3} height={1.5} fill="#71717a" />
                             </g>
                           );
                        } else {
                          w = uWallsIn.w1;
                        }
                      }
                      if (shape === 'h-shape') {
                        if (jy < hMiddleBarOffsetIn || jy >= (hMiddleBarOffsetIn + hMiddleBarHeightIn)) {
                           return (
                             <g key={`j-${i}`}>
                               <rect x={1.5} y={jy} width={hLeftBarWidthIn - 3} height={1.5} fill="#71717a" />
                               <rect x={widthIn - hRightBarWidthIn + 1.5} y={jy} width={hRightBarWidthIn - 3} height={1.5} fill="#71717a" />
                             </g>
                           );
                        }
                      }
                      if (shape === 't-shape') {
                        if (jy >= tTopLengthIn) {
                           return (
                             <rect key={`j-${i}`} x={(tTopWidthIn - tStemWidthIn) / 2 + 1.5} y={jy} width={tStemWidthIn - 3} height={1.5} fill="#71717a" />
                           );
                        }
                      }
                      return <rect key={`j-${i}`} x={1.5} y={jy} width={w - 3} height={1.5} fill="#71717a" />;
                    })}
                  </>
                )}
              </g>
            )}

            {/* Floor Girder Support System */}
            {addFloorFraming && viewMode === 'floor' && enableGirderSystem && (
              <g className="floor-girders">
                {(() => {
                  const mockState = {
                    shape,
                    widthFt: Math.floor(widthIn / 12),
                    widthInches: widthIn % 12,
                    lengthFt: Math.floor(lengthIn / 12),
                    lengthInches: lengthIn % 12,
                    lRightDepthFt: Math.floor(lRightDepthIn / 12),
                    lRightDepthInches: lRightDepthIn % 12,
                    lBackWidthFt: Math.floor(lBackWidthIn / 12),
                    lBackWidthInches: lBackWidthIn % 12,
                    lDirection: lDirection || 'back-right',
                    uWalls: {
                      w1: Math.floor(uWallsIn.w1 / 12),
                      w2: Math.floor(uWallsIn.w2 / 12),
                      w3: Math.floor(uWallsIn.w3 / 12),
                      w4: Math.floor(uWallsIn.w4 / 12),
                      w5: Math.floor(uWallsIn.w5 / 12),
                      w6: Math.floor(uWallsIn.w6 / 12),
                      w7: Math.floor(uWallsIn.w7 / 12),
                      w8: Math.floor(uWallsIn.w8 / 12),
                    },
                    uWallsInches: {
                      w1: uWallsIn.w1 % 12,
                      w2: uWallsIn.w2 % 12,
                      w3: uWallsIn.w3 % 12,
                      w4: uWallsIn.w4 % 12,
                      w5: uWallsIn.w5 % 12,
                      w6: uWallsIn.w6 % 12,
                      w7: uWallsIn.w7 % 12,
                      w8: uWallsIn.w8 % 12,
                    },
                    uDirection: 'back',
                    hLeftBarWidthFt: Math.floor(hLeftBarWidthIn / 12),
                    hLeftBarWidthInches: hLeftBarWidthIn % 12,
                    hRightBarWidthFt: Math.floor(hRightBarWidthIn / 12),
                    hRightBarWidthInches: hRightBarWidthIn % 12,
                    hMiddleBarHeightFt: Math.floor(hMiddleBarHeightIn / 12),
                    hMiddleBarHeightInches: hMiddleBarHeightIn % 12,
                    hMiddleBarOffsetFt: Math.floor(hMiddleBarOffsetIn / 12),
                    hMiddleBarOffsetInches: hMiddleBarOffsetIn % 12,
                    tTopWidthFt: Math.floor(tTopWidthIn / 12),
                    tTopWidthInches: tTopWidthIn % 12,
                    tTopLengthFt: Math.floor(tTopLengthIn / 12),
tTopLengthInches: tTopLengthIn % 12,
                    tStemWidthFt: Math.floor(tStemWidthIn / 12),
                    tStemWidthInches: tStemWidthIn % 12,
                    tStemLengthFt: Math.floor(tStemLengthIn / 12),
                    tStemLengthInches: tStemLengthIn % 12,
                    combinedBlocks,
                    shapeBlocks,
                  } as any;

                  const activeBays = floorBays && floorBays.length > 0 ? floorBays : detectBays(mockState);
                  const parsedBays = activeBays.map(bay => {
                    const direction = floorBays && floorBays.length > 0 ? bay.joistDirection : joistDirection;
                    return { ...bay, joistDirection: direction };
                  });

                  const supportSystem = computeFramingSupportSystem({
                    enableGirderSystem,
                    addFloorFraming,
                    girderSpanThresholdFt,
                    girderPostSpacingFt,
                    addPocketBeams,
                    pocketBeamsOnlyAtGirderEnds
                  }, parsedBays);

                  return (
                    <g key="framing-support-system">
                      {/* Pocket Beams (Interior boundaries) */}
                      {supportSystem.pocketBeams.map((pb) => (
                        <g key={pb.id}>
                          {/* Indigo dashed line for the pocket beam */}
                          <line 
                            x1={pb.dir === 'y' ? pb.coord : pb.start} 
                            y1={pb.dir === 'y' ? pb.start : pb.coord} 
                            x2={pb.dir === 'y' ? pb.coord : pb.end} 
                            y2={pb.dir === 'y' ? pb.end : pb.coord} 
                            stroke="#4f46e5" 
                            strokeWidth="4" 
                            strokeDasharray="8 4"
                            className="cursor-pointer"
                          >
                            <title>{girderSize} Pocket Beam (Interior framing transition)</title>
                          </line>

                          {/* Posts and Piers along the pocket beam */}
                          {pb.posts.map((post) => (
                            <g key={post.id} className="cursor-pointer">
                              {/* Concrete Pier (Circle) */}
                              <circle 
                                cx={post.x} 
                                cy={post.y} 
                                r="6" 
                                fill="#94a3b8" 
                                stroke="#64748b" 
                                strokeWidth="1" 
                              />
                              {/* Wood Post (Square) */}
                              <rect 
                                x={post.x - 3} 
                                y={post.y - 3} 
                                width="6" 
                                height="6" 
                                fill="#ea580c" 
                                stroke="#c2410c" 
                                strokeWidth="1" 
                              />
                              <title>{girderPierSize} Concrete Pier & {girderPostSize} Post</title>
                            </g>
                          ))}

                          {/* Simpson wall brackets at the pocket beam perimeter endpoints */}
                          {pb.brackets.map((br) => (
                            <g key={br.id} className="cursor-pointer">
                              <rect 
                                x={br.x - 4} 
                                y={br.y - 4} 
                                width="8" 
                                height="8" 
                                rx="1" 
                                fill="#71717a" 
                                stroke="#3f3f46" 
                                strokeWidth="1" 
                              />
                              <line 
                                x1={br.x - 4} 
                                y1={br.y} 
                                x2={br.x + 4} 
                                y2={br.y} 
                                stroke="#d4d4d8" 
                                strokeWidth="0.75" 
                              />
                              <title>Simpson Heavy Girder Wall Bracket</title>
                            </g>
                          ))}
                        </g>
                      ))}

                      {/* Girders */}
                      {supportSystem.girders.map((g) => (
                        <g key={g.id}>
                          {/* Crimson dashed line for the beam */}
                          <line 
                            x1={g.x1} 
                            y1={g.y1} 
                            x2={g.x2} 
                            y2={g.y2} 
                            stroke="#dc2626" 
                            strokeWidth="3" 
                            strokeDasharray="6 3"
                            className="cursor-pointer"
                          >
                            <title>{girderSize} Girder Beam</title>
                          </line>

                          {/* Posts and Piers along the beam */}
                          {g.posts.map((post) => (
                            <g key={post.id} className="cursor-pointer">
                              {/* Concrete Pier (Circle) */}
                              <circle 
                                cx={post.x} 
                                cy={post.y} 
                                r="6" 
                                fill="#94a3b8" 
                                stroke="#64748b" 
                                strokeWidth="1" 
                              />
                              {/* Wood Post (Square) */}
                              <rect 
                                x={post.x - 3} 
                                y={post.y - 3} 
                                width="6" 
                                height="6" 
                                fill="#ea580c" 
                                stroke="#c2410c" 
                                strokeWidth="1" 
                              />
                              <title>{girderPierSize} Concrete Pier & {girderPostSize} Post</title>
                            </g>
                          ))}

                          {/* Brackets at girder endpoints */}
                          {g.brackets.map((br) => (
                            <g key={br.id} className="cursor-pointer">
                              <rect 
                                x={br.x - 4} 
                                y={br.y - 4} 
                                width="8" 
                                height="8" 
                                rx="1" 
                                fill={br.isWoodToWood ? "#a1a1aa" : "#71717a"} 
                                stroke={br.isWoodToWood ? "#52525b" : "#3f3f46"} 
                                strokeWidth="1" 
                              />
                              <line 
                                x1={br.x - 4} 
                                y1={br.y} 
                                x2={br.x + 4} 
                                y2={br.y} 
                                stroke={br.isWoodToWood ? "#f4f4f5" : "#d4d4d8"} 
                                strokeWidth="0.75" 
                              />
                              <title>{br.isWoodToWood ? "Simpson Wood-to-Wood Girder Hanger" : "Simpson Heavy Girder Wall Bracket"}</title>
                            </g>
                          ))}
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </g>
            )}

            {/* Ghost Walls (Floor Below) */}
            <g className="ghost-walls">
              {ghostWalls.map((w) => (
                <rect
                  key={w.id}
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={w.h}
                  fill="none"
                  stroke={w.type === 'exterior' ? '#94a3b8' : '#cbd5e1'}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.4"
                />
              ))}
            </g>

            {/* Exterior Walls */}
            <g className="exterior-walls">
              {extWalls.map((w) => {
                const cx = w.x + w.w / 2;
                const cy = w.y + w.h / 2;
                const isCustom = exteriorWalls.some(ew => ew.id === w.id);
                const isDragging = draggingWall?.id === w.id && draggingWall?.type === 'exterior';
                
                return (
                  <g key={`ext-${w.id}`}>
                    {/* Invisible hit area for dragging custom walls */}
                    {isCustom && (
                      <rect 
                        x={w.x} y={w.y} width={w.w} height={w.h} 
                        fill="transparent"
                        className="cursor-grab"
                        onMouseDown={(e) => handleMouseDown(e, exteriorWalls.find(ew => ew.id === w.id)!, 'exterior')}
                      />
                    )}
                    {/* Roof Plan Representation */}
                    {viewMode === 'roof' && (
                      <rect 
                        x={w.x} y={w.y} width={w.w} height={w.h} 
                        fill="#ffb6c1"
                      />
                    )}
                    {/* Exterior Side Indicator (The single yellow line) */}
                    <line 
                      x1={w.isHorizontal ? w.x : (w.exteriorSide === 1 ? w.x + w.w : w.x)}
                      y1={w.isHorizontal ? (w.exteriorSide === 1 ? w.y + w.h : w.y) : w.y}
                      x2={w.isHorizontal ? w.x + w.w : (w.exteriorSide === 1 ? w.x + w.w : w.x)}
                      y2={w.isHorizontal ? (w.exteriorSide === 1 ? w.y + w.h : w.y) : w.y + w.h}
                      stroke={selectedWallId === w.id && selectedWallType === 'exterior' ? "#ef4444" : "#fbbf24"}
                      strokeWidth={selectedWallId === w.id && selectedWallType === 'exterior' ? "5" : "3"}
                      className={isCustom ? "cursor-grab" : ""}
                    />
                    {/* Wall Label */}
                    <text
                      x={0}
                      y={0}
                      fill="#3b82f6"
                      fontSize="14"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`translate(${w.isHorizontal ? cx : cx + (w.exteriorSide === 1 ? 40 : -40)}, ${w.isHorizontal ? cy + (w.exteriorSide === 1 ? -40 : 40) : cy}) ${!w.isHorizontal ? 'rotate(-90)' : ''}`}
                      className="select-none pointer-events-none font-sans"
                    >
                      WALL {w.id}
                    </text>
                  </g>
                );
              })}
              {bumpoutWalls.map((w) => {
                const bumpoutId = w.id.split('-')[0];
                const bumpout = bumpouts.find(b => b.id === bumpoutId);
                return (
                  <g key={`bump-${w.id}`}>
                    {/* Invisible hit area */}
                    <rect 
                      x={w.x} y={w.y} width={w.w} height={w.h} 
                      fill="transparent"
                      className="cursor-grab"
                      onMouseDown={bumpout ? (e) => handleBumpoutMouseDown(e, bumpout) : undefined}
                    />
                    {/* Roof Plan Representation */}
                    {viewMode === 'roof' && (
                      <rect 
                        x={w.x} y={w.y} width={w.w} height={w.h} 
                        fill="#ffb6c1"
                      />
                    )}
                    <line 
                      x1={w.isHorizontal ? w.x : (w.exteriorSide === 1 ? w.x + w.w : w.x)}
                      y1={w.isHorizontal ? (w.exteriorSide === 1 ? w.y + w.h : w.y) : w.y}
                      x2={w.isHorizontal ? w.x + w.w : (w.exteriorSide === 1 ? w.x + w.w : w.x)}
                      y2={w.isHorizontal ? (w.exteriorSide === 1 ? w.y + w.h : w.y) : w.y + w.h}
                      stroke="#fbbf24"
                      strokeWidth="3"
                    />
                  </g>
                );
              })}
            </g>

            {/* Dimensions */}
            <g className="dimensions">
              {dimensions.map((dim, i) => {
                const cx = (dim.x1 + dim.x2) / 2;
                const cy = (dim.y1 + dim.y2) / 2;
                const ox = dim.isHorizontal ? 0 : dim.offset;
                const oy = dim.isHorizontal ? dim.offset : 0;
                
                const lx1 = dim.x1 + ox;
                const ly1 = dim.y1 + oy;
                const lx2 = dim.x2 + ox;
                const ly2 = dim.y2 + oy;
                
                // Text position
                const tx = cx + ox + (dim.isHorizontal ? 0 : (dim.offset > 0 ? 6 : -6));
                const ty = cy + oy + (dim.isHorizontal ? (dim.offset > 0 ? 6 : -6) : 0);
                
                const isPlacement = dim.isPlacement;
                const color = isPlacement ? "#8b5cf6" : "#e4e4e7"; // violet-500 for placement, zinc-200 for length
                
                return (
                  <g key={`dim-${i}`}>
                    {/* Main dimension line */}
                    <line x1={sanitize(lx1)} y1={sanitize(ly1)} x2={sanitize(lx2)} y2={sanitize(ly2)} stroke={color} strokeWidth="0.5" strokeDasharray={isPlacement ? "2 2" : "none"} />
                    {/* Tick marks */}
                    <line x1={sanitize(lx1 - (dim.isHorizontal ? 0 : 4))} y1={sanitize(ly1 - (dim.isHorizontal ? 4 : 0))} x2={sanitize(lx1 + (dim.isHorizontal ? 0 : 4))} y2={sanitize(ly1 + (dim.isHorizontal ? 4 : 0))} stroke={color} strokeWidth="0.5" />
                    <line x1={sanitize(lx2 - (dim.isHorizontal ? 0 : 4))} y1={sanitize(ly2 - (dim.isHorizontal ? 4 : 0))} x2={sanitize(lx2 + (dim.isHorizontal ? 0 : 4))} y2={sanitize(ly2 + (dim.isHorizontal ? 4 : 0))} stroke={color} strokeWidth="0.5" />
                    {/* Extension lines */}
                    {!dim.isOpening && (
                      <>
                        <line x1={sanitize(dim.x1)} y1={sanitize(dim.y1)} x2={sanitize(lx1)} y2={sanitize(ly1)} stroke={color} strokeWidth="0.25" strokeDasharray="2 2" />
                        <line x1={sanitize(dim.x2)} y1={sanitize(dim.y2)} x2={sanitize(lx2)} y2={sanitize(ly2)} stroke={color} strokeWidth="0.25" strokeDasharray="2 2" />
                      </>
                    )}
                    {/* Text */}
                    <text
                      x={0}
                      y={0}
                      fill={color}
                      fontSize="12"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`translate(${tx}, ${ty}) ${!dim.isHorizontal ? 'rotate(-90)' : ''}`}
                      className="select-none pointer-events-none font-mono"
                    >
                      {dim.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Snap Lines */}
            {snapLines.map((line, i) => (
              <g key={`snap-group-${i}`}>
                {line.axis === 'x' ? (
                  <line x1={line.pos} y1={-padding} x2={line.pos} y2={maxY + padding} stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
                ) : (
                  <line x1={-padding} y1={line.pos} x2={maxX + padding} y2={line.pos} stroke="#6366f1" strokeWidth="2" strokeDasharray="4 4" />
                )}
                
                {line.type === 'mid' && (
                  <g transform={`translate(${line.axis === 'x' ? line.pos : (line.crossPos ?? mousePos.x)}, ${line.axis === 'y' ? line.pos : (line.crossPos ?? mousePos.y)})`}>
                    {/* Cyan Triangle for Midpoint */}
                    <path
                      d="M 0 -8 L -7 4 L 7 4 Z"
                      fill="#22d3ee"
                      stroke="#0891b2"
                      strokeWidth="1"
                    />
                    {/* Tooltip */}
                    <g transform="translate(0, 15)">
                      <rect x="-35" y="0" width="70" height="20" rx="4" fill="#1e293b" opacity="0.9" />
                      <text x="0" y="14" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">Midpoint</text>
                    </g>
                  </g>
                )}
              </g>
            ))}

            {/* Interior Walls */}
            <g className="interior-walls">
              {interiorWalls.filter(wall => (wall.floorIndex || 0) === currentFloorIndex).map(wall => {
                const x = wall.xFt * 12 + wall.xInches;
                const y = wall.yFt * 12 + wall.yInches;
                const len = wall.lengthFt * 12 + wall.lengthInches;
                const th = wall.thicknessIn;
                const w = wall.orientation === 'horizontal' ? len : th;
                const h = wall.orientation === 'vertical' ? len : th;
                const isDragging = draggingWall?.id === wall.id && draggingWall?.type === 'interior';
                const cx = x + w / 2;
                const cy = y + h / 2;

                return (
                  <g key={`int-${wall.id}`}>
                    {viewMode === 'floor' ? (
                      <>
                        <rect
                          x={x} y={y} width={w} height={h}
                          fill={(isDragging || (selectedWallId === wall.id && selectedWallType === 'interior')) ? "#818cf8" : "#6366f1"}
                          stroke={(isDragging || (selectedWallId === wall.id && selectedWallType === 'interior')) ? "#c7d2fe" : "#4f46e5"}
                          strokeWidth={(selectedWallId === wall.id && selectedWallType === 'interior') ? "3" : "1"}
                          className="cursor-grab hover:brightness-110 transition-all"
                          onMouseDown={(e) => handleMouseDown(e, wall, 'interior')}
                        />
                        {/* Wall Label */}
                        <text
                          x={0}
                          y={0}
                          fill="#6366f1"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`translate(${wall.orientation === 'horizontal' ? cx : cx + 20}, ${wall.orientation === 'horizontal' ? cy + 20 : cy}) scale(1, -1) rotate(180) ${wall.orientation === 'vertical' ? 'rotate(-90)' : ''}`}
                          className="select-none pointer-events-none font-sans"
                        >
                          INT {wall.id}
                        </text>
                      </>
                    ) : (
                      <rect
                        x={x} y={y} width={w} height={h}
                        fill="#ffb6c1"
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Ghost Wall Effect */}
            {ghostWall && (
              <rect
                x={ghostWall.w < 0 ? ghostWall.x + ghostWall.w : ghostWall.x}
                y={ghostWall.h < 0 ? ghostWall.y + ghostWall.h : ghostWall.y}
                width={Math.abs(ghostWall.w)}
                height={Math.abs(ghostWall.h)}
                fill={ghostWall.type === 'exterior' ? "#6366f1" : "#10b981"}
                className="animate-out fade-out zoom-out-95 duration-1000 fill-mode-forwards"
                opacity="0.6"
              />
            )}

            {/* Assets — Camera-style placement with SVG symbols */}
            {viewMode === 'floor' && (
              <g className="assets">
                {assets.filter(a => (a.floorIndex || 0) === currentFloorIndex).map(asset => {
                  const sym = getSymbolById(asset.type);
                  const isDragging = draggingAssetId === asset.id;
                  const isRotating = rotatingAssetId === asset.id;
                  const isSelected = selectedAssetId === asset.id;
                  const w = (asset.widthIn || 24) * asset.scale;
                  const h = (asset.depthIn || 24) * asset.scale;
                  const catColor = CATEGORY_COLORS[asset.category] || '#6366f1';
                  // Handle radius for rotation
                  const handleDist = Math.max(w, h) / 2 + 14;
                  
                  return (
                    <g 
                      key={`asset-${asset.id}`}
                      transform={`translate(${asset.x}, ${asset.y}) rotate(${asset.rotation})`}
                    >
                      {/* Interaction Hit Area */}
                      <rect
                        x={-w / 2} y={-h / 2}
                        width={w} height={h}
                        fill="transparent"
                        className="cursor-move"
                        onMouseDown={(e) => handleAssetMouseDown(e, asset)}
                      />

                      {/* Symbol border */}
                      <rect
                        x={-w / 2} y={-h / 2}
                        width={w} height={h}
                        fill={isDragging ? `${catColor}22` : isSelected ? `${catColor}18` : `${catColor}11`}
                        stroke={isSelected ? catColor : isDragging ? catColor : `${catColor}88`}
                        strokeWidth={isSelected || isDragging ? 2 : 1}
                        strokeDasharray={isSelected || isDragging ? 'none' : '4 2'}
                        rx={2}
                        className="pointer-events-none transition-colors"
                      />

                      {/* SVG Symbol artwork — scaled from symbol native coords to asset dims */}
                      {sym && (
                        <g transform={`translate(${-w / 2}, ${-h / 2}) scale(${asset.scale})`} className="pointer-events-none">
                          {sym.svgPaths.map((p, i) => (
                            <path
                              key={i}
                              d={p.d}
                              fill={p.fill || 'none'}
                              stroke={p.stroke || sym.color}
                              strokeWidth={p.strokeWidth || 0.5}
                            />
                          ))}
                        </g>
                      )}

                      {/* Fallback: no symbol found — show a simple colored rect */}
                      {!sym && (
                        <rect
                          x={-w / 2 + 2} y={-h / 2 + 2}
                          width={w - 4} height={h - 4}
                          fill={`${catColor}33`}
                          stroke={catColor}
                          strokeWidth={0.8}
                          rx={2}
                          className="pointer-events-none"
                        />
                      )}

                      {/* Rotation Handle — yellow circle (same as cameras) */}
                      <g
                        className="cursor-pointer"
                        onMouseDown={(e) => handleAssetRotateMouseDown(e, asset)}
                      >
                        {/* Invisible hit area */}
                        <circle cx={handleDist} cy={0} r={16} fill="transparent" />
                        {/* Stalk line */}
                        <line
                          x1={w / 2} y1={0}
                          x2={handleDist - 5} y2={0}
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                          className="pointer-events-none"
                        />
                        {/* Visible yellow handle */}
                        <circle
                          cx={handleDist} cy={0} r={5}
                          fill="#fcd34d"
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                          className="pointer-events-none"
                        />
                      </g>

                      {/* Name label — counter-rotated for readability */}
                      <text
                        x={0}
                        y={h / 2 + 10}
                        fill={catColor}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="hanging"
                        transform={`rotate(${-asset.rotation})`}
                        className="select-none pointer-events-none font-sans"
                      >
                        {asset.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Custom 3D Cameras */}
            {viewMode === 'floor' && (
              <g className="custom-cameras">
                {customCameras.filter(c => (c.floorIndex || 0) === currentFloorIndex).map(cam => {
                  const isDragging = draggingCameraId === cam.id;
                  const isRotating = rotatingCameraId === cam.id;
                  const isSelected = selectedCameraId === cam.id;
                  const iconSize = 24;
                  return (
                    <g 
                      key={`cam-${cam.id}`}
                      transform={`translate(${cam.x}, ${cam.y}) rotate(${cam.rotation})`}
                    >
                      {/* Selection Ring */}
                      {isSelected && (
                        <circle 
                          cx="0" cy="0" r={iconSize/2 + 5}
                          fill="none"
                          stroke="#818cf8"
                          strokeWidth="2"
                          strokeDasharray="4,3"
                          className="pointer-events-none"
                        />
                      )}
                      {/* Interaction Hit Area */}
                      <circle 
                        cx="0" cy="0" r="20" 
                        fill="transparent" 
                        className="cursor-move"
                        onMouseDown={(e) => handleCameraMouseDown(e, cam)}
                      />
                      
                      {/* Body */}
                      <circle 
                        cx="0" cy="0" r={iconSize/2}
                        fill={isDragging ? "#6366f1" : "#4f46e5"}
                        stroke={isDragging ? "#818cf8" : "#3730a3"}
                        strokeWidth="2"
                        className="cursor-move transition-colors pointer-events-none"
                      />
                      
                      {/* Lens Indicator (Pointing Right = 0 degrees) */}
                      <path 
                        d={`M ${iconSize/2 - 2} -6 L ${iconSize/2 + 8} -10 L ${iconSize/2 + 8} 10 L ${iconSize/2 - 2} 6 Z`} 
                        fill={isDragging ? "#6366f1" : "#4f46e5"}
                        stroke="#3730a3"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        className="pointer-events-none"
                      />

                      {/* Rotation Handle */}
                      <g 
                        className="cursor-pointer"
                        onMouseDown={(e) => handleCameraRotateMouseDown(e, cam)}
                      >
                        {/* Invisible hit area for easier grabbing */}
                        <circle cx={iconSize/2 + 14} cy="0" r="16" fill="transparent" />
                        {/* Visible yellow handle */}
                        <circle 
                          cx={iconSize/2 + 14} cy="0" r="5"
                          fill="#fcd34d"
                          stroke="#fbbf24"
                          strokeWidth="1.5"
                          className="hover:fill-amber-300 transition-colors pointer-events-none"
                        />
                      </g>

                      {/* Unrotated Text Label */}
                      <text
                        x="0"
                        y="0"
                        fill="#ffffff"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${-cam.rotation})`}
                        className="select-none pointer-events-none font-sans"
                      >
                        {cam.name.substring(0, 1)}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Doors and Windows */}
            {viewMode === 'floor' && (
              <g className="openings">
                {doors.filter(d => (d.floorIndex || 0) === currentFloorIndex).map(door => renderOpening(door, true))}
                {windows.filter(w => (w.floorIndex || 0) === currentFloorIndex).map(window => renderOpening(window, false))}
              </g>
            )}
          </g>
          </g>

          {isMagnifierActive && (
            <g ref={magnifierGroupRef} style={{ pointerEvents: 'none' }}>
              <clipPath id="magnifier-clip">
                <circle cx="0" cy="0" r={100 / zoom} />
              </clipPath>
              <g clipPath="url(#magnifier-clip)">
                <circle cx="0" cy="0" r={100 / zoom} fill="#1E1E1E" />
                <use ref={magnifierUseRef} href="#main-content" />
              </g>
              <circle cx="0" cy="0" r={100 / zoom} fill="none" stroke="#4f46e5" strokeWidth={3 / zoom} />
              {/* Crosshair */}
              <line x1={sanitize(-10 / zoom)} y1="0" x2={sanitize(10 / zoom)} y2="0" stroke="#4f46e5" strokeWidth={sanitize(1 / zoom)} opacity="0.5" />
              <line x1="0" y1={sanitize(-10 / zoom)} x2="0" y2={sanitize(10 / zoom)} stroke="#4f46e5" strokeWidth={sanitize(1 / zoom)} opacity="0.5" />
            </g>
          )}
          {/* Roof Parts Layer */}
          {roofParts.map(part => {
            const w = part.ridgeDirection === 'horizontal' ? part.widthIn : part.lengthIn;
            const h = part.ridgeDirection === 'horizontal' ? part.lengthIn : part.widthIn;
            const rx = part.x - w / 2;
            const ry = part.y - h / 2;
            
            return (
            <g key={part.id} className="roof-part-group">
              <rect
                x={sanitize(rx)}
                y={sanitize(ry)}
                width={sanitize(w)}
                height={sanitize(h)}
                fill="rgba(239, 68, 68, 0.15)"
                stroke="#ef4444"
                strokeWidth="2"
                className="cursor-move hover:fill-red-500/30 transition-colors"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const pt = getSvgPoint(e);
                  setDraggingBlockId(part.id);
                  setDragStartPt(pt);
                  setDragOffset({ x: pt.x - part.x, y: pt.y - part.y });
                }}
              />
              
              {/* Ridge Line */}
              {part.ridgeDirection === 'horizontal' ? (
                <line x1={sanitize(rx)} y1={sanitize(ry + h / 2)} x2={sanitize(rx + w)} y2={sanitize(ry + h / 2)} stroke="#ef4444" strokeWidth="2" strokeDasharray="8 4" />
              ) : (
                <line x1={sanitize(rx + w / 2)} y1={sanitize(ry)} x2={sanitize(rx + w / 2)} y2={sanitize(ry + h)} stroke="#ef4444" strokeWidth="2" strokeDasharray="8 4" />
              )}

              {/* Resizing handles */}
              {['nw', 'ne', 'sw', 'se'].map(handle => (
                <rect
                  key={handle}
                  x={sanitize(rx + (handle.includes('e') ? w : 0) - 5)}
                  y={sanitize(ry + (handle.includes('s') ? h : 0) - 5)}
                  width="10"
                  height="10"
                  fill="#ef4444"
                  className="cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingBlockId(part.id); // Reusing resizingBlockId
                    setResizeHandle(handle);
                  }}
                />
              ))}
            </g>
          )})}

          {/* Truss Runs Layer */}
          {trussRuns.map(run => {
            const w = run.rotation === 0 ? run.lengthFt * 12 : run.spanFt * 12;
            const h = run.rotation === 0 ? run.spanFt * 12 : run.lengthFt * 12;
            const rx = run.x - w / 2;
            const ry = run.y - h / 2;
            
            // Compute actual corner positions (with custom offsets if any)
            const cc = run.customCorners;
            const corners = {
              nw: { x: rx + (cc?.nw.dx || 0), y: ry + (cc?.nw.dy || 0) },
              ne: { x: rx + w + (cc?.ne.dx || 0), y: ry + (cc?.ne.dy || 0) },
              sw: { x: rx + (cc?.sw.dx || 0), y: ry + h + (cc?.sw.dy || 0) },
              se: { x: rx + w + (cc?.se.dx || 0), y: ry + h + (cc?.se.dy || 0) },
            };
            const hasCustomShape = !!cc;
            const isSolidShell = run.type === 'Solid Shell';
            
            const trusses = [];
            if (run.spacingIn > 0 && !hasCustomShape) {
              if (run.rotation === 0) {
                const numTrusses = Math.floor(w / run.spacingIn) + 1;
                for (let i = 0; i < numTrusses; i++) {
                  const tx = rx + i * run.spacingIn;
                  trusses.push(
                    <line key={`truss-${i}`} x1={sanitize(tx)} y1={sanitize(ry)} x2={sanitize(tx)} y2={sanitize(ry + h)} stroke="#059669" strokeWidth="1.5" strokeDasharray="4 2" />
                  );
                }
              } else {
                const numTrusses = Math.floor(h / run.spacingIn) + 1;
                for (let i = 0; i < numTrusses; i++) {
                  const ty = ry + i * run.spacingIn;
                  trusses.push(
                    <line key={`truss-${i}`} x1={sanitize(rx)} y1={sanitize(ty)} x2={sanitize(rx + w)} y2={sanitize(ty)} stroke="#059669" strokeWidth="1.5" strokeDasharray="4 2" />
                  );
                }
              }
            }

            // Build the polygon points string for custom shapes
            const polyPoints = `${sanitize(corners.nw.x)},${sanitize(corners.nw.y)} ${sanitize(corners.ne.x)},${sanitize(corners.ne.y)} ${sanitize(corners.se.x)},${sanitize(corners.se.y)} ${sanitize(corners.sw.x)},${sanitize(corners.sw.y)}`;

            return (
            <g key={run.id} className="truss-run-group">
              {/* Shell body — polygon for custom shapes, rect for standard */}
              {hasCustomShape ? (
                <polygon
                  points={polyPoints}
                  fill={isSolidShell ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)"}
                  stroke={isSolidShell ? "#f59e0b" : "#10b981"}
                  strokeWidth="2"
                  className="cursor-move hover:fill-amber-500/30 transition-colors"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const pt = getSvgPoint(e);
                    setDraggingBlockId(run.id);
                    setDragStartPt(pt);
                    setDragOffset({ x: pt.x - run.x, y: pt.y - run.y });
                  }}
                />
              ) : (
                <rect
                  x={sanitize(rx)}
                  y={sanitize(ry)}
                  width={sanitize(w)}
                  height={sanitize(h)}
                  fill="rgba(16, 185, 129, 0.15)"
                  stroke="#10b981"
                  strokeWidth="2"
                  className="cursor-move hover:fill-emerald-500/30 transition-colors"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const pt = getSvgPoint(e);
                    setDraggingBlockId(run.id);
                    setDragStartPt(pt);
                    setDragOffset({ x: pt.x - run.x, y: pt.y - run.y });
                  }}
                />
              )}
              
              {/* Render Trusses */}
              {trusses}

              {/* Cross-hatch pattern for custom shapes (visual cue) — non-solid-shell only */}
              {hasCustomShape && !isSolidShell && (
                <>
                  <line x1={sanitize(corners.nw.x)} y1={sanitize(corners.nw.y)} x2={sanitize(corners.se.x)} y2={sanitize(corners.se.y)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
                  <line x1={sanitize(corners.ne.x)} y1={sanitize(corners.ne.y)} x2={sanitize(corners.sw.x)} y2={sanitize(corners.sw.y)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="6 4" opacity="0.4" />
                </>
              )}

              {/* ─── Architectural Roof Plan Hatching (Solid Shells) ─── */}
              {isSolidShell && (() => {
                const shellLines = roofPlanResult.lines.filter(l => l.shellId === run.id || l.shellId.startsWith(run.id + '-'));
                const shellAnnotations = roofPlanResult.annotations.filter(a => a.shellId === run.id);
                return (
                  <g className="roof-plan-hatching" pointerEvents="none">
                    {shellLines.map((line, li) => {
                      if (line.type === 'ridge') {
                        return (
                          <line key={`ridge-${li}`}
                            x1={sanitize(line.p1.x)} y1={sanitize(line.p1.y)}
                            x2={sanitize(line.p2.x)} y2={sanitize(line.p2.y)}
                            stroke="#f59e0b" strokeWidth="3" strokeDasharray="12 6"
                            opacity="0.9"
                          />
                        );
                      }
                      if (line.type === 'hip') {
                        return (
                          <line key={`hip-${li}`}
                            x1={sanitize(line.p1.x)} y1={sanitize(line.p1.y)}
                            x2={sanitize(line.p2.x)} y2={sanitize(line.p2.y)}
                            stroke="#10b981" strokeWidth="2" strokeDasharray="8 4"
                            opacity="0.8"
                          />
                        );
                      }
                      if (line.type === 'slope-arrow') {
                        // Draw an arrow line with arrowhead
                        const dx = line.p2.x - line.p1.x;
                        const dy = line.p2.y - line.p1.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const nx = dx / len;
                        const ny = dy / len;
                        const arrowSize = 8;
                        return (
                          <g key={`arrow-${li}`}>
                            <line
                              x1={sanitize(line.p1.x)} y1={sanitize(line.p1.y)}
                              x2={sanitize(line.p2.x)} y2={sanitize(line.p2.y)}
                              stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 3"
                              opacity="0.7"
                            />
                            {/* Arrowhead */}
                            <polygon
                              points={`${sanitize(line.p2.x)},${sanitize(line.p2.y)} ${sanitize(line.p2.x - arrowSize * nx + arrowSize * 0.4 * ny)},${sanitize(line.p2.y - arrowSize * ny - arrowSize * 0.4 * nx)} ${sanitize(line.p2.x - arrowSize * nx - arrowSize * 0.4 * ny)},${sanitize(line.p2.y - arrowSize * ny + arrowSize * 0.4 * nx)}`}
                              fill="#f59e0b" opacity="0.7"
                            />
                          </g>
                        );
                      }
                      return null;
                    })}
                    {/* Pitch annotations */}
                    {shellAnnotations.map((ann, ai) => (
                      <text key={`ann-${ai}`}
                        x={sanitize(ann.pos.x)}
                        y={sanitize(ann.pos.y)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#f59e0b"
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="monospace"
                        opacity="0.85"
                        transform={ann.angle ? `rotate(${ann.angle}, ${sanitize(ann.pos.x)}, ${sanitize(ann.pos.y)})` : undefined}
                      >
                        {ann.text}
                      </text>
                    ))}
                  </g>
                );
              })()}

              {/* Ridge Line — fallback for non-Solid-Shell truss runs */}
              {!isSolidShell && (() => {
                const ratio = run.ridgeRatio !== undefined ? run.ridgeRatio / 100 : 0.5;
                if (hasCustomShape) {
                  // For custom shapes, draw ridge between the midpoints of the two edges
                  if (run.rotation === 0) {
                    const leftMidX = corners.nw.x + (corners.sw.x - corners.nw.x) * ratio;
                    const leftMidY = corners.nw.y + (corners.sw.y - corners.nw.y) * ratio;
                    const rightMidX = corners.ne.x + (corners.se.x - corners.ne.x) * ratio;
                    const rightMidY = corners.ne.y + (corners.se.y - corners.ne.y) * ratio;
                    return <line x1={sanitize(leftMidX)} y1={sanitize(leftMidY)} x2={sanitize(rightMidX)} y2={sanitize(rightMidY)} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />;
                  } else {
                    const topMidX = corners.nw.x + (corners.ne.x - corners.nw.x) * ratio;
                    const topMidY = corners.nw.y + (corners.ne.y - corners.nw.y) * ratio;
                    const botMidX = corners.sw.x + (corners.se.x - corners.sw.x) * ratio;
                    const botMidY = corners.sw.y + (corners.se.y - corners.sw.y) * ratio;
                    return <line x1={sanitize(topMidX)} y1={sanitize(topMidY)} x2={sanitize(botMidX)} y2={sanitize(botMidY)} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />;
                  }
                }
                if (run.rotation === 0) {
                  const ridgeY = sanitize(ry + h * ratio);
                  return <line x1={sanitize(rx)} y1={ridgeY} x2={sanitize(rx + w)} y2={ridgeY} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />;
                } else {
                  const ridgeX = sanitize(rx + w * ratio);
                  return <line x1={ridgeX} y1={sanitize(ry)} x2={ridgeX} y2={sanitize(ry + h)} stroke="#10b981" strokeWidth="2" strokeDasharray="8 4" />;
                }
              })()}

              {/* Resizing / Corner handles */}
              {['nw', 'ne', 'sw', 'se'].map(handle => {
                const corner = corners[handle as keyof typeof corners];
                const handleColor = (hasCustomShape && isSolidShell) ? "#f59e0b" : "#10b981";
                const isModified = cc && (cc[handle as keyof typeof cc].dx !== 0 || cc[handle as keyof typeof cc].dy !== 0);
                return (
                  <g key={handle}>
                    <rect
                      x={sanitize(corner.x - 5)}
                      y={sanitize(corner.y - 5)}
                      width="10"
                      height="10"
                      fill={isModified ? "#ef4444" : handleColor}
                      stroke={isModified ? "#fff" : "transparent"}
                      strokeWidth={isModified ? "1.5" : "0"}
                      rx={isModified ? "2" : "0"}
                      className="cursor-nwse-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingBlockId(run.id);
                        setResizeHandle(handle);
                        // Ctrl = individual corner mode for Solid Shells
                        if ((e.ctrlKey || e.metaKey) && isSolidShell) {
                          setResizingCornerOnly(true);
                        } else {
                          setResizingCornerOnly(false);
                        }
                      }}
                    />
                    {/* "Ctrl" hint dot on hover for solid shells */}
                    {isSolidShell && isCtrlDown && (
                      <circle
                        cx={sanitize(corner.x)}
                        cy={sanitize(corner.y)}
                        r="3"
                        fill="#ef4444"
                        opacity="0.8"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}

              {/* Rotation Handle */}
              <circle
                cx={sanitize(rx + w / 2)}
                cy={sanitize(ry - 20)}
                r="6"
                fill="#10b981"
                className="cursor-pointer hover:fill-emerald-400"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setTrussRuns(prev => prev.map(t => 
                    t.id === run.id ? { ...t, rotation: t.rotation === 0 ? 90 : 0 } : t
                  ));
                }}
              />
              <line 
                x1={sanitize(rx + w / 2)} 
                y1={sanitize(ry)} 
                x2={sanitize(rx + w / 2)} 
                y2={sanitize(ry - 14)} 
                stroke="#f59e0b" 
                strokeWidth="2" 
              />
            </g>
          )})}

          {/* ─── Valley Lines Between Shells ─── */}
          {roofPlanResult.lines.filter(l => l.type === 'valley').map((line, vi) => (
            <line key={`valley-${vi}`}
              x1={sanitize(line.p1.x)} y1={sanitize(line.p1.y)}
              x2={sanitize(line.p2.x)} y2={sanitize(line.p2.y)}
              stroke="#6366f1" strokeWidth="2.5" strokeDasharray="4 4"
              opacity="0.85"
              pointerEvents="none"
            />
          ))}

          {/* Dormers Layer */}
          {dormers.map(dormer => {
            const w = dormer.rotation === 0 ? dormer.widthIn : dormer.depthIn;
            const h = dormer.rotation === 0 ? dormer.depthIn : dormer.widthIn;
            const rx = dormer.x - w / 2;
            const ry = dormer.y - h / 2;
            
            return (
            <g key={dormer.id} className="dormer-group">
              <rect
                x={sanitize(rx)}
                y={sanitize(ry)}
                width={sanitize(w)}
                height={sanitize(h)}
                fill="rgba(59, 130, 246, 0.15)"
                stroke="#3b82f6"
                strokeWidth="2"
                className="cursor-move hover:fill-blue-500/30 transition-colors"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const pt = getSvgPoint(e);
                  setDraggingBlockId(dormer.id);
                  setDragStartPt(pt);
                  setDragOffset({ x: pt.x - dormer.x, y: pt.y - dormer.y });
                }}
              />
              
              {/* Ridge Line (Dormers typically have a perpendicular ridge) */}
              {dormer.rotation === 0 ? (
                <line x1={sanitize(rx + w / 2)} y1={sanitize(ry)} x2={sanitize(rx + w / 2)} y2={sanitize(ry + h)} stroke="#3b82f6" strokeWidth="2" strokeDasharray="8 4" />
              ) : (
                <line x1={sanitize(rx)} y1={sanitize(ry + h / 2)} x2={sanitize(rx + w)} y2={sanitize(ry + h / 2)} stroke="#3b82f6" strokeWidth="2" strokeDasharray="8 4" />
              )}

              {/* Resizing handles */}
              {['nw', 'ne', 'sw', 'se'].map(handle => (
                <rect
                  key={handle}
                  x={sanitize(rx + (handle.includes('e') ? w : 0) - 5)}
                  y={sanitize(ry + (handle.includes('s') ? h : 0) - 5)}
                  width="10"
                  height="10"
                  fill="#3b82f6"
                  className="cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizingBlockId(dormer.id);
                    setResizeHandle(handle);
                  }}
                />
              ))}

              {/* Rotation Handle */}
              <circle
                cx={sanitize(rx + w / 2)}
                cy={sanitize(ry - 20)}
                r="6"
                fill="#3b82f6"
                className="cursor-pointer hover:fill-blue-400"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDormers(prev => prev.map(d => 
                    d.id === dormer.id ? { ...d, rotation: d.rotation === 0 ? 90 : 0 } : d
                  ));
                }}
              />
              <line 
                x1={sanitize(rx + w / 2)} 
                y1={sanitize(ry)} 
                x2={sanitize(rx + w / 2)} 
                y2={sanitize(ry - 14)} 
                stroke="#60a5fa" 
                strokeWidth="2" 
              />
            </g>
          )})}
        </svg>
      </div>
    </div>
  );

  function renderOpening(opening: DoorConfig | WindowConfig, isDoor: boolean) {
    const wallId = opening.wall;
    const extWall = extWalls.find(w => w.id === wallId);
    const intWall = interiorWalls.find(w => w.id === wallId);
    
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;

    const ox = opening.xFt * 12 + opening.xInches;
    const ow = opening.widthIn;

    if (extWall) {
      if (extWall.isHorizontal) {
        x = extWall.x + ox;
        y = extWall.y;
        w = ow;
        h = extWall.h;
      } else {
        x = extWall.x;
        y = extWall.y + ox;
        w = extWall.w;
        h = ow;
      }
    } else if (intWall) {
      const ix = intWall.xFt * 12 + intWall.xInches;
      const iy = intWall.yFt * 12 + intWall.yInches;
      if (intWall.orientation === 'horizontal') {
        x = ix + ox;
        y = iy;
        w = ow;
        h = intWall.thicknessIn;
      } else {
        x = ix;
        y = iy + ox;
        w = intWall.thicknessIn;
        h = ow;
      }
    } else {
      return null;
    }

    const isDragging = draggingOpening?.id === opening.id;

    return (
      <rect
        key={`opening-${opening.id}`}
        x={sanitize(x)} y={sanitize(y)} width={sanitize(w)} height={sanitize(h)}
        fill={isDragging ? (isDoor ? "#fca5a5" : "#93c5fd") : (isDoor ? "#f87171" : "#60a5fa")}
        stroke={isDragging ? (isDoor ? "#ef4444" : "#3b82f6") : (isDoor ? "#dc2626" : "#2563eb")}
        strokeWidth="1"
        className="cursor-grab hover:brightness-110 transition-all"
        onMouseDown={(e) => handleOpeningMouseDown(e, opening, isDoor ? 'door' : 'window', x, y)}
      />
    );
  }
}
