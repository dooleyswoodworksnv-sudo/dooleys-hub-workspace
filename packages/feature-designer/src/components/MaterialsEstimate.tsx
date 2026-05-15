import React, { useMemo, useState } from 'react';
import { AppState, MaterialCosts, DEFAULT_MATERIAL_COSTS } from '../App';
import { computeEstimate } from '../utils/computeEstimate';
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
