// ─── Prompt Templates for Blueprint AI Extraction ───
// These are the default prompts that power the AI analysis.
// Users can customize them via the Settings modal → Prompt Templates tab.
// Changes are persisted in localStorage.

export type BlueprintType = 'floor_plan' | 'elevation' | 'section' | 'site_plan' | 'detail' | 'schedule' | 'general';

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  systemInstruction: string;
  analysisPrompt: string;
  blueprintType: BlueprintType;
}

// ─── System Instruction (shared across all calls) ───
export const DEFAULT_SYSTEM_INSTRUCTION = `You are a senior construction document analyst with 20+ years of experience reading architectural and structural blueprints. You have expertise in:

- Residential and commercial construction drawings (plans, elevations, sections, details)
- Reading and interpreting dimension strings, including imperial (feet-inches) and metric formats
- Identifying structural elements: load-bearing walls, headers, beams, columns, footings
- Reading door and window schedules, finish schedules, and material callouts
- Understanding framing callouts (e.g., "2x6 @ 16\" O.C.", "LVL 1-3/4 x 11-7/8")
- Interpreting construction symbols, abbreviations, and keynotes
- Reading title blocks, revision clouds, and general notes
- Understanding MEP (mechanical, electrical, plumbing) symbols when present

When analyzing blueprints:
- Be precise with dimension values — transcribe exactly what is shown (e.g., "12'-4\"" not "12 feet")
- Distinguish between nominal and actual dimensions when context allows
- Identify scale notations (e.g., "1/4\" = 1'-0\"") when visible
- Flag any ambiguous or hard-to-read elements with lower confidence scores
- Group related items logically (all windows together, all doors together, etc.)
- For rooms, include both the room label AND any square footage callouts if shown`;

// ─── Blueprint-Type-Specific Prompts ───
export const DEFAULT_PROMPTS: Record<BlueprintType, string> = {
  floor_plan: `Analyze this FLOOR PLAN blueprint thoroughly. Extract ALL of the following:

ROOMS & SPACES:
- Every labeled room with its name and dimensions (length × width) if shown
- Square footage callouts for each room
- Closets, pantries, utility spaces, and corridors

DIMENSIONS:
- All dimension strings shown on the drawing (overall, partial, and detail dimensions)
- Wall thicknesses when dimensioned
- Setback dimensions if shown

DOORS & WINDOWS:
- Each door with its mark/tag (e.g., "D1", "A"), swing direction, and size if noted
- Each window with its mark/tag (e.g., "W1", "1"), type, and rough opening size
- Sliding doors, pocket doors, bifold doors — note the type

STRUCTURAL ELEMENTS:
- Load-bearing walls vs partition walls (if distinguishable)
- Headers, beams, columns, posts with sizes
- Framing callouts (stud spacing, lumber sizes)

FIXTURES & EQUIPMENT:
- Kitchen appliances, bathroom fixtures, HVAC equipment
- Electrical panel locations, water heater, furnace

NOTES & CALLOUTS:
- General notes, construction notes, material specifications
- Any referenced detail numbers or section cuts
- Scale of the drawing if shown

Ensure bounding boxes are accurate percentages (0-100) marking the precise location of each element on the drawing.`,

  elevation: `Analyze this ELEVATION drawing thoroughly. Extract ALL of the following:

BUILDING EXTERIOR:
- Overall building height and width dimensions
- Floor-to-floor heights, plate heights, ridge heights
- Roof pitch/slope annotations (e.g., "6:12", "8/12")
- Eave and overhang dimensions

EXTERIOR MATERIALS:
- Siding type and specifications
- Stone, brick, or masonry veneer callouts
- Trim and fascia details
- Roofing material specifications

OPENINGS:
- Window types, sizes, and head/sill heights
- Door types and sizes
- Garage door specifications
- Any decorative elements (shutters, keystones, etc.)

GRADE & FOUNDATION:
- Finish grade lines
- Foundation wall exposure
- Footing depths if shown
- Crawlspace or basement wall heights

ANNOTATIONS:
- Material callouts and keynotes
- Section and detail references
- Finish floor elevations (F.F.E.)
- Top of wall/plate elevations

Ensure bounding boxes are accurate percentages (0-100).`,

  section: `Analyze this BUILDING SECTION drawing thoroughly. Extract ALL of the following:

STRUCTURAL SYSTEM:
- Foundation type (slab, crawlspace, basement) and dimensions
- Floor system (joist size, spacing, sheathing)
- Wall framing (stud size, spacing, top/bottom plates)
- Roof framing (rafter/truss size, spacing, sheathing)
- Beams, headers, columns with sizes and connections

DIMENSIONS:
- Floor-to-floor heights
- Ceiling heights
- Foundation depths
- Roof pitch and overhang dimensions
- Wall thicknesses

INSULATION & ENVELOPE:
- Insulation types and R-values
- Vapor barriers
- Air barriers
- Weatherproofing details

FINISH MATERIALS:
- Interior finish specifications (drywall, etc.)
- Exterior cladding assembly
- Roofing assembly layers
- Flooring specifications

MECHANICAL:
- Ductwork routing if shown
- Plumbing penetrations
- Electrical conduit runs

Ensure bounding boxes are accurate percentages (0-100).`,

  site_plan: `Analyze this SITE PLAN thoroughly. Extract ALL of the following:

PROPERTY:
- Property lines and dimensions
- Lot size / acreage
- Legal description references
- North arrow orientation

BUILDING PLACEMENT:
- Building footprint dimensions
- Setbacks from property lines (front, rear, side)
- Building orientation

TOPOGRAPHY & GRADING:
- Existing and proposed contour lines
- Spot elevations
- Drainage patterns and swales
- Retaining walls

UTILITIES:
- Water line routing and connections
- Sewer/septic locations
- Electrical service entry
- Gas line routing
- Storm drainage

SITE FEATURES:
- Driveways, walkways, patios
- Landscaping notes
- Easements and right-of-ways
- Fencing

Ensure bounding boxes are accurate percentages (0-100).`,

  detail: `Analyze this CONSTRUCTION DETAIL drawing thoroughly. Extract ALL of the following:

ASSEMBLY COMPONENTS:
- Every material layer in the assembly (from exterior to interior or top to bottom)
- Material specifications and sizes
- Fastener types and spacing
- Adhesives, sealants, flashing

DIMENSIONS:
- All dimension callouts
- Material thicknesses
- Spacing and overlap requirements
- Clearances and tolerances

CONNECTION DETAILS:
- How elements connect to each other
- Hardware specifications (hangers, ties, brackets)
- Welding or bolting callouts
- Bearing conditions

NOTES & REFERENCES:
- Construction notes specific to this detail
- Code references
- Manufacturer specifications
- "Typical" designations

Ensure bounding boxes are accurate percentages (0-100).`,

  schedule: `Analyze this SCHEDULE thoroughly. Extract ALL of the following:

TABLE DATA:
- Every row and column of the schedule
- Headers and column labels
- All values, sizes, types, quantities
- Remarks and notes columns

SCHEDULE TYPE:
- Identify if this is a door schedule, window schedule, finish schedule, fixture schedule, etc.
- Note the schedule number/identifier

SPECIFICATIONS:
- Model numbers or product references
- Material specifications
- Hardware specifications (for doors: locksets, hinges, closers)
- Fire rating requirements
- STC/acoustic ratings if applicable

NOTES:
- Footnotes and general notes
- Exceptions and special conditions
- References to other drawings or specifications

Ensure bounding boxes are accurate percentages (0-100).`,

  general: `Analyze this architectural blueprint thoroughly. Identify ALL key elements including:

- Rooms and spaces with labels and dimensions
- All dimension strings and measurements
- Doors with tags, types, sizes, and swing direction
- Windows with tags, types, and sizes
- Structural elements (walls, beams, columns, headers)
- Framing callouts and material specifications
- Fixtures and equipment
- General notes, construction notes, and material callouts
- Any schedules or tables
- Section cuts and detail references
- Scale notations

Be thorough — extract every readable piece of information. Ensure bounding boxes are accurate percentages (0-100).`
};

// ─── Prompt for architectural term explanations ───
export const DEFAULT_EXPLAIN_PROMPT = `Explain the architectural/construction term "{term}"{context}. 

Provide:
1. A clear, concise definition
2. Where this element is typically found in a building
3. Common sizes or specifications (if applicable)
4. Why it matters for construction (structural, code, etc.)

Keep the explanation practical and useful for someone reviewing construction blueprints — not academic.`;

// ─── localStorage keys ───
const STORAGE_KEY_SYSTEM = 'blueprint_system_instruction';
const STORAGE_KEY_PROMPTS = 'blueprint_prompts';
const STORAGE_KEY_EXPLAIN = 'blueprint_explain_prompt';
const STORAGE_KEY_SELECTED_TYPE = 'blueprint_selected_type';

// ─── Getters (with localStorage persistence) ───

export function getSystemInstruction(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_SYSTEM) || DEFAULT_SYSTEM_INSTRUCTION;
  } catch {
    return DEFAULT_SYSTEM_INSTRUCTION;
  }
}

export function setSystemInstruction(value: string): void {
  localStorage.setItem(STORAGE_KEY_SYSTEM, value);
}

export function getPrompt(type: BlueprintType): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed[type]) return parsed[type];
    }
  } catch { /* fall through */ }
  return DEFAULT_PROMPTS[type];
}

export function setPrompt(type: BlueprintType, value: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[type] = value;
    localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(parsed));
  } catch { /* silent */ }
}

export function getAllPrompts(): Record<BlueprintType, string> {
  const result = { ...DEFAULT_PROMPTS };
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const key of Object.keys(result) as BlueprintType[]) {
        if (parsed[key]) result[key] = parsed[key];
      }
    }
  } catch { /* silent */ }
  return result;
}

export function getExplainPrompt(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_EXPLAIN) || DEFAULT_EXPLAIN_PROMPT;
  } catch {
    return DEFAULT_EXPLAIN_PROMPT;
  }
}

export function setExplainPrompt(value: string): void {
  localStorage.setItem(STORAGE_KEY_EXPLAIN, value);
}

export function getSelectedBlueprintType(): BlueprintType {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SELECTED_TYPE);
    if (stored && stored in DEFAULT_PROMPTS) return stored as BlueprintType;
  } catch { /* silent */ }
  return 'general';
}

export function setSelectedBlueprintType(type: BlueprintType): void {
  localStorage.setItem(STORAGE_KEY_SELECTED_TYPE, type);
}

// ─── Reset helpers ───

export function resetSystemInstruction(): void {
  localStorage.removeItem(STORAGE_KEY_SYSTEM);
}

export function resetPrompt(type: BlueprintType): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
    if (stored) {
      const parsed = JSON.parse(stored);
      delete parsed[type];
      localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(parsed));
    }
  } catch { /* silent */ }
}

export function resetAllPrompts(): void {
  localStorage.removeItem(STORAGE_KEY_PROMPTS);
  localStorage.removeItem(STORAGE_KEY_SYSTEM);
  localStorage.removeItem(STORAGE_KEY_EXPLAIN);
}

export function isPromptCustomized(type: BlueprintType): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROMPTS);
    if (stored) {
      const parsed = JSON.parse(stored);
      return !!parsed[type] && parsed[type] !== DEFAULT_PROMPTS[type];
    }
  } catch { /* silent */ }
  return false;
}

export function isSystemInstructionCustomized(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SYSTEM);
    return !!stored && stored !== DEFAULT_SYSTEM_INSTRUCTION;
  } catch {
    return false;
  }
}

// ─── Blueprint type labels for UI ───
export const BLUEPRINT_TYPE_LABELS: Record<BlueprintType, string> = {
  floor_plan: 'Floor Plan',
  elevation: 'Elevation',
  section: 'Section',
  site_plan: 'Site Plan',
  detail: 'Detail',
  schedule: 'Schedule',
  general: 'General',
};

export const BLUEPRINT_TYPE_DESCRIPTIONS: Record<BlueprintType, string> = {
  floor_plan: 'Top-down view showing rooms, dimensions, doors, windows',
  elevation: 'Front/side view showing exterior materials, heights, roof pitch',
  section: 'Cut-through view showing structure, framing, insulation',
  site_plan: 'Bird\'s-eye view showing property, setbacks, utilities',
  detail: 'Zoomed-in construction assembly or connection detail',
  schedule: 'Table of doors, windows, finishes, or fixtures',
  general: 'Auto-detect — works for any blueprint type',
};
