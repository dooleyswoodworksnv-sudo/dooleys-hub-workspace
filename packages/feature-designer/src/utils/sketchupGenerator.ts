import { AppState, DoorConfig, WindowConfig, BumpoutConfig, InteriorWallConfig, ExteriorWallConfig, DormerConfig } from '../App';
import { sanitize } from './math';

export type GenerationSection = 'all' | 'foundation' | 'floor' | 'exterior' | 'interior' | number;

export const generateSketchUpCode = (state: AppState, section: GenerationSection = 'all', customTrussScriptContent?: string): string => {
  const {
    shape,
    widthFt, widthInches,
    lengthFt, lengthInches,
    lRightDepthFt, lRightDepthInches,
    lBackWidthFt, lBackWidthInches,
    uWalls, uWallsInches,
    uDirection, lDirection,
    hLeftBarWidthFt, hLeftBarWidthInches,
    hRightBarWidthFt, hRightBarWidthInches,
    hMiddleBarHeightFt, hMiddleBarHeightInches,
    hMiddleBarOffsetFt, hMiddleBarOffsetInches,
    tTopWidthFt, tTopWidthInches,
    tTopLengthFt, tTopLengthInches,
    tStemWidthFt, tStemWidthInches,
    tStemLengthFt, tStemLengthInches,
    wallHeightFt, wallHeightInches,
    wallThicknessIn,
    doors, windows, bumpouts,
    interiorWalls, exteriorWalls,
    studSpacing, studThickness,
    headerType, headerHeight,
    bottomPlates, topPlates,
    doorRoAllowance, windowRoAllowance,
    addSheathing, sheathingThickness, addInsulation, insulationThickness, addDrywall, drywallThickness,
    foundationType, slabThicknessIn, thickenedEdgeDepthIn,
    stemWallHeightIn, stemWallThicknessIn,
    footingWidthIn, footingThicknessIn, foundationShape,
    addFloorFraming, joistSpacing, joistSize, joistDirection,
    addSubfloor, subfloorThickness, subfloorMaterial, rimJoistThickness,
    generateDimensions, solidWallsOnly,
    additionalStories, upperFloorWallHeightFt, upperFloorWallHeightIn, upperFloorJoistSize,
    combinedBlocks, shapeBlocks,
    roofType, roofPitch, roofOverhangIn, trussSpacing, trussType, roofSheathingThickness,
    roofParts, trussRuns, customTrussScript, dormers
  } = state;

  const toInches = (ft: number, inc: number) => sanitize(ft) * 12 + sanitize(inc);
  
  const widthTotal = sanitize(toInches(widthFt, widthInches));
  const lengthTotal = sanitize(toInches(lengthFt, lengthInches));
  const heightTotal = sanitize(toInches(wallHeightFt, wallHeightInches));
  
  const lRightDepthTotal = sanitize(toInches(lRightDepthFt, lRightDepthInches));
  const lBackWidthTotal = sanitize(toInches(lBackWidthFt, lBackWidthInches));

  const hLeftBarWidthTotal = sanitize(toInches(hLeftBarWidthFt, hLeftBarWidthInches));
  const hRightBarWidthTotal = sanitize(toInches(hRightBarWidthFt, hRightBarWidthInches));
  const hMiddleBarHeightTotal = sanitize(toInches(hMiddleBarHeightFt, hMiddleBarHeightInches));
  const hMiddleBarOffsetTotal = sanitize(toInches(hMiddleBarOffsetFt, hMiddleBarOffsetInches));

  const tTopWidthTotal = sanitize(toInches(tTopWidthFt, tTopWidthInches));
  const tTopLengthTotal = sanitize(toInches(tTopLengthFt, tTopLengthInches));
  const tStemWidthTotal = sanitize(toInches(tStemWidthFt, tStemWidthInches));
  const tStemLengthTotal = sanitize(toInches(tStemLengthFt, tStemLengthInches));

  const bumpoutsRuby = bumpouts.map(b => 
    `  {id: '${b.id}', wall: ${b.wall}, x_in: ${toInches(b.xFt, b.xInches)}, width_in: ${sanitize(b.widthIn)}, depth_in: ${sanitize(b.depthIn)}}`
  ).join(",\n");

  const doorsRuby = doors.map(d => 
    `  {id: '${d.id}', wall: ${d.wall}, x_in: ${toInches(d.xFt, d.xInches)}, width_in: ${sanitize(d.widthIn)}, height_in: ${sanitize(d.heightIn)}, floor_index: ${d.floorIndex || 0}}`
  ).join(",\n");

  const windowsRuby = windows.map(w => 
    `  {id: '${w.id}', wall: ${w.wall}, x_in: ${toInches(w.xFt, w.xInches)}, width_in: ${sanitize(w.widthIn)}, height_in: ${sanitize(w.heightIn)}, sill_height_in: ${sanitize(w.sillHeightIn)}, floor_index: ${w.floorIndex || 0}}`
  ).join(",\n");

  const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
  const combinedBlocksRuby = (blocksToUse || []).map(b => 
    `  {id: '${b.id}', x: ${b.x}, y: ${b.y}, w: ${b.w}, h: ${b.h}}`
  ).join(",\n");

  const interiorWallsRuby = interiorWalls.map(w => {
    let x = toInches(w.xFt, w.xInches);
    let y = toInches(w.yFt, w.yInches);
    let len = toInches(w.lengthFt, w.lengthInches);
    const isHorizontal = w.orientation === 'horizontal';
    
    let wid = isHorizontal ? len : w.thicknessIn;
    let h = isHorizontal ? w.thicknessIn : len;
    
    if (wid < 0) {
      x += wid;
      wid = Math.abs(wid);
    }
    if (h < 0) {
      y += h;
      h = Math.abs(h);
    }

    const absLen = Math.abs(len);

    return `  {id: ${w.id}, x_in: ${x}, y_in: ${y}, length_in: ${absLen}, thickness_in: ${w.thicknessIn}, orientation: '${w.orientation}', floor_index: ${w.floorIndex || 0}}`;
  }).join(",\n");

  let allExteriorWalls = [...exteriorWalls];
  if (shape === 'custom') {
    const blocksToUse = (combinedBlocks && combinedBlocks.length > 0) ? combinedBlocks : shapeBlocks;
    
    // Only generate walls from blocks if exteriorWalls is empty (user hasn't "Combined" yet)
    if (allExteriorWalls.length === 0 && blocksToUse && blocksToUse.length > 0) {
      blocksToUse.forEach((block, index) => {
        const baseId = (index + 1) * 100;
        // Top
        allExteriorWalls.push({ id: baseId + 1, orientation: 'horizontal', xFt: 0, xInches: block.x, yFt: 0, yInches: block.y, lengthFt: 0, lengthInches: block.w, thicknessIn: wallThicknessIn, exteriorSide: -1 });
        // Bottom
        allExteriorWalls.push({ id: baseId + 2, orientation: 'horizontal', xFt: 0, xInches: block.x, yFt: 0, yInches: block.y + block.h - wallThicknessIn, lengthFt: 0, lengthInches: block.w, thicknessIn: wallThicknessIn, exteriorSide: 1 });
        // Left
        allExteriorWalls.push({ id: baseId + 3, orientation: 'vertical', xFt: 0, xInches: block.x, yFt: 0, yInches: block.y + wallThicknessIn, lengthFt: 0, lengthInches: block.h - 2 * wallThicknessIn, thicknessIn: wallThicknessIn, exteriorSide: -1 });
        // Right
        allExteriorWalls.push({ id: baseId + 4, orientation: 'vertical', xFt: 0, xInches: block.x + block.w - wallThicknessIn, yFt: 0, yInches: block.y + wallThicknessIn, lengthFt: 0, lengthInches: block.h - 2 * wallThicknessIn, thicknessIn: wallThicknessIn, exteriorSide: 1 });
      });
    }
  }

  const exteriorWallsRuby = allExteriorWalls.map(w => {
    let x = toInches(w.xFt, w.xInches);
    let y = toInches(w.yFt, w.yInches);
    let len = toInches(w.lengthFt, w.lengthInches);
    const isHorizontal = w.orientation === 'horizontal';
    
    let wid = isHorizontal ? len : w.thicknessIn;
    let h = isHorizontal ? w.thicknessIn : len;
    
    if (wid < 0) {
      x += wid;
      wid = Math.abs(wid);
    }
    if (h < 0) {
      y += h;
      h = Math.abs(h);
    }

    if (isHorizontal) {
      if (w.exteriorSide === 1) y -= w.thicknessIn;
    } else {
      if (w.exteriorSide === 1) x -= w.thicknessIn;
    }

    // Pass the absolute length, since we've already adjusted x/y
    const absLen = Math.abs(len);

    return `  {id: ${w.id}, x_in: ${x}, y_in: ${y}, length_in: ${absLen}, thickness_in: ${w.thicknessIn}, orientation: '${w.orientation}', exteriorSide: ${w.exteriorSide}}`;
  }).join(",\n");

  const roofPartsRuby = roofParts.map(r => 
    `  {id: '${r.id}', type: '${r.type}', pitch: ${r.pitch}, width_in: ${r.widthIn}, length_in: ${r.lengthIn}, ridge_direction: '${r.ridgeDirection}', x_in: ${r.x}, y_in: ${r.y}}`
  ).join(",\n");

  const trussRunsRuby = trussRuns.map(t => {
    const cc = t.customCorners;
    const ccRuby = cc ? `, custom_corners: {nw_dx: ${cc.nw.dx}, nw_dy: ${cc.nw.dy}, ne_dx: ${cc.ne.dx}, ne_dy: ${cc.ne.dy}, sw_dx: ${cc.sw.dx}, sw_dy: ${cc.sw.dy}, se_dx: ${cc.se.dx}, se_dy: ${cc.se.dy}}` : '';
    return `  {id: '${t.id}', type: '${t.type}', span_in: ${t.spanFt * 12}, pitch: ${t.pitch}, length_in: ${t.lengthFt * 12}, spacing_in: ${t.spacingIn}, overhang_in: ${t.overhangIn}, heel_height_in: ${t.heelHeightIn}, plies: ${t.plies}, x_in: ${t.x}, y_in: ${t.y}, rotation: ${t.rotation}, ridge_ratio: ${t.ridgeRatio || 50}, fascia_in: ${t.fasciaIn || 0}, roof_style: '${t.roofStyle || 'gable'}'${ccRuby}}`;
  }).join(",\n");

  const dormersRuby = dormers ? dormers.map(d => 
    `  {id: '${d.id}', x_in: ${d.x}, y_in: ${d.y}, width_in: ${d.widthIn}, depth_in: ${d.depthIn}, rotation: ${d.rotation}, pitch: ${d.pitch || 6}, overhang_in: ${d.overhangIn || 12}, fascia_in: ${d.fasciaIn || 0}, wall_height_in: ${d.wallHeightIn || 48}}`
  ).join(",\n") : '';

  const uWallsRuby = Object.keys(uWalls).map(key => {
    const val = sanitize(toInches(uWalls[key as keyof typeof uWalls], uWallsInches[key as keyof typeof uWallsInches]));
    return `u_${key} = ${val}`;
  }).join("\n");

  const totalLength = shape === 'custom' 
    ? (blocksToUse && blocksToUse.length > 0 ? Math.max(...blocksToUse.map(b => sanitize(b.y) + sanitize(b.h))) : lengthTotal)
    : lengthTotal;

  const sectionName = typeof section === 'number' ? `Wall ${section}` : (section === 'all' ? 'House Shell' : section.charAt(0).toUpperCase() + section.slice(1));

  return `# House Shell Generator for SketchUp
# Section: ${sectionName}
# Generated by Blueprint Drafter

puts "Starting House Shell Generator..."
model = Sketchup.active_model
entities = model.active_entities
puts "Model: #{model.title}"
puts "Entities: #{entities.length}"

# --- CONFIGURATION ---
shape = '${shape}'
puts "Shape: #{shape}"
width_in = ${widthTotal}
length_in = ${lengthTotal}
puts "Dimensions: #{width_in}x#{length_in}"
total_length = ${totalLength}
lRightDepthIn = ${lRightDepthTotal}
lBackWidthIn = ${lBackWidthTotal}
hLeftBarWidthIn = ${hLeftBarWidthTotal}
hRightBarWidthIn = ${hRightBarWidthTotal}
hMiddleBarHeightIn = ${hMiddleBarHeightTotal}
hMiddleBarOffsetIn = ${hMiddleBarOffsetTotal}
tTopWidthIn = ${tTopWidthTotal}
tTopLengthIn = ${tTopLengthTotal}
tStemWidthIn = ${tStemWidthTotal}
tStemLengthIn = ${tStemLengthTotal}
${uWallsRuby}
u_direction = '${uDirection}'
l_direction = '${lDirection}'
wall_height_in = ${heightTotal}
wall_thickness_in = ${wallThicknessIn}
foundation_type = '${foundationType}'
slab_thickness = ${slabThicknessIn}
thickened_edge_depth = ${thickenedEdgeDepthIn}
stem_wall_height = ${stemWallHeightIn}
stem_wall_thickness = ${stemWallThicknessIn}
footing_width = ${footingWidthIn}
footing_thickness = ${footingThicknessIn}
foundation_shape = '${foundationShape}'

foundation_height = 0
if foundation_type == 'slab' || foundation_type == 'slab-on-grade'
  foundation_height = slab_thickness
elsif foundation_type != 'none'
  foundation_height = stem_wall_height
end

# --- CUSTOM BLOCKS ---
combined_blocks = [
${combinedBlocksRuby}
]

# --- FLOOR OPTIONS ---
add_floor_framing = ${addFloorFraming ? 'true' : 'false'}
joist_spacing = ${joistSpacing}
joist_size = '${joistSize}'
joist_direction = '${joistDirection}'
add_subfloor = ${addSubfloor ? 'true' : 'false'}
subfloor_thickness = ${subfloorThickness}
rim_joist_thickness = ${rimJoistThickness}

# --- MULTI-STORY OPTIONS ---
additional_stories = ${additionalStories}
upper_floor_wall_height = ${toInches(upperFloorWallHeightFt, upperFloorWallHeightIn)}
upper_floor_joist_size = '${upperFloorJoistSize}'
subfloor_material = '${subfloorMaterial}'

# --- LAYERS ---
add_sheathing = ${addSheathing ? 'true' : 'false'}
sheathing_thickness = ${sheathingThickness}
add_insulation = ${addInsulation ? 'true' : 'false'}
insulation_thickness = ${insulationThickness}
add_drywall = ${addDrywall ? 'true' : 'false'}
drywall_thickness = ${drywallThickness}

# --- COLORS ---
color_sheathing = '#c4a484' # Light Brown
color_insulation = '#f472b6' # Pink
color_drywall = '#ffffff' # White

# --- BUMPOUTS ---
bumpouts = [
${bumpoutsRuby}
]

# --- DOOR PLACEMENT ---
doors = [
${doorsRuby}
]

# --- WINDOW PLACEMENT ---
windows = [
${windowsRuby}
]

# --- INTERIOR WALLS ---
interior_walls = [
${interiorWallsRuby}
]

# --- CUSTOM EXTERIOR WALLS ---
custom_exterior_walls = [
${exteriorWallsRuby}
]

# --- FRAMING OPTIONS ---
stud_spacing = ${studSpacing}
stud_thickness = ${studThickness}
header_type = '${headerType}'
header_height = ${headerHeight}
bottom_plates = ${bottomPlates}
top_plates = ${topPlates}
plate_height = 1.5
door_ro_allowance = ${doorRoAllowance}
window_ro_allowance = ${windowRoAllowance}

# --- DIMENSIONS ---
generate_dimensions = ${generateDimensions ? 'true' : 'false'}
solid_walls_only = ${solidWallsOnly ? 'true' : 'false'}

# --- ROOF FRAMING ---
roof_type = '${roofType}'
roof_pitch = ${roofPitch}
roof_overhang_in = ${roofOverhangIn}
truss_spacing = ${trussSpacing}
truss_type = '${trussType}'
roof_sheathing_thickness = ${roofSheathingThickness}

# --- ROOF PARTS ---
roof_parts = [
${roofPartsRuby}
]

# --- TRUSS RUNS ---
truss_runs = [
${trussRunsRuby}
]

# --- DORMERS ---
dormers = [
${dormersRuby}
]

# -------------------------------

model.start_operation('Generate ${sectionName}', true)
begin
  # --- CLEANUP: Remove any previously generated House Shell groups ---
  old_shells = model.active_entities.select { |e|
    e.is_a?(Sketchup::Group) && e.get_attribute('HouseShell', 'is_shell') == true
  }
  old_shells.each { |g| g.erase! }
  puts "Cleared #{old_shells.length} previous House Shell group(s)." if old_shells.length > 0

  # Create a new shell group at the origin for every generation
  shell_group = model.active_entities.add_group
  shell_group.name = "House Shell"
  shell_group.set_attribute('HouseShell', 'is_shell', true)
  f_ents = shell_group.entities

  # Draw Roof Parts
  roof_parts.each do |part|
    z_height = (part[:width_in] / 2) * (roof_pitch / 12.0)
    
    if part[:type] == 'gable'
      # Simple gable representation
      draw_box.call(f_ents, part[:x_in], part[:y_in], z_height, part[:width_in], part[:length_in], 2, "Gable Roof")
    elsif part[:type] == 'shed'
      draw_box.call(f_ents, part[:x_in], part[:y_in], z_height, part[:width_in], part[:length_in], 2, "Shed Roof")
    elsif part[:type] == 'ridge'
      draw_box.call(f_ents, part[:x_in], part[:y_in], z_height, part[:length_in], 2, 2, "Ridge")
    elsif part[:type] == 'hip'
      draw_box.call(f_ents, part[:x_in], part[:y_in], z_height, part[:length_in], 2, 2, "Hip")
    elsif part[:type] == 'valley'
      draw_box.call(f_ents, part[:x_in], part[:y_in], z_height, part[:length_in], 2, 2, "Valley")
    end
  end

  # Helper to get or create a material
  get_material = -> (name, color_code) {
    mat = model.materials[name]
    mat ||= model.materials.add(name)
    mat.color = color_code
    mat
  }

  # Helper to apply IFC tags and BIM data
  apply_bim_data = -> (group, type) {
    ifc_class = "IfcBuildingElementProxy"
    mat_type = "Generic"
    
    if type == "Wall"
      ifc_class = "IfcWallStandardCase"
      mat_type = "Wood Stud"
    elsif type == "Footing"
      ifc_class = "IfcFooting"
      mat_type = "Concrete"
    elsif type == "Floor"
      ifc_class = "IfcSlab"
      mat_type = "Wood Framing"
    end

    # Set IFC Classification
    if group.respond_to?(:definition)
      group.definition.set_attribute('dynamic_attributes', 'ifc_entity', ifc_class)
    end
    group.set_attribute('dynamic_attributes', 'ifc_entity', ifc_class)

    # Set BIM Data
    group.set_attribute('BIM_Data', 'MaterialType', mat_type)
    group.set_attribute('BIM_Data', 'Spacing', '16"')
    group.set_attribute('BIM_Data', 'LayerThickness', 'Standard')

    # Calculate Volume
    calc_vol = -> (g, filter_name=nil) {
      v = 0.0
      if (filter_name.nil? || (g.respond_to?(:name) && g.name.include?(filter_name))) && g.respond_to?(:volume) && g.volume > 0
        v += g.volume
      elsif g.respond_to?(:entities)
        g.entities.each do |ent|
          if ent.is_a?(Sketchup::Group) || ent.is_a?(Sketchup::ComponentInstance)
            v += calc_vol.call(ent, filter_name)
          end
        end
      end
      v
    }
    
    summary = ""
    
    if type == "Wall"
      stud_vol = calc_vol.call(group, "Stud") + calc_vol.call(group, "Plate") + calc_vol.call(group, "Solid Wall") + calc_vol.call(group, "Header")
      count = (stud_vol / 792.0).ceil
      summary += "\#{count} x 8' studs (approx). " if count > 0
      
      sheath_vol = calc_vol.call(group, "Sheathing")
      count_sh = (sheath_vol / 3456.0).ceil
      summary += "\#{count_sh} x 4x8 sheathing. " if count_sh > 0
      
      dw_vol = calc_vol.call(group, "Drywall")
      count_dw = (dw_vol / 3456.0).ceil
      summary += "\#{count_dw} x 4x8 drywall. " if count_dw > 0
      
    elsif type == "Footing"
      vol = calc_vol.call(group, nil)
      cy = (vol / 46656.0).round(2)
      summary = "\#{cy} cubic yards of concrete"
    elsif type == "Floor"
      joist_vol = calc_vol.call(group, "Joist")
      count = (joist_vol / 792.0).ceil
      summary += "\#{count} x 8' joists (approx). " if count > 0
      
      subfloor_vol = calc_vol.call(group, "Subfloor")
      count_sf = (subfloor_vol / 3456.0).ceil
      summary += "\#{count_sf} x 4x8 subfloor sheets. " if count_sf > 0
    end

    group.set_attribute('dynamic_attributes', 'summary', "Projected Material List: \#{summary}")
  }

  # Helper to draw a box
  draw_box = -> (ents, x, y, z, w, d, h, name, material=nil) {
    w = 0.0 if w.nil? || (w.respond_to?(:nan?) && w.nan?)
    d = 0.0 if d.nil? || (d.respond_to?(:nan?) && d.nan?)
    h = 0.0 if h.nil? || (h.respond_to?(:nan?) && h.nan?)
    return if w <= 0.01 || d <= 0.01 || h <= 0.01
    g = ents.add_group
    g.name = name
    g.layer = model.layers.add(name)
    g.material = material if material
    pts = [[x,y,z], [x+w,y,z], [x+w,y+d,z], [x,y+d,z]]
    face = g.entities.add_face(pts)
    if face
      face.reverse! if face.normal.z < 0
      face.pushpull(h)
    end
  }

  # Helper to draw a header
  draw_header = -> (ents, x, y, z, w_box, d_box, h, type, is_x) {
    if type == 'single'
      hw = is_x ? w_box : stud_thickness
      hd = is_x ? stud_thickness : d_box
      draw_box.call(ents, x, y, z, hw, hd, h, "Header (Single)")
    elsif type == 'double'
      hw = is_x ? w_box : stud_thickness
      hd = is_x ? stud_thickness : d_box
      draw_box.call(ents, x, y, z, hw, hd, h, "Header (Double Ext)")
      ix = is_x ? x : x + w_box - stud_thickness
      iy = is_x ? y + d_box - stud_thickness : y
      draw_box.call(ents, ix, iy, z, hw, hd, h, "Header (Double Int)")
    else
      draw_box.call(ents, x, y, z, w_box, d_box, h, "Header (#{type.upcase})")
    end
  }

  # Helper to draw a wall layer with openings (sheathing/drywall)
  draw_wall_layer = -> (ents, x, y, z_off, w, d, h, is_x, openings, name, material) {
    return if w <= 0.01 || d <= 0.01 || h <= 0.01
    g = ents.add_group
    g.name = name
    g.layer = model.layers.add(name)
    g.material = material if material
    
    if is_x
      pts = [[x, y, z_off], [x + w, y, z_off], [x + w, y, z_off + h], [x, y, z_off + h]]
    else
      pts = [[x, y, z_off], [x, y + d, z_off], [x, y + d, z_off + h], [x, y, z_off + h]]
    end
    
    main_face = g.entities.add_face(pts)
    return unless main_face
    
    openings.each do |op|
      ox = op[:local_ox]
      ow = op[:w]
      oh = op[:h]
      osill = op[:sill] || 0
      
      if is_x
        hole_pts = [
          [x + ox - ow/2.0, y, z_off + osill],
          [x + ox + ow/2.0, y, z_off + osill],
          [x + ox + ow/2.0, y, z_off + osill + oh],
          [x + ox - ow/2.0, y, z_off + osill + oh]
        ]
      else
        hole_pts = [
          [x, y + ox - ow/2.0, z_off + osill],
          [x, y + ox + ow/2.0, z_off + osill],
          [x, y + ox + ow/2.0, z_off + osill + oh],
          [x, y + ox - ow/2.0, z_off + osill + oh]
        ]
      end
      
      begin
        hole_face = g.entities.add_face(hole_pts)
        g.entities.erase_entities(hole_face) if hole_face
      rescue
        # Ignore overlapping opening errors
      end
    end
    
    g.entities.grep(Sketchup::Face).each do |f|
      thickness = is_x ? d : w
      # Ensure face points in a consistent direction before pushpull
      # We want to pushpull "inward" relative to the wall's thickness
      target_cx = x + w/2.0
      target_cy = y + d/2.0
      vec = Geom::Vector3d.new(target_cx - f.bounds.center.x, target_cy - f.bounds.center.y, 0)
      f.reverse! if f.normal.dot(vec) < 0
      f.pushpull(thickness)
    end
  }

  # Helper to subtract intervals
  subtract_intervals = -> (intervals, cut_s, cut_e) {
    res = []
    intervals.each do |s, e|
      if cut_e <= s || cut_s >= e
        res << [s, e]
      else
        res << [s, cut_s] if cut_s > s
        res << [cut_e, e] if cut_e < e
      end
    end
    res
  }
# --- WALL FRAMING SPECIALISTS ---
    
      # 1. Plate Specialist: Handles horizontal lumber (Bottom and Top)
      draw_plates = -> (w_ents, params, openings, w_height, z_off) {
        length, depth, is_x, sx, sy = params.values_at(:len, :dep, :is_x, :sx, :sy)
        
        # Bottom Plates (with door cutouts)
        bp_intervals = [[0, length]]
        openings[:doors].each { |d| bp_intervals = subtract_intervals.call(bp_intervals, d[:os] + stud_thickness, d[:oe] - stud_thickness) }
        
        bottom_plates.times do |i|
          bp_intervals.each do |s, e|
            draw_box.call(w_ents, is_x ? sx + s : sx, is_x ? sy : sy + s, z_off + i * plate_height, 
                          is_x ? (e - s) : depth, is_x ? depth : (e - s), plate_height, "Bottom Plate")
          end
        end
    
        # Top Plates (solid span)
        top_plates.times do |i|
          z = z_off + w_height - (i + 1) * plate_height
          draw_box.call(w_ents, sx, sy, z, is_x ? length : depth, is_x ? depth : length, plate_height, "Top Plate")
        end
      }
    
      # 2. Stud Specialist: Handles vertical layout (Studs, King Studs, Cripples)
      draw_studs = -> (w_ents, params, openings, stud_h, start_z) {
        length, depth, is_x, sx, sy = params.values_at(:len, :dep, :is_x, :sx, :sy)
        positions = (0..(length / stud_spacing).ceil).map { |i| [i * stud_spacing, length - stud_thickness].min }.uniq
        
        # Add framing around all openings (King Studs)
        (openings[:doors] + openings[:windows]).each do |op|
          positions << (op[:os] - stud_thickness) << op[:oe]
        end
        positions = positions.select { |p| p >= 0 && p <= length - stud_thickness + 0.001 }.sort.uniq
    
        positions.each do |pos|
          z_intervals = [[start_z, start_z + stud_h]]
          
          # Subtract openings from the vertical span to create cripple studs
          openings[:doors].each { |d| z_intervals = subtract_intervals.call(z_intervals, 0, d[:h] + header_height) if pos + stud_thickness > d[:os] + 0.001 && pos < d[:oe] - 0.001 }
          openings[:windows].each { |w| z_intervals = subtract_intervals.call(z_intervals, w[:sill] - plate_height, w[:sill] + w[:h] + header_height) if pos + stud_thickness > w[:os] + 0.001 && pos < w[:oe] - 0.001 }
    
          z_intervals.each do |zs, ze|
            next if ze - zs <= 0.001
            is_king = (openings[:doors] + openings[:windows]).any? { |op| (pos - (op[:os] - stud_thickness)).abs < 0.01 || (pos - op[:oe]).abs < 0.01 }
            name = is_king ? "King Stud" : (ze - zs < stud_h - 0.01 ? "Cripple Stud" : "Stud")
            draw_box.call(w_ents, is_x ? sx + pos : sx, is_x ? sy : sy + pos, zs, is_x ? stud_thickness : depth, is_x ? depth : stud_thickness, ze - zs, name)
          end
        end
      }
    
      # 3. Opening Specialist: Headers, Jack Studs, and Sills
      draw_openings_details = -> (w_ents, params, openings, start_z) {
        is_x, sx, sy, depth = params.values_at(:is_x, :sx, :sy, :dep)
    
        (openings[:doors] + openings[:windows]).each do |op|
          x_pos = is_x ? sx + op[:os] : sx
          y_pos = is_x ? sy : sy + op[:os]
          w_box, d_box = is_x ? [op[:w], depth] : [depth, op[:w]]
          
          header_z = op[:sill] ? op[:sill] + op[:h] : op[:h]
          draw_header.call(w_ents, x_pos, y_pos, header_z, w_box, d_box, header_height, header_type, is_x)
    
          # Jack Studs (Trimmers)
          jack_h = header_z - start_z
          if jack_h > 0
            draw_box.call(w_ents, x_pos, y_pos, start_z, is_x ? stud_thickness : depth, is_x ? depth : stud_thickness, jack_h, "Jack Stud")
            rx = is_x ? sx + op[:oe] - stud_thickness : sx
            ry = is_x ? sy : sy + op[:oe] - stud_thickness
            draw_box.call(w_ents, rx, ry, start_z, is_x ? stud_thickness : depth, is_x ? depth : stud_thickness, jack_h, "Jack Stud")
          end
    
          # Window Sill Plate
          if op[:sill]
            draw_box.call(w_ents, is_x ? sx + op[:os] + stud_thickness : sx, is_x ? sy : sy + op[:os] + stud_thickness, op[:sill] - plate_height, 
                          is_x ? op[:w] - 2*stud_thickness : depth, is_x ? depth : op[:w] - 2*stud_thickness, plate_height, "Sill Plate")
          end
        end
      }
    
      # 4. Finish Specialist: Sheathing and Drywall
      draw_finishes = -> (w_ents, params, openings, sh_ext, dw_ext, is_interior, w_height, z_off) {
        length, depth, is_x, sx, sy, ext_dir = params.values_at(:len, :dep, :is_x, :sx, :sy, :ext)
        return unless add_sheathing || add_insulation || add_drywall
        
        layer_openings = (openings[:doors] + openings[:windows]).map { |op| { local_ox: op[:ox], w: op[:w] - (op[:sill] ? 0 : 0), h: op[:h], sill: op[:sill] || 0 } }
    
        if add_sheathing && !is_interior
          sh_x = is_x ? sx - sh_ext[0] : (ext_dir > 0 ? sx + depth : sx - sheathing_thickness)
          sh_y = is_x ? (ext_dir > 0 ? sy + depth : sy - sheathing_thickness) : sy - sh_ext[0]
          mat = get_material.call("Sheathing", color_sheathing)
          draw_wall_layer.call(w_ents, sh_x, sh_y, z_off, is_x ? length + sh_ext[0] + sh_ext[1] : sheathing_thickness, 
                              is_x ? sheathing_thickness : length + sh_ext[0] + sh_ext[1], w_height, is_x, layer_openings, "Sheathing", mat)
        end
    
        if add_insulation
          in_x = is_x ? sx : (sx + (depth - insulation_thickness)/2.0)
          in_y = is_x ? (sy + (depth - insulation_thickness)/2.0) : sy
          mat = get_material.call("Insulation", color_insulation)
          draw_wall_layer.call(w_ents, in_x, in_y, z_off, is_x ? length : insulation_thickness, 
                              is_x ? insulation_thickness : length, w_height, is_x, layer_openings, "Insulation", mat)
        end
    
        if add_drywall
          dw_x = is_x ? sx - dw_ext[0] : (ext_dir > 0 ? sx - drywall_thickness : sx + depth)
          dw_y = is_x ? (ext_dir > 0 ? sy - drywall_thickness : sy + depth) : sy - dw_ext[0]
          mat = get_material.call("Drywall", color_drywall)
          draw_wall_layer.call(w_ents, dw_x, dw_y, z_off, is_x ? length + dw_ext[0] + dw_ext[1] : drywall_thickness, 
                              is_x ? drywall_thickness : length + dw_ext[0] + dw_ext[1], w_height, is_x, layer_openings, "Drywall", mat)
        end
      }
    
      # 5. Dimension Specialist
      draw_dimensions = -> (params, is_int, z_off = 0) {
        return if is_int || !generate_dimensions
        wall_id = params[:id]
        length, depth, is_x, sx, sy, ext_dir = params.values_at(:len, :dep, :is_x, :sx, :sy, :ext)
        
        dim_layer = model.layers["Dimensions"] || model.layers.add("Dimensions")
        
        dim_len = length
        dim_sx = sx
        dim_sy = sy
        
        if shape == 'rectangle'
          if wall_id == 1 || wall_id == 3
            dim_len = width_in
            dim_sx = 0
          elsif wall_id == 2 || wall_id == 4
            dim_len = length_in
            dim_sy = 0
          end
        elsif shape == 'l-shape'
          l1 = lRightDepthIn
          w2 = lBackWidthIn
          if wall_id == 1
            dim_len = width_in
            dim_sx = 0
          elsif wall_id == 2
            dim_len = l1
            dim_sy = 0
          elsif wall_id == 3
            dim_len = width_in - w2
            dim_sx = w2
          elsif wall_id == 4
            dim_len = length_in - l1
            dim_sy = l1
          elsif wall_id == 5
            dim_len = w2
            dim_sx = 0
          elsif wall_id == 6
            dim_len = length_in
            dim_sy = 0
          end
        elsif shape == 'u-shape'
          if wall_id == 1
            dim_len = u_w1
            dim_sx = 0
          elsif wall_id == 2
            dim_len = u_w2
            dim_sy = 0
          elsif wall_id == 3
            dim_len = u_w3
            dim_sx = u_w1 - u_w3
          elsif wall_id == 4
            dim_len = u_w4
            dim_sy = u_w2 - u_w4
          elsif wall_id == 5
            dim_len = u_w5
            dim_sx = u_w7
          elsif wall_id == 6
            dim_len = u_w6
            dim_sy = u_w8 - u_w6
          elsif wall_id == 7
            dim_len = u_w7
            dim_sx = 0
          elsif wall_id == 8
            dim_len = u_w8
            dim_sy = 0
          end
        elsif shape == 'h-shape'
          if wall_id == 1
            dim_len = hLeftBarWidthIn
            dim_sx = 0
          elsif wall_id == 2
            dim_len = hMiddleBarOffsetIn
            dim_sy = 0
          elsif wall_id == 3
            dim_len = length_in - (hMiddleBarOffsetIn + hMiddleBarHeightIn)
            dim_sy = hMiddleBarOffsetIn + hMiddleBarHeightIn
          elsif wall_id == 4
            dim_len = hLeftBarWidthIn
            dim_sx = 0
          elsif wall_id == 5
            dim_len = length_in
            dim_sy = 0
          elsif wall_id == 6
            dim_len = width_in - hLeftBarWidthIn - hRightBarWidthIn
            dim_sx = hLeftBarWidthIn
          elsif wall_id == 7
            dim_len = width_in - hLeftBarWidthIn - hRightBarWidthIn
            dim_sx = hLeftBarWidthIn
          elsif wall_id == 8
            dim_len = hRightBarWidthIn
            dim_sx = width_in - hRightBarWidthIn
          elsif wall_id == 9
            dim_len = length_in
            dim_sy = 0
          elsif wall_id == 10
            dim_len = hRightBarWidthIn
            dim_sx = width_in - hRightBarWidthIn
          elsif wall_id == 11
            dim_len = hMiddleBarOffsetIn
            dim_sy = 0
          elsif wall_id == 12
            dim_len = length_in - (hMiddleBarOffsetIn + hMiddleBarHeightIn)
            dim_sy = hMiddleBarOffsetIn + hMiddleBarHeightIn
          end
        elsif shape == 't-shape'
          if wall_id == 1
            dim_len = tTopWidthIn
            dim_sx = 0
          elsif wall_id == 2
            dim_len = tTopLengthIn
            dim_sy = 0
          elsif wall_id == 3
            dim_len = (tTopWidthIn - tStemWidthIn) / 2
            dim_sx = (tTopWidthIn + tStemWidthIn) / 2
          elsif wall_id == 4
            dim_len = (tTopWidthIn - tStemWidthIn) / 2
            dim_sx = 0
          elsif wall_id == 5
            dim_len = tTopLengthIn
            dim_sy = 0
          elsif wall_id == 6
            dim_len = tStemLengthIn
            dim_sy = tTopLengthIn
          elsif wall_id == 7
            dim_len = tStemWidthIn
            dim_sx = (tTopWidthIn - tStemWidthIn) / 2
          elsif wall_id == 8
            dim_len = tStemLengthIn
            dim_sy = tTopLengthIn
          end
        end
        
        if is_x
          ext_y = ext_dir > 0 ? sy + depth : sy
          pt1 = Geom::Point3d.new(dim_sx, ext_y, z_off)
          pt2 = Geom::Point3d.new(dim_sx + dim_len, ext_y, z_off)
          offset_vec = Geom::Vector3d.new(0, ext_dir * 24, 0)
        else
          ext_x = ext_dir > 0 ? sx + depth : sx
          pt1 = Geom::Point3d.new(ext_x, dim_sy, z_off)
          pt2 = Geom::Point3d.new(ext_x, dim_sy + dim_len, z_off)
          offset_vec = Geom::Vector3d.new(ext_dir * 24, 0, 0)
        end
        
        dim = f_ents.add_dimension_linear(pt1, pt2, offset_vec)
        dim.layer = dim_layer if dim
      }
    
      # 6. Solid Wall Specialist
      draw_solid_walls = -> (w_ents, params, openings) {
        length, depth, is_x, sx, sy = params.values_at(:len, :dep, :is_x, :sx, :sy)
        
        # Create the main face
        pts = is_x ? [
          [sx, sy, 0], [sx + length, sy, 0], [sx + length, sy + depth, 0], [sx, sy + depth, 0]
        ] : [
          [sx, sy, 0], [sx + depth, sy, 0], [sx + depth, sy + length, 0], [sx, sy + length, 0]
        ]
        
        face = w_ents.add_face(pts)
        return unless face
        
        # Cut openings
        openings[:doors].each do |d|
          o_sx = is_x ? d[:os] : sx
          o_sy = is_x ? sy : d[:os]
          o_ex = is_x ? d[:oe] : sx + depth
          o_ey = is_x ? sy + depth : d[:oe]
          
          # Draw opening on the face
          o_pts = [
            [o_sx, o_sy, 0], [o_ex, o_sy, 0], [o_ex, o_ey, 0], [o_sx, o_ey, 0]
          ]
          o_face = w_ents.add_face(o_pts)
          o_face.erase! if o_face
        end
        
        # Pushpull the remaining face to wall height
        face.pushpull(-wall_height_in)
        
        # Now we need to cut windows. Since pushpull creates a solid, we can draw window rectangles on the front face and pushpull them through.
        # Find the front face (the one with normal matching the wall's outward direction)
        # For simplicity, we can just draw a box for each window and subtract it using solid tools, or draw on the face and pushpull.
        # Let's use the draw on face and pushpull method.
        
        # Find the face that corresponds to the front of the wall
        front_face = w_ents.grep(Sketchup::Face).find do |f|
          normal = f.normal
          is_x ? normal.y.abs > 0.9 : normal.x.abs > 0.9
        end
        
        if front_face
          openings[:windows].each do |w|
            # We need to draw the window opening on the front face
            # This is complex in SketchUp Ruby without solid tools.
            # A simpler approach for solid walls is to draw the wall in segments, or use solid boolean operations.
            # Since we want a simple solid wall, let's use the segment approach.
          end
        end
      }
      
      # Let's rewrite draw_solid_walls to use the segment approach, similar to how we draw plates.
      draw_solid_walls_segmented = -> (w_ents, params, openings, w_height, z_off) {
        length, depth, is_x, sx, sy = params.values_at(:len, :dep, :is_x, :sx, :sy)
        
        # Combine and sort all openings
        all_ops = (openings[:doors].map{|d| d.merge(type: :door)} + 
                   openings[:windows].map{|w| w.merge(type: :window)}).sort_by{|o| o[:os]}
        
        current_pos = is_x ? sx : sy
        end_pos = current_pos + length
        
        # Get material for solid walls
        mat = get_material.call("Wall Framing", "#e4e4e7")

        # Draw bottom parts (under windows) and full height parts (between openings)
        all_ops.each do |op|
          # Wall segment before opening
          if op[:os] > current_pos
            seg_len = op[:os] - current_pos
            seg_x = is_x ? current_pos : sx
            seg_y = is_x ? sy : current_pos
            draw_box.call(w_ents, seg_x, seg_y, z_off, is_x ? seg_len : depth, is_x ? depth : seg_len, w_height, "Solid Wall", mat)
          end
          
          # Wall segment under window
          if op[:type] == :window && op[:sill] > 0
            seg_x = is_x ? op[:os] : sx
            seg_y = is_x ? sy : op[:os]
            draw_box.call(w_ents, seg_x, seg_y, z_off, is_x ? op[:w] : depth, is_x ? depth : op[:w], op[:sill], "Solid Wall Under Window", mat)
          end
          
          # Wall segment over opening (header area)
          op_top = op[:type] == :door ? op[:h] : op[:sill] + op[:h]
          if op_top < w_height
            seg_x = is_x ? op[:os] : sx
            seg_y = is_x ? sy : op[:os]
            draw_box.call(w_ents, seg_x, seg_y, z_off + op_top, is_x ? op[:w] : depth, is_x ? depth : op[:w], w_height - op_top, "Solid Wall Over Opening", mat)
          end
          
          current_pos = op[:oe]
        end
        
        # Wall segment after last opening
        if current_pos < end_pos
          seg_len = end_pos - current_pos
          seg_x = is_x ? current_pos : sx
          seg_y = is_x ? sy : current_pos
          draw_box.call(w_ents, seg_x, seg_y, z_off, is_x ? seg_len : depth, is_x ? depth : seg_len, w_height, "Solid Wall", mat)
        end
      }
    
      # --- THE DIRECTOR ---
      draw_wall_framing = -> (wall_id, start_x, start_y, length, depth, is_x_dir, ext_dir, sh_s=0, sh_e=0, dw_s=0, dw_e=0, is_int=false, add_corners=false, target_ents = f_ents, w_height = wall_height_in, z_off = 0, floor_idx = 0) {
        return if "all".to_i > 0 && "all".to_i != wall_id
        
        wall_group = target_ents.add_group
        wall_group.name = "Wall #{wall_id}"
        w_ents = wall_group.entities
    
        # Calculate stud height and start_z for this wall
        curr_stud_h = w_height - (bottom_plates + top_plates) * plate_height
        curr_start_z = z_off + bottom_plates * plate_height

        # Prepare Data Bundles — filter openings by wall_id AND floor_index
        params = {id: wall_id, sx: start_x, sy: start_y, len: length, dep: depth, is_x: is_x_dir, ext: ext_dir}
        openings = {
          doors: doors.select{|d| d[:wall] == wall_id && (d[:floor_index] || 0) == floor_idx}.map{|d| 
            w_total = d[:width_in] + door_ro_allowance + (2 * stud_thickness)
            { ox: d[:x_in], os: d[:x_in] - w_total/2.0, oe: d[:x_in] + w_total/2.0, w: w_total, h: d[:height_in] + door_ro_allowance }
          },
          windows: windows.select{|w| w[:wall] == wall_id && (w[:floor_index] || 0) == floor_idx}.map{|w| 
            w_total = w[:width_in] + window_ro_allowance + (2 * stud_thickness)
            { ox: w[:x_in], os: w[:x_in] - w_total/2.0, oe: w[:x_in] + w_total/2.0, w: w_total, h: w[:height_in] + window_ro_allowance, sill: w[:sill_height_in] }
          }
        }
    
        # Direct the specialists
        if solid_walls_only
          draw_solid_walls_segmented.call(w_ents, params, openings, w_height, z_off)
        else
          draw_plates.call(w_ents, params, openings, w_height, z_off)
          draw_studs.call(w_ents, params, openings, curr_stud_h, curr_start_z)
          draw_openings_details.call(w_ents, params, openings, curr_start_z)
        end
        draw_finishes.call(w_ents, params, openings, [sh_s, sh_e], [dw_s, dw_e], is_int, w_height, z_off)
        draw_dimensions.call(params, is_int, z_off)
        apply_bim_data.call(wall_group, "Wall")
      }
  joist_h = 9.25
  joist_h = 5.5 if joist_size == '2x6'
  joist_h = 7.25 if joist_size == '2x8'
  joist_h = 11.25 if joist_size == '2x12'
  floor_sys_h = add_floor_framing ? (joist_h + (add_subfloor ? subfloor_thickness : 0)) : 0

  # Helper to draw foundation
  draw_foundation = -> (pts_raw) {
    # Find or create foundation group
    fd_group = shell_group.entities.grep(Sketchup::Group).find { |g| g.name == "Foundation" }
    fd_group ||= shell_group.entities.add_group
    fd_group.name = "Foundation"
    fd_ents = fd_group.entities

    pts = pts_raw.map { |p| p.is_a?(Geom::Point3d) ? p : Geom::Point3d.new(p[0], p[1], p[2]) }
    
    if foundation_type == 'slab' || foundation_type == 'slab-on-grade'
      # Shift slab down by floor_sys_h
      slab_group = fd_ents.add_group
      slab_group.name = "Slab"
      slab_pts = pts.map { |p| Geom::Point3d.new(p.x, p.y, -floor_sys_h) }
      face = slab_group.entities.add_face(slab_pts)
      if face
        face.reverse! if face.normal.z > 0 # Ensure it pushpulls downwards
        face.pushpull(slab_thickness) # Slab thickness
      end

      # Draw thickened edge (integral footing) - ONLY for slab-on-grade
      if foundation_type == 'slab-on-grade'
        pts.each_with_index do |p1, i|
          p2 = pts[(i + 1) % pts.length]
          vec = p2 - p1
          len = vec.length
          next if len < 0.1
          
          dir = vec.normalize
          perp = Geom::Vector3d.new(-dir.y, dir.x, 0)
          
          edge_w = 12.0 # Default thickened edge width
          edge_d = thickened_edge_depth - slab_thickness
          
          eg = fd_ents.add_group
          eg.name = "Thickened Edge Segment"
          e_z = -floor_sys_h - slab_thickness
          
          e_pts = [
            [p1.x, p1.y, e_z],
            [p1.offset(perp, edge_w).x, p1.offset(perp, edge_w).y, e_z],
            [p2.offset(perp, edge_w).x, p2.offset(perp, edge_w).y, e_z],
            [p2.x, p2.y, e_z]
          ]
          ef = eg.entities.add_face(e_pts)
          if ef
            ef.reverse! if ef.normal.z > 0 # Ensure it pushpulls downwards
            ef.pushpull(edge_d)
          end
        end
      end
    elsif foundation_type == 'stem-wall'
      # Draw stem wall and footing for each segment of the perimeter
      pts.each_with_index do |p1, i|
        p2 = pts[(i + 1) % pts.length]
        vec = p2 - p1
        len = vec.length
        next if len < 0.1
        
        # Direction and perpendicular vectors for offsetting
        dir = vec.normalize
        perp = Geom::Vector3d.new(-dir.y, dir.x, 0)
        
        # 1. Footing (drawn from bottom up to stem wall base, centered under stem wall)
        fg = fd_ents.add_group
        fg.name = "Footing Segment"
        f_z = -stem_wall_height - footing_thickness - floor_sys_h
        # Offset footing outwards so it's centered under the stem wall
        offset_out = (footing_width - stem_wall_thickness) / 2.0
        p1_f = p1.offset(perp.reverse, offset_out)
        p2_f = p2.offset(perp.reverse, offset_out)
        
        f_pts = [
          [p1_f.x, p1_f.y, f_z],
          [p1_f.offset(perp, footing_width).x, p1_f.offset(perp, footing_width).y, f_z],
          [p2_f.offset(perp, footing_width).x, p2_f.offset(perp, footing_width).y, f_z],
          [p2_f.x, p2_f.y, f_z]
        ]
        ff = fg.entities.add_face(f_pts)
        if ff
          ff.reverse! if ff.normal.z < 0 # Ensure it pushpulls upwards
          ff.pushpull(footing_thickness)
        end

        # 2. Stem Wall (drawn from footing top up to z=0, aligned to exterior perimeter)
        sg = fd_ents.add_group
        sg.name = "Stem Wall Segment"
        s_z = -stem_wall_height - floor_sys_h
        s_pts = [
          [p1.x, p1.y, s_z],
          [p1.offset(perp, stem_wall_thickness).x, p1.offset(perp, stem_wall_thickness).y, s_z],
          [p2.offset(perp, stem_wall_thickness).x, p2.offset(perp, stem_wall_thickness).y, s_z],
          [p2.x, p2.y, s_z]
        ]
        sf = sg.entities.add_face(s_pts)
        if sf
          sf.reverse! if sf.normal.z < 0 # Ensure it pushpulls upwards
          sf.pushpull(stem_wall_height)
        end
      end
    end
    apply_bim_data.call(fd_group, "Footing")
  }

  # Helper to draw floor framing
  draw_floor_framing = -> (pts_raw, target_ents = f_ents, z_off = 0, j_size = joist_size) {
    return if !add_floor_framing
    # Find or create floor group
    fl_group = target_ents.add_group
    fl_group.name = "Floor System"
    fl_ents = fl_group.entities
    
    # Calculate joist height for this floor
    curr_joist_h = 9.25
    curr_joist_h = 5.5 if j_size == '2x6'
    curr_joist_h = 7.25 if j_size == '2x8'
    curr_joist_h = 11.25 if j_size == '2x12'
    curr_floor_sys_h = curr_joist_h + (add_subfloor ? subfloor_thickness : 0)

    # The raw points already carry the correct Z for this floor level.
    # Do NOT add z_off again — upper-story callers embed upper_z directly in p[2].
    pts = pts_raw.map { |p| p.is_a?(Geom::Point3d) ? p : Geom::Point3d.new(p[0], p[1], p[2]) }
    
    # Derive the actual floor-plane Z from the points themselves.
    floor_z = pts.map(&:z).min

    # Calculate local bounds
    min_x = pts.map(&:x).min
    max_x = pts.map(&:x).max
    min_y = pts.map(&:y).min
    max_y = pts.map(&:y).max
    local_w = max_x - min_x
    local_l = max_y - min_y

    if add_subfloor
      sf_group = fl_ents.add_group
      sf_group.name = "Subfloor"
      sf_group.layer = model.layers.add("Subfloor")
      
      # Subfloor sits just below the floor plane (floor_z is the top of the subfloor)
      sf_pts = pts.map { |p| Geom::Point3d.new(p.x, p.y, floor_z - subfloor_thickness) }
      face = sf_group.entities.add_face(sf_pts)
      if face
        face.reverse! if face.normal.z < 0
        face.pushpull(subfloor_thickness)
      end
    end
    
    # Joists Area
    j_group = fl_ents.add_group
    j_group.name = solid_walls_only ? "Solid Floor System" : "Floor Joists"
    j_group.layer = model.layers.add(solid_walls_only ? "Solid Floor System" : "Floor Joists")
    
    # Joists hang below the floor plane by the full floor system height.
    j_z = floor_z - curr_floor_sys_h
    t = 1.5 # Joist thickness
    rt = rim_joist_thickness

    if solid_walls_only
      j_pts = pts.map { |p| Geom::Point3d.new(p.x, p.y, j_z) }
      face = j_group.entities.add_face(j_pts)
      if face
        face.reverse! if face.normal.z < 0
        face.pushpull(curr_joist_h)
      end
      mat = get_material.call("Floor System Solid", "#e4e4e7")
      j_group.material = mat
    elsif joist_direction == 'y'
      # Rim joists (front and back)
      draw_box.call(j_group.entities, min_x, min_y, j_z, local_w, rt, curr_joist_h, "Rim Joist")
      if shape == 'rectangle' || shape == 'custom'
        draw_box.call(j_group.entities, min_x, max_y - rt, j_z, local_w, rt, curr_joist_h, "Rim Joist")
      elsif shape == 'l-shape'
        draw_box.call(j_group.entities, 0, length_in - rt, j_z, lBackWidthIn, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, lBackWidthIn, lRightDepthIn - rt, j_z, width_in - lBackWidthIn, rt, curr_joist_h, "Rim Joist")
      elsif shape == 'u-shape'
        draw_box.call(j_group.entities, 0, u_w8 - rt, j_z, u_w7, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, u_w1 - u_w3, u_w2 - rt, j_z, u_w3, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, u_w7, u_w2 - u_w4 - rt, j_z, u_w1 - u_w3 - u_w7, rt, curr_joist_h, "Rim Joist")
      elsif shape == 'h-shape'
        draw_box.call(j_group.entities, 0, 0, j_z, hLeftBarWidthIn, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, 0, length_in - rt, j_z, hLeftBarWidthIn, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, width_in - hRightBarWidthIn, 0, j_z, hRightBarWidthIn, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, width_in - hRightBarWidthIn, length_in - rt, j_z, hRightBarWidthIn, rt, curr_joist_h, "Rim Joist")
      elsif shape == 't-shape'
        draw_box.call(j_group.entities, 0, 0, j_z, tTopWidthIn, rt, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, (tTopWidthIn - tStemWidthIn) / 2.0, tTopLengthIn + tStemLengthIn - rt, j_z, tStemWidthIn, rt, curr_joist_h, "Rim Joist")
      end

      num_joists = (local_w / joist_spacing).ceil + 1
      num_joists.times do |i|
        jx = min_x + i * joist_spacing
        jx = max_x - t if jx + t > max_x
        
        if shape == 'rectangle' || shape == 'custom'
          draw_box.call(j_group.entities, jx, min_y + rt, j_z, t, local_l - 2 * rt, curr_joist_h, "Floor Joist")
        elsif shape == 'l-shape'
          len = jx < lBackWidthIn ? length_in : lRightDepthIn
          draw_box.call(j_group.entities, jx, rt, j_z, t, len - 2 * rt, curr_joist_h, "Floor Joist")
        elsif shape == 'u-shape'
          if jx < u_w7
            draw_box.call(j_group.entities, jx, rt, j_z, t, u_w8 - 2 * rt, curr_joist_h, "Floor Joist")
          elsif jx < (u_w1 - u_w3)
            draw_box.call(j_group.entities, jx, rt, j_z, t, u_w2 - u_w4 - 2 * rt, curr_joist_h, "Floor Joist")
          else
            draw_box.call(j_group.entities, jx, rt, j_z, t, u_w2 - 2 * rt, curr_joist_h, "Floor Joist")
          end
        elsif shape == 'h-shape'
          if jx < hLeftBarWidthIn || jx > (width_in - hRightBarWidthIn)
            draw_box.call(j_group.entities, jx, rt, j_z, t, length_in - 2 * rt, curr_joist_h, "Floor Joist")
          else
            draw_box.call(j_group.entities, jx, hMiddleBarOffsetIn + rt, j_z, t, hMiddleBarHeightIn - 2 * rt, curr_joist_h, "Floor Joist")
          end
        elsif shape == 't-shape'
          if jx >= (tTopWidthIn - tStemWidthIn) / 2.0 && jx <= (tTopWidthIn + tStemWidthIn) / 2.0
            draw_box.call(j_group.entities, jx, rt, j_z, t, tTopLengthIn + tStemLengthIn - 2 * rt, curr_joist_h, "Floor Joist")
          else
            draw_box.call(j_group.entities, jx, rt, j_z, t, tTopLengthIn - 2 * rt, curr_joist_h, "Floor Joist")
          end
        end
      end
    else
      # Rim joists (left and right)
      draw_box.call(j_group.entities, min_x, min_y, j_z, rt, local_l, curr_joist_h, "Rim Joist")
      if shape == 'rectangle' || shape == 'custom'
        draw_box.call(j_group.entities, max_x - rt, min_y, j_z, rt, local_l, curr_joist_h, "Rim Joist")
      elsif shape == 'l-shape'
        draw_box.call(j_group.entities, width_in - rt, 0, j_z, rt, lRightDepthIn, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, lBackWidthIn - rt, lRightDepthIn, j_z, rt, length_in - lRightDepthIn, curr_joist_h, "Rim Joist")
      elsif shape == 'u-shape'
        draw_box.call(j_group.entities, u_w1 - rt, 0, j_z, rt, u_w2, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, u_w7 - rt, u_w2 - u_w4, j_z, rt, u_w8 - (u_w2 - u_w4), curr_joist_h, "Rim Joist")
      elsif shape == 'h-shape'
        draw_box.call(j_group.entities, 0, 0, j_z, rt, length_in, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, width_in - rt, 0, j_z, rt, length_in, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, hLeftBarWidthIn, hMiddleBarOffsetIn, j_z, rt, hMiddleBarHeightIn, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, width_in - hRightBarWidthIn - rt, hMiddleBarOffsetIn, j_z, rt, hMiddleBarHeightIn, curr_joist_h, "Rim Joist")
      elsif shape == 't-shape'
        draw_box.call(j_group.entities, 0, 0, j_z, rt, tTopLengthIn, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, tTopWidthIn - rt, 0, j_z, rt, tTopLengthIn, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, (tTopWidthIn - tStemWidthIn) / 2.0, tTopLengthIn, j_z, rt, tStemLengthIn, curr_joist_h, "Rim Joist")
        draw_box.call(j_group.entities, (tTopWidthIn + tStemWidthIn) / 2.0 - rt, tTopLengthIn, j_z, rt, tStemLengthIn, curr_joist_h, "Rim Joist")
      end

      num_joists = (local_l / joist_spacing).ceil + 1
      num_joists.times do |i|
        jz = min_y + i * joist_spacing
        jz = max_y - t if jz + t > max_y
        
        if shape == 'rectangle' || shape == 'custom'
          draw_box.call(j_group.entities, min_x + rt, jz, j_z, local_w - 2 * rt, t, curr_joist_h, "Floor Joist")
        elsif shape == 'l-shape'
          wid = jz < lRightDepthIn ? width_in : lBackWidthIn
          draw_box.call(j_group.entities, rt, jz, j_z, wid - 2 * rt, t, curr_joist_h, "Floor Joist")
        elsif shape == 'u-shape'
          if jz < (u_w2 - u_w4)
            draw_box.call(j_group.entities, rt, jz, j_z, u_w1 - 2 * rt, t, curr_joist_h, "Floor Joist")
          else
            # Left leg
            draw_box.call(j_group.entities, rt, jz, j_z, u_w7 - 2 * rt, t, curr_joist_h, "Floor Joist")
            # Right leg
            draw_box.call(j_group.entities, u_w1 - u_w3 + rt, jz, j_z, u_w3 - 2 * rt, t, curr_joist_h, "Floor Joist")
          end
        elsif shape == 'h-shape'
          if jz >= hMiddleBarOffsetIn && jz <= (hMiddleBarOffsetIn + hMiddleBarHeightIn)
            draw_box.call(j_group.entities, rt, jz, j_z, width_in - 2 * rt, t, curr_joist_h, "Floor Joist")
          else
            # Left bar
            draw_box.call(j_group.entities, rt, jz, j_z, hLeftBarWidthIn - 2 * rt, t, curr_joist_h, "Floor Joist")
            # Right bar
            draw_box.call(j_group.entities, width_in - hRightBarWidthIn + rt, jz, j_z, hRightBarWidthIn - 2 * rt, t, curr_joist_h, "Floor Joist")
          end
        elsif shape == 't-shape'
          if jz < tTopLengthIn
            draw_box.call(j_group.entities, rt, jz, j_z, tTopWidthIn - 2 * rt, t, curr_joist_h, "Floor Joist")
          else
            draw_box.call(j_group.entities, (tTopWidthIn - tStemWidthIn) / 2.0 + rt, jz, j_z, tStemWidthIn - 2 * rt, t, curr_joist_h, "Floor Joist")
          end
        end
      end
    end
    apply_bim_data.call(fl_group, "Floor")
  }

  # --- DRAWING LOGIC ---
  w = width_in
  l = length_in
  t = wall_thickness_in

  # 1. Foundation
  if ['all', 'foundation'].include?("${section}") && foundation_type != 'none'
    puts "Generating foundation..."
    if foundation_shape == 'rectangle'
      f_pts = [[0,0,0], [w,0,0], [w,l,0], [0,l,0]]
      draw_foundation.call(f_pts)
    elsif foundation_shape == 'l-shape'
      l1 = lRightDepthIn
      w2 = lBackWidthIn
      f_pts = [[0,0,0], [w,0,0], [w,l1,0], [w2,l1,0], [w2,l,0], [0,l,0]]
      draw_foundation.call(f_pts)
    elsif foundation_shape == 'u-shape'
      f_pts = [[0,0,0], [u_w1,0,0], [u_w1,u_w2,0], [u_w1-u_w3,u_w2,0], [u_w1-u_w3,u_w2-u_w4,0], [u_w1-u_w3-u_w5,u_w2-u_w4,0], [u_w1-u_w3-u_w5,u_w2,0], [0,u_w2,0]]
      draw_foundation.call(f_pts)
    elsif foundation_shape == 'h-shape'
      f_pts = [
        [0, 0, 0], [hLeftBarWidthIn, 0, 0], [hLeftBarWidthIn, hMiddleBarOffsetIn, 0],
        [w - hRightBarWidthIn, hMiddleBarOffsetIn, 0], [w - hRightBarWidthIn, 0, 0], [w, 0, 0],
        [w, l, 0], [w - hRightBarWidthIn, l, 0], [w - hRightBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, 0],
        [hLeftBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, 0], [hLeftBarWidthIn, l, 0], [0, l, 0]
      ]
      draw_foundation.call(f_pts)
    elsif foundation_shape == 't-shape'
      f_pts = [
        [0, 0, 0], [tTopWidthIn, 0, 0], [tTopWidthIn, tTopLengthIn, 0],
        [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn, 0], [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, 0],
        [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, 0], [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn, 0],
        [0, tTopLengthIn, 0]
      ]
      draw_foundation.call(f_pts)
    elsif foundation_shape == 'custom'
      combined_blocks.each do |block|
        f_pts = [
          [block[:x], block[:y], 0],
          [block[:x] + block[:w], block[:y], 0],
          [block[:x] + block[:w], block[:y] + block[:h], 0],
          [block[:x], block[:y] + block[:h], 0]
        ]
        draw_foundation.call(f_pts)
      end
    end
  end

  # 2. Floor Framing
  if ['all', 'floor'].include?("${section}") && add_floor_framing
    puts "Generating floor framing..."
    if shape == 'rectangle'
      f_pts = [[0,0,0], [w,0,0], [w,l,0], [0,l,0]]
      draw_floor_framing.call(f_pts)
    elsif shape == 'l-shape'
      l1 = lRightDepthIn
      w2 = lBackWidthIn
      f_pts = [[0,0,0], [w,0,0], [w,l1,0], [w2,l1,0], [w2,l,0], [0,l,0]]
      draw_floor_framing.call(f_pts)
    elsif shape == 'u-shape'
      f_pts = [[0,0,0], [u_w1,0,0], [u_w1,u_w2,0], [u_w1-u_w3,u_w2,0], [u_w1-u_w3,u_w2-u_w4,0], [u_w1-u_w3-u_w5,u_w2-u_w4,0], [u_w1-u_w3-u_w5,u_w2,0], [0,u_w2,0]]
      draw_floor_framing.call(f_pts)
    elsif shape == 'h-shape'
      f_pts = [
        [0, 0, 0], [hLeftBarWidthIn, 0, 0], [hLeftBarWidthIn, hMiddleBarOffsetIn, 0],
        [w - hRightBarWidthIn, hMiddleBarOffsetIn, 0], [w - hRightBarWidthIn, 0, 0], [w, 0, 0],
        [w, l, 0], [w - hRightBarWidthIn, l, 0], [w - hRightBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, 0],
        [hLeftBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, 0], [hLeftBarWidthIn, l, 0], [0, l, 0]
      ]
      draw_floor_framing.call(f_pts)
    elsif shape == 't-shape'
      f_pts = [
        [0, 0, 0], [tTopWidthIn, 0, 0], [tTopWidthIn, tTopLengthIn, 0],
        [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn, 0], [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, 0],
        [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, 0], [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn, 0],
        [0, tTopLengthIn, 0]
      ]
      draw_floor_framing.call(f_pts)
    elsif shape == 'custom'
      combined_blocks.each do |block|
        f_pts = [
          [block[:x], block[:y], 0],
          [block[:x] + block[:w], block[:y], 0],
          [block[:x] + block[:w], block[:y] + block[:h], 0],
          [block[:x], block[:y] + block[:h], 0]
        ]
        draw_floor_framing.call(f_pts)
      end
    end
  end

  # 3. Exterior Walls
  if ['all', 'exterior'].include?("${section}") || "${section}".to_i > 0
    puts "Generating exterior walls..."
    if shape == 'rectangle'
      draw_wall_framing.call(1, 0, 0, width_in, wall_thickness_in, true, -1, 0.5, 0.5, -wall_thickness_in, -wall_thickness_in)
      draw_wall_framing.call(3, 0, length_in-wall_thickness_in, width_in, wall_thickness_in, true, 1, 0.5, 0.5, -wall_thickness_in, -wall_thickness_in)
      draw_wall_framing.call(4, 0, wall_thickness_in, length_in - 2*wall_thickness_in, wall_thickness_in, false, -1, wall_thickness_in, wall_thickness_in, 0, 0)
      draw_wall_framing.call(2, width_in-wall_thickness_in, wall_thickness_in, length_in - 2*wall_thickness_in, wall_thickness_in, false, 1, wall_thickness_in, wall_thickness_in, 0, 0)
    elsif shape == 'l-shape'
      l1 = lRightDepthIn
      w2 = lBackWidthIn
      t = wall_thickness_in
      draw_wall_framing.call(1, 0, 0, width_in, t, true, -1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(2, width_in-t, t, l1-t, t, false, 1, t, 0, 0, -t - 0.5)
      draw_wall_framing.call(3, w2-t, l1-t, width_in - w2, t, true, 1, -t, t + 0.5, 0.5, -t)
      draw_wall_framing.call(4, w2-t, l1, length_in - l1 - t, t, false, 1, -0.5, t, t + 0.5, 0)
      draw_wall_framing.call(5, 0, length_in-t, w2, t, true, 1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(6, 0, t, length_in - 2*t, t, false, -1, t, t, 0, 0)
    elsif shape == 'u-shape'
      t = wall_thickness_in
      # Wall 1: Base
      draw_wall_framing.call(1, 0, 0, u_w1, t, true, -1, 0.5, 0.5, -t, -t)
      # Wall 2: Right outer
      draw_wall_framing.call(2, u_w1-t, t, u_w2-t, t, false, 1, t, 0, 0, -t-0.5)
      # Wall 3: Right end
      draw_wall_framing.call(3, u_w1-u_w3, u_w2-t, u_w3, t, true, 1, -t, t+0.5, 0.5, -t)
      # Wall 4: Right inner
      draw_wall_framing.call(4, u_w1-u_w3, u_w2-u_w4, u_w4-t, t, false, -1, -0.5, t, t+0.5, 0)
      # Wall 5: Middle
      draw_wall_framing.call(5, u_w7-t, u_w2-u_w4-t, u_w5+2*t, t, true, 1, -t, -t, t+0.5, t+0.5)
      # Wall 6: Left inner
      draw_wall_framing.call(6, u_w7-t, u_w8-u_w6, u_w6-t, t, false, 1, t, -0.5, 0, t+0.5)
      # Wall 7: Left end
      draw_wall_framing.call(7, 0, u_w8-t, u_w7, t, true, 1, 0.5, -t, -t, 0.5)
      # Wall 8: Left outer
      draw_wall_framing.call(8, 0, t, u_w8-2*t, t, false, -1, t, t, 0, 0)
    elsif shape == 'h-shape'
      t = wall_thickness_in
      # Left Bar
      draw_wall_framing.call(1, 0, 0, hLeftBarWidthIn, t, true, -1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(2, hLeftBarWidthIn-t, t, hMiddleBarOffsetIn-t, t, false, 1, t, 0, 0, -t)
      draw_wall_framing.call(3, hLeftBarWidthIn-t, hMiddleBarOffsetIn+hMiddleBarHeightIn, l - (hMiddleBarOffsetIn+hMiddleBarHeightIn) - t, t, false, 1, 0, t, -t, 0)
      draw_wall_framing.call(4, 0, l-t, hLeftBarWidthIn, t, true, 1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(5, 0, t, l-2*t, t, false, -1, t, t, 0, 0)
      # Middle Bar
      draw_wall_framing.call(6, hLeftBarWidthIn-t, hMiddleBarOffsetIn, w - hLeftBarWidthIn - hRightBarWidthIn + 2*t, t, true, -1, -t, -t, t, t)
      draw_wall_framing.call(7, hLeftBarWidthIn-t, hMiddleBarOffsetIn+hMiddleBarHeightIn-t, w - hLeftBarWidthIn - hRightBarWidthIn + 2*t, t, true, 1, -t, -t, t, t)
      # Right Bar
      draw_wall_framing.call(8, w-hRightBarWidthIn, 0, hRightBarWidthIn, t, true, -1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(9, w-t, t, l-2*t, t, false, 1, t, t, 0, 0)
      draw_wall_framing.call(10, w-hRightBarWidthIn, l-t, hRightBarWidthIn, t, true, 1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(11, w-hRightBarWidthIn, t, hMiddleBarOffsetIn-t, t, false, -1, t, 0, 0, -t)
      draw_wall_framing.call(12, w-hRightBarWidthIn, hMiddleBarOffsetIn+hMiddleBarHeightIn, l - (hMiddleBarOffsetIn+hMiddleBarHeightIn) - t, t, false, -1, 0, t, -t, 0)
    elsif shape == 't-shape'
      t = wall_thickness_in
      # Top Bar
      draw_wall_framing.call(1, 0, 0, tTopWidthIn, t, true, -1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(2, tTopWidthIn-t, t, tTopLengthIn-2*t, t, false, 1, t, t, 0, 0)
      draw_wall_framing.call(3, (tTopWidthIn+tStemWidthIn)/2, tTopLengthIn-t, (tTopWidthIn-tStemWidthIn)/2, t, true, 1, -t, 0.5, 0.5, -t)
      draw_wall_framing.call(4, 0, tTopLengthIn-t, (tTopWidthIn-tStemWidthIn)/2, t, true, 1, 0.5, -t, -t, 0.5)
      draw_wall_framing.call(5, 0, t, tTopLengthIn-2*t, t, false, -1, t, t, 0, 0)
      # Stem
      draw_wall_framing.call(6, (tTopWidthIn+tStemWidthIn)/2-t, tTopLengthIn-t, tStemLengthIn, t, false, 1, -t, 0.5, 0.5, -t)
      draw_wall_framing.call(7, (tTopWidthIn-tStemWidthIn)/2, tTopLengthIn+tStemLengthIn-t, tStemWidthIn, t, true, 1, 0.5, 0.5, -t, -t)
      draw_wall_framing.call(8, (tTopWidthIn-tStemWidthIn)/2, tTopLengthIn-t, tStemLengthIn, t, false, -1, -t, 0.5, 0.5, -t)
    elsif shape == 'custom'
      custom_exterior_walls.each do |ew|
        # For custom walls, we just use 0 extensions for now to avoid complexity, or simple overlap
        draw_wall_framing.call(ew[:id], ew[:x_in], ew[:y_in], ew[:length_in], ew[:thickness_in], ew[:orientation] == 'horizontal', ew[:exteriorSide], 0, 0, 0, 0, false, true)
      end
    end
  end

  # 4. Interior Walls
  if ['all', 'interior'].include?("${section}") || "${section}".to_i > 0
    puts "Generating interior walls..."
    interior_walls.select{|iw| (iw[:floor_index] || 0) == 0}.each do |iw|
      draw_wall_framing.call(iw[:id], iw[:x_in], iw[:y_in], iw[:length_in], iw[:thickness_in], iw[:orientation] == 'horizontal', 1, 0, 0, 0, 0, true, false)
    end
  end

  # 5. Upper Stories — floor framing + walls for each additional story
  if ['all', 'exterior', 'interior', 'floor'].include?("${section}") && additional_stories > 0
    puts "Generating upper stories..."
    upper_z = wall_height_in
    
    additional_stories.times do |story_i|
      floor_num = story_i + 1
      upper_joist_h = upper_floor_joist_size == '2x6' ? 5.5 : upper_floor_joist_size == '2x8' ? 7.25 : upper_floor_joist_size == '2x10' ? 9.25 : 11.25
      upper_floor_sys_h = upper_joist_h + (add_subfloor ? subfloor_thickness : 0)
      
      # Upper story wall Z offset (this is the top of the upper floor system)
      wall_z = upper_z + upper_floor_sys_h

      # Upper floor framing
      if ['all', 'floor'].include?("${section}") && add_floor_framing
        puts "Generating floor #{floor_num + 1} framing at z=#{wall_z}..."
        if shape == 'rectangle'
          f_pts = [[0,0,wall_z], [w,0,wall_z], [w,l,wall_z], [0,l,wall_z]]
          draw_floor_framing.call(f_pts, f_ents, wall_z, upper_floor_joist_size)
        elsif shape == 'l-shape'
          l1 = lRightDepthIn
          w2 = lBackWidthIn
          f_pts = [[0,0,wall_z], [w,0,wall_z], [w,l1,wall_z], [w2,l1,wall_z], [w2,l,wall_z], [0,l,wall_z]]
          draw_floor_framing.call(f_pts, f_ents, wall_z, upper_floor_joist_size)
        elsif shape == 'u-shape'
          f_pts = [[0,0,wall_z], [u_w1,0,wall_z], [u_w1,u_w2,wall_z], [u_w1-u_w3,u_w2,wall_z], [u_w1-u_w3,u_w2-u_w4,wall_z], [u_w1-u_w3-u_w5,u_w2-u_w4,wall_z], [u_w1-u_w3-u_w5,u_w2,wall_z], [0,u_w2,wall_z]]
          draw_floor_framing.call(f_pts, f_ents, wall_z, upper_floor_joist_size)
        elsif shape == 'h-shape'
          f_pts = [
            [0, 0, wall_z], [hLeftBarWidthIn, 0, wall_z], [hLeftBarWidthIn, hMiddleBarOffsetIn, wall_z],
            [w - hRightBarWidthIn, hMiddleBarOffsetIn, wall_z], [w - hRightBarWidthIn, 0, wall_z], [w, 0, wall_z],
            [w, l, wall_z], [w - hRightBarWidthIn, l, wall_z], [w - hRightBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, wall_z],
            [hLeftBarWidthIn, hMiddleBarOffsetIn + hMiddleBarHeightIn, wall_z], [hLeftBarWidthIn, l, wall_z], [0, l, wall_z]
          ]
          draw_floor_framing.call(f_pts, f_ents, wall_z, upper_floor_joist_size)
        elsif shape == 't-shape'
          f_pts = [
            [0, 0, wall_z], [tTopWidthIn, 0, wall_z], [tTopWidthIn, tTopLengthIn, wall_z],
            [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn, wall_z], [(tTopWidthIn + tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, wall_z],
            [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn + tStemLengthIn, wall_z], [(tTopWidthIn - tStemWidthIn) / 2, tTopLengthIn, wall_z],
            [0, tTopLengthIn, wall_z]
          ]
          draw_floor_framing.call(f_pts, f_ents, wall_z, upper_floor_joist_size)
        end
      end
      
      # Upper story exterior walls
      if ['all', 'exterior'].include?("${section}")
        puts "Generating floor #{floor_num + 1} exterior walls at z=#{wall_z}..."
        if shape == 'rectangle'
          t = wall_thickness_in
          draw_wall_framing.call(1, 0, 0, width_in, t, true, -1, 0.5, 0.5, -t, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(3, 0, length_in-t, width_in, t, true, 1, 0.5, 0.5, -t, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(4, 0, t, length_in - 2*t, t, false, -1, t, t, 0, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(2, width_in-t, t, length_in - 2*t, t, false, 1, t, t, 0, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
        elsif shape == 'l-shape'
          l1 = lRightDepthIn
          w2 = lBackWidthIn
          t = wall_thickness_in
          draw_wall_framing.call(1, 0, 0, width_in, t, true, -1, 0.5, 0.5, -t, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(2, width_in-t, t, l1-t, t, false, 1, t, 0, 0, -t - 0.5, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(3, w2-t, l1-t, width_in - w2, t, true, 1, -t, t + 0.5, 0.5, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(4, w2-t, l1, length_in - l1 - t, t, false, 1, -0.5, t, t + 0.5, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(5, 0, length_in-t, w2, t, true, 1, 0.5, 0.5, -t, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(6, 0, t, length_in - 2*t, t, false, -1, t, t, 0, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
        elsif shape == 'u-shape'
          t = wall_thickness_in
          draw_wall_framing.call(1, 0, 0, u_w1, t, true, -1, 0.5, 0.5, -t, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(2, u_w1-t, t, u_w2-t, t, false, 1, t, 0, 0, -t-0.5, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(3, u_w1-u_w3, u_w2-t, u_w3, t, true, 1, -t, t+0.5, 0.5, -t, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(4, u_w1-u_w3, u_w2-u_w4, u_w4-t, t, false, -1, -0.5, t, t+0.5, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(5, u_w7-t, u_w2-u_w4-t, u_w5+2*t, t, true, 1, -t, -t, t+0.5, t+0.5, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(6, u_w7-t, u_w8-u_w6, u_w6-t, t, false, 1, t, -0.5, 0, t+0.5, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(7, 0, u_w8-t, u_w7, t, true, 1, 0.5, -t, -t, 0.5, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
          draw_wall_framing.call(8, 0, t, u_w8-2*t, t, false, -1, t, t, 0, 0, false, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
        elsif shape == 'custom'
          custom_exterior_walls.each do |ew|
            draw_wall_framing.call(ew[:id], ew[:x_in], ew[:y_in], ew[:length_in], ew[:thickness_in], ew[:orientation] == 'horizontal', ew[:exteriorSide], 0, 0, 0, 0, false, true, f_ents, upper_floor_wall_height, wall_z, floor_num)
          end
        end
      end
      
      # Upper story interior walls
      if ['all', 'interior'].include?("${section}")
        puts "Generating floor #{floor_num + 1} interior walls at z=#{wall_z}..."
        interior_walls.select{|iw| (iw[:floor_index] || 0) == floor_num}.each do |iw|
          draw_wall_framing.call(iw[:id], iw[:x_in], iw[:y_in], iw[:length_in], iw[:thickness_in], iw[:orientation] == 'horizontal', 1, 0, 0, 0, 0, true, false, f_ents, upper_floor_wall_height, wall_z, floor_num)
        end
      end
      
      upper_z += upper_floor_sys_h + upper_floor_wall_height
    end
  end

  # --- FINAL ORIENTATION ADJUSTMENT ---
  # Flip Y axis so that the bottom of the plan (front of house) is at Y=0 in SketchUp
  if total_length > 0
    flip_trans = Geom::Transformation.scaling(1, -1, 1)
    move_trans = Geom::Transformation.new([0, total_length, 0])
    shell_group.transform!(move_trans * flip_trans)
  end

  # Calculate roof base height
  roof_base_y = wall_height_in
  
  additional_stories.times do
    upper_joist_h = upper_floor_joist_size == '2x6' ? 5.5 : upper_floor_joist_size == '2x8' ? 7.25 : upper_floor_joist_size == '2x10' ? 9.25 : 11.25
    upper_floor_system_h = upper_joist_h + (add_subfloor ? subfloor_thickness : 0)
    roof_base_y += upper_floor_system_h + upper_floor_wall_height
  end

  # --- ROOF GENERATION ---
  if truss_runs.length > 0
    puts "Generating Truss Runs..."
    mat_framing = get_material.call("Roof Framing", "#e5e7eb")
    
${customTrussScriptContent ? customTrussScriptContent : `
    truss_runs.each do |run|
      w = run[:rotation] == 0 ? run[:length_in] : run[:span_in]
      d = run[:rotation] == 0 ? run[:span_in] : run[:length_in]
      rx = run[:x_in] - w / 2.0
      rz = run[:y_in] - d / 2.0
      y = roof_base_y

      if run[:spacing_in] > 0
        span = run[:span_in]
        pitch = run[:pitch]
        theta = Math.atan(pitch / 12.0)
        overhang = run[:overhang_in] || 12.0
        w_member = 3.5
        thickness = 1.5
        
        top_chord_length = (span / 2.0 + overhang) / Math.cos(theta)
        height = (span / 2.0) * (pitch / 12.0)
        
        tc_left_cx = (-span / 2.0 - overhang) / 2.0
        tc_cy = w_member + (height - overhang * (pitch / 12.0)) / 2.0 + (w_member / 2.0) / Math.cos(theta)
        tc_right_cx = (span / 2.0 + overhang) / 2.0
        
        get_top_chord_y = -> (x) {
          w_member + (span / 2.0 - x.abs) * Math.tan(theta) + (w_member / 2.0) / Math.cos(theta)
        }
        
        if run[:type] == 'Solid Shell'
          g = f_ents.add_group
          g.name = "Roof Shell"
          g.material = get_material.call("Roof Shell", "#9ca3af")
          
          eave_drop = overhang * (pitch / 12.0)
          ratio = run[:ridge_ratio] ? (run[:ridge_ratio] / 100.0) : 0.5
          fascia = run[:fascia_in] || 0
          shell_height = (span / 2.0) * (pitch / 12.0) + eave_drop
          roof_style = run[:roof_style] || 'gable'
          
          if run[:custom_corners]
            cc = run[:custom_corners]
            # Custom corners: each corner has dx/dy offsets from its default position
            # 2D x -> Ruby X, 2D y -> Ruby Y, height -> Ruby Z
            nw_x = rx + cc[:nw_dx]
            nw_y = rz + cc[:nw_dy]
            ne_x = rx + w + cc[:ne_dx]
            ne_y = rz + cc[:ne_dy]
            sw_x = rx + cc[:sw_dx]
            sw_y = rz + d + cc[:sw_dy]
            se_x = rx + w + cc[:se_dx]
            se_y = rz + d + cc[:se_dy]
            
            # Ridge runs between left-edge midpoint and right-edge midpoint
            ridge_lx = nw_x + (sw_x - nw_x) * ratio
            ridge_ly = nw_y + (sw_y - nw_y) * ratio
            ridge_rx = ne_x + (se_x - ne_x) * ratio
            ridge_ry = ne_y + (se_y - ne_y) * ratio
            
            # Corner points with overhang
            ov_nw = [nw_x - overhang, nw_y - overhang, y - eave_drop]
            ov_ne = [ne_x + overhang, ne_y - overhang, y - eave_drop]
            ov_sw = [sw_x - overhang, sw_y + overhang, y - eave_drop]
            ov_se = [se_x + overhang, se_y + overhang, y - eave_drop]
            ridge_l = [ridge_lx, ridge_ly, y + shell_height]
            ridge_r = [ridge_rx, ridge_ry, y + shell_height]
            
            begin
              # Front slope (NW -> NE -> ridge)
              g.entities.add_face(ov_nw, ov_ne, ridge_r, ridge_l) rescue nil
              # Back slope (SE -> SW -> ridge)
              g.entities.add_face(ov_se, ov_sw, ridge_l, ridge_r) rescue nil
              # Front end gable (NW -> NE triangle)
              g.entities.add_face(ov_nw, ov_ne, ridge_r, ridge_l) rescue nil
              # Bottom
              g.entities.add_face(ov_nw, ov_ne, ov_se, ov_sw) rescue nil
            rescue => e
              puts "Failed to draw Custom Solid Shell: #{e.message}"
            end
          elsif roof_style == 'hip'
            # Hip roof: 4 trapezoidal/triangular faces
            ow = w + 2 * overhang
            od = d + 2 * overhang
            ox = rx - overhang
            oz = rz - overhang
            eave_y = y - eave_drop
            ridge_y = y + shell_height
            
            # Inset for hip ends
            span_to_ridge = [od * ratio, od * (1 - ratio)].min
            hip_inset = [ow / 2.0, span_to_ridge].min
            
            begin
              if run[:rotation] == 0
                # Ridge runs along X, span along Y (in SketchUp coords)
                ridge_z = oz + od * ratio
                ridge_l = [ox + hip_inset, ridge_z, ridge_y]
                ridge_r = [ox + ow - hip_inset, ridge_z, ridge_y]
                
                nw = [ox, oz, eave_y]
                ne = [ox + ow, oz, eave_y]
                sw = [ox, oz + od, eave_y]
                se = [ox + ow, oz + od, eave_y]
                
                # Front slope (north)
                g.entities.add_face(nw, ne, ridge_r, ridge_l) rescue nil
                # Back slope (south)
                g.entities.add_face(se, sw, ridge_l, ridge_r) rescue nil
                # Left hip end
                g.entities.add_face(nw, ridge_l, sw) rescue nil
                # Right hip end
                g.entities.add_face(ne, se, ridge_r) rescue nil
                # Bottom
                g.entities.add_face(nw, ne, se, sw) rescue nil
              else
                # Ridge runs along Y, span along X
                ridge_x = ox + ow * ratio
                ridge_l = [ridge_x, oz + hip_inset, ridge_y]
                ridge_r = [ridge_x, oz + od - hip_inset, ridge_y]
                
                nw = [ox, oz, eave_y]
                ne = [ox + ow, oz, eave_y]
                sw = [ox, oz + od, eave_y]
                se = [ox + ow, oz + od, eave_y]
                
                # Left slope (west)
                g.entities.add_face(nw, sw, ridge_r, ridge_l) rescue nil
                # Right slope (east)
                g.entities.add_face(se, ne, ridge_l, ridge_r) rescue nil
                # Front hip end
                g.entities.add_face(nw, ridge_l, ne) rescue nil
                # Back hip end
                g.entities.add_face(sw, se, ridge_r) rescue nil
                # Bottom
                g.entities.add_face(nw, ne, se, sw) rescue nil
              end
            rescue => e
              puts "Failed to draw Hip Solid Shell: #{e.message}"
            end
          elsif roof_style == 'shed'
            # Shed roof: single sloped plane from high edge to low edge
            ow = w + 2 * overhang
            od = d + 2 * overhang
            ox = rx - overhang
            oz = rz - overhang
            shed_rise = (run[:span_in]) * (pitch / 12.0)  # full span rise (not half like gable)
            high_y = y + shed_rise + eave_drop  # high eave with overhang extension
            low_y = y  # low edge sits at wall top
            
            begin
              if run[:rotation] == 0
                # High edge at front (small Y), low edge at back (large Y)
                # End profile for pushpull
                pts = [
                  [ox, oz, low_y],
                  [ox, oz, high_y],
                  [ox, oz + od, low_y]
                ]
                face = g.entities.add_face(pts)
                dist = face.normal.x > 0 ? ow : -ow
                face.pushpull(dist)
              else
                # High edge at left (small X), low edge at right (large X)
                pts = [
                  [ox, oz, low_y],
                  [ox, oz, high_y],
                  [ox + ow, oz, low_y]
                ]
                face = g.entities.add_face(pts)
                dist = face.normal.y > 0 ? od : -od
                face.pushpull(dist)
              end
            rescue => e
              puts "Failed to draw Shed Solid Shell: #{e.message}"
            end
          elsif roof_style == 'flat'
            # Flat roof: horizontal slab at wall top
            ow = w + 2 * overhang
            od = d + 2 * overhang
            ox = rx - overhang
            oz = rz - overhang
            flat_y = y + 2  # slight offset above wall top
            slab_thickness = (fascia > 0) ? fascia : 6  # use FASCIA (IN) input for flat roof thickness
            
            begin
              pts = [
                [ox, oz, flat_y],
                [ox + ow, oz, flat_y],
                [ox + ow, oz + od, flat_y],
                [ox, oz + od, flat_y]
              ]
              face = g.entities.add_face(pts)
              if face
                face.reverse! if face.normal.z < 0
                face.pushpull(slab_thickness)
              end
            rescue => e
              puts "Failed to draw Flat Solid Shell: #{e.message}"
            end
          elsif run[:rotation] == 0
            # Gable: pushpull a triangular/pentagonal profile along X
            if fascia > 0
              pts = [
                [rx - overhang, rz - overhang, y - eave_drop],
                [rx - overhang, rz + d + overhang, y - eave_drop],
                [rx - overhang, rz + d + overhang, y - eave_drop + fascia],
                [rx - overhang, rz + d * ratio, y + shell_height + fascia],
                [rx - overhang, rz - overhang, y - eave_drop + fascia]
              ]
            else
              pts = [
                [rx - overhang, rz - overhang, y - eave_drop],
                [rx - overhang, rz + d + overhang, y - eave_drop],
                [rx - overhang, rz + d * ratio, y + shell_height]
              ]
            end
            begin
              face = g.entities.add_face(pts)
              dist = face.normal.x > 0 ? (w + 2*overhang) : -(w + 2*overhang)
              face.pushpull(dist)
            rescue => e
              puts "Failed to draw Solid Shell: #{e.message}"
            end
          else
            # Gable: pushpull a triangular/pentagonal profile along Y
            if fascia > 0
              pts = [
                [rx - overhang, rz - overhang, y - eave_drop],
                [rx + w + overhang, rz - overhang, y - eave_drop],
                [rx + w + overhang, rz - overhang, y - eave_drop + fascia],
                [rx + w * ratio, rz - overhang, y + shell_height + fascia],
                [rx - overhang, rz - overhang, y - eave_drop + fascia]
              ]
            else
              pts = [
                [rx - overhang, rz - overhang, y - eave_drop],
                [rx + w + overhang, rz - overhang, y - eave_drop],
                [rx + w * ratio, rz - overhang, y + shell_height]
              ]
            end
            begin
              face = g.entities.add_face(pts)
              dist = face.normal.y > 0 ? (d + 2*overhang) : -(d + 2*overhang)
              face.pushpull(dist)
            rescue => e
              puts "Failed to draw Solid Shell: #{e.message}"
            end
          end
        elsif run[:rotation] == 0
          num_trusses = (w / run[:spacing_in]).floor + 1
          num_trusses.times do |j|
            tx = rx + j * run[:spacing_in] - thickness / 2.0
            tx_world = tx + thickness / 2.0
            
            # Check dormer intersection
            intersected = dormers.find do |dorm|
              dw = dorm[:rotation] == 0 ? dorm[:width_in] : dorm[:depth_in]
              (tx_world >= dorm[:x_in] - dw/2.0) && (tx_world <= dorm[:x_in] + dw/2.0)
            end
            
            cuts_left = false
            cuts_right = false
            if intersected
              if intersected[:y_in] < rz + d/2.0
                cuts_left = true
              else
                cuts_right = true
              end
            end
            
            g = f_ents.add_group
            g.name = intersected ? "Truss (Cut for Dormer)" : "Truss"
            g.material = mat_framing
            
            # Bottom chord
            draw_box.call(g.entities, -span/2.0, 0, 0, span, w_member, thickness, "Bottom Chord", mat_framing)
            
            # Left top chord
            unless cuts_left
              g_ltc = g.entities.add_group
              g_ltc.name = "Top Chord Left"
              g_ltc.material = mat_framing
              draw_box.call(g_ltc.entities, -top_chord_length/2.0, -w_member/2.0, 0, top_chord_length, w_member, thickness, "Top Chord Left", mat_framing)
              trans_ltc = Geom::Transformation.new([tc_left_cx, tc_cy, 0])
              rot_ltc = Geom::Transformation.rotation([0,0,0], [0,0,1], theta)
              g_ltc.transform!(trans_ltc * rot_ltc)
            end
            
            # Right top chord
            unless cuts_right
              g_rtc = g.entities.add_group
              g_rtc.name = "Top Chord Right"
              g_rtc.material = mat_framing
              draw_box.call(g_rtc.entities, -top_chord_length/2.0, -w_member/2.0, 0, top_chord_length, w_member, thickness, "Top Chord Right", mat_framing)
              trans_rtc = Geom::Transformation.new([tc_right_cx, tc_cy, 0])
              rot_rtc = Geom::Transformation.rotation([0,0,0], [0,0,1], -theta)
              g_rtc.transform!(trans_rtc * rot_rtc)
            end
            
            # Webs
            webs = [
              [[0, w_member/2.0], [-span/4.0, get_top_chord_y.call(-span/4.0)]],
              [[0, w_member/2.0], [span/4.0, get_top_chord_y.call(span/4.0)]],
              [[-span/3.0, w_member/2.0], [-span/4.0, get_top_chord_y.call(-span/4.0)]],
              [[span/3.0, w_member/2.0], [span/4.0, get_top_chord_y.call(span/4.0)]]
            ]
            
            webs.each_with_index do |web, wi|
              mid_x = (web[0][0] + web[1][0]) / 2.0
              next if cuts_left && mid_x < 0
              next if cuts_right && mid_x > 0

              p1 = web[0]
              p2 = web[1]
              dx = p2[0] - p1[0]
              dy = p2[1] - p1[1]
              len = Math.sqrt(dx*dx + dy*dy)
              angle = Math.atan2(dy, dx)
              cx = (p1[0] + p2[0]) / 2.0
              cy = (p1[1] + p2[1]) / 2.0
              
              g_web = g.entities.add_group
              g_web.name = "Web #{wi+1}"
              g_web.material = mat_framing
              draw_box.call(g_web.entities, -len/2.0, -w_member/2.0, 0, len, w_member, thickness, "Web", mat_framing)
              trans_web = Geom::Transformation.new([cx, cy, 0])
              rot_web = Geom::Transformation.rotation([0,0,0], [0,0,1], angle)
              g_web.transform!(trans_web * rot_web)
            end
            
            # Position the entire truss
            trans_truss = Geom::Transformation.new([tx + thickness/2.0, rz + d/2.0, y])
            rot_truss = Geom::Transformation.rotation([0,0,0], [0,0,1], Math::PI/2.0)
            rot_truss_x = Geom::Transformation.rotation([0,0,0], [1,0,0], Math::PI/2.0)
            g.transform!(trans_truss * rot_truss * rot_truss_x)
          end
        else
          num_trusses = (d / run[:spacing_in]).floor + 1
          num_trusses.times do |j|
            tz = rz + j * run[:spacing_in] - thickness / 2.0
            tz_world = tz + thickness / 2.0
            
            # Check dormer intersection
            intersected = dormers.find do |dorm|
              dl = dorm[:rotation] == 0 ? dorm[:depth_in] : dorm[:width_in]
              (tz_world >= dorm[:y_in] - dl/2.0) && (tz_world <= dorm[:y_in] + dl/2.0)
            end
            
            cuts_left = false
            cuts_right = false
            if intersected
              if intersected[:x_in] < rx + w/2.0
                cuts_left = true
              else
                cuts_right = true
              end
            end
            
            g = f_ents.add_group
            g.name = intersected ? "Truss (Cut for Dormer)" : "Truss"
            g.material = mat_framing
            
            # Bottom chord
            draw_box.call(g.entities, -span/2.0, 0, 0, span, w_member, thickness, "Bottom Chord", mat_framing)
            
            # Left top chord
            unless cuts_left
              g_ltc = g.entities.add_group
              g_ltc.name = "Top Chord Left"
              g_ltc.material = mat_framing
              draw_box.call(g_ltc.entities, -top_chord_length/2.0, -w_member/2.0, 0, top_chord_length, w_member, thickness, "Top Chord Left", mat_framing)
              trans_ltc = Geom::Transformation.new([tc_left_cx, tc_cy, 0])
              rot_ltc = Geom::Transformation.rotation([0,0,0], [0,0,1], theta)
              g_ltc.transform!(trans_ltc * rot_ltc)
            end
            
            # Right top chord
            unless cuts_right
              g_rtc = g.entities.add_group
              g_rtc.name = "Top Chord Right"
              g_rtc.material = mat_framing
              draw_box.call(g_rtc.entities, -top_chord_length/2.0, -w_member/2.0, 0, top_chord_length, w_member, thickness, "Top Chord Right", mat_framing)
              trans_rtc = Geom::Transformation.new([tc_right_cx, tc_cy, 0])
              rot_rtc = Geom::Transformation.rotation([0,0,0], [0,0,1], -theta)
              g_rtc.transform!(trans_rtc * rot_rtc)
            end
            
            # Webs
            webs = [
              [[0, w_member/2.0], [-span/4.0, get_top_chord_y.call(-span/4.0)]],
              [[0, w_member/2.0], [span/4.0, get_top_chord_y.call(span/4.0)]],
              [[-span/3.0, w_member/2.0], [-span/4.0, get_top_chord_y.call(-span/4.0)]],
              [[span/3.0, w_member/2.0], [span/4.0, get_top_chord_y.call(span/4.0)]]
            ]
            
            webs.each_with_index do |web, wi|
              mid_x = (web[0][0] + web[1][0]) / 2.0
              next if cuts_left && mid_x < 0
              next if cuts_right && mid_x > 0

              p1 = web[0]
              p2 = web[1]
              dx = p2[0] - p1[0]
              dy = p2[1] - p1[1]
              len = Math.sqrt(dx*dx + dy*dy)
              angle = Math.atan2(dy, dx)
              cx = (p1[0] + p2[0]) / 2.0
              cy = (p1[1] + p2[1]) / 2.0
              
              g_web = g.entities.add_group
              g_web.name = "Web #{wi+1}"
              g_web.material = mat_framing
              draw_box.call(g_web.entities, -len/2.0, -w_member/2.0, 0, len, w_member, thickness, "Web", mat_framing)
              trans_web = Geom::Transformation.new([cx, cy, 0])
              rot_web = Geom::Transformation.rotation([0,0,0], [0,0,1], angle)
              g_web.transform!(trans_web * rot_web)
            end
            
            # Position the entire truss
            trans_truss = Geom::Transformation.new([rx + w/2.0, tz + thickness/2.0, y])
            rot_truss_x = Geom::Transformation.rotation([0,0,0], [1,0,0], Math::PI/2.0)
            g.transform!(trans_truss * rot_truss_x)
          end
        end
      end
    end
`}
  end

  # --- DORMERS GENERATION ---
  if dormers.length > 0
    puts "Generating Dormers..."
    dormers.each do |d|
      w = d[:rotation] == 0 ? d[:width_in] : d[:depth_in]
      l = d[:rotation] == 0 ? d[:depth_in] : d[:width_in]
      
      pitch = d[:pitch] || 6.0
      overhang = d[:overhang_in] || 12.0
      fascia = d[:fascia_in] || 0.0
      wall_h = d[:wall_height_in] || 48.0

      rx = d[:x_in] - w / 2.0
      ry = d[:y_in] - l / 2.0
      
      z_base = wall_height_in + wall_h
      
      g = f_ents.add_group
      g.name = "Dormer Volume"
      g_ents = g.entities
      mat_dormer = get_material.call("Dormer", "#3b82f6")
      
      # Base walls as a solid box
      draw_box.call(g_ents, rx, ry, wall_height_in, w, l, wall_h, "Dormer Base", mat_dormer)
      
      # Roof as a solid gable pushpull
      g_roof = g_ents.add_group
      g_roof.name = "Dormer Roof"
      g_roof.material = mat_dormer

      eave_drop = overhang * (pitch / 12.0)
      
      if d[:rotation] == 0
        ridge_h_val = (w / 2.0) * (pitch / 12.0) + eave_drop
        
        pts = [
          [rx - overhang, ry - overhang, z_base - eave_drop - fascia],
          [rx + w + overhang, ry - overhang, z_base - eave_drop - fascia],
          [rx + w + overhang, ry - overhang, z_base - eave_drop],
          [rx + w / 2.0, ry - overhang, z_base + ridge_h_val - eave_drop],
          [rx - overhang, ry - overhang, z_base - eave_drop]
        ]
        begin
          face = g_roof.entities.add_face(pts)
          dist = face.normal.y > 0 ? (l + 2 * overhang) : -(l + 2 * overhang)
          face.pushpull(dist)
        rescue => e
          puts "Failed to draw Dormer roof: #{e.message}"
        end
      else
        ridge_h_val = (l / 2.0) * (pitch / 12.0) + eave_drop
        
        pts = [
          [rx - overhang, ry - overhang, z_base - eave_drop - fascia],
          [rx - overhang, ry + l + overhang, z_base - eave_drop - fascia],
          [rx - overhang, ry + l + overhang, z_base - eave_drop],
          [rx - overhang, ry + l / 2.0, z_base + ridge_h_val - eave_drop],
          [rx - overhang, ry - overhang, z_base - eave_drop]
        ]
        begin
          face = g_roof.entities.add_face(pts)
          dist = face.normal.x > 0 ? (w + 2 * overhang) : -(w + 2 * overhang)
          face.pushpull(dist)
        rescue => e
          puts "Failed to draw Dormer roof: #{e.message}"
        end
      end
    end
  end

  model.commit_operation
  puts "Generation of ${sectionName} Completed Successfully!"
rescue => e
  model.abort_operation
  puts "Error generating ${sectionName}: #{e.message}"
  puts e.backtrace.join("\n")
end
`;
};
