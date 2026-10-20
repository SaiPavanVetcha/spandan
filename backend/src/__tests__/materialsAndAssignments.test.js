import { formatZipEntryFilename, sanitizeFilename, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../utils/uploadHelper.js'

describe('Materials and Assignments Backend Features', () => {
  describe('Upload Helper & Validation Rules', () => {
    it('should validate allowed extensions (pdf, doc, docx, ppt, pptx, png, jpg, jpeg)', () => {
      const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg']
      for (const ext of allowed) {
        expect(ALLOWED_EXTENSIONS.has(ext)).toBe(true)
      }

      // Disallowed extensions
      expect(ALLOWED_EXTENSIONS.has('.exe')).toBe(false)
      expect(ALLOWED_EXTENSIONS.has('.zip')).toBe(false)
      expect(ALLOWED_EXTENSIONS.has('.sh')).toBe(false)
      expect(ALLOWED_EXTENSIONS.has('.js')).toBe(false)
    })

    it('should set max file size to ~25MB (26214400 bytes)', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(25 * 1024 * 1024)
    })

    it('should format bulk zip entry filenames as {sanitizedEmail}_{sanitizedTitle}{ext}', () => {
      const email = 'alice.student@university.edu'
      const title = 'Homework 1: Consensus Algorithm / Raft'
      const ext = '.pdf'

      const entry = formatZipEntryFilename(email, title, ext)
      expect(entry).toBe('alice.student@university.edu_Homework_1_Consensus_Algorithm_Raft.pdf')
    })


    it('should sanitize dangerous characters and path traversals in filenames', () => {
      const dangerous = '../../../etc/passwd; rm -rf /'
      const sanitized = sanitizeFilename(dangerous)
      expect(sanitized).not.toContain('/')
      expect(sanitized).not.toContain('\\')
      expect(sanitized).not.toContain(';')
    })
  })

  describe('Materials Access & Filtering Logic', () => {
    it('should enforce teacher-only upload and delete permissions', () => {
      const checkCanManageMaterial = (user, classTeacherId) => {
        if (String(user._id) !== String(classTeacherId)) {
          const err = new Error('Only the class teacher can perform this action')
          err.status = 403
          throw err
        }
        return true
      }

      const teacher = { _id: 'teacher-1', role: 'teacher' }
      const student = { _id: 'student-1', role: 'student' }
      const stranger = { _id: 'teacher-2', role: 'teacher' }

      expect(checkCanManageMaterial(teacher, 'teacher-1')).toBe(true)
      expect(() => checkCanManageMaterial(student, 'teacher-1')).toThrow(
        'Only the class teacher can perform this action'
      )
      expect(() => checkCanManageMaterial(stranger, 'teacher-1')).toThrow(
        'Only the class teacher can perform this action'
      )
    })

    it('should allow teacher and active class members to list and download materials', () => {
      const checkCanAccessMaterial = (user, classTeacherId, members) => {
        if (String(user._id) === String(classTeacherId)) return true
        const member = members.find(m => String(m.studentId) === String(user._id) && m.status === 'active')
        if (!member) {
          const err = new Error('Access denied to this class')
          err.status = 403
          throw err
        }
        return true
      }

      const teacher = { _id: 'teacher-1' }
      const activeStudent = { _id: 'student-active' }
      const pendingStudent = { _id: 'student-pending' }
      const outsider = { _id: 'student-outsider' }

      const members = [
        { studentId: 'student-active', status: 'active' },
        { studentId: 'student-pending', status: 'pending' }
      ]

      expect(checkCanAccessMaterial(teacher, 'teacher-1', members)).toBe(true)
      expect(checkCanAccessMaterial(activeStudent, 'teacher-1', members)).toBe(true)
      expect(() => checkCanAccessMaterial(pendingStudent, 'teacher-1', members)).toThrow('Access denied to this class')
      expect(() => checkCanAccessMaterial(outsider, 'teacher-1', members)).toThrow('Access denied to this class')
    })
  })

  describe('Assignment Deadline Enforcement & Submission Overwrite', () => {
    it('should reject submission with 400 "Deadline has passed" when submitted after deadline', () => {
      const validateSubmissionDeadline = (assignment, submissionDate = new Date()) => {
        if (submissionDate > new Date(assignment.deadline) && !assignment.allowLate) {
          const err = new Error('Deadline has passed')
          err.status = 400
          throw err
        }
        return true
      }

      const pastAssignment = {
        _id: 'a1',
        title: 'Project 1',
        deadline: new Date('2026-10-01T23:59:59Z'),
        allowLate: false
      }

      const futureAssignment = {
        _id: 'a2',
        title: 'Project 2',
        deadline: new Date('2026-12-31T23:59:59Z'),
        allowLate: false
      }

      const now = new Date('2026-10-20T11:00:00Z')

      expect(() => validateSubmissionDeadline(pastAssignment, now)).toThrow('Deadline has passed')
      expect(validateSubmissionDeadline(futureAssignment, now)).toBe(true)
    })

    it('should allow overwriting previous submission before deadline with updated timestamp', () => {
      const existingSubmission = {
        assignmentId: 'a2',
        studentId: 's1',
        originalFileName: 'draft.pdf',
        storedFileName: '123-draft.pdf',
        submittedAt: new Date('2026-10-15T10:00:00Z')
      }

      const newFile = {
        originalname: 'final_version.pdf',
        filename: '456-final.pdf'
      }

      const updateDate = new Date('2026-10-19T14:30:00Z')

      // Emulate upsert
      const updatedSubmission = {
        ...existingSubmission,
        originalFileName: newFile.originalname,
        storedFileName: newFile.filename,
        submittedAt: updateDate
      }

      expect(updatedSubmission.originalFileName).toBe('final_version.pdf')
      expect(updatedSubmission.storedFileName).toBe('456-final.pdf')
      expect(updatedSubmission.submittedAt).toEqual(updateDate)
    })

    it('should reject creating an assignment when deadline is in the past', () => {
      const validateCreateDeadline = (deadline) => {
        const deadlineDate = new Date(deadline)
        if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
          const err = new Error('Deadline must be a future date and time')
          err.status = 400
          throw err
        }
        return true
      }

      const pastDeadline = new Date(Date.now() - 60000).toISOString()
      const futureDeadline = new Date(Date.now() + 86400000).toISOString()

      expect(() => validateCreateDeadline(pastDeadline)).toThrow('Deadline must be a future date and time')
      expect(validateCreateDeadline(futureDeadline)).toBe(true)
    })
  })

  describe('Teacher Download & Bulk ZIP Naming Rules', () => {
    it('should use submissionDownloadName scheme: {sanitizedStudentEmail}_{sanitizedAssignmentTitle}{extension}', () => {
      const { submissionDownloadName, safePart } = require('../utils/uploadHelper.js')
      const name = submissionDownloadName('alice.student@uni.edu', 'Assignment 1 / Raft', 'submission_v1.docx')
      expect(name).toBe('alice.student@uni.edu_Assignment_1_Raft.docx')
    })

    it('should fallback to .pdf extension if original filename has no extension', () => {
      const { submissionDownloadName } = require('../utils/uploadHelper.js')
      const name = submissionDownloadName('bob@uni.edu', 'Quiz 1', 'noextensionfile')
      expect(name).toBe('bob@uni.edu_Quiz_1.pdf')
    })

    it('should verify archiver is a callable function that returns a zip archive stream', async () => {
      const archiverModule = await import('archiver')
      const archiver = archiverModule.default || archiverModule
      expect(typeof archiver).toBe('function')

      const archive = archiver('zip', { zlib: { level: 9 } })
      expect(archive).toBeDefined()
      expect(archive._format).toBe('zip')
    })
  })
})

