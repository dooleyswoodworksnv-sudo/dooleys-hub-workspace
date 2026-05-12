import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Project,
  DesignConfig,
  BlueprintExtraction,
  TaskData,
  BudgetItemData,
  ChangeOrderData,
  SubcontractorData,
} from '../types';

// ─── Serialised bundle that gets saved / loaded ───
export interface ProjectBundle {
  version: 1;
  savedAt: string;
  project: Project | null;
  blueprintData: BlueprintExtraction | null;
  designConfig: DesignConfig | null;
  tasks: TaskData[];
  budgetItems: BudgetItemData[];
  changeOrders: ChangeOrderData[];
  subcontractors: SubcontractorData[];
}

const STORAGE_KEY = 'dooleys-hub-project';

interface ProjectState {
  // ── Project Identity ──
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // ── Blueprint → shared extraction data ──
  blueprintData: BlueprintExtraction | null;
  setBlueprintData: (data: BlueprintExtraction | null) => void;

  // ── Designer → shared config ──
  designConfig: DesignConfig | null;
  setDesignConfig: (config: DesignConfig | null) => void;

  // ── Project Manager → schedule & budget ──
  tasks: TaskData[];
  setTasks: (tasks: TaskData[]) => void;
  budgetItems: BudgetItemData[];
  setBudgetItems: (items: BudgetItemData[]) => void;
  changeOrders: ChangeOrderData[];
  setChangeOrders: (orders: ChangeOrderData[]) => void;
  subcontractors: SubcontractorData[];
  setSubcontractors: (subs: SubcontractorData[]) => void;

  // ── Persistence ──
  isDirty: boolean;
  saveToFile: () => void;
  loadFromFile: (file: File) => Promise<void>;
  resetProject: () => void;
}

const ProjectContext = createContext<ProjectState | undefined>(undefined);

// ─── Helpers ───

function loadFromStorage(): Partial<ProjectBundle> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectBundle;
  } catch {
    return null;
  }
}

function buildBundle(state: {
  currentProject: Project | null;
  blueprintData: BlueprintExtraction | null;
  designConfig: DesignConfig | null;
  tasks: TaskData[];
  budgetItems: BudgetItemData[];
  changeOrders: ChangeOrderData[];
  subcontractors: SubcontractorData[];
}): ProjectBundle {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    project: state.currentProject,
    blueprintData: state.blueprintData,
    designConfig: state.designConfig,
    tasks: state.tasks,
    budgetItems: state.budgetItems,
    changeOrders: state.changeOrders,
    subcontractors: state.subcontractors,
  };
}

// ─── Provider ───

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored = useRef(loadFromStorage());

  const [currentProject, setCurrentProject] = useState<Project | null>(stored.current?.project ?? null);
  const [designConfig, setDesignConfig] = useState<DesignConfig | null>(stored.current?.designConfig ?? null);
  const [blueprintData, setBlueprintData] = useState<BlueprintExtraction | null>(stored.current?.blueprintData ?? null);
  const [tasks, setTasks] = useState<TaskData[]>(stored.current?.tasks ?? []);
  const [budgetItems, setBudgetItems] = useState<BudgetItemData[]>(stored.current?.budgetItems ?? []);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderData[]>(stored.current?.changeOrders ?? []);
  const [subcontractors, setSubcontractors] = useState<SubcontractorData[]>(stored.current?.subcontractors ?? []);
  const [isDirty, setIsDirty] = useState(false);

  // Mark dirty on any state change (skip first render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsDirty(true);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors]);

  // Auto-persist to localStorage (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const bundle = buildBundle({
          currentProject, blueprintData, designConfig,
          tasks, budgetItems, changeOrders, subcontractors,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors]);

  // ── Save to .json file ──
  const saveToFile = useCallback(() => {
    const bundle = buildBundle({
      currentProject, blueprintData, designConfig,
      tasks, budgetItems, changeOrders, subcontractors,
    });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const projectName = currentProject?.name?.trim() || 'untitled';
    const safeName = projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').toLowerCase();
    const filename = `${safeName}-project.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsDirty(false);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors]);

  // ── Load from .json file ──
  const loadFromFile = useCallback(async (file: File) => {
    const text = await file.text();
    const bundle = JSON.parse(text) as ProjectBundle;

    if (!bundle.version || bundle.version !== 1) {
      throw new Error('Unrecognised project file format.');
    }

    setCurrentProject(bundle.project ?? null);
    setBlueprintData(bundle.blueprintData ?? null);
    setDesignConfig(bundle.designConfig ?? null);
    setTasks(bundle.tasks ?? []);
    setBudgetItems(bundle.budgetItems ?? []);
    setChangeOrders(bundle.changeOrders ?? []);
    setSubcontractors(bundle.subcontractors ?? []);
    setIsDirty(false);
  }, []);

  // ── Reset / New project ──
  const resetProject = useCallback(() => {
    setCurrentProject({ id: `prj-${Date.now()}`, name: '', projectNumber: '', createdAt: new Date().toISOString() });
    setBlueprintData(null);
    setDesignConfig(null);
    setTasks([]);
    setBudgetItems([]);
    setChangeOrders([]);
    setSubcontractors([]);
    setIsDirty(false);
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        setCurrentProject,
        designConfig,
        setDesignConfig,
        blueprintData,
        setBlueprintData,
        tasks,
        setTasks,
        budgetItems,
        setBudgetItems,
        changeOrders,
        setChangeOrders,
        subcontractors,
        setSubcontractors,
        isDirty,
        saveToFile,
        loadFromFile,
        resetProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
