import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Upload, Clock, CheckCircle, Trash2, Plus, X, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { type Task } from './GanttChart';
import { cn } from '@dooleys/ui';



export interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  taskIdMatches: string[];
  coiStatus: 'valid' | 'expired' | 'missing';
  permitStatus: 'valid' | 'expired' | 'missing';
  complianceDocs: string[];
  contactName?: string;
  phone?: string;
  email?: string;
}

interface SubcontractorComplianceProps {
  subcontractors: Subcontractor[];
  setSubcontractors: React.Dispatch<React.SetStateAction<Subcontractor[]>>;
  tasks: Task[];
  modelLoadedAt: string | null;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SubcontractorCompliance({ subcontractors, setSubcontractors, tasks, modelLoadedAt, onToast }: SubcontractorComplianceProps) {
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSub, setNewSub] = useState<Partial<Subcontractor>>({
    name: '',
    trade: '',
    taskIdMatches: [],
    coiStatus: 'missing',
    permitStatus: 'missing',
    complianceDocs: []
  });
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const getSubDates = (sub: Subcontractor) => {
    const subTasks = tasks.filter(t => sub.taskIdMatches.includes(t.id));
    if (subTasks.length === 0) return null;
    const start = new Date(Math.min(...subTasks.map(t => new Date(t.start).getTime())));
    const end = new Date(Math.max(...subTasks.map(t => new Date(t.end).getTime())));
    return { start, end };
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>, subId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Simulate upload
    setSubcontractors(prev => prev.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          complianceDocs: [...s.complianceDocs, file.name],
          coiStatus: s.coiStatus === 'missing' ? 'valid' : s.coiStatus,
          permitStatus: s.permitStatus === 'missing' ? 'valid' : s.permitStatus
        };
      }
      return s;
    }));
    if (onToast) onToast(`Uploaded compliance document for ${file.name}`, 'success');
    e.target.value = '';
  };

  const handleAddSub = () => {
    if (!newSub.name || !newSub.trade) return;
    const id = `sub-${Date.now()}`;
    setSubcontractors(prev => [...prev, {
      id,
      name: newSub.name as string,
      trade: newSub.trade as string,
      taskIdMatches: [],
      coiStatus: 'missing',
      permitStatus: 'missing',
      complianceDocs: []
    }]);
    setNewSub({ name: '', trade: '', taskIdMatches: [], coiStatus: 'missing', permitStatus: 'missing', complianceDocs: [] });
    setIsAddingSub(false);
  };

  const handleDeleteSub = (subId: string) => {
    setSubcontractors(prev => prev.filter(s => s.id !== subId));
  };

  return (
    <div className="mb-10 w-full overflow-hidden relative">
      <div 
        className="mb-6 border-b border-white/10 pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 cursor-pointer hover:bg-white/5 transition-colors p-2 -mx-2 rounded"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4">
          <div className="text-accent-gold mt-1.5">
            {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-2xl italic text-accent-gold" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Subcontractor &amp; Compliance</h2>
            <p className="text-[14px] text-text-muted mt-2">Manage trades, schedule synchronization, and insurance requirements.</p>
          </div>
        </div>
        {isExpanded && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsAddingSub(true); }}
            className="flex items-center gap-2 bg-accent-gold text-black font-bold h-10 px-4 text-[11px] uppercase tracking-[1px] hover:bg-white transition-all shadow-lg shadow-accent-gold/10 w-max"
          >
            <Plus className="w-4 h-4" /> Add Subcontractor
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {isAddingSub && (
        <div className="mb-6 bg-bg-surface border border-white/10 p-4 relative">
          <button 
            onClick={() => setIsAddingSub(false)}
            className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px] mb-4">New Subcontractor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Company Name</label>
              <input
                type="text"
                value={newSub.name}
                onChange={(e) => setNewSub(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none transition-colors"
                placeholder="e.g. Acme Plumbing"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-1">Trade/Service</label>
              <input
                type="text"
                value={newSub.trade}
                onChange={(e) => setNewSub(prev => ({ ...prev, trade: e.target.value }))}
                className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none transition-colors"
                placeholder="e.g. MEP Rough-Ins"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAddSub}
              className="bg-black border border-accent-gold text-accent-gold font-bold px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors"
            >
              Save Subcontractor
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-bg-surface border border-white/10 rounded overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-black/50 border-b border-white/10">
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Subcontractor</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Schedule (Auto-Sync)</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Compliance</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Model Version</th>
              <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-text-muted text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subcontractors.map((sub, idx) => {
              const dates = getSubDates(sub);
              return (
                <React.Fragment key={sub.id}>
                  <tr 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => setExpandedSubId(expandedSubId === sub.id ? null : sub.id)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {expandedSubId === sub.id ? <ChevronUp className="w-4 h-4 text-accent-gold" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                        <div>
                          <div className="font-bold text-white mb-1">{sub.name}</div>
                          <div className="text-[10px] text-accent-gold uppercase tracking-widest">{sub.trade}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {dates ? (
                        <div className="text-sm font-sans text-white/80">
                          {format(dates.start, 'MMM d, yyyy')} <span className="text-text-muted mx-1">â†’</span> {format(dates.end, 'MMM d, yyyy')}
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted italic">No tasks assigned</span>
                      )}
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {sub.coiStatus === 'valid' ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                          )}
                          <span className={cn("text-xs uppercase tracking-widest font-bold", sub.coiStatus === 'valid' ? "text-emerald-500" : "text-red-500")}>
                            COI: {sub.coiStatus}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {sub.permitStatus === 'valid' ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-red-500" />
                          )}
                          <span className={cn("text-xs uppercase tracking-widest font-bold", sub.permitStatus === 'valid' ? "text-emerald-500" : "text-red-500")}>
                            Permits: {sub.permitStatus}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      {modelLoadedAt ? (
                        <div className="inline-flex items-center gap-1.5 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold px-2 py-1 rounded-sm text-[10px] uppercase font-bold tracking-widest">
                          <CheckCircle className="w-3 h-3" />
                          Plans Synced
                          <span className="text-white/50 lowercase ml-1 tracking-normal font-sans">({format(new Date(modelLoadedAt), 'MM/dd HH:mm')})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-500 px-2 py-1 rounded-sm text-[10px] uppercase font-bold tracking-widest">
                          <Clock className="w-3 h-3" />
                          No Model Loaded
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteSub(sub.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 border border-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remove Subcontractor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <label className="cursor-pointer inline-flex items-center justify-center gap-2 border border-white/20 bg-black/50 text-text-muted text-[10px] uppercase tracking-widest px-4 py-2 hover:border-accent-gold hover:text-accent-gold transition-colors">
                            <Upload className="w-3 h-3" /> Upload Compliance
                            <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleDocumentUpload(e, sub.id)} />
                          </label>
                        </div>
                        {sub.complianceDocs?.length > 0 && (
                          <div className="text-[10px] text-emerald-500/80">
                            {sub.complianceDocs.length} document(s)
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedSubId === sub.id && (
                    <tr className="bg-black/30 border-b border-white/5">
                      <td colSpan={5} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                          <div>
                            <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2">Primary Contact</label>
                            <input
                              type="text"
                              value={sub.contactName || ''}
                              onChange={(e) => setSubcontractors(prev => prev.map(s => s.id === sub.id ? { ...s, contactName: e.target.value } : s))}
                              className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none transition-colors"
                              placeholder="e.g. John Doe"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2">Phone Number</label>
                            <input
                              type="tel"
                              value={sub.phone || ''}
                              onChange={(e) => setSubcontractors(prev => prev.map(s => s.id === sub.id ? { ...s, phone: e.target.value } : s))}
                              className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none transition-colors"
                              placeholder="e.g. (555) 123-4567"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2">Email Address</label>
                            <input
                              type="email"
                              value={sub.email || ''}
                              onChange={(e) => setSubcontractors(prev => prev.map(s => s.id === sub.id ? { ...s, email: e.target.value } : s))}
                              className="w-full bg-black border border-white/10 text-white text-sm p-2 focus:border-accent-gold outline-none transition-colors"
                              placeholder="e.g. john@example.com"
                            />
                          </div>
                        </div>
                        {/* Task Assignment (BUG-008) */}
                        {tasks.length > 0 && (
                          <div className="mt-4 max-w-4xl mx-auto">
                            <label className="block text-[10px] text-text-muted uppercase tracking-widest mb-2">Assigned Tasks</label>
                            <div className="flex flex-wrap gap-2">
                              {tasks.map(task => {
                                const isAssigned = sub.taskIdMatches.includes(task.id);
                                return (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => {
                                      setSubcontractors(prev => prev.map(s => {
                                        if (s.id !== sub.id) return s;
                                        const newMatches = isAssigned
                                          ? s.taskIdMatches.filter(id => id !== task.id)
                                          : [...s.taskIdMatches, task.id];
                                        return { ...s, taskIdMatches: newMatches };
                                      }));
                                    }}
                                    className={cn(
                                      "text-[11px] px-3 py-1.5 border rounded-sm transition-all font-medium",
                                      isAssigned
                                        ? "bg-accent-gold/20 border-accent-gold/50 text-accent-gold"
                                        : "bg-black/50 border-white/10 text-text-muted hover:border-accent-gold/30 hover:text-white"
                                    )}
                                  >
                                    {task.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
