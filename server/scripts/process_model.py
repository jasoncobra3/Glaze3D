import bpy
import argparse
import os
import sys

def clear_scene():
    """Clear all existing objects in the default Blender scene."""
    if bpy.context.scene.objects:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)

def normalize_scene():
    """Center all geometry at origin and scale so the max dimension is 1.0"""
    import mathutils
    bpy.context.view_layer.update()
    
    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not mesh_objs: return
    
    min_coord = mathutils.Vector((float('inf'), float('inf'), float('inf')))
    max_coord = mathutils.Vector((float('-inf'), float('-inf'), float('-inf')))
    
    for obj in mesh_objs:
        for local_pt in obj.bound_box:
            world_pt = obj.matrix_world @ mathutils.Vector(local_pt)
            min_coord.x = min(min_coord.x, world_pt.x)
            min_coord.y = min(min_coord.y, world_pt.y)
            min_coord.z = min(min_coord.z, world_pt.z)
            max_coord.x = max(max_coord.x, world_pt.x)
            max_coord.y = max(max_coord.y, world_pt.y)
            max_coord.z = max(max_coord.z, world_pt.z)
            
    center = (min_coord + max_coord) / 2.0
    dimensions = max_coord - min_coord
    max_dim = max(dimensions.x, dimensions.y, dimensions.z)
    
    if max_dim <= 0: return
    scale_factor = 1.0 / max_dim
    
    # Create transformation matrix: translate to center, then scale
    translation_mat = mathutils.Matrix.Translation(-center)
    scale_mat = mathutils.Matrix.Scale(scale_factor, 4)
    transform_mat = scale_mat @ translation_mat
    
    # Apply to all root objects
    root_objs = [obj for obj in bpy.context.scene.objects if obj.parent is None]
    for obj in root_objs:
        obj.matrix_world = transform_mat @ obj.matrix_world
        
    bpy.context.view_layer.update()
    print("Normalized scene to 1x1x1 bounding box at origin.")

def apply_transforms(scale_x, scale_y, scale_z, pos_x, pos_y, pos_z):
    """Apply scale and position offset to all mesh objects."""
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            # Apply scale offset
            obj.scale.x *= scale_x
            obj.scale.y *= scale_y
            obj.scale.z *= scale_z
            
            # Apply position offset
            obj.location.x += pos_x
            obj.location.y += pos_y
            obj.location.z += pos_z

def apply_mesh_operations(subdivide_cuts, unsubdivide_iters):
    """Apply subdivision and unsubdivision in Edit Mode for each mesh object."""
    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not mesh_objs:
        return
        
    for obj in mesh_objs:
        # Deselect all objects
        bpy.ops.object.select_all(action='DESELECT')
        
        # Select and make this mesh the active object
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        
        # Shift to Edit Mode to run mesh operations
        bpy.ops.object.mode_set(mode='EDIT')
        
        # Select all mesh geometry
        bpy.ops.mesh.select_all(action='SELECT')
        
        # Apply Subdivision if cuts > 0
        if subdivide_cuts > 0:
            bpy.ops.mesh.subdivide(number_cuts=subdivide_cuts)
            
        # Apply Unsubdivision if iterations > 0
        if unsubdivide_iters > 0:
            bpy.ops.mesh.unsubdivide(iterations=unsubdivide_iters)
            
        # Return to Object Mode
        bpy.ops.object.mode_set(mode='OBJECT')

def fix_materials():
    """Ensure all imported materials are Opaque and their Alpha is fully visible."""
    for mat in bpy.data.materials:
        # 1. Force blend mode to OPAQUE
        mat.blend_method = 'OPAQUE'
        
        # 2. Fix the Principled BSDF node
        if mat.use_nodes and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    if 'Alpha' in node.inputs:
                        alpha_socket = node.inputs['Alpha']
                        # Remove all links connected to the Alpha socket
                        for link in list(mat.node_tree.links):
                            if link.to_socket == alpha_socket:
                                mat.node_tree.links.remove(link)
                        # Set default value to 1.0 (fully opaque)
                        alpha_socket.default_value = 1.0
        
        # 3. For non-node materials
        if hasattr(mat, 'diffuse_color') and len(mat.diffuse_color) >= 4:
            mat.diffuse_color[3] = 1.0

def apply_material_properties(color_str, metallic=0.0, roughness=0.5, transmission=0.0):
    """Apply base color and PBR properties to all materials."""
    r, g, b = [float(c) for c in color_str.split(',')]
    
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        
        # If object has no materials, create one
        if len(obj.data.materials) == 0:
            mat = bpy.data.materials.new(name="GeneratedMat")
            mat.use_nodes = True
            obj.data.materials.append(mat)
        
        for i, mat in enumerate(obj.data.materials):
            if mat is None:
                mat = bpy.data.materials.new(name=f"Mat_{i}")
                mat.use_nodes = True
                obj.data.materials[i] = mat
            
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            
            # Try to find existing Principled BSDF
            principled = None
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    principled = node
                    break
            
            # If not found, clear and create fresh material
            if principled is None:
                nodes.clear()
                principled = nodes.new(type='ShaderNodeBsdfPrincipled')
                output = nodes.new(type='ShaderNodeOutputMaterial')
                mat.node_tree.links.new(
                    principled.outputs['BSDF'], 
                    output.inputs['Surface']
                )
            
            # Unlink any existing image textures from Base Color
            base_color_socket = principled.inputs['Base Color']
            for link in list(mat.node_tree.links):
                if link.to_socket == base_color_socket:
                    mat.node_tree.links.remove(link)
            
            # Set the color and properties
            base_color_socket.default_value = (r, g, b, 1.0)
            
            if 'Metallic' in principled.inputs:
                principled.inputs['Metallic'].default_value = metallic
            if 'Roughness' in principled.inputs:
                principled.inputs['Roughness'].default_value = roughness
            
            # Handle Blender 4.0+ 'Transmission Weight' vs older 'Transmission'
            if 'Transmission Weight' in principled.inputs:
                principled.inputs['Transmission Weight'].default_value = transmission
            elif 'Transmission' in principled.inputs:
                principled.inputs['Transmission'].default_value = transmission
                
    print(f"Applied material - Color:({r:.2f},{g:.2f},{b:.2f}), Metallic:{metallic:.2f}, Roughness:{roughness:.2f}, Transmission:{transmission:.2f}")

def apply_procedural_animation(anim_type):
    """Add a simple procedural animation to the root objects."""
    if anim_type == "none" or not anim_type:
        return
        
    root_objs = [obj for obj in bpy.context.scene.objects if obj.parent is None and obj.type == 'MESH']
    if not root_objs:
        root_objs = [obj for obj in bpy.context.scene.objects if obj.parent is None]
        
    if not root_objs:
        return
        
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 60
    
    import math
    
    for obj in root_objs:
        if not obj.animation_data:
            obj.animation_data_create()
            
        action = bpy.data.actions.new(name=f"{anim_type.capitalize()}Action")
        obj.animation_data.action = action
        
        if anim_type == "spin":
            obj.rotation_mode = 'XYZ'
            
            obj.rotation_euler.z = 0
            obj.keyframe_insert(data_path="rotation_euler", frame=1)
            
            obj.rotation_euler.z = 2 * math.pi
            obj.keyframe_insert(data_path="rotation_euler", frame=61)
            
            try:
                for fcurve in action.fcurves:
                    for keyframe in fcurve.keyframe_points:
                        keyframe.interpolation = 'LINEAR'
            except AttributeError:
                pass
                    
        elif anim_type == "float":
            start_z = obj.location.z
            
            obj.location.z = start_z
            obj.keyframe_insert(data_path="location", frame=1)
            
            obj.location.z = start_z + 0.5
            obj.keyframe_insert(data_path="location", frame=30)
            
            obj.location.z = start_z
            obj.keyframe_insert(data_path="location", frame=61)
            
        elif anim_type == "bounce":
            start_z = obj.location.z
            
            obj.location.z = start_z
            obj.keyframe_insert(data_path="location", frame=1)
            
            obj.location.z = start_z + 1.5
            obj.keyframe_insert(data_path="location", frame=30)
            
            obj.location.z = start_z
            obj.keyframe_insert(data_path="location", frame=61)
            
            try:
                for fcurve in action.fcurves:
                    if fcurve.data_path == "location" and fcurve.array_index == 2:
                        fcurve.keyframe_points[0].handle_right_type = 'VECTOR'
                        fcurve.keyframe_points[1].handle_left_type = 'AUTO'
                        fcurve.keyframe_points[1].handle_right_type = 'AUTO'
                        fcurve.keyframe_points[2].handle_left_type = 'VECTOR'
            except AttributeError:
                pass


def main():
    parser = argparse.ArgumentParser(description="Process FBX model and export to GLB using bpy.")
    parser.add_argument("--input", required=True, help="Path to input FBX file")
    parser.add_argument("--output", required=True, help="Path for output GLB file")
    parser.add_argument("--normalize", action="store_true", help="Auto-center and normalize scale to 1.0")
    parser.add_argument("--scale-x", type=float, default=1.0, help="Scale factor X")
    parser.add_argument("--scale-y", type=float, default=1.0, help="Scale factor Y")
    parser.add_argument("--scale-z", type=float, default=1.0, help="Scale factor Z")
    parser.add_argument("--pos-x", type=float, default=0.0, help="Position offset X")
    parser.add_argument("--pos-y", type=float, default=0.0, help="Position offset Y")
    parser.add_argument("--pos-z", type=float, default=0.0, help="Position offset Z")
    parser.add_argument("--subdivide", type=int, default=0, help="Subdivision cuts")
    parser.add_argument("--unsubdivide", type=int, default=0, help="Unsubdivision iterations")
    parser.add_argument("--export-formats", type=str, default="glb", help="Comma-separated formats to export")
    parser.add_argument("--color", type=str, default=None, help="Material base color as R,G,B floats")
    parser.add_argument("--metallic", type=float, default=0.0, help="Metallic factor (0-1)")
    parser.add_argument("--roughness", type=float, default=0.5, help="Roughness factor (0-1)")
    parser.add_argument("--transmission", type=float, default=0.0, help="Transmission/Glass factor (0-1)")
    parser.add_argument("--auto-animate", type=str, default="none", help="Add procedural animation (spin, float, bounce)")
    
    # Standard Blender CLI scripts sometimes receive extra arguments from Blender,
    # so we parse known args to ignore Blender's own CLI args.
    args, unknown = parser.parse_known_args()
    
    try:
        # 1. Clear the default scene
        clear_scene()
        
        # 2. Import the FBX file
        if not os.path.exists(args.input):
            raise FileNotFoundError(f"Input file not found: {args.input}")
            
        # Monkeypatch CyclesLightSettings to prevent AttributeError in io_scene_fbx import addon in Blender 4.2+/5.x
        if hasattr(bpy.types, 'CyclesLightSettings') and not hasattr(bpy.types.CyclesLightSettings, 'cast_shadow'):
            try:
                bpy.types.CyclesLightSettings.cast_shadow = bpy.props.BoolProperty(
                    name="Cast Shadow",
                    default=True
                )
            except Exception as patch_err:
                print(f"DEBUG: Failed to monkeypatch CyclesLightSettings: {patch_err}")
                
        bpy.ops.import_scene.fbx(filepath=args.input)
        
        # Post-process materials to fix any transparency/Blend Mode bugs
        fix_materials()
        
        # Apply custom base color and properties if requested
        if args.color:
            apply_material_properties(args.color, args.metallic, args.roughness, args.transmission)
            
        # Optional: Auto-normalize (center and scale to 1x1x1) before applying custom transforms
        if args.normalize:
            normalize_scene()
        
        # 3. Apply custom user transformations (scale and position offsets)
        apply_transforms(
            args.scale_x, args.scale_y, args.scale_z,
            args.pos_x, args.pos_y, args.pos_z
        )
        
        # 4. Apply subdivide and/or unsubdivide mesh edits
        if args.subdivide > 0 or args.unsubdivide > 0:
            apply_mesh_operations(args.subdivide, args.unsubdivide)
            
        # Apply procedural animation
        if args.auto_animate != "none":
            apply_procedural_animation(args.auto_animate)
            
        # Ensure output directory exists
        output_dir = os.path.dirname(args.output)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            
        # 5. Export to each requested format
        formats = [fmt.strip().lower() for fmt in args.export_formats.split(',')] if args.export_formats else ['glb']
        base_output_path, _ = os.path.splitext(args.output)
        
        for fmt in formats:
            if fmt == 'glb':
                glb_path = f"{base_output_path}.glb"
                bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
                print(f"DONE_GLB: {glb_path}")
            elif fmt == 'obj':
                obj_path = f"{base_output_path}.obj"
                if hasattr(bpy.ops.wm, 'obj_export'):
                    bpy.ops.wm.obj_export(filepath=obj_path)
                else:
                    bpy.ops.export_scene.obj(filepath=obj_path)
                print(f"DONE_OBJ: {obj_path}")
            elif fmt == 'fbx':
                fbx_path = f"{base_output_path}.fbx"
                bpy.ops.export_scene.fbx(filepath=fbx_path)
                print(f"DONE_FBX: {fbx_path}")
        
        # 6. Print success message as requested
        print(f"DONE: {args.output}")
        sys.exit(0)
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
