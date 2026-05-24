/**
 * Shared material estimate computation — used by both the MaterialsEstimate
 * UI component and the Hub bridge so the Dashboard always shows the same
 * total as the Designer.
 */
import { AppState, MaterialCosts, DEFAULT_MATERIAL_COSTS } from '../App';
import { detectBays, computeFramingSupportSystem } from './bayDetection';

export interface EstimateResult {
  quantities: Record<string, number | string>;
  costs: Record<string, number>;
  totalCost: number;
  lineItems: { category: string; name: string; quantity: number; unit: string; unitCost: number; totalCost: number }[];
  roofFinishCostKey: string | null;
  roofFinishName: string;
  interiorFinishCostKey: string | null;
  interiorFinishName: string;
  foundationFinishCostKey: string | null;
  foundationFinishName: string;
  // Per-surface painted material breakdown for the estimate UI
  paintedSurfaceItems: { surfaceId: string; label: string; finishType: string; areaSqFt: number }[];
}

export function computeEstimate(
  state: AppState,
  getWallLength: (wallId: number) => number,
  getAvailableWallOptions: { id: number; label: string }[]
): EstimateResult {
  let extWallLengthIn = 0;

  const w = state.widthFt * 12 + state.widthInches;
  const l = state.lengthFt * 12 + state.lengthInches;

  // For custom shapes, compute bounding dimensions from exterior walls
  let customW = w;
  let customL = l;

  if (state.shape === 'custom') {
    // Use Math.abs() because wall lengths can be negative (indicating direction)
    state.exteriorWalls.forEach(wall => extWallLengthIn += Math.abs(wall.lengthFt * 12 + wall.lengthInches));

    // Compute bounding box from exterior walls for area calculations
    if (state.exteriorWalls.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      state.exteriorWalls.forEach(wall => {
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
      customW = Math.max(1, maxX - minX);
      customL = Math.max(1, maxY - minY);
    }
  } else if (state.shape === 'u-shape') {
    const w1 = state.uWalls.w1 * 12 + state.uWallsInches.w1;
    const w2 = state.uWalls.w2 * 12 + state.uWallsInches.w2;
    const w3 = state.uWalls.w3 * 12 + state.uWallsInches.w3;
    const w4 = state.uWalls.w4 * 12 + state.uWallsInches.w4;
    const w5 = state.uWalls.w5 * 12 + state.uWallsInches.w5;
    const w6 = state.uWalls.w6 * 12 + state.uWallsInches.w6;
    const w7 = state.uWalls.w7 * 12 + state.uWallsInches.w7;
    const w8 = state.uWalls.w8 * 12 + state.uWallsInches.w8;
    extWallLengthIn = w1 + w2 + w3 + w4 + w5 + w6 + w7 + w8;
  } else if (state.shape === 'h-shape') {
    const hMiddleBarHeightIn = state.hMiddleBarHeightFt * 12 + state.hMiddleBarHeightInches;
    extWallLengthIn = (w + l) * 2 + 2 * (l - hMiddleBarHeightIn);
  } else {
    extWallLengthIn = (w + l) * 2;
  }

  // Effective width/length for area-based calculations
  const effectiveW = state.shape === 'custom' ? customW : w;
  const effectiveL = state.shape === 'custom' ? customL : l;

  let totalWallLengthIn = extWallLengthIn;
  state.interiorWalls.forEach(wall => totalWallLengthIn += Math.abs(wall.lengthFt * 12 + wall.lengthInches));

  const totalWallLengthFt = totalWallLengthIn / 12;
  const wallHeightFt = state.wallHeightFt + state.wallHeightInches / 12;
  const totalWallAreaSqFt = totalWallLengthFt * wallHeightFt;
  const extWallAreaSqFt = (extWallLengthIn / 12) * wallHeightFt;

  // Studs
  const baseStuds = Math.ceil(totalWallLengthIn / state.studSpacing);
  const extraStuds = (state.shape === 'custom' ? state.exteriorWalls.length : 8) + state.interiorWalls.length * 2 + (state.doors.length + state.windows.length) * 4;
  const totalStuds = baseStuds + extraStuds;

  // Plates
  const totalPlatesFt = totalWallLengthFt * (state.bottomPlates + state.topPlates);
  const totalPlates = Math.ceil(totalPlatesFt / 8);

  // Sheathing
  const sheathingSheets = (state.addSheathing || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil(extWallAreaSqFt / 32) : 0;

  // Drywall
  const drywallSheets = (state.addDrywall || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil((totalWallAreaSqFt * 2) / 32) : 0;

  // Insulation
  const insulationRolls = (state.addInsulation || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil(extWallAreaSqFt / 40) : 0;

  // Foundation Concrete — varies by type and dimensions
  let concreteCy = 0;
  if (state.foundationType !== 'none') {
    // Floor area in square feet
    let areaSqFt = effectiveW * effectiveL / 144;
    if (state.shape === 'l-shape') {
      const l1 = state.lRightDepthFt * 12 + state.lRightDepthInches;
      const w2 = state.lBackWidthFt * 12 + state.lBackWidthInches;
      areaSqFt = (w * l1 + w2 * (l - l1)) / 144;
    }

    // Perimeter in feet (for stem walls, footings, thickened edges)
    const perimeterFt = extWallLengthIn / 12;

    if (state.foundationType === 'slab') {
      // Simple flat slab — area × slab thickness
      const slabCuFt = areaSqFt * (state.slabThicknessIn / 12);
      concreteCy = slabCuFt / 27;

    } else if (state.foundationType === 'slab-on-grade') {
      // Slab-on-grade: flat slab + thickened perimeter edge
      const slabCuFt = areaSqFt * (state.slabThicknessIn / 12);
      // Thickened edge: perimeter × edge depth × edge width (use footing width for edge width)
      const edgeWidthFt = state.footingWidthIn / 12;
      const edgeExtraDepthFt = (state.thickenedEdgeDepthIn - state.slabThicknessIn) / 12;
      const edgeCuFt = edgeExtraDepthFt > 0 ? perimeterFt * edgeWidthFt * edgeExtraDepthFt : 0;
      concreteCy = (slabCuFt + edgeCuFt) / 27;

    } else if (state.foundationType === 'stem-wall') {
      // Stem wall: vertical walls + continuous footing + optional interior slab
      // Stem wall volume: perimeter × height × thickness
      const stemWallCuFt = perimeterFt * (state.stemWallHeightIn / 12) * (state.stemWallThicknessIn / 12);
      // Footing volume: perimeter × footing width × footing thickness
      const footingCuFt = perimeterFt * (state.footingWidthIn / 12) * (state.footingThicknessIn / 12);
      // Interior slab (if present): area × slab thickness
      const slabCuFt = areaSqFt * (state.slabThicknessIn / 12);
      concreteCy = (stemWallCuFt + footingCuFt + slabCuFt) / 27;
    }
  }

  // Floor Joists — length-aware, size-aware pricing
  const joistPerLFMap: Record<string, keyof MaterialCosts> = {
    '2x6': 'joistPerLF2x6', '2x8': 'joistPerLF2x8',
    '2x10': 'joistPerLF2x10', '2x12': 'joistPerLF2x12',
  };
  const joistPriceKey = joistPerLFMap[state.joistSize] || 'joistPerLF2x10';
  const prices = { ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) };
  const joistPerLF = prices[joistPriceKey] ?? 1.40;

  let floorJoists = 0;
  let joistLengthFt = 0;
  let joistTotalLF = 0;
  let rimJoistLF = 0;
  let subfloorSheets = 0;

  // --- Declaring quantities for girder system ---
  let girderLF = 0;
  let girderCost = 0;
  let pocketBeamLF = 0;
  let pocketBeamCost = 0;
  let supportPostLF = 0;
  let supportPostCount = 0;
  let supportPostCost = 0;
  let pierConcreteCY = 0;
  let pierCount = 0;
  let postCapsCount = 0;
  let postBasesCount = 0;
  let girderBracketsCount = 0;
  let woodToWoodBracketsCount = 0;
  let girderLFCost = 0;
  let postPerLF = 0;
  let pierVolumeCuFt = 0;

  if (state.addFloorFraming || state.noFramingFloorOnly) {
    if (state.floorBays && state.floorBays.length > 0) {
      let totalJoists = 0;
      let totalLF = 0;
      let totalAreaSqFt = 0;

      state.floorBays.forEach(bay => {
        const bw = bay.width;
        const bh = bay.height;
        const dir = bay.joistDirection;

        const distributionIn = dir === 'y' ? bw : bh;
        const perpIn = dir === 'y' ? bh : bw;

        const count = Math.ceil(distributionIn / state.joistSpacing) + 1;
        const lenFt = Math.round(perpIn / 12 * 10) / 10;
        
        totalJoists += count;
        totalLF += Math.round(count * lenFt);
        totalAreaSqFt += (bw * bh) / 144;
      });

      floorJoists = totalJoists;
      joistTotalLF = totalLF;
      rimJoistLF = Math.round(extWallLengthIn / 12);
      joistLengthFt = totalJoists > 0 ? Math.round((totalLF / totalJoists) * 10) / 10 : 0;
      subfloorSheets = (state.addSubfloor || state.noFramingFloorOnly) ? Math.ceil(totalAreaSqFt / 32) : 0;
    } else {
      const areaSqFt = effectiveW * effectiveL / 144;
      const distributionIn = state.joistDirection === 'y' ? effectiveL : effectiveW;
      const perpIn = state.joistDirection === 'y' ? effectiveW : effectiveL;

      floorJoists = Math.ceil(distributionIn / state.joistSpacing);
      joistLengthFt = Math.round(perpIn / 12 * 10) / 10;
      joistTotalLF = Math.round(floorJoists * joistLengthFt);
      subfloorSheets = (state.addSubfloor || state.noFramingFloorOnly) ? Math.ceil(areaSqFt / 32) : 0;
    }

    // --- Floor Girder Support System Quantities ---
    if (state.addFloorFraming && state.enableGirderSystem) {
      const fHeight = state.foundationType === 'none' ? 0 
        : (state.foundationType === 'slab' || state.foundationType === 'slab-on-grade') ? state.slabThicknessIn 
        : state.stemWallHeightIn;

      // Generate active bays
      const mockState = {
        shape: state.shape,
        widthFt: state.widthFt,
        widthInches: state.widthInches,
        lengthFt: state.lengthFt,
        lengthInches: state.lengthInches,
        lRightDepthFt: state.lRightDepthFt,
        lRightDepthInches: state.lRightDepthInches,
        lBackWidthFt: state.lBackWidthFt,
        lBackWidthInches: state.lBackWidthInches,
        lDirection: state.lDirection,
        uWalls: state.uWalls,
        uWallsInches: state.uWallsInches,
        uDirection: state.uDirection,
        hLeftBarWidthFt: state.hLeftBarWidthFt,
        hLeftBarWidthInches: state.hLeftBarWidthInches,
        hRightBarWidthFt: state.hRightBarWidthFt,
        hRightBarWidthInches: state.hRightBarWidthInches,
        hMiddleBarHeightFt: state.hMiddleBarHeightFt,
        hMiddleBarHeightInches: state.hMiddleBarHeightInches,
        hMiddleBarOffsetFt: state.hMiddleBarOffsetFt,
        hMiddleBarOffsetInches: state.hMiddleBarOffsetInches,
        tTopWidthFt: state.tTopWidthFt,
        tTopWidthInches: state.tTopWidthInches,
        tTopLengthFt: state.tTopLengthFt,
        tTopLengthInches: state.tTopLengthInches,
        tStemWidthFt: state.tStemWidthFt,
        tStemWidthInches: state.tStemWidthInches,
        tStemLengthFt: state.tStemLengthFt,
        tStemLengthInches: state.tStemLengthInches,
        combinedBlocks: state.combinedBlocks,
        shapeBlocks: state.shapeBlocks,
      } as any;

      const activeBays = state.floorBays && state.floorBays.length > 0 ? state.floorBays : detectBays(mockState);

      let beamPlies = 3;
      let beamDepthIn = 9.25;
      let customLFPrice = 0;

      if (state.girderSize === '2-2x10') {
        beamPlies = 2;
      } else if (state.girderSize === '4-2x10') {
        beamPlies = 4;
      } else if (state.girderSize === '6x6') {
        beamPlies = 1;
        beamDepthIn = 5.5;
        customLFPrice = joistPerLF * 3;
      } else if (state.girderSize === '6x8') {
        beamPlies = 1;
        beamDepthIn = 7.5;
        customLFPrice = joistPerLF * 4;
      }

      girderLFCost = customLFPrice > 0 ? customLFPrice : (joistPerLF * beamPlies);

      const isRound = state.girderPierSize.includes('Round');
      const pierAreaSq = isRound 
        ? Math.PI * Math.pow(0.5, 2)
        : Math.pow(16 / 12, 2);

      const revealIn = Math.min(6, Math.max(0, fHeight - beamDepthIn));
      const pierHeightFt = (revealIn + 24) / 12;
      pierVolumeCuFt = pierAreaSq * pierHeightFt;

      const parsedBays = activeBays.map(bay => {
        const direction = state.floorBays && state.floorBays.length > 0 ? bay.joistDirection : state.joistDirection;
        return { ...bay, joistDirection: direction };
      });

      const supportSystem = computeFramingSupportSystem(state, parsedBays);

      girderLF = supportSystem.totalGirderLF;
      pocketBeamLF = supportSystem.totalPocketBeamLF;
      supportPostCount = supportSystem.totalSupportPosts;
      pierCount = supportSystem.totalPiers;
      girderBracketsCount = supportSystem.totalSimpsonBrackets;
      woodToWoodBracketsCount = supportSystem.totalWoodToWoodBrackets;

      const beamZ = fHeight - beamDepthIn;
      const postHeightIn = Math.max(0, beamZ - revealIn);
      supportPostLF = Math.round((postHeightIn / 12) * supportPostCount);

      girderCost = girderLF * girderLFCost;
      pocketBeamCost = pocketBeamLF * girderLFCost;

      postPerLF = state.girderPostSize === '4x4' ? 2.50 : 5.00;
      supportPostCost = supportPostLF * postPerLF;
      pierConcreteCY = (pierCount * pierVolumeCuFt) / 27;
      concreteCy += pierConcreteCY;

      postCapsCount = supportPostCount;
      postBasesCount = supportPostCount;
    }
  }


  // Roof Framing
  let roofTrusses = 0;
  let roofSheathingSheets = 0;
  if (state.roofParts.length > 0 || state.trussRuns.length > 0) {
    const pitchFactor = Math.sqrt(1 + Math.pow(state.roofPitch / 12, 2));
    const overhangFt = state.roofOverhangIn / 12;
    const roofAreaSqFt = (state.widthFt + 2 * overhangFt) * (state.lengthFt + 2 * overhangFt) * pitchFactor;
    roofTrusses = Math.ceil((state.lengthFt * 12) / state.trussSpacing) + 1;
    roofSheathingSheets = Math.ceil(roofAreaSqFt / 32);
  }

  // Hardware, Wraps, Foundation Accessories
  // Rebar — varies by foundation type (all as 20' sticks)
  let rebarSticks = 0;
  if (state.foundationType !== 'none') {
    const perimeterFt = extWallLengthIn / 12;

    if (state.foundationType === 'slab') {
      // Slab mesh: #4 rebar @ 24" OC both directions across the slab
      const widthFt = effectiveW / 12;
      const lengthFt = effectiveL / 12;
      const barsAlongWidth = Math.ceil(lengthFt * 12 / 24);   // bars running width-wise
      const barsAlongLength = Math.ceil(widthFt * 12 / 24);    // bars running length-wise
      const meshLF = (barsAlongWidth * widthFt) + (barsAlongLength * lengthFt);
      // Plus 2 perimeter bars around the slab edge
      const perimeterLF = perimeterFt * 2;
      rebarSticks = Math.ceil((meshLF + perimeterLF) / 20);

    } else if (state.foundationType === 'slab-on-grade') {
      // Slab mesh (same as slab)
      const widthFt = effectiveW / 12;
      const lengthFt = effectiveL / 12;
      const barsAlongWidth = Math.ceil(lengthFt * 12 / 24);
      const barsAlongLength = Math.ceil(widthFt * 12 / 24);
      const meshLF = (barsAlongWidth * widthFt) + (barsAlongLength * lengthFt);
      // Thickened edge: 2 continuous horizontal bars in the thickened perimeter
      const edgeLF = perimeterFt * 2;
      rebarSticks = Math.ceil((meshLF + edgeLF) / 20);

    } else if (state.foundationType === 'stem-wall') {
      // Footing: 2-3 continuous horizontal bars
      const footingLF = perimeterFt * 3;
      // Stem wall vertical dowels: every 48" OC around the perimeter
      const verticalDowels = Math.ceil(perimeterFt * 12 / 48);
      const dowelLengthFt = (state.stemWallHeightIn + state.footingThicknessIn + 12) / 12; // extends into footing + 12" lap
      const verticalLF = verticalDowels * dowelLengthFt;
      // Stem wall horizontal bars: 1 course every 24" of wall height (min 2: top & bottom)
      const horizCourses = Math.max(2, Math.ceil(state.stemWallHeightIn / 24));
      const horizLF = horizCourses * perimeterFt;
      // Optional interior slab mesh
      const widthFt = effectiveW / 12;
      const lengthFt = effectiveL / 12;
      const barsAlongWidth = Math.ceil(lengthFt * 12 / 24);
      const barsAlongLength = Math.ceil(widthFt * 12 / 24);
      const meshLF = (barsAlongWidth * widthFt) + (barsAlongLength * lengthFt);
      rebarSticks = Math.ceil((footingLF + verticalLF + horizLF + meshLF) / 20);
    }
  }

  // Anchor bolts — for attaching sill plate to foundation
  let anchorBoltsQty = 0;
  if (state.foundationType !== 'none') {
    const perimeterFt = extWallLengthIn / 12;
    // Code: 1 bolt every 6 ft max, plus within 12" of each corner/end
    const cornerCount = state.shape === 'custom' ? state.exteriorWalls.length : (state.shape === 'rectangle' ? 4 : 8);
    const spacingBolts = Math.ceil(perimeterFt / 6);
    const cornerBolts = cornerCount * 2; // 2 bolts near each corner
    anchorBoltsQty = spacingBolts + cornerBolts;
  }
  const nailsBoxes = Math.ceil(totalWallAreaSqFt / 500);
  const houseWrapRolls = extWallAreaSqFt > 0 ? Math.ceil(extWallAreaSqFt / 900) : 0;
  const joistHangersQty = floorJoists > 0 ? floorJoists * 2 : 0;
  const adhesiveTubes = subfloorSheets > 0 ? Math.ceil(subfloorSheets / 4) : 0;
  const hurricaneTiesQty = roofTrusses > 0 ? roofTrusses * 2 : 0;
  const roofUnderlaymentRolls = roofSheathingSheets > 0 ? Math.ceil((roofSheathingSheets * 32) / 400) : 0;
  const headersLengthIn = state.doors.reduce((sum, d) => sum + d.widthIn, 0) + state.windows.reduce((sum, ww) => sum + ww.widthIn, 0);
  const headersLF = Math.ceil(headersLengthIn / 12);

  // Exterior Finishes — from painted surfaces (3D Material Editor) + dropdown fallback
  let woodSidingQty = 0;
  let vinylSidingQty = 0;
  let hardieBoardQty = 0;
  let brickQty = 0;
  let stuccoQty = 0;

  // Primary: sum areas from painted surfaces (per-surface tracking from 3D view)
  const paintedSurfaces = state.paintedSurfaces || {};
  const hasPaintedSurfaces = Object.keys(paintedSurfaces).length > 0;

  if (hasPaintedSurfaces) {
    Object.values(paintedSurfaces).forEach(({ areaSqFt, finishType }) => {
      if (finishType === 'wood-siding') woodSidingQty += areaSqFt;
      else if (finishType === 'vinyl-siding') vinylSidingQty += areaSqFt;
      else if (finishType === 'hardie-board') hardieBoardQty += areaSqFt;
      else if (finishType === 'brick') brickQty += areaSqFt;
      else if (finishType === 'stucco') stuccoQty += areaSqFt;
    });
  }

  // Fallback: if no surfaces were painted, use dropdown-based per-wall finish assignments
  if (!hasPaintedSurfaces) {
    const extWalls = getAvailableWallOptions.filter(o => !o.label.startsWith('Int'));
    extWalls.forEach(wall => {
      const finish = state.wallFinishes?.[wall.id];
      if (finish && finish !== 'none') {
        const lengthIn = Math.abs(getWallLength(wall.id));
        const areaSqFt = (lengthIn / 12) * wallHeightFt;
        if (finish === 'wood-siding') woodSidingQty += areaSqFt;
        else if (finish === 'vinyl-siding') vinylSidingQty += areaSqFt;
        else if (finish === 'hardie-board') hardieBoardQty += areaSqFt;
        else if (finish === 'brick') brickQty += areaSqFt;
        else if (finish === 'stucco') stuccoQty += areaSqFt;
      }
    });
  }

  woodSidingQty = Math.ceil(woodSidingQty);
  vinylSidingQty = Math.ceil(vinylSidingQty);
  hardieBoardQty = Math.ceil(hardieBoardQty);
  brickQty = Math.ceil(brickQty);
  stuccoQty = Math.ceil(stuccoQty);

  // Surface Finishes
  const getRoofAreaSqFt = () => {
    if (state.roofParts.length === 0 && state.trussRuns.length === 0) return 0;
    const pitchFactor = Math.sqrt(1 + Math.pow(state.roofPitch / 12, 2));
    const overhangFt = state.roofOverhangIn / 12;
    return (state.widthFt + 2 * overhangFt) * (state.lengthFt + 2 * overhangFt) * pitchFactor;
  };
  const getInteriorAreaSqFt = () => (totalWallAreaSqFt * 2) - extWallAreaSqFt;
  const getFoundationAreaSqFt = () => {
    if (state.foundationType === 'none') return 0;
    return (extWallLengthIn / 12) * (state.stemWallHeightIn / 12);
  };

  const roofFinishCostMap: Record<string, keyof MaterialCosts> = {
    'asphalt-3tab': 'asphalt3Tab', 'architectural-shingles': 'architecturalShingles',
    'metal-standing-seam': 'metalStandingSeam', 'clay-tile': 'clayTile', 'slate': 'slateTile',
    'wood-shakes': 'woodShakes', 'tpo-membrane': 'tpoMembrane', 'roof-paint': 'roofPaint'
  };
  const roofFinishNameMap: Record<string, string> = {
    'asphalt-3tab': 'Asphalt Shingles 3-Tab', 'architectural-shingles': 'Architectural Shingles',
    'metal-standing-seam': 'Metal Roofing (Standing Seam)', 'clay-tile': 'Clay Tile',
    'slate': 'Slate', 'wood-shakes': 'Wood Shakes', 'tpo-membrane': 'TPO / Flat Membrane',
    'roof-paint': 'Roof Paint (Elastomeric)'
  };
  const roofFinishSqFt = state.roofFinish !== 'none' ? Math.ceil(getRoofAreaSqFt()) : 0;
  const roofFinishCostKey = roofFinishCostMap[state.roofFinish] || null;

  const interiorFinishCostMap: Record<string, keyof MaterialCosts> = {
    'paint-standard': 'paintStandard', 'paint-premium': 'paintPremium',
    'wallpaper': 'wallpaper', 'tile': 'interiorTile', 'wood-paneling': 'woodPaneling',
    'wainscoting': 'wainscoting'
  };
  const interiorFinishNameMap: Record<string, string> = {
    'paint-standard': 'Interior Paint (Standard)', 'paint-premium': 'Interior Paint (Premium)',
    'wallpaper': 'Wallpaper', 'tile': 'Interior Tile', 'wood-paneling': 'Wood Paneling',
    'wainscoting': 'Wainscoting'
  };
  const interiorFinishSqFt = state.interiorFinish !== 'none' ? Math.ceil(getInteriorAreaSqFt()) : 0;
  const interiorFinishCostKey = interiorFinishCostMap[state.interiorFinish] || null;

  const foundationFinishCostMap: Record<string, keyof MaterialCosts> = {
    'paint': 'foundationPaint', 'waterproof-coating': 'waterproofCoating',
    'stucco-parging': 'stuccoParging', 'stone-veneer': 'stoneVeneer'
  };
  const foundationFinishNameMap: Record<string, string> = {
    'paint': 'Foundation Paint', 'waterproof-coating': 'Waterproof Coating',
    'stucco-parging': 'Stucco Parging', 'stone-veneer': 'Stone Veneer'
  };
  const foundationFinishSqFt = state.foundationFinish !== 'none' ? Math.ceil(getFoundationAreaSqFt()) : 0;
  const foundationFinishCostKey = foundationFinishCostMap[state.foundationFinish] || null;



  const costs: Record<string, number> = {
    studs: totalStuds * prices.stud,
    plates: totalPlates * prices.plate,
    sheathing: sheathingSheets * prices.sheathing,
    drywall: drywallSheets * prices.drywall,
    insulation: insulationRolls * prices.insulation,
    concrete: concreteCy * prices.concrete,
    joists: joistTotalLF * joistPerLF,
    rimJoists: rimJoistLF * joistPerLF,
    girders: girderCost + pocketBeamCost,
    supportPosts: supportPostCost,
    postCaps: postCapsCount * 12.50,
    postBases: postBasesCount * 15.00,
    girderBrackets: (girderBracketsCount * 35.00) + (woodToWoodBracketsCount * 25.00),
    subfloor: subfloorSheets * prices.subfloor,
    doors: state.doors.length * prices.door,
    windows: state.windows.length * prices.window,
    trusses: roofTrusses * prices.truss,
    roofSheathing: roofSheathingSheets * prices.roofSheathing,
    rebar: rebarSticks * prices.rebar,
    nails: nailsBoxes * prices.nails,
    hurricaneTies: hurricaneTiesQty * prices.hurricaneTies,
    anchorBolts: anchorBoltsQty * prices.anchorBolts,
    joistHangers: joistHangersQty * prices.joistHangers,
    adhesive: adhesiveTubes * prices.adhesive,
    roofUnderlayment: roofUnderlaymentRolls * prices.roofUnderlayment,
    houseWrap: houseWrapRolls * prices.houseWrap,
    headers: headersLF * prices.header,
    woodSiding: woodSidingQty * prices.woodSiding,
    vinylSiding: vinylSidingQty * prices.vinylSiding,
    hardieBoard: hardieBoardQty * prices.hardieBoard,
    brick: brickQty * prices.brick,
    stucco: stuccoQty * prices.stucco,
    roofFinish: roofFinishCostKey ? roofFinishSqFt * prices[roofFinishCostKey] : 0,
    interiorFinish: interiorFinishCostKey ? interiorFinishSqFt * prices[interiorFinishCostKey] : 0,
    foundationFinish: foundationFinishCostKey ? foundationFinishSqFt * prices[foundationFinishCostKey] : 0,
  };

  const baseTotalCost = Object.values(costs).reduce((a, b) => a + b, 0);
  const customItemsCost = (state.customCostItems || []).reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  const totalCost = baseTotalCost + customItemsCost;

  // Build line items for bridge payload
  const lineItems: { category: string; name: string; quantity: number; unit: string; unitCost: number; totalCost: number }[] = [
    { category: 'Foundation', name: 'Concrete', quantity: +concreteCy.toFixed(1), unit: 'cy', unitCost: prices.concrete, totalCost: costs.concrete },
    { category: 'Foundation', name: 'Rebar', quantity: rebarSticks, unit: 'ea', unitCost: prices.rebar, totalCost: costs.rebar },
    { category: 'Foundation', name: 'Anchor Bolts', quantity: anchorBoltsQty, unit: 'ea', unitCost: prices.anchorBolts, totalCost: costs.anchorBolts },
    { category: 'Floor System', name: `Floor Joists (${state.joistSize}, ${joistLengthFt}' ea)`, quantity: joistTotalLF, unit: 'lf', unitCost: joistPerLF, totalCost: costs.joists },
    { category: 'Floor System', name: `Rim Joists (${state.joistSize})`, quantity: rimJoistLF, unit: 'lf', unitCost: joistPerLF, totalCost: costs.rimJoists },
    { category: 'Floor System', name: 'Joist Hangers', quantity: joistHangersQty, unit: 'ea', unitCost: prices.joistHangers, totalCost: costs.joistHangers },
    { category: 'Floor System', name: 'Subfloor Sheets', quantity: subfloorSheets, unit: 'sheets', unitCost: prices.subfloor, totalCost: costs.subfloor },
    { category: 'Floor System', name: 'Subfloor Adhesive', quantity: adhesiveTubes, unit: 'tubes', unitCost: prices.adhesive, totalCost: costs.adhesive },
    ...(state.enableGirderSystem && girderLF > 0 ? [
      { category: 'Floor System', name: `Floor Girders (${state.girderSize})`, quantity: girderLF, unit: 'lf', unitCost: girderLFCost, totalCost: girderCost }
    ] : []),
    ...(state.enableGirderSystem && pocketBeamLF > 0 ? [
      { category: 'Floor System', name: `Pocket Beams (${state.girderSize})`, quantity: pocketBeamLF, unit: 'lf', unitCost: girderLFCost, totalCost: pocketBeamCost }
    ] : []),
    ...(state.enableGirderSystem && supportPostLF > 0 ? [
      { category: 'Floor System', name: `Floor Support Posts (${state.girderPostSize})`, quantity: supportPostLF, unit: 'lf', unitCost: postPerLF, totalCost: supportPostCost },
      { category: 'Floor System', name: `Post-to-Beam Caps (${state.girderPostSize})`, quantity: postCapsCount, unit: 'ea', unitCost: 12.50, totalCost: postCapsCount * 12.50 },
      { category: 'Floor System', name: `Post Base Anchors (${state.girderPostSize})`, quantity: postBasesCount, unit: 'ea', unitCost: 15.00, totalCost: postBasesCount * 15.00 }
    ] : []),
    ...(state.enableGirderSystem && girderBracketsCount > 0 ? [
      { category: 'Floor System', name: `Simpson Heavy Girder Wall Brackets`, quantity: girderBracketsCount, unit: 'ea', unitCost: 35.00, totalCost: girderBracketsCount * 35.00 }
    ] : []),
    ...(state.enableGirderSystem && woodToWoodBracketsCount > 0 ? [
      { category: 'Floor System', name: `Simpson Girder Wood Hangers`, quantity: woodToWoodBracketsCount, unit: 'ea', unitCost: 25.00, totalCost: woodToWoodBracketsCount * 25.00 }
    ] : []),
    { category: 'Walls', name: 'Wall Studs', quantity: totalStuds, unit: 'ea', unitCost: prices.stud, totalCost: costs.studs },
    { category: 'Walls', name: 'Plates', quantity: totalPlates, unit: 'ea', unitCost: prices.plate, totalCost: costs.plates },
    { category: 'Walls', name: 'Sheathing', quantity: sheathingSheets, unit: 'sheets', unitCost: prices.sheathing, totalCost: costs.sheathing },
    { category: 'Walls', name: 'House Wrap', quantity: houseWrapRolls, unit: 'rolls', unitCost: prices.houseWrap, totalCost: costs.houseWrap },
    { category: 'Walls', name: 'Drywall', quantity: drywallSheets, unit: 'sheets', unitCost: prices.drywall, totalCost: costs.drywall },
    { category: 'Walls', name: 'Insulation', quantity: insulationRolls, unit: 'rolls', unitCost: prices.insulation, totalCost: costs.insulation },
    { category: 'Walls', name: 'Framing Nails', quantity: nailsBoxes, unit: 'boxes', unitCost: prices.nails, totalCost: costs.nails },
    { category: 'Walls', name: 'Headers', quantity: headersLF, unit: 'lf', unitCost: prices.header, totalCost: costs.headers },
    { category: 'Roof', name: 'Roof Trusses', quantity: roofTrusses, unit: 'ea', unitCost: prices.truss, totalCost: costs.trusses },
    { category: 'Roof', name: 'Hurricane Ties', quantity: hurricaneTiesQty, unit: 'ea', unitCost: prices.hurricaneTies, totalCost: costs.hurricaneTies },
    { category: 'Roof', name: 'Roof Sheathing', quantity: roofSheathingSheets, unit: 'sheets', unitCost: prices.roofSheathing, totalCost: costs.roofSheathing },
    { category: 'Roof', name: 'Roof Underlayment', quantity: roofUnderlaymentRolls, unit: 'rolls', unitCost: prices.roofUnderlayment, totalCost: costs.roofUnderlayment },
    { category: 'Windows & Doors', name: 'Doors', quantity: state.doors.length, unit: 'ea', unitCost: prices.door, totalCost: costs.doors },
    { category: 'Windows & Doors', name: 'Windows', quantity: state.windows.length, unit: 'ea', unitCost: prices.window, totalCost: costs.windows },
    // Surface finishes
    ...(woodSidingQty > 0 ? [{ category: 'Surface Finishes', name: 'Wood Siding', quantity: woodSidingQty, unit: 'sqft', unitCost: prices.woodSiding, totalCost: costs.woodSiding }] : []),
    ...(vinylSidingQty > 0 ? [{ category: 'Surface Finishes', name: 'Vinyl Siding', quantity: vinylSidingQty, unit: 'sqft', unitCost: prices.vinylSiding, totalCost: costs.vinylSiding }] : []),
    ...(hardieBoardQty > 0 ? [{ category: 'Surface Finishes', name: 'Hardie Board', quantity: hardieBoardQty, unit: 'sqft', unitCost: prices.hardieBoard, totalCost: costs.hardieBoard }] : []),
    ...(brickQty > 0 ? [{ category: 'Surface Finishes', name: 'Brick', quantity: brickQty, unit: 'sqft', unitCost: prices.brick, totalCost: costs.brick }] : []),
    ...(stuccoQty > 0 ? [{ category: 'Surface Finishes', name: 'Stucco', quantity: stuccoQty, unit: 'sqft', unitCost: prices.stucco, totalCost: costs.stucco }] : []),
    ...(roofFinishCostKey && roofFinishSqFt > 0 ? [{ category: 'Surface Finishes', name: roofFinishNameMap[state.roofFinish] || 'Roof Finish', quantity: roofFinishSqFt, unit: 'sqft', unitCost: prices[roofFinishCostKey], totalCost: costs.roofFinish }] : []),
    ...(interiorFinishCostKey && interiorFinishSqFt > 0 ? [{ category: 'Surface Finishes', name: interiorFinishNameMap[state.interiorFinish] || 'Interior Finish', quantity: interiorFinishSqFt, unit: 'sqft', unitCost: prices[interiorFinishCostKey], totalCost: costs.interiorFinish }] : []),
    ...(foundationFinishCostKey && foundationFinishSqFt > 0 ? [{ category: 'Surface Finishes', name: foundationFinishNameMap[state.foundationFinish] || 'Foundation Finish', quantity: foundationFinishSqFt, unit: 'sqft', unitCost: prices[foundationFinishCostKey], totalCost: costs.foundationFinish }] : []),
    ...(state.customCostItems || []).map(item => ({
      category: item.category || 'Custom',
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost: item.quantity * item.unitCost,
    })),
  ].filter(item => item.quantity > 0);

  // Build per-surface breakdown for the estimate UI
  const surfaceLabel = (id: string): string => {
    if (id.startsWith('ext-wall-')) return `Ext Wall Face #${parseInt(id.replace('ext-wall-','')) + 1}`;
    if (id.startsWith('int-wall-')) return `Int Wall Face #${parseInt(id.replace('int-wall-','')) + 1}`;
    if (id.startsWith('drywall-')) return `Drywall Face #${parseInt(id.replace('drywall-','')) + 1}`;
    if (id === 'foundation') return 'Foundation';
    if (id === 'ground') return 'Ground';
    if (id === 'floor') return 'Floor';
    if (id.startsWith('roof-')) return `Roof Face (${id})`;
    return id;
  };

  const finishDisplayName = (ft: string): string => {
    const map: Record<string, string> = {
      'wood-siding': 'Wood Siding', 'vinyl-siding': 'Vinyl Siding', 'hardie-board': 'Hardie Board',
      'brick': 'Brick', 'stucco': 'Stucco', 'metal-standing-seam': 'Metal (Standing Seam)',
      'stone-veneer': 'Stone Veneer', 'tile': 'Tile', 'paint': 'Paint', 'concrete': 'Concrete',
      'custom-texture': 'Custom Texture'
    };
    return map[ft] || ft;
  };

  const paintedSurfaceItems = Object.entries(paintedSurfaces).map(([surfaceId, { areaSqFt, finishType }]) => ({
    surfaceId,
    label: surfaceLabel(surfaceId),
    finishType: finishDisplayName(finishType),
    areaSqFt: Math.ceil(areaSqFt),
  }));

  return {
    quantities: {
      studs: totalStuds, plates: totalPlates, sheathing: sheathingSheets,
      drywall: drywallSheets, insulation: insulationRolls,
      concrete: concreteCy.toFixed(1), joists: floorJoists, joistTotalLF, joistLengthFt, rimJoistLF, subfloor: subfloorSheets,
      doors: state.doors.length, windows: state.windows.length,
      trusses: roofTrusses, roofSheathing: roofSheathingSheets,
      rebar: rebarSticks, nails: nailsBoxes, hurricaneTies: hurricaneTiesQty,
      anchorBolts: anchorBoltsQty, joistHangers: joistHangersQty,
      adhesive: adhesiveTubes, roofUnderlayment: roofUnderlaymentRolls,
      houseWrap: houseWrapRolls, headers: headersLF,
      woodSiding: woodSidingQty, vinylSiding: vinylSidingQty,
      hardieBoard: hardieBoardQty, brick: brickQty, stucco: stuccoQty,
      roofFinishSqFt, interiorFinishSqFt, foundationFinishSqFt,
      girderLF, pocketBeamLF, supportPostLF, postCapsCount, postBasesCount, girderBracketsCount, woodToWoodBracketsCount,
    },
    costs,
    totalCost,
    lineItems,
    roofFinishCostKey: roofFinishCostKey as string | null,
    roofFinishName: roofFinishNameMap[state.roofFinish] || '',
    interiorFinishCostKey: interiorFinishCostKey as string | null,
    interiorFinishName: interiorFinishNameMap[state.interiorFinish] || '',
    foundationFinishCostKey: foundationFinishCostKey as string | null,
    foundationFinishName: foundationFinishNameMap[state.foundationFinish] || '',
    paintedSurfaceItems,
  };
}
