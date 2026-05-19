/**
 * Dooley's Construction Hub — Asset Server
 * 
 * Lightweight Express server that powers the Designer's Materials Library.
 * Scans a local assets directory and provides CRUD endpoints for folders and files.
 * 
 * Configure the assets root via ASSETS_ROOT environment variable.
 * Default: ./assets (relative to workspace root)
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3060;

// ── Assets root directory ───────────────────────────────────────────
// Resolve from workspace root (two levels up from apps/asset-server/)
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const ASSETS_ROOT = process.env.ASSETS_ROOT
  ? path.resolve(process.env.ASSETS_ROOT)
  : path.join(WORKSPACE_ROOT, 'assets');

// Ensure the assets directory exists
fs.mkdirSync(ASSETS_ROOT, { recursive: true });

console.log(`📂 Assets root: ${ASSETS_ROOT}`);

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Multer for file uploads ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const targetFolder = req.body.targetFolder || '';
    const dest = path.join(ASSETS_ROOT, targetFolder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Use original filename, sanitized
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Recursively scan a directory and return a flat list of assets.
 */
function scanDirectory(rootDir, currentDir = '') {
  const assets = [];
  const fullPath = path.join(rootDir, currentDir);

  if (!fs.existsSync(fullPath)) return assets;

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  
  // Track if this directory has files (to detect empty folders)
  let hasFiles = false;

  for (const entry of entries) {
    const relativePath = currentDir ? `${currentDir}/${entry.name}` : entry.name;
    const absolutePath = path.join(rootDir, relativePath);

    if (entry.isDirectory()) {
      // Skip hidden/system directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      // Recurse into subdirectory
      const subAssets = scanDirectory(rootDir, relativePath);
      
      if (subAssets.length === 0) {
        // Empty folder — report it so the UI can show it
        assets.push({
          name: entry.name,
          directory: relativePath,
          absolutePath: absolutePath,
          isEmptyFolder: true,
        });
      } else {
        assets.push(...subAssets);
      }
    } else if (entry.isFile()) {
      // Skip hidden files and common system files
      if (entry.name.startsWith('.') || entry.name === 'Thumbs.db' || entry.name === 'desktop.ini') continue;
      
      hasFiles = true;
      const stat = fs.statSync(absolutePath);
      assets.push({
        name: entry.name,
        directory: currentDir,
        absolutePath: absolutePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isEmptyFolder: false,
      });
    }
  }

  return assets;
}

/**
 * Validate that a path is within the assets root (prevent directory traversal).
 */
function isPathSafe(requestedPath) {
  const resolved = path.resolve(requestedPath);
  return resolved.startsWith(path.resolve(ASSETS_ROOT));
}

// ── API Routes ──────────────────────────────────────────────────────

/**
 * GET /api/assets — List all assets in the library
 */
app.get('/api/assets', (req, res) => {
  try {
    const assets = scanDirectory(ASSETS_ROOT);
    res.json({ assets });
  } catch (err) {
    console.error('Error scanning assets:', err);
    res.status(500).json({ error: 'Failed to scan assets directory' });
  }
});

/**
 * POST /api/upload — Upload a file to the library
 * Body (multipart): assetFile, title, type, targetFolder (optional)
 */
app.post('/api/upload', upload.single('assetFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // If a title was provided and differs from filename, rename
    const title = req.body.title;
    if (title && title !== req.file.filename.split('.')[0]) {
      const ext = path.extname(req.file.originalname);
      const safeTitle = title.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
      const newPath = path.join(path.dirname(req.file.path), safeTitle + ext);
      
      if (!fs.existsSync(newPath)) {
        fs.renameSync(req.file.path, newPath);
      }
    }

    res.json({ success: true, path: req.file.path });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/serve-file — Serve a file by its absolute path
 * Query: path (absolute path to the file)
 */
app.get('/api/serve-file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Security: only serve files from within the assets root
    if (!isPathSafe(filePath)) {
      return res.status(403).json({ error: 'Access denied — path outside assets root' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('Serve file error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/folders — Create a new folder
 * Body: { folderName: string }
 */
app.post('/api/folders', (req, res) => {
  try {
    const { folderName } = req.body;
    if (!folderName || !folderName.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const safeName = folderName.trim().replace(/[<>:"|?*]/g, '_');
    const folderPath = path.join(ASSETS_ROOT, safeName);

    if (!isPathSafe(folderPath)) {
      return res.status(403).json({ success: false, error: 'Invalid folder name' });
    }

    if (fs.existsSync(folderPath)) {
      return res.status(409).json({ success: false, error: 'Folder already exists' });
    }

    fs.mkdirSync(folderPath, { recursive: true });
    res.json({ success: true, path: folderPath });
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/folders/rename — Rename a folder
 * Body: { oldDirectoryName: string, newDirectoryName: string }
 */
app.put('/api/folders/rename', (req, res) => {
  try {
    const { oldDirectoryName, newDirectoryName } = req.body;
    if (!oldDirectoryName || !newDirectoryName) {
      return res.status(400).json({ success: false, error: 'Both old and new names are required' });
    }

    const oldPath = path.join(ASSETS_ROOT, oldDirectoryName);
    const safeName = newDirectoryName.trim().replace(/[<>:"|?*]/g, '_');
    const newPath = path.join(ASSETS_ROOT, safeName);

    if (!isPathSafe(oldPath) || !isPathSafe(newPath)) {
      return res.status(403).json({ success: false, error: 'Invalid directory name' });
    }

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ success: false, error: 'Source folder not found' });
    }

    if (fs.existsSync(newPath)) {
      return res.status(409).json({ success: false, error: 'A folder with that name already exists' });
    }

    fs.renameSync(oldPath, newPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Rename folder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/folders/move — Move a folder into another folder
 * Body: { sourceDirectoryRelative: string, targetDirectoryRelative: string }
 */
app.put('/api/folders/move', (req, res) => {
  try {
    const { sourceDirectoryRelative, targetDirectoryRelative } = req.body;
    if (!sourceDirectoryRelative) {
      return res.status(400).json({ success: false, error: 'Source directory is required' });
    }

    const sourcePath = path.join(ASSETS_ROOT, sourceDirectoryRelative);
    const sourceName = path.basename(sourcePath);
    const targetBase = targetDirectoryRelative ? path.join(ASSETS_ROOT, targetDirectoryRelative) : ASSETS_ROOT;
    const destPath = path.join(targetBase, sourceName);

    if (!isPathSafe(sourcePath) || !isPathSafe(destPath)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ success: false, error: 'Source folder not found' });
    }

    if (fs.existsSync(destPath)) {
      return res.status(409).json({ success: false, error: 'Destination already exists' });
    }

    fs.mkdirSync(targetBase, { recursive: true });
    fs.renameSync(sourcePath, destPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Move folder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/folders — Remove a folder (moves to a .trash directory)
 * Body: { directoryName: string }
 */
app.delete('/api/folders', (req, res) => {
  try {
    const { directoryName } = req.body;
    if (!directoryName) {
      return res.status(400).json({ success: false, error: 'Directory name is required' });
    }

    const folderPath = path.join(ASSETS_ROOT, directoryName);

    if (!isPathSafe(folderPath)) {
      return res.status(403).json({ success: false, error: 'Invalid path' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    // Move to trash instead of deleting — preserves user's files
    const trashDir = path.join(ASSETS_ROOT, '.trash');
    fs.mkdirSync(trashDir, { recursive: true });
    const trashDest = path.join(trashDir, `${directoryName}_${Date.now()}`);
    fs.renameSync(folderPath, trashDest);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/generate-emblem — Stub for emblem generation
 * (Full implementation would require a 3D renderer like Puppeteer + Three.js)
 */
app.post('/api/generate-emblem', (req, res) => {
  res.json({ 
    success: false, 
    error: 'Emblem generation is not yet available in the hub. This feature requires the standalone SketchUp integration.' 
  });
});

// ── Material Configs (persist scale/opacity settings per texture) ────
const MATERIAL_CONFIGS_PATH = path.join(ASSETS_ROOT, '.material-configs.json');

function loadMaterialConfigs() {
  try {
    if (fs.existsSync(MATERIAL_CONFIGS_PATH)) {
      return JSON.parse(fs.readFileSync(MATERIAL_CONFIGS_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading material configs:', err);
  }
  return {};
}

function saveMaterialConfigs(configs) {
  try {
    fs.writeFileSync(MATERIAL_CONFIGS_PATH, JSON.stringify(configs, null, 2));
  } catch (err) {
    console.error('Error saving material configs:', err);
  }
}

/**
 * GET /api/material-configs — Load all saved material configurations
 */
app.get('/api/material-configs', (req, res) => {
  res.json(loadMaterialConfigs());
});

/**
 * POST /api/material-configs — Save a material configuration
 * Body: { textureUrl: string, config: { scaleW, scaleH, opacity, lockAspect } }
 */
app.post('/api/material-configs', (req, res) => {
  try {
    const { textureUrl, config } = req.body;
    if (!textureUrl) {
      return res.status(400).json({ success: false, error: 'textureUrl is required' });
    }
    const configs = loadMaterialConfigs();
    configs[textureUrl] = config;
    saveMaterialConfigs(configs);
    res.json({ success: true });
  } catch (err) {
    console.error('Save material config error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', assetsRoot: ASSETS_ROOT });
});

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Asset server running on http://localhost:${PORT}`);
  console.log(`📂 Serving assets from: ${ASSETS_ROOT}`);
});
