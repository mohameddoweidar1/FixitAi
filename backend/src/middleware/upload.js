/**
 * Upload Middleware Factory
 *
 * Wraps multer (memory storage) with:
 *  - MIME whitelist filter
 *  - Per-entity size limits
 *  - Magic-byte validation via `file-type`
 *  - Sharp-based image processing (resize + WebP conversion)
 *  - Automatic save to storage provider
 *
 * Usage in routes:
 *   import { singleUpload, multiUpload } from '../../middleware/upload.js';
 *   router.put('/avatar', requireAuth, singleUpload('avatars'), controller.updateAvatar);
 */
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { ENTITY_CONFIGS, ALLOWED_MIMES, OUTPUT_FORMAT } from '../config/upload.js';
import { storage } from '../utils/fileStorage.js';
import { fail } from '../utils/apiResponse.js';

// ── Multer Setup (memory storage — buffers stay in RAM until processed) ───────

function createMulter(entityType) {
  const config = ENTITY_CONFIGS[entityType];
  if (!config) throw new Error(`Unknown upload entity type: ${entityType}`);

  const maxBytes = config.maxSizeMB * 1024 * 1024;

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter(_req, file, cb) {
      if (ALLOWED_MIMES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIMES.join(', ')}`));
      }
    },
  });
}

// ── Image Processing ──────────────────────────────────────────────────────────

async function processImage(buffer, entityType) {
  const config = ENTITY_CONFIGS[entityType];

  // Magic-byte validation — verify actual file content
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIMES.includes(detected.mime)) {
    throw Object.assign(
      new Error('File content does not match an allowed image type'),
      { status: 400 },
    );
  }

  let pipeline = sharp(buffer);

  // Resize if configured
  if (config.resize) {
    pipeline = pipeline.resize({
      width: config.resize.width,
      height: config.resize.height || undefined,
      fit: config.resize.fit || 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to WebP
  pipeline = pipeline.webp({ quality: config.quality || 80 });

  return pipeline.toBuffer();
}

// ── Filename Generation ───────────────────────────────────────────────────────

function generateFilename(entityId) {
  const id = entityId || crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const timestamp = Date.now();
  return `${id}-${timestamp}.${OUTPUT_FORMAT}`;
}

// ── Middleware Factories ──────────────────────────────────────────────────────

/**
 * Single file upload middleware.
 * After processing, attaches `req.uploadedFile = { relativePath, url }` to the request.
 *
 * @param {string} entityType — 'avatars' | 'products' | 'technicians' | 'categories'
 * @param {string} fieldName  — form field name (default: 'file')
 */
export function singleUpload(entityType, fieldName = 'file') {
  const upload = createMulter(entityType);

  return [
    // Step 1: Multer parses the multipart form
    (req, res, next) => {
      upload.single(fieldName)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return fail(res, `File too large (max ${ENTITY_CONFIGS[entityType].maxSizeMB}MB)`, 400);
            }
            return fail(res, err.message, 400);
          }
          return fail(res, err.message, 400);
        }
        next();
      });
    },

    // Step 2: Process + save (if a file was uploaded)
    async (req, res, next) => {
      if (!req.file) return next(); // No file — skip processing

      try {
        const entityId = req.user?.id || req.params?.id;
        const processed = await processImage(req.file.buffer, entityType);
        const filename = generateFilename(entityId);
        const relativePath = await storage.save(processed, entityType, filename);

        req.uploadedFile = {
          relativePath,
          url: storage.getUrl(relativePath),
          originalName: req.file.originalname,
          size: processed.length,
        };

        next();
      } catch (err) {
        // Cleanup on failure is automatic (memory storage — no temp files)
        if (err.status) return fail(res, err.message, err.status);
        next(err);
      }
    },
  ];
}

/**
 * Multi file upload middleware.
 * After processing, attaches `req.uploadedFiles = [{ relativePath, url }, ...]`.
 *
 * @param {string} entityType
 * @param {string} fieldName
 */
export function multiUpload(entityType, fieldName = 'files') {
  const config = ENTITY_CONFIGS[entityType];
  const upload = createMulter(entityType);

  return [
    (req, res, next) => {
      upload.array(fieldName, config.maxFiles)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return fail(res, `File too large (max ${config.maxSizeMB}MB)`, 400);
            }
            if (err.code === 'LIMIT_UNEXPECTED_FILE') {
              return fail(res, `Too many files (max ${config.maxFiles})`, 400);
            }
            return fail(res, err.message, 400);
          }
          return fail(res, err.message, 400);
        }
        next();
      });
    },

    async (req, res, next) => {
      if (!req.files || req.files.length === 0) return next();

      try {
        const entityId = req.user?.id || req.params?.id;
        const results = [];

        for (const file of req.files) {
          const processed = await processImage(file.buffer, entityType);
          const filename = generateFilename(entityId);
          const relativePath = await storage.save(processed, entityType, filename);

          results.push({
            relativePath,
            url: storage.getUrl(relativePath),
            originalName: file.originalname,
            size: processed.length,
          });
        }

        req.uploadedFiles = results;
        next();
      } catch (err) {
        if (err.status) return fail(res, err.message, err.status);
        next(err);
      }
    },
  ];
}
