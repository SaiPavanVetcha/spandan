import express from 'express'
import path from 'path'
import fs from 'fs'
import archiverModule from 'archiver'
import {
  getAssignments,
  createAssignment,
  getAssignmentById,
  downloadAssignmentFile,
  submitAssignment,
  getSubmissionsForAssignment,
  downloadStudentSubmission,
  getSubmissionsForBulkDownload,
  deleteAssignment
} from '../services/assignmentService.js'
import { authenticate, authorize, requireApprovedTeacher } from '../middleware/auth.js'
import {
  assignmentUploader,
  submissionUploader,
  handleUpload,
  SUBMISSIONS_DIR,
  sanitizeFilename,
  formatZipEntryFilename,
  safePart,
  submissionDownloadName,
  removeFile
} from '../utils/uploadHelper.js'

const archiver = archiverModule.default || archiverModule


const router = express.Router({ mergeParams: true })

/**
 * GET /api/classes/:classId/assignments
 * List all assignments for class (Teacher or active student)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const data = await getAssignments(req.params.classId, req.user)
    res.json(data)
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message })
  }
})

/**
 * POST /api/classes/:classId/assignments
 * Create a new assignment (Teacher only, multipart: title, description?, deadline, file?)
 */
router.post(
  '/',
  authenticate,
  authorize('teacher'),
  requireApprovedTeacher,
  handleUpload(assignmentUploader.single('file')),
  async (req, res) => {
    try {
      const { deadline } = req.body
      const deadlineDate = new Date(deadline)
      if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
        if (req.file) removeFile(req.file.path)
        return res.status(400).json({ error: 'Deadline must be a future date and time' })
      }

      const assignment = await createAssignment(
        req.params.classId,
        req.user,
        req.body,
        req.file
      )


      const io = req.app.get('io')
      if (io) {
        io.to(`class:${req.params.classId}`).emit('class:assignment-created', {
          classId: req.params.classId,
          assignment
        })
      }

      res.status(201).json({
        message: 'Assignment created successfully',
        assignment
      })
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

/**
 * GET /api/classes/:classId/assignments/:id/download-assignment
 * Download the teacher's attached assignment file (Teacher or active student)
 */
router.get('/:id/download-assignment', authenticate, async (req, res) => {
  try {
    const { assignment, filePath } = await downloadAssignmentFile(
      req.params.classId,
      req.params.id,
      req.user
    )

    res.download(filePath, assignment.originalFileName)
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message })
  }
})

/**
 * POST /api/classes/:classId/assignments/:id/submit
 * Submit / Replace assignment submission (Active student only, multipart: file)
 */
router.post(
  '/:id/submit',
  authenticate,
  authorize('student'),
  handleUpload(submissionUploader.single('file')),
  async (req, res) => {
    try {
      const result = await submitAssignment(
        req.params.classId,
        req.params.id,
        req.user,
        req.file
      )

      const io = req.app.get('io')
      if (io) {
        io.to(`class:${req.params.classId}`).emit('class:assignment-submitted', {
          classId: req.params.classId,
          assignmentId: req.params.id,
          studentId: req.user._id
        })
      }

      res.status(result.overwritten ? 200 : 201).json(result)
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

/**
 * GET /api/classes/:classId/assignments/:id/submissions/bulk-download
 * Download all submissions bundled as a .zip file (Teacher only)
 */
router.get(
  '/:id/submissions/bulk-download',
  authenticate,
  authorize('teacher'),
  async (req, res) => {
    try {
      const { assignment, submissions } = await getSubmissionsForBulkDownload(
        req.params.classId,
        req.params.id,
        req.user
      )

      const safeAssignmentTitle = sanitizeFilename(assignment.title)
      const zipFileName = `Submissions_${safeAssignmentTitle}.zip`

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`)

      const archive = archiver('zip', { zlib: { level: 9 } })

      archive.on('error', (err) => {
        console.error('Archiver error:', err)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create zip archive' })
        }
      })

      archive.pipe(res)

      if (submissions.length === 0) {
        archive.append('No student submissions found for this assignment.', { name: 'README.txt' })
      } else {
        for (const sub of submissions) {
          const filePath = path.join(SUBMISSIONS_DIR, sub.storedFileName)
          if (fs.existsSync(filePath)) {
            const studentEmail = sub.studentId?.email || 'student'
            const entryName = submissionDownloadName(studentEmail, assignment.title, sub.originalFileName)
            archive.file(filePath, { name: entryName })
          }
        }
      }

      await archive.finalize()
    } catch (error) {
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message })
      }
    }
  }
)

/**
 * GET /api/classes/:classId/assignments/:id/submissions/:studentId/download
 * Download a specific student's submission file (Teacher or that student)
 */
router.get(
  '/:id/submissions/:studentId/download',
  authenticate,
  async (req, res) => {
    try {
      const { downloadFilename, filePath } = await downloadStudentSubmission(
        req.params.classId,
        req.params.id,
        req.params.studentId,
        req.user
      )

      res.download(filePath, downloadFilename)
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)


/**
 * GET /api/classes/:classId/assignments/:id/submissions
 * Get list of all students and their submission status (Teacher only)
 */
router.get(
  '/:id/submissions',
  authenticate,
  authorize('teacher'),
  async (req, res) => {
    try {
      const data = await getSubmissionsForAssignment(
        req.params.classId,
        req.params.id,
        req.user
      )
      res.json(data)
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

/**
 * GET /api/classes/:classId/assignments/:id
 * Get single assignment detail (Teacher or active student)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getAssignmentById(
      req.params.classId,
      req.params.id,
      req.user
    )
    res.json(data)
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message })
  }
})

/**
 * DELETE /api/classes/:classId/assignments/:id
 * Delete assignment and all submissions (Teacher only)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('teacher'),
  requireApprovedTeacher,
  async (req, res) => {
    try {
      const result = await deleteAssignment(
        req.params.classId,
        req.params.id,
        req.user
      )

      const io = req.app.get('io')
      if (io) {
        io.to(`class:${req.params.classId}`).emit('class:assignment-deleted', {
          classId: req.params.classId,
          assignmentId: req.params.id
        })
      }

      res.json(result)
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message })
    }
  }
)

export default router
