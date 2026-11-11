/**
 * Upload configuration — entity-specific size limits, resize dimensions, and accepted MIME types.
 */
export const ENTITY_CONFIGS = Object.freeze({
  avatars: {
    maxSizeMB: 2,
    maxFiles: 1,
    resize: { width: 256, height: 256, fit: 'cover' },
    quality: 80,
  },
  products: {
    maxSizeMB: 5,
    maxFiles: 1,
    resize: { width: 800, height: 800, fit: 'inside' },
    quality: 80,
  },
  technicians: {
    maxSizeMB: 5,
    maxFiles: 10,
    resize: { width: 1200, height: null, fit: 'inside' },
    quality: 80,
  },
  categories: {
    maxSizeMB: 1,
    maxFiles: 1,
    resize: { width: 128, height: 128, fit: 'cover' },
    quality: 80,
  },
  temp: {
    maxSizeMB: 5,
    maxFiles: 5,
    resize: null,
    quality: 80,
  },
});

/** MIME types we accept for image uploads. */
export const ALLOWED_MIMES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Output format for all processed images. */
export const OUTPUT_FORMAT = 'webp';
