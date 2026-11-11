/**
 * Storage Abstraction Layer
 *
 * All modules interact with this module instead of touching the filesystem directly.
 * The active provider is determined by `env.STORAGE_PROVIDER`.
 *
 * To add S3/Cloudinary, implement the same interface and register it below.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ── Local Storage Provider ────────────────────────────────────────────────────

class LocalStorageProvider {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  /**
   * Save a buffer to disk under `entityType/filename`.
   * @param {Buffer} buffer
   * @param {string} entityType  e.g. 'avatars'
   * @param {string} filename    e.g. 'abc123-1715612345.webp'
   * @returns {string} relativePath  e.g. 'avatars/abc123-1715612345.webp'
   */
  async save(buffer, entityType, filename) {
    const dir = path.join(this.baseDir, entityType);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);

    // Return relative path (for DB storage)
    return `${entityType}/${filename}`;
  }

  /**
   * Delete a file by its relative path.
   * @param {string} relativePath  e.g. 'avatars/abc123-1715612345.webp'
   */
  async delete(relativePath) {
    if (!relativePath) return;
    const filePath = path.join(this.baseDir, relativePath);

    // Prevent path traversal
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Invalid file path — possible path traversal');
    }

    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // File already gone — that's fine
    }
  }

  /**
   * Build the public URL for a relative path.
   * @param {string} relativePath
   * @returns {string} e.g. '/uploads/avatars/abc123.webp'
   */
  getUrl(relativePath) {
    if (!relativePath) return null;
    return `/uploads/${relativePath}`;
  }
}

// ── Cloud stub (future) ───────────────────────────────────────────────────────

// class S3StorageProvider { ... }
// class CloudinaryStorageProvider { ... }

// ── Factory ───────────────────────────────────────────────────────────────────

function createProvider() {
  switch (env.STORAGE_PROVIDER) {
    case 'local': {
      const baseDir = path.resolve(PROJECT_ROOT, env.UPLOAD_DIR);
      return new LocalStorageProvider(baseDir);
    }
    // case 's3':         return new S3StorageProvider();
    // case 'cloudinary': return new CloudinaryStorageProvider();
    default:
      throw new Error(`Unknown storage provider: ${env.STORAGE_PROVIDER}`);
  }
}

export const storage = createProvider();
