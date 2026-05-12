import { useEffect, useRef } from 'react';
import App from './App';
import { useProject } from '@dooleys/core';
import type { TaskData, BudgetItemData, ChangeOrderData, SubcontractorData } from '@dooleys/core';

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
}

/**
 * ProjectModule — Entry point for the Project Manager
 * within the Construction Hub monorepo.
 *
 * Wraps the full PM app and bridges its task schedule,
 * budget, and compliance data to the shared ProjectContext.
 */
export function ProjectModule() {
  const { setTasks, setBudgetItems, setChangeOrders, setSubcontractors } = useProject();
  const lastHashRef = useRef<string>('');

  const handlePMChange = (payload: PMBridgePayload) => {
    // Avoid unnecessary bridge writes
    const hash = `${payload.tasks.length}-${payload.budgetItems.length}-${payload.changeOrders.length}-${payload.subcontractors.length}`;
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
  };

  return <App onPMChange={handlePMChange} />;
}

export default ProjectModule;
