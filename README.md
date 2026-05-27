# Web-Based 3D FBX to GLB Processing App

This application is a powerful, web-based 3D asset processing pipeline. It allows users to upload 3D models (like FBX files), perform real-time mesh operations (subdivision, scale normalization), apply custom material properties (metallic, roughness, colors), and procedurally bake animations directly from their browser. The backend leverages Blender's Python API (`bpy`) to process these transformations headless-ly, while the frontend provides an interactive, AR-ready 3D preview using `<model-viewer>`.

## Prerequisites

To run this application locally, you will need:
- **Node.js** (v18 or higher recommended)
- **Python 3.x**
- **bpy (Blender Python API)**: `pip install bpy`

## How to Run

1. Clone this repository.
2. Install all dependencies for both the frontend and backend:
   ```bash
   npm run install:all
   ```
3. Start the development server (runs both the React frontend and Express backend concurrently):
   ```bash
   npm run dev
   ```
4. Open your browser to the URL provided in the terminal (e.g., `http://localhost:5173`).

## Sample Files
A sample `.fbx` file is provided in the `sample/` directory. You can use this file to quickly test out the application's mesh operations, material adjustments, procedural animations, and AR capabilities.

## Screenshots

<table>
  <tr>
    <td><img src="Screenshots/screenshot01.png" alt="Screenshot 1" width="100%"></td>
    <td><img src="Screenshots/screenshot02.png" alt="Screenshot 2" width="100%"></td>
  </tr>
  <tr>
    <td><img src="Screenshots/screenshot03.png" alt="Screenshot 3" width="100%"></td>
    <td><img src="Screenshots/screenshot04.png" alt="Screenshot 4" width="100%"></td>
  </tr>
</table>
