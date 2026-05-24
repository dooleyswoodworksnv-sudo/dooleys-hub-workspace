// ─── Project ───
export interface Project {
  id: string;
  name: string;
  projectNumber: string;
  createdAt: string;
  budget?: number;
  area?: number;
  phase?: 'pre-design' | 'schematic-design' | 'design-development' | 'construction-documents' | 'construction' | 'closeout';
}

// ─── Blueprint Extraction (from feature-blueprints → gemini service) ───
export interface BoundingBox {
  xMin: number; // percentage 0-100
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface BlueprintItem {
  id: string;
  type: 'room' | 'dimension' | 'door_schedule' | 'window_schedule' | 'general_note' | 'other';
  label: string;
  description?: string;
  value?: string;
  page?: number;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface BlueprintExtraction {
  analysisSummary: string;
  sheetTitle?: string;
  sheetNumber?: string;
  pageMeta?: Record<number, { sheetTitle?: string; sheetNumber?: string }>;
  items: BlueprintItem[];
  /** Base64 data URLs of all loaded blueprint pages, for cross-module sharing */
  imageDataUrls?: string[];
  notations?: Notation[];
  guides?: Guide[];
  calibrationScale?: CalibrationData | null;
}

export interface Notation {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  page?: number;
  manualDimensions?: {
    length?: string;
    width?: string;
    height?: string;
  };
}

export interface Guide {
  id: string;
  type?: 'length' | 'area' | 'angle';
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  points?: { x: number; y: number }[];
  label: string;
  page?: number;
}

export interface CalibrationData {
  pixels: number;
  realWorld: number;
  unit: string;
}

// ─── Design Config (from feature-designer → Building Solutions) ───
export interface WallConfig {
  id: string;
  length: number;  // inches
  height: number;  // inches
  thickness: number;
  material?: string;
  position: { x: number; y: number; z: number };
  rotation?: number; // degrees
}

export interface RoofConfig {
  id: string;
  style: 'gable' | 'hip' | 'flat' | 'shed' | 'saltbox' | 'dutch' | 'mansard';
  pitch: number;
  overhang: number;
  fascia: number;
  material?: string;
}

export interface MaterialLineItem {
  category: string;  // 'Foundation' | 'Floor System' | 'Walls' | 'Roof' | 'Windows & Doors' | 'Surface Finishes'
  name: string;
  quantity: number;
  unit: string;      // 'ea' | 'sqft' | 'lf' | 'cy' | 'rolls' | 'sheets' | 'boxes' | 'tubes'
  unitCost: number;
  totalCost: number;
}

export interface MaterialEstimate {
  totalCost: number;
  lineItems: MaterialLineItem[];
  lastUpdated: string; // ISO timestamp
}

export interface DesignConfig {
  walls: WallConfig[];
  roofs: RoofConfig[];
  floorArea?: number;
  stories?: number;
  materialEstimate?: MaterialEstimate;
  designerState?: any;
}

// ─── Project Manager Data (from feature-projects) ───
export interface TaskData {
  id: string;
  name: string;
  start: string; // ISO date
  end: string;   // ISO date
  progress: number;
  status: 'completed' | 'on-track' | 'pending' | 'delayed';
  dependencies?: string[];
  drawPct?: number;
}

export interface BudgetItemData {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
}

export interface ChangeOrderData {
  id: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
}

export interface SubcontractorData {
  id: string;
  name: string;
  trade: string;
  taskIdMatches: string[];
  coiStatus: 'valid' | 'expired' | 'missing';
  permitStatus: 'valid' | 'expired' | 'missing';
}

export interface ProgressPhotoData {
  id: string;
  url: string;
  date: string;
  phase: string;
  location?: [number, number, number];
  note?: string;
}

export interface DailyLogData {
  id: string;
  date: string;
  content: string;
}
