import express from 'express'
import {
  getMaterials,
  createMaterial,
  getMaterialForDownload,
  deleteMaterial
} from '../services/materialService.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import { materialUploader, handleUpload } from '../utils/uploadHelper.js'

const router = express.Router({ mergeParams: true })

/**
 * GET /api/classes/:classId/materials
 * List materials for class (Teacher or active student)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const materials = await getMaterials(req.params.classId, req.user, {
      sessionId: req.query.sessionId
    })
    res.json({ materials })
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message })
  }
})

/**
 * POST /api/classes/:classId/materials
 * Upload a new material (Teacher only, multipart)
 */
router.post(
  '/',
  authenticate,
  authorize('teacher'),
  requireApprovedTeacher,
  handleUpload(materialUploader.single('file')),
  async (req, res) => {
    try {
      const material = await createMaterial(
        req.params.classId,
        req.user,
        req.body,
        req.file
      )

      const io = req.app.get('io')
      if (io) {
        io.to(`class:${req.params.classId}`).emit('class:material-created', {
          classId: req.params.classId,
          material
        })
      }

      res.status(201).json({
        message: 'Material uploaded successfully',
        material
      })
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

/**
 * GET /api/classes/:classId/materials/:id/download
 * Download class material file (Teacher or active student)
 */
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const { material, filePath } = await getMaterialForDownload(
      req.params.classId,
      req.params.id,
      req.user
    )

    res.download(filePath, material.originalFileName)
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message })
  }
})

/**
 * DELETE /api/classes/:classId/materials/:id
 * Delete material (Teacher only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('teacher'),
  requireApprovedTeacher,
  async (req, res) => {
    try {
      const result = await deleteMaterial(
        req.params.classId,
        req.params.id,
        req.user
      )

      const io = req.app.get('io')
      if (io) {
        io.to(`class:${req.params.classId}`).emit('class:material-deleted', {
          classId: req.params.classId,
          materialId: req.params.id
        })
      }

      res.json(result)
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

export default router
