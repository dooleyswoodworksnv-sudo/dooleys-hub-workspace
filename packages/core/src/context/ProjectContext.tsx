import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Project,
  DesignConfig,
  BlueprintExtraction,
  TaskData,
  BudgetItemData,
  ChangeOrderData,
  SubcontractorData,
  ProgressPhotoData,
  DailyLogData,
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
  progressPhotos?: ProgressPhotoData[];
  dailyLogs?: DailyLogData[];
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
  progressPhotos: ProgressPhotoData[];
  setProgressPhotos: (photos: ProgressPhotoData[]) => void;
  dailyLogs: DailyLogData[];
  setDailyLogs: (logs: DailyLogData[]) => void;

  // ── Persistence ──
  isDirty: boolean;
  projectFileName: string | null;
  saveToFile: () => Promise<void>;
  loadFromFile: (file?: File) => Promise<void>;
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
  progressPhotos: ProgressPhotoData[];
  dailyLogs: DailyLogData[];
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
    progressPhotos: state.progressPhotos,
    dailyLogs: state.dailyLogs,
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
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhotoData[]>(stored.current?.progressPhotos ?? []);
  const [dailyLogs, setDailyLogs] = useState<DailyLogData[]>(stored.current?.dailyLogs ?? []);
  const [isDirty, setIsDirty] = useState(false);
  const [fileHandleState, setFileHandleState] = useState<FileSystemFileHandle | null>(null);
  const [projectFileName, setProjectFileName] = useState<string | null>(null);
  const suppressDirtyCountRef = useRef(0);

  // Mark dirty on any state change (skip first render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (suppressDirtyCountRef.current > 0) {
      suppressDirtyCountRef.current--;
      return;
    }
    setIsDirty(true);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors, progressPhotos, dailyLogs]);

  // Auto-persist to localStorage (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const bundle = buildBundle({
          currentProject, blueprintData, designConfig,
          tasks, budgetItems, changeOrders, subcontractors,
          progressPhotos, dailyLogs,
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
      } catch {
        // localStorage full or unavailable — silently skip
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors, progressPhotos, dailyLogs]);

  // ── Save to .json file (reuses handle for save-in-place) ──
  const saveToFile = useCallback(async () => {
    const bundle = buildBundle({
      currentProject, blueprintData, designConfig,
      tasks, budgetItems, changeOrders, subcontractors,
      progressPhotos, dailyLogs,
    });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const projectName = currentProject?.name?.trim() || 'untitled';
    const safeName = projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-').toLowerCase();
    const defaultFilename = `${safeName}-project.json`;

    // If we already have a file handle, write directly (save-in-place)
    if (fileHandleState) {
      try {
        const writable = await fileHandleState.createWritable();
        await writable.write(blob);
        await writable.close();
        setIsDirty(false);
        return;
      } catch (err) {
        console.warn('Direct file write failed, falling back to picker', err);
        // Fall through to picker / download
      }
    }

    const isIframe = window.self !== window.top;

    // Try File System Access API (Chrome, Edge) — get a handle for future saves
    if ('showSaveFilePicker' in window && !isIframe) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{
            description: 'Dooley\'s Hub Project',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setFileHandleState(handle);
        setProjectFileName(handle.name);
        setIsDirty(false);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn('showSaveFilePicker failed, falling back to download', err);
      }
    }

    // Fallback: plain download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setProjectFileName(defaultFilename);
    setIsDirty(false);
  }, [currentProject, blueprintData, designConfig, tasks, budgetItems, changeOrders, subcontractors, progressPhotos, dailyLogs, fileHandleState]);

  // ── Load from .json file (or open file picker if no file provided) ──
  const loadFromFile = useCallback(async (file?: File) => {
    let targetFile = file;
    let handle: FileSystemFileHandle | null = null;

    // If no file passed, open a file picker
    if (!targetFile) {
      const isIframe = window.self !== window.top;
      if ('showOpenFilePicker' in window && !isIframe) {
        try {
          const [pickedHandle] = await (window as any).showOpenFilePicker({
            types: [{
              description: 'Dooley\'s Hub Project',
              accept: { 'application/json': ['.json'] },
            }],
          });
          handle = pickedHandle;
          targetFile = await pickedHandle.getFile();
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User cancelled
          throw err;
        }
      } else {
        // Fallback: programmatic file input
        return new Promise<void>((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (ev) => {
            const f = (ev.target as HTMLInputElement).files?.[0];
            if (!f) { resolve(); return; }
            try {
              await loadFromFile(f);
              resolve();
            } catch (err) { reject(err); }
          };
          input.click();
        });
      }
    }

    if (!targetFile) return;

    const text = await targetFile.text();
    const bundle = JSON.parse(text) as ProjectBundle;

    if (!bundle.version || bundle.version !== 1) {
      throw new Error('Unrecognised project file format.');
    }

    suppressDirtyCountRef.current = 9; // Suppress dirty for all 9 setState calls below
    setCurrentProject(bundle.project ?? null);
    setBlueprintData(bundle.blueprintData ?? null);
    setDesignConfig(bundle.designConfig ?? null);
    setTasks(bundle.tasks ?? []);
    setBudgetItems(bundle.budgetItems ?? []);
    setChangeOrders(bundle.changeOrders ?? []);
    setSubcontractors(bundle.subcontractors ?? []);
    setProgressPhotos(bundle.progressPhotos ?? []);
    setDailyLogs(bundle.dailyLogs ?? []);
    setIsDirty(false);

    // Capture the file handle so future saves go to the same file
    if (handle) {
      setFileHandleState(handle);
      setProjectFileName(handle.name);
    } else if (targetFile.name) {
      setProjectFileName(targetFile.name);
    }
  }, []);

  // ── Reset / New project ──
  const resetProject = useCallback(() => {
    suppressDirtyCountRef.current = 9; // Suppress dirty for all 9 setState calls below
    setCurrentProject({ id: `prj-${Date.now()}`, name: '', projectNumber: '', createdAt: new Date().toISOString() });
    setBlueprintData(null);
    setDesignConfig(null);
    setTasks([]);
    setBudgetItems([]);
    setChangeOrders([]);
    setSubcontractors([]);
    setProgressPhotos([]);
    setDailyLogs([]);
    setIsDirty(false);
    setFileHandleState(null);
    setProjectFileName(null);
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
        progressPhotos,
        setProgressPhotos,
        dailyLogs,
        setDailyLogs,
        isDirty,
        projectFileName,
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
