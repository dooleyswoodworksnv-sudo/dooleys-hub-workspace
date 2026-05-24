import { useEffect, useRef, useCallback } from 'react';
import App from './App';
import { useProject } from '@dooleys/core';
import type { TaskData, BudgetItemData, ChangeOrderData, SubcontractorData, ProgressPhotoData, DailyLogData } from '@dooleys/core';

/**
 * Bridge payload — the PM state subset pushed to ProjectContext.
 */
export interface PMBridgePayload {
  tasks: {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    status: 'completed' | 'on-track' | 'pending' | 'delayed';
    dependencies?: string[];
    drawPct?: number;
  }[];
  budgetItems: {
    id: string;
    name: string;
    budgeted: number;
    actual: number;
  }[];
  changeOrders: {
    id: string;
    description: string;
    amount: number;
    status: 'pending' | 'approved' | 'paid';
  }[];
  subcontractors: {
    id: string;
    name: string;
    trade: string;
    taskIdMatches: string[];
    coiStatus: 'valid' | 'expired' | 'missing';
    permitStatus: 'valid' | 'expired' | 'missing';
  }[];
  progressPhotos?: {
    id: string;
    url: string;
    date: string;
    phase: string;
    location?: [number, number, number];
    note?: string;
  }[];
  dailyLogs?: {
    id: string;
    date: string;
    content: string;
  }[];
}

/**
 * ProjectModule — Entry point for the Project Manager
 * within the Construction Hub monorepo.
 *
 * Wraps the full PM app and bridges its task schedule,
 * budget, and compliance data to the shared ProjectContext.
 */
export function ProjectModule() {
  const {
    setTasks,
    setBudgetItems,
    setChangeOrders,
    setSubcontractors,
    setProgressPhotos,
    setDailyLogs
  } = useProject();
  const lastHashRef = useRef<string>('');

  const handlePMChange = useCallback((payload: PMBridgePayload) => {
    // Avoid unnecessary bridge writes by comparing serialized payloads
    const hash = JSON.stringify(payload);
    if (hash === lastHashRef.current) return;
    lastHashRef.current = hash;

    setTasks(payload.tasks.map(t => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress,
      status: t.status,
      dependencies: t.dependencies,
      drawPct: t.drawPct,
    } as TaskData)));

    setBudgetItems(payload.budgetItems.map(b => ({
      id: b.id,
      name: b.name,
      budgeted: b.budgeted,
      actual: b.actual,
    } as BudgetItemData)));

    setChangeOrders(payload.changeOrders.map(co => ({
      id: co.id,
      description: co.description,
      amount: co.amount,
      status: co.status,
    } as ChangeOrderData)));

    setSubcontractors(payload.subcontractors.map(s => ({
      id: s.id,
      name: s.name,
      trade: s.trade,
      taskIdMatches: s.taskIdMatches,
      coiStatus: s.coiStatus,
      permitStatus: s.permitStatus,
    } as SubcontractorData)));

    if (payload.progressPhotos) {
      setProgressPhotos(payload.progressPhotos.map(p => ({
        id: p.id,
        url: p.url,
        date: p.date,
        phase: p.phase,
        location: p.location,
        note: p.note,
      } as ProgressPhotoData)));
    }

    if (payload.dailyLogs) {
      setDailyLogs(payload.dailyLogs.map(l => ({
        id: l.id,
        date: l.date,
        content: l.content,
      } as DailyLogData)));
    }
  }, [setTasks, setBudgetItems, setChangeOrders, setSubcontractors, setProgressPhotos, setDailyLogs]);

  return <App onPMChange={handlePMChange} />;
}

export default ProjectModule;
