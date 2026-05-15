import React, { useMemo, useState, useRef, useEffect } from 'react';
import { differenceInDays, addDays, format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { cn } from '@dooleys/ui';
import { Edit2, X, Check, Plus, Trash2, ClipboardCheck, AlertTriangle, ChevronDown, ChevronRight, FileText, Upload, Paperclip, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Safe wrapper around date-fns format — returns fallback string for Invalid Date
const safeFormat = (date: Date | null | undefined, fmt: string, fallback = '—') => {
  try {
    if (!date || isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
};



export const AVAILABLE_INSPECTIONS = [
  'Footings', 'Stemwalls & Retaining Walls', 'Slab on Grade', 'Hold Downs', 'Rebar', 'Grout', 'Lath',
  'Rough Framing', 'Underfloor Prior to Sheathing', 'Wallboard', 'Sheathing/Siding', 'Exterior Shearwall', 'Interior Shearwall', 'Roof Framing', 'Ice Dam',
  'Electrical', 'Temporary Power', 'Permanent Power', 'Underground Electrical', 'Electrical Underslab/Floor', 'Rough Electrical',
  'Plumbing', 'Underground Sewer', 'Underground Water', 'Plumbing Underslab/Floor', 'Shower Pan', 'Rough Plumbing',
  'Mechanical', 'Certificate of Occupancy', 'Energy Compliance', 'Final', 'Final Manometer Before CoFO', 'Heating',
  'High Pressure Gas', 'Insulation', 'Miscellaneous Final', 'Oil Tank', 'Rough Mechanical', 'Structural Observation',
  'Suspended Ceiling', 'Underground Gas',
  'TMFD Building Final', 'TMFD Defensible Space', 'Health Septic Building Final'
];

interface Document {
  id: string;
  name: string;
}

interface Inspection {
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  documents?: Document[];
}

export interface Task {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  status: 'completed' | 'on-track' | 'pending' | 'delayed';
  dependencies?: string[];
  inspections?: Inspection[];
  drawPct?: number;
}

export const INITIAL_TASKS: Task[] = [];

interface SortableTaskRowProps {
  task: Task;
  onClick: () => void;
}

function SortableTaskRow({ task, onClick }: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  const hasInspections = task.inspections && task.inspections.length > 0;
  const pendingInspections = task.inspections?.filter(i => i.status === 'pending').length || 0;
  const anyPending = pendingInspections > 0;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "h-16 border-b border-white/5 py-2 flex items-center shrink-0 group hover:bg-white/5 transition-colors cursor-pointer bg-bg-surface",
        isDragging && "opacity-50 ring-2 ring-accent-gold"
      )} 
      onClick={onClick}
    >
      <div 
        className="px-2 text-text-muted hover:text-white cursor-grab active:cursor-grabbing shrink-0"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex flex-col overflow-hidden pr-2 w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-bold text-text-primary truncate group-hover:text-accent-gold transition-colors">{task.name}</span>
          {hasInspections && (
            <div className="flex items-center" title={`${task.inspections?.length} permits/inspections (${pendingInspections} pending)`}>
              {anyPending ? (
                <AlertTriangle className="w-3 h-3 text-accent-gold" />
              ) : (
                <ClipboardCheck className="w-3 h-3 text-emerald-500" />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-text-muted uppercase tracking-[1px]">{safeFormat(task.start, 'MMM d')} - {safeFormat(task.end, 'MMM d')}</span>
          {hasInspections && anyPending && (
            <span className="text-[9px] text-accent-gold font-bold bg-accent-gold/10 px-1.5 py-0.5 rounded">{pendingInspections} action req.</span>
          )}
        </div>
      </div>
      <Edit2 className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 mr-4" />
    </div>
  );
}

interface DraggableGanttBarProps {
  task: Task;
  idx: number;
  timelineStart: Date;
  dayWidth: number;
  onUpdate: (taskId: string, newStart: Date, newEnd: Date) => void;
  onEdit: (task: Task) => void;
}

function DraggableGanttBar({ task, idx, timelineStart, dayWidth, onUpdate, onEdit }: DraggableGanttBarProps) {
  const [dragDeltaX, setDragDeltaX] = useState(0);
  const isDragging = useRef(false);
  const startXRef = useRef(0);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-emerald-500';
      case 'on-track': return 'bg-accent-gold';
      case 'delayed': return 'bg-red-500';
      default: return 'bg-white/20';
    }
  };

  const anyPendingInspections = task.inspections?.some(i => i.status === 'pending');
  const deltaDays = Math.round(dragDeltaX / dayWidth);

  const baseLeftOffset = differenceInDays(task.start, timelineStart) * dayWidth;
  const width = Math.max((differenceInDays(task.end, task.start) + 1) * dayWidth, 4);
  const leftOffset = baseLeftOffset + dragDeltaX;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDragging.current = true;
    startXRef.current = e.clientX;
    document.body.style.cursor = 'grabbing';

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      setDragDeltaX(ev.clientX - startXRef.current);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      
      const finalDeltaX = ev.clientX - startXRef.current;
      const finalDeltaDays = Math.round(finalDeltaX / dayWidth);
      
      if (finalDeltaDays !== 0) {
        onUpdate(task.id, addDays(task.start, finalDeltaDays), addDays(task.end, finalDeltaDays));
      }
      setDragDeltaX(0);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div 
      className="absolute h-16 flex items-center transition-all hover:brightness-110"
      style={{ 
        left: leftOffset, 
        width, 
        top: 40 + (idx * 64),
        zIndex: dragDeltaX !== 0 ? 30 : 10,
        cursor: dragDeltaX !== 0 ? 'grabbing' : 'grab'
      }}
      title={`${task.name}: ${task.progress}% complete`}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        // Prevent click if we were dragging
        if (Math.abs(dragDeltaX) > 5) return;
        onEdit(task);
      }}
    >
      <div className={cn("h-6 w-full rounded shadow-sm relative overflow-hidden", getStatusColor(task.status), anyPendingInspections && task.status !== 'completed' ? 'border-2 border-red-500/50 box-border' : '')}>
         <div className="absolute inset-y-0 left-0 bg-black/20 pointer-events-none" style={{ width: `${task.progress}%` }} />
      </div>
    </div>
  );
}

export interface GanttChartProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

export const GanttChart = ({ tasks, setTasks }: GanttChartProps) => {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Custom dropdown state
  const [isRequirementDropdownOpen, setIsRequirementDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [expandedInspectionIdx, setExpandedInspectionIdx] = useState<number | null>(null);
  const requirementDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close requirement dropdown
      if (requirementDropdownRef.current && !requirementDropdownRef.current.contains(event.target as Node)) {
        setIsRequirementDropdownOpen(false);
      }
      // Close status dropdown
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!editingTask) {
      setExpandedInspectionIdx(null);
      setIsRequirementDropdownOpen(false);
      setIsStatusDropdownOpen(false);
    }
  }, [editingTask]);

  const minDate = useMemo(() => {
    if (tasks.length === 0) return new Date();
    return new Date(Math.min(...tasks.map(t => t.start.getTime())));
  }, [tasks]);
  
  const maxDate = useMemo(() => {
    if (tasks.length === 0) return addDays(new Date(), 30);
    return new Date(Math.max(...tasks.map(t => t.end.getTime())));
  }, [tasks]);
  
  // Extend timeline a bit
  const timelineStart = startOfMonth(addDays(minDate, -14));
  const timelineEnd = endOfMonth(addDays(maxDate, 14));
  
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const dayWidth = 4; // px per day

  const taskCoords = useMemo(() => {
    return tasks.reduce((acc, task, idx) => {
      const leftOffset = differenceInDays(task.start, timelineStart) * dayWidth;
      const width = Math.max((differenceInDays(task.end, task.start) + 1) * dayWidth, 4);
      acc[task.id] = {
        x: leftOffset,
        y: 40 + (idx * 64) + 32, // center of the 64px row
        width
      };
      return acc;
    }, {} as Record<string, { x: number, y: number, width: number }>);
  }, [timelineStart, tasks]);

  // Generate months for header
  const months = useMemo(() => {
    let current = timelineStart;
    const result = [];
    while (current <= timelineEnd) {
      const monthEnd = endOfMonth(current);
      const daysInMonth = differenceInDays(monthEnd > timelineEnd ? timelineEnd : monthEnd, current) + 1;
      result.push({
        name: format(current, 'MMM yyyy'),
        days: daysInMonth
      });
      current = addDays(monthEnd, 1);
    }
    return result;
  }, [timelineStart, timelineEnd]);

  const handleSaveTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;
    
    setTasks(prev => {
      const exists = prev.find(t => t.id === editingTask.id);
      if (exists) {
        return prev.map(t => t.id === editingTask.id ? editingTask : t);
      }
      return [...prev, editingTask];
    });
    setEditingTask(null);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setEditingTask(null);
  };

  const handleAddTask = () => {
    const start = tasks.length > 0 ? new Date(tasks[tasks.length - 1].end) : new Date();
    const end = addDays(start, 14);
    setEditingTask({
      id: `t${Date.now()}`,
      name: 'New Task',
      start,
      end,
      progress: 0,
      status: 'pending',
      dependencies: []
    });
  };

  return (
    <div className="bg-bg-primary border border-white/10 rounded flex flex-col mb-10 w-full overflow-hidden relative">
      <div 
        className="bg-bg-surface p-4 border-b border-white/10 flex justify-between items-center z-10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="text-accent-gold">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <h3 className="text-[12px] font-bold uppercase tracking-[1px] text-white">Project Schedule</h3>
          {isExpanded && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleAddTask(); }}
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent-gold hover:text-white transition-colors ml-4"
            >
              <Plus className="w-3 h-3" /> Add Task
            </button>
          )}
        </div>
        <div className="flex gap-4 text-[10px] uppercase tracking-widest text-text-muted">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Completed</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-accent-gold" /> On Track</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> Delayed</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="flex flex-1 overflow-auto relative custom-scrollbar max-h-[400px]">
          {/* Left Column: Task List */}
        <div className="w-[300px] shrink-0 border-r border-white/10 bg-bg-surface sticky left-0 z-20 flex flex-col">
          <div className="h-10 border-b border-white/10 shrink-0 flex items-center px-4 font-bold text-[10px] text-text-muted uppercase tracking-widest">Tasks &amp; Permits</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(task => (
                <SortableTaskRow key={task.id} task={task} onClick={() => setEditingTask(task)} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Right Column: Timeline */}
        <div className="relative min-w-max pb-10 custom-scrollbar">
          {/* Months Header */}
          <div className="h-10 border-b border-white/10 flex bg-bg-surface sticky top-0 z-10">
            {months.map((m, i) => (
              <div 
                key={i} 
                className="shrink-0 flex items-center justify-center border-r border-white/5 text-[10px] uppercase tracking-widest text-text-muted"
                style={{ width: m.days * dayWidth }}
              >
                {m.name}
              </div>
            ))}
          </div>

          {/* Timeline Grid Background */}
          {tasks.map((task, idx) => (
            <div key={task.id} className="h-16 border-b border-white/5 flex relative">
               {/* Just lines for months - omitting daily lines to save DOM nodes */}
            </div>
          ))}
          
          <div className="absolute top-10 bottom-0 flex pointer-events-none">
            {months.map((m, i) => (
              <div key={i} className="shrink-0 border-r border-white/5" style={{ width: m.days * dayWidth }} />
            ))}
          </div>

          {/* Dependencies SVG */}
          <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: totalDays * dayWidth, height: '100%' }}>
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--color-accent-gold)" />
              </marker>
            </defs>
            {tasks.map(task => {
              if (!task.dependencies) return null;
              return task.dependencies.map(depId => {
                const depCoord = taskCoords[depId];
                const thisCoord = taskCoords[task.id];
                if (!depCoord || !thisCoord) return null;

                const startX = depCoord.x + depCoord.width;
                const startY = depCoord.y;
                const endX = thisCoord.x;
                const endY = thisCoord.y;

                // Step path logic
                const path = `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${endX} ${endY}`;

                return (
                  <path 
                    key={`${depId}-${task.id}`}
                    d={path}
                    fill="none"
                    stroke="var(--color-accent-gold)"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#arrowhead)"
                    opacity="0.6"
                  />
                )
              });
            })}
          </svg>

          {/* Gantt Bars */}
          {tasks.map((task, idx) => (
            <DraggableGanttBar 
              key={task.id} 
              task={task} 
              idx={idx} 
              timelineStart={timelineStart} 
              dayWidth={dayWidth} 
              onEdit={setEditingTask}
              onUpdate={(taskId, newStart, newEnd) => {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, start: newStart, end: newEnd } : t));
              }}
            />
          ))}
        </div>
      </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div 
          className="fixed inset-0 bg-black/80 z-[100] flex flex-col justify-center items-center p-4"
          onPointerDown={() => setEditingTask(null)}
        >
          <div 
            className="bg-bg-surface border border-white/10 w-full max-w-md shadow-2xl p-6"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-[1px]">Edit Task</h3>
              <button 
                type="button"
                onClick={() => setEditingTask(null)} 
                className="text-text-muted hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveTask} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px] mb-2">Task Name</label>
                <input 
                  type="text" 
                  value={editingTask.name}
                  onChange={e => setEditingTask({...editingTask, name: e.target.value})}
                  className="w-full bg-bg-primary border border-white/10 text-white p-2 text-sm focus:border-accent-gold outline-none transition-colors"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px] mb-2">Start Date</label>
                  <input 
                    type="date" 
                    value={safeFormat(editingTask.start, 'yyyy-MM-dd', '')}
                    onChange={e => {
                      if (!e.target.value) return;
                      const parsed = parseISO(e.target.value);
                      if (!isNaN(parsed.getTime())) setEditingTask({...editingTask, start: parsed});
                    }}
                    className="w-full bg-bg-primary border border-white/10 text-white p-2 text-sm focus:border-accent-gold outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px] mb-2">End Date</label>
                  <input 
                    type="date" 
                    value={safeFormat(editingTask.end, 'yyyy-MM-dd', '')}
                    onChange={e => {
                      if (!e.target.value) return;
                      const parsed = parseISO(e.target.value);
                      if (!isNaN(parsed.getTime())) setEditingTask({...editingTask, end: parsed});
                    }}
                    className="w-full bg-bg-primary border border-white/10 text-white p-2 text-sm focus:border-accent-gold outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px] mb-2">Progress (%)</label>
                  <input 
                    type="number" 
                    min="0" max="100"
                    value={editingTask.progress}
                    onChange={e => setEditingTask({...editingTask, progress: parseInt(e.target.value) || 0})}
                    className="w-full bg-bg-primary border border-white/10 text-white p-2 text-sm focus:border-accent-gold outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px] mb-2">Status</label>
                  <div className="relative" ref={statusDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                      className="w-full bg-bg-primary border border-white/10 text-white p-2 text-sm focus:border-accent-gold outline-none transition-colors flex justify-between items-center"
                    >
                      <span className="capitalize">{editingTask.status.replace('-', ' ')}</span>
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    </button>
                    {isStatusDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-white/10 shadow-xl z-50 py-1">
                        {['pending', 'on-track', 'completed', 'delayed'].map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 capitalize transition-colors"
                            onClick={() => {
                              setEditingTask({...editingTask, status: status as Task['status']});
                              setIsStatusDropdownOpen(false);
                            }}
                          >
                            {status.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Inspections / Permits Section */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[1px]">Permits &amp; Inspections</label>
                  <div className="flex relative" ref={requirementDropdownRef}>
                    <button
                      type="button"
                      className="bg-transparent text-[10px] font-bold text-accent-gold uppercase tracking-widest outline-none cursor-pointer flex items-center gap-1 hover:text-white transition-colors"
                      onClick={() => setIsRequirementDropdownOpen(!isRequirementDropdownOpen)}
                    >
                      ADD REQUIREMENT
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    
                    {isRequirementDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-bg-surface border border-white/10 shadow-2xl z-50 max-h-[200px] overflow-y-auto custom-scrollbar">
                        {AVAILABLE_INSPECTIONS.map(insp => {
                          const isAlreadyAdded = editingTask.inspections?.some(i => i.name === insp);
                          if (isAlreadyAdded) return null;
                          return (
                            <button
                              key={insp}
                              type="button"
                              className="w-full text-left px-3 py-2 text-[11px] text-white hover:bg-accent-gold hover:text-black transition-colors"
                              onClick={() => {
                                setEditingTask(prev => ({
                                  ...prev!,
                                  inspections: [...(prev!.inspections || []), { name: insp, status: 'pending' }]
                                }));
                                setIsRequirementDropdownOpen(false);
                              }}
                            >
                              {insp}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mt-2">
                  {!editingTask.inspections?.length && (
                    <div className="text-xs text-text-muted italic">No inspections required for this phase.</div>
                  )}
                  {editingTask.inspections?.map((insp, idx) => (
                    <div key={idx} className="bg-bg-primary border border-white/5 rounded-sm flex flex-col">
                      <div className="flex items-center justify-between p-2 px-3 group">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                          <button 
                            type="button"
                            onClick={() => {
                              const newInsp = [...(editingTask.inspections || [])];
                              const currStatus = newInsp[idx].status;
                              newInsp[idx].status = currStatus === 'pending' ? 'approved' : currStatus === 'approved' ? 'rejected' : 'pending';
                              setEditingTask({ ...editingTask, inspections: newInsp });
                            }}
                            className={cn(
                              "w-4 h-4 rounded-sm flex items-center justify-center border transition-colors shrink-0",
                              insp.status === 'approved' ? "bg-emerald-500 border-emerald-500 text-black" : 
                              insp.status === 'rejected' ? "bg-red-500 border-red-500 text-white" : 
                              "bg-transparent border-white/20 text-transparent"
                            )}
                          >
                            {insp.status === 'rejected' ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          </button>
                          
                          <button 
                            type="button" 
                            className="flex-1 flex items-center gap-2 text-left overflow-hidden min-w-0"
                            onClick={() => setExpandedInspectionIdx(expandedInspectionIdx === idx ? null : idx)}
                          >
                            <span className={cn(
                              "text-xs transition-colors truncate", 
                              insp.status === 'approved' ? 'text-white/50 line-through' : 
                              insp.status === 'rejected' ? 'text-red-400 font-medium' : 
                              'text-white font-medium'
                            )}>
                              {insp.name}
                            </span>
                            {(insp.notes || insp.documents?.length) ? (
                              <Paperclip className="w-3 h-3 text-text-muted shrink-0" />
                            ) : null}
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 pl-2">
                          <button 
                            type="button"
                            onClick={() => setExpandedInspectionIdx(expandedInspectionIdx === idx ? null : idx)}
                            className="text-text-muted hover:text-accent-gold transition-colors"
                          >
                            <ChevronDown className={cn("w-4 h-4 transition-transform", expandedInspectionIdx === idx ? "rotate-180" : "")} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              const newInsp = [...(editingTask.inspections || [])];
                              newInsp.splice(idx, 1);
                              setEditingTask({ ...editingTask, inspections: newInsp });
                              if (expandedInspectionIdx === idx) setExpandedInspectionIdx(null);
                            }}
                            className="text-text-muted hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Area */}
                      {expandedInspectionIdx === idx && (
                        <div className="p-3 pt-0 border-t border-white/5 mt-1 flex flex-col gap-4 relative bg-bg-primary">
                          <div className="flex flex-col gap-1.5 mt-2">
                            <label className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Status</label>
                            <select
                              value={insp.status}
                              onChange={(e) => {
                                const newInsp = [...(editingTask.inspections || [])];
                                newInsp[idx].status = e.target.value as Inspection['status'];
                                setEditingTask({ ...editingTask, inspections: newInsp });
                              }}
                              className="bg-bg-surface border border-white/10 rounded p-2 text-xs text-white outline-none focus:border-accent-gold w-full"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Notes / Details</label>
                            <textarea 
                              value={insp.notes || ''}
                              onChange={(e) => {
                                const newInsp = [...(editingTask.inspections || [])];
                                newInsp[idx].notes = e.target.value;
                                setEditingTask({ ...editingTask, inspections: newInsp });
                              }}
                              placeholder="Add specific inspection requirements or inspector contact info..."
                              className="bg-bg-surface border border-white/10 rounded p-2 text-xs text-white placeholder:text-white/20 min-h-[60px] outline-none focus:border-accent-gold resize-none w-full"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Files &amp; Documents</label>
                              <label className="text-[9px] text-accent-gold flex items-center gap-1 hover:text-white transition-colors uppercase font-bold cursor-pointer">
                                <Upload className="w-3 h-3" /> Add File
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const newInsp = [...(editingTask.inspections || [])];
                                      const docs = newInsp[idx].documents || [];
                                      newInsp[idx].documents = [...docs, { id: `doc-${Date.now()}`, name: file.name }];
                                      setEditingTask({ ...editingTask, inspections: newInsp });
                                    }
                                    e.target.value = ''; // reset input
                                  }} 
                                />
                              </label>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 mt-1">
                              {(!insp.documents || insp.documents.length === 0) ? (
                                <span className="text-[10px] text-white/30 italic">No files attached</span>
                              ) : (
                                insp.documents.map(doc => (
                                  <div key={doc.id} className="flex items-center justify-between text-xs bg-bg-surface border border-white/5 px-2 py-1.5 rounded-sm">
                                    <div className="flex items-center gap-2 truncate text-emerald-400">
                                      <FileText className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{doc.name}</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      className="text-text-muted hover:text-red-500 shrink-0"
                                      onClick={() => {
                                        const newInsp = [...(editingTask.inspections || [])];
                                        newInsp[idx].documents = newInsp[idx].documents!.filter(d => d.id !== doc.id);
                                        setEditingTask({ ...editingTask, inspections: newInsp });
                                      }}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button 
                  type="button"
                  onClick={() => handleDeleteTask(editingTask.id)}
                  className="px-4 py-2 bg-red-500/10 text-red-500 text-xs font-bold uppercase tracking-[1px] hover:bg-red-500/20 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2 bg-accent-gold text-black text-xs font-bold uppercase tracking-[1px] hover:bg-white transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
