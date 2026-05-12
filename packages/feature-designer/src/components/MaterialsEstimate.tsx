import React, { useMemo, useState } from 'react';
import { AppState, MaterialCosts, DEFAULT_MATERIAL_COSTS } from '../App';
import { sanitize } from '../utils/math';
import { Calculator, DollarSign, Package, Edit2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  state: AppState;
  getWallLength: (wallId: number) => number;
  getAvailableWallOptions: { id: number, label: string }[];
  onUpdateCosts: (costs: MaterialCosts) => void;
}

export default function MaterialsEstimate({ state, getWallLength, getAvailableWallOptions, onUpdateCosts }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCosts, setEditCosts] = useState<MaterialCosts>(state.materialCosts || DEFAULT_MATERIAL_COSTS);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Foundation': true,
    'Floor System': true,
    'Walls': true,
    'Roof': true,
    'Windows & Doors': true,
    'Surface Finishes': true
  });

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  React.useEffect(() => {
    if (!isEditing) {
      setEditCosts(state.materialCosts || DEFAULT_MATERIAL_COSTS);
    }
  }, [state.materialCosts, isEditing]);

  const handleSaveCosts = () => {
    onUpdateCosts(editCosts);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditCosts(state.materialCosts || DEFAULT_MATERIAL_COSTS);
    setIsEditing(false);
  };

  const estimate = useMemo(() => {
    let extWallLengthIn = 0;

    const w = state.widthFt * 12 + state.widthInches;
    const l = state.lengthFt * 12 + state.lengthInches;

    if (state.shape === 'custom') {
      state.exteriorWalls.forEach(wall => extWallLengthIn += (wall.lengthFt * 12 + wall.lengthInches));
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
      // rectangle, l-shape, t-shape all have perimeter equal to their bounding box
      extWallLengthIn = (w + l) * 2;
    }

    let totalWallLengthIn = extWallLengthIn;
    state.interiorWalls.forEach(wall => totalWallLengthIn += (wall.lengthFt * 12 + wall.lengthInches));

    const totalWallLengthFt = totalWallLengthIn / 12;
    const wallHeightFt = state.wallHeightFt + state.wallHeightInches / 12;
    const totalWallAreaSqFt = totalWallLengthFt * wallHeightFt;
    const extWallAreaSqFt = (extWallLengthIn / 12) * wallHeightFt;

    // Studs (approx 1 per studSpacing, plus extras for corners/openings)
    const baseStuds = Math.ceil(totalWallLengthIn / state.studSpacing);
    const extraStuds = (state.shape === 'custom' ? state.exteriorWalls.length : 8) + state.interiorWalls.length * 2 + (state.doors.length + state.windows.length) * 4;
    const totalStuds = baseStuds + extraStuds;

    // Plates (Top and Bottom)
    const totalPlatesFt = totalWallLengthFt * (state.bottomPlates + state.topPlates);
    const totalPlates = Math.ceil(totalPlatesFt / 8); // Assuming 8' plates

    // Sheathing (Exterior only)
    const sheathingSheets = (state.addSheathing || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil(extWallAreaSqFt / 32) : 0; // 4x8 sheet = 32 sq ft

    // Drywall (Interior and Exterior)
    const drywallSheets = (state.addDrywall || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil((totalWallAreaSqFt * 2) / 32) : 0; // Assuming both sides for interior, one for exterior (simplified)

    // Insulation (Exterior walls)
    const insulationRolls = (state.addInsulation || state.solidWallsOnly || state.noFramingFloorOnly) ? Math.ceil(extWallAreaSqFt / 40) : 0; // Assuming 40 sq ft per roll

    // Foundation Concrete (Simplified for bounding box area)
    let concreteCy = 0;
    if (state.foundationType !== 'none') {
      let areaSqFt = w * l / 144;
      if (state.shape === 'l-shape') {
        const l1 = state.lRightDepthFt * 12 + state.lRightDepthInches;
        const w2 = state.lBackWidthFt * 12 + state.lBackWidthInches;
        areaSqFt = (w * l1 + w2 * (l - l1)) / 144;
      }
      // For simplicity on other shapes, we use bounding box or rough estimate
      const volumeCuFt = areaSqFt * (state.slabThicknessIn / 12);
      concreteCy = volumeCuFt / 27;
    }

    // Floor Joists
    let floorJoists = 0;
    let subfloorSheets = 0;
    if (state.addFloorFraming || state.noFramingFloorOnly) {
      const areaSqFt = w * l / 144;
      const spanIn = state.joistDirection === 'y' ? l : w;
      floorJoists = Math.ceil(spanIn / state.joistSpacing);
      subfloorSheets = (state.addSubfloor || state.noFramingFloorOnly) ? Math.ceil(areaSqFt / 32) : 0;
    }

    // Roof Framing
    let roofTrusses = 0;
    let roofSheathingSheets = 0;
    if (state.roofParts.length > 0 || state.trussRuns.length > 0) {
      const footprintAreaSqFt = w * l / 144;
      const pitchFactor = Math.sqrt(1 + Math.pow(state.roofPitch / 12, 2));
      const overhangFt = state.roofOverhangIn / 12;
      
      // Rough estimate for roof area including overhangs
      const roofAreaSqFt = (state.widthFt + 2 * overhangFt) * (state.lengthFt + 2 * overhangFt) * pitchFactor;
      
      roofTrusses = Math.ceil((state.lengthFt * 12) / state.trussSpacing) + 1;
      roofSheathingSheets = Math.ceil(roofAreaSqFt / 32);
    }

    // New Items (Hardware, Wraps, Foundation Accessories)
    const rebarSticks = state.foundationType !== 'none' ? Math.ceil((extWallLengthIn / 12 * 2) / 20) : 0; // 2 runs continuous
    const anchorBoltsQty = state.foundationType !== 'none' ? Math.ceil((extWallLengthIn / 12) / 6) : 0; // 1 every 6 ft
    const nailsBoxes = Math.ceil(totalWallAreaSqFt / 500); // 1 box per 500 sq ft wall area
    const houseWrapRolls = extWallAreaSqFt > 0 ? Math.ceil(extWallAreaSqFt / 900) : 0; // 9'x100' roll
    const joistHangersQty = floorJoists > 0 ? floorJoists * 2 : 0; // 2 per joist
    const adhesiveTubes = subfloorSheets > 0 ? Math.ceil(subfloorSheets / 4) : 0; // 1 tube per 4 sheets
    const hurricaneTiesQty = roofTrusses > 0 ? roofTrusses * 2 : 0; // 2 per truss
    const roofUnderlaymentRolls = roofSheathingSheets > 0 ? Math.ceil((roofSheathingSheets * 32) / 400) : 0; // 400 sq ft roll
    const headersLengthIn = state.doors.reduce((sum, d) => sum + d.widthIn, 0) + state.windows.reduce((sum, w) => sum + w.widthIn, 0);
    const headersLF = Math.ceil(headersLengthIn / 12);
    
    // Exterior Finishes
    let woodSidingQty = 0;
    let vinylSidingQty = 0;
    let hardieBoardQty = 0;
    let brickQty = 0;
    let stuccoQty = 0;

    const extWalls = getAvailableWallOptions.filter(o => !o.label.startsWith('Int'));
    extWalls.forEach(wall => {
      const finish = state.wallFinishes?.[wall.id];
      if (finish && finish !== 'none') {
        const lengthIn = getWallLength(wall.id);
        const areaSqFt = (lengthIn / 12) * wallHeightFt;
        
        if (finish === 'wood-siding') woodSidingQty += areaSqFt;
        else if (finish === 'vinyl-siding') vinylSidingQty += areaSqFt;
        else if (finish === 'hardie-board') hardieBoardQty += areaSqFt;
        else if (finish === 'brick') brickQty += areaSqFt;
        else if (finish === 'stucco') stuccoQty += areaSqFt;
      }
    });

    woodSidingQty = Math.ceil(woodSidingQty);
    vinylSidingQty = Math.ceil(vinylSidingQty);
    hardieBoardQty = Math.ceil(hardieBoardQty);
    brickQty = Math.ceil(brickQty);
    stuccoQty = Math.ceil(stuccoQty);

    // Surface Finishes — material-based area calculations
    // Helper: get roof area
    const getRoofAreaSqFt = () => {
      if (state.roofParts.length === 0 && state.trussRuns.length === 0) return 0;
      const pitchFactor = Math.sqrt(1 + Math.pow(state.roofPitch / 12, 2));
      const overhangFt = state.roofOverhangIn / 12;
      return (state.widthFt + 2 * overhangFt) * (state.lengthFt + 2 * overhangFt) * pitchFactor;
    };

    // Helper: get interior wall area (both sides of interior walls + inside face of exterior walls)
    const getInteriorAreaSqFt = () => (totalWallAreaSqFt * 2) - extWallAreaSqFt;

    // Helper: get foundation exposed area
    const getFoundationAreaSqFt = () => {
      if (state.foundationType === 'none') return 0;
      return (extWallLengthIn / 12) * (state.stemWallHeightIn / 12);
    };

    // Roof finish
    const roofFinishCostMap: Record<string, keyof MaterialCosts> = {
      'asphalt-3tab': 'asphalt3Tab',
      'architectural-shingles': 'architecturalShingles',
      'metal-standing-seam': 'metalStandingSeam',
      'clay-tile': 'clayTile',
      'slate': 'slateTile',
      'wood-shakes': 'woodShakes',
      'tpo-membrane': 'tpoMembrane',
      'roof-paint': 'roofPaint'
    };
    const roofFinishNameMap: Record<string, string> = {
      'asphalt-3tab': 'Asphalt Shingles 3-Tab',
      'architectural-shingles': 'Architectural Shingles',
      'metal-standing-seam': 'Metal Roofing (Standing Seam)',
      'clay-tile': 'Clay Tile',
      'slate': 'Slate',
      'wood-shakes': 'Wood Shakes',
      'tpo-membrane': 'TPO / Flat Membrane',
      'roof-paint': 'Roof Paint (Elastomeric)'
    };
    const roofFinishSqFt = state.roofFinish !== 'none' ? Math.ceil(getRoofAreaSqFt()) : 0;
    const roofFinishCostKey = roofFinishCostMap[state.roofFinish] || null;

    // Interior finish
    const interiorFinishCostMap: Record<string, keyof MaterialCosts> = {
      'paint-standard': 'paintStandard',
      'paint-premium': 'paintPremium',
      'wallpaper': 'wallpaper',
      'tile': 'interiorTile',
      'wood-paneling': 'woodPaneling',
      'wainscoting': 'wainscoting'
    };
    const interiorFinishNameMap: Record<string, string> = {
      'paint-standard': 'Interior Paint (Standard)',
      'paint-premium': 'Interior Paint (Premium)',
      'wallpaper': 'Wallpaper',
      'tile': 'Interior Tile',
      'wood-paneling': 'Wood Paneling',
      'wainscoting': 'Wainscoting'
    };
    const interiorFinishSqFt = state.interiorFinish !== 'none' ? Math.ceil(getInteriorAreaSqFt()) : 0;
    const interiorFinishCostKey = interiorFinishCostMap[state.interiorFinish] || null;

    // Foundation finish
    const foundationFinishCostMap: Record<string, keyof MaterialCosts> = {
      'paint': 'foundationPaint',
      'waterproof-coating': 'waterproofCoating',
      'stucco-parging': 'stuccoParging',
      'stone-veneer': 'stoneVeneer'
    };
    const foundationFinishNameMap: Record<string, string> = {
      'paint': 'Foundation Paint',
      'waterproof-coating': 'Waterproof Coating',
      'stucco-parging': 'Stucco Parging',
      'stone-veneer': 'Stone Veneer'
    };
    const foundationFinishSqFt = state.foundationFinish !== 'none' ? Math.ceil(getFoundationAreaSqFt()) : 0;
    const foundationFinishCostKey = foundationFinishCostMap[state.foundationFinish] || null;

    // Basic Cost Assumptions (National Averages)
    const prices = state.materialCosts || DEFAULT_MATERIAL_COSTS;

    const costs = {
      studs: totalStuds * prices.stud,
      plates: totalPlates * prices.plate,
      sheathing: sheathingSheets * prices.sheathing,
      drywall: drywallSheets * prices.drywall,
      insulation: insulationRolls * prices.insulation,
      concrete: concreteCy * prices.concrete,
      joists: floorJoists * prices.joist,
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
      foundationFinish: foundationFinishCostKey ? foundationFinishSqFt * prices[foundationFinishCostKey] : 0
    };

    const totalCost = Object.values(costs).reduce((a, b) => a + b, 0);

    return {
      quantities: {
        studs: totalStuds,
        plates: totalPlates,
        sheathing: sheathingSheets,
        drywall: drywallSheets,
        insulation: insulationRolls,
        concrete: concreteCy.toFixed(1),
        joists: floorJoists,
        subfloor: subfloorSheets,
        doors: state.doors.length,
        windows: state.windows.length,
        trusses: roofTrusses,
        roofSheathing: roofSheathingSheets,
        rebar: rebarSticks,
        nails: nailsBoxes,
        hurricaneTies: hurricaneTiesQty,
        anchorBolts: anchorBoltsQty,
        joistHangers: joistHangersQty,
        adhesive: adhesiveTubes,
        roofUnderlayment: roofUnderlaymentRolls,
        houseWrap: houseWrapRolls,
        headers: headersLF,
        woodSiding: woodSidingQty,
        vinylSiding: vinylSidingQty,
        hardieBoard: hardieBoardQty,
        brick: brickQty,
        stucco: stuccoQty,
        roofFinishSqFt,
        interiorFinishSqFt,
        foundationFinishSqFt
      },
      costs,
      // Pass through finish metadata for spreadsheet display
      roofFinishCostKey,
      roofFinishName: roofFinishNameMap[state.roofFinish] || '',
      interiorFinishCostKey,
      interiorFinishName: interiorFinishNameMap[state.interiorFinish] || '',
      foundationFinishCostKey,
      foundationFinishName: foundationFinishNameMap[state.foundationFinish] || '',
      totalCost
    };
  }, [state, getWallLength, getAvailableWallOptions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleCostChange = (key: keyof MaterialCosts, value: string) => {
    const numValue = parseFloat(value);
    setEditCosts(prev => ({
      ...prev,
      [key]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const displayTotalCost = isEditing 
    ? Object.keys(editCosts).reduce((total, key) => {
        const qtyKey = key === 'stud' ? 'studs' : 
                       key === 'plate' ? 'plates' : 
                       key === 'joist' ? 'joists' : 
                       key === 'door' ? 'doors' : 
                       key === 'window' ? 'windows' : 
                       key === 'header' ? 'headers' : key;
        return total + Number(estimate.quantities[qtyKey as keyof typeof estimate.quantities]) * editCosts[key as keyof MaterialCosts];
      }, 0)
    : estimate.totalCost;

  return (
    <div className="p-4 border-t border-zinc-200 dark:border-[#1c2240] bg-zinc-50 dark:bg-[#252526] space-y-4">
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Estimated Material Cost</span>
          <DollarSign size={16} className="text-emerald-600 dark:text-emerald-500" />
        </div>
        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
          {formatCurrency(displayTotalCost)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Package size={14} className="text-indigo-500 dark:text-indigo-400" />
            Materials Spreadsheet
          </h3>
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#151a2e] hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-700 dark:text-zinc-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-200 dark:border-[#243052] shadow-sm"
            >
              <Edit2 size={12} />
              Edit Costs
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#151a2e] hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-200 dark:border-[#243052] shadow-sm"
              >
                <X size={12} />
                Cancel
              </button>
              <button 
                onClick={handleSaveCosts}
                className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                <Save size={12} />
                Save
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-zinc-200 dark:border-[#1c2240] rounded-lg bg-white dark:bg-[#0f1424] shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-[#151a2e]/50 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[9px] border-b border-zinc-200 dark:border-[#1c2240]">
              <tr>
                <th className="px-3 py-2 font-bold">Material</th>
                <th className="px-3 py-2 font-bold text-right">Qty</th>
                <th className="px-3 py-2 font-bold text-right">Unit Cost</th>
                <th className="px-3 py-2 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {[
                {
                  title: 'Foundation',
                  items: [
                    { id: 'concrete', name: "Concrete (CY)", qty: estimate.quantities.concrete, active: state.foundationType !== 'none' },
                    { id: 'rebar', name: "Rebar 20' Sticks", qty: estimate.quantities.rebar, active: state.foundationType !== 'none' },
                    { id: 'anchorBolts', name: "Anchor Bolts", qty: estimate.quantities.anchorBolts, active: state.foundationType !== 'none' },
                  ]
                },
                {
                  title: 'Floor System',
                  items: [
                    { id: 'joist', name: "Floor Joists", qty: estimate.quantities.joists, active: state.addFloorFraming },
                    { id: 'joistHangers', name: "Joist Hangers", qty: estimate.quantities.joistHangers, active: state.addFloorFraming },
                    { id: 'subfloor', name: "Subfloor (4x8)", qty: estimate.quantities.subfloor, active: state.addFloorFraming && state.addSubfloor },
                    { id: 'adhesive', name: "Subfloor Adhesive", qty: estimate.quantities.adhesive, active: state.addFloorFraming && state.addSubfloor },
                  ]
                },
                {
                  title: 'Walls',
                  items: [
                    { id: 'stud', name: "Wall Studs (8')", qty: estimate.quantities.studs, active: true },
                    { id: 'plate', name: "Plates (8')", qty: estimate.quantities.plates, active: true },
                    { id: 'sheathing', name: "Sheathing (4x8)", qty: estimate.quantities.sheathing, active: state.addSheathing || state.solidWallsOnly },
                    { id: 'houseWrap', name: "House Wrap (Rolls)", qty: estimate.quantities.houseWrap, active: state.addSheathing || state.solidWallsOnly },
                    { id: 'drywall', name: "Drywall (4x8)", qty: estimate.quantities.drywall, active: state.addDrywall || state.solidWallsOnly },
                    { id: 'insulation', name: "Insulation (Rolls)", qty: estimate.quantities.insulation, active: state.addInsulation || state.solidWallsOnly },
                    { id: 'nails', name: "Framing Nails (Boxes)", qty: estimate.quantities.nails, active: true },
                    { id: 'header', name: "Headers (LF)", qty: estimate.quantities.headers, active: state.doors.length > 0 || state.windows.length > 0 },
                  ]
                },
                {
                  title: 'Roof',
                  items: [
                    { id: 'truss', name: "Roof Trusses", qty: estimate.quantities.trusses, active: state.trussRuns.length > 0 },
                    { id: 'hurricaneTies', name: "Hurricane Ties", qty: estimate.quantities.hurricaneTies, active: state.trussRuns.length > 0 },
                    { id: 'roofSheathing', name: "Roof Sheathing", qty: estimate.quantities.roofSheathing, active: state.roofParts.length > 0 || state.trussRuns.length > 0 },
                    { id: 'roofUnderlayment', name: "Roof Underlayment (Rolls)", qty: estimate.quantities.roofUnderlayment, active: state.roofParts.length > 0 || state.trussRuns.length > 0 },
                  ]
                },
                {
                  title: 'Windows & Doors',
                  items: [
                    { id: 'door', name: "Doors", qty: estimate.quantities.doors, active: state.doors.length > 0 },
                    { id: 'window', name: "Windows", qty: estimate.quantities.windows, active: state.windows.length > 0 },
                  ]
                },
                {
                  title: 'Surface Finishes',
                  items: [
                    // Exterior wall finishes (from per-wall system)
                    { id: 'woodSiding', name: "Wood Siding (SqFt)", qty: estimate.quantities.woodSiding, active: estimate.quantities.woodSiding > 0 },
                    { id: 'vinylSiding', name: "Vinyl Siding (SqFt)", qty: estimate.quantities.vinylSiding, active: estimate.quantities.vinylSiding > 0 },
                    { id: 'hardieBoard', name: "Hardie Board (SqFt)", qty: estimate.quantities.hardieBoard, active: estimate.quantities.hardieBoard > 0 },
                    { id: 'brick', name: "Brick (SqFt)", qty: estimate.quantities.brick, active: estimate.quantities.brick > 0 },
                    { id: 'stucco', name: "Stucco (SqFt)", qty: estimate.quantities.stucco, active: estimate.quantities.stucco > 0 },
                    // Roof finish
                    ...(estimate.roofFinishCostKey ? [{ id: estimate.roofFinishCostKey, name: `${estimate.roofFinishName} (SqFt)`, qty: estimate.quantities.roofFinishSqFt, active: estimate.quantities.roofFinishSqFt > 0 }] : []),
                    // Interior finish
                    ...(estimate.interiorFinishCostKey ? [{ id: estimate.interiorFinishCostKey, name: `${estimate.interiorFinishName} (SqFt)`, qty: estimate.quantities.interiorFinishSqFt, active: estimate.quantities.interiorFinishSqFt > 0 }] : []),
                    // Foundation finish
                    ...(estimate.foundationFinishCostKey ? [{ id: estimate.foundationFinishCostKey, name: `${estimate.foundationFinishName} (SqFt)`, qty: estimate.quantities.foundationFinishSqFt, active: estimate.quantities.foundationFinishSqFt > 0 }] : []),
                  ]
                }
              ].map((group) => (
                <React.Fragment key={group.title}>
                  <tr 
                    className="bg-zinc-50 dark:bg-[#151a2e]/80 cursor-pointer hover:bg-zinc-100 dark:hover:bg-[#243052]/50 transition-colors"
                    onClick={() => toggleGroup(group.title)}
                  >
                    <td colSpan={4} className="px-3 py-2 font-bold text-zinc-700 dark:text-zinc-300 border-t border-b border-zinc-200 dark:border-[#243052]">
                      <div className="flex items-center gap-2">
                        {openGroups[group.title] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {group.title}
                      </div>
                    </td>
                  </tr>
                  {openGroups[group.title] && group.items.map((item) => {
                    const currentCost = isEditing ? editCosts[item.id as keyof MaterialCosts] : (state.materialCosts || DEFAULT_MATERIAL_COSTS)[item.id as keyof MaterialCosts];
                    const totalCost = Number(item.qty) * currentCost;
                    
                    return (
                      <tr key={item.id} className={`${item.active ? 'bg-white dark:bg-[#0f1424]' : 'bg-zinc-50/50 dark:bg-[#151a2e]/30 opacity-60'}`}>
                        <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 pl-8">{item.name}</td>
                        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{item.qty}</td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-zinc-400 dark:text-zinc-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={sanitize(editCosts[item.id as keyof MaterialCosts])}
                                onChange={(e) => handleCostChange(item.id as keyof MaterialCosts, e.target.value)}
                                className="w-16 px-1 py-0.5 text-right bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-zinc-200"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-600 dark:text-zinc-400">{formatCurrency(currentCost)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(totalCost)}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
