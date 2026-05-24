import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  HardHat,
  MonitorPlay,
  Briefcase,
  ChevronRight,
  TrendingDown,
  Activity,
  Layers,
  MapPin,
  Cpu,
  Sofa,
  Eye,
  Settings2,
  FileText,
  Download,
  Upload,
  X,
  Trash2,
  FileCode,
  Box,
  Search,
  Filter,
  Calendar,
  User,
  Plus,
  ArrowRight,
  Maximize2,
  CheckCircle,
  GripVertical,
  Image as ImageIcon,
  Camera,
  Crosshair,
  ChevronDown,
  Save
} from 'lucide-react';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import { cn } from '@dooleys/ui';
import { useProject } from '@dooleys/core';
import { BimViewer } from './components/BimViewer';

import { GanttChart, INITIAL_TASKS, type Task } from './components/GanttChart';
import { SubcontractorCompliance, type Subcontractor } from './components/SubcontractorCompliance';
import { BudgetModule, type BudgetItem, type ChangeOrder } from './components/BudgetModule';



const INITIAL_BUDGET_ITEMS: BudgetItem[] = [];

const INITIAL_CHANGE_ORDERS: ChangeOrder[] = [];

type DefinitionLevel = 1 | 2 | 3 | 4 | 5;

interface PDRIElement {
  id: string;
  category: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  riskIfPoor: string;
  bimRecommendation: {
    use: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}

interface DailyLogEntry {
  id: string;
  date: string;
  content: string;
}

const INITIAL_SUBCONTRACTORS: Subcontractor[] = [];

interface Issue {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  status: 'open' | 'resolved';
  clashIds?: string[];
  position?: [number, number, number];
  source?: 'manual' | 'scan' | 'bcf';
}

interface ProgressPhoto {
  id: string;
  url: string;
  date: string;
  phase: string;
  location?: [number, number, number];
  note?: string;
}

const CRITICAL_ELEMENTS: PDRIElement[] = [
  {
    id: "E10",
    category: "Building Elements",
    name: "Building Finishes",
    icon: Layers,
    description: "Detailed specification of interior and exterior finishes (e.g., large-format tile, specialty cladding).",
    riskIfPoor: "Modern finishes often have long lead times. Changes mid-construction cause catastrophic schedule delays.",
    bimRecommendation: {
      use: "Design Authoring & Visualization",
      description: "Produce high-fidelity 3D renderings to secure final client sign-off on cost-heavy finishes before procurement.",
      icon: Eye,
    }
  },
  {
    id: "D6",
    category: "Site Information",
    name: "Site Utility Information",
    icon: MapPin,
    description: "Definition of incoming power, water, sewer, and gas capacities and routing.",
    riskIfPoor: "A $2.5M home may require upgraded transformers or custom grading. Undefined routing guarantees change orders.",
    bimRecommendation: {
      use: "Condition Modeling & Site Utilization",
      description: "Map lot topography and existing utilities in 3D to ensure proposed trenching avoids structure conflicts.",
      icon: HardHat,
    }
  },
  {
    id: "G1",
    category: "Equipment",
    name: "Equipment & System Specs",
    icon: Cpu,
    description: "High-level definition of MEP systems (smart home tech, custom HVAC, spa equipment).",
    riskIfPoor: "Modern open-concept homes have limited chase space. Undefined equipment guarantees massive framing rework.",
    bimRecommendation: {
      use: "3D Coordination (Clash Detection)",
      description: "Run digital clash tests between structural framing and MEP systems to ensure they fit in the architectural envelope.",
      icon: MonitorPlay,
    }
  },
  {
    id: "C3",
    category: "Project Requirements",
    name: "Site & Constraint Evaluation",
    icon: AlertTriangle,
    description: "Detailed analysis of site constraints (setbacks, soil conditions, restrictive covenants).",
    riskIfPoor: "Late discovery of soil issues or setback violations can pause the project indefinitely or require redesign.",
    bimRecommendation: {
      use: "Phase Planning (4D Modeling)",
      description: "Model site logistics to ensure large materials and cranes can maneuver the site without delays.",
      icon: Activity,
    }
  },
  {
    id: "E12",
    category: "Building Elements",
    name: "Furnishings & Built-ins",
    icon: Sofa,
    description: "Architectural casework, custom cabinetry, smart appliances, and integrated lighting.",
    riskIfPoor: "Built-ins require blocking and precise rough-ins. Without exact specs, drywall and framing will need localized demolition.",
    bimRecommendation: {
      use: "Digital Fabrication",
      description: "Extract exact dimensions from the BIM model for millworkers to construct built-ins concurrently with framing.",
      icon: Briefcase,
    }
  }
];

const LEVEL_DESCRIPTIONS: Record<DefinitionLevel, string> = {
  1: "Complete Definition",
  2: "Minor Deficiencies",
  3: "Some Deficiencies",
  4: "Major Deficiencies",
  5: "Incomplete or Poor",
};

const MOCK_FILE_CONTENTS: Record<string, any> = {};

interface SortablePDRIElementProps {
  el: PDRIElement;
  idx: number;
  score: DefinitionLevel;
  isActive: boolean;
  onSelect: (id: string) => void;
  onScoreChange: (id: string, score: DefinitionLevel) => void;
  children?: React.ReactNode;
}

function SortablePDRIElement({ el, idx, score, isActive, onSelect, onScoreChange, children }: SortablePDRIElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: el.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full text-left bg-bg-surface border transition-all duration-300",
        isActive ? "border-accent-gold shadow-[0_0_20px_rgba(212,175,55,0.05)] translate-x-1" : "border-white/10 hover:border-white/20 hover:scale-[1.01]",
        isDragging ? "opacity-50 ring-2 ring-accent-gold" : ""
      )}
    >
      <div 
        className="p-[24px] cursor-pointer flex items-center gap-6"
        onClick={() => onSelect(el.id)}
      >
        <div 
          className="text-text-muted hover:text-white cursor-grab active:cursor-grabbing p-2 -ml-2 shrink-0"
          {...attributes} 
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        
        <div className="text-3xl opacity-20 w-12 shrink-0 font-serif hidden sm:block" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2 py-0.5 text-[9px] font-bold bg-bg-primary text-text-muted border border-white/10 rounded tracking-widest uppercase">
              {el.id}
            </span>
            <h3 className="text-[15px] uppercase tracking-[1px] text-text-primary font-bold">{el.name}</h3>
          </div>
          <p className="text-[13px] text-text-muted leading-[1.5] line-clamp-1">
            {el.description}
          </p>
        </div>
        
        <div className="flex flex-col items-end shrink-0 gap-3">
          <div className="flex items-center gap-1 bg-bg-primary p-1 border border-white/5" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => onScoreChange(el.id, val as DefinitionLevel)}
                className={cn(
                  "w-8 h-7 text-[11px] font-bold transition-all",
                  score === val 
                    ? (val >= 3 ? "bg-red-500 text-bg-primary" : "bg-accent-gold text-bg-primary")
                    : "text-text-muted hover:bg-white/10"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {isActive && children && (
        <div className="border-t border-white/10 p-[24px] bg-bg-primary" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

interface PMAppProps {
  onPMChange?: (payload: import('./index').PMBridgePayload) => void;
}

export default function App({ onPMChange }: PMAppProps = {}) {
  // ── Bridge: read Designer data & project identity ──
  const {
    designConfig,
    currentProject,
    setCurrentProject,
    tasks: contextTasks,
    budgetItems: contextBudgetItems,
    changeOrders: contextChangeOrders,
    subcontractors: contextSubcontractors,
    progressPhotos: contextProgressPhotos,
    dailyLogs: contextDailyLogs,
    saveToFile: contextSaveToFile,
    loadFromFile: contextLoadFromFile,
    projectFileName,
  } = useProject();

  const [elements, setElements] = useState<PDRIElement[]>(CRITICAL_ELEMENTS);
  const [scores, setScores] = useState<Record<string, DefinitionLevel>>({});

  const [fileStorage, setFileStorage] = useState<Record<string, File>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Record<string, string[]>>({});

  const [activeElementId, setActiveElementId] = useState<string | null>(CRITICAL_ELEMENTS[0].id);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const [issues, setIssues] = useState<Record<string, Issue[]>>({});
  const [newIssue, setNewIssue] = useState<Partial<Issue>>({ title: '', assignee: '', dueDate: '' });
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // 3D Model state
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelLoadedAt, setModelLoadedAt] = useState<string | null>(null);

  // Project Schedule & Subcontractors
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (contextTasks && contextTasks.length > 0) {
      return contextTasks.map(t => ({
        id: t.id,
        name: t.name,
        start: new Date(t.start),
        end: new Date(t.end),
        progress: t.progress,
        status: t.status,
        dependencies: t.dependencies,
        drawPct: t.drawPct || 0,
      }));
    }
    return INITIAL_TASKS;
  });
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>(() => contextSubcontractors || INITIAL_SUBCONTRACTORS);

  // Budget & Allowances
  const [baseContractPrice, setBaseContractPrice] = useState<number>(0);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() => contextBudgetItems || INITIAL_BUDGET_ITEMS);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>(() => contextChangeOrders || INITIAL_CHANGE_ORDERS);

  // Daily Progress & Spatial Logs State
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>(() => contextProgressPhotos || []);
  const [isPinningMode, setIsPinningMode] = useState<string | null>(null); // holds photo id
  const [showPhotoPins, setShowPhotoPins] = useState(true);
  const [viewingPhotoId, setViewingPhotoId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [batchPhaseOpen, setBatchPhaseOpen] = useState(false);
  const [photoSortOrder, setPhotoSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [photoPhaseFilter, setPhotoPhaseFilter] = useState<string>('all');
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>(() => contextDailyLogs || []);

  const lastProjectIdRef = useRef<string | null>(currentProject?.id || null);
  useEffect(() => {
    const projId = currentProject?.id || null;
    if (projId !== lastProjectIdRef.current) {
      lastProjectIdRef.current = projId;
      
      // Hydrate tasks
      if (contextTasks && contextTasks.length > 0) {
        setTasks(contextTasks.map(t => ({
          id: t.id,
          name: t.name,
          start: new Date(t.start),
          end: new Date(t.end),
          progress: t.progress,
          status: t.status,
          dependencies: t.dependencies,
          drawPct: t.drawPct || 0,
        })));
      } else {
        setTasks(INITIAL_TASKS);
      }

      // Hydrate subcontractors
      setSubcontractors(contextSubcontractors || INITIAL_SUBCONTRACTORS);

      // Hydrate budget
      setBudgetItems(contextBudgetItems || INITIAL_BUDGET_ITEMS);
      setChangeOrders(contextChangeOrders || INITIAL_CHANGE_ORDERS);

      // Hydrate photos & logs
      setProgressPhotos(contextProgressPhotos || []);
      setDailyLogs(contextDailyLogs || []);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  // ── Bridge: sync PM data to shared ProjectContext ──
  useEffect(() => {
    if (!onPMChange) return;
    onPMChange({
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        start: t.start.toISOString(),
        end: t.end.toISOString(),
        progress: t.progress,
        status: t.status as 'completed' | 'on-track' | 'pending' | 'delayed',
        dependencies: t.dependencies,
        drawPct: t.drawPct,
      })),
      budgetItems: budgetItems.map(b => ({
        id: b.id,
        name: b.name,
        budgeted: b.budgeted,
        actual: b.actual,
      })),
      changeOrders: changeOrders.map(co => ({
        id: co.id,
        description: co.description,
        amount: co.amount,
        status: co.status,
      })),
      subcontractors: subcontractors.map(s => ({
        id: s.id,
        name: s.name,
        trade: s.trade,
        taskIdMatches: s.taskIdMatches,
        coiStatus: s.coiStatus,
        permitStatus: s.permitStatus,
      })),
      progressPhotos: progressPhotos.map(p => ({
        id: p.id,
        url: p.url,
        date: p.date,
        phase: p.phase,
        location: p.location,
        note: p.note,
      })),
      dailyLogs: dailyLogs.map(l => ({
        id: l.id,
        date: l.date,
        content: l.content,
      })),
    });
  }, [tasks, budgetItems, changeOrders, subcontractors, progressPhotos, dailyLogs, onPMChange]);

  // Accordion state
  const [isAuditExpanded, setIsAuditExpanded] = useState(true);
  const [isLogsExpanded, setIsLogsExpanded] = useState(true);

  // Refs
  const dailyLogRef = useRef<HTMLTextAreaElement>(null);

  // Stable blob URL for document preview (avoids leak from inline createObjectURL)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!previewFile || !fileStorage[previewFile] || !fileStorage[previewFile].type.startsWith('image/')) {
      setPreviewImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(fileStorage[previewFile]);
    setPreviewImageUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewFile, fileStorage]);

  // New Element Form State
  const [newElement, setNewElement] = useState<Partial<PDRIElement>>({
    id: "",
    category: "Building Elements",
    name: "",
    description: "",
    riskIfPoor: "",
    bimRecommendation: {
      use: "",
      description: "",
      icon: Box
    }
  });

  const handleScoreChange = (id: string, score: DefinitionLevel) => {
    setScores(prev => ({ ...prev, [id]: score }));
  };

  const handleNoteChange = (id: string, note: string) => {
    setNotes(prev => ({ ...prev, [id]: note }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setElements((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeAttachment = (id: string, fileName: string) => {
    setAttachments(prev => ({
      ...prev,
      [id]: prev[id].filter((name) => name !== fileName)
    }));
  };

  const simulateUpload = (id: string, file: File | null = null) => {
    const fileName = file ? file.name : `Shop_Drawing_${id}_${new Date().getTime()}.pdf`;
    
    if (file) {
      setFileStorage(prev => ({ ...prev, [fileName]: file }));
    }

    setAttachments(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), fileName]
    }));
  };

  const simulateDownload = (fileName: string) => {
    setPreviewFile(fileName);
  };

  const [bcfImportStatus, setBcfImportStatus] = useState<string | null>(null);

  const handleSaveProject = async () => {
    try {
      await contextSaveToFile();
      setToast({ message: projectFileName ? `Project updated: ${projectFileName}` : 'Project saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save project file', type: 'error' });
    }
  };

  const handleImportProject = async () => {
    try {
      await contextLoadFromFile();
      setToast({ message: 'Project loaded', type: 'success' });
    } catch (err: any) {
      if (err?.message) {
        console.error("Failed to load project file", err);
        setToast({ message: err.message, type: 'error' });
      }
    }
  };

  const handleScanConflicts = (elementId: string) => {
    const mockIssue: Issue = {
      id: `iss-scan-${Date.now()}`,
      title: 'Automated Clash Detection: Clearance Violation',
      assignee: 'BIM Coordinator',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      status: 'open',
      source: 'scan',
      clashIds: ['el-beam-1', 'el-pipe-1'],
      position: [0, 0, 0]
    };
    setIssues(prev => ({ ...prev, [elementId]: [...(prev[elementId] || []), mockIssue] }));
  };

  const handleImportBCF = (e: React.ChangeEvent<HTMLInputElement>, elementId: string) => {
    if (!e.target.files?.length) return;
    
    // Set importing status
    setBcfImportStatus(`Importing ${e.target.files[0].name}...`);
    
    // Simulate async import
    setTimeout(() => {
      const mockIssue: Issue = {
        id: `iss-bcf-${Date.now()}`,
        title: 'BCF Import: Tolerance Exceeded',
        assignee: 'External Contractor',
        dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
        status: 'open',
        source: 'bcf',
        position: [2, 0, -2]
      };
      setIssues(prev => ({ ...prev, [elementId]: [...(prev[elementId] || []), mockIssue] }));
      setBcfImportStatus('Successfully imported 1 issue from BCF');
      
      // Clear status after 3 seconds
      setTimeout(() => {
        setBcfImportStatus(null);
      }, 3000);
    }, 1500);

    e.target.value = '';
  };

  const handleAddIssue = (elementId: string) => {
    if (!newIssue.title) return;
    const issue: Issue = {
      id: `iss-${Date.now()}`,
      title: newIssue.title,
      assignee: newIssue.assignee || 'Unassigned',
      dueDate: newIssue.dueDate || 'No Date',
      status: 'open',
      source: 'manual',
      position: newIssue.position
    };
    setIssues(prev => ({
      ...prev,
      [elementId]: [...(prev[elementId] || []), issue]
    }));
    setNewIssue({ title: '', assignee: '', dueDate: '', position: undefined });
  };

  const handleResolveIssue = (elementId: string, issueId: string) => {
    setIssues(prev => ({
      ...prev,
      [elementId]: prev[elementId].map(issue => 
        issue.id === issueId ? { ...issue, status: issue.status === 'open' ? 'resolved' : 'open' } : issue
      )
    }));
  };

  const handleRemoveIssue = (elementId: string, issueId: string) => {
    setIssues(prev => ({
      ...prev,
      [elementId]: prev[elementId].filter(issue => issue.id !== issueId)
    }));
    if (selectedIssueId === issueId) {
      setSelectedIssueId(null);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach((file, i) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        const newPhoto: ProgressPhoto = {
          id: `photo-${Date.now()}-${i}`,
          url: base64Url,
          date: new Date().toISOString().split('T')[0],
          phase: 'Site Prep'
        };
        setProgressPhotos(prev => [newPhoto, ...prev]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (modelUrl) {
      URL.revokeObjectURL(modelUrl);
    }
    
    const url = URL.createObjectURL(file);
    setModelUrl(url);
    setModelLoadedAt(new Date().toISOString());
    e.target.value = '';
  };

  const handleModelClick = (position: [number, number, number]) => {
    if (!isPinningMode) return;
    if (isPinningMode === 'issue') {
      setNewIssue(prev => ({ ...prev, position }));
    } else {
      setProgressPhotos(prev => prev.map(p => p.id === isPinningMode ? { ...p, location: position } : p));
    }
    setIsPinningMode(null);
  };

  const handleTogglePhotoSelection = (id: string) => {
    setSelectedPhotoIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleBatchDeletePhotos = () => {
    setProgressPhotos(prev => prev.filter(p => !selectedPhotoIds.includes(p.id)));
    setSelectedPhotoIds([]);
  };

  const handleBatchTagPhase = (phase: string) => {
    setProgressPhotos(prev => prev.map(p => selectedPhotoIds.includes(p.id) ? { ...p, phase } : p));
    setSelectedPhotoIds([]);
    setBatchPhaseOpen(false);
  };


  const handleAddElement = () => {
    if (!newElement.id || !newElement.name) {
      setToast({ message: 'ID and Name are required.', type: 'error' });
      return;
    }
    const elementToAdd = {
      ...newElement,
      icon: Layers, // Default icon
      bimRecommendation: {
        ...newElement.bimRecommendation,
        icon: Box
      }
    } as PDRIElement;
    
    setElements(prev => [...prev, elementToAdd]);
    setScores(prev => ({ ...prev, [elementToAdd.id]: 3 }));
    setAttachments(prev => ({ ...prev, [elementToAdd.id]: [] }));
    setIsAddModalOpen(false);
    setNewElement({
      id: "",
      category: "Building Elements",
      name: "",
      description: "",
      riskIfPoor: "",
      bimRecommendation: {
        use: "",
        description: "",
        icon: Box
      }
    });
    setActiveElementId(elementToAdd.id);
  };

  const chartData = useMemo(() => {
    return elements.map(el => ({
      subject: el.id,
      score: scores[el.id] || 0,
      fullMark: 5,
    }));
  }, [scores, elements]);

  const totalRiskScore = useMemo(() => {
    return Object.values(scores).reduce((a: number, b: DefinitionLevel) => a + b, 0);
  }, [scores]);

  const activeElement = elements.find(e => e.id === activeElementId);

  const filteredAttachments = useMemo(() => {
    if (!activeElement) return [];
    const files = attachments[activeElement.id] || [];
    return files.filter(file => {
      const matchesSearch = file.toLowerCase().includes(searchQuery.toLowerCase());
      const ext = file.split('.').pop()?.toLowerCase() || "";
      const matchesFilter = filterType === "all" || 
        (filterType === "pdf" && ext === "pdf") ||
        (filterType === "dwg" && ext === "dwg") ||
        (filterType === "other" && ext !== "pdf" && ext !== "dwg");
      return matchesSearch && matchesFilter;
    });
  }, [activeElement, attachments, searchQuery, filterType]);

  const filteredAndSortedPhotos = useMemo(() => {
    let result = [...progressPhotos];
    
    if (photoPhaseFilter !== 'all') {
      result = result.filter(p => p.phase === photoPhaseFilter);
    }
    
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return photoSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [progressPhotos, photoPhaseFilter, photoSortOrder]);

  const maxRiskScore = elements.length * 5;
  const riskPercentage = Math.round((totalRiskScore / maxRiskScore) * 100);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col" style={{ fontFamily: "var(--font-sans, 'Helvetica Neue', Arial, sans-serif)" }}>
      {/* Header */}
      <header className="border-b border-white/10 flex flex-col md:flex-row md:items-end justify-between gap-6 px-10 py-10 lg:px-[60px] lg:py-[40px]">
        <div className="project-meta">
          <div className="flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-left-4 duration-500">
            <h1 className="text-4xl font-normal tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)", letterSpacing: "-0.5px" }}>DBS Project Manager</h1>
          </div>
          
          {/* Project Identity (synced with Dashboard) */}
          <div className="flex items-center gap-6 mt-4 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
            <div className="flex-1 max-w-xs">
              <label className="block text-[10px] uppercase tracking-[2px] text-text-muted font-bold mb-1">Project Name</label>
              <input
                type="text"
                value={currentProject?.name ?? ''}
                onChange={(e) => {
                  const name = e.target.value;
                  setCurrentProject({
                    ...(currentProject ?? { id: `prj-${Date.now()}`, projectNumber: '', createdAt: new Date().toISOString() }),
                    name,
                  });
                }}
                placeholder="Enter project name..."
                className="w-full bg-transparent border-b border-white/20 text-white text-sm py-1.5 placeholder:text-white/30 focus:outline-none focus:border-accent-gold transition-colors"
              />
            </div>
            <div className="w-40">
              <label className="block text-[10px] uppercase tracking-[2px] text-text-muted font-bold mb-1">Project No.</label>
              <input
                type="text"
                value={currentProject?.projectNumber ?? ''}
                onChange={(e) => {
                  const projectNumber = e.target.value;
                  setCurrentProject({
                    ...(currentProject ?? { id: `prj-${Date.now()}`, name: '', createdAt: new Date().toISOString() }),
                    projectNumber,
                  });
                }}
                placeholder="PRJ-2026-001"
                className="w-full bg-transparent border-b border-white/20 text-white text-sm py-1.5 placeholder:text-white/30 focus:outline-none focus:border-accent-gold transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-4 md:mb-0 lg:ml-auto">
          <button 
            onClick={handleSaveProject}
            className="flex items-center gap-2 border border-white/20 bg-black/50 text-text-muted text-[10px] uppercase tracking-widest px-4 py-2 hover:border-accent-gold hover:text-accent-gold transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> Save Project
          </button>
          <button 
            onClick={handleImportProject}
            className="flex items-center gap-2 border border-white/20 bg-black/50 text-text-muted text-[10px] uppercase tracking-widest px-4 py-2 hover:border-accent-gold hover:text-accent-gold transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Load Project
          </button>
        </div>

        <div className="text-right">
          <div className="text-[11px] tracking-[2px] text-text-muted uppercase mb-1">ICH-EF AUDIT</div>
          <div className="text-xl" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Module 1.0</div>
        </div>
      </header>

      <main className="flex-1 bg-white/10 overflow-y-auto overflow-x-hidden relative">
        
        {/* Left: Element List (Audit) */}
        <section className="bg-bg-primary p-10 lg:p-[40px_60px] relative max-w-7xl mx-auto">
          {/* Toast notification */}
          {toast && (
            <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-xl border shadow-xl backdrop-blur-md text-sm font-medium animate-[slideUp_0.3s_ease-out] ${
              toast.type === 'success' ? 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald' :
              toast.type === 'error' ? 'border-red-400/40 bg-red-400/10 text-red-400' :
              'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
            }`}
              onClick={() => setToast(null)}
            >
              {toast.message}
            </div>
          )}
          {/* Clash Detection Visualizer at top */}
          <div className="mb-10 border border-white/10 rounded overflow-hidden">
            <div className="bg-bg-surface p-4 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-5 h-5 text-accent-gold" />
                <span className="text-[12px] font-bold uppercase tracking-[1px] text-white">Interactive Model View</span>
              </div>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer bg-black/50 px-3 py-1.5 border border-white/10 hover:bg-white/5 transition-colors">
                  <input type="checkbox" className="hidden" checked={showPhotoPins} onChange={(e) => setShowPhotoPins(e.target.checked)} />
                  <MapPin className={cn("w-3 h-3", showPhotoPins ? "text-accent-gold" : "text-text-muted")} />
                  <span className={cn("text-[10px] uppercase tracking-widest font-bold", showPhotoPins ? "text-accent-gold" : "text-text-muted")}>Photo Pins</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-accent-gold/10 px-3 py-1.5 border border-accent-gold/30 hover:bg-accent-gold/20 transition-colors">
                  <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleModelUpload} />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-accent-gold">Load .GLB Model</span>
                </label>
                <div className="flex gap-2">
                  <span className="bg-black/50 text-[10px] uppercase tracking-widest px-3 py-1.5 border border-white/10 text-red-400">
                    {(issues[activeElementId || ""] || []).filter(i => i.status !== 'resolved').length} Conflicts
                  </span>
                  <span className="bg-black/50 text-[10px] uppercase tracking-widest px-3 py-1.5 border border-white/10 text-emerald-400">Model Synced</span>
                </div>
              </div>
            </div>
            <div className="bg-black relative overflow-hidden h-[300px] lg:h-[400px]">
              {/* 3D BIM Viewer */}
              <div className="absolute inset-0">
                {isPinningMode && (
                  <div className="absolute top-4 left-4 z-10 bg-accent-gold text-black px-4 py-2 font-bold text-xs uppercase tracking-widest flex items-center gap-2 pointer-events-none animate-pulse">
                    <Crosshair className="w-4 h-4" /> Click model to place pin
                  </div>
                )}
                <BimViewer 
                  issues={issues[activeElementId || ""] || []} 
                  onSelectIssue={setSelectedIssueId} 
                  selectedIssueId={selectedIssueId} 
                  photoPins={progressPhotos.filter(p => p.location).map(p => ({ id: p.id, position: p.location! }))}
                  onPhotoPinClick={(id) => setViewingPhotoId(id)}
                  isPinningMode={!!isPinningMode}
                  onModelClick={handleModelClick}
                  showPhotoPins={showPhotoPins}
                  modelUrl={modelUrl}
                  pendingPinPosition={newIssue.position}
                  bcfImportStatus={bcfImportStatus}
                />
              </div>
            </div>
          </div>
          
          {/* Gantt Chart / Project Schedule */}
          <GanttChart tasks={tasks} setTasks={setTasks} />

          {/* AUDIT FRAMEWORK MOVED HERE */}
          <div 
            className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4 cursor-pointer hover:bg-white/5 transition-colors p-2 -mx-2 rounded"
            onClick={() => setIsAuditExpanded(!isAuditExpanded)}
          >
            <div className="flex items-start gap-4">
              <div className="text-accent-gold mt-1.5">
                {isAuditExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-2xl italic text-accent-gold" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Audit Framework</h2>
                <p className="text-[14px] text-text-muted mt-2">Active priorities for risk mitigation in pre-construction.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-bg-surface border border-white/10 px-4 py-2 hidden md:flex items-center justify-center">
                <div className="text-xl font-serif text-accent-gold leading-none text-center">
                  {totalRiskScore} <span className="text-sm text-text-muted font-sans">/ {elements.length * 5}</span>
                  <span className="block text-[8px] text-text-muted uppercase tracking-[1px] mt-1 font-sans">Risk Score</span>
                </div>
              </div>
              {isAuditExpanded && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsAddModalOpen(true); }}
                  className="bg-accent-gold text-black font-bold h-10 px-4 text-[11px] uppercase tracking-[1px] hover:bg-white transition-all shadow-lg shadow-accent-gold/10 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4 text-black" /> Add Element
                </button>
              )}
            </div>
          </div>
          
          {isAuditExpanded && (
            <div className="grid grid-cols-1 gap-4 mb-16">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={elements.map(e => e.id)}
                strategy={verticalListSortingStrategy}
              >
                {elements.map((el, idx) => (
  <SortablePDRIElement
    key={el.id}
    el={el}
    idx={idx}
    score={scores[el.id]}
    isActive={activeElementId === el.id}
    onSelect={setActiveElementId}
    onScoreChange={handleScoreChange}
  >
    {activeElementId === el.id && (
      <div className="space-y-10 mt-6 border-t border-white/10 pt-6 cursor-default fade-in" onClick={(e) => e.stopPropagation()}>
                  {/* Heading & Meta */}
                  <div className="border-b border-white/10 pb-6">
                    <div className="flex items-center gap-3 text-accent-gold mb-3">
                       {(() => {
                         const ActiveIcon = el.icon;
                         return <ActiveIcon className="w-5 h-5" />;
                       })()}
                       <span className="text-[10px] font-bold uppercase tracking-[2px]">{el.category}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{el.name}</h2>
                    <p className="text-[13px] text-text-muted leading-[1.7]">
                      {el.description}
                    </p>
                  </div>

                  {/* Risk Advisory */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted">Risk Advisory</h3>
                    <div className={cn(
                      "p-5 border bg-bg-primary relative overflow-hidden",
                      scores[el.id] >= 3 ? "border-red-500/20" : "border-accent-gold/20"
                    )}>
                      <div className="flex items-center gap-3 mb-2 relative z-10">
                        {scores[el.id] >= 3 ? (
                          <AlertTriangle className="text-red-500 w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="text-emerald-500 w-4 h-4" />
                        )}
                        <span className={cn(
                          "font-bold text-[11px] uppercase tracking-[1px]",
                          scores[el.id] >= 3 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {scores[el.id] >= 3 ? "Critical Gap Detected" : "Target Definition Met"}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-muted leading-[1.6] relative z-10 font-medium italic">
                        {el.riskIfPoor}
                      </p>
                    </div>
                  </div>

                  {/* BIM Recommendation */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted">Strategic BIM Mitigation</h3>
                    
                    <div className="p-5 border border-white/10 bg-bg-primary flex flex-col gap-4">
                      {/* Original Recommendation */}
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-accent-gold/10 rounded border border-accent-gold/20 shrink-0">
                          {(() => {
                            const BimIcon = el.bimRecommendation.icon;
                            return <BimIcon className="w-5 h-5 text-accent-gold" />;
                          })()}
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold text-white uppercase tracking-[0.5px] mb-1">
                            {el.bimRecommendation.use}
                          </h4>
                          <p className="text-[12px] text-text-muted leading-[1.6]">
                            {el.bimRecommendation.description}
                          </p>
                        </div>
                      </div>


                      {/* Issue Tracker */}
                      <div className="mt-2 text-white">
                        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                          <h5 className="text-[11px] font-bold uppercase tracking-[1px] text-text-muted">Active Issues ({issues[el.id]?.length || 0})</h5>
                          <div className="flex gap-2">
                            <button className="bg-black border border-white/20 text-text-muted text-[9px] uppercase tracking-widest px-2 py-1 hover:border-accent-gold hover:text-accent-gold flex gap-1 items-center" onClick={() => handleScanConflicts(el.id)}>
                              <Activity className="w-3 h-3" /> Scan BIM
                            </button>
                            <label className="cursor-pointer bg-black border border-white/20 text-text-muted text-[9px] uppercase tracking-widest px-2 py-1 hover:border-accent-gold hover:text-accent-gold flex gap-1 items-center">
                              <Download className="w-3 h-3" /> Import BCF
                              <input type="file" accept=".bcfxz,.zip" className="hidden" onChange={(e) => handleImportBCF(e, el.id)} />
                            </label>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          {(issues[el.id] || []).map(issue => (
                            <div 
                              key={issue.id} 
                              onClick={() => setSelectedIssueId(selectedIssueId === issue.id ? null : issue.id)}
                              className={cn(
                                "text-[12px] p-3 border grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-colors cursor-pointer",
                                selectedIssueId === issue.id ? "bg-accent-gold/10 border-accent-gold/50" :
                                issue.status === 'resolved' ? "bg-white/5 border-white/5 opacity-50" : "bg-bg-surface border-white/10 hover:border-white/30"
                              )}
                            >
                              <button onClick={(e) => { e.stopPropagation(); handleResolveIssue(el.id, issue.id); }}>
                                {issue.status === 'resolved' ? (
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-accent-gold hover:bg-accent-gold/20 transition-colors" />
                                )}
                              </button>
                              
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className={cn("truncate font-medium flex items-center gap-2", issue.status === 'resolved' && "line-through text-[#888]", selectedIssueId === issue.id && "text-accent-gold")}>
                                  {issue.title}
                                  {issue.source === 'scan' && <span title="Auto-scanned clash"><Activity className="w-3 h-3 text-red-500 shrink-0" /></span>}
                                  {issue.source === 'bcf' && <span title="Imported from BCF"><Download className="w-3 h-3 text-blue-400 shrink-0" /></span>}
                                  {issue.position && <span title="Pinned to model"><MapPin className="w-3 h-3 text-accent-gold shrink-0" /></span>}
                                </span>
                                <div className="flex items-center gap-3 text-[10px] text-[#666] tracking-[0.5px]">
                                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {issue.assignee}</span>
                                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{issue.dueDate}</span>
                                </div>
                              </div>
                              
                              <button onClick={(e) => { e.stopPropagation(); handleRemoveIssue(el.id, issue.id); }} className="text-[#555] hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          
                          {(!issues[el.id] || issues[el.id].length === 0) && (
                            <div className="text-[11px] text-[#555] italic p-3 border border-dashed border-white/10 text-center">
                              No issues logged for this element.
                            </div>
                          )}
                        </div>

                        {/* Add Issue Form */}
                        <div className="flex flex-col gap-2">
                          <input 
                            placeholder="Describe clash or missing spec..."
                            className="w-full bg-bg-surface border border-white/10 p-2.5 text-[12px] text-white focus:border-accent-gold outline-none transition-colors"
                            value={newIssue.title || ''}
                            onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
                              <input 
                                placeholder="Assignee"
                                className="w-full bg-bg-surface border border-white/10 p-2.5 pl-8 text-[12px] text-white focus:border-accent-gold outline-none transition-colors"
                                value={newIssue.assignee || ''}
                                onChange={(e) => setNewIssue({ ...newIssue, assignee: e.target.value })}
                              />
                            </div>
                            <div className="relative flex-1">
                              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
                              <input 
                                type="date"
                                className="w-full bg-bg-surface border border-white/10 p-2.5 pl-8 text-[12px] text-text-muted focus:text-white focus:border-accent-gold outline-none transition-colors appearance-none min-h-[36px]"
                                style={{ colorScheme: "dark" }}
                                value={newIssue.dueDate || ''}
                                onChange={(e) => setNewIssue({ ...newIssue, dueDate: e.target.value })}
                              />
                            </div>
                            <button
                              onClick={() => setIsPinningMode(isPinningMode === 'issue' ? null : 'issue')}
                              className={cn(
                                "border px-3 shrink-0 flex items-center justify-center transition-colors",
                                isPinningMode === 'issue' ? "bg-accent-gold text-black border-accent-gold" : "bg-black text-text-muted border-white/20 hover:border-accent-gold hover:text-white"
                              )}
                              title="Pin issue to model"
                            >
                              <MapPin className={cn("w-4 h-4", newIssue.position && isPinningMode !== 'issue' ? "text-accent-gold" : "")} />
                            </button>
                            <button 
                              onClick={() => handleAddIssue(el.id)}
                              className="bg-accent-gold text-black px-4 flex items-center justify-center hover:bg-white transition-colors"
                            >
                              <Plus className="w-4 h-4 font-bold" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Documentation with Search & Filter */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted">Documentation</h3>
                      <label className="cursor-pointer">
                        <span className="text-[10px] text-accent-gold hover:text-white transition-colors flex items-center gap-1 font-bold uppercase tracking-[1px]">
                          <Upload className="w-3 h-3" />
                          Add Drawing
                        </span>
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files) {
                              Array.from(e.target.files).forEach((file) => simulateUpload(el.id, file as File));
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <div className="space-y-3">
                      {/* Search & Filter UI */}
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
                          <input 
                            type="text" 
                            placeholder="Find drawing..."
                            className="w-full bg-bg-primary border border-white/10 text-[12px] py-2 pl-9 pr-4 text-white focus:outline-none focus:border-accent-gold/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          {['all', 'pdf', 'dwg', 'other'].map(type => (
                            <button
                              key={type}
                              onClick={() => setFilterType(type)}
                              className={cn(
                                "flex-1 py-1 text-[9px] uppercase font-bold tracking-[1px] border transition-all",
                                filterType === type 
                                  ? "bg-accent-gold border-accent-gold text-black" 
                                  : "bg-bg-primary border-white/10 text-text-muted hover:border-white/20"
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* File List */}
                      <div className="space-y-1.5 min-h-[100px]">
                        {filteredAttachments.length > 0 ? (
                          filteredAttachments.map((file, idx) => (
                            <div key={idx} className="group bg-bg-primary border border-white/5 p-3 flex items-center justify-between hover:border-accent-gold/30 transition-all">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className={cn(
                                  "w-4 h-4 shrink-0",
                                  file.endsWith('.pdf') ? "text-red-400" : file.endsWith('.dwg') ? "text-blue-400" : "text-accent-gold"
                                )} />
                                <div className="flex flex-col">
                                  <span className="text-[12px] text-text-primary truncate font-medium">{file}</span>
                                  <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                                    {file.split('.').pop()?.toUpperCase()} Document
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                <button 
                                  onClick={() => simulateDownload(file)} 
                                  className="p-1.5 text-text-muted hover:text-accent-gold transition-colors"
                                  title="Open Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => removeAttachment(el.id, file)} 
                                  className="p-1.5 text-text-muted hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center py-8 text-[#444] border border-white/5 border-dashed">
                             <Filter className="w-6 h-6 mb-2 opacity-20" />
                             <p className="text-[10px] uppercase tracking-[1px]">No documents match filter</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted">Strategic Alignment Notes</h3>
                    <textarea 
                      className="w-full bg-bg-primary border border-white/10 text-[13px] text-text-primary p-4 focus:outline-none focus:border-accent-gold transition-colors resize-none h-32 leading-[1.6]"
                      placeholder="Enter field notes, site constraints, or design logic supporting this element score..."
                      value={notes[el.id] || ''}
                      onChange={(e) => handleNoteChange(el.id, e.target.value)}
                    />
                  </div>

                   <button onClick={() => handleScoreChange(el.id, 1 as DefinitionLevel)} className="w-full bg-accent-gold hover:bg-[#C09B2E] text-black font-bold py-4 transition-all flex items-center justify-center gap-2 text-[11px] uppercase tracking-[2px] shadow-lg shadow-accent-gold/10">
                    <Settings2 className="w-4 h-4" />
                    Finalize BIM Implementation Plan
                  </button>
      </div>
    )}
  </SortablePDRIElement>
))}
              </SortableContext>
            </DndContext>
          </div>
          )}

  <SubcontractorCompliance 
            subcontractors={subcontractors}
            setSubcontractors={setSubcontractors}
            tasks={tasks}
            modelLoadedAt={modelLoadedAt}
            onToast={(message, type) => setToast({ message, type })}
          />

          {/* Budget & Allowances */}
                    <BudgetModule 
            baseContractPrice={baseContractPrice}
            setBaseContractPrice={setBaseContractPrice}
            budgetItems={budgetItems}
            setBudgetItems={setBudgetItems}
            changeOrders={changeOrders}
            setChangeOrders={setChangeOrders}
            tasks={tasks}
            setTasks={setTasks}
            designerEstimates={designConfig?.materialEstimate ?? null}
          />

          {/* Daily Progress & Spatial Logs */}
          <div className="mt-16">
            <div 
              className="mb-8 border-b border-white/10 pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 cursor-pointer hover:bg-white/5 transition-colors p-2 -mx-2 rounded"
              onClick={() => setIsLogsExpanded(!isLogsExpanded)}
            >
              <div className="flex items-start gap-4">
                <div className="text-accent-gold mt-1.5">
                  {isLogsExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </div>
                <div>
                  <h2 className="text-2xl italic text-accent-gold" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Daily Progress &amp; Spatial Logs</h2>
                  <p className="text-[14px] text-text-muted mt-2">Upload site progress photos and pin them to structural coordinates.</p>
                </div>
              </div>
              
              {isLogsExpanded && (
                <label 
                  className="cursor-pointer bg-accent-gold text-black font-bold h-10 px-4 text-[11px] uppercase tracking-[1px] hover:bg-white transition-all shadow-lg shadow-accent-gold/10 flex items-center justify-center gap-2 w-max"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Camera className="w-4 h-4 text-black" /> Upload Photos
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              )}
            </div>
            
            {isLogsExpanded && (
              <div className="flex flex-col gap-8">

            {/* Daily Logs Section */}
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-bg-surface border border-white/10 p-6">
                <h3 className="text-accent-gold font-bold uppercase tracking-widest text-[12px] mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Add Daily Note
                </h3>
                <textarea 
                  className="w-full bg-black border border-white/10 text-white text-sm p-3 placeholder:text-white/30 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all min-h-[120px] custom-scrollbar resize-none mb-4"
                  placeholder="What happened on site today? (e.g. Completed framing on 2nd floor, weather impacts...)"
                  ref={dailyLogRef}
                ></textarea>
                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      if (!dailyLogRef.current || !dailyLogRef.current.value.trim()) return;
                      const newLog: DailyLogEntry = {
                        id: `log-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        content: dailyLogRef.current.value.trim()
                      };
                      setDailyLogs(prev => [newLog, ...prev]);
                      dailyLogRef.current.value = '';
                    }}
                    className="bg-black border border-accent-gold text-accent-gold font-bold px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-accent-gold hover:text-black transition-colors"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              <div className="bg-bg-surface border border-white/10 p-6 flex flex-col max-h-[250px]">
                <h3 className="text-text-muted font-bold uppercase tracking-widest text-[12px] mb-4">Recent Notes</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                  {dailyLogs.length === 0 ? (
                    <p className="text-white/30 text-xs italic">No notes created yet.</p>
                  ) : (
                    dailyLogs.map(log => (
                      <div key={log.id} className="border-b border-white/5 pb-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{log.date}</span>
                          <button 
                            className="text-red-500/50 hover:text-red-500 transition-colors"
                            onClick={() => setDailyLogs(prev => prev.filter(l => l.id !== log.id))}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-white text-sm font-serif whitespace-pre-wrap">{log.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div className="mb-8">
              <label 
                className="w-full h-32 border-2 border-dashed border-white/20 hover:border-accent-gold hover:bg-accent-gold/5 transition-colors flex flex-col items-center justify-center cursor-pointer bg-bg-surface"
              >
                <Upload className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-sm font-bold text-text-primary uppercase tracking-widest">Drag &amp; Drop Photos Here</span>
                <span className="text-xs text-text-muted mt-1">Supports standard and 360° panoramic images</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>

            {/* Chronological Gallery */}
            {progressPhotos.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-4 bg-bg-surface p-3 border border-white/10">
                  <div className="text-[12px] font-bold text-white uppercase tracking-widest">
                    Gallery Filters
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={photoPhaseFilter}
                      onChange={(e) => setPhotoPhaseFilter(e.target.value)}
                      className="bg-black border border-white/20 text-text-muted text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 hover:border-accent-gold focus:outline-none focus:border-accent-gold transition-colors cursor-pointer"
                    >
                      <option value="all">All Phases</option>
                      <option value="Site Prep">Site Prep</option>
                      <option value="Foundation">Foundation</option>
                      <option value="Framing">Framing</option>
                      <option value="MEP Rough-In">MEP Rough-In</option>
                      <option value="Finishes">Finishes</option>
                    </select>
                    <select
                      value={photoSortOrder}
                      onChange={(e) => setPhotoSortOrder(e.target.value as 'newest' | 'oldest')}
                      className="bg-black border border-white/20 text-text-muted text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 hover:border-accent-gold focus:outline-none focus:border-accent-gold transition-colors cursor-pointer"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                </div>

                {selectedPhotoIds.length > 0 && (
                  <div className="mb-4 p-4 bg-bg-surface border border-white/20 shadow-lg flex items-center justify-between">
                    <div className="text-[12px] font-bold text-white tracking-widest uppercase">
                      {selectedPhotoIds.length} Photo{selectedPhotoIds.length > 1 ? 's' : ''} Selected
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="relative">
                        <button 
                          onClick={() => setBatchPhaseOpen(!batchPhaseOpen)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border border-white/10"
                        >
                          Tag Phase <ChevronDown className="w-3 h-3" />
                        </button>
                        {batchPhaseOpen && (
                          <div className="absolute top-full right-0 mt-2 bg-bg-surface border border-white/10 shadow-xl z-20 w-48">
                            {['Site Prep', 'Foundation', 'Framing', 'MEP Rough-In', 'Finishes'].map(phase => (
                              <button 
                                key={phase}
                                onClick={() => handleBatchTagPhase(phase)}
                                className="w-full text-left px-4 py-2 text-[11px] text-text-muted hover:bg-white/10 hover:text-white uppercase tracking-widest transition-colors"
                              >
                                {phase}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={handleBatchDeletePhotos}
                        className="px-4 py-2 bg-red-500/20 text-red-500 hover:bg-red-500/30 text-[11px] font-bold uppercase tracking-widest transition-colors border border-red-500/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                  {filteredAndSortedPhotos.map(photo => (
                    <div key={photo.id} className={cn("min-w-[280px] bg-bg-surface border shrink-0 snap-start group relative transition-colors", selectedPhotoIds.includes(photo.id) ? "border-accent-gold" : "border-white/10 hover:border-white/20")}>
                      <div className="h-[200px] bg-black relative overflow-hidden">
                        <div className="absolute top-3 right-3 z-10 flex gap-2 items-center">
                          <button
                            onClick={() => setViewingPhotoId(photo.id)}
                            className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <input
                            type="checkbox"
                            checked={selectedPhotoIds.includes(photo.id)}
                            onChange={() => handleTogglePhotoSelection(photo.id)}
                            className="w-4 h-4 cursor-pointer accent-accent-gold"
                          />
                        </div>
                        <img src={photo.url} alt="Progress" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-500" />
                        {photo.location && (
                          <div className="absolute top-3 left-3 bg-accent-gold text-black px-2 py-1 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 shadow-lg pointer-events-none">
                            <MapPin className="w-3 h-3" /> Pinned
                          </div>
                        )}
                        {photo.note && (
                          <div className="absolute bottom-3 right-3 bg-black/60 p-1.5 rounded pointer-events-none">
                            <FileText className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{photo.date}</span>
                        <span className="text-[9px] bg-white/10 px-2 py-0.5 text-white/70 rounded">{photo.phase}</span>
                      </div>
                      <button 
                        onClick={() => setIsPinningMode(isPinningMode === photo.id ? null : photo.id)}
                        className={cn(
                          "w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border",
                          isPinningMode === photo.id ? "bg-accent-gold text-black border-accent-gold" : 
                          photo.location ? "bg-bg-primary text-text-muted border-white/10 hover:text-white" : "bg-bg-primary text-accent-gold border-accent-gold/30 hover:border-accent-gold hover:bg-accent-gold/10"
                        )}
                      >
                        {isPinningMode === photo.id ? (
                          <>Cancel Pinning</>
                        ) : photo.location ? (
                          <><MapPin className="w-3 h-3" /> Repin to Model</>
                        ) : (
                          <><MapPin className="w-3 h-3" /> Pin to Model</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
            </div>
            )}
          </div>

          {/* Photo Viewer Modal */}
          <AnimatePresence>
            {viewingPhotoId && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
                onClick={() => setViewingPhotoId(null)}
              >
                <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => setViewingPhotoId(null)}
                    className="absolute -top-12 right-0 text-white hover:text-accent-gold transition-colors"
                  >
                    <X className="w-8 h-8" />
                  </button>
                  <img 
                    src={progressPhotos.find(p => p.id === viewingPhotoId)?.url} 
                    alt="Pinned photo" 
                    className="w-full h-auto max-h-[85vh] object-contain border border-white/20 shadow-2xl" 
                  />
                  <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 bg-black/80 border border-white/20 p-4 flex flex-col gap-3">
                     <div>
                       <div className="text-accent-gold font-bold uppercase tracking-widest text-xs mb-1">
                         {progressPhotos.find(p => p.id === viewingPhotoId)?.phase}
                       </div>
                       <div className="text-white/70 text-sm font-serif">
                         Taken {progressPhotos.find(p => p.id === viewingPhotoId)?.date}
                       </div>
                     </div>
                     <textarea
                       className="w-full bg-black/50 border border-white/10 text-white text-sm p-3 placeholder:text-white/30 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all min-h-[80px] custom-scrollbar resize-none"
                       placeholder="Add a photo note..."
                       value={progressPhotos.find(p => p.id === viewingPhotoId)?.note || ''}
                       onChange={(e) => {
                         setProgressPhotos(prev => prev.map(p => 
                           p.id === viewingPhotoId ? { ...p, note: e.target.value } : p
                         ));
                       }}
                     />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Element Modal Overlay */}
          <AnimatePresence>
            {isAddModalOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-bg-surface border border-white/10 w-full max-w-2xl overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-bg-primary">
                    <h2 className="text-xl italic text-accent-gold" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>Add PDRI Element</h2>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-text-muted hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-8 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted mb-4">Core Identification</h3>
                      <div>
                        <label className="text-[11px] uppercase tracking-[1px] text-[#555] font-bold block mb-2">Element ID (e.g., F12)</label>
                        <input 
                          className="w-full bg-bg-primary border border-white/10 p-3 text-[13px] text-white focus:border-accent-gold outline-none transition-colors"
                          value={newElement.id}
                          onChange={e => setNewElement(prev => ({ ...prev, id: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-[1px] text-[#555] font-bold block mb-2">Element Name</label>
                        <input 
                          className="w-full bg-bg-primary border border-white/10 p-3 text-[13px] text-white focus:border-accent-gold outline-none transition-colors"
                          value={newElement.name}
                          onChange={e => setNewElement(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-[1px] text-[#555] font-bold block mb-2">Category</label>
                        <select 
                          className="w-full bg-bg-primary border border-white/10 p-3 text-[13px] text-white focus:border-accent-gold outline-none transition-colors appearance-none"
                          value={newElement.category}
                          onChange={e => setNewElement(prev => ({ ...prev, category: e.target.value }))}
                        >
                          <option>Building Elements</option>
                          <option>Site Information</option>
                          <option>Equipment</option>
                          <option>Project Requirements</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-[1px] text-[#555] font-bold block mb-2">Description</label>
                        <textarea 
                          className="w-full bg-bg-primary border border-white/10 p-3 text-[13px] text-white focus:border-accent-gold outline-none transition-colors resize-none h-24"
                          value={newElement.description}
                          onChange={e => setNewElement(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[2px] text-text-muted mb-4">Risk & BIM Mitigation</h3>
                      <div>
                        <label className="text-[11px] uppercase tracking-[1px] text-[#555] font-bold block mb-2">Potential Risk Insight</label>
                        <textarea 
                          className="w-full bg-bg-primary border border-white/10 p-3 text-[13px] text-white focus:border-accent-gold outline-none transition-colors resize-none h-16"
                          value={newElement.riskIfPoor}
                          onChange={e => setNewElement(prev => ({ ...prev, riskIfPoor: e.target.value }))}
                        />
                      </div>
                      <div className="p-4 bg-bg-primary border border-accent-gold/10">
                        <label className="text-[11px] uppercase tracking-[1px] text-accent-gold font-bold block mb-4">BIM Recommendation</label>
                        <div className="space-y-4">
                          <input 
                            placeholder="Target BIM Use (e.g., 3D Coordination)"
                            className="w-full bg-white/5 border border-white/10 p-2 text-[12px] text-white focus:border-accent-gold outline-none transition-colors"
                            value={newElement.bimRecommendation?.use}
                            onChange={e => setNewElement(prev => ({ 
                              ...prev, 
                              bimRecommendation: { ...prev.bimRecommendation!, use: e.target.value } 
                            }))}
                          />
                          <textarea 
                            placeholder="Benefit Description..."
                            className="w-full bg-white/5 border border-white/10 p-2 text-[12px] text-white focus:border-accent-gold outline-none transition-colors resize-none h-16"
                            value={newElement.bimRecommendation?.description}
                            onChange={e => setNewElement(prev => ({ 
                              ...prev, 
                              bimRecommendation: { ...prev.bimRecommendation!, description: e.target.value } 
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-white/10 bg-bg-primary flex justify-end gap-4">
                    <button 
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-6 py-2 text-[11px] uppercase tracking-[2px] text-text-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddElement}
                      className="bg-accent-gold text-black font-bold py-2 px-8 text-[11px] uppercase tracking-[2px] transition-all hover:bg-white"
                    >
                      Add To Framework
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Document Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewFile(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[80vh] bg-bg-surface border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-bg-primary">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm tracking-tight">{previewFile}</h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Document Integrity Verified</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewFile(null)}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content - Simulated PDF Page */}
              <div className="flex-1 overflow-auto p-10 bg-slate-100 flex justify-center">
                <div className="w-full max-w-[800px] bg-white shadow-lg p-12 min-h-[1000px] text-slate-800 font-serif">
                  {fileStorage[previewFile] ? (
                    <div className="w-full h-full min-h-[800px] flex flex-col justify-center items-center bg-slate-50 border-2 border-dashed border-slate-200">
                      {fileStorage[previewFile].type.startsWith('image/') ? (
                        <img src={previewImageUrl || ''} alt={previewFile} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-4 text-center p-8">
                          <FileText className="w-16 h-16 text-slate-400" />
                          <h3 className="text-xl font-bold text-slate-700">{previewFile}</h3>
                          <p className="text-slate-500 font-sans max-w-sm">
                            Document previews for non-image files are restricted by browser security in this environment.
                            <br/><br/>
                            Please use the <strong>Download Document</strong> button below to view this file.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : MOCK_FILE_CONTENTS[previewFile] ? (
                    <div className="animate-in fade-in duration-700">
                      <div className="flex justify-between border-b-2 border-slate-900 pb-4 mb-8">
                        <div>
                          <h2 className="text-2xl font-bold uppercase tracking-tight">{MOCK_FILE_CONTENTS[previewFile].title}</h2>
                          <p className="text-xs font-sans text-slate-500 mt-1">Project: Modern Residence - CS 01</p>
                        </div>
                        <div className="text-right font-sans">
                          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Confidential</p>
                          <p className="text-[10px] text-slate-400">ID: ICH-2026-DOC-{previewFile.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}</p>
                        </div>
                      </div>

                      {MOCK_FILE_CONTENTS[previewFile].data ? (
                        <div className="font-sans text-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                {Object.keys(MOCK_FILE_CONTENTS[previewFile].data[0]).map(key => (
                                  <th key={key} className="p-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">{key.replace('_', ' ')}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {MOCK_FILE_CONTENTS[previewFile].data.map((row: any, i: number) => (
                                <tr key={i} className="border-b border-slate-100 italic font-serif">
                                  {Object.values(row).map((val: any, j) => (
                                    <td key={j} className="p-3">{val}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-slate-50 p-6 border-l-4 border-blue-500 font-sans text-sm leading-relaxed">
                            {MOCK_FILE_CONTENTS[previewFile].content}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-8">
                            <div className="border border-slate-200 h-32 flex items-center justify-center bg-slate-50 relative overflow-hidden">
                              <Box className="w-16 h-16 text-slate-200" />
                              <span className="absolute bottom-2 text-[8px] uppercase tracking-widest text-slate-400">Figure 01: Plan View</span>
                            </div>
                            <div className="border border-slate-200 h-32 flex items-center justify-center bg-slate-50 relative overflow-hidden">
                              <Activity className="w-16 h-16 text-slate-200" />
                              <span className="absolute bottom-2 text-[8px] uppercase tracking-widest text-slate-400">Figure 02: Load Gradient</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-20 border-t border-slate-200 pt-4 flex justify-between items-center text-[10px] font-sans text-slate-400 grayscale">
                        <div className="flex gap-4 italic font-serif">
                           <span>Signature: __________________</span>
                           <span>Date: __________________</span>
                        </div>
                        <div className="font-bold tracking-tighter">PAGE 1 OF 1</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                      <FileCode className="w-16 h-16 mb-4 opacity-20" />
                      <p className="font-sans italic text-slate-500 text-sm tracking-tight text-center">
                        This document is a user-added placeholder.<br/>
                        Integrate a storage service to enable real previews for uploaded files.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-bg-primary">
                 <button 
                   onClick={() => setPreviewFile(null)}
                   className="px-6 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-[1px] hover:text-white transition-colors"
                 >
                   Close
                 </button>
                 <button 
                   className="px-6 py-2 text-[11px] font-bold bg-accent-gold text-black uppercase tracking-[1px] hover:bg-[#C09B2E] transition-colors"
                   onClick={() => {
                     const fileOrMock = fileStorage[previewFile];
                     if (fileOrMock) {
                       const url = URL.createObjectURL(fileOrMock);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = previewFile;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                       URL.revokeObjectURL(url);
                     } else {
                       const content = MOCK_FILE_CONTENTS[previewFile] 
                         ? JSON.stringify(MOCK_FILE_CONTENTS[previewFile], null, 2) 
                         : `Placeholder content for placeholder file: ${previewFile}`;
                       const blob = new Blob([content], { type: 'text/plain' });
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = previewFile.endsWith('.pdf') ? previewFile.replace('.pdf', '.txt') : previewFile;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                       URL.revokeObjectURL(url);
                     }
                   }}
                 >
                   Confirm Download
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

