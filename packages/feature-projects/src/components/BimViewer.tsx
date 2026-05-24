import { useState, useMemo, Suspense, Component } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Edges, Html, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MapPin } from 'lucide-react';
import { cn } from '@dooleys/ui';


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

interface PhotoPin {
  id: string;
  position: [number, number, number];
}

interface BimViewerProps {
  issues: Issue[];
  onSelectIssue?: (issueId: string | null) => void;
  selectedIssueId?: string | null;
  photoPins?: PhotoPin[];
  onPhotoPinClick?: (photoId: string) => void;
  isPinningMode?: boolean;
  onModelClick?: (position: [number, number, number]) => void;
  showPhotoPins?: boolean;
  modelUrl?: string | null;
  pendingPinPosition?: [number, number, number];
  bcfImportStatus?: string | null;
}

interface BimElementProps {
  position: [number, number, number];
  rotation: [number, number, number];
  isClashing: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  children?: React.ReactNode;
}

// --- Error Boundary for GLTF loading failures ---
interface ModelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModelErrorBoundary extends Component<
  { children: React.ReactNode },
  ModelErrorBoundaryState
> {
  state: ModelErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="bg-red-900/80 px-5 py-3 border border-red-500/40 text-white text-xs whitespace-nowrap uppercase tracking-widest font-bold flex flex-col items-center gap-1">
            <span>Failed to load model</span>
            <span className="text-[9px] text-red-300 normal-case tracking-normal font-normal max-w-[240px] truncate">
              {this.state.error?.message ?? 'Unknown error'}
            </span>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function LoadedModel({ url, isPinningMode, onModelClick }: { url: string; isPinningMode?: boolean; onModelClick?: (pos: [number, number, number]) => void }) {
  const { scene } = useGLTF(url);
  // Clone the scene to avoid Three.js "object can only have one parent" errors
  // when the component remounts or is rendered more than once.
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  return (
    <primitive 
      object={clonedScene} 
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (isPinningMode && onModelClick) {
          e.stopPropagation();
          onModelClick([e.point.x, e.point.y, e.point.z]);
        }
      }}
    />
  );
}

// --- Static demo elements (module-level constant, no useMemo needed) ---
const DEFAULT_ELEMENTS = [
  { id: 'el-beam-1', type: 'beam' as const, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
  { id: 'el-duct-1', type: 'duct' as const, position: [0, 1, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
  { id: 'el-pipe-1', type: 'pipe' as const, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, Math.PI / 2] as [number, number, number] },
  { id: 'el-beam-2', type: 'beam' as const, position: [2, 0, -2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
  { id: 'el-duct-2', type: 'duct' as const, position: [0, 0, -2] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
];

const Duct = ({ position, rotation, isClashing, onClick, onPointerOver, onPointerOut, children }: BimElementProps) => {
  return (
    <Box position={position} rotation={rotation} args={[4, 0.4, 0.8]} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <meshStandardMaterial color={isClashing ? "#ff5555" : "#888888"} transparent opacity={0.8} />
      <Edges color={isClashing ? '#ff0000' : 'white'} />
      {children}
    </Box>
  );
};

const Beam = ({ position, rotation, isClashing, onClick, onPointerOver, onPointerOut, children }: BimElementProps) => {
  return (
    <Box position={position} rotation={rotation} args={[0.5, 4, 0.5]} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <meshStandardMaterial color={isClashing ? "#ff5555" : "#6666cc"} transparent opacity={0.8} />
      <Edges color={isClashing ? '#ff0000' : 'white'} />
      {children}
    </Box>
  );
};

const Pipe = ({ position, rotation, isClashing, onClick, onPointerOver, onPointerOut, children }: BimElementProps) => {
  return (
    <Cylinder position={position} rotation={rotation} args={[0.2, 0.2, 5, 16]} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <meshStandardMaterial color={isClashing ? "#ff5555" : "#cc6622"} transparent opacity={0.8} />
      <Edges color={isClashing ? '#ff0000' : 'white'} />
      {children}
    </Cylinder>
  );
}

export function BimViewer({ issues, onSelectIssue, selectedIssueId, photoPins, onPhotoPinClick, isPinningMode, onModelClick, showPhotoPins = true, modelUrl, pendingPinPosition, bcfImportStatus }: BimViewerProps) {
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Build a clash map for O(1) lookups instead of scanning the issues array repeatedly
  const clashMap = useMemo(() => {
    const map = new Map<string, Issue[]>();
    issues.filter(i => i.status !== 'resolved').forEach(issue => {
      issue.clashIds?.forEach(id => {
        const existing = map.get(id) || [];
        existing.push(issue);
        map.set(id, existing);
      });
    });
    return map;
  }, [issues]);

  const getIsClashing = (elementId: string) => {
    // If an issue is selected, only highlight clashes for that issue
    if (selectedIssueId) {
      const issue = issues.find(i => i.id === selectedIssueId);
      if (issue && issue.clashIds?.includes(elementId) && issue.status !== 'resolved') {
        return true;
      }
      return false; // Not clashing for the selected issue
    }

    // Otherwise, check the pre-built clash map
    return clashMap.has(elementId);
  };

  const getElementIssue = (elementId: string) => {
    return clashMap.get(elementId)?.[0] ?? null;
  };
  
  const handleObjectClick = (e: ThreeEvent<MouseEvent>, elementId: string) => {
    e.stopPropagation();
    
    if (isPinningMode && onModelClick) {
      onModelClick([e.point.x, e.point.y, e.point.z]);
      return;
    }

    // Find an issue associated with this element via the clash map
    const clashIssues = clashMap.get(elementId);
    if (clashIssues?.[0] && onSelectIssue) {
      onSelectIssue(clashIssues[0].id);
    } else if (onSelectIssue) {
      onSelectIssue(null);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>, elementId: string) => {
    e.stopPropagation();
    setHoveredElementId(elementId);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredElementId(null);
  };

  return (
    <div className={cn("w-full h-full bg-[#2a2a2a] relative", isPinningMode ? "cursor-crosshair" : "cursor-move")}>
      <Canvas 
        camera={{ position: [5, 5, 5], fov: 45 }}
        onPointerMissed={(e) => {
          if (!isPinningMode && onSelectIssue) {
             onSelectIssue(null);
          }
        }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={3} />
        <directionalLight position={[-10, 20, -10]} intensity={1.5} />
        <Environment preset="city" />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        {!modelUrl && <gridHelper args={[10, 10, '#333333', '#111111']} />}
        
        {/* Invisible plane to catch clicks for pinning if user clicks empty space */}
        <mesh 
          rotation={[-Math.PI/2, 0, 0]} 
          position={[0, -2, 0]} 
          onClick={(e) => {
            if (isPinningMode && onModelClick) {
              e.stopPropagation();
              onModelClick([e.point.x, e.point.y, e.point.z]);
            }
          }}
          visible={false}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial />
        </mesh>
        
        {modelUrl ? (
          <ModelErrorBoundary>
            <Suspense fallback={<Html center><div className="bg-black/80 px-4 py-2 border border-white/20 text-white text-xs whitespace-nowrap uppercase tracking-widest font-bold">Loading Model...</div></Html>}>
              <LoadedModel url={modelUrl} isPinningMode={isPinningMode} onModelClick={onModelClick} />
            </Suspense>
          </ModelErrorBoundary>
        ) : (
          DEFAULT_ELEMENTS.map((el) => {
            const isClashing = getIsClashing(el.id);
            const isHovered = hoveredElementId === el.id;
            const matchingIssue = getElementIssue(el.id);
            
            const props: BimElementProps = {
              position: el.position,
              rotation: el.rotation,
              isClashing,
              onClick: (e) => handleObjectClick(e, el.id),
              onPointerOver: (e) => handlePointerOver(e, el.id),
              onPointerOut: (e) => handlePointerOut(e)
            };
            
            const tooltip = isHovered && (
              <Html center distanceFactor={15}>
                <div className="bg-bg-surface border border-white/20 px-3 py-2 text-white text-xs rounded shadow-2xl whitespace-nowrap pointer-events-none select-none">
                  <div className="font-bold opacity-70 mb-1 uppercase tracking-wider text-[9px]">{el.type} • {el.id}</div>
                  {isClashing && matchingIssue ? (
                    <div className="text-red-400 flex items-center gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Clash: {matchingIssue.title}
                    </div>
                  ) : (
                    <div className="text-emerald-400 text-[10px] font-medium">Model Synced - No Conflicts</div>
                  )}
                </div>
              </Html>
            );
            
            switch (el.type) {
              case 'beam': return <Beam key={el.id} {...props}>{tooltip}</Beam>;
              case 'duct': return <Duct key={el.id} {...props}>{tooltip}</Duct>;
              case 'pipe': return <Pipe key={el.id} {...props}>{tooltip}</Pipe>;
              default: return null;
            }
          })
        )}

        {showPhotoPins && photoPins?.map(pin => (
          <Html key={pin.id} position={pin.position} center zIndexRange={[100, 0]}>
            <div 
              className="text-accent-gold hover:text-[#f8d462] cursor-pointer drop-shadow-md transition-transform hover:scale-125"
              onClick={(e) => {
                e.stopPropagation();
                onPhotoPinClick?.(pin.id);
              }}
            >
              <MapPin className="w-5 h-5 fill-black/50" />
            </div>
          </Html>
        ))}

        {issues.filter(i => i.position).map(issue => (
          <Html key={issue.id} position={issue.position} center zIndexRange={[100, 0]}>
            <div 
              className={cn("cursor-pointer drop-shadow-md transition-transform hover:scale-125", selectedIssueId === issue.id ? "text-white" : "text-red-500 hover:text-red-400")}
              onClick={(e) => {
                e.stopPropagation();
                onSelectIssue?.(issue.id);
              }}
            >
              <div className="relative">
                {/* Only animate the selected issue pin to reduce concurrent CSS animations */}
                <div className={cn(
                  "absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full",
                  selectedIssueId === issue.id ? "animate-ping" : "animate-pulse"
                )}></div>
                <MapPin className="w-5 h-5 fill-red-500/20" />
              </div>
            </div>
          </Html>
        ))}

        {pendingPinPosition && (
          <Html position={pendingPinPosition} center zIndexRange={[100, 0]}>
            <div className="cursor-pointer drop-shadow-md text-accent-gold">
              <div className="relative">
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent-gold rounded-full animate-ping"></div>
                <MapPin className="w-5 h-5 fill-accent-gold/20" />
              </div>
            </div>
          </Html>
        )}
      </Canvas>
      {/* Overlay controls or hints could go here */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none">
        <div className="bg-black/50 px-2 py-1 text-[9px] text-text-muted uppercase tracking-widest border border-white/10">
          Left Click: Rotate
        </div>
        <div className="bg-black/50 px-2 py-1 text-[9px] text-text-muted uppercase tracking-widest border border-white/10">
          Right Click: Pan
        </div>
        <div className="bg-black/50 px-2 py-1 text-[9px] text-text-muted uppercase tracking-widest border border-white/10">
          Scroll: Zoom
        </div>
      </div>
      
      {bcfImportStatus && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-accent-gold text-black px-4 py-2 text-[10px] uppercase font-bold tracking-widest shadow-lg animate-in fade-in slide-in-from-bottom-4 pointer-events-none whitespace-nowrap">
          {bcfImportStatus}
        </div>
      )}
    </div>
  );
}
