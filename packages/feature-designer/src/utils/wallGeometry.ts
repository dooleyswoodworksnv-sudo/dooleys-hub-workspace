import polygonClipping from 'polygon-clipping';

export interface WallDef {
  id: number;
  start_x: number;
  start_y: number;
  length: number;
  depth: number;
  is_x_dir: boolean;
  ext_dir: number;
  sh_start: number;
  sh_end: number;
  // For 2D preview
  x: number;
  y: number;
  w: number;
  h: number;
  isHorizontal: boolean;
}

export function computeExteriorWalls(
  shape: string,
  widthIn: number,
  lengthIn: number,
  lRightDepthIn: number,
  lBackWidthIn: number,
  uWallsIn: any,
  thicknessIn: number,
  compositeModules: any[]
): WallDef[] {
  let polygons: [number, number][][][] = [];

  if (shape === 'rectangle') {
    polygons.push([[[0,0], [widthIn,0], [widthIn,lengthIn], [0,lengthIn], [0,0]]]);
  } else if (shape === 'l-shape') {
    polygons.push([[[0,0], [widthIn,0], [widthIn,lRightDepthIn], [lBackWidthIn,lRightDepthIn], [lBackWidthIn,lengthIn], [0,lengthIn], [0,0]]]);
  } else if (shape === 'u-shape') {
    const u_w1 = uWallsIn.w1;
    const u_w2 = uWallsIn.w2;
    const u_w3 = uWallsIn.w3;
    const u_w4 = uWallsIn.w4;
    const u_w5 = uWallsIn.w5;
    const u_w6 = uWallsIn.w6;
    const u_w7 = uWallsIn.w7;
    const u_w8 = uWallsIn.w8;
    polygons.push([[[0,0], [u_w1,0], [u_w1,u_w2], [u_w1-u_w3,u_w2], [u_w1-u_w3,u_w2-u_w4], [u_w7,u_w2-u_w4], [u_w7,u_w8-u_w6], [u_w7,u_w8], [0,u_w8], [0,0]]]);
  } else if (shape === 'composite') {
    if (compositeModules.length === 0) return [];
    polygons = compositeModules.map(mod => {
      const x = mod.xFt * 12 + mod.xInches;
      const y = mod.yFt * 12 + mod.yInches;
      const w = mod.widthFt * 12 + mod.widthInches;
      const l = mod.lengthFt * 12 + mod.lengthInches;
      return [[[x,y], [x+w,y], [x+w,y+l], [x,y+l], [x,y]]];
    });
  }

  if (polygons.length === 0) return [];

  let union = polygons[0];
  for (let i = 1; i < polygons.length; i++) {
    union = polygonClipping.union(union as any, polygons[i] as any) as any;
  }

  if (!union || union.length === 0 || union[0].length === 0) return [];

  const ring = union[0][0];
  const walls: any[] = [];

  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i+1];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const is_x_dir = Math.abs(dx) > Math.abs(dy);
    
    let start_x, start_y, length, depth, ext_dir;
    let x, y, w, h;

    if (is_x_dir) {
      depth = thicknessIn;
      length = Math.abs(dx);
      start_x = Math.min(p1[0], p2[0]);
      if (dx > 0) {
        start_y = p1[1];
        ext_dir = 0;
        x = start_x; y = start_y; w = length; h = depth;
      } else {
        start_y = p1[1] - thicknessIn;
        ext_dir = 1;
        x = start_x; y = start_y; w = length; h = depth;
      }
    } else {
      depth = thicknessIn;
      length = Math.abs(dy);
      start_y = Math.min(p1[1], p2[1]);
      if (dy > 0) {
        start_x = p1[0] - thicknessIn;
        ext_dir = 1;
        x = start_x; y = start_y; w = depth; h = length;
      } else {
        start_x = p1[0];
        ext_dir = 0;
        x = start_x; y = start_y; w = depth; h = length;
      }
    }
    walls.push({ id: i + 1, start_x, start_y, length, depth, is_x_dir, ext_dir, sh_start: 0, sh_end: 0, dx, dy, p1, p2, x, y, w, h, isHorizontal: is_x_dir });
  }

  // Fix reflex corners
  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    const w2 = walls[(i + 1) % walls.length];
    
    const cp = w1.dx * w2.dy - w1.dy * w2.dx;
    if (cp < 0) {
      // Reflex corner! Extend w1 at the end, w2 at the start
      if (w1.is_x_dir) {
        w1.length += thicknessIn;
        w1.w += thicknessIn;
        if (w1.dx < 0) { w1.start_x -= thicknessIn; w1.x -= thicknessIn; }
      } else {
        w1.length += thicknessIn;
        w1.h += thicknessIn;
        if (w1.dy < 0) { w1.start_y -= thicknessIn; w1.y -= thicknessIn; }
      }
      
      if (w2.is_x_dir) {
        w2.length += thicknessIn;
        w2.w += thicknessIn;
        if (w2.dx > 0) { w2.start_x -= thicknessIn; w2.x -= thicknessIn; }
      } else {
        w2.length += thicknessIn;
        w2.h += thicknessIn;
        if (w2.dy > 0) { w2.start_y -= thicknessIn; w2.y -= thicknessIn; }
      }
    } else {
      // Convex corner! Add sheathing extensions
      w1.sh_end = thicknessIn;
      w2.sh_start = thicknessIn;
    }
  }

  return walls;
}
