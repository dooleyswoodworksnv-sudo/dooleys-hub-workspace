import React, { useMemo, useState, useRef } from 'react';
import { AppState, MaterialCosts, CustomCostItem, DEFAULT_MATERIAL_COSTS } from '../App';
import { computeEstimate } from '../utils/computeEstimate';
import { sanitize } from '../utils/math';
import { DollarSign, Package, Edit2, Save, X, ChevronDown, ChevronRight, Plus, Download, Upload, Trash2 } from 'lucide-react';

const CUSTOM_CATEGORIES = ['Custom', 'Labor', 'Permits', 'Equipment', 'Subcontractor', 'Misc'];

interface Props {
  state: AppState;
  getWallLength: (wallId: number) => number;
  getAvailableWallOptions: { id: number, label: string }[];
  onUpdateCosts: (costs: MaterialCosts) => void;
  customCostItems: CustomCostItem[];
  onUpdateCustomItems: (items: CustomCostItem[]) => void;
}

interface NewItemForm {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  unitCost: string;
}

const EMPTY_FORM: NewItemForm = { name: '', category: 'Custom', quantity: '1', unit: 'ea', unitCost: '0' };

export default function MaterialsEstimate({ state, getWallLength, getAvailableWallOptions, onUpdateCosts, customCostItems, onUpdateCustomItems }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCosts, setEditCosts] = useState<MaterialCosts>({ ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemForm>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Foundation': true,
    'Floor System': true,
    'Walls': true,
    'Roof': true,
    'Windows & Doors': true,
    'Surface Finishes': true,
    'Custom': true,
    'Painted Surfaces': true
  });

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  React.useEffect(() => {
    if (!isEditing) {
      setEditCosts({ ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) });
    }
  }, [state.materialCosts, isEditing]);

  const handleSaveCosts = () => {
    onUpdateCosts(editCosts);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditCosts({ ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) });
    setIsEditing(false);
  };

  const estimate = useMemo(() => {
    return computeEstimate(state, getWallLength, getAvailableWallOptions);
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
    ? computeEstimate({ ...state, materialCosts: editCosts }, getWallLength, getAvailableWallOptions).totalCost
    : estimate.totalCost;

  // ── Joist size → price key mapping ──

  const joistPerLFMap: Record<string, string> = {
    '2x6': 'joistPerLF2x6', '2x8': 'joistPerLF2x8',
    '2x10': 'joistPerLF2x10', '2x12': 'joistPerLF2x12',
  };
  const joistPriceKey = joistPerLFMap[state.joistSize] || 'joistPerLF2x10';

  // ── Custom cost item handlers ──

  const handleAddItem = () => {
    const qty = parseFloat(newItem.quantity) || 0;
    const cost = parseFloat(newItem.unitCost) || 0;
    if (!newItem.name.trim() || qty <= 0) return;

    const item: CustomCostItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newItem.name.trim(),
      category: newItem.category,
      quantity: qty,
      unit: newItem.unit.trim() || 'ea',
      unitCost: cost,
    };

    onUpdateCustomItems([...customCostItems, item]);
    setNewItem(EMPTY_FORM);
    setShowAddForm(false);
  };

  const handleDeleteItem = (id: string) => {
    onUpdateCustomItems(customCostItems.filter(i => i.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof CustomCostItem, value: string | number) => {
    onUpdateCustomItems(customCostItems.map(i => {
      if (i.id !== id) return i;
      if (field === 'quantity' || field === 'unitCost') {
        return { ...i, [field]: parseFloat(value as string) || 0 };
      }
      return { ...i, [field]: value };
    }));
  };

  // ── Export CSV ──

  const handleExportCSV = () => {
    const prices = { ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) };

    // System material groups
    const systemGroups = [
      {
        title: 'Foundation',
        items: [
          { name: "Concrete (CY)", qty: estimate.quantities.concrete, unitCost: prices.concrete },
          { name: "Rebar 20' Sticks", qty: estimate.quantities.rebar, unitCost: prices.rebar },
          { name: "Anchor Bolts", qty: estimate.quantities.anchorBolts, unitCost: prices.anchorBolts },
        ]
      },
      {
        title: 'Floor System',
        items: [
          { name: `Floor Joists (${state.joistSize}, ${estimate.quantities.joistLengthFt}' ea) — ${estimate.quantities.joists} pcs`, qty: estimate.quantities.joistTotalLF, unitCost: prices[joistPriceKey as keyof MaterialCosts] },
          { name: `Rim Joists (${state.joistSize})`, qty: estimate.quantities.rimJoistLF, unitCost: prices[joistPriceKey as keyof MaterialCosts] },
          { name: "Joist Hangers", qty: estimate.quantities.joistHangers, unitCost: prices.joistHangers },
          { name: "Subfloor (4x8)", qty: estimate.quantities.subfloor, unitCost: prices.subfloor },
          { name: "Subfloor Adhesive", qty: estimate.quantities.adhesive, unitCost: prices.adhesive },
          ...(state.enableGirderSystem && estimate.quantities.girderLF > 0 ? [
            { 
              name: `Floor Girders (${state.girderSize})`, 
              qty: estimate.quantities.girderLF, 
              unitCost: estimate.quantities.girderLF > 0 ? (estimate.costs.girders / estimate.quantities.girderLF) : 0 
            },
          ] : []),
          ...(state.enableGirderSystem && estimate.quantities.supportPostLF > 0 ? [
            { 
              name: `Floor Support Posts (${state.girderPostSize})`, 
              qty: estimate.quantities.supportPostLF, 
              unitCost: state.girderPostSize === '4x4' ? 2.50 : 5.00 
            },
            { 
              name: `Post-to-Beam Caps (${state.girderPostSize})`, 
              qty: estimate.quantities.postCapsCount, 
              unitCost: 12.50 
            },
            { 
              name: `Post Base Anchors (${state.girderPostSize})`, 
              qty: estimate.quantities.postBasesCount, 
              unitCost: 15.00 
            },
          ] : []),
          ...(state.enableGirderSystem && estimate.quantities.girderBracketsCount > 0 ? [
            { 
              name: `Simpson Heavy Girder Wall Brackets`, 
              qty: estimate.quantities.girderBracketsCount, 
              unitCost: 35.00 
            },
          ] : []),
        ]
      },
      {
        title: 'Walls',
        items: [
          { name: "Wall Studs (8')", qty: estimate.quantities.studs, unitCost: prices.stud },
          { name: "Plates (8')", qty: estimate.quantities.plates, unitCost: prices.plate },
          { name: "Sheathing (4x8)", qty: estimate.quantities.sheathing, unitCost: prices.sheathing },
          { name: "House Wrap (Rolls)", qty: estimate.quantities.houseWrap, unitCost: prices.houseWrap },
          { name: "Drywall (4x8)", qty: estimate.quantities.drywall, unitCost: prices.drywall },
          { name: "Insulation (Rolls)", qty: estimate.quantities.insulation, unitCost: prices.insulation },
          { name: "Framing Nails (Boxes)", qty: estimate.quantities.nails, unitCost: prices.nails },
          { name: "Headers (LF)", qty: estimate.quantities.headers, unitCost: prices.header },
        ]
      },
      {
        title: 'Roof',
        items: [
          { name: "Roof Trusses", qty: estimate.quantities.trusses, unitCost: prices.truss },
          { name: "Hurricane Ties", qty: estimate.quantities.hurricaneTies, unitCost: prices.hurricaneTies },
          { name: "Roof Sheathing", qty: estimate.quantities.roofSheathing, unitCost: prices.roofSheathing },
          { name: "Roof Underlayment (Rolls)", qty: estimate.quantities.roofUnderlayment, unitCost: prices.roofUnderlayment },
        ]
      },
      {
        title: 'Windows & Doors',
        items: [
          { name: "Doors", qty: estimate.quantities.doors, unitCost: prices.door },
          { name: "Windows", qty: estimate.quantities.windows, unitCost: prices.window },
        ]
      },
    ];

    const escapeCSV = (val: string | number) => {
      const s = String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csv = 'Category,Material,Qty,Unit,Unit Cost,Total\n';

    for (const group of systemGroups) {
      for (const item of group.items) {
        const qty = Number(item.qty) || 0;
        if (qty <= 0) continue;
        const total = qty * item.unitCost;
        csv += `${escapeCSV(group.title)},${escapeCSV(item.name)},${qty},ea,${item.unitCost.toFixed(2)},${total.toFixed(2)}\n`;
      }
    }

    // Custom items
    for (const item of customCostItems) {
      const total = item.quantity * item.unitCost;
      csv += `${escapeCSV(item.category)},${escapeCSV(item.name)},${item.quantity},${escapeCSV(item.unit)},${item.unitCost.toFixed(2)},${total.toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'materials-estimate.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Import CSV ──

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').filter(l => l.trim());
      const newItems: CustomCostItem[] = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < 5) continue;

        const [category, name, qtyStr, unit, unitCostStr] = parts;
        const qty = parseFloat(qtyStr) || 0;
        const unitCost = parseFloat(unitCostStr) || 0;
        if (!name?.trim() || qty <= 0) continue;

        newItems.push({
          id: `import-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          name: name.trim(),
          category: category?.trim() || 'Custom',
          quantity: qty,
          unit: unit?.trim() || 'ea',
          unitCost,
        });
      }

      if (newItems.length > 0) {
        onUpdateCustomItems([...customCostItems, ...newItems]);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Simple CSV line parser that handles quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  };

  // ── Computed values ──

  const customItemsTotal = customCostItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

  // ── Build system material groups ──

  const systemGroups = [
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
        { id: 'floorJoists', costId: joistPriceKey, name: `Floor Joists (${state.joistSize}, ${estimate.quantities.joistLengthFt}' ea) — ${estimate.quantities.joists} pcs`, qty: estimate.quantities.joistTotalLF, active: state.addFloorFraming },
        { id: 'rimJoists', costId: joistPriceKey, name: `Rim Joists (${state.joistSize})`, qty: estimate.quantities.rimJoistLF, active: state.addFloorFraming },
        { id: 'joistHangers', name: "Joist Hangers", qty: estimate.quantities.joistHangers, active: state.addFloorFraming },
        { id: 'subfloor', name: "Subfloor (4x8)", qty: estimate.quantities.subfloor, active: state.addFloorFraming && state.addSubfloor },
        { id: 'adhesive', name: "Subfloor Adhesive", qty: estimate.quantities.adhesive, active: state.addFloorFraming && state.addSubfloor },
        ...(state.enableGirderSystem && estimate.quantities.girderLF > 0 ? [
          { 
            id: 'floorGirders', 
            name: `Floor Girders (${state.girderSize})`, 
            qty: estimate.quantities.girderLF, 
            active: state.addFloorFraming && state.enableGirderSystem,
            overrideCost: estimate.quantities.girderLF > 0 ? (estimate.costs.girders / estimate.quantities.girderLF) : 0,
            overrideTotal: estimate.costs.girders
          }
        ] : []),
        ...(state.enableGirderSystem && estimate.quantities.supportPostLF > 0 ? [
          { 
            id: 'supportPosts', 
            name: `Floor Support Posts (${state.girderPostSize})`, 
            qty: estimate.quantities.supportPostLF, 
            active: state.addFloorFraming && state.enableGirderSystem,
            overrideCost: state.girderPostSize === '4x4' ? 2.50 : 5.00,
            overrideTotal: estimate.costs.supportPosts
          },
          { 
            id: 'postCaps', 
            name: `Post-to-Beam Caps (${state.girderPostSize})`, 
            qty: estimate.quantities.postCapsCount, 
            active: state.addFloorFraming && state.enableGirderSystem,
            overrideCost: 12.50,
            overrideTotal: estimate.costs.postCaps
          },
          { 
            id: 'postBases', 
            name: `Post Base Anchors (${state.girderPostSize})`, 
            qty: estimate.quantities.postBasesCount, 
            active: state.addFloorFraming && state.enableGirderSystem,
            overrideCost: 15.00,
            overrideTotal: estimate.costs.postBases
          }
        ] : []),
        ...(state.enableGirderSystem && estimate.quantities.girderBracketsCount > 0 ? [
          { 
            id: 'girderBrackets', 
            name: `Simpson Heavy Girder Wall Brackets`, 
            qty: estimate.quantities.girderBracketsCount, 
            active: state.addFloorFraming && state.enableGirderSystem,
            overrideCost: 35.00,
            overrideTotal: estimate.costs.girderBrackets
          }
        ] : []),
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
        { id: 'woodSiding', name: "Wood Siding (SqFt)", qty: estimate.quantities.woodSiding, active: true },
        { id: 'vinylSiding', name: "Vinyl Siding (SqFt)", qty: estimate.quantities.vinylSiding, active: true },
        { id: 'hardieBoard', name: "Hardie Board (SqFt)", qty: estimate.quantities.hardieBoard, active: true },
        { id: 'brick', name: "Brick (SqFt)", qty: estimate.quantities.brick, active: true },
        { id: 'stucco', name: "Stucco (SqFt)", qty: estimate.quantities.stucco, active: true },
        ...(estimate.roofFinishCostKey ? [{ id: estimate.roofFinishCostKey, name: `${estimate.roofFinishName} (SqFt)`, qty: estimate.quantities.roofFinishSqFt, active: estimate.quantities.roofFinishSqFt > 0 }] : []),
        ...(estimate.interiorFinishCostKey ? [{ id: estimate.interiorFinishCostKey, name: `${estimate.interiorFinishName} (SqFt)`, qty: estimate.quantities.interiorFinishSqFt, active: estimate.quantities.interiorFinishSqFt > 0 }] : []),
        ...(estimate.foundationFinishCostKey ? [{ id: estimate.foundationFinishCostKey, name: `${estimate.foundationFinishName} (SqFt)`, qty: estimate.quantities.foundationFinishSqFt, active: estimate.quantities.foundationFinishSqFt > 0 }] : []),
      ]
    }
  ];

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
        {customItemsTotal > 0 && (
          <div className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1 font-medium">
            Includes {formatCurrency(customItemsTotal)} in custom costs
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Header row with all action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Package size={14} className="text-indigo-500 dark:text-indigo-400" />
            Materials Spreadsheet
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#151a2e] hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-200 dark:border-[#243052] shadow-sm"
              title="Export spreadsheet as CSV"
            >
              <Download size={12} />
              Export
            </button>
            {/* Import CSV */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#151a2e] hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-200 dark:border-[#243052] shadow-sm"
              title="Import costs from CSV"
            >
              <Upload size={12} />
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            {/* Add Cost */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 dark:bg-emerald-900/20 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-emerald-300/50 dark:border-emerald-800/50 shadow-sm"
            >
              <Plus size={12} />
              Add Cost
            </button>
            {/* Edit Costs */}
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#151a2e] hover:bg-zinc-100 dark:hover:bg-[#243052] text-zinc-700 dark:text-zinc-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-zinc-200 dark:border-[#243052] shadow-sm"
              >
                <Edit2 size={12} />
                Edit Costs
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

        {/* Add Cost Form */}
        {showAddForm && (
          <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30 rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">New Custom Cost</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="Item name..."
                value={newItem.name}
                onChange={e => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-2 sm:col-span-1 px-2 py-1.5 text-xs bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200 placeholder:text-zinc-400"
              />
              <select
                value={newItem.category}
                onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                className="px-2 py-1.5 text-xs bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
              >
                {CUSTOM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Qty"
                  value={newItem.quantity}
                  onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-16 px-2 py-1.5 text-xs bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={newItem.unit}
                  onChange={e => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-14 px-2 py-1.5 text-xs bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 dark:text-zinc-500 text-xs">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit cost"
                  value={newItem.unitCost}
                  onChange={e => setNewItem(prev => ({ ...prev, unitCost: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.name.trim()}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white disabled:text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  <Plus size={10} />
                  Add
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewItem(EMPTY_FORM); }}
                  className="px-2 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Materials Table */}
        <div className="overflow-x-auto border border-zinc-200 dark:border-[#1c2240] rounded-lg bg-white dark:bg-[#0f1424] shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-[#151a2e]/50 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[9px] border-b border-zinc-200 dark:border-[#1c2240]">
              <tr>
                <th className="px-3 py-2 font-bold">Material</th>
                <th className="px-3 py-2 font-bold text-right">Qty</th>
                <th className="px-3 py-2 font-bold text-right">Unit Cost</th>
                <th className="px-3 py-2 font-bold text-right">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {/* System material groups */}
              {systemGroups.map((group) => (
                <React.Fragment key={group.title}>
                  <tr 
                    className="bg-zinc-50 dark:bg-[#151a2e]/80 cursor-pointer hover:bg-zinc-100 dark:hover:bg-[#243052]/50 transition-colors"
                    onClick={() => toggleGroup(group.title)}
                  >
                    <td colSpan={5} className="px-3 py-2 font-bold text-zinc-700 dark:text-zinc-300 border-t border-b border-zinc-200 dark:border-[#243052]">
                      <div className="flex items-center gap-2">
                        {openGroups[group.title] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {group.title}
                      </div>
                    </td>
                  </tr>
                  {openGroups[group.title] && group.items.map((item) => {
                    const priceKey = ((item as any).costId || item.id) as keyof MaterialCosts;
                    const hasOverride = 'overrideCost' in item;
                    
                    const currentCost = hasOverride 
                      ? (item as any).overrideCost 
                      : (isEditing ? editCosts[priceKey] : ({ ...DEFAULT_MATERIAL_COSTS, ...(state.materialCosts || {}) })[priceKey]);
                      
                    const totalCost = hasOverride 
                      ? (item as any).overrideTotal 
                      : Number(item.qty) * currentCost;
                    
                    return (
                      <tr key={item.id} className={`${item.active ? 'bg-white dark:bg-[#0f1424]' : 'bg-zinc-50/50 dark:bg-[#151a2e]/30 opacity-60'}`}>
                        <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 pl-8">{item.name}</td>
                        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">{item.qty}</td>
                        <td className="px-3 py-2 text-right">
                          {isEditing && !hasOverride ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-zinc-400 dark:text-zinc-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={sanitize(editCosts[priceKey])}
                                onChange={(e) => handleCostChange(priceKey, e.target.value)}
                                className="w-16 px-1 py-0.5 text-right bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-zinc-200"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-600 dark:text-zinc-400">{formatCurrency(currentCost)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(totalCost)}</td>
                        <td></td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Custom cost items group */}
              {customCostItems.length > 0 && (
                <React.Fragment>
                  <tr 
                    className="bg-zinc-50 dark:bg-[#151a2e]/80 cursor-pointer hover:bg-zinc-100 dark:hover:bg-[#243052]/50 transition-colors"
                    onClick={() => toggleGroup('Custom')}
                  >
                    <td colSpan={5} className="px-3 py-2 font-bold text-emerald-700 dark:text-emerald-400 border-t border-b border-zinc-200 dark:border-[#243052]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {openGroups['Custom'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          Custom ({customCostItems.length})
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500">
                          {formatCurrency(customItemsTotal)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {openGroups['Custom'] && customCostItems.map((item) => {
                    const total = item.quantity * item.unitCost;
                    return (
                      <tr key={item.id} className="bg-white dark:bg-[#0f1424] group">
                        <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 pl-8">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold">{item.category}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-400">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={e => handleUpdateItem(item.id, 'quantity', e.target.value)}
                              className="w-14 px-1 py-0.5 text-right bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
                            />
                          ) : (
                            <span>{item.quantity} {item.unit}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-zinc-400 dark:text-zinc-500">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={e => handleUpdateItem(item.id, 'unitCost', e.target.value)}
                                className="w-16 px-1 py-0.5 text-right bg-white dark:bg-[#151a2e] border border-zinc-300 dark:border-[#243052] rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:text-zinc-200"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-600 dark:text-zinc-400">{formatCurrency(item.unitCost)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-zinc-800 dark:text-zinc-200">{formatCurrency(total)}</td>
                        <td className="px-1 py-2">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove custom item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>

        {/* Per-surface painted material breakdown */}
        {estimate.paintedSurfaceItems.length > 0 && (
          <div className="mt-3 border border-indigo-200 dark:border-indigo-800/50 rounded-lg overflow-hidden">
            <div 
              className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-between cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              onClick={() => toggleGroup('Painted Surfaces')}
            >
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                🎨 Painted Surface Breakdown ({estimate.paintedSurfaceItems.length} surfaces)
              </span>
              {openGroups['Painted Surfaces'] ? <ChevronDown size={12} className="text-indigo-500" /> : <ChevronRight size={12} className="text-indigo-500" />}
            </div>
            {openGroups['Painted Surfaces'] && (
              <div className="divide-y divide-indigo-100 dark:divide-indigo-900/30">
                {estimate.paintedSurfaceItems.map((item) => (
                  <div key={item.surfaceId} className="px-3 py-1.5 flex items-center justify-between bg-white dark:bg-[#0f1424] text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{item.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap">{item.finishType}</span>
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 whitespace-nowrap ml-2">{item.areaSqFt} sqft</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
