import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import multer from 'multer'

export const BASE_UPLOAD_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads')
export const MATERIALS_DIR = path.join(BASE_UPLOAD_DIR, 'materials')
export const ASSIGNMENTS_DIR = path.join(BASE_UPLOAD_DIR, 'assignments')
export const SUBMISSIONS_DIR = path.join(BASE_UPLOAD_DIR, 'submissions')

// Ensure upload directories exist
for (const dir of [MATERIALS_DIR, ASSIGNMENTS_DIR, SUBMISSIONS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Allowed file extensions and MIME types
export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg'
])

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/pjpeg',
  'application/octet-stream' // fallback for browsers sending binary stream
])

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

/**
 * Sanitize strings for safe filenames
 */
export const sanitizeFilename = (name) => {
  if (!name) return 'file'
  return String(name)
    .trim()
    .replace(/[/\\?%*:|"<>;&$`']/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
}

export function safePart(str) {
  return String(str || 'file')
    .replace(/[^a-zA-Z0-9._@-]+/g, '_')
    .slice(0, 80)
}

export function submissionDownloadName(studentEmail, assignmentTitle, originalName) {
  const ext = (originalName && String(originalName).includes('.'))
    ? String(originalName).slice(String(originalName).lastIndexOf('.'))
    : '.pdf'
  return `${safePart(studentEmail)}_${safePart(assignmentTitle)}${ext}`
}

/**
 * Format bulk zip entry: {sanitizedEmail}_{sanitizedTitle}{ext}
 */
export const formatZipEntryFilename = (email, title, ext) => {
  return submissionDownloadName(email, title, ext)
}


const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error('File type not allowed. Allowed types: pdf, doc, docx, ppt, pptx, png, jpg, jpeg')
    err.status = 400
    err.code = 'INVALID_FILE_TYPE'
    return cb(err, false)
  }
  cb(null, true)
}

const createStorage = (targetDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, targetDir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      const safeRandom = crypto.randomBytes(8).toString('hex')
      const storedName = `${Date.now()}-${safeRandom}${ext}`
      cb(null, storedName)
    }
  })
}

export const materialUploader = multer({
  storage: createStorage(MATERIALS_DIR),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter
})

export const assignmentUploader = multer({
  storage: createStorage(ASSIGNMENTS_DIR),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter
})

export const submissionUploader = multer({
  storage: createStorage(SUBMISSIONS_DIR),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter
})

/**
 * Middleware wrapper to catch multer errors and return clean 400 JSON
 */
export const handleUpload = (uploader) => (req, res, next) => {
  uploader(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds 25MB limit' })
      }
      return res.status(err.status || 400).json({ error: err.message || 'File upload failed' })
    }
    next()
  })
}

/**
 * Remove file from disk safely
 */
export const removeFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath)
    } catch (err) {
      console.error('Failed to delete file from disk:', filePath, err.message)
    }
  }
}
