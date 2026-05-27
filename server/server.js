const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const runBlender = require('./utils/runBlender');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for file metadata
const fileMetadata = new Map();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uuid = uuidv4();
    cb(null, `${uuid}.fbx`);
  }
});

// File filter validation (only allow .fbx)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.fbx') {
    return cb(new Error('Only .fbx files are allowed!'), false);
  }
  cb(null, true);
};

// Multer upload config: 50MB limit and .fbx file filter
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// POST /api/upload Route
const uploadSingle = upload.single('file');
app.post('/api/upload', (req, res) => {
  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an FBX file.' });
    }

    const fileId = path.basename(req.file.filename, '.fbx');
    
    // Store metadata in memory
    fileMetadata.set(fileId, {
      exists: true,
      name: req.file.originalname,
      size: req.file.size
    });

    res.json({
      fileId: fileId,
      filename: req.file.originalname,
      size: req.file.size
    });
  });
});

// GET /api/files/:fileId Route
app.get('/api/files/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const filePath = path.join(__dirname, 'uploads', `${fileId}.fbx`);
  
  const existsOnDisk = fs.existsSync(filePath);
  const metadata = fileMetadata.get(fileId);

  if (!existsOnDisk || !metadata) {
    return res.status(404).json({
      exists: false,
      message: 'File not found'
    });
  }

  res.json({
    exists: true,
    name: metadata.name,
    size: metadata.size
  });
});

// POST /api/process/:fileId Route
app.post('/api/process/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  const inputPath = path.join(__dirname, 'uploads', `${fileId}.fbx`);
  const outputPath = path.join(__dirname, 'outputs', `${fileId}.glb`);

  // Verify that the uploaded FBX exists on disk
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({
      success: false,
      error: `Input FBX file with ID ${fileId} not found.`
    });
  }

  // Ensure outputs folder exists
  const outputsDir = path.dirname(outputPath);
  fs.mkdirSync(outputsDir, { recursive: true });

  // Extract parameters from JSON body with defaults
  const scale = req.body.scale || {};
  const position = req.body.position || {};
  const operations = req.body.operations || {};

  const scaleX = scale.x !== undefined ? scale.x : 1.0;
  const scaleY = scale.y !== undefined ? scale.y : 1.0;
  const scaleZ = scale.z !== undefined ? scale.z : 1.0;

  const posX = position.x !== undefined ? position.x : 0.0;
  const posY = position.y !== undefined ? position.y : 0.0;
  const posZ = position.z !== undefined ? position.z : 0.0;

  const subdivide = operations.subdivide !== undefined ? operations.subdivide : 0;
  const unsubdivide = operations.unsubdivide !== undefined ? operations.unsubdivide : 0;
  const autoNormalize = operations.autoNormalize || false;
  const proceduralAnim = operations.proceduralAnim || 'none';

  // Extract and build export formats
  const exportFormats = req.body.exportFormats || ['glb'];
  // Safeguard: Ensure exportFormats is an array
  const formatsArr = Array.isArray(exportFormats) ? exportFormats : ['glb'];
  const exportFormatsStr = formatsArr.join(',');

  // Build command-line arguments for Python processor
  const args = [
    '--input', inputPath,
    '--output', outputPath,
    '--scale-x', String(scaleX),
    '--scale-y', String(scaleY),
    '--scale-z', String(scaleZ),
    '--pos-x', String(posX),
    '--pos-y', String(posY),
    '--pos-z', String(posZ),
    '--subdivide', String(subdivide),
    '--unsubdivide', String(unsubdivide),
    '--export-formats', exportFormatsStr
  ];

  if (autoNormalize) {
    args.push('--normalize');
  }

  if (proceduralAnim !== 'none') {
    args.push('--auto-animate', proceduralAnim);
  }

  // Append material base color and properties if provided
  const material = req.body.material || {};
  const materialColor = material.color;
  if (Array.isArray(materialColor) && materialColor.length === 3) {
    const r = Number(materialColor[0]);
    const g = Number(materialColor[1]);
    const b = Number(materialColor[2]);
    args.push('--color', `${r},${g},${b}`);
  }
  
  if (material.metallic !== undefined) args.push('--metallic', String(material.metallic));
  if (material.roughness !== undefined) args.push('--roughness', String(material.roughness));
  if (material.transmission !== undefined) args.push('--transmission', String(material.transmission));

  try {
    // Run the Blender script using virtual environment
    console.log(`[Blender Process Start] Spawning process_model.py for fileId: ${fileId}`);
    console.log(`Python script args:`, args);
    const result = await runBlender('server/scripts/process_model.py', args);
    
    // Double check that the GLB file was indeed created
    if (!fs.existsSync(outputPath)) {
      throw new Error('GLB output file was not generated by Blender script.');
    }

    console.log(`[Blender Process Success] Successfully processed model ${fileId}.\nBlender Output:\n${result.stdout}`);

    res.json({
      success: true,
      outputId: fileId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/download/:fileId Route
app.get('/api/download/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const format = (req.query.format || 'glb').toLowerCase();

  // Validate format extension
  if (!['glb', 'obj', 'fbx'].includes(format)) {
    return res.status(400).json({ success: false, error: 'Invalid download format requested.' });
  }

  const filePath = path.join(__dirname, 'outputs', `${fileId}.${format}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: `Requested ${format.toUpperCase()} file not found. Process it first.` });
  }

  res.download(filePath, `${fileId}.${format}`);
});

// GET /api/preview/:fileId Route
app.get('/api/preview/:fileId', (req, res) => {
  const fileId = req.params.fileId;
  const filePath = path.join(__dirname, 'outputs', `${fileId}.glb`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'GLB file not found. Process it first.' });
  }

  // Set the correct MIME type for model-viewer / glTF binary
  res.setHeader('Content-Type', 'model/gltf-binary');
  res.sendFile(filePath);
});

// Test Blender Python API Route
app.get('/test-bpy', async (req, res) => {
  try {
    const result = await runBlender('server/scripts/test_bpy.py');
    res.json({
      success: true,
      message: 'Blender Python script executed successfully',
      output: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute Blender Python script',
      error: error.message
    });
  }
});

// Demo route using uuid and multer
app.post('/upload', upload.single('file'), (req, res) => {
  const fileId = uuidv4();
  res.json({
    message: 'File upload processed successfully',
    id: fileId,
    file: req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : null
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
