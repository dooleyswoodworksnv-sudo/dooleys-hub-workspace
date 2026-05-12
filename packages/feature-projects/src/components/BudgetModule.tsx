import React, { useState, useMemo } from 'react';
import { DollarSign, Plus, X, AlertTriangle, CheckCircle, TrendingUp, Search, Trash2, ChevronDown, ChevronRight, PenTool } from 'lucide-react';
import { type Task } from './GanttChart';
import { cn } from '@dooleys/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export interface BudgetItem {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
}

export interface ChangeOrder {
  id: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
}

interface DesignerEstimate {
  totalCost: number;
  lineItems: {
    category: string;
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }[];
  lastUpdated: string;
}

interface BudgetModuleProps {
  baseContractPrice: number;
  setBaseContractPrice: React.Dispatch<React.SetStateAction<number>>;
  budgetItems: BudgetItem[];
  setBudgetItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  changeOrders: ChangeOrder[];
  setChangeOrders: React.Dispatch<React.SetStateAction<ChangeOrder[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  designerEstimates: DesignerEstimate | null;
}

export function BudgetModule({
  baseContractPrice,
  setBaseContractPrice,
  budgetItems,
  setBudgetItems,
  changeOrders,
  setChangeOrders,
  tasks,
  setTasks,
  designerEstimates
}: BudgetModuleProps) {
  // Extract designer estimate data
  const designerTotal = designerEstimates?.totalCost ?? 0;
  const designerItems = designerEstimates?.lineItems ?? [];
  const designerCategories = useMemo(() => {
    const cats = new Map<string, typeof designerItems>();
    designerItems.forEach(item => {
      const existing = cats.get(item.category) || [];
      existing.push(item);
      cats.set(item.category, existing);
    });
    return cats;
  }, [designerItems]);

  const [isAddingCO, setIsAddingCO] = useState(false);
  const [newCO, setNewCO] = useState<Partial<ChangeOrder>>({ description: '', amount: 0, status: 'pending' });

  const [isAddingAllowance, setIsAddingAllowance] = useState(false);
  const [newAllowance, setNewAllowance] = useState<Partial<BudgetItem>>({ name: '', budgeted: 0, actual: 0 });

  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate totals
  const totalVariance = useMemo(() => {
    return budgetItems.reduce((acc, item) => acc + (item.actual - item.budgeted), 0);
  }, [budgetItems]);

  const approvedCOTotal = useMemo(() => {
    return changeOrders.filter(co => co.status === 'approved' || co.status === 'paid')
      .reduce((acc, co) => acc + co.amount, 0);
  }, [changeOrders]);

  const projectedFinalCost = baseContractPrice + totalVariance + approvedCOTotal + designerTotal;

  // Draw Schedule Breakdown (Simplified)
  const taskDraws = useMemo(() => {
    return tasks.map(task => {
      const pct = task.drawPct || 0;
      return {
        ...task,
        pct: pct,
        drawAmount: pct * projectedFinalCost
      };
    }).filter(t => t.pct > 0 || (t.drawPct !== undefined));
  }, [tasks, projectedFinalCost]);

  const handleUpdateTask = (id: string, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleAddCO = () => {
    if (!newCO.description || !newCO.amount) return;
    setChangeOrders(prev => [...prev, {
      id: `co-${Date.now()}`,
      description: newCO.description as string,
      amount: Number(newCO.amount),
      status: newCO.status as ChangeOrder['status']
    }]);
    setNewCO({ description: '', amount: 0, status: 'pending' });
    setIsAddingCO(false);
  };

  const handleUpdateCO = (id: string, field: keyof ChangeOrder, value: any) => {
    setChangeOrders(prev => prev.map(co => co.id === id ? { ...co, [field]: value } : co));
  };

  const handleDeleteCO = (id: string) => {
    setChangeOrders(prev => prev.filter(co => co.id !== id));
  };

  const handleAddAllowance = () => {
    if (!newAllowance.name) return;
    setBudgetItems(prev => [...prev, {
      id: `b-${Date.now()}`,
      name: newAllowance.name as string,
      budgeted: Number(newAllowance.budgeted) || 0,
      actual: Number(newAllowance.actual) || 0
    }]);
    setNewAllowance({ name: '', budgeted: 0, actual: 0 });
    setIsAddingAllowance(false);
  };

  const handleUpdateAllowance = (id: string, field: keyof BudgetItem, value: any) => {
    setBudgetItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteAllowance = (id: string) => {
    setBudgetItems(prev => prev.filter(item => item.id !== id));
  };

  const handleVarianceChange = (id: string, newActualStr: string) => {
    const newActual = parseFloat(newActualStr) || 0;
    setBudgetItems(prev => prev.map(item => item.id === id ? { ...item, actual: newActual } : item));
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const budgetChartData = useMemo(() => {
    return budgetItems.map(item => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      Budgeted: item.budgeted,
      Actual: item.actual
    }));
  }, [budgetItems]);

  const coChartData = useMemo(() => {
    return changeOrders.map(co => ({
      name: co.description.length > 20 ? co.description.substring(0, 20) + '...' : co.description,
      value: co.amount
    })).filter(co => co.value > 0);
  }, [changeOrders]);

  const COLORS = ['var(--color-accent-gold)', 'var(--color-text-muted)', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

  return (
    <div className="mb-10 w-full overflow-hidden relative" id="budget-module">
      <div 
        className="mb-6 border-b border-white/10 pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 cursor-pointer hover:bg-white/5 transition-colors p-2 -mx-2 rounded"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4">
          <div className="text-accent-gold mt-1.5">
            {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-2xl italic text-accent-gold" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Budget &amp; Allowances</h2>
            <p className="text-[14px] text-text-muted mt-2">Track variances, change orders, and draw schedule against base contract.</p>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Totals & Draw Schedule */}
        <div className="flex flex-col gap-6">
          <div className="bg-bg-surface border border-white/10 p-6 flex flex-col items-center justify-center relative overflow-hidden">
             {/* Decorative Background */}
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <DollarSign className="w-32 h-32" />
             </div>
             <p className="text-[11px] text-text-muted uppercase tracking-widest font-bold mb-2 z-10">Projected Final Cost</p>
             <h3 className="text-4xl text-white font-mono z-10">{formatCurrency(projectedFinalCost)}</h3>
             <div className="mt-4 flex flex-col gap-2 w-full z-10">
                <div className="flex justify-between text-xs font-mono items-center">
                   <span className="text-white/50">Base Contract:</span>
                   <span className="flex items-center">
                      $
                      <input 
                        type="number"
                        className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent-gold text-white text-right outline-none w-24"
                        value={baseContractPrice || ''}
                        onChange={(e) => setBaseContractPrice(Number(e.target.value) || 0)}
                      />
                   </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                   <span className="text-white/50">Allowance Variance:</span>
                   <span className={cn("font-bold", totalVariance > 0 ? "text-amber-500" : (totalVariance < 0 ? "text-teal-400" : "text-white"))}>
                     {totalVariance > 0 ? "+" : ""}{formatCurrency(totalVariance)}
                   </span>
                </div>
                 {designerTotal > 0 && (
                 <div className="flex justify-between text-xs font-mono">
                    <span className="text-white/50 flex items-center gap-1"><PenTool className="w-3 h-3 text-emerald-400" /> Designer Est.:</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(designerTotal)}</span>
                 </div>
                 )}
                <div className="flex justify-between text-xs font-mono">
                   <span className="text-white/50">Approved COs:</span>
                   <span className="text-white">{formatCurrency(approvedCOTotal)}</span>
                </div>
             </div>
          </div>

          <div className="bg-bg-surface border border-white/10 p-6 flex-1 flex flex-col">
             <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px] mb-4 flex items-center gap-2">
               Draw Schedule Breakdown
             </h3>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                {taskDraws.map(draw => (
                  <div key={draw.id} className="border-b border-white/5 pb-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[12px] text-white font-bold">{draw.name}</span>
                      <span className="text-[12px] font-mono text-accent-gold">{formatCurrency(draw.drawAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/50">
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent-gold text-white/50 outline-none w-8 text-center"
                          value={Math.round(draw.pct * 100)}
                          onChange={(e) => handleUpdateTask(draw.id, 'drawPct', (parseFloat(e.target.value) || 0) / 100)}
                        />
                        % Draw
                      </span>
                      <span className={cn(draw.status === 'completed' ? 'text-teal-400' : 'text-text-muted')}>
                        {draw.status}
                      </span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Columns: Allowances & COs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Designer Material Estimates (live from bridge) */}
          {designerTotal > 0 && (
            <div className="bg-bg-surface border border-emerald-500/20 flex flex-col max-h-[400px] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40" />
              <div className="p-4 border-b border-emerald-500/20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <PenTool className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-[12px]">Designer Material Estimates</h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Auto-synced from Building Solutions • Updates when you change the design</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-emerald-400 font-mono text-lg font-bold">{formatCurrency(designerTotal)}</span>
                  <p className="text-[9px] text-text-muted uppercase tracking-widest">{designerItems.length} items</p>
                </div>
              </div>

              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-emerald-500/5 border-b border-emerald-500/10">
                      <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-emerald-400/70">Category</th>
                      <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-emerald-400/70">Material</th>
                      <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-emerald-400/70 text-right">Qty</th>
                      <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-emerald-400/70 text-right">Unit Cost</th>
                      <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-emerald-400/70 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(designerCategories.entries()).map(([category, items]) => (
                      <React.Fragment key={category}>
                        {items.map((item, idx) => (
                          <tr key={`${category}-${idx}`} className="border-b border-white/5 hover:bg-emerald-500/5 transition-colors">
                            {idx === 0 && (
                              <td className="p-3 text-[11px] text-emerald-300/60 font-bold uppercase tracking-wider" rowSpan={items.length}>
                                {category}
                              </td>
                            )}
                            <td className="p-3 text-sm text-white font-medium">{item.name}</td>
                            <td className="p-3 text-sm font-mono text-white/70 text-right">{item.quantity} {item.unit}</td>
                            <td className="p-3 text-sm font-mono text-white/50 text-right">{formatCurrency(item.unitCost)}</td>
                            <td className="p-3 text-sm font-mono text-emerald-400 text-right font-bold">{formatCurrency(item.totalCost)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-500/10 border-t border-emerald-500/20">
                      <td colSpan={4} className="p-3 text-[11px] uppercase tracking-widest font-bold text-emerald-400">Total Material Estimate</td>
                      <td className="p-3 text-right font-mono text-lg text-emerald-400 font-bold">{formatCurrency(designerTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Allowances Table */}
          <div className="bg-bg-surface border border-white/10 flex flex-col max-h-[400px]">
             <div className="p-4 border-b border-white/10 flex justify-between items-center">
               <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px]">Allowances &amp; Variances</h3>
               <button
                 onClick={() => setIsAddingAllowance(true)}
                 className="flex items-center gap-2 bg-white/5 text-accent-gold border border-accent-gold/30 px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors"
               >
                 <Plus className="w-3 h-3" /> Add Allowance
               </button>
             </div>

             {isAddingAllowance && (
               <div className="p-4 bg-black/50 border-b border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end relative">
                 <button 
                    onClick={() => setIsAddingAllowance(false)}
                    className="absolute top-2 right-2 text-white/50 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                 <div className="md:col-span-2">
                   <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Item Name</label>
                   <input
                     type="text"
                     value={newAllowance.name}
                     onChange={(e) => setNewAllowance(prev => ({ ...prev, name: e.target.value }))}
                     className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none"
                     placeholder="e.g. Countertops"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Budgeted ($)</label>
                   <input
                     type="number"
                     value={newAllowance.budgeted || ''}
                     onChange={(e) => setNewAllowance(prev => ({ ...prev, budgeted: parseFloat(e.target.value) }))}
                     className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none font-mono"
                     placeholder="0"
                   />
                 </div>
                 <div>
                    <button
                      onClick={handleAddAllowance}
                      className="w-full bg-accent-gold text-black font-bold h-[38px] text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors shadow-lg"
                    >
                      Save
                    </button>
                 </div>
               </div>
             )}

             <div className="overflow-x-auto flex-1 custom-scrollbar">
               <table className="w-full text-left border-collapse min-w-[500px]">
                 <thead>
                   <tr className="bg-black/50 border-b border-white/10">
                     <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted">Item Name</th>
                     <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted text-right">Budgeted</th>
                     <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted text-right">Actual</th>
                     <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted text-right">Variance</th>
                     <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted w-10"></th>
                   </tr>
                 </thead>
                 <tbody>
                    {budgetItems.map(item => {
                      const variance = item.actual - item.budgeted;
                      return (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                          <td className="p-3">
                            <input 
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateAllowance(item.id, 'name', e.target.value)}
                              className="bg-transparent border border-transparent hover:border-white/10 focus:border-accent-gold font-bold text-white text-sm p-1.5 outline-none transition-colors w-full"
                            />
                          </td>
                          <td className="p-3 text-right">
                             <input 
                               type="number"
                               value={item.budgeted || ''}
                               onChange={(e) => handleUpdateAllowance(item.id, 'budgeted', parseFloat(e.target.value) || 0)}
                               className="bg-transparent border border-transparent hover:border-white/10 focus:border-accent-gold text-white/70 text-sm p-1.5 outline-none transition-colors w-24 text-right font-mono"
                               placeholder="0"
                             />
                          </td>
                          <td className="p-3 text-right">
                             <input 
                               type="number"
                               value={item.actual || ''}
                               onChange={(e) => handleUpdateAllowance(item.id, 'actual', parseFloat(e.target.value) || 0)}
                               className="bg-black border border-white/10 text-white text-sm p-1.5 focus:border-accent-gold outline-none transition-colors w-28 text-right font-mono"
                               placeholder="0"
                             />
                          </td>
                          <td className="p-3 text-right text-sm font-mono">
                            <span className={cn(variance > 0 ? "text-amber-500" : (variance < 0 ? "text-teal-400" : "text-white/50"))}>
                              {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => handleDeleteAllowance(item.id)}
                              className="text-red-500 hover:bg-red-500/20 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
             </div>
          </div>

          {/* Change Orders Log */}
          <div className="bg-bg-surface border border-white/10 flex flex-col flex-1">
             <div className="p-4 border-b border-white/10 flex justify-between items-center">
               <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px]">Change Order Log</h3>
               <button
                 onClick={() => setIsAddingCO(true)}
                 className="flex items-center gap-2 bg-white/5 text-accent-gold border border-accent-gold/30 px-3 py-1.5 text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors"
               >
                 <Plus className="w-3 h-3" /> New CO
               </button>
             </div>
             
             {isAddingCO && (
               <div className="p-4 bg-black/50 border-b border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 items-end relative">
                 <button 
                    onClick={() => setIsAddingCO(false)}
                    className="absolute top-2 right-2 text-white/50 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                 <div className="md:col-span-2">
                   <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Description</label>
                   <input
                     type="text"
                     value={newCO.description}
                     onChange={(e) => setNewCO(prev => ({ ...prev, description: e.target.value }))}
                     className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none"
                     placeholder="e.g. Master Bath Layout Revision"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Cost Add</label>
                   <input
                     type="number"
                     value={newCO.amount || ''}
                     onChange={(e) => setNewCO(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                     className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none font-mono"
                     placeholder="0.00"
                   />
                 </div>
                 <div>
                    <button
                      onClick={handleAddCO}
                      className="w-full bg-accent-gold text-black font-bold h-[38px] text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors shadow-lg"
                    >
                      Save CO
                    </button>
                 </div>
               </div>
             )}

             <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                     <tr className="bg-black/50 border-b border-white/10">
                       <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted">CO Description</th>
                       <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted text-center">Status</th>
                       <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted text-right">Amount</th>
                       <th className="p-3 text-[10px] uppercase tracking-widest font-bold text-text-muted w-10"></th>
                     </tr>
                  </thead>
                  <tbody>
                     {changeOrders.length === 0 ? (
                       <tr>
                         <td colSpan={4} className="p-6 text-center text-white/30 text-sm italic font-serif">No change orders logged yet.</td>
                       </tr>
                     ) : (
                       changeOrders.map(co => (
                         <tr key={co.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                           <td className="p-3 text-white text-sm font-medium">
                             <input 
                               type="text"
                               value={co.description}
                               onChange={(e) => handleUpdateCO(co.id, 'description', e.target.value)}
                               className="bg-transparent border border-transparent hover:border-white/10 focus:border-accent-gold text-white text-sm p-1.5 outline-none transition-colors w-full"
                             />
                           </td>
                           <td className="p-3 text-center">
                              <select 
                                value={co.status}
                                onChange={(e) => handleUpdateCO(co.id, 'status', e.target.value)}
                                className={cn(
                                  "bg-transparent border border-white/10 text-[10px] uppercase tracking-widest font-bold p-1 rounded-sm outline-none cursor-pointer",
                                  co.status === 'approved' ? "text-teal-400 border-teal-400/30" : (co.status === 'paid' ? "text-blue-400 border-blue-400/30" : "text-accent-gold border-accent-gold/30")
                                )}
                              >
                                <option value="pending" className="bg-bg-surface">Pending</option>
                                <option value="approved" className="bg-bg-surface">Approved</option>
                                <option value="paid" className="bg-bg-surface">Paid</option>
                              </select>
                           </td>
                           <td className="p-3 text-right text-sm font-mono text-white/90">
                              <input 
                                type="number"
                                value={co.amount || ''}
                                onChange={(e) => handleUpdateCO(co.id, 'amount', parseFloat(e.target.value) || 0)}
                                className="bg-transparent border border-transparent hover:border-white/10 focus:border-accent-gold text-white/90 text-sm p-1.5 outline-none transition-colors w-24 text-right font-mono"
                                placeholder="0"
                              />
                           </td>
                           <td className="p-3 text-center">
                             <button 
                               onClick={() => handleDeleteCO(co.id)}
                               className="text-red-500 hover:bg-red-500/20 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       ))
                     )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <div className="bg-bg-surface border border-white/10 p-6 flex flex-col">
            <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px] mb-4">Budgeted vs Actual</h3>
            <div className="h-[300px] w-full mt-4">
              {budgetChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="var(--color-text-muted)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} 
                      angle={-45} 
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke="var(--color-text-muted)" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(v) => `$${v}`} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '12px', color: '#fff' }} 
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`$${value}`, undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="Budgeted" fill="var(--color-text-muted)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Actual" fill="var(--color-accent-gold)" radius={[2, 2, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm italic">
                  No allowances logged.
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg-surface border border-white/10 p-6 flex flex-col">
            <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px] mb-4">Change Orders Distribution</h3>
            <div className="h-[300px] w-full mt-4">
              {coChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={coChartData} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={100} 
                      innerRadius={60}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {coChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--color-bg-primary)', borderColor: 'rgba(255,255,255,0.1)', fontSize: '12px', color: '#fff' }} 
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`$${value}`, undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm italic">
                  No change orders logged.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
