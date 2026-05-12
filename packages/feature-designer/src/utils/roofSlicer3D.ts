import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { TrussConfig } from '../App';

type Vec3 = [number, number, number];

export interface ShellFace3D {
  id: string;
  shellId: string;
  type: string; // 'slope-front', 'hip-left', 'underside', etc.
  pts: Vec3[];
  plane: { nx: number; ny: number; nz: number; d: number };
}

// Replicates the vertex generation from Preview3D.tsx to get all 3D faces of a shell
export function computeShellFaces3D(run: TrussConfig, yOffset: number): ShellFace3D[] {
  const faces: ShellFace3D[] = [];
  const sid = run.id;

  const w = run.rotation === 0 ? run.lengthFt * 12 : run.spanFt * 12;
  const d = run.rotation === 0 ? run.spanFt * 12 : run.lengthFt * 12;
  const rx = run.x - w / 2;
  const rz = run.y - d / 2;
  const y = yOffset; // totalBaseHeight + wallHeightIn

  const overhang = run.overhangIn ?? 12;
  const eaveDrop = overhang * (run.pitch / 12);
  const fasciaIn = run.fasciaIn ?? 6; // Default to 6 inch flat fascia edge instead of sharp point
  const height = (run.spanFt * 12 / 2) * (run.pitch / 12) + eaveDrop;

  const roofStyle = run.roofStyle || 'gable';
  const ratio = run.ridgeRatio !== undefined ? (run.ridgeRatio / 100) : 0.5;

  if (roofStyle === 'hip') {
    const ow = w + 2 * overhang;
    const od = d + 2 * overhang;
    const ox = rx - overhang;
    const oz = rz - overhang;
    const eaveY = y - eaveDrop;
    const eaveTopY = eaveY + fasciaIn;
    const ridgeY = y + height + fasciaIn;

    const nwTop: Vec3 = [ox, eaveTopY, oz];
    const neTop: Vec3 = [ox + ow, eaveTopY, oz];
    const swTop: Vec3 = [ox, eaveTopY, oz + od];
    const seTop: Vec3 = [ox + ow, eaveTopY, oz + od];

    const spanToRidge = Math.min(od * ratio, od * (1 - ratio));
    const hipInset = Math.min(ow / 2, spanToRidge);

    let ridgeL: Vec3, ridgeR: Vec3;
    if (run.rotation === 0) {
      const ridgeZ = oz + od * ratio;
      ridgeL = [ox + hipInset, ridgeY, ridgeZ];
      ridgeR = [ox + ow - hipInset, ridgeY, ridgeZ];

      faces.push({ id: `${sid}-slope-front`, shellId: sid, type: 'slope-front', pts: [nwTop, neTop, ridgeR, ridgeL], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-slope-back`, shellId: sid, type: 'slope-back', pts: [seTop, swTop, ridgeL, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-hip-left`, shellId: sid, type: 'hip-left', pts: [nwTop, ridgeL, swTop], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-hip-right`, shellId: sid, type: 'hip-right', pts: [neTop, seTop, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
    } else {
      const ridgeX = ox + ow * ratio;
      ridgeL = [ridgeX, ridgeY, oz + hipInset];
      ridgeR = [ridgeX, ridgeY, oz + od - hipInset];

      faces.push({ id: `${sid}-slope-left`, shellId: sid, type: 'slope-left', pts: [nwTop, swTop, ridgeR, ridgeL], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-slope-right`, shellId: sid, type: 'slope-right', pts: [seTop, neTop, ridgeL, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-hip-front`, shellId: sid, type: 'hip-front', pts: [nwTop, ridgeL, neTop], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-hip-back`, shellId: sid, type: 'hip-back', pts: [swTop, seTop, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
    }

    const nwBot: Vec3 = [ox, eaveY, oz];
    const neBot: Vec3 = [ox + ow, eaveY, oz];
    const swBot: Vec3 = [ox, eaveY, oz + od];
    const seBot: Vec3 = [ox + ow, eaveY, oz + od];

    if (fasciaIn > 0) {
      faces.push({ id: `${sid}-fascia-front`, shellId: sid, type: 'fascia-front', pts: [neBot, nwBot, nwTop, neTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
      faces.push({ id: `${sid}-fascia-back`, shellId: sid, type: 'fascia-back', pts: [swBot, seBot, seTop, swTop], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
      faces.push({ id: `${sid}-fascia-left`, shellId: sid, type: 'fascia-left', pts: [nwBot, swBot, swTop, nwTop], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
      faces.push({ id: `${sid}-fascia-right`, shellId: sid, type: 'fascia-right', pts: [seBot, neBot, neTop, seTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
      faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwBot, neBot, seBot, swBot], plane: { nx: 0, ny: -1, nz: 0, d: eaveY } });
    } else {
      faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwTop, neTop, seTop, swTop], plane: { nx: 0, ny: -1, nz: 0, d: eaveTopY } });
    }
  } else if (roofStyle === 'gable') {
    const ow = w + 2 * overhang;
    const od = d + 2 * overhang;
    const ox = rx - overhang;
    const oz = rz - overhang;
    const eaveY = y - eaveDrop;
    const eaveTopY = eaveY + fasciaIn;
    const ridgeY = y + height + fasciaIn;

    const nwTop: Vec3 = [ox, eaveTopY, oz];
    const neTop: Vec3 = [ox + ow, eaveTopY, oz];
    const swTop: Vec3 = [ox, eaveTopY, oz + od];
    const seTop: Vec3 = [ox + ow, eaveTopY, oz + od];

    const nwBot: Vec3 = [ox, eaveY, oz];
    const neBot: Vec3 = [ox + ow, eaveY, oz];
    const swBot: Vec3 = [ox, eaveY, oz + od];
    const seBot: Vec3 = [ox + ow, eaveY, oz + od];

    if (run.rotation === 0) {
      // Ridge along X (horizontal), span along Z
      const ridgeZ = oz + od * ratio;
      const ridgeL: Vec3 = [ox, ridgeY, ridgeZ];
      const ridgeR: Vec3 = [ox + ow, ridgeY, ridgeZ];
      faces.push({ id: `${sid}-slope-front`, shellId: sid, type: 'slope-front', pts: [nwTop, neTop, ridgeR, ridgeL], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-slope-back`, shellId: sid, type: 'slope-back', pts: [seTop, swTop, ridgeL, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      
      if (fasciaIn > 0) {
        faces.push({ id: `${sid}-end-left`, shellId: sid, type: 'end-left', pts: [nwBot, nwTop, ridgeL, swTop, swBot], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-end-right`, shellId: sid, type: 'end-right', pts: [neBot, seBot, seTop, ridgeR, neTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-fascia-front`, shellId: sid, type: 'fascia-front', pts: [neBot, nwBot, nwTop, neTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-fascia-back`, shellId: sid, type: 'fascia-back', pts: [swBot, seBot, seTop, swTop], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwBot, neBot, seBot, swBot], plane: { nx: 0, ny: -1, nz: 0, d: eaveY } });
      } else {
        faces.push({ id: `${sid}-end-left`, shellId: sid, type: 'end-left', pts: [nwTop, ridgeL, swTop], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-end-right`, shellId: sid, type: 'end-right', pts: [neTop, seTop, ridgeR], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwTop, neTop, seTop, swTop], plane: { nx: 0, ny: -1, nz: 0, d: eaveTopY } });
      }
    } else {
      // Ridge along Z (vertical), span along X
      const ridgeX = ox + ow * ratio;
      const ridgeL: Vec3 = [ridgeX, ridgeY, oz];
      const ridgeR: Vec3 = [ridgeX, ridgeY, oz + od];
      faces.push({ id: `${sid}-slope-left`, shellId: sid, type: 'slope-left', pts: [nwTop, swTop, ridgeR, ridgeL], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      faces.push({ id: `${sid}-slope-right`, shellId: sid, type: 'slope-right', pts: [seTop, neTop, ridgeL, ridgeR], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      
      if (fasciaIn > 0) {
        faces.push({ id: `${sid}-end-front`, shellId: sid, type: 'end-front', pts: [nwBot, neBot, neTop, ridgeL, nwTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-end-back`, shellId: sid, type: 'end-back', pts: [swBot, swTop, ridgeR, seTop, seBot], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-fascia-left`, shellId: sid, type: 'fascia-left', pts: [nwBot, swBot, swTop, nwTop], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-fascia-right`, shellId: sid, type: 'fascia-right', pts: [seBot, neBot, neTop, seTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwBot, neBot, seBot, swBot], plane: { nx: 0, ny: -1, nz: 0, d: eaveY } });
      } else {
        faces.push({ id: `${sid}-end-front`, shellId: sid, type: 'end-front', pts: [nwTop, ridgeL, neTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-end-back`, shellId: sid, type: 'end-back', pts: [swTop, seTop, ridgeR], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwTop, neTop, seTop, swTop], plane: { nx: 0, ny: -1, nz: 0, d: eaveTopY } });
      }
    }
  } else if (roofStyle === 'shed') {
    const shedRise = run.spanFt * 12 * (run.pitch / 12);
    const ow = w + 2 * overhang;
    const od = d + 2 * overhang;
    const ox = rx - overhang;
    const oz = rz - overhang;
    
    const eaveY = y - eaveDrop;
    const lowTopY = eaveY + fasciaIn;
    const highTopY = eaveY + shedRise + 2 * eaveDrop + fasciaIn; // eaveDrop on both ends

    if (run.rotation === 0) {
      // Span along Z: high at North (small Z), low at South (large Z)
      const nwTop: Vec3 = [ox, highTopY, oz];
      const neTop: Vec3 = [ox + ow, highTopY, oz];
      const swTop: Vec3 = [ox, lowTopY, oz + od];
      const seTop: Vec3 = [ox + ow, lowTopY, oz + od];
      
      const nwBot: Vec3 = [ox, eaveY, oz];
      const neBot: Vec3 = [ox + ow, eaveY, oz];
      const swBot: Vec3 = [ox, eaveY, oz + od];
      const seBot: Vec3 = [ox + ow, eaveY, oz + od];

      faces.push({ id: `${sid}-slope`, shellId: sid, type: 'slope', pts: [nwTop, neTop, seTop, swTop], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      
      if (fasciaIn > 0) {
        faces.push({ id: `${sid}-end-left`, shellId: sid, type: 'end-left', pts: [nwBot, nwTop, swTop, swBot], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-end-right`, shellId: sid, type: 'end-right', pts: [neBot, seBot, seTop, neTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-end-high`, shellId: sid, type: 'end-high', pts: [neBot, nwBot, nwTop, neTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-end-low`, shellId: sid, type: 'end-low', pts: [swBot, seBot, seTop, swTop], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwBot, neBot, seBot, swBot], plane: { nx: 0, ny: -1, nz: 0, d: eaveY } });
      } else {
        faces.push({ id: `${sid}-end-left`, shellId: sid, type: 'end-left', pts: [nwTop, swTop, [ox, eaveY, oz]], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-end-right`, shellId: sid, type: 'end-right', pts: [neTop, [ox + ow, eaveY, oz], seTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-end-high`, shellId: sid, type: 'end-high', pts: [[ox + ow, eaveY, oz], [ox, eaveY, oz], nwTop, neTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwTop, neTop, seTop, swTop], plane: { nx: 0, ny: -1, nz: 0, d: lowTopY } });
      }
    } else {
      // Span along X: high at West (small X), low at East (large X)
      const nwTop: Vec3 = [ox, highTopY, oz];
      const swTop: Vec3 = [ox, highTopY, oz + od];
      const neTop: Vec3 = [ox + ow, lowTopY, oz];
      const seTop: Vec3 = [ox + ow, lowTopY, oz + od];
      
      const nwBot: Vec3 = [ox, eaveY, oz];
      const swBot: Vec3 = [ox, eaveY, oz + od];
      const neBot: Vec3 = [ox + ow, eaveY, oz];
      const seBot: Vec3 = [ox + ow, eaveY, oz + od];

      faces.push({ id: `${sid}-slope`, shellId: sid, type: 'slope', pts: [nwTop, swTop, seTop, neTop], plane: { nx: 0, ny: 1, nz: 0, d: 0 } });
      
      if (fasciaIn > 0) {
        faces.push({ id: `${sid}-end-front`, shellId: sid, type: 'end-front', pts: [nwBot, neBot, neTop, nwTop], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-end-back`, shellId: sid, type: 'end-back', pts: [swBot, swTop, seTop, seBot], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-end-high`, shellId: sid, type: 'end-high', pts: [nwBot, swBot, swTop, nwTop], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-end-low`, shellId: sid, type: 'end-low', pts: [neBot, seBot, seTop, neTop], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwBot, neBot, seBot, swBot], plane: { nx: 0, ny: -1, nz: 0, d: eaveY } });
      } else {
        faces.push({ id: `${sid}-end-front`, shellId: sid, type: 'end-front', pts: [nwTop, neTop, [ox, eaveY, oz]], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
        faces.push({ id: `${sid}-end-back`, shellId: sid, type: 'end-back', pts: [swTop, [ox, eaveY, oz + od], seTop], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
        faces.push({ id: `${sid}-end-high`, shellId: sid, type: 'end-high', pts: [[ox, eaveY, oz], [ox, eaveY, oz + od], swTop, nwTop], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
        faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [nwTop, swTop, seTop, neTop], plane: { nx: 0, ny: -1, nz: 0, d: lowTopY } });
      }
    }
  } else if (roofStyle === 'flat') {
    const ow = w + 2 * overhang;
    const od = d + 2 * overhang;
    const ox = rx - overhang;
    const oz = rz - overhang;
    const slabThickness = fasciaIn > 0 ? fasciaIn : 6;
    const bottomY = y + 2;
    const topY = bottomY + slabThickness;
    
    const tNw: Vec3 = [ox, topY, oz];
    const tNe: Vec3 = [ox + ow, topY, oz];
    const tSw: Vec3 = [ox, topY, oz + od];
    const tSe: Vec3 = [ox + ow, topY, oz + od];
    const bNw: Vec3 = [ox, bottomY, oz];
    const bNe: Vec3 = [ox + ow, bottomY, oz];
    const bSw: Vec3 = [ox, bottomY, oz + od];
    const bSe: Vec3 = [ox + ow, bottomY, oz + od];

    faces.push({ id: `${sid}-top`, shellId: sid, type: 'top', pts: [tNw, tNe, tSe, tSw], plane: { nx: 0, ny: 1, nz: 0, d: -topY } });
    faces.push({ id: `${sid}-underside`, shellId: sid, type: 'underside', pts: [bSw, bSe, bNe, bNw], plane: { nx: 0, ny: -1, nz: 0, d: bottomY } });
    faces.push({ id: `${sid}-side-front`, shellId: sid, type: 'side-front', pts: [bNw, bNe, tNe, tNw], plane: { nx: 0, ny: 0, nz: -1, d: oz } });
    faces.push({ id: `${sid}-side-back`, shellId: sid, type: 'side-back', pts: [bSe, bSw, tSw, tSe], plane: { nx: 0, ny: 0, nz: 1, d: -(oz + od) } });
    faces.push({ id: `${sid}-side-left`, shellId: sid, type: 'side-left', pts: [bSw, bNw, tNw, tSw], plane: { nx: -1, ny: 0, nz: 0, d: ox } });
    faces.push({ id: `${sid}-side-right`, shellId: sid, type: 'side-right', pts: [bNe, bSe, tSe, tNe], plane: { nx: 1, ny: 0, nz: 0, d: -(ox + ow) } });
  }

  // Plane equations will be computed for each face automatically in a separate step
  faces.forEach(f => {
    f.plane = computePlaneFromPts(f.pts);
  });

  return faces;
}

function computePlaneFromPts(pts: Vec3[]) {
  // Take first 3 points to compute normal
  const p0 = new THREE.Vector3(...pts[0]);
  const p1 = new THREE.Vector3(...pts[1]);
  const p2 = new THREE.Vector3(...pts[2]);
  
  const v1 = new THREE.Vector3().subVectors(p1, p0);
  const v2 = new THREE.Vector3().subVectors(p2, p0);
  const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
  
  // nx * x + ny * y + nz * z + d = 0
  const d = -(n.x * p0.x + n.y * p0.y + n.z * p0.z);
  
  return { nx: n.x, ny: n.y, nz: n.z, d };
}
export function sliceFacesWithGroup(face: ShellFace3D, otherShells: TrussConfig[], yOffset: number): Vec3[][] {
  if (Math.abs(face.plane.ny) < 0.001) {
    return [face.pts];
  }

  // Extract 2D polygon of our face
  const facePoly2D: polygonClipping.Polygon = [face.pts.map(p => [p[0], p[2]])];
  let currentGeom: polygonClipping.Geom = [facePoly2D];
  
  // Create all faces of all other shells
  const otherFaces: ShellFace3D[] = [];
  otherShells.forEach(run => {
    otherFaces.push(...computeShellFaces3D(run, yOffset));
  });

  for (const other of otherFaces) {
    if (Math.abs(other.plane.ny) < 0.001) continue; // vertical wall, skip
    const otherPoly2D: polygonClipping.Polygon = [other.pts.map(p => [p[0], p[2]])];
    
    // Check if 2D footprints overlap
    const overlap = polygonClipping.intersection(facePoly2D, otherPoly2D);
    if (!overlap || overlap.length === 0) continue;

    // Inside the overlap, we must subtract the region where other is HIGHER than face
    // face: nx1 * x + ny1 * y + nz1 * z + d1 = 0  => z1 = (-nx1*x - ny1*y - d1)/nz1 (wait, y is up in 3D!)
    // In our Vec3, p[1] is UP (Y). The footprint is X and Z.
    // So y = (-nx * x - nz * z - d) / ny
    
    const z1 = (x: number, z: number) => (-face.plane.nx * x - face.plane.nz * z - face.plane.d) / face.plane.ny;
    const z2 = (x: number, z: number) => (-other.plane.nx * x - other.plane.nz * z - other.plane.d) / other.plane.ny;
    
    // We want to subtract regions where z2 > z1.
    // Instead of explicitly computing the half-plane polygon, we can just test the vertices of the overlap polygon.
    // Since the intersection of two planes is a line, and we are working with convex polygons,
    // we can find the 2D intersection line where z1 == z2.
    // The line is: (-nx1/ny1 + nx2/ny2) * x + (-nz1/ny1 + nz2/ny2) * z + (-d1/ny1 + d2/ny2) = 0
    // Let a = (-nx1/ny1 + nx2/ny2), b = (-nz1/ny1 + nz2/ny2), c = (-d1/ny1 + d2/ny2)
    // line: ax + bz + c = 0
    // The region to subtract is where z2 > z1.
    // We can slice the `overlap` polygon using this line. But `polygon-clipping` doesn't have a half-plane intersection.
    // However, if we just build a massive polygon for the half-plane ax + bz + c > 0, we can intersect it.
    
    const a = (-face.plane.nx / face.plane.ny) - (-other.plane.nx / other.plane.ny);
    const b = (-face.plane.nz / face.plane.ny) - (-other.plane.nz / other.plane.ny);
    const c = (-face.plane.d / face.plane.ny) - (-other.plane.d / other.plane.ny);
    
    if (Math.abs(a) < 0.001 && Math.abs(b) < 0.001) {
      // Parallel planes.
      const testPt = other.pts[0];
      if (z2(testPt[0], testPt[2]) > z1(testPt[0], testPt[2])) {
        // Other is higher everywhere, subtract entire overlap
        currentGeom = polygonClipping.difference(currentGeom, overlap);
      }
      continue;
    }
    
    // Build a large polygon for the half-plane.
    // We need points where z2 - z1 > 0 => ax + bz + c > 0 => bz > -ax - c
    const size = 100000;
    let hpPoly: [number, number][] = [];
    
    if (Math.abs(b) > Math.abs(a)) {
      // Line is mostly horizontal
      const zAtX1 = (-a * -size - c) / b;
      const zAtX2 = (-a * size - c) / b;
      if (b > 0) {
        // z > line
        hpPoly = [[-size, zAtX1], [size, zAtX2], [size, size], [-size, size]];
      } else {
        // z < line
        hpPoly = [[-size, zAtX1], [size, zAtX2], [size, -size], [-size, -size]];
      }
    } else {
      // Line is mostly vertical
      const xAtZ1 = (-b * -size - c) / a;
      const xAtZ2 = (-b * size - c) / a;
      if (a > 0) {
        // x > line
        hpPoly = [[xAtZ1, -size], [xAtZ2, size], [size, size], [size, -size]];
      } else {
        hpPoly = [[xAtZ1, -size], [xAtZ2, size], [-size, size], [-size, -size]];
      }
    }
    
    const regionToSubtract = polygonClipping.intersection(overlap, [[hpPoly]]);
    if (regionToSubtract.length > 0) {
      currentGeom = polygonClipping.difference(currentGeom, regionToSubtract);
    }
  }

  // Lift 2D polys back to 3D
  const sliced3D: Vec3[][] = [];
  for (const poly of currentGeom) {
    for (const ring of poly) {
      const ring3D: Vec3[] = [];
      for (const pt of ring) {
        // z = (-nx*x - nz*z - d)/ny
        const x = pt[0];
        const z = pt[1];
        const y = (-face.plane.nx * x - face.plane.nz * z - face.plane.d) / face.plane.ny;
        ring3D.push([x, y, z]);
      }
      // Remove last point if it duplicates first (polygon-clipping closes rings)
      if (ring3D.length > 1 && 
          Math.abs(ring3D[0][0] - ring3D[ring3D.length-1][0]) < 0.001 &&
          Math.abs(ring3D[0][2] - ring3D[ring3D.length-1][2]) < 0.001) {
        ring3D.pop();
      }
      if (ring3D.length >= 3) {
        sliced3D.push(ring3D);
      }
    }
  }

  return sliced3D;
}
