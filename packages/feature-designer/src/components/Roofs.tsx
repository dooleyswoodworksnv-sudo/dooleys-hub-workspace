import React, { useMemo, Suspense, useState } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

// ─── Error boundary for roof texture loading ────────────────────────────────
class RoofTextureErrorBoundary extends React.Component<
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
    console.warn('[RoofTexture] Failed to load:', error.message);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Shared material ──────────────────────────────────────────────────────────
const RoofTexturedMaterial = ({ url, opacity, scaleW, scaleH }: {
  url: string; opacity: number; scaleW: number; scaleH: number;
}) => {
  // url is already a properly formatted path (e.g. /api/serve-file?path=...)
  const texture = useTexture(url);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  
  // ExtrudeGeometry maps U and V directly to the shape's X and Y coordinates (in inches).
  // scaleW and scaleH are in feet, so we multiply by 12 to get inches.
  // The texture should repeat once every (scaleW * 12) inches.
  const repeatX = 1 / (scaleW * 12);
  const repeatY = 1 / (scaleH * 12);
  
  texture.repeat.set(repeatX, repeatY);
  return <meshStandardMaterial map={texture} roughness={0.8} side={THREE.DoubleSide} opacity={opacity / 100} transparent={opacity < 100} />;
};

const RoofMaterial = ({ textureUrl, color, hovered, isPaintMode, config }: {
  textureUrl?: string; color: string; hovered: boolean; isPaintMode?: boolean;
  config?: { scaleW: number; scaleH: number; opacity: number };
}) => {
  if (textureUrl) {
    const fallbackMat = <meshStandardMaterial color={color} roughness={0.8} side={THREE.DoubleSide} />;
    return (
      <RoofTextureErrorBoundary fallback={fallbackMat}>
        <Suspense fallback={fallbackMat}>
          <RoofTexturedMaterial url={textureUrl} opacity={config?.opacity ?? 100} scaleW={config?.scaleW ?? 5} scaleH={config?.scaleH ?? 5} />
        </Suspense>
      </RoofTextureErrorBoundary>
    );
  }
  const c = isPaintMode && hovered ? '#86efac' : hovered ? '#4a5568' : color;
  return <meshStandardMaterial color={c} roughness={0.8} side={THREE.DoubleSide} />;
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type FacePaintProps = {
  isPaintMode?: boolean;
  onPaintClick?: () => void;
  textureUrl?: string;
  materialConfig?: { scaleW: number; scaleH: number; opacity: number };
  noOffset?: boolean;
};
export type RoofFacePaints = { [face: string]: FacePaintProps };

type Vec3 = [number, number, number];

// ─── RoofFace — one clickable slope using ShapeGeometry ───────────────────────
// pts: 3 or 4 world-space corners in a consistent winding order
export const RoofFace = ({ pts, color, isPaintMode, onPaintClick, textureUrl, materialConfig, noOffset }: {
  pts: Vec3[]; color: string;
} & FacePaintProps) => {
  const [hovered, setHovered] = useState(false);
  const geomRef = React.useRef<THREE.BufferGeometry>(null);
  const { normal, origin, axisX, axisY } = useMemo(() => {
    const v = pts.map(p => new THREE.Vector3(...p));
    const origin = v[0].clone();
    
    // We define a consistent 2D mapping frame for the shape
    const axisX  = new THREE.Vector3().subVectors(v[1], v[0]).normalize();
    const rawY   = new THREE.Vector3().subVectors(v[pts.length - 1], v[0]);
    let derivedNormal = new THREE.Vector3().crossVectors(axisX, rawY).normalize();
    if (derivedNormal.lengthSq() === 0) derivedNormal = new THREE.Vector3(0, 1, 0); // fallback
    const axisY  = new THREE.Vector3().crossVectors(derivedNormal, axisX).normalize();

    return { normal: derivedNormal, origin, axisX, axisY };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.map(p => p.join(',')).join('|')]);

  // Construct our raw geometry face declaratively instead of imperatively to avoid WebGL buffer pointer corruption
  const raycastGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pts.length * 3);
    const uvs = new Float32Array(pts.length * 2);
    
    // Inward facing normals (derived from some specific winding paths) will be corrected by DoubleSide rendering,
    // but the geometry offset needs to explicitly use ABS(normal) if it points inward? Let's just push outward dynamically.
    // If our normal calculated points inward:
    const baseNormal = normal.clone();
    
    const offsetVector = baseNormal.multiplyScalar(noOffset ? 0 : 1.05);

    for (let i = 0; i < pts.length; i++) {
       const v = new THREE.Vector3(...pts[i]).add(offsetVector);
       positions[i * 3] = v.x;
       positions[i * 3 + 1] = v.y;
       positions[i * 3 + 2] = v.z;
       
       const d = new THREE.Vector3(...pts[i]).sub(origin);
       uvs[i * 2] = Math.abs(d.dot(axisX));
       uvs[i * 2 + 1] = Math.abs(d.dot(axisY));
    }
    
    let indices: number[] = [];
    if (pts.length === 3) indices = [0, 1, 2];
    else if (pts.length === 4) indices = [0, 1, 2,  0, 2, 3];
    else if (pts.length === 5) indices = [0, 1, 2,  0, 2, 3,  0, 3, 4];
    
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [pts, normal, origin, axisX, axisY, noOffset]);

  return (
    <>
      {/* Flawless Raycast Layer: Absolute world-space triangles */}
      <mesh
        onClick={(e) => { e.stopPropagation(); if (isPaintMode && onPaintClick) onPaintClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        castShadow
        receiveShadow // Adding double sided here makes backwards polys intersect successfully
      >
        <primitive object={raycastGeom} attach="geometry" />
        <RoofMaterial textureUrl={textureUrl} color={color} hovered={hovered} isPaintMode={isPaintMode} config={materialConfig} />
      </mesh>
    </>
  );
};


// ─── Roof base props ──────────────────────────────────────────────────────────
type RoofBase = {
  x: number; y: number; z: number;
  width: number; length: number;
  ridgeHeight: number; overhang: number;
  color?: string; ridgeDirection?: 'horizontal' | 'vertical';
  facePaints?: RoofFacePaints;
};

// ─── GableRoof — slope-left, slope-right, end-front, end-back ────────────────
export const GableRoof = ({ x, y, z, width, length, ridgeHeight, overhang, color = '#71717a', ridgeDirection = 'horizontal', facePaints = {} }: RoofBase) => {
  const W = ridgeDirection === 'horizontal' ? width + 2 * overhang : length + 2 * overhang;
  const L = ridgeDirection === 'horizontal' ? length + 2 * overhang : width + 2 * overhang;
  const H = ridgeHeight;
  const ox = x - overhang, oz = z - overhang;
  const fp = (n: string): FacePaintProps => facePaints[n] ?? {};
  // Ridge runs along Z at x=W/2, y=H
  return (
    <group>
      <RoofFace color={color} {...fp('slope-left')}  pts={[[ox, y, oz], [ox, y, oz+L], [ox+W/2, y+H, oz+L], [ox+W/2, y+H, oz]]} />
      <RoofFace color={color} {...fp('slope-right')} pts={[[ox+W, y, oz], [ox+W/2, y+H, oz], [ox+W/2, y+H, oz+L], [ox+W, y, oz+L]]} />
      <RoofFace color={color} {...fp('end-front')}   pts={[[ox, y, oz], [ox+W/2, y+H, oz], [ox+W, y, oz]]} />
      <RoofFace color={color} {...fp('end-back')}    pts={[[ox+W, y, oz+L], [ox+W/2, y+H, oz+L], [ox, y, oz+L]]} />
    </group>
  );
};

// ─── HipRoof — slope-front, slope-back, slope-left, slope-right ──────────────
export const HipRoof = ({ x, y, z, width, length, ridgeHeight, overhang, color = '#71717a', ridgeDirection = 'horizontal', facePaints = {} }: RoofBase) => {
  let W = width + 2 * overhang;
  let L = length + 2 * overhang;
  if (ridgeDirection === 'vertical') [W, L] = [L, W];
  const H = ridgeHeight;
  const ox = x - overhang, oz = z - overhang;
  // Ridge from (W/2, H, rz0) to (W/2, H, rz1)
  const rz0 = Math.min(W / 2, L / 2);
  const rz1 = Math.max(L - W / 2, L / 2);
  const fp = (n: string): FacePaintProps => facePaints[n] ?? {};
  return (
    <group>
      <RoofFace color={color} {...fp('slope-front')} pts={[[ox, y, oz], [ox+W, y, oz], [ox+W/2, y+H, oz+rz0]]} />
      <RoofFace color={color} {...fp('slope-back')}  pts={[[ox+W, y, oz+L], [ox, y, oz+L], [ox+W/2, y+H, oz+rz1]]} />
      <RoofFace color={color} {...fp('slope-left')}  pts={[[ox, y, oz+L], [ox, y, oz], [ox+W/2, y+H, oz+rz0], [ox+W/2, y+H, oz+rz1]]} />
      <RoofFace color={color} {...fp('slope-right')} pts={[[ox+W, y, oz], [ox+W, y, oz+L], [ox+W/2, y+H, oz+rz1], [ox+W/2, y+H, oz+rz0]]} />
    </group>
  );
};

// ─── ShedRoof — slope, end-left, end-right ────────────────────────────────────
export const ShedRoof = ({ x, y, z, width, length, height, overhang, color = '#71717a', ridgeDirection = 'horizontal', facePaints = {} }: RoofBase & { height: number }) => {
  const W = ridgeDirection === 'horizontal' ? width + 2 * overhang : length + 2 * overhang;
  const L = ridgeDirection === 'horizontal' ? length + 2 * overhang : width + 2 * overhang;
  const H = height;
  const ox = x - overhang, oz = z - overhang;
  const fp = (n: string): FacePaintProps => facePaints[n] ?? {};
  return (
    <group>
      <RoofFace color={color} {...fp('slope')}     pts={[[ox, y, oz], [ox, y, oz+L], [ox+W, y+H, oz+L], [ox+W, y+H, oz]]} />
      <RoofFace color={color} {...fp('end-left')}  pts={[[ox, y, oz], [ox+W, y+H, oz], [ox+W, y, oz]]} />
      <RoofFace color={color} {...fp('end-right')} pts={[[ox, y, oz+L], [ox+W, y, oz+L], [ox+W, y+H, oz+L]]} />
    </group>
  );
};
