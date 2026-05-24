import { GableRoof, HipRoof, ShedRoof, RoofFace } from './Roofs';
import React, { useMemo, Suspense, useState, useEffect, useRef } from 'react';
import { Canvas, ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Center, Environment, Sky, useGLTF, Line, useTexture } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import * as THREE from 'three';
import { InteriorWallConfig, ExteriorWallConfig, DoorConfig, WindowConfig, BumpoutConfig, InteriorAsset, RoofPart, TrussConfig, DormerConfig, CustomCamera, RoofGroup } from '../App';
import { computeShellFaces3D, sliceFacesWithGroup } from '../utils/roofSlicer3D';
import { useSpaceMouse } from '../hooks/useSpaceMouse';
import SpaceMouseController from './SpaceMouseController';
import { detectBays, computeFramingSupportSystem } from '../utils/bayDetection';

interface Preview3DProps {
  shape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom';
  widthIn: number;
  lengthIn: number;
  thicknessIn: number;
  lRightDepthIn: number;
  lBackWidthIn: number;
  uWallsIn: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number; w7: number; w8: number };
  hLeftBarWidthIn: number;
  hRightBarWidthIn: number;
  hMiddleBarHeightIn: number;
  hMiddleBarOffsetIn: number;
  tTopWidthIn: number;
  tTopLengthIn: number;
  tStemWidthIn: number;
  tStemLengthIn: number;
  interiorWalls: InteriorWallConfig[];
  exteriorWalls: ExteriorWallConfig[];
  doors: DoorConfig[];
  windows: WindowConfig[];
  bumpouts: BumpoutConfig[];
  wallHeightIn: number;
  foundationType: 'none' | 'slab' | 'slab-on-grade' | 'stem-wall';
  foundationShape: 'rectangle' | 'l-shape' | 'u-shape' | 'h-shape' | 't-shape' | 'custom';
  stemWallHeightIn: number;
  stemWallThicknessIn: number;
  footingWidthIn: number;
  footingThicknessIn: number;
  slabThicknessIn: number;
  thickenedEdgeDepthIn: number;
  addFloorFraming: boolean;
  joistSpacing: number;
  joistSize: string;
  joistDirection: 'x' | 'y';
  floorBays?: { id: string; label: string; joistDirection: 'x' | 'y'; x: number; y: number; width: number; height: number }[];
  addSubfloor: boolean;
  subfloorThickness: number;
  subfloorMaterial: 'plywood' | 'osb';
  rimJoistThickness: number;
  enableGirderSystem?: boolean;
  girderSpanThresholdFt?: number;
  girderPostSpacingFt?: number;
  girderSize?: '2-2x10' | '3-2x10' | '4-2x10' | '6x6' | '6x8';
  girderPostSize?: '4x4' | '6x6';
  girderPierSize?: '12" Round' | '16" Square';
  addPocketBeams?: boolean;
  pocketBeamsOnlyAtGirderEnds?: boolean;
  addInsulation: boolean;
  insulationThickness: number;
  addSheathing: boolean;
  sheathingThickness: number;
  addDrywall: boolean;
  drywallThickness: number;
  studSpacing: number;
  studThickness: number;
  topPlates: number;
  bottomPlates: number;
  headerType: 'single' | 'double' | 'lvl';
  headerHeight: number;
  solidWallsOnly: boolean;
  noFramingFloorOnly: boolean;
  showGround: boolean;
  showSky: boolean;
  showSun: boolean;
  sunHour?: number;
  sunMonth?: number;
  siteLatitude?: number;
  hdriPreset?: string;
  customHdriUrl?: string;
  showRoof: boolean;
  showAxes?: boolean;
  additionalStories: number;
  currentFloorIndex: number;
  upperFloorWallHeightIn: number;
  upperFloorJoistSize: string;
  combinedBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  shapeBlocks: { id: string, x: number, y: number, w: number, h: number }[];
  // 3D Model Reference
  referenceModelUrl: string | null;
  assets: InteriorAsset[];
  modelScale: number;
  modelOffset: { x: number; y: number; z: number };
  modelRotation: { x: number; y: number; z: number };
  modelOpacity: number;
  roofParts: RoofPart[];
  roofType: 'gable' | 'hip' | 'shed' | 'flat';
  roofPitch: number;
  roofOverhangIn: number;
  roofWidthIn: number;
  roofHeightIn: number;
  trussRuns: TrussConfig[];
  trussSpacing: number;
  dormers: DormerConfig[];
  roofGroups?: RoofGroup[];
  lDirection?: 'front-left' | 'front-right' | 'back-right' | 'back-left';
  customCameras?: CustomCamera[];
  setCustomCameras?: React.Dispatch<React.SetStateAction<CustomCamera[]>>;
  // Material Painter — callback includes area and auto-detected finish type
  appliedMaterials?: Record<string, string>;
  activePaintMaterial?: string | null;
  onSurfacePainted?: (surfaceId: string, textureUrl: string, areaSqFt: number, finishType: string) => void;
}


// ─── Material config type ────────────────────────────────────────────────
export interface MaterialConfig {
  scaleW: number;   // tile width in feet
  scaleH: number;   // tile height in feet
  opacity: number;  // 0 – 100
  lockAspect: boolean;
}

// ─── Texture helper – only called when we have a URL ───────────────────
const TexturedMaterial = ({
  url, roughness = 0.8, config, uvScale,
}: { url: string; roughness?: number; config?: MaterialConfig, uvScale?: [number, number] }) => {
  const texture = useTexture(url);
  
  const scopedTexture = React.useMemo(() => {
    if (!uvScale) return texture;
    const cloned = texture.clone();
    cloned.needsUpdate = true;
    return cloned;
  }, [texture, uvScale]);
  
  scopedTexture.wrapS = scopedTexture.wrapT = THREE.RepeatWrapping;
  
  if (uvScale) {
    const rw = Math.max(0.01, uvScale[0] / ((config?.scaleW ?? 5) * 12));
    const rh = Math.max(0.01, uvScale[1] / ((config?.scaleH ?? 5) * 12));
    scopedTexture.repeat.set(rw, rh);
  } else {
    const rw = Math.max(0.01, 1 / ((config?.scaleW ?? 5) * 12));
    const rh = Math.max(0.01, 1 / ((config?.scaleH ?? 5) * 12));
    scopedTexture.repeat.set(rw, rh);
  }

  const opacity = config?.opacity ?? 100;
  return (
    <meshStandardMaterial
      map={scopedTexture}
      roughness={roughness}
      metalness={0.05}
      opacity={opacity / 100}
      transparent={opacity < 100}
    />
  );
};

// ─── Error boundary for texture loading — prevents Canvas crash ─────────
class TextureErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode; resetKey?: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode; resetKey?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { hasError: boolean; lastResetKey?: string }) {
    if (props.resetKey !== state.lastResetKey) {
      return { hasError: false, lastResetKey: props.resetKey };
    }
    return null;
  }
  componentDidCatch(error: Error) {
    console.error('[Texture] Failed to load texture:', error.message, error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Error boundary for the entire 3D Canvas — prevents blank screen on crash ──
class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Preview3D] Canvas crashed:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-[#0f1424] rounded-xl border border-zinc-200 dark:border-[#1c2240]">
          <div className="text-center max-w-md p-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-2">3D Preview Error</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              The 3D renderer encountered an error and couldn't display the preview.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6 font-mono bg-zinc-200 dark:bg-zinc-800 rounded px-3 py-2 break-all">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-500 transition-colors"
            >
              Retry 3D Preview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SurfaceMaterial = ({
  textureUrl, color, hovered, isPaintMode, roughness, materialConfig, uvScale,
}: {
  textureUrl?: string; color: string; hovered: boolean;
  isPaintMode?: boolean; roughness?: number; materialConfig?: MaterialConfig;
  uvScale?: [number, number];
}) => {
  if (textureUrl) {
    const fallbackMat = <meshStandardMaterial color={color} roughness={roughness ?? 0.7} metalness={0.1} />;
    return (
      <TextureErrorBoundary fallback={fallbackMat}>
        <Suspense fallback={fallbackMat}>
          <TexturedMaterial url={textureUrl} roughness={roughness ?? 0.8} config={materialConfig} uvScale={uvScale} />
        </Suspense>
      </TextureErrorBoundary>
    );
  }
  const paintHover = '#86efac';
  const finalColor = isPaintMode && hovered ? paintHover : hovered ? '#a1a1aa' : color;
  return <meshStandardMaterial color={finalColor} roughness={roughness ?? 0.7} metalness={0.1} />;
};

// ─── Material Editor Panel (SketchUp-style) ─────────────────────────────
const MaterialEditorPanel = ({
  onClose,
  activePaintMaterial, onSelectTexture,
  activeSurfaceId, onSurfaceConfigChange, materialConfigs, appliedMaterials,
  onSaveMaterialConfig, onClearBrush,
}: {
  onClose: () => void;
  activePaintMaterial: string | null;
  onSelectTexture: (url: string) => void;
  activeSurfaceId: string | null;
  materialConfigs: Record<string, MaterialConfig>;
  appliedMaterials: Record<string, string>;
  onSurfaceConfigChange: (textureUrl: string, config: MaterialConfig) => void;
  onSaveMaterialConfig: (textureUrl: string, config: MaterialConfig) => void;
  onClearBrush: () => void;
}) => {
  const [assets, setAssets] = React.useState<any[]>([]);
  const [activeTab, setActiveTab] = React.useState<'select' | 'edit'>('select');
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [hiddenTextures, setHiddenTextures] = React.useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('mat_editor_hidden');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [showHidden, setShowHidden] = React.useState(false);
  const IMAGE_EXTS = /\.(jpg|jpeg|png|webp)$/i;

  React.useEffect(() => {
    fetch(`/api/assets?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => {
        if (d.assets) setAssets(d.assets.filter((a: any) => IMAGE_EXTS.test(a.name)));
      })
      .catch(console.error);
  }, []);

  // Which texture is currently painted on the active surface
  const surfaceTexture = activeSurfaceId ? appliedMaterials[activeSurfaceId] : null;
  // Active edit target: prefer the active surface's texture, fallback to brush
  const editTarget = surfaceTexture ?? activePaintMaterial;
  const editConfig: MaterialConfig = editTarget
    ? (materialConfigs[editTarget] ?? { scaleW: 5, scaleH: 5, opacity: 100, lockAspect: true })
    : { scaleW: 5, scaleH: 5, opacity: 100, lockAspect: true };

  const surfaceLabel = (id: string | null) => {
    if (!id) return 'None selected';
    if (id === 'ground') return '🌱 Ground';
    if (id === 'roof') return '🏠 Roof';
    if (id === 'foundation') return '🪨 Foundation';
    if (id === 'floor') return '🪵 Floor Structure';
    if (id === 'floor-finish') return '🏠 Floor Finish';
    if (id.startsWith('roof-')) {
      const parts = id.split('-'); // ['roof', '0', 'slope', 'front'] etc.
      const idx = parseInt(parts[1]) + 1;
      const facePart = parts.slice(2).join(' '); // 'slope front', 'end left', etc.
      const faceLabel: Record<string, string> = {
        'slope left':  'Left Slope',  'slope right': 'Right Slope',
        'slope front': 'Front Slope', 'slope back':  'Back Slope',
        'end front':   'Front Gable', 'end back':    'Back Gable',
        'end left':    'Left Hip',    'end right':   'Right Hip',
        'slope':       'Slope',
      };
      return `🏠 Roof #${idx} — ${faceLabel[facePart] ?? facePart}`;
    }
    if (id.startsWith('ext-wall-')) return `🧱 Ext Wall Face #${parseInt(id.replace('ext-wall-','')) + 1}`;
    if (id.startsWith('int-wall-')) return `🏛 Int Wall Face #${parseInt(id.replace('int-wall-','')) + 1}`;
    if (id.startsWith('drywall-')) return `🔲 Drywall Face #${parseInt(id.replace('drywall-','')) + 1}`;
    return id;
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaveStatus('saving');
    onSaveMaterialConfig(editTarget, editConfig);
    setTimeout(() => setSaveStatus('saved'), 400);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateConfig = (patch: Partial<MaterialConfig>) => {
    if (!editTarget) return;
    const next = { ...editConfig, ...patch };
    if (next.lockAspect && patch.scaleW !== undefined) next.scaleH = patch.scaleW;
    if (next.lockAspect && patch.scaleH !== undefined) next.scaleW = patch.scaleH;
    onSurfaceConfigChange(editTarget, next);
  };

  const feetIn = (ft: number) => {
    const f = Math.floor(ft);
    const i = Math.round((ft - f) * 12);
    return { ft: f, inches: i };
  };

  return (
    <div
      style={{ maxHeight: 'calc(100vh - 5rem)', width: '300px' }}
      className="absolute top-4 left-4 z-20 bg-zinc-900/97 backdrop-blur-md border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between flex-shrink-0 bg-zinc-950/50">
        <p className="text-white font-bold text-sm tracking-wide">🎨 Material Editor</p>
        <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      {/* ── Texture preview ── */}
      <div className="flex-shrink-0 bg-zinc-950 border-b border-zinc-800">
        <div className="flex gap-3 p-3 items-center">
          <div className="w-20 h-20 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800 flex-shrink-0">
            {editTarget ? (
              <img
                src={editTarget}
                alt="preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">🖼</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {editTarget ? editTarget.split(/[\\/]/).pop() : 'No texture selected'}
            </p>
            <p className="text-zinc-500 text-[10px] mt-1 truncate">{surfaceLabel(activeSurfaceId)}</p>
            {activePaintMaterial && (
              <div className="mt-1.5 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded text-emerald-400 text-[9px] font-bold uppercase tracking-wider inline-block">
                🪣 Painting active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-zinc-700 flex-shrink-0">
        {(['select', 'edit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-indigo-400 border-b-2 border-indigo-400 bg-zinc-800/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab === 'select' ? '🗂 Select' : '✏️ Edit'}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1 min-h-0">

        {/* SELECT TAB — library hint + hidden item manager */}
        {activeTab === 'select' && (
          <div className="p-3 space-y-3">

            {/* Active brush preview if something is selected */}
            {activePaintMaterial ? (
              <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-600 flex-shrink-0">
                  <img
                    src={activePaintMaterial}
                    className="w-full h-full object-cover"
                    alt="brush"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-bold truncate">{activePaintMaterial.split(/[\\/]/).pop()}</p>
                  <p className="text-emerald-400 text-[10px] mt-0.5 font-bold">🪣 Brush loaded — click surfaces to paint</p>
                </div>
                <button
                  onClick={onClearBrush}
                  className="text-zinc-500 hover:text-white text-sm leading-none flex-shrink-0"
                  title="Clear brush"
                >✕</button>
              </div>
            ) : (
              /* No brush: show the big hint card */
              <div className="bg-zinc-800/40 border border-dashed border-zinc-600 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">🖼️</div>
                <p className="text-white text-xs font-bold mb-1">Double-click any texture</p>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Go to the <span className="text-indigo-400 font-bold">Local Library</span> tab, open a folder,
                  then <span className="text-indigo-400 font-bold">double-click</span> any image to load it as your paint brush.
                </p>
              </div>
            )}

            {/* Hidden texture manager — still accessible here */}
            {assets.length > 0 && (
              <div className="border border-zinc-700/60 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2 bg-zinc-800/40 cursor-pointer hover:bg-zinc-800/70 transition-colors"
                  onClick={() => setShowHidden(v => !v)}
                >
                  <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
                    Manage hidden textures
                    {hiddenTextures.size > 0 && (
                      <span className="ml-1.5 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[9px]">{hiddenTextures.size} hidden</span>
                    )}
                  </p>
                  <span className="text-zinc-500 text-xs">{showHidden ? '▴' : '▾'}</span>
                </div>

                {showHidden && (
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {assets.length === 0 ? (
                      <p className="text-zinc-600 text-[10px] text-center py-2">No textures in library.</p>
                    ) : (
                      assets.map((asset, i) => {
                        const url = asset.absolutePath;
                        const isHid = hiddenTextures.has(url);
                        return (
                          <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg ${
                            isHid ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'
                          }`}>
                            <img
                              src={url}
                              className={`w-8 h-8 rounded object-cover border border-zinc-700 flex-shrink-0 ${isHid ? 'opacity-40' : ''}`}
                              alt={asset.name}
                            />
                            <span className={`flex-1 text-[10px] truncate ${isHid ? 'text-zinc-500' : 'text-zinc-300'}`}>
                              {asset.name}
                            </span>
                            <button
                              onClick={() => {
                                setHiddenTextures(prev => {
                                  const next = new Set(prev);
                                  if (isHid) next.delete(url); else next.add(url);
                                  localStorage.setItem('mat_editor_hidden', JSON.stringify([...next]));
                                  return next;
                                });
                              }}
                              className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                                isHid
                                  ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                                  : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                              }`}
                            >
                              {isHid ? '↩ Unhide' : '✕ Hide'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* EDIT TAB */}
        {activeTab === 'edit' && (
          <div className="p-3 space-y-3">
            {!editTarget ? (
              <p className="text-zinc-500 text-xs text-center py-6">
                Select or paint a texture first to edit its properties.
              </p>
            ) : (
              <>
                {/* Scale */}
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-zinc-300 text-[11px] font-bold uppercase tracking-wider">Tile Size</p>
                    <button
                      onClick={() => updateConfig({ lockAspect: !editConfig.lockAspect })}
                      title={editConfig.lockAspect ? 'Aspect locked' : 'Aspect free'}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                        editConfig.lockAspect
                          ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                          : 'border-zinc-600 text-zinc-500'
                      }`}
                    >
                      {editConfig.lockAspect ? '🔗 Linked' : '🔓 Free'}
                    </button>
                  </div>
                  {/* Width */}
                  <div className="mb-2">
                    <label className="text-zinc-500 text-[10px] mb-1 block">↔ Width</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={0.1} max={100} step={0.5}
                        value={editConfig.scaleW.toFixed(1)}
                        onChange={e => updateConfig({ scaleW: Math.max(0.1, Number(e.target.value)) })}
                        className="w-20 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <span className="text-zinc-500 text-[10px]">ft</span>
                      <input
                        type="number" min={0} max={11} step={1}
                        value={feetIn(editConfig.scaleW).inches}
                        onChange={e => {
                          const ft = Math.floor(editConfig.scaleW);
                          updateConfig({ scaleW: Math.max(0.1, ft + Number(e.target.value) / 12) });
                        }}
                        className="w-14 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <span className="text-zinc-500 text-[10px]">in</span>
                    </div>
                  </div>
                  {/* Height */}
                  <div>
                    <label className="text-zinc-500 text-[10px] mb-1 block">↕ Height</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={0.1} max={100} step={0.5}
                        value={editConfig.scaleH.toFixed(1)}
                        onChange={e => updateConfig({ scaleH: Math.max(0.1, Number(e.target.value)) })}
                        className="w-20 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <span className="text-zinc-500 text-[10px]">ft</span>
                      <input
                        type="number" min={0} max={11} step={1}
                        value={feetIn(editConfig.scaleH).inches}
                        onChange={e => {
                          const ft = Math.floor(editConfig.scaleH);
                          updateConfig({ scaleH: Math.max(0.1, ft + Number(e.target.value) / 12) });
                        }}
                        className="w-14 bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-white text-xs text-center"
                      />
                      <span className="text-zinc-500 text-[10px]">in</span>
                    </div>
                  </div>
                </div>

                {/* Opacity */}
                <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-zinc-300 text-[11px] font-bold uppercase tracking-wider">Opacity</p>
                    <span className="text-white text-xs font-mono">{editConfig.opacity}%</span>
                  </div>
                  <input
                    type="range" min={10} max={100} step={5}
                    value={editConfig.opacity}
                    onChange={e => updateConfig({ opacity: Number(e.target.value) })}
                    className="w-full accent-indigo-500"
                  />
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  className={`w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    saveStatus === 'saved'
                      ? 'bg-emerald-600 text-white'
                      : saveStatus === 'saving'
                      ? 'bg-zinc-700 text-zinc-400 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {saveStatus === 'saved' ? '✓ Saved to Library' : saveStatus === 'saving' ? 'Saving…' : '💾 Save to Library'}
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// ─── Split-aware Wall component ───────────────────────────────────────────
const Wall = ({
  x, y, z, w, h, d, color = "#e4e4e7", openings = [],
  surfaceId, appliedMaterials, activePaintMaterial, onSurfacePainted,
  materialConfigs = {},
  splitAt = 0,
}: {
  x: number; y: number; z: number; w: number; h: number; d: number;
  color?: string;
  openings?: { x: number; y: number; z: number; w: number; h: number; d: number }[];
  surfaceId?: string;
  appliedMaterials?: Record<string, string>;
  activePaintMaterial?: string | null;
  onSurfacePainted?: (id: string, url: string) => void;
  materialConfigs?: Record<string, MaterialConfig>;
  splitAt?: number;
}) => {
  const [hoveredL, setHoveredL] = useState(false);
  const [hoveredU, setHoveredU] = useState(false);
  const isPaintMode = !!activePaintMaterial;

  // Per-face split zones — zone IDs are surfaceId + '-lower' / '-upper'
  const lowerSurfaceId = surfaceId ? surfaceId + '-lower' : undefined;
  const upperSurfaceId = surfaceId ? surfaceId + '-upper' : undefined;

  const doSplit = splitAt > 0 && splitAt < h;
  const lowerH = doSplit ? splitAt : h;
  const upperH = doSplit ? h - splitAt : 0;

  // Look up textures: zone-specific first, then base surfaceId
  const fallbackTexture = appliedMaterials && surfaceId ? appliedMaterials[surfaceId] : undefined;
  const lowerTexture = (appliedMaterials && lowerSurfaceId ? appliedMaterials[lowerSurfaceId] : undefined) ?? fallbackTexture;
  const upperTexture = (appliedMaterials && upperSurfaceId ? appliedMaterials[upperSurfaceId] : undefined) ?? fallbackTexture;

  const getConfig = (texUrl?: string) => texUrl ? materialConfigs[texUrl] : undefined;

  const makeClickHandler = (sid?: string) => (e: any) => {
    e.stopPropagation();
    if (isPaintMode && sid && activePaintMaterial && onSurfacePainted) {
      onSurfacePainted(sid, activePaintMaterial);}
  };

  const ZoneMesh = ({
    zoneY, zoneH, setHov, hov, sid, texUrl,
  }: {
    zoneY: number; zoneH: number; setHov: (v: boolean) => void; hov: boolean;
    sid?: string; texUrl?: string;
  }) => (
    <group position={[x + w / 2, zoneY + zoneH / 2, z + d / 2]}>
      <mesh
        castShadow receiveShadow
        onClick={makeClickHandler(sid)}
        onPointerOver={() => setHov(true)}
        onPointerOut={() => setHov(false)}
      >
        {openings.length > 0 ? (
          <Geometry>
            <Base><boxGeometry args={[w, zoneH, d]} /></Base>
            {openings.map((op, oi) => (
              <Subtraction key={oi}
                position={[
                  op.x - (x + w / 2) + op.w / 2,
                  op.y - (zoneY + zoneH / 2) + op.h / 2,
                  op.z - (z + d / 2) + op.d / 2
                ]}
              >
                <boxGeometry args={[op.w, op.h, op.d]} />
              </Subtraction>
            ))}
          </Geometry>
        ) : (
          <boxGeometry args={[w, zoneH, d]} />
        )}
        <SurfaceMaterial
          textureUrl={texUrl}
          color={color}
          hovered={hov}
          isPaintMode={isPaintMode}
          materialConfig={getConfig(texUrl)}
          uvScale={[Math.max(w, d), zoneH]}
        />
      </mesh>
    </group>
  );

  return (
    <>
      {/* Lower zone (always rendered) */}
      <ZoneMesh zoneY={y} zoneH={lowerH} setHov={setHoveredL} hov={hoveredL}
        sid={doSplit ? lowerSurfaceId : surfaceId}
        texUrl={doSplit ? lowerTexture : fallbackTexture}
      />
      {/* Upper zone (only when split is active) */}
      {doSplit && (
        <ZoneMesh zoneY={y + lowerH} zoneH={upperH} setHov={setHoveredU} hov={hoveredU}
          sid={upperSurfaceId} texUrl={upperTexture}
        />
      )}
      {/* Top-face pink overlay for floor-plan mode */}
      <mesh position={[x + w / 2, y + h + 0.01, z + d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#ffb6c1" side={THREE.DoubleSide} />
      </mesh>
    </>
  );
};


const FoundationPart = ({
  x, y, z, w, h, d, color = "#a1a1aa",
  surfaceId, appliedMaterials, activePaintMaterial, onSurfacePainted,
  materialConfigs = {},
}: {
  x: number; y: number; z: number; w: number; h: number; d: number;
  color?: string;
  surfaceId?: string;
  appliedMaterials?: Record<string, string>;
  activePaintMaterial?: string | null;
  onSurfacePainted?: (id: string, url: string) => void;
  materialConfigs?: Record<string, MaterialConfig>;
}) => {
  const [hovered, setHovered] = useState(false);
  const textureUrl = surfaceId && appliedMaterials ? appliedMaterials[surfaceId] : undefined;
  const materialConfig = textureUrl ? materialConfigs[textureUrl] : undefined;
  const isPaintMode = !!activePaintMaterial;

  return (
    <mesh
      position={[x + w / 2, y + h / 2, z + d / 2]}
      castShadow receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (isPaintMode && surfaceId && activePaintMaterial && onSurfacePainted) {
          onSurfacePainted(surfaceId, activePaintMaterial);}
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[w, h, d]} />
      <SurfaceMaterial textureUrl={textureUrl} color={color} hovered={hovered} isPaintMode={isPaintMode} roughness={0.9} materialConfig={materialConfig} uvScale={[Math.max(w, d), h]} />
    </mesh>
  );
};

const Ground = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow
    >
      <circleGeometry args={[10000, 64]} />
      <meshStandardMaterial color="#6b7a3a" roughness={1} />
    </mesh>
  );
};


const Roof = ({
  x, y, z, w, h, d, color = "#71717a", textureUrl, isPaintMode, onPaintClick,
}: {
  x: number; y: number; z: number; w: number; h: number; d: number;
  color?: string;
  textureUrl?: string;
  isPaintMode?: boolean;
  onPaintClick?: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={[x + w / 2, y + h / 2, z + d / 2]} castShadow receiveShadow
      onClick={(e) => { e.stopPropagation(); if (isPaintMode && onPaintClick) onPaintClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[w, h, d]} />
      <SurfaceMaterial textureUrl={textureUrl} color={color} hovered={hovered} isPaintMode={isPaintMode} roughness={0.8} />
    </mesh>
  );
};

const Opening = ({ x, y, z, w, h, d }: { x: number, y: number, z: number, w: number, h: number, d: number }) => {
  return (
    <mesh position={[x + w / 2, y + h / 2, z + d / 2]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#18181b" transparent opacity={0.8} />
    </mesh>
  );
};

const ASSET_3D_COLORS: Record<string, string> = {
  bathroom: '#60a5fa',
  kitchen: '#fb923c',
  bedroom: '#a78bfa',
  living: '#4ade80',
  misc: '#a1a1aa',
  furniture: '#a1a1aa',
  custom: '#818cf8',
};

// Sub-component that loads and renders a .glb model, auto-scaled to fit the asset dimensions
// stretch=true: scales each axis independently to fill the target box exactly (for doors/windows)
// stretch=false: uniform scale preserving proportions (for interior assets)
const LinkedModel = ({ url, widthFt, depthFt, heightFt, stretch = false }: { url: string; widthFt: number; depthFt: number; heightFt: number; stretch?: boolean }) => {
  const { scene } = useGLTF(url);
  
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    
    // Calculate bounding box to auto-scale
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    if (size.x > 0 && size.y > 0 && size.z > 0) {
      const scaleX = widthFt / size.x;
      const scaleY = heightFt / size.y;
      const scaleZ = depthFt / size.z;
      
      if (stretch) {
        // Per-axis scaling — fill the opening exactly
        clone.scale.set(scaleX, scaleY, scaleZ);
      } else {
        // Uniform scaling — preserve proportions
        const uniformScale = Math.min(scaleX, scaleY, scaleZ);
        clone.scale.setScalar(uniformScale);
      }
      
      // Recalculate box after scaling
      const newBox = new THREE.Box3().setFromObject(clone);
      const newCenter = new THREE.Vector3();
      newBox.getCenter(newCenter);
      
      // Center horizontally, sit on ground
      clone.position.set(-newCenter.x, -newBox.min.y, -newCenter.z);
    }
    
    // Enable shadows
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    
    return clone;
  }, [scene, widthFt, depthFt, heightFt, stretch]);
  
  return <primitive object={clonedScene} />;
};

// Error boundary for 3D model loading — prevents Canvas crash
class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[Asset] 3D model failed to load:', error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const AssetPlaceholderBox = ({ w, h, d, color, errored }: { w: number; h: number; d: number; color: string; errored?: boolean }) => (
  <>
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={errored ? '#ef4444' : color} opacity={errored ? 0.5 : 0.7} transparent />
    </mesh>
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshBasicMaterial color={errored ? '#ef4444' : color} wireframe opacity={0.4} transparent />
    </mesh>
  </>
);

const Asset = ({ asset, floorY = 0 }: { asset: InteriorAsset; floorY?: number }) => {
  const w = (asset.widthIn || 24) * asset.scale;   // Inches (same unit as walls/foundation)
  const d = (asset.depthIn || 24) * asset.scale;
  const h = (asset.heightIn || 36) * asset.scale;
  const color = ASSET_3D_COLORS[asset.category] || '#a1a1aa';
  
  return (
    <group 
      position={[asset.x, floorY, asset.y]} 
      rotation={[0, -asset.rotation * Math.PI / 180, 0]}
    >
      {asset.modelUrl ? (
        // Render actual 3D model with error boundary fallback
        <ModelErrorBoundary fallback={<AssetPlaceholderBox w={w} h={h} d={d} color={color} errored />}>
          <Suspense fallback={
            <mesh position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color={color} opacity={0.3} transparent wireframe />
            </mesh>
          }>
            <LinkedModel url={asset.modelUrl} widthFt={w} depthFt={d} heightFt={h} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        // Placeholder box
        <AssetPlaceholderBox w={w} h={h} d={d} color={color} />
      )}
    </group>
  );
};

const ReferenceModel = ({ url, scale, offset, rotation, opacity }: { url: string, scale: number, offset: {x: number, y: number, z: number}, rotation: {x: number, y: number, z: number}, opacity: number }) => {
  const { scene } = useGLTF(url);
  useMemo(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => { m.transparent = true; m.opacity = opacity; });
          } else {
            mesh.material.transparent = true;
            mesh.material.opacity = opacity;
          }
        }
      }
    });
  }, [scene, opacity]);
  return (
    <primitive object={scene} scale={scale} position={[offset.x, offset.y, offset.z]}
      rotation={[rotation.x * Math.PI / 180, rotation.y * Math.PI / 180, rotation.z * Math.PI / 180]} />
  );
};

const DormerRoof = ({
  x, y, z, w, l, ridgeH, isHoriz, ridgeRatio = 0.5, fascia = 0, color = "#71717a",
  surfaceId, isPaintMode, appliedMaterials = {}, materialConfigs = {}, onSurfacePaintedFn, noOffset
}: {
  x: number, y: number, z: number, w: number, l: number, ridgeH: number, isHoriz: boolean,
  ridgeRatio?: number, fascia?: number, color?: string,
  surfaceId?: string, isPaintMode?: boolean, 
  appliedMaterials?: Record<string, string>,
  materialConfigs?: Record<string, MaterialConfig>,
  onSurfacePaintedFn?: (faceId: string) => void,
  noOffset?: boolean
}) => {
  const span = isHoriz ? w : l;
  const depth = isHoriz ? l : w;
  
  const pts2D = [
    [0, 0],
    [span, 0],
  ];
  if (fascia > 0) pts2D.push([span, fascia]);
  pts2D.push([span * ridgeRatio, ridgeH + fascia]);
  if (fascia > 0) pts2D.push([0, fascia]);

  const localToWorld = (px: number, py: number, pz: number): [number, number, number] => {
     if (isHoriz) {
        return [x + px, y + py, z + pz];
     } else {
        return [x + pz, y + py, (z + l) - px];
     }
  };

  const frontPts: [number, number, number][] = [];
  const backPts: [number, number, number][] = [];

  pts2D.forEach(p => {
     frontPts.push(localToWorld(p[0], p[1], 0));
     backPts.push(localToWorld(p[0], p[1], depth));
  });

  const backPtsReversed = [...backPts].reverse();

  const fp = (subId: string) => ({
    color,
    isPaintMode,
    onPaintClick: () => onSurfacePaintedFn?.(surfaceId ? `${surfaceId}-${subId}` : subId),
    textureUrl: surfaceId ? appliedMaterials[`${surfaceId}-${subId}`] : undefined,
    materialConfig: surfaceId && appliedMaterials[`${surfaceId}-${subId}`] ? materialConfigs[appliedMaterials[`${surfaceId}-${subId}`]] : undefined,
    noOffset
  });

  let vBL, vBR, vFR, vR, vFL;
  if (fascia > 0) {
    [vBL, vBR, vFR, vR, vFL] = [0, 1, 2, 3, 4];
  } else {
    [vBL, vBR, vR] = [0, 1, 2];
    vFR = 1;
    vFL = 0;
  }

  return (
    <group>
      <RoofFace pts={frontPts} {...fp('end-front')} />
      <RoofFace pts={backPtsReversed} {...fp('end-back')} />
      
      <RoofFace pts={[frontPts[vFL], frontPts[vR], backPts[vR], backPts[vFL]]} {...fp('slope-left')} />
      <RoofFace pts={[frontPts[vR], frontPts[vFR], backPts[vFR], backPts[vR]]} {...fp('slope-right')} />
      <RoofFace pts={[frontPts[0], frontPts[1], backPts[1], backPts[0]]} {...fp('underside')} />
      
      {fascia > 0 && (
         <>
           <RoofFace pts={[frontPts[1], frontPts[2], backPts[2], backPts[1]]} {...fp('fascia-right')} />
           <RoofFace pts={[frontPts[4], frontPts[0], backPts[0], backPts[4]]} {...fp('fascia-left')} />
         </>
      )}
    </group>
  );
};

const WebMember = ({ p1, p2, width, thickness }: { p1: [number, number], p2: [number, number], width: number, thickness: number }) => {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const cx = (p1[0] + p2[0]) / 2;
  const cy = (p1[1] + p2[1]) / 2;
  
  return (
    <mesh position={[cx, cy, 0]} rotation={[0, 0, angle]} castShadow receiveShadow>
      <boxGeometry args={[length, width, thickness]} />
      <meshStandardMaterial color="#d97706" roughness={0.8} />
    </mesh>
  );
};

const TrussMesh = ({ span, pitch, thickness, position, rotation, cutsLeft, cutsRight, type = 'Fink (W)', customScript }: { span: number, pitch: number, thickness: number, position: [number, number, number], rotation: [number, number, number], cutsLeft?: boolean, cutsRight?: boolean, type?: string, customScript?: string }) => {
  const theta = Math.atan(pitch / 12);
  const overhang = 12; // 12 inches
  const w = 3.5; // 2x4 width
  
  const topChordLength = (span / 2 + overhang) / Math.cos(theta);
  const height = (span / 2) * (pitch / 12);
  
  const tcLeftCx = (-span / 2 - overhang) / 2;
  const tcLeftCy = w + (height - overhang * (pitch / 12)) / 2 + (w / 2) / Math.cos(theta);
  
  const tcRightCx = (span / 2 + overhang) / 2;
  const tcRightCy = w + (height - overhang * (pitch / 12)) / 2 + (w / 2) / Math.cos(theta);

  const getTopChordY = (x: number) => {
    return w + (span / 2 - Math.abs(x)) * Math.tan(theta) + (w / 2) / Math.cos(theta);
  };

  return (
    <group position={position} rotation={rotation}>
      {/* Bottom chord */}
      {type === 'Scissor' ? (
        <>
          <mesh position={[-span / 4, (span / 4) * Math.tan(theta / 2) + w / 2, 0]} rotation={[0, 0, theta / 2]} castShadow receiveShadow>
            <boxGeometry args={[span / 2 / Math.cos(theta/2), w, thickness]} />
            <meshStandardMaterial color="#d97706" roughness={0.8} />
          </mesh>
          <mesh position={[span / 4, (span / 4) * Math.tan(theta / 2) + w / 2, 0]} rotation={[0, 0, -theta / 2]} castShadow receiveShadow>
            <boxGeometry args={[span / 2 / Math.cos(theta/2), w, thickness]} />
            <meshStandardMaterial color="#d97706" roughness={0.8} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, w / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[span, w, thickness]} />
          <meshStandardMaterial color={type === 'custom' ? '#6366f1' : '#d97706'} roughness={0.8} />
        </mesh>
      )}
      
      {/* Left top chord */}
      {!cutsLeft && (
        <mesh 
          position={[tcLeftCx, tcLeftCy, 0]} 
          rotation={[0, 0, theta]} 
          castShadow receiveShadow
        >
          <boxGeometry args={[topChordLength, w, thickness]} />
          <meshStandardMaterial color={type === 'custom' ? '#6366f1' : '#d97706'} roughness={0.8} />
        </mesh>
      )}
      
      {/* Right top chord */}
      {!cutsRight && (
        <mesh 
          position={[tcRightCx, tcRightCy, 0]} 
          rotation={[0, 0, -theta]} 
          castShadow receiveShadow
        >
          <boxGeometry args={[topChordLength, w, thickness]} />
          <meshStandardMaterial color={type === 'custom' ? '#6366f1' : '#d97706'} roughness={0.8} />
        </mesh>
      )}
      
      {/* Webs */}
      {type === 'Fink (W)' && (
        <>
          {!cutsLeft && <WebMember p1={[0, w / 2]} p2={[-span / 4, getTopChordY(-span / 4)]} width={w} thickness={thickness} />}
          {!cutsRight && <WebMember p1={[0, w / 2]} p2={[span / 4, getTopChordY(span / 4)]} width={w} thickness={thickness} />}
          {!cutsLeft && <WebMember p1={[-span / 3, w / 2]} p2={[-span / 4, getTopChordY(-span / 4)]} width={w} thickness={thickness} />}
          {!cutsRight && <WebMember p1={[span / 3, w / 2]} p2={[span / 4, getTopChordY(span / 4)]} width={w} thickness={thickness} />}
        </>
      )}

      {type === 'Howe' && (
        <>
          <WebMember p1={[0, w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />
          {!cutsLeft && <WebMember p1={[-span/3, w/2]} p2={[-span/3, getTopChordY(-span/3)]} width={w} thickness={thickness} />}
          {!cutsRight && <WebMember p1={[span/3, w/2]} p2={[span/3, getTopChordY(span/3)]} width={w} thickness={thickness} />}
          {!cutsLeft && <WebMember p1={[-span/3, w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />}
          {!cutsRight && <WebMember p1={[span/3, w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />}
        </>
      )}

      {type === 'King Post' && (
        <>
          <WebMember p1={[0, w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />
        </>
      )}

      {type === 'Scissor' && (
        <>
          <WebMember p1={[0, span/2 * Math.tan(theta/2) + w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />
        </>
      )}

      {type === 'custom' && (
        <>
          <WebMember p1={[0, w/2]} p2={[0, getTopChordY(0)]} width={w} thickness={thickness} />
          {!cutsLeft && <WebMember p1={[-span/4, w/2]} p2={[-span/4, getTopChordY(-span/4)]} width={w} thickness={thickness} />}
          {!cutsRight && <WebMember p1={[span/4, w/2]} p2={[span/4, getTopChordY(span/4)]} width={w} thickness={thickness} />}
        </>
      )}
    </group>
  );
};

const CameraController = ({ presetTrigger, targetCenter, distance, customCameras = [], captureTrigger, onCapture }: { presetTrigger: string | null, targetCenter: [number, number, number], distance: number, customCameras?: CustomCamera[], captureTrigger?: string | null, onCapture?: (cam: Omit<CustomCamera, 'name'>) => void }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (!captureTrigger || !controls || !onCapture) return;
    
    const target = (controls as any).target;
    const dx = target.x - camera.position.x;
    const dz = target.z - camera.position.z;
    const rotRad = Math.atan2(dz, dx);
    const rotationDeg = rotRad * (180 / Math.PI);
    
    const camX = camera.position.x / 0.0254;
    const camZ = camera.position.z / 0.0254;

    onCapture({
      id: Date.now().toString(),
      x: camX,
      y: camZ,
      rotation: rotationDeg
    });
  }, [captureTrigger]);
  
  useEffect(() => {
    if (!presetTrigger || !controls) return;
    
    const parts = presetTrigger.split('-');
    const timestamp = parts[0];
    const preset = parts.slice(1).join('-'); // handles multiple hyphenated ids if any
    
    const [cx, cy, cz] = targetCenter;
    const dist = distance * 1.2;

    const customCam = customCameras.find(c => c.id === preset);
    if (customCam) {
      const rotRad = customCam.rotation * (Math.PI / 180);
      const camX = customCam.x * 0.0254;
      const camZ = customCam.y * 0.0254;
      const eyeLevel = cy; // Uses targetCenter's mid-height (often ~4ft off ground inside)
      
      camera.position.set(camX, eyeLevel, camZ);
      
      const targetDist = 100 * 0.0254; // Look 100 inches ahead
      const tgtX = camX + Math.cos(rotRad) * targetDist;
      const tgtZ = camZ + Math.sin(rotRad) * targetDist;
      
      (controls as any).target.set(tgtX, eyeLevel, tgtZ);
      (controls as any).update();
      return;
    }
    
    const distOut = distance * 1.2; // Zoom out slightly outside footprint
    
    // Pan the focal point to the center of the house
    (controls as any).target.set(cx, cy, cz);
    
    // Move the camera
    switch (preset) {
      case 'top':
        camera.position.set(cx, cy + distOut * 1.5, cz + 0.1); // +0.1 Z prevents gimbal lock looking straight down
        break;
      case 'front':
        camera.position.set(cx, cy + distance * 0.3, cz + distOut);
        break;
      case 'back':
        camera.position.set(cx, cy + distance * 0.3, cz - distOut);
        break;
      case 'left':
        camera.position.set(cx - distOut, cy + distance * 0.3, cz);
        break;
      case 'right':
        camera.position.set(cx + distOut, cy + distance * 0.3, cz);
        break;
    }
    
    // Commit the matrix update to OrbitControls
    (controls as any).update();
  }, [presetTrigger, targetCenter, distance, camera, controls]);

  return null;
}

const ClipControls = ({ isFloorPlanView, cutHeight }: { isFloorPlanView: boolean, cutHeight: number }) => {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    gl.localClippingEnabled = true;
    
    // Create a horizontal plane pointing down to slice everything above it
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutHeight);
    const planes = isFloorPlanView ? [plane] : [];
    
    // Apply globally
    gl.clippingPlanes = planes;
    
    // Force material instances to accept clipping overrides
    scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => {
            m.clippingPlanes = planes;
            m.needsUpdate = true;
          });
        } else {
          child.material.clippingPlanes = planes;
          child.material.needsUpdate = true;
        }
      }
    });

  }, [isFloorPlanView, cutHeight, gl, scene]);
  
  return null;
}

interface GirderData {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  posts: { x: number; y: number; id: string }[];
  brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[];
}

function computeGirdersForBay(
  bay: { x: number; y: number; width: number; height: number; joistDirection: 'x' | 'y' },
  enableGirderSystem: boolean,
  girderSpanThresholdFt: number,
  girderPostSpacingFt: number
): GirderData[] {
  if (!enableGirderSystem) return [];

  const thresholdIn = girderSpanThresholdFt * 12;
  const postSpacingIn = girderPostSpacingFt * 12;

  const isSpanY = bay.joistDirection === 'y';
  const spanIn = isSpanY ? bay.height : bay.width;
  const girderLengthIn = isSpanY ? bay.width : bay.height;

  if (spanIn <= thresholdIn) return [];

  const numSpaces = Math.ceil(spanIn / thresholdIn);
  const numGirders = numSpaces - 1;
  const girders: GirderData[] = [];

  for (let i = 1; i <= numGirders; i++) {
    const offset = i * (spanIn / numSpaces);
    
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    if (isSpanY) {
      x1 = bay.x;
      y1 = bay.y + offset;
      x2 = bay.x + bay.width;
      y2 = y1;
    } else {
      x1 = bay.x + offset;
      y1 = bay.y;
      x2 = x1;
      y2 = bay.y + bay.height;
    }

    const numPostSpaces = Math.max(1, Math.ceil(girderLengthIn / postSpacingIn));
    const posts: { x: number; y: number; id: string }[] = [];
    const brackets: { x: number; y: number; id: string; type: 'start' | 'end' }[] = [];

    for (let j = 0; j <= numPostSpaces; j++) {
      const pOffset = j * (girderLengthIn / numPostSpaces);
      let px = 0, py = 0;
      if (isSpanY) {
        px = bay.x + pOffset;
        py = y1;
      } else {
        px = x1;
        py = bay.y + pOffset;
      }

      if (j === 0) {
        brackets.push({ x: px, y: py, id: `bracket-${i}-start`, type: 'start' });
      } else if (j === numPostSpaces) {
        brackets.push({ x: px, y: py, id: `bracket-${i}-end`, type: 'end' });
      } else {
        posts.push({
          x: px,
          y: py,
          id: `post-${i}-${j}`
        });
      }
    }

    girders.push({
      id: `girder-${i}`,
      x1,
      y1,
      x2,
      y2,
      length: girderLengthIn,
      posts,
      brackets
    });
  }

  return girders;
}

export default function Preview3D({
  shape, widthIn, lengthIn, thicknessIn, lRightDepthIn, lBackWidthIn, uWallsIn,
  hLeftBarWidthIn, hRightBarWidthIn, hMiddleBarHeightIn, hMiddleBarOffsetIn,
  tTopWidthIn, tTopLengthIn, tStemWidthIn, tStemLengthIn,
  interiorWalls, exteriorWalls, doors, windows, bumpouts, wallHeightIn,
  foundationType, foundationShape, stemWallHeightIn, stemWallThicknessIn, footingWidthIn, footingThicknessIn,
  slabThicknessIn, thickenedEdgeDepthIn,
  addFloorFraming, joistSpacing, joistSize, joistDirection, floorBays = [], addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness,
  enableGirderSystem = false,
  girderSpanThresholdFt = 12,
  girderPostSpacingFt = 8,
  girderSize = '3-2x10',
  girderPostSize = '6x6',
  girderPierSize = '12" Round',
  addPocketBeams = true,
  pocketBeamsOnlyAtGirderEnds = false,
  addInsulation, insulationThickness, addSheathing, sheathingThickness, addDrywall, drywallThickness,
  studSpacing, studThickness, topPlates, bottomPlates, headerType, headerHeight,
  solidWallsOnly,
  noFramingFloorOnly,
  showGround, showSky, showSun, showRoof, showAxes = true,
  sunHour = 14, sunMonth = 6, siteLatitude: siteLatitudeProp = 39.5, hdriPreset: hdriPresetProp = 'city', customHdriUrl: customHdriUrlProp = '',
  additionalStories, currentFloorIndex, upperFloorWallHeightIn, upperFloorJoistSize, combinedBlocks, shapeBlocks,
  referenceModelUrl, modelScale, modelOffset, modelRotation, modelOpacity,
  roofParts, roofType, roofPitch, roofOverhangIn, roofWidthIn, roofHeightIn,
  assets,
  trussRuns, trussSpacing,
  dormers,
  roofGroups = [],
  lDirection = 'front-left',
  customCameras = [],
  setCustomCameras,
  appliedMaterials: appliedMaterialsProp = {},
  activePaintMaterial: activePaintMaterialProp = null,
  onSurfacePainted,
}: Preview3DProps) {

  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<string | null>(null);
  const [cameraCaptureTrigger, setCameraCaptureTrigger] = useState<string | null>(null);
  const houseGroupRef = useRef<THREE.Group>(null);
  const [isExporting, setIsExporting] = useState(false);

  const getExactFloorAreaSqFt = () => {
    let areaSqIn = 0;
    if (shape === 'rectangle') {
      areaSqIn = widthIn * lengthIn;
    } else if (shape === 'l-shape') {
      areaSqIn = widthIn * lRightDepthIn + lBackWidthIn * (lengthIn - lRightDepthIn);
    } else if (shape === 'u-shape') {
      areaSqIn = uWallsIn.w7 * uWallsIn.w8 + 
                 uWallsIn.w3 * uWallsIn.w2 + 
                 (uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7) * (uWallsIn.w2 - uWallsIn.w4);
    } else if (shape === 'h-shape') {
      areaSqIn = hLeftBarWidthIn * lengthIn + 
                 hRightBarWidthIn * lengthIn + 
                 (widthIn - hLeftBarWidthIn - hRightBarWidthIn) * hMiddleBarHeightIn;
    } else if (shape === 't-shape') {
      areaSqIn = tTopWidthIn * tTopLengthIn + tStemWidthIn * tStemLengthIn;
    } else if (shape === 'custom') {
      const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
      if (blocksToUse && blocksToUse.length > 0) {
        areaSqIn = blocksToUse.reduce((sum, b) => sum + b.w * b.h, 0);
      } else if (exteriorWalls.length > 0) {
        const wallRects = exteriorWalls.map(w => {
          let x = w.xFt * 12 + w.xInches;
          let z = w.yFt * 12 + w.yInches;
          let len = w.lengthFt * 12 + w.lengthInches;
          const isH = w.orientation === 'horizontal';
          let rw = isH ? len : w.thicknessIn;
          let rd = isH ? w.thicknessIn : len;
          if (rw < 0) { x += rw; rw = Math.abs(rw); }
          if (rd < 0) { z += rd; rd = Math.abs(rd); }
          if (isH && w.exteriorSide === 1) z -= w.thicknessIn;
          else if (!isH && w.exteriorSide === 1) x -= w.thicknessIn;
          return { x, z, w: rw, d: rd };
        });
        const xSet = new Set<number>();
        const zSet = new Set<number>();
        wallRects.forEach(r => { xSet.add(r.x); xSet.add(r.x + r.w); zSet.add(r.z); zSet.add(r.z + r.d); });
        const xs = [...xSet].sort((a, b) => a - b);
        const zs = [...zSet].sort((a, b) => a - b);
        if (xs.length >= 2 && zs.length >= 2) {
          const grid: boolean[][] = Array.from({ length: xs.length - 1 }, () => Array(zs.length - 1).fill(false));
          for (let i = 0; i < xs.length - 1; i++) {
            for (let j = 0; j < zs.length - 1; j++) {
              const cx = (xs[i] + xs[i + 1]) / 2;
              const cz = (zs[j] + zs[j + 1]) / 2;
              if (wallRects.some(r => cx >= r.x && cx <= r.x + r.w && cz >= r.z && cz <= r.z + r.d)) grid[i][j] = true;
            }
          }
          for (let j = 0; j < zs.length - 1; j++) {
            let leftWall = -1;
            for (let i = 0; i < xs.length - 1; i++) {
              if (grid[i][j]) { if (leftWall >= 0) for (let k = leftWall; k <= i; k++) grid[k][j] = true; leftWall = i; }
            }
          }
          for (let i = 0; i < xs.length - 1; i++) {
            let topWall = -1;
            for (let j = 0; j < zs.length - 1; j++) {
              if (grid[i][j]) { if (topWall >= 0) for (let k = topWall; k <= j; k++) grid[i][k] = true; topWall = j; }
            }
          }
          for (let i = 0; i < xs.length - 1; i++) {
            for (let j = 0; j < zs.length - 1; j++) {
              if (grid[i][j]) {
                const cellW = xs[i + 1] - xs[i];
                const cellD = zs[j + 1] - zs[j];
                areaSqIn += cellW * cellD;
              }
            }
          }
        }
      }
    }
    return areaSqIn / 144;
  };

  const handleExportGLB = async () => {
    if (!houseGroupRef.current) return;
    setIsExporting(true);
    try {
      const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter');
      const exporter = new GLTFExporter();
      exporter.parse(
        houseGroupRef.current,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.style.display = 'none';
          link.href = url;
          link.download = `house_model_${Date.now()}.glb`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setIsExporting(false);
        },
        (error) => {
          console.error('An error happened during GLB export:', error);
          setIsExporting(false);
        },
        { binary: true }
      );
    } catch (e) {
      console.error('Failed to load GLTFExporter', e);
      setIsExporting(false);
    }
  };
  const [isFloorPlanView, setIsFloorPlanView] = useState(false);
  const [isDroneMode, setIsDroneMode] = useState(false);
  // Material Painter internal state (supports standalone use without App wiring)
  const [localAppliedMaterials, setLocalAppliedMaterials] = useState<Record<string, string>>(appliedMaterialsProp);
  const [localActivePaint, setLocalActivePaint] = useState<string | null>(activePaintMaterialProp);
  const [isPainterOpen, setIsPainterOpen] = useState(false);
  const [activeSurfaceId, setActiveSurfaceId] = useState<string | null>(null);
  const [materialConfigs, setMaterialConfigs] = useState<Record<string, MaterialConfig>>({});
  const [splitHeight, setSplitHeight] = useState(0);

  // ─── Sun Position Calculation ─────────────────────────────────────────
  // Simplified solar position: calculates altitude (elevation) and azimuth
  // based on hour-of-day and month for ~39°N latitude (Reno, NV area)
  const sunPosition = useMemo<[number, number, number]>(() => {
    const latitude = siteLatitudeProp;
    const latRad = (latitude * Math.PI) / 180;

    // Solar declination angle (simplified sinusoidal model)
    // Peaks at +23.45° on June 21 (day ~172), minimum at -23.45° on Dec 21
    const dayOfYear = (sunMonth - 1) * 30.44 + 15; // approximate mid-month
    const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
    const decRad = (declination * Math.PI) / 180;

    // Hour angle: 0 at solar noon (12:00), 15° per hour
    const hourAngle = (sunHour - 12) * 15;
    const haRad = (hourAngle * Math.PI) / 180;

    // Solar altitude (elevation angle)
    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    // Solar azimuth (measured from south, positive westward)
    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(altitude) + 0.0001);
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (hourAngle > 0) azimuth = -azimuth; // afternoon = west

    // Convert spherical to Cartesian (Three.js: Y is up)
    const distance = 40; // light distance from origin
    const elevClamped = Math.max(0.03, altitude); // keep sun barely above horizon at minimum
    const x = distance * Math.cos(elevClamped) * Math.sin(azimuth);
    const y = distance * Math.sin(elevClamped);
    const z = distance * Math.cos(elevClamped) * Math.cos(azimuth);

    return [x, y, z];
  }, [sunHour, sunMonth, siteLatitudeProp]);

  // Sun color temperature — warm at sunrise/sunset, neutral at midday
  const sunColor = useMemo(() => {
    const hourNorm = Math.abs(sunHour - 12) / 9; // 0 at noon, ~1 at edges
    const warmth = Math.pow(hourNorm, 1.5);
    const r = 1;
    const g = 1 - warmth * 0.35;
    const b = 1 - warmth * 0.65;
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }, [sunHour]);

  // Sun intensity — brightest at noon, dimmer at dawn/dusk
  const sunIntensity = useMemo(() => {
    const alt = Math.asin(sunPosition[1] / 40); // elevation angle from Y
    return Math.max(0.2, Math.min(2.0, 1.5 * Math.sin(Math.max(0, alt))));
  }, [sunPosition]);

  // 3Dconnexion SpaceMouse
  const { connect: connectSpaceMouse, disconnect: disconnectSpaceMouse, isConnected: spaceMouseConnected, deviceName: spaceMouseName, axes: spaceMouseAxes } = useSpaceMouse();

  // Load saved material configs on mount
  React.useEffect(() => {
    fetch('/api/material-configs')
      .then(r => r.json())
      .then(d => setMaterialConfigs(d))
      .catch(() => {});
  }, []);

  // Merge external prop overrides
  const activeMaterials = Object.keys(appliedMaterialsProp).length ? appliedMaterialsProp : localAppliedMaterials;
  const activePaint = activePaintMaterialProp ?? localActivePaint;

  // Ref to hold computed surface areas — populated after walls memo
  const surfaceAreasRef = useRef<Record<string, number>>({});

  const detectFinishType = (url: string): string => {
    const lower = decodeURIComponent(url).toLowerCase();
    if (/brick/i.test(lower)) return 'brick';
    if (/stucco|plaster/i.test(lower)) return 'stucco';
    if (/vinyl/i.test(lower)) return 'vinyl-siding';
    if (/hardie|fiber.?cement|cement.?board/i.test(lower)) return 'hardie-board';
    if (/wood|siding|cedar|plank|clapboard|shingle|shake|decking|timber|lumber|lap/i.test(lower)) return 'wood-siding';
    if (/metal|steel|corrugated|standing.?seam/i.test(lower)) return 'metal-standing-seam';
    if (/stone|slate|limestone|granite|fieldstone/i.test(lower)) return 'stone-veneer';
    if (/tile|ceramic|porcelain|terra.?cotta/i.test(lower)) return 'tile';
    if (/paint|coat/i.test(lower)) return 'paint';
    if (/concrete|cmu|block/i.test(lower)) return 'concrete';
    // Fallback: use generic "custom" for unknown materials
    return 'custom-texture';
  };

  const handleSurfacePainted = (surfaceId: string, url: string) => {
    const next = { ...activeMaterials, [surfaceId]: url };
    setLocalAppliedMaterials(next);

    // Compute the area of the painted surface (sq ft)
    const areaSqFt = surfaceAreasRef.current[surfaceId] || 0;
    const finishType = detectFinishType(url);

    if (onSurfacePainted) {
      onSurfacePainted(surfaceId, url, areaSqFt, finishType);
    }
  };



  // Listen for double-click selections from the Asset Library
  useEffect(() => {
    const handler = (e: Event) => {
      const { url } = (e as CustomEvent).detail;
      if (!url) return;
      setLocalActivePaint(url);
      setIsPainterOpen(true);
    };
    window.addEventListener('dooley:paintTexture', handler);
    return () => window.removeEventListener('dooley:paintTexture', handler);
  }, []);

  


  const foundationHeight = useMemo(() => {
    if (foundationType === 'none') return 0;
    if (foundationType === 'slab' || foundationType === 'slab-on-grade') return slabThicknessIn;
    return stemWallHeightIn;
  }, [foundationType, stemWallHeightIn, slabThicknessIn]);

  const joistH = useMemo(() => {
    if (!addFloorFraming) return 0;
    return joistSize === '2x6' ? 5.5 : joistSize === '2x8' ? 7.25 : joistSize === '2x10' ? 9.25 : 11.25;
  }, [addFloorFraming, joistSize]);

  const floorSystemHeight = useMemo(() => {
    // Slab foundations have no wood floor system on the first floor — the concrete pad IS the floor
    if (foundationType === 'slab' || foundationType === 'slab-on-grade') return 0;
    return joistH + (addSubfloor ? subfloorThickness : 0);
  }, [joistH, addSubfloor, subfloorThickness, foundationType]);

  const totalBaseHeight = foundationHeight + floorSystemHeight;

  const walls = useMemo(() => {
    const wallList: { x: number, y: number, z: number, w: number, h: number, d: number, color?: string }[] = [];
    const framingList: { x: number, y: number, z: number, w: number, h: number, d: number, color?: string }[] = [];
    
    const addWallsForStory = (currentY: number, currentWallHeight: number, floorIndex: number) => {
      const isUpper = floorIndex > 0;
      const extWalls: { id: number, x: number, y: number, w: number, h: number, isHorizontal: boolean, exteriorSide: 1 | -1 }[] = [];

      if (shape === 'rectangle') {
        extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 3, x: 0, y: lengthIn - thicknessIn, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 4, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });
        extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 });
      } else if (shape === 'l-shape') {
        extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lRightDepthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 3, x: lBackWidthIn - thicknessIn, y: lRightDepthIn - thicknessIn, w: widthIn - lBackWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 4, x: lBackWidthIn - thicknessIn, y: lRightDepthIn, w: thicknessIn, h: lengthIn - lRightDepthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 5, x: 0, y: lengthIn - thicknessIn, w: lBackWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 6, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });
      } else if (shape === 'u-shape') {
        extWalls.push({ id: 1, x: 0, y: 0, w: uWallsIn.w1, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 2, x: uWallsIn.w1 - thicknessIn, y: thicknessIn, w: thicknessIn, h: uWallsIn.w2 - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 3, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - thicknessIn, w: uWallsIn.w3 - thicknessIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 4, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - uWallsIn.w4, w: thicknessIn, h: uWallsIn.w4 - thicknessIn, isHorizontal: false, exteriorSide: -1 });
        extWalls.push({ id: 5, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w2 - uWallsIn.w4 - thicknessIn, w: uWallsIn.w5 + 2 * thicknessIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 6, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w8 - uWallsIn.w6, w: thicknessIn, h: uWallsIn.w6 - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 7, x: 0, y: uWallsIn.w8 - thicknessIn, w: uWallsIn.w7, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 8, x: 0, y: thicknessIn, w: thicknessIn, h: uWallsIn.w8 - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });
      } else if (shape === 'h-shape') {
        // Left Bar
        extWalls.push({ id: 1, x: 0, y: 0, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 2, x: hLeftBarWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 3, x: hLeftBarWidthIn - thicknessIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 4, x: 0, y: lengthIn - thicknessIn, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });
        // Middle Bar
        extWalls.push({ id: 6, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 7, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn - thicknessIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        // Right Bar
        extWalls.push({ id: 8, x: widthIn - hRightBarWidthIn, y: 0, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 9, x: widthIn - hRightBarWidthIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false, exteriorSide: -1 });
        extWalls.push({ id: 10, x: widthIn - hRightBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false, exteriorSide: -1 });
        extWalls.push({ id: 11, x: widthIn - hRightBarWidthIn, y: lengthIn - thicknessIn, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 12, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 });
      } else if (shape === 't-shape') {
        const stemX = (tTopWidthIn - tStemWidthIn) / 2;
        // Top Bar
        extWalls.push({ id: 1, x: 0, y: 0, w: tTopWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: -1 });
        extWalls.push({ id: 2, x: tTopWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 3, x: stemX + tStemWidthIn, y: tTopLengthIn - thicknessIn, w: tTopWidthIn - (stemX + tStemWidthIn), h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 4, x: 0, y: tTopLengthIn - thicknessIn, w: stemX, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
        extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false, exteriorSide: -1 });
        // Stem
        extWalls.push({ id: 6, x: stemX, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false, exteriorSide: -1 });
        extWalls.push({ id: 7, x: stemX + tStemWidthIn - thicknessIn, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false, exteriorSide: 1 });
        extWalls.push({ id: 8, x: stemX, y: tTopLengthIn + tStemLengthIn - thicknessIn, w: tStemWidthIn, h: thicknessIn, isHorizontal: true, exteriorSide: 1 });
      }

      exteriorWalls.filter(w => (w.floorIndex || 0) === floorIndex).forEach(wall => {
        const x = wall.xFt * 12 + wall.xInches;
        const y = wall.yFt * 12 + wall.yInches;
        const len = wall.lengthFt * 12 + wall.lengthInches;
        const isHorizontal = wall.orientation === 'horizontal';
        
        let w = isHorizontal ? len : wall.thicknessIn;
        let h = isHorizontal ? wall.thicknessIn : len;
        let finalX = x;
        let finalY = y;

        if (w < 0) {
          finalX += w;
          w = Math.abs(w);
        }
        if (h < 0) {
          finalY += h;
          h = Math.abs(h);
        }

        if (isHorizontal) {
          if (wall.exteriorSide === 1) finalY -= wall.thicknessIn;
        } else {
          if (wall.exteriorSide === 1) finalX -= wall.thicknessIn;
        }

        extWalls.push({
          id: wall.id,
          x: finalX,
          y: finalY,
          w,
          h,
          isHorizontal,
          exteriorSide: wall.exteriorSide
        });
      });

      // Add exterior walls to 3D list
      extWalls.forEach(w => {
        if (solidWallsOnly) {
          // Add core wall as solid block
          wallList.push({ x: w.x, y: currentY, z: w.y, w: w.w, h: currentWallHeight, d: w.h, color: "#e4e4e7" });
        } else {
          // Generate detailed framing members
          const sSpacing = studSpacing || 16;
          const sThick = studThickness || 1.5;
          const plateH = 1.5;
          const bottomPlateTotal = (bottomPlates || 1) * plateH;
          const topPlateTotal = (topPlates || 2) * plateH;
          const studH = currentWallHeight - bottomPlateTotal - topPlateTotal;
          const headerH = headerType === 'lvl' ? 9.25 : (headerType === 'double' ? 5.5 : 5.5);
          const len = w.isHorizontal ? w.w : w.h;
          const depth = w.isHorizontal ? w.h : w.w;

          // Collect openings on this wall
          const myOpenings: { start: number, end: number, type: string, width: number, height: number, sill?: number }[] = [];
          doors.filter(d => (d.floorIndex || 0) === floorIndex && d.wall === w.id).forEach(d => {
            const opStart = (d.xFt * 12) + (d.xInches || 0) - (d.widthIn / 2);
            myOpenings.push({ start: opStart, end: opStart + d.widthIn, type: 'door', width: d.widthIn, height: d.heightIn });
          });
          windows.filter(win => (win.floorIndex || 0) === floorIndex && win.wall === w.id).forEach(win => {
            const opStart = (win.xFt * 12) + (win.xInches || 0) - (win.widthIn / 2);
            myOpenings.push({ start: opStart, end: opStart + win.widthIn, type: 'window', width: win.widthIn, height: win.heightIn, sill: win.sillHeightIn });
          });

          // Bottom plates
          for (let p = 0; p < (bottomPlates || 1); p++) {
            framingList.push({ x: w.x, y: currentY + (p * plateH), z: w.y, w: w.w, h: plateH, d: w.h, color: "#deb887" });
          }
          // Top plates
          for (let p = 0; p < (topPlates || 2); p++) {
            framingList.push({ x: w.x, y: currentY + currentWallHeight - plateH - (p * plateH), z: w.y, w: w.w, h: plateH, d: w.h, color: "#deb887" });
          }

          // Studs
          const numStuds = Math.ceil(len / sSpacing) + 1;
          for (let si = 0; si < numStuds; si++) {
            const curPos = Math.min(si * sSpacing, len - sThick);
            let inOpening = false;
            for (const op of myOpenings) {
              if (curPos + sThick > op.start && curPos < op.end) { inOpening = true; break; }
            }
            if (!inOpening) {
              framingList.push({
                x: w.isHorizontal ? w.x + curPos : w.x,
                y: currentY + bottomPlateTotal,
                z: w.isHorizontal ? w.y : w.y + curPos,
                w: w.isHorizontal ? sThick : depth,
                h: studH,
                d: w.isHorizontal ? depth : sThick,
                color: "#deb887"
              });
            }
          }

          // Headers and king studs for openings
          for (const op of myOpenings) {
            const opY = currentY + bottomPlateTotal + (op.type === 'door' ? op.height : ((op.sill || 0) + op.height));
            // Header
            framingList.push({
              x: w.isHorizontal ? w.x + op.start : w.x,
              y: opY,
              z: w.isHorizontal ? w.y : w.y + op.start,
              w: w.isHorizontal ? op.width : depth,
              h: headerH,
              d: w.isHorizontal ? depth : op.width,
              color: "#c49a6c"
            });
            // King stud left (full height — bottom plate to top plate)
            framingList.push({
              x: w.isHorizontal ? w.x + op.start - sThick : w.x,
              y: currentY + bottomPlateTotal,
              z: w.isHorizontal ? w.y : w.y + op.start - sThick,
              w: w.isHorizontal ? sThick : depth,
              h: studH,
              d: w.isHorizontal ? depth : sThick,
              color: "#deb887"
            });
            // King stud right (full height — bottom plate to top plate)
            framingList.push({
              x: w.isHorizontal ? w.x + op.start + op.width : w.x,
              y: currentY + bottomPlateTotal,
              z: w.isHorizontal ? w.y : w.y + op.start + op.width,
              w: w.isHorizontal ? sThick : depth,
              h: studH,
              d: w.isHorizontal ? depth : sThick,
              color: "#deb887"
            });
            // Jack/trimmer stud left (bottom plate to header)
            framingList.push({
              x: w.isHorizontal ? w.x + op.start : w.x,
              y: currentY + bottomPlateTotal,
              z: w.isHorizontal ? w.y : w.y + op.start,
              w: w.isHorizontal ? sThick : depth,
              h: opY - currentY - bottomPlateTotal,
              d: w.isHorizontal ? depth : sThick,
              color: "#deb887"
            });
            // Jack/trimmer stud right (bottom plate to header)
            framingList.push({
              x: w.isHorizontal ? w.x + op.start + op.width - sThick : w.x,
              y: currentY + bottomPlateTotal,
              z: w.isHorizontal ? w.y : w.y + op.start + op.width - sThick,
              w: w.isHorizontal ? sThick : depth,
              h: opY - currentY - bottomPlateTotal,
              d: w.isHorizontal ? depth : sThick,
              color: "#deb887"
            });
            // Window sill plate
            if (op.type === 'window' && op.sill) {
              framingList.push({
                x: w.isHorizontal ? w.x + op.start : w.x,
                y: currentY + bottomPlateTotal + op.sill,
                z: w.isHorizontal ? w.y : w.y + op.start,
                w: w.isHorizontal ? op.width : depth,
                h: sThick,
                d: w.isHorizontal ? depth : op.width,
                color: "#c49a6c"
              });
            }
            // Cripple studs above header to top plate
            const crippleTop = currentY + currentWallHeight - topPlateTotal;
            const crippleBottom = opY + headerH;
            if (crippleTop > crippleBottom) {
              const crippleCount = Math.ceil(op.width / sSpacing) + 1;
              for (let ci = 0; ci < crippleCount; ci++) {
                const cPos = Math.min(ci * sSpacing, op.width - sThick);
                framingList.push({
                  x: w.isHorizontal ? w.x + op.start + cPos : w.x,
                  y: crippleBottom,
                  z: w.isHorizontal ? w.y : w.y + op.start + cPos,
                  w: w.isHorizontal ? sThick : depth,
                  h: crippleTop - crippleBottom,
                  d: w.isHorizontal ? depth : sThick,
                  color: "#deb887"
                });
              }
            }
            // Cripple studs below window sill
            if (op.type === 'window' && op.sill) {
              const sillBottom = currentY + bottomPlateTotal;
              const sillTop = currentY + bottomPlateTotal + op.sill;
              if (sillTop > sillBottom) {
                const crippleCount = Math.ceil(op.width / sSpacing) + 1;
                for (let ci = 0; ci < crippleCount; ci++) {
                  const cPos = Math.min(ci * sSpacing, op.width - sThick);
                  framingList.push({
                    x: w.isHorizontal ? w.x + op.start + cPos : w.x,
                    y: sillBottom,
                    z: w.isHorizontal ? w.y : w.y + op.start + cPos,
                    w: w.isHorizontal ? sThick : depth,
                    h: sillTop - sillBottom,
                    d: w.isHorizontal ? depth : sThick,
                    color: "#deb887"
                  });
                }
              }
            }
          }
        }
        
        if (addFloorFraming && addSheathing && !solidWallsOnly) {
          const shT = sheathingThickness;
          if (w.isHorizontal) {
            const sy = w.exteriorSide === 1 ? w.y + thicknessIn : w.y - shT;
            wallList.push({ x: w.x, y: currentY, z: sy, w: w.w, h: currentWallHeight, d: shT, color: "#c4a484" });
          } else {
            const sx = w.exteriorSide === 1 ? w.x + thicknessIn : w.x - shT;
            wallList.push({ x: sx, y: currentY, z: w.y, w: shT, h: currentWallHeight, d: w.h, color: "#c4a484" });
          }
        }

        if (addFloorFraming && addInsulation && !solidWallsOnly) {
          const inT = Math.min(insulationThickness, thicknessIn - 0.5);
          const offset = (thicknessIn - inT) / 2;
          if (w.isHorizontal) {
            wallList.push({ x: w.x, y: currentY, z: w.y + offset, w: w.w, h: currentWallHeight, d: inT, color: "#f472b6" });
          } else {
            wallList.push({ x: w.x + offset, y: currentY, z: w.y, w: inT, h: currentWallHeight, d: w.h, color: "#f472b6" });
          }
        }

        if (addFloorFraming && addDrywall && !solidWallsOnly) {
          const dwT = drywallThickness;
          if (w.isHorizontal) {
            const sy = w.exteriorSide === 1 ? w.y - dwT : w.y + thicknessIn;
            wallList.push({ x: w.x, y: currentY, z: sy, w: w.w, h: currentWallHeight, d: dwT, color: "#ffffff" });
          } else {
            const sx = w.exteriorSide === 1 ? w.x - dwT : w.x + thicknessIn;
            wallList.push({ x: sx, y: currentY, z: w.y, w: dwT, h: currentWallHeight, d: w.h, color: "#ffffff" });
          }
        }

        // Interior drywall face in solid-walls-only (no framing) mode — separate paintable surface
        if (solidWallsOnly) {
          const dwT = drywallThickness || 0.5;
          if (w.isHorizontal) {
            const sy = w.exteriorSide === 1 ? w.y - dwT : w.y + thicknessIn;
            wallList.push({ x: w.x, y: currentY, z: sy, w: w.w, h: currentWallHeight, d: dwT, color: "#ffffff" });
          } else {
            const sx = w.exteriorSide === 1 ? w.x - dwT : w.x + thicknessIn;
            wallList.push({ x: sx, y: currentY, z: w.y, w: dwT, h: currentWallHeight, d: w.h, color: "#ffffff" });
          }
        }
      });


      interiorWalls.filter(w => (w.floorIndex || 0) === floorIndex).forEach(w => {
          const x = w.xFt * 12 + w.xInches;
          const z = w.yFt * 12 + w.yInches;
          const len = w.lengthFt * 12 + w.lengthInches;
          const isHorizontal = w.orientation === 'horizontal';
          
          let width = isHorizontal ? len : w.thicknessIn;
          let depth = isHorizontal ? w.thicknessIn : len;
          let finalX = x;
          let finalZ = z;

          if (width < 0) {
            finalX += width;
            width = Math.abs(width);
          }
          if (depth < 0) {
            finalZ += depth;
            depth = Math.abs(depth);
          }

          if (solidWallsOnly) {
            wallList.push({
              x: finalX, y: currentY, z: finalZ,
              w: width,
              h: currentWallHeight,
              d: depth,
              color: "#d4d4d8"
            });
          } else {
            // Generate framing for interior walls
            const intLen = isHorizontal ? width : depth;
            const intDepth = isHorizontal ? depth : width;
            const sSpacing = studSpacing || 16;
            const sThick = studThickness || 1.5;
            const plateH = 1.5;
            const bottomPlateTotal = (bottomPlates || 1) * plateH;
            const topPlateTotal = (topPlates || 2) * plateH;
            const studH = currentWallHeight - bottomPlateTotal - topPlateTotal;
            const headerH = headerType === 'lvl' ? 9.25 : (headerType === 'double' ? 5.5 : 5.5);

            // Collect openings on this interior wall
            const myOpenings: { start: number, end: number, type: string, width: number, height: number, sill?: number }[] = [];
            doors.filter(d => (d.floorIndex || 0) === floorIndex && d.wall === w.id).forEach(d => {
              const opStart = (d.xFt * 12) + (d.xInches || 0) - (d.widthIn / 2);
              myOpenings.push({ start: opStart, end: opStart + d.widthIn, type: 'door', width: d.widthIn, height: d.heightIn });
            });
            windows.filter(win => (win.floorIndex || 0) === floorIndex && win.wall === w.id).forEach(win => {
              const opStart = (win.xFt * 12) + (win.xInches || 0) - (win.widthIn / 2);
              myOpenings.push({ start: opStart, end: opStart + win.widthIn, type: 'window', width: win.widthIn, height: win.heightIn, sill: win.sillHeightIn });
            });

            // Bottom plates
            for (let p = 0; p < (bottomPlates || 1); p++) {
              framingList.push({ x: finalX, y: currentY + (p * plateH), z: finalZ, w: width, h: plateH, d: depth, color: "#deb887" });
            }
            // Top plates
            for (let p = 0; p < (topPlates || 2); p++) {
              framingList.push({ x: finalX, y: currentY + currentWallHeight - plateH - (p * plateH), z: finalZ, w: width, h: plateH, d: depth, color: "#deb887" });
            }

            // Studs
            const numStuds = Math.ceil(intLen / sSpacing) + 1;
            for (let si = 0; si < numStuds; si++) {
              const curPos = Math.min(si * sSpacing, intLen - sThick);
              let inOpening = false;
              for (const op of myOpenings) {
                if (curPos + sThick > op.start && curPos < op.end) { inOpening = true; break; }
              }
              if (!inOpening) {
                framingList.push({
                  x: isHorizontal ? finalX + curPos : finalX,
                  y: currentY + bottomPlateTotal,
                  z: isHorizontal ? finalZ : finalZ + curPos,
                  w: isHorizontal ? sThick : intDepth,
                  h: studH,
                  d: isHorizontal ? intDepth : sThick,
                  color: "#deb887"
                });
              }
            }

            // Headers and king studs for interior wall openings
            for (const op of myOpenings) {
              const opY = currentY + bottomPlateTotal + (op.type === 'door' ? op.height : ((op.sill || 0) + op.height));
              // Header
              framingList.push({
                x: isHorizontal ? finalX + op.start : finalX,
                y: opY,
                z: isHorizontal ? finalZ : finalZ + op.start,
                w: isHorizontal ? op.width : intDepth,
                h: headerH,
                d: isHorizontal ? intDepth : op.width,
                color: "#c49a6c"
              });
              // King stud left (full height — bottom plate to top plate)
              framingList.push({
                x: isHorizontal ? finalX + op.start - sThick : finalX,
                y: currentY + bottomPlateTotal,
                z: isHorizontal ? finalZ : finalZ + op.start - sThick,
                w: isHorizontal ? sThick : intDepth,
                h: studH,
                d: isHorizontal ? intDepth : sThick,
                color: "#deb887"
              });
              // King stud right (full height — bottom plate to top plate)
              framingList.push({
                x: isHorizontal ? finalX + op.start + op.width : finalX,
                y: currentY + bottomPlateTotal,
                z: isHorizontal ? finalZ : finalZ + op.start + op.width,
                w: isHorizontal ? sThick : intDepth,
                h: studH,
                d: isHorizontal ? intDepth : sThick,
                color: "#deb887"
              });
              // Jack/trimmer stud left (bottom plate to header)
              framingList.push({
                x: isHorizontal ? finalX + op.start : finalX,
                y: currentY + bottomPlateTotal,
                z: isHorizontal ? finalZ : finalZ + op.start,
                w: isHorizontal ? sThick : intDepth,
                h: opY - currentY - bottomPlateTotal,
                d: isHorizontal ? intDepth : sThick,
                color: "#deb887"
              });
              // Jack/trimmer stud right (bottom plate to header)
              framingList.push({
                x: isHorizontal ? finalX + op.start + op.width - sThick : finalX,
                y: currentY + bottomPlateTotal,
                z: isHorizontal ? finalZ : finalZ + op.start + op.width - sThick,
                w: isHorizontal ? sThick : intDepth,
                h: opY - currentY - bottomPlateTotal,
                d: isHorizontal ? intDepth : sThick,
                color: "#deb887"
              });
            }
          }

          if (addFloorFraming && addInsulation && !solidWallsOnly) {
            const inT = Math.min(insulationThickness, w.thicknessIn - 0.5);
            const offset = (w.thicknessIn - inT) / 2;
            wallList.push({
              x: isHorizontal ? finalX : finalX + offset,
              y: currentY,
              z: isHorizontal ? finalZ + offset : finalZ,
              w: isHorizontal ? width : inT,
              h: currentWallHeight,
              d: isHorizontal ? inT : depth,
              color: "#f472b6"
            });
          }

          if (addFloorFraming && addDrywall && !solidWallsOnly) {
            const dwT = drywallThickness;
            if (isHorizontal) {
              wallList.push({ x: finalX, y: currentY, z: finalZ - dwT, w: width, h: currentWallHeight, d: dwT, color: "#ffffff" });
              wallList.push({ x: finalX, y: currentY, z: finalZ + w.thicknessIn, w: width, h: currentWallHeight, d: dwT, color: "#ffffff" });
            } else {
              wallList.push({ x: finalX - dwT, y: currentY, z: finalZ, w: dwT, h: currentWallHeight, d: depth, color: "#ffffff" });
              wallList.push({ x: finalX + w.thicknessIn, y: currentY, z: finalZ, w: dwT, h: currentWallHeight, d: depth, color: "#ffffff" });
            }
          }
        });

        bumpouts.filter(b => (b.floorIndex || 0) === floorIndex).forEach(b => {
          const wallId = b.wall;
          const extWall = extWalls.find(w => w.id === wallId);
          if (!extWall) return;

          const bx = b.xFt * 12 + b.xInches;
          const bw = b.widthIn;
          const bd = b.depthIn;
          const t = thicknessIn;

          if (extWall.isHorizontal) {
            const sy = extWall.exteriorSide === 1 ? extWall.y : extWall.y - bd + t;
            // Left wall
            wallList.push({ x: extWall.x + bx, y: currentY, z: sy, w: t, h: currentWallHeight, d: bd, color: "#e4e4e7" });
            // Right wall
            wallList.push({ x: extWall.x + bx + bw - t, y: currentY, z: sy, w: t, h: currentWallHeight, d: bd, color: "#e4e4e7" });
            // Front wall
            wallList.push({ x: extWall.x + bx, y: currentY, z: extWall.y + extWall.exteriorSide * (bd - t), w: bw, h: currentWallHeight, d: t, color: "#e4e4e7" });
          } else {
            const sx = extWall.exteriorSide === 1 ? extWall.x : extWall.x - bd + t;
            // Left wall
            wallList.push({ x: sx, y: currentY, z: extWall.y + bx, w: bd, h: currentWallHeight, d: t, color: "#e4e4e7" });
            // Right wall
            wallList.push({ x: sx, y: currentY, z: extWall.y + bx + bw - t, w: bd, h: currentWallHeight, d: t, color: "#e4e4e7" });
            // Front wall
            wallList.push({ x: extWall.x + extWall.exteriorSide * (bd - t), y: currentY, z: extWall.y + bx, w: t, h: currentWallHeight, d: bw, color: "#e4e4e7" });
          }
        });
    };

    // 1st Floor
    if (currentFloorIndex >= 0) {
      addWallsForStory(totalBaseHeight, wallHeightIn, 0);
    }

    // Upper Floors
    let currentZ = totalBaseHeight + wallHeightIn;
    for (let i = 0; i < additionalStories; i++) {
      const upperJoistH = upperFloorJoistSize === '2x6' ? 5.5 : upperFloorJoistSize === '2x8' ? 7.25 : upperFloorJoistSize === '2x10' ? 9.25 : 11.25;
      const upperFloorSystemH = upperJoistH + (addSubfloor ? subfloorThickness : 0);
      currentZ += upperFloorSystemH;
      
      if (currentFloorIndex >= i + 1) {
        addWallsForStory(currentZ, upperFloorWallHeightIn, i + 1);
      }
      
      currentZ += upperFloorWallHeightIn;
    }

    return { wallList, framingList };
  }, [shape, widthIn, lengthIn, thicknessIn, lRightDepthIn, lBackWidthIn, uWallsIn, exteriorWalls, interiorWalls, bumpouts, wallHeightIn, totalBaseHeight, addSheathing, sheathingThickness, addInsulation, insulationThickness, addDrywall, drywallThickness, additionalStories, upperFloorWallHeightIn, upperFloorJoistSize, addSubfloor, subfloorThickness, currentFloorIndex, solidWallsOnly, studSpacing, studThickness, bottomPlates, topPlates, headerType, headerHeight, doors, windows]);

  const roofs = useMemo(() => {
    const totalWallHeight = wallHeightIn + (additionalStories * upperFloorWallHeightIn);
    const roofY = totalBaseHeight + totalWallHeight;
    
    return roofParts.map(part => {
      const pitchFactor = part.pitch / 12;
      const maxDim = Math.max(part.widthIn, part.lengthIn);
      const ridgeHeight = (maxDim / 2) * pitchFactor;
      
      return {
        type: part.type,
        x: part.x,
        y: roofY,
        z: part.y,
        width: part.widthIn,
        length: part.lengthIn,
        ridgeHeight: ridgeHeight > 0 ? ridgeHeight : 0.1,
        overhang: 12, // Default overhang
        color: "#71717a",
        ridgeDirection: part.ridgeDirection
      };
    });
  }, [roofParts, totalBaseHeight, wallHeightIn, additionalStories, upperFloorWallHeightIn]);

  // ── Compute surface areas for each paintable surface ──────────────────
  // This runs after the walls memo and populates surfaceAreasRef
  // so handleSurfacePainted can look up the area when a surface is clicked.
  useEffect(() => {
    const areas: Record<string, number> = {};
    walls.wallList.forEach((w, i) => {
      const isExt = w.color === "#e4e4e7" || w.color === "#c4a484";
      const isDrywall = w.color === "#ffffff";
      const surfaceId = isExt ? `ext-wall-${i}` : isDrywall ? `drywall-${i}` : `int-wall-${i}`;
      // Painted face area = length × height  (the larger of w/d is the length, smaller is thickness)
      const faceArea = Math.max(w.w, w.d) * w.h / 144; // sq in → sq ft
      areas[surfaceId] = Math.round(faceArea * 100) / 100;
    });
    // Foundation surfaces (stem walls, slab edges)
    if (foundationType !== 'none' && stemWallHeightIn > 0) {
      const perimeterIn = (widthIn + lengthIn) * 2; // simplified for rectangle
      const foundAreaSqFt = (perimeterIn * stemWallHeightIn) / 144;
      areas['foundation'] = Math.round(foundAreaSqFt * 100) / 100;
    }
    // Ground/floor area
    const exactFloorAreaSqFt = getExactFloorAreaSqFt();
    areas['ground'] = Math.round(exactFloorAreaSqFt * 100) / 100;
    areas['floor'] = Math.round(exactFloorAreaSqFt * 100) / 100;
    areas['floor-finish'] = Math.round(exactFloorAreaSqFt * 100) / 100;

    // Roof surfaces for standard roofs
    roofs.forEach((roof, i) => {
      const W = roof.ridgeDirection === 'horizontal' ? roof.width + 2 * roof.overhang : roof.length + 2 * roof.overhang;
      const L = roof.ridgeDirection === 'horizontal' ? roof.length + 2 * roof.overhang : roof.width + 2 * roof.overhang;
      const H = roof.ridgeHeight;

      if (roof.type === 'gable') {
        const slopeLen = Math.sqrt((W / 2) * (W / 2) + H * H);
        const slopeArea = (slopeLen * L) / 144;
        const gableEndArea = (0.5 * W * H) / 144;

        areas[`roof-${i}-slope-left`] = Math.round(slopeArea * 100) / 100;
        areas[`roof-${i}-slope-right`] = Math.round(slopeArea * 100) / 100;
        areas[`roof-${i}-end-front`] = Math.round(gableEndArea * 100) / 100;
        areas[`roof-${i}-end-back`] = Math.round(gableEndArea * 100) / 100;
      }
      else if (roof.type === 'hip') {
        const pitchFactor = Math.sqrt(1 + (H / (W / 2)) * (H / (W / 2)));
        const totalRoofArea = (W * L * pitchFactor) / 144;
        const perSlopeArea = totalRoofArea / 4;

        areas[`roof-${i}-slope-front`] = Math.round(perSlopeArea * 100) / 100;
        areas[`roof-${i}-slope-back`] = Math.round(perSlopeArea * 100) / 100;
        areas[`roof-${i}-slope-left`] = Math.round(perSlopeArea * 100) / 100;
        areas[`roof-${i}-slope-right`] = Math.round(perSlopeArea * 100) / 100;
      }
      else if (roof.type === 'shed') {
        const slopeLen = Math.sqrt(W * W + H * H);
        const slopeArea = (slopeLen * L) / 144;
        const endArea = (0.5 * W * H) / 144;

        areas[`roof-${i}-slope`] = Math.round(slopeArea * 100) / 100;
        areas[`roof-${i}-end-left`] = Math.round(endArea * 100) / 100;
        areas[`roof-${i}-end-right`] = Math.round(endArea * 100) / 100;
      }
    });

    // Roof surfaces for Solid Shell (custom corner roofs / trussRuns)
    trussRuns.forEach(run => {
      if (run.type === 'Solid Shell') {
        const overhang = 12; // default
        const w = run.widthFt * 12;
        const d = run.lengthFt * 12;
        const eaveDrop = run.eaveDropIn !== undefined ? run.eaveDropIn : 0;
        const height = (run.spanFt * 12 / 2) * (run.pitch / 12) + eaveDrop;

        const W = w + 2 * overhang;
        const L = d + 2 * overhang;
        const H = height;

        const slopeLen = Math.sqrt((W / 2) * (W / 2) + H * H);
        const slopeArea = (slopeLen * L) / 144;
        const gableEndArea = (0.5 * W * H) / 144;

        areas[`truss-shell-${run.id}-slope-left`] = Math.round(slopeArea * 100) / 100;
        areas[`truss-shell-${run.id}-slope-right`] = Math.round(slopeArea * 100) / 100;
        areas[`truss-shell-${run.id}-end-front`] = Math.round(gableEndArea * 100) / 100;
        areas[`truss-shell-${run.id}-end-back`] = Math.round(gableEndArea * 100) / 100;
        areas[`truss-shell-${run.id}-underside`] = Math.round(((W * L) / 144) * 100) / 100;
      }
    });

    surfaceAreasRef.current = areas;
  }, [
    walls, foundationType, stemWallHeightIn, widthIn, lengthIn, roofs, trussRuns,
    shape, lRightDepthIn, lBackWidthIn, uWallsIn, hLeftBarWidthIn, hRightBarWidthIn,
    hMiddleBarHeightIn, hMiddleBarOffsetIn, tTopWidthIn, tTopLengthIn, tStemWidthIn,
    tStemLengthIn, combinedBlocks, shapeBlocks, exteriorWalls
  ]);

  const foundation = useMemo(() => {
    if (currentFloorIndex !== 0) return [];
    if (foundationType === 'none') return [];
    const parts: { x: number, y: number, z: number, w: number, h: number, d: number, color?: string }[] = [];

    const drawFoundationPart = (start_x: number, start_z: number, length: number, depth: number, is_x_dir: boolean) => {
      if (foundationType === 'stem-wall') {
        const sw_z = 0;
        const sw_h = stemWallHeightIn;
        const sw_t = stemWallThicknessIn;
        
        const ft_z = sw_z - footingThicknessIn;
        const ft_h = footingThicknessIn;
        const ft_w = footingWidthIn;
        
        if (is_x_dir) {
          const sw_y = start_z + (depth - sw_t) / 2.0;
          parts.push({ x: start_x, y: sw_z, z: sw_y, w: length, h: sw_h, d: sw_t, color: "#a1a1aa" });
          
          const ft_y = start_z + (depth - ft_w) / 2.0;
          parts.push({ x: start_x, y: ft_z, z: ft_y, w: length, h: ft_h, d: ft_w, color: "#71717a" });
        } else {
          const sw_x = start_x + (depth - sw_t) / 2.0;
          parts.push({ x: sw_x, y: sw_z, z: start_z, w: sw_t, h: sw_h, d: length, color: "#a1a1aa" });
          
          const ft_x = start_x + (depth - ft_w) / 2.0;
          parts.push({ x: ft_x, y: ft_z, z: start_z, w: ft_w, h: ft_h, d: length, color: "#71717a" });
        }
      } else if (foundationType === 'slab' || foundationType === 'slab-on-grade') {
        const slab_h = slabThicknessIn;
        const edge_d = thickenedEdgeDepthIn;
        const edge_w = 12; // Default thickened edge width
        
        if (is_x_dir) {
          // Main slab part for this section
          parts.push({ x: start_x, y: 0, z: start_z, w: length, h: slab_h, d: depth, color: "#a1a1aa" });
          
          // Thickened edge (integral footing) - ONLY for slab-on-grade
          if (foundationType === 'slab-on-grade') {
            const edge_y = start_z + (depth - edge_w) / 2.0;
            parts.push({ x: start_x, y: -edge_d + slab_h, z: edge_y, w: length, h: edge_d - slab_h, d: edge_w, color: "#71717a" });
          }
        } else {
          parts.push({ x: start_x, y: 0, z: start_z, w: depth, h: slab_h, d: length, color: "#a1a1aa" });
          
          if (foundationType === 'slab-on-grade') {
            const edge_x = start_x + (depth - edge_w) / 2.0;
            parts.push({ x: edge_x, y: -edge_d + slab_h, z: start_z, w: edge_w, h: edge_d - slab_h, d: length, color: "#71717a" });
          }
        }
      }
    };

    // Perimeter - ONLY for stem-wall to avoid redundancy with slab
    const t = thicknessIn;
    if (foundationType === 'stem-wall') {
      if (foundationShape === 'rectangle') {
        drawFoundationPart(0, 0, widthIn, t, true);
        drawFoundationPart(0, lengthIn - t, widthIn, t, true);
        drawFoundationPart(0, t, lengthIn - 2 * t, t, false);
        drawFoundationPart(widthIn - t, t, lengthIn - 2 * t, t, false);
      } else if (foundationShape === 'l-shape') {
        drawFoundationPart(0, 0, widthIn, t, true);
        drawFoundationPart(widthIn - t, t, lRightDepthIn - t, t, false);
        drawFoundationPart(lBackWidthIn, lRightDepthIn - t, widthIn - lBackWidthIn - t, t, true);
        drawFoundationPart(lBackWidthIn, lRightDepthIn, lengthIn - lRightDepthIn - t, t, false);
        drawFoundationPart(0, lengthIn - t, lBackWidthIn + t, t, true);
        drawFoundationPart(0, t, lengthIn - 2 * t, t, false);
      } else if (foundationShape === 'u-shape') {
        drawFoundationPart(0, 0, uWallsIn.w1, t, true);
        drawFoundationPart(uWallsIn.w1 - t, t, uWallsIn.w2 - t, t, false);
        drawFoundationPart(uWallsIn.w1 - uWallsIn.w3, uWallsIn.w2 - t, uWallsIn.w3 - t, t, true);
        drawFoundationPart(uWallsIn.w1 - uWallsIn.w3, uWallsIn.w2 - uWallsIn.w4, uWallsIn.w4 - t, t, false);
        drawFoundationPart(uWallsIn.w7 - t, uWallsIn.w2 - uWallsIn.w4 - t, uWallsIn.w5 + 2 * t, t, true);
        drawFoundationPart(uWallsIn.w7 - t, uWallsIn.w8 - uWallsIn.w6, uWallsIn.w6 - t, t, false);
        drawFoundationPart(0, uWallsIn.w8 - t, uWallsIn.w7, t, true);
        drawFoundationPart(0, t, uWallsIn.w8 - 2 * t, t, false);
      } else if (foundationShape === 'h-shape') {
        drawFoundationPart(0, 0, hLeftBarWidthIn, t, true);
        drawFoundationPart(hLeftBarWidthIn - t, t, hMiddleBarOffsetIn - t, t, false);
        drawFoundationPart(hLeftBarWidthIn - t, hMiddleBarOffsetIn + hMiddleBarHeightIn, lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - t, t, false);
        drawFoundationPart(0, lengthIn - t, hLeftBarWidthIn, t, true);
        drawFoundationPart(0, t, lengthIn - 2 * t, t, false);
        drawFoundationPart(hLeftBarWidthIn, hMiddleBarOffsetIn, widthIn - hLeftBarWidthIn - hRightBarWidthIn, t, true);
        drawFoundationPart(hLeftBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn - t, widthIn - hLeftBarWidthIn - hRightBarWidthIn, t, true);
        drawFoundationPart(widthIn - hRightBarWidthIn, 0, hRightBarWidthIn, t, true);
        drawFoundationPart(widthIn - hRightBarWidthIn, t, hMiddleBarOffsetIn - t, t, false);
        drawFoundationPart(widthIn - hRightBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - t, t, false);
        drawFoundationPart(widthIn - hRightBarWidthIn, lengthIn - t, hRightBarWidthIn, t, true);
        drawFoundationPart(widthIn - t, t, lengthIn - 2 * t, t, false);
      } else if (foundationShape === 't-shape') {
        const stemX = (tTopWidthIn - tStemWidthIn) / 2;
        drawFoundationPart(0, 0, tTopWidthIn, t, true);
        drawFoundationPart(tTopWidthIn - t, t, tTopLengthIn - 2 * t, t, false);
        drawFoundationPart(stemX + tStemWidthIn, tTopLengthIn - t, tTopWidthIn - (stemX + tStemWidthIn), t, true);
        drawFoundationPart(0, tTopLengthIn - t, stemX, t, true);
        drawFoundationPart(0, t, tTopLengthIn - 2 * t, t, false);
        drawFoundationPart(stemX, tTopLengthIn, tStemLengthIn - t, t, false);
        drawFoundationPart(stemX + tStemWidthIn - t, tTopLengthIn, tStemLengthIn - t, t, false);
        drawFoundationPart(stemX, tTopLengthIn + tStemLengthIn - t, tStemWidthIn, t, true);
      } else if (foundationShape === 'custom') {
        const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
        blocksToUse.forEach(block => {
          drawFoundationPart(block.x, block.y, block.w, block.h, true);
        });
      }
      
      // Custom walls foundation
      exteriorWalls.forEach(wall => {
        let x = wall.xFt * 12 + wall.xInches;
        let z = wall.yFt * 12 + wall.yInches;
        let len = wall.lengthFt * 12 + wall.lengthInches;
        const isHorizontal = wall.orientation === 'horizontal';

        // Handle negative lengths (same as wall rendering)
        if (isHorizontal && len < 0) { x += len; len = Math.abs(len); }
        else if (!isHorizontal && len < 0) { z += len; len = Math.abs(len); }

        // Account for exteriorSide offset (same adjustment as wall rendering)
        if (isHorizontal && wall.exteriorSide === 1) z -= wall.thicknessIn;
        else if (!isHorizontal && wall.exteriorSide === 1) x -= wall.thicknessIn;

        drawFoundationPart(x, z, len, wall.thicknessIn, isHorizontal);
      });
    }

    // Additional foundation for custom walls (for both stem-wall and slab types)
    // We already handled exteriorWalls inside stem-wall block for stem-wall specific parts,
    // but for slab it was missing. Let's make it consistent.
    if (foundationType === 'slab' || foundationType === 'slab-on-grade') {
      exteriorWalls.forEach(wall => {
        let x = wall.xFt * 12 + wall.xInches;
        let z = wall.yFt * 12 + wall.yInches;
        let len = wall.lengthFt * 12 + wall.lengthInches;
        const isHorizontal = wall.orientation === 'horizontal';

        // Handle negative lengths (same as wall rendering)
        if (isHorizontal && len < 0) { x += len; len = Math.abs(len); }
        else if (!isHorizontal && len < 0) { z += len; len = Math.abs(len); }

        // Account for exteriorSide offset (same adjustment as wall rendering)
        if (isHorizontal && wall.exteriorSide === 1) z -= wall.thicknessIn;
        else if (!isHorizontal && wall.exteriorSide === 1) x -= wall.thicknessIn;

        drawFoundationPart(x, z, len, wall.thicknessIn, isHorizontal);
      });
    }

    // Interior walls foundation
    interiorWalls.forEach(wall => {
      const x = wall.xFt * 12 + wall.xInches;
      const z = wall.yFt * 12 + wall.yInches;
      const len = wall.lengthFt * 12 + wall.lengthInches;
      drawFoundationPart(x, z, len, wall.thicknessIn, wall.orientation === 'horizontal');
    });

    // Bumpouts Foundation
    bumpouts.forEach(b => {
      const wallId = b.wall;
      const extWallList: { id: number, x: number, y: number, w: number, h: number, isHorizontal: boolean, exteriorSide: 1 | -1 }[] = [];
      if (shape === 'rectangle') {
        extWallList.push({ id: 1, x: 0, y: 0, w: widthIn, h: t, isHorizontal: true, exteriorSide: -1 });
        extWallList.push({ id: 3, x: 0, y: lengthIn - t, w: widthIn, h: t, isHorizontal: true, exteriorSide: 1 });
        extWallList.push({ id: 4, x: 0, y: t, w: t, h: lengthIn - 2 * t, isHorizontal: false, exteriorSide: -1 });
        extWallList.push({ id: 2, x: widthIn - t, y: t, w: t, h: lengthIn - 2 * t, isHorizontal: false, exteriorSide: 1 });
      } else if (shape === 'l-shape') {
        extWallList.push({ id: 1, x: 0, y: 0, w: widthIn, h: t, isHorizontal: true, exteriorSide: -1 });
        extWallList.push({ id: 2, x: widthIn - t, y: t, w: t, h: lRightDepthIn - t, isHorizontal: false, exteriorSide: 1 });
        extWallList.push({ id: 3, x: lBackWidthIn, y: lRightDepthIn - t, w: widthIn - lBackWidthIn - t, h: t, isHorizontal: true, exteriorSide: 1 });
        extWallList.push({ id: 4, x: lBackWidthIn, y: lRightDepthIn, w: t, h: lengthIn - lRightDepthIn - t, isHorizontal: false, exteriorSide: 1 });
        extWallList.push({ id: 5, x: 0, y: lengthIn - t, w: lBackWidthIn + t, h: t, isHorizontal: true, exteriorSide: 1 });
        extWallList.push({ id: 6, x: 0, y: t, w: t, h: lengthIn - 2 * t, isHorizontal: false, exteriorSide: -1 });
      } else if (shape === 'u-shape') {
        extWallList.push({ id: 1, x: 0, y: 0, w: uWallsIn.w1, h: t, isHorizontal: true, exteriorSide: -1 });
        extWallList.push({ id: 2, x: uWallsIn.w1 - t, y: t, w: t, h: uWallsIn.w2 - t, isHorizontal: false, exteriorSide: 1 });
        extWallList.push({ id: 3, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - t, w: uWallsIn.w3 - t, h: t, isHorizontal: true, exteriorSide: 1 });
        extWallList.push({ id: 4, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - uWallsIn.w4, w: t, h: uWallsIn.w4 - t, isHorizontal: false, exteriorSide: 1 });
        extWallList.push({ id: 5, x: uWallsIn.w7 - t, y: uWallsIn.w2 - uWallsIn.w4 - t, w: uWallsIn.w5 + 2 * t, h: t, isHorizontal: true, exteriorSide: -1 });
        extWallList.push({ id: 6, x: uWallsIn.w7 - t, y: uWallsIn.w8 - uWallsIn.w6, w: t, h: uWallsIn.w6 - t, isHorizontal: false, exteriorSide: -1 });
        extWallList.push({ id: 7, x: 0, y: uWallsIn.w8 - t, w: uWallsIn.w7, h: t, isHorizontal: true, exteriorSide: 1 });
        extWallList.push({ id: 8, x: 0, y: t, w: t, h: uWallsIn.w8 - 2 * t, isHorizontal: false, exteriorSide: -1 });
      }
      
      exteriorWalls.forEach(wall => {
        const x = wall.xFt * 12 + wall.xInches;
        const y = wall.yFt * 12 + wall.yInches;
        const len = wall.lengthFt * 12 + wall.lengthInches;
        const isHorizontal = wall.orientation === 'horizontal';
        
        let w = isHorizontal ? len : wall.thicknessIn;
        let h = isHorizontal ? wall.thicknessIn : len;
        let finalX = x;
        let finalY = y;

        if (w < 0) {
          finalX += w;
          w = Math.abs(w);
        }
        if (h < 0) {
          finalY += h;
          h = Math.abs(h);
        }

        if (isHorizontal) {
          if (wall.exteriorSide === 1) finalY -= wall.thicknessIn;
        } else {
          if (wall.exteriorSide === 1) finalX -= wall.thicknessIn;
        }

        extWallList.push({
          id: wall.id,
          x: finalX,
          y: finalY,
          w,
          h,
          isHorizontal,
          exteriorSide: wall.exteriorSide
        });
      });

      const extWall = extWallList.find(w => w.id === wallId);
      if (!extWall) return;

      const bx = b.xFt * 12 + b.xInches;
      const bw = b.widthIn;
      const bd = b.depthIn;
      const isHorizontal = extWall.isHorizontal;
      const wallX = extWall.x;
      const wallY = extWall.y;

      if (foundationType === 'slab' || foundationType === 'slab-on-grade') {
        const slab_h = slabThicknessIn;
        if (isHorizontal) {
          const sy = extWall.exteriorSide === 1 ? wallY : wallY - bd + t;
          parts.push({ x: wallX + bx, y: 0, z: sy, w: bw, h: slab_h, d: bd, color: "#a1a1aa" });
          
          if (foundationType === 'slab-on-grade') {
            const edge_d = thickenedEdgeDepthIn;
            const edge_w = 12;
            const edge_y = sy + (bd - edge_w) / 2.0;
            parts.push({ x: wallX + bx, y: -edge_d + slab_h, z: edge_y, w: bw, h: edge_d - slab_h, d: edge_w, color: "#71717a" });
          }
        } else {
          const sx = extWall.exteriorSide === 1 ? wallX : wallX - bd + t;
          parts.push({ x: sx, y: 0, z: wallY + bx, w: bd, h: slab_h, d: bw, color: "#a1a1aa" });
          
          if (foundationType === 'slab-on-grade') {
            const edge_d = thickenedEdgeDepthIn;
            const edge_w = 12;
            const edge_x = sx + (bd - edge_w) / 2.0;
            parts.push({ x: edge_x, y: -edge_d + slab_h, z: wallY + bx, w: edge_w, h: edge_d - slab_h, d: bw, color: "#71717a" });
          }
        }
      } else {
        if (isHorizontal) {
          const sy = extWall.exteriorSide === 1 ? wallY : wallY - bd + t;
          drawFoundationPart(wallX + bx, sy, t, bd, false);
          drawFoundationPart(wallX + bx + bw - t, sy, t, bd, false);
          drawFoundationPart(wallX + bx, wallY + extWall.exteriorSide * (bd - t), bw, t, true);
        } else {
          const sx = extWall.exteriorSide === 1 ? wallX : wallX - bd + t;
          drawFoundationPart(sx, wallY + bx, bd, t, true);
          drawFoundationPart(sx, wallY + bx + bw - t, bd, t, true);
          drawFoundationPart(wallX + extWall.exteriorSide * (bd - t), wallY + bx, t, bw, false);
        }
      }
    });

    // Main Slab
    if (foundationType === 'slab' || foundationType === 'slab-on-grade') {
      const slab_h = slabThicknessIn;
      if (foundationShape === 'rectangle') {
        parts.push({ x: 0, y: 0, z: 0, w: widthIn, h: slab_h, d: lengthIn, color: "#a1a1aa" });
      } else if (foundationShape === 'l-shape') {
        // L-shape slab as 2 boxes
        parts.push({ x: 0, y: 0, z: 0, w: widthIn, h: slab_h, d: lRightDepthIn, color: "#a1a1aa" });
        parts.push({ x: 0, y: 0, z: lRightDepthIn, w: lBackWidthIn, h: slab_h, d: lengthIn - lRightDepthIn, color: "#a1a1aa" });
      } else if (foundationShape === 'u-shape') {
        // U-shape slab as 3 boxes
        parts.push({ x: 0, y: 0, z: 0, w: uWallsIn.w7, h: slab_h, d: uWallsIn.w8, color: "#a1a1aa" }); // Left leg
        parts.push({ x: uWallsIn.w1 - uWallsIn.w3, y: 0, z: 0, w: uWallsIn.w3, h: slab_h, d: uWallsIn.w2, color: "#a1a1aa" }); // Right leg
        parts.push({ x: uWallsIn.w7, y: 0, z: 0, w: uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7, h: slab_h, d: uWallsIn.w2 - uWallsIn.w4, color: "#a1a1aa" }); // Bridge
      } else if (foundationShape === 'h-shape') {
        parts.push({ x: 0, y: 0, z: 0, w: hLeftBarWidthIn, h: slab_h, d: lengthIn, color: "#a1a1aa" });
        parts.push({ x: hLeftBarWidthIn, y: 0, z: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: slab_h, d: hMiddleBarHeightIn, color: "#a1a1aa" });
        parts.push({ x: widthIn - hRightBarWidthIn, y: 0, z: 0, w: hRightBarWidthIn, h: slab_h, d: lengthIn, color: "#a1a1aa" });
      } else if (foundationShape === 't-shape') {
        const stemX = (tTopWidthIn - tStemWidthIn) / 2;
        parts.push({ x: 0, y: 0, z: 0, w: tTopWidthIn, h: slab_h, d: tTopLengthIn, color: "#a1a1aa" });
        parts.push({ x: stemX, y: 0, z: tTopLengthIn, w: tStemWidthIn, h: slab_h, d: tStemLengthIn, color: "#a1a1aa" });
      } else if (foundationShape === 'custom') {
        const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
        if (blocksToUse && blocksToUse.length > 0) {
          blocksToUse.forEach(block => {
            parts.push({ x: block.x, y: 0, z: block.y, w: block.w, h: slab_h, d: block.h, color: "#a1a1aa" });
          });
        } else if (exteriorWalls.length > 0) {
          // Derive slab footprint from exterior walls using a grid-fill approach
          const wallRects = exteriorWalls.map(w => {
            let x = w.xFt * 12 + w.xInches;
            let z = w.yFt * 12 + w.yInches;
            let len = w.lengthFt * 12 + w.lengthInches;
            const isH = w.orientation === 'horizontal';
            let rw = isH ? len : w.thicknessIn;
            let rd = isH ? w.thicknessIn : len;
            if (rw < 0) { x += rw; rw = Math.abs(rw); }
            if (rd < 0) { z += rd; rd = Math.abs(rd); }
            if (isH && w.exteriorSide === 1) z -= w.thicknessIn;
            else if (!isH && w.exteriorSide === 1) x -= w.thicknessIn;
            return { x, z, w: rw, d: rd };
          });
          // Collect unique X and Y breakpoints
          const xSet = new Set<number>();
          const zSet = new Set<number>();
          wallRects.forEach(r => { xSet.add(r.x); xSet.add(r.x + r.w); zSet.add(r.z); zSet.add(r.z + r.d); });
          const xs = [...xSet].sort((a, b) => a - b);
          const zs = [...zSet].sort((a, b) => a - b);
          if (xs.length >= 2 && zs.length >= 2) {
            // Build grid and mark cells that overlap with any wall
            const grid: boolean[][] = Array.from({ length: xs.length - 1 }, () => Array(zs.length - 1).fill(false));
            for (let i = 0; i < xs.length - 1; i++) {
              for (let j = 0; j < zs.length - 1; j++) {
                const cx = (xs[i] + xs[i + 1]) / 2;
                const cz = (zs[j] + zs[j + 1]) / 2;
                if (wallRects.some(r => cx >= r.x && cx <= r.x + r.w && cz >= r.z && cz <= r.z + r.d)) {
                  grid[i][j] = true;
                }
              }
            }
            // Flood-fill interior: find cells bounded by wall cells on all sides
            // Simple approach: fill any cell whose row has walls on both left and right
            for (let j = 0; j < zs.length - 1; j++) {
              let leftWall = -1;
              for (let i = 0; i < xs.length - 1; i++) {
                if (grid[i][j]) {
                  if (leftWall >= 0) {
                    // Fill all cells between leftWall and current wall
                    for (let k = leftWall; k <= i; k++) {
                      grid[k][j] = true;
                    }
                  }
                  leftWall = i;
                }
              }
            }
            // Also fill vertically: any cell with walls above and below
            for (let i = 0; i < xs.length - 1; i++) {
              let topWall = -1;
              for (let j = 0; j < zs.length - 1; j++) {
                if (grid[i][j]) {
                  if (topWall >= 0) {
                    for (let k = topWall; k <= j; k++) {
                      grid[i][k] = true;
                    }
                  }
                  topWall = j;
                }
              }
            }
            // Emit filled cells as slab parts
            for (let i = 0; i < xs.length - 1; i++) {
              for (let j = 0; j < zs.length - 1; j++) {
                if (grid[i][j]) {
                  const cellW = xs[i + 1] - xs[i];
                  const cellD = zs[j + 1] - zs[j];
                  if (cellW > 0.01 && cellD > 0.01) {
                    parts.push({ x: xs[i], y: 0, z: zs[j], w: cellW, h: slab_h, d: cellD, color: "#a1a1aa" });
                  }
                }
              }
            }
          }
        }
      }
    }

    return parts;
  }, [foundationType, foundationShape, stemWallHeightIn, stemWallThicknessIn, footingWidthIn, footingThicknessIn, slabThicknessIn, thickenedEdgeDepthIn, widthIn, lengthIn, thicknessIn, lRightDepthIn, lBackWidthIn, uWallsIn, hLeftBarWidthIn, hRightBarWidthIn, hMiddleBarHeightIn, hMiddleBarOffsetIn, tTopWidthIn, tTopLengthIn, tStemWidthIn, tStemLengthIn, exteriorWalls, bumpouts, shape, interiorWalls, combinedBlocks, shapeBlocks, currentFloorIndex]);

  const openings = useMemo(() => {
    const list: { x: number, y: number, z: number, w: number, h: number, d: number }[] = [];
    
    const calculateOpeningsForStory = (currentY: number, currentWallHeight: number, floorIndex: number) => {
      const extWalls: { id: number, x: number, y: number, w: number, h: number, isHorizontal: boolean }[] = [];

      exteriorWalls.filter(w => (w.floorIndex || 0) === floorIndex).forEach(w => {
        const x = w.xFt * 12 + w.xInches;
        const y = w.yFt * 12 + w.yInches;
        const len = w.lengthFt * 12 + w.lengthInches;
        const isHorizontal = w.orientation === 'horizontal';
        
        let width = isHorizontal ? len : w.thicknessIn;
        let depth = isHorizontal ? w.thicknessIn : len;
        let finalX = x;
        let finalY = y;

        if (width < 0) {
          finalX += width;
          width = Math.abs(width);
        }
        if (depth < 0) {
          finalY += depth;
          depth = Math.abs(depth);
        }

        if (isHorizontal) {
          if (w.exteriorSide === 1) finalY -= w.thicknessIn;
        } else {
          if (w.exteriorSide === 1) finalX -= w.thicknessIn;
        }

        extWalls.push({
          id: w.id,
          x: finalX,
          y: finalY,
          w: width,
          h: depth,
          isHorizontal
        });
      });

      if (shape === 'rectangle') {
        extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: 0, y: lengthIn - thicknessIn, w: widthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 4, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
      } else if (shape === 'l-shape') {
        extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lRightDepthIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: lBackWidthIn, y: lRightDepthIn - thicknessIn, w: widthIn - lBackWidthIn - thicknessIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 4, x: lBackWidthIn, y: lRightDepthIn, w: thicknessIn, h: lengthIn - lRightDepthIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 5, x: 0, y: lengthIn - thicknessIn, w: lBackWidthIn + thicknessIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 6, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });

        if (lDirection === 'front-right' || lDirection === 'back-right') {
          extWalls.forEach(w => w.x = widthIn - w.x - w.w);
        }
        if (lDirection === 'back-left' || lDirection === 'back-right') {
          extWalls.forEach(w => w.y = lengthIn - w.y - w.h);
        }
      } else if (shape === 'u-shape') {
        extWalls.push({ id: 1, x: 0, y: 0, w: uWallsIn.w1, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: uWallsIn.w1 - thicknessIn, y: thicknessIn, w: thicknessIn, h: uWallsIn.w2 - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - thicknessIn, w: uWallsIn.w3 - thicknessIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 4, x: uWallsIn.w1 - uWallsIn.w3, y: uWallsIn.w2 - uWallsIn.w4, w: thicknessIn, h: uWallsIn.w4 - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 5, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w2 - uWallsIn.w4 - thicknessIn, w: uWallsIn.w5 + 2 * thicknessIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 6, x: uWallsIn.w7 - thicknessIn, y: uWallsIn.w8 - uWallsIn.w6, w: thicknessIn, h: uWallsIn.w6 - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 7, x: 0, y: uWallsIn.w8 - thicknessIn, w: uWallsIn.w7, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 8, x: 0, y: thicknessIn, w: thicknessIn, h: uWallsIn.w8 - 2 * thicknessIn, isHorizontal: false });
      } else if (shape === 'h-shape') {
        extWalls.push({ id: 1, x: 0, y: 0, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: hLeftBarWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: hLeftBarWidthIn - thicknessIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 4, x: 0, y: lengthIn - thicknessIn, w: hLeftBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
        extWalls.push({ id: 6, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 7, x: hLeftBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn - thicknessIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 8, x: widthIn - hRightBarWidthIn, y: 0, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 9, x: widthIn - hRightBarWidthIn, y: thicknessIn, w: thicknessIn, h: hMiddleBarOffsetIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 10, x: widthIn - hRightBarWidthIn, y: hMiddleBarOffsetIn + hMiddleBarHeightIn, w: thicknessIn, h: lengthIn - (hMiddleBarOffsetIn + hMiddleBarHeightIn) - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 11, x: widthIn - hRightBarWidthIn, y: lengthIn - thicknessIn, w: hRightBarWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 12, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
      } else if (shape === 't-shape') {
        const stemX = (tTopWidthIn - tStemWidthIn) / 2;
        extWalls.push({ id: 1, x: 0, y: 0, w: tTopWidthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: tTopWidthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: stemX + tStemWidthIn, y: tTopLengthIn - thicknessIn, w: tTopWidthIn - (stemX + tStemWidthIn), h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 4, x: 0, y: tTopLengthIn - thicknessIn, w: stemX, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 5, x: 0, y: thicknessIn, w: thicknessIn, h: tTopLengthIn - 2 * thicknessIn, isHorizontal: false });
        extWalls.push({ id: 6, x: stemX, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 7, x: stemX + tStemWidthIn - thicknessIn, y: tTopLengthIn, w: thicknessIn, h: tStemLengthIn - thicknessIn, isHorizontal: false });
        extWalls.push({ id: 8, x: stemX, y: tTopLengthIn + tStemLengthIn - thicknessIn, w: tStemWidthIn, h: thicknessIn, isHorizontal: true });
      }

      doors.filter(d => (d.floorIndex || 0) === floorIndex).forEach(d => {
        const extWall = extWalls.find(w => w.id === d.wall);
        const intWall = interiorWalls.find(w => w.id === d.wall && (w.floorIndex || 0) === floorIndex);
        
        const ox = d.xFt * 12 + d.xInches;
        
        if (extWall) {
          if (extWall.isHorizontal) {
            list.push({ x: extWall.x + ox, y: currentY, z: extWall.y - 1, w: d.widthIn, h: d.heightIn, d: thicknessIn + 2 });
          } else {
            list.push({ x: extWall.x - 1, y: currentY, z: extWall.y + ox, w: thicknessIn + 2, h: d.heightIn, d: d.widthIn });
          }
        } else if (intWall) {
          const ix = intWall.xFt * 12 + intWall.xInches;
          const iy = intWall.yFt * 12 + intWall.yInches;
          if (intWall.orientation === 'horizontal') {
            list.push({ x: ix + ox, y: currentY, z: iy - 1, w: d.widthIn, h: d.heightIn, d: intWall.thicknessIn + 2 });
          } else {
            list.push({ x: ix - 1, y: currentY, z: iy + ox, w: intWall.thicknessIn + 2, h: d.heightIn, d: d.widthIn });
          }
        }
      });

      windows.filter(w => (w.floorIndex || 0) === floorIndex).forEach(w => {
        const extWall = extWalls.find(wall => wall.id === w.wall);
        const intWall = interiorWalls.find(wall => wall.id === w.wall && (wall.floorIndex || 0) === floorIndex);
        
        const ox = w.xFt * 12 + w.xInches;

        if (extWall) {
          if (extWall.isHorizontal) {
            list.push({ x: extWall.x + ox, y: currentY + w.sillHeightIn, z: extWall.y - 1, w: w.widthIn, h: w.heightIn, d: thicknessIn + 2 });
          } else {
            list.push({ x: extWall.x - 1, y: currentY + w.sillHeightIn, z: extWall.y + ox, w: thicknessIn + 2, h: w.heightIn, d: w.widthIn });
          }
        } else if (intWall) {
          const ix = intWall.xFt * 12 + intWall.xInches;
          const iy = intWall.yFt * 12 + intWall.yInches;
          if (intWall.orientation === 'horizontal') {
            list.push({ x: ix + ox, y: currentY + w.sillHeightIn, z: iy - 1, w: w.widthIn, h: w.heightIn, d: intWall.thicknessIn + 2 });
          } else {
            list.push({ x: ix - 1, y: currentY + w.sillHeightIn, z: iy + ox, w: intWall.thicknessIn + 2, h: w.heightIn, d: w.widthIn });
          }
        }
      });
    };

    // 1st Floor
    if (currentFloorIndex >= 0) {
      calculateOpeningsForStory(totalBaseHeight, wallHeightIn, 0);
    }

    // Upper Floors
    let currentZ = totalBaseHeight + wallHeightIn;
    for (let i = 0; i < additionalStories; i++) {
      const upperJoistH = upperFloorJoistSize === '2x6' ? 5.5 : upperFloorJoistSize === '2x8' ? 7.25 : upperFloorJoistSize === '2x10' ? 9.25 : 11.25;
      const upperFloorSystemH = upperJoistH + (addSubfloor ? subfloorThickness : 0);
      currentZ += upperFloorSystemH;
      if (currentFloorIndex >= i + 1) {
        calculateOpeningsForStory(currentZ, upperFloorWallHeightIn, i + 1);
      }
      currentZ += upperFloorWallHeightIn;
    }

    return list;
  }, [doors, windows, exteriorWalls, interiorWalls, shape, widthIn, lengthIn, thicknessIn, uWallsIn, lRightDepthIn, lBackWidthIn, totalBaseHeight, wallHeightIn, additionalStories, upperFloorWallHeightIn, upperFloorJoistSize, addSubfloor, subfloorThickness, currentFloorIndex]);

  // Compute 3D positions for linked door/window models
  const openingModels = useMemo(() => {
    const models: { id: string; modelUrl: string; x: number; y: number; z: number; w: number; h: number; d: number; isHorizontal: boolean }[] = [];

    const calcForStory = (currentY: number, floorIndex: number) => {
      const extWalls: { id: number, x: number, y: number, w: number, h: number, isHorizontal: boolean }[] = [];

      exteriorWalls.filter(w => (w.floorIndex || 0) === floorIndex).forEach(w => {
        const x = w.xFt * 12 + w.xInches;
        const y = w.yFt * 12 + w.yInches;
        const len = w.lengthFt * 12 + w.lengthInches;
        const isHorizontal = w.orientation === 'horizontal';
        let width = isHorizontal ? len : w.thicknessIn;
        let depth = isHorizontal ? w.thicknessIn : len;
        let finalX = x; let finalY = y;
        if (width < 0) { finalX += width; width = Math.abs(width); }
        if (depth < 0) { finalY += depth; depth = Math.abs(depth); }
        extWalls.push({ id: w.id, x: finalX, y: finalY, w: width, h: depth, isHorizontal });
      });

      if (shape === 'rectangle') {
        extWalls.push({ id: 1, x: 0, y: 0, w: widthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 2, x: widthIn - thicknessIn, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
        extWalls.push({ id: 3, x: 0, y: lengthIn - thicknessIn, w: widthIn, h: thicknessIn, isHorizontal: true });
        extWalls.push({ id: 4, x: 0, y: thicknessIn, w: thicknessIn, h: lengthIn - 2 * thicknessIn, isHorizontal: false });
      }
      // Note: Other shapes (l-shape, u-shape, etc.) already handled by exteriorWalls entries above

      // Doors with linked models
      doors.filter(d => (d.floorIndex || 0) === floorIndex && d.modelUrl).forEach(d => {
        const extWall = extWalls.find(w => w.id === d.wall);
        const intWall = interiorWalls.find(w => w.id === d.wall && (w.floorIndex || 0) === floorIndex);
        const ox = d.xFt * 12 + d.xInches;

        if (extWall) {
          if (extWall.isHorizontal) {
            models.push({ id: d.id, modelUrl: d.modelUrl!, x: extWall.x + ox, y: currentY, z: extWall.y, w: d.widthIn, h: d.heightIn, d: thicknessIn, isHorizontal: true });
          } else {
            models.push({ id: d.id, modelUrl: d.modelUrl!, x: extWall.x, y: currentY, z: extWall.y + ox, w: thicknessIn, h: d.heightIn, d: d.widthIn, isHorizontal: false });
          }
        } else if (intWall) {
          const ix = intWall.xFt * 12 + intWall.xInches;
          const iy = intWall.yFt * 12 + intWall.yInches;
          if (intWall.orientation === 'horizontal') {
            models.push({ id: d.id, modelUrl: d.modelUrl!, x: ix + ox, y: currentY, z: iy, w: d.widthIn, h: d.heightIn, d: intWall.thicknessIn, isHorizontal: true });
          } else {
            models.push({ id: d.id, modelUrl: d.modelUrl!, x: ix, y: currentY, z: iy + ox, w: intWall.thicknessIn, h: d.heightIn, d: d.widthIn, isHorizontal: false });
          }
        }
      });

      // Windows with linked models
      windows.filter(w => (w.floorIndex || 0) === floorIndex && w.modelUrl).forEach(w => {
        const extWall = extWalls.find(wall => wall.id === w.wall);
        const intWall = interiorWalls.find(wall => wall.id === w.wall && (wall.floorIndex || 0) === floorIndex);
        const ox = w.xFt * 12 + w.xInches;

        if (extWall) {
          if (extWall.isHorizontal) {
            models.push({ id: w.id, modelUrl: w.modelUrl!, x: extWall.x + ox, y: currentY + w.sillHeightIn, z: extWall.y, w: w.widthIn, h: w.heightIn, d: thicknessIn, isHorizontal: true });
          } else {
            models.push({ id: w.id, modelUrl: w.modelUrl!, x: extWall.x, y: currentY + w.sillHeightIn, z: extWall.y + ox, w: thicknessIn, h: w.heightIn, d: w.widthIn, isHorizontal: false });
          }
        } else if (intWall) {
          const ix = intWall.xFt * 12 + intWall.xInches;
          const iy = intWall.yFt * 12 + intWall.yInches;
          if (intWall.orientation === 'horizontal') {
            models.push({ id: w.id, modelUrl: w.modelUrl!, x: ix + ox, y: currentY + w.sillHeightIn, z: iy, w: w.widthIn, h: w.heightIn, d: intWall.thicknessIn, isHorizontal: true });
          } else {
            models.push({ id: w.id, modelUrl: w.modelUrl!, x: ix, y: currentY + w.sillHeightIn, z: iy + ox, w: intWall.thicknessIn, h: w.heightIn, d: w.widthIn, isHorizontal: false });
          }
        }
      });
    };

    if (currentFloorIndex >= 0) calcForStory(totalBaseHeight, 0);
    let currentZ = totalBaseHeight + wallHeightIn;
    for (let i = 0; i < additionalStories; i++) {
      const upperJoistH = upperFloorJoistSize === '2x6' ? 5.5 : upperFloorJoistSize === '2x8' ? 7.25 : upperFloorJoistSize === '2x10' ? 9.25 : 11.25;
      currentZ += upperJoistH + (addSubfloor ? subfloorThickness : 0);
      if (currentFloorIndex >= i + 1) calcForStory(currentZ, i + 1);
      currentZ += upperFloorWallHeightIn;
    }

    return models;
  }, [doors, windows, exteriorWalls, interiorWalls, shape, widthIn, lengthIn, thicknessIn, totalBaseHeight, wallHeightIn, additionalStories, upperFloorWallHeightIn, upperFloorJoistSize, addSubfloor, subfloorThickness, currentFloorIndex]);

  const floorSystem = useMemo(() => {
    const parts: { x: number, y: number, z: number, w: number, h: number, d: number, color?: string }[] = [];
    
    const addFloorForStory = (currentY: number, currentJoistSize: string) => {
      // For slab/slab-on-grade first floor, skip the wood floor system — the concrete slab IS the floor
      if ((foundationType === 'slab' || foundationType === 'slab-on-grade') && currentY <= foundationHeight) return;
      if (!addFloorFraming && !noFramingFloorOnly) return;
      
      const joistH = currentJoistSize === '2x6' ? 5.5 : currentJoistSize === '2x8' ? 7.25 : currentJoistSize === '2x10' ? 9.25 : 11.25;
      const t = 1.5;
      const rt = rimJoistThickness; // Rim joist thickness from props

      if (noFramingFloorOnly) {
        const floorColor = "#d4d4d8";
        if (shape === 'rectangle') {
          parts.push({ x: 0, y: currentY, z: 0, w: widthIn, h: joistH, d: lengthIn, color: floorColor });
        } else if (shape === 'l-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: widthIn, h: joistH, d: lRightDepthIn, color: floorColor });
          parts.push({ x: 0, y: currentY, z: lRightDepthIn, w: lBackWidthIn, h: joistH, d: lengthIn - lRightDepthIn, color: floorColor });
        } else if (shape === 'u-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: uWallsIn.w7, h: joistH, d: uWallsIn.w8, color: floorColor });
          parts.push({ x: uWallsIn.w1 - uWallsIn.w3, y: currentY, z: 0, w: uWallsIn.w3, h: joistH, d: uWallsIn.w2, color: floorColor });
          parts.push({ x: uWallsIn.w7, y: currentY, z: 0, w: uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7, h: joistH, d: uWallsIn.w2 - uWallsIn.w4, color: floorColor });
        } else if (shape === 'h-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: hLeftBarWidthIn, h: joistH, d: lengthIn, color: floorColor });
          parts.push({ x: hLeftBarWidthIn, y: currentY, z: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: joistH, d: hMiddleBarHeightIn, color: floorColor });
          parts.push({ x: widthIn - hRightBarWidthIn, y: currentY, z: 0, w: hRightBarWidthIn, h: joistH, d: lengthIn, color: floorColor });
        } else if (shape === 't-shape') {
          const stemX = (tTopWidthIn - tStemWidthIn) / 2;
          parts.push({ x: 0, y: currentY, z: 0, w: tTopWidthIn, h: joistH, d: tTopLengthIn, color: floorColor });
          parts.push({ x: stemX, y: currentY, z: tTopLengthIn, w: tStemWidthIn, h: joistH, d: tStemLengthIn, color: floorColor });
        } else if (shape === 'custom') {
          const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
          if (blocksToUse && blocksToUse.length > 0) {
            blocksToUse.forEach(block => {
              parts.push({ x: block.x, y: currentY, z: block.y, w: block.w, h: joistH, d: block.h, color: floorColor });
            });
          } else if (exteriorWalls.length > 0) {
            // Derive floor footprint from exterior walls using grid-fill
            const wallRects = exteriorWalls.map(w => {
              let x = w.xFt * 12 + w.xInches;
              let z = w.yFt * 12 + w.yInches;
              let len = w.lengthFt * 12 + w.lengthInches;
              const isH = w.orientation === 'horizontal';
              let rw = isH ? len : w.thicknessIn;
              let rd = isH ? w.thicknessIn : len;
              if (rw < 0) { x += rw; rw = Math.abs(rw); }
              if (rd < 0) { z += rd; rd = Math.abs(rd); }
              if (isH && w.exteriorSide === 1) z -= w.thicknessIn;
              else if (!isH && w.exteriorSide === 1) x -= w.thicknessIn;
              return { x, z, w: rw, d: rd };
            });
            const xSet = new Set<number>();
            const zSet = new Set<number>();
            wallRects.forEach(r => { xSet.add(r.x); xSet.add(r.x + r.w); zSet.add(r.z); zSet.add(r.z + r.d); });
            const xs = [...xSet].sort((a, b) => a - b);
            const zs = [...zSet].sort((a, b) => a - b);
            if (xs.length >= 2 && zs.length >= 2) {
              const grid: boolean[][] = Array.from({ length: xs.length - 1 }, () => Array(zs.length - 1).fill(false));
              for (let i = 0; i < xs.length - 1; i++) {
                for (let j = 0; j < zs.length - 1; j++) {
                  const cx = (xs[i] + xs[i + 1]) / 2;
                  const cz = (zs[j] + zs[j + 1]) / 2;
                  if (wallRects.some(r => cx >= r.x && cx <= r.x + r.w && cz >= r.z && cz <= r.z + r.d)) grid[i][j] = true;
                }
              }
              for (let j = 0; j < zs.length - 1; j++) {
                let leftWall = -1;
                for (let i = 0; i < xs.length - 1; i++) {
                  if (grid[i][j]) { if (leftWall >= 0) for (let k = leftWall; k <= i; k++) grid[k][j] = true; leftWall = i; }
                }
              }
              for (let i = 0; i < xs.length - 1; i++) {
                let topWall = -1;
                for (let j = 0; j < zs.length - 1; j++) {
                  if (grid[i][j]) { if (topWall >= 0) for (let k = topWall; k <= j; k++) grid[i][k] = true; topWall = j; }
                }
              }
              for (let i = 0; i < xs.length - 1; i++) {
                for (let j = 0; j < zs.length - 1; j++) {
                  if (grid[i][j]) {
                    const cellW = xs[i + 1] - xs[i];
                    const cellD = zs[j + 1] - zs[j];
                    if (cellW > 0.01 && cellD > 0.01) {
                      parts.push({ x: xs[i], y: currentY, z: zs[j], w: cellW, h: joistH, d: cellD, color: floorColor });
                    }
                  }
                }
              }
            }
          }
        }
      } else if (floorBays && floorBays.length > 0) {
        // ── Per-bay joist rendering ──
        const joistH = currentJoistSize === '2x6' ? 5.5 : currentJoistSize === '2x8' ? 7.25 : currentJoistSize === '2x10' ? 9.25 : 11.25;
        const t_joist = 1.5;

        floorBays.forEach(bay => {
          const bx = bay.x;
          const bz = bay.y; // bay.y maps to Z in 3D
          const bw = bay.width;
          const bh = bay.height;
          const dir = bay.joistDirection;

          if (dir === 'y') {
            // Joists spaced along Y (X-axis in 3D), each runs along Z
            // Rim joists: front and back of bay
            parts.push({ x: bx, y: currentY, z: bz, w: bw, h: joistH, d: rt, color: "#a1a1aa" });
            parts.push({ x: bx, y: currentY, z: bz + bh - rt, w: bw, h: joistH, d: rt, color: "#a1a1aa" });
            // Individual joists spaced along X
            const numJ = Math.ceil(bw / joistSpacing) + 1;
            for (let i = 0; i < numJ; i++) {
              let jx = bx + i * joistSpacing;
              if (jx + t_joist > bx + bw) jx = bx + bw - t_joist;
              if (jx < bx) jx = bx;
              parts.push({ x: jx, y: currentY, z: bz + rt, w: t_joist, h: joistH, d: bh - 2 * rt, color: "#d4d4d8" });
            }
          } else {
            // Joists spaced along Z, each runs along X
            // Rim joists: left and right of bay
            parts.push({ x: bx, y: currentY, z: bz, w: rt, h: joistH, d: bh, color: "#a1a1aa" });
            parts.push({ x: bx + bw - rt, y: currentY, z: bz, w: rt, h: joistH, d: bh, color: "#a1a1aa" });
            // Individual joists spaced along Z
            const numJ = Math.ceil(bh / joistSpacing) + 1;
            for (let i = 0; i < numJ; i++) {
              let jz = bz + i * joistSpacing;
              if (jz + t_joist > bz + bh) jz = bz + bh - t_joist;
              if (jz < bz) jz = bz;
              parts.push({ x: bx + rt, y: currentY, z: jz, w: bw - 2 * rt, h: joistH, d: t_joist, color: "#d4d4d8" });
            }
          }
        });
      } else if (joistDirection === 'y') {
        // Rim joists (front and back)
        parts.push({ x: 0, y: currentY, z: 0, w: widthIn, h: joistH, d: rt, color: "#a1a1aa" });
        if (shape === 'rectangle') {
          parts.push({ x: 0, y: currentY, z: lengthIn - rt, w: widthIn, h: joistH, d: rt, color: "#a1a1aa" });
        } else if (shape === 'l-shape') {
          parts.push({ x: 0, y: currentY, z: lengthIn - rt, w: lBackWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: lBackWidthIn, y: currentY, z: lRightDepthIn - rt, w: widthIn - lBackWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
        } else if (shape === 'u-shape') {
          parts.push({ x: 0, y: currentY, z: uWallsIn.w8 - rt, w: uWallsIn.w7, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: uWallsIn.w1 - uWallsIn.w3, y: currentY, z: uWallsIn.w2 - rt, w: uWallsIn.w3, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: uWallsIn.w7, y: currentY, z: uWallsIn.w2 - uWallsIn.w4 - rt, w: uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7, h: joistH, d: rt, color: "#a1a1aa" });
        } else if (shape === 'h-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: hLeftBarWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: 0, y: currentY, z: lengthIn - rt, w: hLeftBarWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: widthIn - hRightBarWidthIn, y: currentY, z: 0, w: hRightBarWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: widthIn - hRightBarWidthIn, y: currentY, z: lengthIn - rt, w: hRightBarWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
        } else if (shape === 't-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: tTopWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
          parts.push({ x: (tTopWidthIn - tStemWidthIn) / 2.0, y: currentY, z: tTopLengthIn + tStemLengthIn - rt, w: tStemWidthIn, h: joistH, d: rt, color: "#a1a1aa" });
        } else if (shape === 'custom') {
          const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
          blocksToUse.forEach(block => {
            parts.push({ x: block.x, y: currentY, z: block.y, w: block.w, h: joistH, d: rt, color: "#a1a1aa" });
            parts.push({ x: block.x, y: currentY, z: block.y + block.h - rt, w: block.w, h: joistH, d: rt, color: "#a1a1aa" });
          });
        }

        const limitW = shape === 't-shape' ? tTopWidthIn : widthIn;
        const numJoists = Math.ceil(limitW / joistSpacing) + 1;
        for (let i = 0; i < numJoists; i++) {
          let jx = i * joistSpacing;
          if (jx + t > limitW) jx = limitW - t;
          
          if (shape === 'rectangle') {
            parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: lengthIn - 2 * rt, color: "#d4d4d8" });
          } else if (shape === 'l-shape') {
            const len = jx < lBackWidthIn ? lengthIn : lRightDepthIn;
            parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: len - 2 * rt, color: "#d4d4d8" });
          } else if (shape === 'u-shape') {
            if (jx < uWallsIn.w7) {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: uWallsIn.w8 - 2 * rt, color: "#d4d4d8" });
            } else if (jx < (uWallsIn.w1 - uWallsIn.w3)) {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: uWallsIn.w2 - uWallsIn.w4 - 2 * rt, color: "#d4d4d8" });
            } else {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: uWallsIn.w2 - 2 * rt, color: "#d4d4d8" });
            }
          } else if (shape === 'h-shape') {
            if (jx < hLeftBarWidthIn || jx > (widthIn - hRightBarWidthIn)) {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: lengthIn - 2 * rt, color: "#d4d4d8" });
            } else {
              parts.push({ x: jx, y: currentY, z: hMiddleBarOffsetIn + rt, w: t, h: joistH, d: hMiddleBarHeightIn - 2 * rt, color: "#d4d4d8" });
            }
          } else if (shape === 't-shape') {
            if (jx >= (tTopWidthIn - tStemWidthIn) / 2.0 && jx <= (tTopWidthIn + tStemWidthIn) / 2.0) {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: tTopLengthIn + tStemLengthIn - 2 * rt, color: "#d4d4d8" });
            } else {
              parts.push({ x: jx, y: currentY, z: rt, w: t, h: joistH, d: tTopLengthIn - 2 * rt, color: "#d4d4d8" });
            }
          } else if (shape === 'custom') {
            const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
            blocksToUse.forEach(block => {
              if (jx >= block.x && jx < block.x + block.w) {
                parts.push({ x: jx, y: currentY, z: block.y + rt, w: t, h: joistH, d: block.h - 2 * rt, color: "#d4d4d8" });
              }
            });
          }
        }
      } else {
        // Rim joists (left and right)
        parts.push({ x: 0, y: currentY, z: 0, w: rt, h: joistH, d: lengthIn, color: "#a1a1aa" });
        if (shape === 'rectangle') {
          parts.push({ x: widthIn - rt, y: currentY, z: 0, w: rt, h: joistH, d: lengthIn, color: "#a1a1aa" });
        } else if (shape === 'l-shape') {
          parts.push({ x: widthIn - rt, y: currentY, z: 0, w: rt, h: joistH, d: lRightDepthIn, color: "#a1a1aa" });
          parts.push({ x: lBackWidthIn - rt, y: currentY, z: lRightDepthIn, w: rt, h: joistH, d: lengthIn - lRightDepthIn, color: "#a1a1aa" });
        } else if (shape === 'u-shape') {
          parts.push({ x: uWallsIn.w1 - rt, y: currentY, z: 0, w: rt, h: joistH, d: uWallsIn.w2, color: "#a1a1aa" });
          parts.push({ x: uWallsIn.w7 - rt, y: currentY, z: uWallsIn.w2 - uWallsIn.w4, w: rt, h: joistH, d: uWallsIn.w8 - (uWallsIn.w2 - uWallsIn.w4), color: "#a1a1aa" });
        } else if (shape === 'h-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: rt, h: joistH, d: lengthIn, color: "#a1a1aa" });
          parts.push({ x: widthIn - rt, y: currentY, z: 0, w: rt, h: joistH, d: lengthIn, color: "#a1a1aa" });
          parts.push({ x: hLeftBarWidthIn, y: currentY, z: hMiddleBarOffsetIn, w: rt, h: joistH, d: hMiddleBarHeightIn, color: "#a1a1aa" });
          parts.push({ x: widthIn - hRightBarWidthIn - rt, y: currentY, z: hMiddleBarOffsetIn, w: rt, h: joistH, d: hMiddleBarHeightIn, color: "#a1a1aa" });
        } else if (shape === 't-shape') {
          parts.push({ x: 0, y: currentY, z: 0, w: rt, h: joistH, d: tTopLengthIn, color: "#a1a1aa" });
          parts.push({ x: tTopWidthIn - rt, y: currentY, z: 0, w: rt, h: joistH, d: tTopLengthIn, color: "#a1a1aa" });
          parts.push({ x: (tTopWidthIn - tStemWidthIn) / 2.0, y: currentY, z: tTopLengthIn, w: rt, h: joistH, d: tStemLengthIn, color: "#a1a1aa" });
          parts.push({ x: (tTopWidthIn + tStemWidthIn) / 2.0 - rt, y: currentY, z: tTopLengthIn, w: rt, h: joistH, d: tStemLengthIn, color: "#a1a1aa" });
        } else if (shape === 'custom') {
          // For custom shapes, we use the combinedBlocks to draw the floor system
          const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
          blocksToUse.forEach(block => {
            // Rim joists for each block (simplified)
            parts.push({ x: block.x, y: currentY, z: block.y, w: rt, h: joistH, d: block.h, color: "#a1a1aa" });
            parts.push({ x: block.x + block.w - rt, y: currentY, z: block.y, w: rt, h: joistH, d: block.h, color: "#a1a1aa" });
            parts.push({ x: block.x + rt, y: currentY, z: block.y, w: block.w - 2 * rt, h: joistH, d: rt, color: "#a1a1aa" });
            parts.push({ x: block.x + rt, y: currentY, z: block.y + block.h - rt, w: block.w - 2 * rt, h: joistH, d: rt, color: "#a1a1aa" });
 
            // Joists for each block
            const numJoists = Math.ceil(block.h / joistSpacing) + 1;
            for (let i = 0; i < numJoists; i++) {
              let jz = block.y + i * joistSpacing;
              if (jz + t > block.y + block.h) jz = block.y + block.h - t;
              parts.push({ x: block.x + rt, y: currentY, z: jz, w: block.w - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            }
          });
        }
 
        const limitL = shape === 't-shape' ? (tTopLengthIn + tStemLengthIn) : lengthIn;
        const numJoists = Math.ceil(limitL / joistSpacing) + 1;
        for (let i = 0; i < numJoists; i++) {
          let jz = i * joistSpacing;
          if (jz + t > limitL) jz = limitL - t;
          
          if (shape === 'rectangle') {
            parts.push({ x: rt, y: currentY, z: jz, w: widthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
          } else if (shape === 'l-shape') {
            const wid = jz < lRightDepthIn ? widthIn : lBackWidthIn;
            parts.push({ x: rt, y: currentY, z: jz, w: wid - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
          } else if (shape === 'u-shape') {
            if (jz < (uWallsIn.w2 - uWallsIn.w4)) {
              parts.push({ x: rt, y: currentY, z: jz, w: uWallsIn.w1 - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            } else {
              // Left leg
              parts.push({ x: rt, y: currentY, z: jz, w: uWallsIn.w7 - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
              // Right leg
              parts.push({ x: uWallsIn.w1 - uWallsIn.w3 + rt, y: currentY, z: jz, w: uWallsIn.w3 - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            }
          } else if (shape === 'h-shape') {
            if (jz >= hMiddleBarOffsetIn && jz <= (hMiddleBarOffsetIn + hMiddleBarHeightIn)) {
              parts.push({ x: rt, y: currentY, z: jz, w: widthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            } else {
              // Left bar
              parts.push({ x: rt, y: currentY, z: jz, w: hLeftBarWidthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
              // Right bar
              parts.push({ x: widthIn - hRightBarWidthIn + rt, y: currentY, z: jz, w: hRightBarWidthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            }
          } else if (shape === 't-shape') {
            if (jz < tTopLengthIn) {
              parts.push({ x: rt, y: currentY, z: jz, w: tTopWidthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            } else {
              parts.push({ x: (tTopWidthIn - tStemWidthIn) / 2.0 + rt, y: currentY, z: jz, w: tStemWidthIn - 2 * rt, h: joistH, d: t, color: "#d4d4d8" });
            }
          }
        }
      }

      if (addSubfloor) {
        const sfColor = subfloorMaterial === 'plywood' ? "#deb887" : "#cd853f";
        const sfY = currentY + joistH;
        if (shape === 'rectangle') {
          parts.push({ x: 0, y: sfY, z: 0, w: widthIn, h: subfloorThickness, d: lengthIn, color: sfColor });
        } else if (shape === 'l-shape') {
          parts.push({ x: 0, y: sfY, z: 0, w: widthIn, h: subfloorThickness, d: lRightDepthIn, color: sfColor });
          parts.push({ x: 0, y: sfY, z: lRightDepthIn, w: lBackWidthIn, h: subfloorThickness, d: lengthIn - lRightDepthIn, color: sfColor });
        } else if (shape === 'u-shape') {
          parts.push({ x: 0, y: sfY, z: 0, w: uWallsIn.w7, h: subfloorThickness, d: uWallsIn.w8, color: sfColor });
          parts.push({ x: uWallsIn.w1 - uWallsIn.w3, y: sfY, z: 0, w: uWallsIn.w3, h: subfloorThickness, d: uWallsIn.w2, color: sfColor });
          parts.push({ x: uWallsIn.w7, y: sfY, z: 0, w: uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7, h: subfloorThickness, d: uWallsIn.w2 - uWallsIn.w4, color: sfColor });
        } else if (shape === 'h-shape') {
          parts.push({ x: 0, y: sfY, z: 0, w: hLeftBarWidthIn, h: subfloorThickness, d: lengthIn, color: sfColor });
          parts.push({ x: hLeftBarWidthIn, y: sfY, z: hMiddleBarOffsetIn, w: widthIn - hLeftBarWidthIn - hRightBarWidthIn, h: subfloorThickness, d: hMiddleBarHeightIn, color: sfColor });
          parts.push({ x: widthIn - hRightBarWidthIn, y: sfY, z: 0, w: hRightBarWidthIn, h: subfloorThickness, d: lengthIn, color: sfColor });
        } else if (shape === 't-shape') {
          const stemX = (tTopWidthIn - tStemWidthIn) / 2;
          parts.push({ x: 0, y: sfY, z: 0, w: tTopWidthIn, h: subfloorThickness, d: tTopLengthIn, color: sfColor });
          parts.push({ x: stemX, y: sfY, z: tTopLengthIn, w: tStemWidthIn, h: subfloorThickness, d: tStemLengthIn, color: sfColor });
        } else if (shape === 'custom') {
          const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
          blocksToUse.forEach(block => {
            parts.push({ x: block.x, y: sfY, z: block.y, w: block.w, h: subfloorThickness, d: block.h, color: sfColor });
          });
        }
      }
    };

    // 1st Floor
    if (currentFloorIndex >= 0) {
      addFloorForStory(foundationHeight, joistSize);
    }

    // Upper Floors
    let currentZ = foundationHeight + floorSystemHeight + wallHeightIn;
    for (let i = 0; i < additionalStories; i++) {
      if (currentFloorIndex >= i + 1) {
        addFloorForStory(currentZ, upperFloorJoistSize);
      }
      
      const upperJoistH = upperFloorJoistSize === '2x6' ? 5.5 : upperFloorJoistSize === '2x8' ? 7.25 : upperFloorJoistSize === '2x10' ? 9.25 : 11.25;
      const upperFloorSystemH = upperJoistH + (addSubfloor ? subfloorThickness : 0);
      currentZ += upperFloorSystemH + upperFloorWallHeightIn;
    }

    return parts;
  }, [addFloorFraming, noFramingFloorOnly, joistSpacing, joistSize, joistDirection, floorBays, addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness, widthIn, lengthIn, shape, lBackWidthIn, lRightDepthIn, uWallsIn, hLeftBarWidthIn, hRightBarWidthIn, hMiddleBarHeightIn, hMiddleBarOffsetIn, tTopWidthIn, tTopLengthIn, tStemWidthIn, tStemLengthIn, foundationHeight, floorSystemHeight, wallHeightIn, additionalStories, upperFloorWallHeightIn, upperFloorJoistSize, combinedBlocks, shapeBlocks, exteriorWalls, currentFloorIndex, foundationType]);

  interface Girder3DBeam {
    id: string;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    isPocketBeam?: boolean;
  }
  interface Girder3DPost {
    id: string;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
  }
  interface Girder3DPier {
    id: string;
    x: number;
    y: number;
    z: number;
    radius?: number; // for round
    w?: number; // for square
    h: number; // overall height
    d?: number; // for square
    type: 'round' | 'square';
  }
  interface Girder3DBracket {
    id: string;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    isWoodToWood?: boolean;
  }

  const girderSystem3D = useMemo(() => {
    const beams: Girder3DBeam[] = [];
    const posts: Girder3DPost[] = [];
    const piers: Girder3DPier[] = [];
    const brackets: Girder3DBracket[] = [];

    if (!enableGirderSystem || !addFloorFraming) {
      return { beams, posts, piers, brackets };
    }

    const mockState = {
      shape,
      widthFt: Math.floor(widthIn / 12),
      widthInches: widthIn % 12,
      lengthFt: Math.floor(lengthIn / 12),
      lengthInches: lengthIn % 12,
      lRightDepthFt: Math.floor(lRightDepthIn / 12),
      lRightDepthInches: lRightDepthIn % 12,
      lBackWidthFt: Math.floor(lBackWidthIn / 12),
      lBackWidthInches: lBackWidthIn % 12,
      lDirection: lDirection || 'back-right',
      uWalls: {
        w1: Math.floor(uWallsIn.w1 / 12),
        w2: Math.floor(uWallsIn.w2 / 12),
        w3: Math.floor(uWallsIn.w3 / 12),
        w4: Math.floor(uWallsIn.w4 / 12),
        w5: Math.floor(uWallsIn.w5 / 12),
        w6: Math.floor(uWallsIn.w6 / 12),
        w7: Math.floor(uWallsIn.w7 / 12),
        w8: Math.floor(uWallsIn.w8 / 12),
      },
      uWallsInches: {
        w1: uWallsIn.w1 % 12,
        w2: uWallsIn.w2 % 12,
        w3: uWallsIn.w3 % 12,
        w4: uWallsIn.w4 % 12,
        w5: uWallsIn.w5 % 12,
        w6: uWallsIn.w6 % 12,
        w7: uWallsIn.w7 % 12,
        w8: uWallsIn.w8 % 12,
      },
      uDirection: 'back',
      hLeftBarWidthFt: Math.floor(hLeftBarWidthIn / 12),
      hLeftBarWidthInches: hLeftBarWidthIn % 12,
      hRightBarWidthFt: Math.floor(hRightBarWidthIn / 12),
      hRightBarWidthInches: hRightBarWidthIn % 12,
      hMiddleBarHeightFt: Math.floor(hMiddleBarHeightIn / 12),
      hMiddleBarHeightInches: hMiddleBarHeightIn % 12,
      hMiddleBarOffsetFt: Math.floor(hMiddleBarOffsetIn / 12),
      hMiddleBarOffsetInches: hMiddleBarOffsetIn % 12,
      tTopWidthFt: Math.floor(tTopWidthIn / 12),
      tTopWidthInches: tTopWidthIn % 12,
      tTopLengthFt: Math.floor(tTopLengthIn / 12),
      tTopLengthInches: tTopLengthIn % 12,
      tStemWidthFt: Math.floor(tStemWidthIn / 12),
      tStemWidthInches: tStemWidthIn % 12,
      tStemLengthFt: Math.floor(tStemLengthIn / 12),
      tStemLengthInches: tStemLengthIn % 12,
      combinedBlocks,
      shapeBlocks,
    } as any;

    const activeBays = floorBays && floorBays.length > 0 ? floorBays : detectBays(mockState);
    const parsedBays = activeBays.map(bay => {
      const direction = floorBays && floorBays.length > 0 ? bay.joistDirection : joistDirection;
      return { ...bay, joistDirection: direction };
    });

    let beamWidth = 4.5;
    let beamDepth = 9.25;

    if (girderSize === '2-2x10') {
      beamWidth = 3.0;
    } else if (girderSize === '4-2x10') {
      beamWidth = 6.0;
    } else if (girderSize === '6x6') {
      beamWidth = 5.5;
      beamDepth = 5.5;
    } else if (girderSize === '6x8') {
      beamWidth = 5.5;
      beamDepth = 7.5;
    }

    const postDim = girderPostSize === '4x4' ? 3.5 : 5.5;
    const isRound = girderPierSize.includes('Round');
    const pierDiameter = 12;
    const pierSquareSize = 16;
    const revealIn = Math.min(6, Math.max(0, foundationHeight - beamDepth));
    const depthIn = 24;
    const pierHeight = revealIn + depthIn;

    const supportSystem = computeFramingSupportSystem({
      enableGirderSystem,
      addFloorFraming,
      girderSpanThresholdFt,
      girderPostSpacingFt,
      addPocketBeams,
      pocketBeamsOnlyAtGirderEnds
    }, parsedBays);

    // 1. Add Pocket Beams
    supportSystem.pocketBeams.forEach((pb) => {
      const isSpanY = pb.dir === 'y';
      let bx = 0, bz = 0, bw = 0, bd = 0;
      
      if (isSpanY) {
        // Runs vertically in 2D layout -> Z axis in Three.js
        bw = beamWidth;
        bd = pb.length;
        bx = pb.coord - beamWidth / 2;
        bz = pb.start;
      } else {
        // Runs horizontally in 2D layout -> X axis in Three.js
        bw = pb.length;
        bd = beamWidth;
        bx = pb.start;
        bz = pb.coord - beamWidth / 2;
      }

      const by = foundationHeight - beamDepth;

      beams.push({
        id: pb.id,
        x: bx,
        y: by,
        z: bz,
        w: bw,
        h: beamDepth,
        d: bd,
        isPocketBeam: true
      });

      // Posts & Piers along pocket beam
      pb.posts.forEach((post, idx) => {
        const postTop = foundationHeight - beamDepth;
        const postBottom = revealIn;
        const postHeight = Math.max(0, postTop - postBottom);

        if (postHeight > 0.01) {
          posts.push({
            id: `${pb.id}-post-${idx}`,
            x: post.x - postDim / 2,
            y: postBottom,
            z: post.y - postDim / 2,
            w: postDim,
            h: postHeight,
            d: postDim
          });
        }

        piers.push({
          id: `${pb.id}-pier-${idx}`,
          x: post.x,
          y: (revealIn - depthIn) / 2,
          z: post.y,
          radius: isRound ? pierDiameter / 2 : undefined,
          w: !isRound ? pierSquareSize : undefined,
          h: pierHeight,
          d: !isRound ? pierSquareSize : undefined,
          type: isRound ? 'round' : 'square'
        });
      });

      // Pocket beam perimeter brackets (always on perimeter walls)
      pb.brackets.forEach((br) => {
        let brX = 0, brY = by - 0.25, brZ = 0, brW = 0, brH = beamDepth + 0.25, brD = 0;

        if (isSpanY) {
          brW = beamWidth + 1.5;
          brD = 2.0;
          brX = br.x - brW / 2;
          if (br.type === 'start') {
            brZ = br.y;
          } else {
            brZ = br.y - 2.0;
          }
        } else {
          brD = beamWidth + 1.5;
          brW = 2.0;
          brZ = br.y - brD / 2;
          if (br.type === 'start') {
            brX = br.x;
          } else {
            brX = br.x - 2.0;
          }
        }

        brackets.push({
          id: `${pb.id}-${br.id}`,
          x: brX,
          y: brY,
          z: brZ,
          w: brW,
          h: brH,
          d: brD,
          isWoodToWood: false
        });
      });
    });

    // 2. Add Girders
    supportSystem.girders.forEach((g) => {
      const isSpanY = g.isSpanY;
      let bx = 0, bz = 0, bw = 0, bd = 0;
      
      if (isSpanY) {
        bw = g.length;
        bd = beamWidth;
        bx = g.x1;
        bz = g.y1 - beamWidth / 2;
      } else {
        bw = beamWidth;
        bd = g.length;
        bx = g.x1 - beamWidth / 2;
        bz = g.y1;
      }

      const by = foundationHeight - beamDepth;

      beams.push({
        id: g.id,
        x: bx,
        y: by,
        z: bz,
        w: bw,
        h: beamDepth,
        d: bd
      });

      // Posts & Piers along girder
      g.posts.forEach((post, idx) => {
        const postTop = foundationHeight - beamDepth;
        const postBottom = revealIn;
        const postHeight = Math.max(0, postTop - postBottom);

        if (postHeight > 0.01) {
          posts.push({
            id: `${g.id}-post-${idx}`,
            x: post.x - postDim / 2,
            y: postBottom,
            z: post.y - postDim / 2,
            w: postDim,
            h: postHeight,
            d: postDim
          });
        }

        piers.push({
          id: `${g.id}-pier-${idx}`,
          x: post.x,
          y: (revealIn - depthIn) / 2,
          z: post.y,
          radius: isRound ? pierDiameter / 2 : undefined,
          w: !isRound ? pierSquareSize : undefined,
          h: pierHeight,
          d: !isRound ? pierSquareSize : undefined,
          type: isRound ? 'round' : 'square'
        });
      });

      // Girder endpoints brackets
      g.brackets.forEach((br) => {
        let brX = 0, brY = by - 0.25, brZ = 0, brW = 0, brH = beamDepth + 0.25, brD = 0;

        if (isSpanY) {
          brD = beamWidth + 1.5;
          brW = 2.0;
          brZ = br.y - brD / 2;
          if (br.type === 'start') {
            brX = br.x;
          } else {
            brX = br.x - 2.0;
          }
        } else {
          brW = beamWidth + 1.5;
          brD = 2.0;
          brX = br.x - brW / 2;
          if (br.type === 'start') {
            brZ = br.y;
          } else {
            brZ = br.y - 2.0;
          }
        }

        brackets.push({
          id: `${g.id}-${br.id}`,
          x: brX,
          y: brY,
          z: brZ,
          w: brW,
          h: brH,
          d: brD,
          isWoodToWood: br.isWoodToWood
        });
      });
    });

    return { beams, posts, piers, brackets };
  }, [
    enableGirderSystem, addFloorFraming, girderSpanThresholdFt, girderPostSpacingFt,
    girderSize, girderPostSize, girderPierSize, foundationHeight, joistSize,
    shape, widthIn, lengthIn, floorBays, joistDirection, addPocketBeams,
    lRightDepthIn, lBackWidthIn, uWallsIn, hLeftBarWidthIn, hRightBarWidthIn, hMiddleBarHeightIn, hMiddleBarOffsetIn, tTopWidthIn, tTopLengthIn, tStemWidthIn, tStemLengthIn,
    combinedBlocks, shapeBlocks, lDirection
  ]);

  const activeFloorCutHeight = useMemo(() => {
    let z = totalBaseHeight;
    let h = wallHeightIn;
    for (let i = 0; i < additionalStories; i++) {
      if (currentFloorIndex === i + 1) {
        h = upperFloorWallHeightIn;
        break;
      }
      const upperJoistH = upperFloorJoistSize === '2x6' ? 5.5 : upperFloorJoistSize === '2x8' ? 7.25 : upperFloorJoistSize === '2x10' ? 9.25 : 11.25;
      const upperFloorSystemH = upperJoistH + (addSubfloor ? subfloorThickness : 0);
      z += h + upperFloorSystemH;
    }
    return (z + h * 0.9) * 0.0254; // Cut at 90% of the active floor's wall height
  }, [totalBaseHeight, wallHeightIn, additionalStories, currentFloorIndex, upperFloorWallHeightIn, upperFloorJoistSize, addSubfloor, subfloorThickness]);

  return (
    <div className="w-full h-full bg-zinc-100 dark:bg-[#0f1424] rounded-xl overflow-hidden relative border border-zinc-200 dark:border-[#1c2240]">
      <CanvasErrorBoundary>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, failIfMajorPerformanceCaveat: false }} onCreated={({ gl }) => { gl.setClearColor('#0f1424'); }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[widthIn * 0.03, wallHeightIn * 0.08, lengthIn * 0.03]} fov={50} />
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} autoRotate={isDroneMode} autoRotateSpeed={1.0} />
          <SpaceMouseController axes={spaceMouseAxes} enabled={spaceMouseConnected} />
          
          <ambientLight intensity={0.4} />
          {showSky && !customHdriUrlProp && <Sky distance={450000} sunPosition={sunPosition} inclination={0} azimuth={0.25} />}
          {showSun && (
            <directionalLight
              position={sunPosition}
              intensity={sunIntensity}
              color={sunColor}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-50}
              shadow-camera-right={50}
              shadow-camera-top={50}
              shadow-camera-bottom={-50}
              shadow-bias={-0.0001}
            />
          )}
          {customHdriUrlProp ? (
            <TextureErrorBoundary
              resetKey={customHdriUrlProp}
              fallback={
                <TextureErrorBoundary fallback={null}>
                  <Suspense fallback={null}>
                    <Environment preset={hdriPresetProp as any} />
                  </Suspense>
                </TextureErrorBoundary>
              }
            >
              <Suspense fallback={null}>
                <Environment
                  files={customHdriUrlProp}
                  background
                />
              </Suspense>
            </TextureErrorBoundary>
          ) : (
            <TextureErrorBoundary fallback={null}>
              <Suspense fallback={null}>
                <Environment preset={hdriPresetProp as any} />
              </Suspense>
            </TextureErrorBoundary>
          )}

          <CameraController captureTrigger={cameraCaptureTrigger} onCapture={(cam) => setCustomCameras?.(prev => [...prev, { ...cam, name: `View ${prev.length + 1}` }])}
            presetTrigger={cameraPresetTrigger} 
            targetCenter={[(widthIn / 2.0) * 0.0254, totalBaseHeight * 0.0254 + (wallHeightIn / 2) * 0.0254, (lengthIn / 2.0) * 0.0254]} 
            distance={Math.max(widthIn, lengthIn, 360) * 0.0254} 
            customCameras={customCameras}
          />
          <ClipControls 
            isFloorPlanView={isFloorPlanView} 
            cutHeight={activeFloorCutHeight} 
          />
          {showAxes && <axesHelper args={[500]} rotation={[-Math.PI / 2, 0, 0]} />}
          {showGround && <Ground
          />}
          

              <group ref={houseGroupRef} scale={0.0254}> {/* Convert inches to meters for Three.js scale */}
                {foundation.map((f, i) => (
                  <FoundationPart key={`fd-${i}`} {...f}
                    surfaceId="foundation" appliedMaterials={activeMaterials} materialConfigs={materialConfigs}
                    activePaintMaterial={localActivePaint}
                    onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }}
                  />
                ))}
              {floorSystem.map((f, i) => (
                <FoundationPart key={`fl-${i}`} {...f}
                  surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs}
                  activePaintMaterial={localActivePaint}
                  onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }}
                />
              ))}

              {/* Floor Girder Support System */}
              {addFloorFraming && enableGirderSystem && (
                <group>
                  {/* Girder Beams */}
                  {girderSystem3D.beams.map((b) => (
                    <FoundationPart 
                      key={b.id} 
                      x={b.x} 
                      y={b.y} 
                      z={b.z} 
                      w={b.w} 
                      h={b.h} 
                      d={b.d} 
                      color={b.isPocketBeam ? "#a16207" : "#d9a05b"} // Richer/darker brown for pocket beams
                      surfaceId={`girder-${b.id}`} 
                      appliedMaterials={activeMaterials} 
                      materialConfigs={materialConfigs}
                      activePaintMaterial={localActivePaint}
                      onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }}
                    />
                  ))}
                  {/* Support Posts */}
                  {girderSystem3D.posts.map((p) => (
                    <FoundationPart 
                      key={p.id} 
                      x={p.x} 
                      y={p.y} 
                      z={p.z} 
                      w={p.w} 
                      h={p.h} 
                      d={p.d} 
                      color="#b45309"
                      surfaceId={`post-${p.id}`} 
                      appliedMaterials={activeMaterials} 
                      materialConfigs={materialConfigs}
                      activePaintMaterial={localActivePaint}
                      onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }}
                    />
                  ))}
                  {/* Concrete Piers */}
                  {girderSystem3D.piers.map((p) => (
                    p.type === 'round' ? (
                      <mesh key={p.id} position={[p.x, p.y, p.z]} castShadow receiveShadow>
                        <cylinderGeometry args={[p.radius!, p.radius!, p.h, 16]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.1} />
                      </mesh>
                    ) : (
                      <mesh key={p.id} position={[p.x, p.y, p.z]} castShadow receiveShadow>
                        <boxGeometry args={[p.w!, p.h, p.d!]} />
                        <meshStandardMaterial color="#94a3b8" roughness={0.9} metalness={0.1} />
                      </mesh>
                    )
                  ))}
                  {/* Simpson Girder Brackets */}
                  {girderSystem3D.brackets.map((b) => (
                    <mesh key={b.id} position={[b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2]} castShadow receiveShadow>
                      <boxGeometry args={[b.w, b.h, b.d]} />
                      <meshStandardMaterial 
                        color={b.isWoodToWood ? "#cbd5e1" : "#64748b"} // Galvanised steel for wood-to-wood, dark steel for wall
                        roughness={b.isWoodToWood ? 0.3 : 0.2} 
                        metalness={b.isWoodToWood ? 0.7 : 0.8} 
                      />
                    </mesh>
                  ))}
                </group>
              )}

              {!addFloorFraming && foundationType !== 'slab' && foundationType !== 'slab-on-grade' && (
                <group>
                  {shape === 'rectangle' && <FoundationPart x={0} y={foundationHeight} z={0} w={widthIn} h={subfloorThickness} d={lengthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />}
                  {shape === 'l-shape' && (
                    <>
                      <FoundationPart x={0} y={foundationHeight} z={0} w={widthIn} h={subfloorThickness} d={lRightDepthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={0} y={foundationHeight} z={lRightDepthIn} w={lBackWidthIn} h={subfloorThickness} d={lengthIn - lRightDepthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                    </>
                  )}
                  {shape === 'u-shape' && (
                    <>
                      <FoundationPart x={0} y={foundationHeight} z={0} w={uWallsIn.w7} h={subfloorThickness} d={uWallsIn.w8} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={uWallsIn.w1 - uWallsIn.w3} y={foundationHeight} z={0} w={uWallsIn.w3} h={subfloorThickness} d={uWallsIn.w2} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={uWallsIn.w7} y={foundationHeight} z={0} w={uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7} h={subfloorThickness} d={uWallsIn.w2 - uWallsIn.w4} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                    </>
                  )}
                  {shape === 'h-shape' && (
                    <>
                      <FoundationPart x={0} y={foundationHeight} z={0} w={hLeftBarWidthIn} h={subfloorThickness} d={lengthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={hLeftBarWidthIn} y={foundationHeight} z={hMiddleBarOffsetIn} w={widthIn - hLeftBarWidthIn - hRightBarWidthIn} h={subfloorThickness} d={hMiddleBarHeightIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={widthIn - hRightBarWidthIn} y={foundationHeight} z={0} w={hRightBarWidthIn} h={subfloorThickness} d={lengthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                    </>
                  )}
                  {shape === 't-shape' && (
                    <>
                      <FoundationPart x={0} y={foundationHeight} z={0} w={tTopWidthIn} h={subfloorThickness} d={tTopLengthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                      <FoundationPart x={(tTopWidthIn - tStemWidthIn) / 2} y={foundationHeight} z={tTopLengthIn} w={tStemWidthIn} h={subfloorThickness} d={tStemLengthIn} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                    </>
                  )}
                  {shape === 'custom' && (combinedBlocks.length > 0 ? combinedBlocks : shapeBlocks).map(block => (
                    <FoundationPart key={block.id} x={block.x} y={foundationHeight} z={block.y} w={block.w} h={subfloorThickness} d={block.h} color="#d4d4d8" surfaceId="floor" appliedMaterials={activeMaterials} materialConfigs={materialConfigs} activePaintMaterial={localActivePaint} onSurfacePainted={(sid, url) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); }} />
                  ))}
                </group>
              )}

              {/* ── Interior floor finish — sits on top of floor system, independently paintable ── */}
              {addSubfloor && foundationType !== 'slab' && foundationType !== 'slab-on-grade' && (() => {
                const ffy = foundationHeight + floorSystemHeight; // top of the full floor structure
                const ffh = 0.5; // thin finish layer (0.5")
                const ffColor = "#c8b89a"; // warm natural tone — overridden by applied texture
                const ffPaint = {
                  surfaceId: "floor-finish" as string,
                  appliedMaterials: activeMaterials,
                  materialConfigs,
                  activePaintMaterial: localActivePaint,
                  onSurfacePainted: (sid: string, url: string) => { handleSurfacePainted(sid, url); setActiveSurfaceId(sid); },
                };
                if (shape === 'rectangle') return (
                  <FoundationPart key="ff-rect" x={0} y={ffy} z={0} w={widthIn} h={ffh} d={lengthIn} color={ffColor} {...ffPaint} />
                );
                if (shape === 'l-shape') return (
                  <>
                    <FoundationPart key="ff-l1" x={0} y={ffy} z={0} w={widthIn} h={ffh} d={lRightDepthIn} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-l2" x={0} y={ffy} z={lRightDepthIn} w={lBackWidthIn} h={ffh} d={lengthIn - lRightDepthIn} color={ffColor} {...ffPaint} />
                  </>
                );
                if (shape === 'u-shape') return (
                  <>
                    <FoundationPart key="ff-u1" x={0} y={ffy} z={0} w={uWallsIn.w7} h={ffh} d={uWallsIn.w8} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-u2" x={uWallsIn.w1 - uWallsIn.w3} y={ffy} z={0} w={uWallsIn.w3} h={ffh} d={uWallsIn.w2} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-u3" x={uWallsIn.w7} y={ffy} z={0} w={uWallsIn.w1 - uWallsIn.w3 - uWallsIn.w7} h={ffh} d={uWallsIn.w2 - uWallsIn.w4} color={ffColor} {...ffPaint} />
                  </>
                );
                if (shape === 'h-shape') return (
                  <>
                    <FoundationPart key="ff-h1" x={0} y={ffy} z={0} w={hLeftBarWidthIn} h={ffh} d={lengthIn} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-h2" x={hLeftBarWidthIn} y={ffy} z={hMiddleBarOffsetIn} w={widthIn - hLeftBarWidthIn - hRightBarWidthIn} h={ffh} d={hMiddleBarHeightIn} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-h3" x={widthIn - hRightBarWidthIn} y={ffy} z={0} w={hRightBarWidthIn} h={ffh} d={lengthIn} color={ffColor} {...ffPaint} />
                  </>
                );
                if (shape === 't-shape') return (
                  <>
                    <FoundationPart key="ff-t1" x={0} y={ffy} z={0} w={tTopWidthIn} h={ffh} d={tTopLengthIn} color={ffColor} {...ffPaint} />
                    <FoundationPart key="ff-t2" x={(tTopWidthIn - tStemWidthIn) / 2} y={ffy} z={tTopLengthIn} w={tStemWidthIn} h={ffh} d={tStemLengthIn} color={ffColor} {...ffPaint} />
                  </>
                );
                if (shape === 'custom') return (
                  <>
                    {(combinedBlocks.length > 0 ? combinedBlocks : shapeBlocks).map(block => (
                      <FoundationPart key={`ff-c-${block.id}`} x={block.x} y={ffy} z={block.y} w={block.w} h={ffh} d={block.h} color={ffColor} {...ffPaint} />
                    ))}
                  </>
                );
                return null;
              })()}



              {/* Framing System */}
              {walls.framingList.map((p, i) => (
                <mesh key={'fr'+i} position={[p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2]} castShadow receiveShadow>
                  <boxGeometry args={[p.w, p.h, p.d]} />
                  <meshStandardMaterial color={p.color || "#deb887"} roughness={0.8} />
                </mesh>
              ))}

              {walls.wallList.map((w, i) => {
                // Per-face IDs: exterior walls are ext-wall-N, interior/drywall are int-wall-N
                const isExt = w.color === "#e4e4e7" || w.color === "#c4a484";
                const isDrywall = w.color === "#ffffff";
                const isInt = !isExt && !isDrywall;
                const surfaceId = isExt ? `ext-wall-${i}` : isDrywall ? `drywall-${i}` : `int-wall-${i}`;
                const texUrl = activeMaterials[surfaceId];
                const cfg = texUrl ? materialConfigs[texUrl] : undefined;
                return (
                  <Wall key={i} {...w} openings={openings}
                    surfaceId={surfaceId} appliedMaterials={activeMaterials}
                    materialConfigs={materialConfigs}
                    activePaintMaterial={localActivePaint}
                    onSurfacePainted={(sid, url) => {
                      handleSurfacePainted(sid, url);
                      setActiveSurfaceId(sid);
                    }}
                    splitAt={splitHeight}
                  />
                );
              })}
              {!isFloorPlanView && showRoof && roofs.map((roof, i) => {
                // Build a per-face paint map for this roof index
                const faceNames = roof.type === 'gable'
                  ? ['slope-left', 'slope-right', 'end-front', 'end-back']
                  : roof.type === 'hip'
                  ? ['slope-front', 'slope-back', 'slope-left', 'slope-right']
                  : ['slope', 'end-left', 'end-right']; // shed

                const facePaints = Object.fromEntries(faceNames.map(face => {
                  const sid = `roof-${i}-${face}`;
                  const tex = activeMaterials[sid];
                  const cfg = tex ? materialConfigs[tex] : undefined;
                  return [face, {
                    isPaintMode: !!localActivePaint,
                    textureUrl: tex,
                    materialConfig: cfg,
                    onPaintClick: () => {
                      if (localActivePaint) {
                        handleSurfacePainted(sid, localActivePaint);
                        setActiveSurfaceId(sid);
                      }
                    },
                  }];
                }));

                const baseProps = {
                  key: i,
                  x: roof.x, y: roof.y + totalBaseHeight + wallHeightIn, z: roof.z,
                  width: roof.width, length: roof.length,
                  ridgeHeight: roof.ridgeHeight, overhang: roof.overhang,
                  color: roof.color, ridgeDirection: roof.ridgeDirection,
                  facePaints,
                };

                return roof.type === 'gable' ? (
                  <GableRoof {...baseProps} />
                ) : roof.type === 'hip' ? (
                  <HipRoof {...baseProps} />
                ) : (
                  <ShedRoof {...baseProps} height={roof.ridgeHeight} />
                );
              })}


              {!isFloorPlanView && showRoof && dormers && dormers.map((d, i) => {
                const w = d.rotation === 0 ? d.widthIn : d.depthIn;
                const l = d.rotation === 0 ? d.depthIn : d.widthIn;
                
                const wallH = d.wallHeightIn ?? 48; // fallback to 48 if undefined
                const pitch = d.pitch ?? 6;
                const overhang = d.overhangIn ?? 12;
                const fascia = d.fasciaIn ?? 0;
                
                const eaveDrop = overhang * (pitch / 12);
                const ridgeH = (w / 2) * (pitch / 12) + eaveDrop;

                // Collect all windows for this dormer
                const dormerWins: { ox: number; winW: number; winH: number; sill: number; modelUrl?: string; modelFileName?: string }[] = [];

                // Legacy single-window from DormerConfig.hasWindow
                if (d.hasWindow) {
                  const legW = d.windowWidthIn ?? 24;
                  const legH = d.windowHeightIn ?? 30;
                  const legSill = d.windowSillHeightIn ?? 6;
                  if (legW > 0 && legH > 0 && legW < l && (legSill + legH) < wallH) {
                    dormerWins.push({ ox: (l - legW) / 2, winW: legW, winH: legH, sill: legSill });
                  }
                }

                // Standard windows assigned to this dormer (wall = 9000 + i)
                windows.filter(win => win.wall === 9000 + i).forEach(win => {
                  const centerOffset = win.xFt * 12 + win.xInches;
                  // For dormers, we interpret the xFt/xInches as an offset from the center
                  // rather than from the left edge. This keeps the window perfectly centered
                  // when resized, and `centerOffset = 0` means perfectly centered.
                  const ox = centerOffset + l / 2 - win.widthIn / 2;
                  if (win.widthIn > 0 && win.heightIn > 0 && (win.sillHeightIn + win.heightIn) < wallH) {
                    dormerWins.push({ ox, winW: win.widthIn, winH: win.heightIn, sill: win.sillHeightIn, modelUrl: win.modelUrl, modelFileName: win.modelFileName });
                  }
                });

                const hasAnyWindow = dormerWins.length > 0;
                
                return (
                  <group key={`dormer-${i}`}>
                    {/* Walls — with optional window cutouts */}
                    <mesh position={[d.x, totalBaseHeight + wallHeightIn + (wallH / 2), d.y]} castShadow receiveShadow>
                      {hasAnyWindow ? (
                        <Geometry>
                          <Base><boxGeometry args={[w, wallH, l]} /></Base>
                          {dormerWins.map((dw, wi) => (
                            <Subtraction key={`dw-sub-${wi}`} position={[w / 2, dw.sill + dw.winH / 2 - wallH / 2, dw.ox + dw.winW / 2 - l / 2]}>
                              <boxGeometry args={[w * 0.4, dw.winH, dw.winW]} />
                            </Subtraction>
                          ))}
                        </Geometry>
                      ) : (
                        <boxGeometry args={[w, wallH, l]} />
                      )}
                      <meshStandardMaterial color="#e4e4e7" roughness={0.7} />
                    </mesh>

                    {/* Glass panes & frames — on the front face (+X side) */}
                    {dormerWins.map((dw, wi) => {
                      const glassZ = d.y - l / 2 + dw.ox + dw.winW / 2;
                      const glassY = totalBaseHeight + wallHeightIn + dw.sill + dw.winH / 2;
                      return (
                        <group key={`dw-glass-${wi}`}>
                          {dw.modelUrl ? (
                            <group position={[d.x + w / 2, glassY - dw.winH / 2, glassZ]} rotation={[0, -Math.PI / 2, 0]}>
                              <ModelErrorBoundary fallback={<mesh />}>
                                <Suspense fallback={<mesh />}>
                                  <LinkedModel url={dw.modelUrl} widthFt={dw.winW} depthFt={4} heightFt={dw.winH} stretch />
                                </Suspense>
                              </ModelErrorBoundary>
                            </group>
                          ) : (
                            <>
                              <mesh position={[d.x + w / 2, glassY, glassZ]} castShadow>
                                <boxGeometry args={[0.5, dw.winH - 1, dw.winW - 1]} />
                                <meshStandardMaterial color="#87ceeb" transparent opacity={0.35} roughness={0.05} metalness={0.3} />
                              </mesh>
                              <mesh position={[d.x + w / 2 + 0.3, glassY, glassZ]}>
                                <boxGeometry args={[0.8, dw.winH + 1, dw.winW + 1]} />
                                <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
                              </mesh>
                              <mesh position={[d.x + w / 2 + 0.3, glassY, glassZ]}>
                                <boxGeometry args={[1, dw.winH - 0.5, dw.winW - 0.5]} />
                                <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
                              </mesh>
                            </>
                          )}
                        </group>
                      );
                    })}
                    
                    {/* Roof */}
                    <DormerRoof 
                      x={d.x - w / 2 - overhang} 
                      y={totalBaseHeight + wallHeightIn + wallH - eaveDrop} 
                      z={d.y - l / 2 - overhang} 
                      w={w + 2 * overhang} 
                      l={l + 2 * overhang} 
                      ridgeH={ridgeH} 
                      isHoriz={d.rotation === 0}
                      fascia={fascia}
                      surfaceId={`dormer-roof-${i}`}
                      appliedMaterials={activeMaterials}
                      materialConfigs={materialConfigs}
                      isPaintMode={!!localActivePaint}
                      onSurfacePaintedFn={(faceId) => { if (localActivePaint) handleSurfacePainted(faceId, localActivePaint); }}
                    />
                  </group>
                );
              })}

              {/* Truss Runs */}
              {!isFloorPlanView && trussRuns.map((run, i) => {
                const w = run.rotation === 0 ? run.lengthFt * 12 : run.spanFt * 12;
                const d = run.rotation === 0 ? run.spanFt * 12 : run.lengthFt * 12;
                const rx = run.x - w / 2;
                const rz = run.y - d / 2;
                const y = totalBaseHeight + wallHeightIn;
                
                const trusses = [];
                if (run.type === 'Solid Shell') {
                  const overhang = run.overhangIn ?? 12;
                  const eaveDrop = overhang * (run.pitch / 12);
                  const fasciaIn = run.fasciaIn ?? 6;
                  const height = (run.spanFt * 12 / 2) * (run.pitch / 12) + eaveDrop;
                  
                  // ── Custom corners → custom 3D shell ──
                  if (run.customCorners) {
                    const cc = run.customCorners;
                    // 2D corners map to 3D: 2D x → 3D x, 2D y → 3D z, height → 3D y
                    const nw3 = { x: rx + cc.nw.dx, z: rz + cc.nw.dy };
                    const ne3 = { x: rx + w + cc.ne.dx, z: rz + cc.ne.dy };
                    const sw3 = { x: rx + cc.sw.dx, z: rz + d + cc.sw.dy };
                    const se3 = { x: rx + w + cc.se.dx, z: rz + d + cc.se.dy };
                    
                    const ratio = run.ridgeRatio !== undefined ? (run.ridgeRatio / 100) : 0.5;
                    // Ridge runs between midpoints of left and right edges
                    const ridgeLeft = {
                      x: nw3.x + (sw3.x - nw3.x) * ratio,
                      z: nw3.z + (sw3.z - nw3.z) * ratio,
                    };
                    const ridgeRight = {
                      x: ne3.x + (se3.x - ne3.x) * ratio,
                      z: ne3.z + (se3.z - ne3.z) * ratio,
                    };
                    
                    // Apply overhang by extending each corner outward
                    const ovNw: [number, number, number] = [nw3.x - overhang, y - eaveDrop, nw3.z - overhang];
                    const ovNe: [number, number, number] = [ne3.x + overhang, y - eaveDrop, ne3.z - overhang];
                    const ovSw: [number, number, number] = [sw3.x - overhang, y - eaveDrop, sw3.z + overhang];
                    const ovSe: [number, number, number] = [se3.x + overhang, y - eaveDrop, se3.z + overhang];
                    const ridgeL: [number, number, number] = [ridgeLeft.x, y + height, ridgeLeft.z];
                    const ridgeR: [number, number, number] = [ridgeRight.x, y + height, ridgeRight.z];
                    
                    const fp = (subId: string) => ({
                      color: "#9ca3af",
                      isPaintMode: !!activePaint,
                      onPaintClick: () => { if (activePaint) handleSurfacePainted(`truss-shell-${run.id}-${subId}`, activePaint); },
                      textureUrl: activeMaterials[`truss-shell-${run.id}-${subId}`],
                      materialConfig: activeMaterials[`truss-shell-${run.id}-${subId}`] ? materialConfigs[activeMaterials[`truss-shell-${run.id}-${subId}`]] : undefined,
                    });
                    
                    return (
                      <group key={`run-${i}`}>
                        {/* Left slope (NW → Ridge → SW) */}
                        <RoofFace pts={[ovNw, ridgeL, ridgeR, ovNe]} {...fp('slope-left')} noOffset={true} />
                        {/* Right slope (NE → Ridge → SE) */}
                        <RoofFace pts={[ovSw, ovSe, ridgeR, ridgeL]} {...fp('slope-right')} noOffset={true} />
                        {/* Left end (NW → SW → ridgeL) */}
                        {Math.abs(ovNw[2] - ovSw[2]) > 1 && (
                          <RoofFace pts={[ovNw, ovSw, ridgeL]} {...fp('end-front')} noOffset={true} />
                        )}
                        {/* Right end (NE → SE → ridgeR) */}
                        {Math.abs(ovNe[2] - ovSe[2]) > 1 && (
                          <RoofFace pts={[ovNe, ovSe, ridgeR]} {...fp('end-back')} noOffset={true} />
                        )}
                        {/* Underside */}
                        <RoofFace pts={[ovNw, ovNe, ovSe, ovSw]} {...fp('underside')} noOffset={true} />
                      </group>
                    );
                  }
                  
                  // ── Standard rectangular solid shell ──
                  const fp = (subId: string) => ({
                    color: "#9ca3af",
                    isPaintMode: !!activePaint,
                    onPaintClick: () => { if (activePaint) handleSurfacePainted(`truss-shell-${run.id}-${subId}`, activePaint); },
                    textureUrl: activeMaterials[`truss-shell-${run.id}-${subId}`],
                    materialConfig: activeMaterials[`truss-shell-${run.id}-${subId}`] ? materialConfigs[activeMaterials[`truss-shell-${run.id}-${subId}`]] : undefined,
                  });

                  const group = run.groupId ? roofGroups.find(g => g.id === run.groupId) : undefined;
                  const groupIds = group?.autoIntersect ? group.shellIds : [];
                  const groupShells = groupIds.length > 0 ? trussRuns.filter(r => r.id !== run.id && r.type === 'Solid Shell' && groupIds.includes(r.id)) : [];

                  const faces = computeShellFaces3D(run, y);

                  return (
                    <group key={`run-${i}`}>
                      {faces.map(face => {
                        const slicedPolys = groupShells.length > 0 ? sliceFacesWithGroup(face, groupShells, y) : [face.pts];
                        return slicedPolys.map((poly, idx) => (
                          <RoofFace key={`${face.id}-${idx}`} pts={poly} {...fp(face.type)} noOffset={true} />
                        ));
                      })}
                    </group>
                  );
                  
                  // Default: gable style (existing DormerRoof)
                  const ratio = run.ridgeRatio !== undefined ? (run.ridgeRatio / 100) : 0.5;
                  return (
                    <group key={`run-${i}`}>
                      <DormerRoof
                        x={rx - overhang}
                        y={y - eaveDrop}
                        z={rz - overhang}
                        w={w + 2 * overhang}
                        l={d + 2 * overhang}
                        ridgeH={height}
                        isHoriz={run.rotation !== 0}
                        ridgeRatio={ratio}
                        fascia={fasciaIn}
                        color="#9ca3af"
                        surfaceId={`truss-shell-${run.id}`}
                        isPaintMode={!!activePaint}
                        appliedMaterials={activeMaterials}
                        materialConfigs={materialConfigs}
                        onSurfacePaintedFn={(faceId) => { if (activePaint) handleSurfacePainted(faceId, activePaint); }}
                        noOffset={true}
                      />
                    </group>
                  );
                }
                
                if (run.spacingIn > 0) {
                  if (run.rotation === 0) {
                    const numTrusses = Math.floor(w / run.spacingIn) + 1;
                    for (let j = 0; j < numTrusses; j++) {
                      const tx = rx + j * run.spacingIn;
                      
                      let cutsLeft = false;
                      let cutsRight = false;
                      if (dormers) {
                        const intersected = dormers.find(dorm => {
                          const dw = dorm.rotation === 0 ? dorm.widthIn : dorm.depthIn;
                          return tx >= dorm.x - dw / 2 && tx <= dorm.x + dw / 2;
                        });
                        if (intersected) {
                          if (intersected.y < rz + d / 2) cutsLeft = true;
                          else cutsRight = true;
                        }
                      }

                      trusses.push(
                        <TrussMesh 
                          key={`truss-${i}-${j}`} 
                          span={run.spanFt * 12} 
                          pitch={run.pitch} 
                          thickness={1.5} 
                          position={[tx - 1.5 / 2, y, rz + d / 2]} 
                          rotation={[0, Math.PI / 2, 0]} 
                          cutsLeft={cutsLeft}
                          cutsRight={cutsRight}
                          type={run.type}
                          customScript={run.customScript}
                        />
                      );
                    }
                  } else {
                    const numTrusses = Math.floor(d / run.spacingIn) + 1;
                    for (let j = 0; j < numTrusses; j++) {
                      const tz = rz + j * run.spacingIn;
                      
                      let cutsLeft = false;
                      let cutsRight = false;
                      if (dormers) {
                        const intersected = dormers.find(dorm => {
                          const dl = dorm.rotation === 0 ? dorm.depthIn : dorm.widthIn;
                          return tz >= dorm.y - dl / 2 && tz <= dorm.y + dl / 2;
                        });
                        if (intersected) {
                          if (intersected.x < rx + w / 2) cutsLeft = true;
                          else cutsRight = true;
                        }
                      }

                      trusses.push(
                        <TrussMesh 
                          key={`truss-${i}-${j}`} 
                          span={run.spanFt * 12} 
                          pitch={run.pitch} 
                          thickness={1.5} 
                          position={[rx + w / 2, y, tz - 1.5 / 2]} 
                          rotation={[0, 0, 0]} 
                          cutsLeft={cutsLeft}
                          cutsRight={cutsRight}
                          type={run.type}
                          customScript={run.customScript}
                        />
                      );
                    }
                  }
                }

                if (run.hasPlywood) {
                  const overhang = run.overhangIn || 12;
                  const eaveDrop = overhang * (run.pitch / 12);
                  const fasciaIn = run.fasciaIn || 0;
                  const height = (run.spanFt * 12 / 2) * (run.pitch / 12) + eaveDrop;
                  
                  trusses.push(
                    <DormerRoof
                      key={`plywood-${i}`}
                      x={rx - overhang}
                      y={y - eaveDrop + 0.5} 
                      z={rz - overhang}
                      w={w + 2 * overhang}
                      l={d + 2 * overhang}
                      ridgeH={height}
                      isHoriz={run.rotation !== 0}
                      ridgeRatio={run.ridgeRatio !== undefined ? (run.ridgeRatio / 100) : 0.5}
                      fascia={fasciaIn}
                      color="#deb887"
                      surfaceId={`truss-plywood-${run.id}`}
                      isPaintMode={!!activePaint}
                      appliedMaterials={activeMaterials}
                      materialConfigs={materialConfigs}
                      onSurfacePaintedFn={(faceId) => { if (activePaint) handleSurfacePainted(faceId, activePaint); }}
                    />
                  );
                }

                return <group key={`truss-run-${i}`}>{trusses}</group>;
              })}
              
              {/* Render shape blocks as semi-transparent guides while in custom mode */}
              {shape === 'custom' && shapeBlocks.map((block) => (
                <mesh key={block.id} position={[block.x + block.w / 2, foundationHeight / 2, block.y + block.h / 2]}>
                  <boxGeometry args={[block.w, foundationHeight || 4, block.h]} />
                  <meshStandardMaterial color="#4f46e5" transparent opacity={0.2} />
                </mesh>
              ))}

              {/* Reference Model */}
              {referenceModelUrl && (
                <Suspense fallback={null}>
                  <ReferenceModel 
                    url={referenceModelUrl} 
                    scale={modelScale} 
                    offset={modelOffset} 
                    rotation={modelRotation} 
                    opacity={modelOpacity}
                  />
                </Suspense>
              )}

              {/* Click catcher removed */}

              {/* Assets */}
              {assets.filter(a => (a.floorIndex || 0) === currentFloorIndex).map(asset => (
                <Asset key={asset.id} asset={asset} floorY={totalBaseHeight} />
              ))}

              {/* Openings are now subtracted from walls using CSG, so we don't render them as dark boxes anymore */}

              {/* Door & Window 3D Models */}
              {openingModels.map(om => (
                <group
                  key={`opening-model-${om.id}`}
                  position={[
                    om.x + om.w / 2,
                    om.y,
                    om.z + om.d / 2
                  ]}
                  rotation={[0, om.isHorizontal ? 0 : Math.PI / 2, 0]}
                >
                  <ModelErrorBoundary fallback={
                    <AssetPlaceholderBox
                      w={om.isHorizontal ? om.w : om.d}
                      h={om.h}
                      d={om.isHorizontal ? om.d : om.w}
                      color="#60a5fa"
                      errored
                    />
                  }>
                    <Suspense fallback={
                      <mesh position={[0, om.h / 2, 0]}>
                        <boxGeometry args={[om.isHorizontal ? om.w : om.d, om.h, om.isHorizontal ? om.d : om.w]} />
                        <meshStandardMaterial color="#60a5fa" opacity={0.3} transparent wireframe />
                      </mesh>
                    }>
                      <LinkedModel
                        url={om.modelUrl}
                        widthFt={om.isHorizontal ? om.w : om.d}
                        depthFt={om.isHorizontal ? om.d : om.w}
                        heightFt={om.h}
                        stretch
                      />
                    </Suspense>
                  </ModelErrorBoundary>
                </group>
              ))}
            </group>




          

        </Suspense>
      </Canvas>
      </CanvasErrorBoundary>
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <button
          onClick={() => {
            setIsPainterOpen(v => !v);
          }}
          title="Material Painter"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isPainterOpen
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'bg-white/80 dark:bg-[#151a2e]/80 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-[#243052]'
          }`}
        >
          🎨
        </button>
        <button
          onClick={() => spaceMouseConnected ? disconnectSpaceMouse() : connectSpaceMouse()}
          title={spaceMouseConnected ? `SpaceMouse: ${spaceMouseName} (click to disconnect)` : 'Connect 3Dconnexion SpaceMouse'}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            spaceMouseConnected
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'bg-white/80 dark:bg-[#151a2e]/80 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-[#243052]'
          }`}
        >
          🎮
        </button>
        {isPainterOpen && (
          <MaterialEditorPanel
            activePaintMaterial={localActivePaint}
            onClose={() => { setIsPainterOpen(false); setLocalActivePaint(null); setActiveSurfaceId(null); }}
            onSelectTexture={(url) => setLocalActivePaint(url || null)}
            activeSurfaceId={activeSurfaceId}
            appliedMaterials={activeMaterials}
            materialConfigs={materialConfigs}
            onSurfaceConfigChange={(texUrl, cfg) => setMaterialConfigs(prev => ({ ...prev, [texUrl]: cfg }))}
            onSaveMaterialConfig={(texUrl, cfg) => {
              setMaterialConfigs(prev => ({ ...prev, [texUrl]: cfg }));
              fetch('/api/save-material-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textureUrl: texUrl, config: cfg }),
              }).catch(console.error);
            }}
            onClearBrush={() => setLocalActivePaint(null)}
          />
        )}
      </div>
      
      {/* View Presets */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-[#151a2e]/90 backdrop-blur-md rounded-lg border border-zinc-200 dark:border-[#243052] shadow-sm p-1.5 flex flex-col gap-1 items-end pointer-events-auto">
        <div className="flex gap-1">
          <button 
            onClick={() => {
              const next = !isFloorPlanView;
              setIsFloorPlanView(next);
              if (next) setCameraPresetTrigger(`${Date.now()}-top`);
            }} 
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${isFloorPlanView ? 'bg-indigo-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
          >
            {isFloorPlanView ? 'Exit Floor Plan' : 'Floor Plan'}
          </button>
          <button 
            onClick={() => setIsDroneMode(!isDroneMode)} 
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors ${isDroneMode ? 'bg-indigo-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
          >
            {isDroneMode ? 'Stop Drone' : 'Drone View'}
          </button>
          <div className="w-px bg-zinc-200 dark:bg-[#1c2240] mx-1"></div>
          <button onClick={() => setCameraPresetTrigger(`${Date.now()}-top`)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors">Top</button>
          <button onClick={() => setCameraPresetTrigger(`${Date.now()}-front`)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors">Front</button>
          <button onClick={() => setCameraPresetTrigger(`${Date.now()}-back`)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors">Back</button>
          <button onClick={() => setCameraPresetTrigger(`${Date.now()}-left`)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors">Left</button>
          <button onClick={() => setCameraPresetTrigger(`${Date.now()}-right`)} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors">Right</button>
        </div>
        
        {customCameras.length > 0 && (
          <div className="flex gap-1 w-full justify-end border-t border-zinc-100 dark:border-[#243052] pt-1 mt-1">
            {customCameras.map(cam => (
              <button 
                key={cam.id}
                onClick={() => setCameraPresetTrigger(`${Date.now()}-${cam.id}`)} 
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-emerald-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors border border-indigo-100 dark:border-emerald-900/30"
              >
                {cam.name}
              </button>
            ))}
          </div>
        )}
        {setCustomCameras && (
          <div className="flex w-full justify-end mt-1 gap-2">
            <button 
              onClick={handleExportGLB}
              disabled={isExporting}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 border border-transparent ${isExporting ? 'bg-zinc-100 dark:bg-[#151a2e] text-zinc-400 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-800'}`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export .GLB
                </>
              )}
            </button>
            <button 
              onClick={() => setCameraCaptureTrigger(Date.now().toString())}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#1c2240] rounded transition-colors flex items-center gap-1.5 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
              Save Current View
            </button>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-4 right-4 bg-white/80 dark:bg-[#0a0e1a]/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10 text-[10px] text-zinc-600 dark:text-zinc-300 font-medium pointer-events-none shadow-sm">
        Left-click to rotate • Right-click to pan • Scroll to zoom
      </div>
    </div>
  );
}

