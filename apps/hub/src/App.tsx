import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Card, Badge } from '@dooleys/ui';
import { useProject } from '@dooleys/core';
import { BlueprintModule } from '@dooleys/feature-blueprints';
import { ProjectModule } from '@dooleys/feature-projects';
import { DesignerModule } from '@dooleys/feature-designer';
import { FileText, PenTool, ClipboardCheck, ArrowRight, Layers, DollarSign, Activity, Plus, Save, FolderOpen, Check, AlertTriangle } from 'lucide-react';

// ── Toast notification ──
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error' | 'info'; onDone: () => void }) {
  React.useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const colors = {
    success: 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald',
    error:   'border-red-400/40 bg-red-400/10 text-red-400',
    info:    'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
  };
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-md text-sm font-medium animate-[slideUp_0.3s_ease-out] ${colors[type]}`}>
      {type === 'success' && <Check className="w-4 h-4" />}
      {type === 'error' && <AlertTriangle className="w-4 h-4" />}
      {message}
    </div>
  );
}

// ── Confirm dialog ──
function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-bg-secondary border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-[scaleIn_0.2s_ease-out]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        </div>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted bg-bg-surface border border-border hover:border-white/20 hover:text-text-primary transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-blue hover:bg-accent-blue/80 transition-all"
          >
            New Project
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const {
    blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors,
    currentProject, setCurrentProject,
    isDirty, saveToFile, loadFromFile, resetProject,
  } = useProject();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blueprintItemCount = blueprintData?.items?.length ?? 0;
  const roomCount = blueprintData?.items?.filter(i => i.type === 'room').length ?? 0;
  const dimensionCount = blueprintData?.items?.filter(i => i.type === 'dimension').length ?? 0;
  const taskCount = tasks?.length ?? 0;
  const completedTaskCount = tasks?.filter(t => t.status === 'completed').length ?? 0;
  const materialCost = designConfig?.materialEstimate?.totalCost ?? 0;
  const materialLineItemCount = designConfig?.materialEstimate?.lineItems?.length ?? 0;
  const floorArea = designConfig?.floorArea ?? 0;
  const budgetTotal = budgetItems?.reduce((sum, b) => sum + b.budgeted, 0) ?? 0;
  const budgetActual = budgetItems?.reduce((sum, b) => sum + b.actual, 0) ?? 0;
  const changeOrderTotal = changeOrders?.reduce((sum, co) => sum + co.amount, 0) ?? 0;
  const subCount = subcontractors?.length ?? 0;

  const activeBridges = [
    blueprintItemCount > 0,
    materialCost > 0,
    taskCount > 0,
  ].filter(Boolean).length;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  // ── Button handlers ──

  const handleNewProject = useCallback(() => {
    const hasData = currentProject?.name || blueprintItemCount > 0 || taskCount > 0 || materialCost > 0;
    if (hasData && isDirty) {
      setShowConfirm(true);
    } else {
      resetProject();
      setToast({ message: 'New project created', type: 'success' });
    }
  }, [currentProject, blueprintItemCount, taskCount, materialCost, isDirty, resetProject]);

  const handleConfirmNew = useCallback(() => {
    setShowConfirm(false);
    resetProject();
    setToast({ message: 'New project created', type: 'success' });
  }, [resetProject]);

  const handleSaveProject = useCallback(() => {
    try {
      saveToFile();
      setToast({ message: `Project saved as ${(currentProject?.name || 'untitled').trim()}-project.json`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to save project file', type: 'error' });
    }
  }, [saveToFile, currentProject]);

  const handleLoadProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
      setToast({ message: `Loaded project from ${file.name}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to load project file', type: 'error' });
    }
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }, [loadFromFile]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Confirm dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Unsaved Changes"
          message="You have unsaved changes. Starting a new project will discard all current data. Would you like to continue?"
          onConfirm={handleConfirmNew}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Hidden file input for Load */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header Row */}
      <div className="mb-6 flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-5">
            Dooley's Construction Hub
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-sm">
              <label className="block text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1.5">Project Name</label>
              <input
                id="project-name-input"
                type="text"
                value={currentProject?.name ?? ''}
                onChange={(e) => {
                  setCurrentProject({
                    ...(currentProject ?? { id: `prj-${Date.now()}`, name: '', projectNumber: '', createdAt: new Date().toISOString() }),
                    name: e.target.value,
                  });
                }}
                placeholder="Enter project name..."
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
              />
            </div>
            <div className="w-48">
              <label className="block text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1.5">Project Number</label>
              <input
                id="project-number-input"
                type="text"
                value={currentProject?.projectNumber ?? ''}
                onChange={(e) => {
                  setCurrentProject({
                    ...(currentProject ?? { id: `prj-${Date.now()}`, name: '', projectNumber: '', createdAt: new Date().toISOString() }),
                    projectNumber: e.target.value,
                  });
                }}
                placeholder="PRJ-2026-001"
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            id="new-project-btn"
            onClick={handleNewProject}
            className="flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text-primary hover:border-accent-blue/40 hover:bg-accent-blue/5 transition-all duration-200 group"
          >
            <Plus className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors" />
            New Project
          </button>
          <button
            id="load-project-btn"
            onClick={handleLoadProject}
            className="flex items-center gap-2 bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-medium text-text-primary hover:border-accent-emerald/40 hover:bg-accent-emerald/5 transition-all duration-200 group"
          >
            <FolderOpen className="w-4 h-4 text-text-muted group-hover:text-accent-emerald transition-colors" />
            Load Project
          </button>
          <button
            id="save-project-btn"
            onClick={handleSaveProject}
            className="flex items-center gap-2 bg-accent-blue/10 border border-accent-blue/30 rounded-lg px-4 py-2.5 text-sm font-medium text-accent-blue hover:bg-accent-blue/20 hover:border-accent-blue/50 transition-all duration-200"
          >
            <Save className="w-4 h-4" />
            Save Project
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Live Bridge Status */}
      {activeBridges > 0 && (
        <div className="mb-8 bg-bg-surface border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-accent-blue" />
              <p className="text-sm text-text-primary font-medium">
                Project Bridge — {activeBridges}/3 modules connected
              </p>
            </div>
            <Badge variant="success">Live</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`rounded-lg p-3 border ${blueprintItemCount > 0 ? 'bg-accent-blue/5 border-accent-blue/20' : 'bg-bg-primary border-border opacity-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-accent-blue" />
                <span className="text-xs font-medium text-text-primary">Blueprint Reader</span>
              </div>
              <p className="text-xs text-text-muted">
                {blueprintItemCount > 0
                  ? `${blueprintItemCount} items • ${roomCount} rooms • ${dimensionCount} dims`
                  : 'No data yet'}
              </p>
            </div>

            <div className={`rounded-lg p-3 border ${materialCost > 0 ? 'bg-accent-emerald/5 border-accent-emerald/20' : 'bg-bg-primary border-border opacity-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <PenTool className="w-3.5 h-3.5 text-accent-emerald" />
                <span className="text-xs font-medium text-text-primary">Designer</span>
              </div>
              <p className="text-xs text-text-muted">
                {materialCost > 0
                  ? `${formatCurrency(materialCost)} est. • ${materialLineItemCount} items • ${floorArea.toLocaleString()} sqft`
                  : 'No data yet'}
              </p>
            </div>

            <div className={`rounded-lg p-3 border ${taskCount > 0 ? 'bg-accent-gold/5 border-accent-gold/20' : 'bg-bg-primary border-border opacity-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardCheck className="w-3.5 h-3.5 text-accent-gold" />
                <span className="text-xs font-medium text-text-primary">Project Manager</span>
              </div>
              <p className="text-xs text-text-muted">
                {taskCount > 0
                  ? `${completedTaskCount}/${taskCount} tasks • ${subCount} subs • ${formatCurrency(budgetTotal)} budget`
                  : 'No data yet'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Row */}
      {(materialCost > 0 || budgetTotal > 0) && (
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {materialCost > 0 && (
            <div className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-accent-emerald" />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Material Est.</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{formatCurrency(materialCost)}</p>
            </div>
          )}
          {budgetTotal > 0 && (
            <div className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-accent-gold" />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Budget</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{formatCurrency(budgetTotal)}</p>
              {budgetActual > 0 && (
                <p className={`text-xs mt-1 ${budgetActual > budgetTotal ? 'text-red-400' : 'text-accent-emerald'}`}>
                  {formatCurrency(budgetActual)} actual ({budgetActual <= budgetTotal ? 'under' : 'over'} budget)
                </p>
              )}
            </div>
          )}
          {changeOrderTotal > 0 && (
            <div className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Change Orders</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{formatCurrency(changeOrderTotal)}</p>
              <p className="text-xs text-text-muted mt-1">{changeOrders.length} order{changeOrders.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          {floorArea > 0 && (
            <div className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-accent-blue" />
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Floor Area</span>
              </div>
              <p className="text-xl font-bold text-text-primary">{floorArea.toLocaleString()} sqft</p>
              {designConfig?.stories && (
                <p className="text-xs text-text-muted mt-1">{designConfig.stories} {designConfig.stories === 1 ? 'story' : 'stories'}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/blueprints" className="group">
          <Card className="p-6 h-full transition-all duration-200 hover:border-accent-blue/40 hover:shadow-lg hover:shadow-accent-blue/5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-accent-blue" />
              </div>
              {blueprintItemCount > 0 && (
                <Badge variant="info">{blueprintItemCount} items</Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Blueprint Reader</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Extract dimensions, rooms, and materials from construction PDFs using AI.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-accent-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open module <ArrowRight className="w-3 h-3" />
            </div>
          </Card>
        </Link>

        <Link to="/designer" className="group">
          <Card className="p-6 h-full transition-all duration-200 hover:border-accent-emerald/40 hover:shadow-lg hover:shadow-accent-emerald/5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-emerald/10 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-accent-emerald" />
              </div>
              {materialCost > 0 && (
                <Badge variant="success">{formatCurrency(materialCost)}</Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Designer</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Create 2D floor plans and 3D structural models with SketchUp export.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-accent-emerald font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open module <ArrowRight className="w-3 h-3" />
            </div>
          </Card>
        </Link>

        <Link to="/projects" className="group">
          <Card className="p-6 h-full transition-all duration-200 hover:border-accent-gold/40 hover:shadow-lg hover:shadow-accent-gold/5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-accent-gold" />
              </div>
              {taskCount > 0 && (
                <Badge variant="gold">{completedTaskCount}/{taskCount} tasks</Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-1">Project Manager</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Track schedules, budgets, change orders, and subcontractor compliance.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-accent-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open module <ArrowRight className="w-3 h-3" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      {{
        dashboard: <Dashboard />,
        blueprints: <BlueprintModule />,
        designer: <DesignerModule />,
        projects: <ProjectModule />,
      }}
    </Layout>
  );
}
