import bpy
import os

def main():
    # Ensure the /tmp folder exists (or standard Windows temp path)
    tmp_dir = "/tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    glb_path = os.path.join(tmp_dir, "test_output.glb")

    # Clear existing objects in the scene to avoid duplicate shapes
    if bpy.ops.object.select_all.poll():
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)

    # Create a simple cube mesh
    bpy.ops.mesh.primitive_cube_add(size=2.0, enter_editmode=False, align='WORLD', location=(0, 0, 0))

    # Export to GLB format
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')

    print("SUCCESS")

if __name__ == "__main__":
    main()
