import path from 'path'
import fs from 'fs'
import ClassAssignment from '../models/ClassAssignment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import ClassMember from '../models/ClassMember.js'
import { verifyClassAccess } from './materialService.js'
import {
  ASSIGNMENTS_DIR,
  SUBMISSIONS_DIR,
  removeFile,
  formatZipEntryFilename
} from '../utils/uploadHelper.js'

/**
 * Get assignments for class with submission status / counts
 */
export const getAssignments = async (classId, user) => {
  const { isTeacher } = await verifyClassAccess(classId, user)

  const assignments = await ClassAssignment.find({ classId })
    .sort({ createdAt: -1 })
    .lean()

  const totalActiveStudents = await ClassMember.countDocuments({ classId, status: 'active' })

  if (isTeacher) {
    const assignmentIds = assignments.map(a => a._id)
    const submissionsCounts = await AssignmentSubmission.aggregate([
      { $match: { assignmentId: { $in: assignmentIds } } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } }
    ])
    const countMap = {}
    for (const sc of submissionsCounts) {
      countMap[String(sc._id)] = sc.count
    }

    const assignmentsWithStats = assignments.map(a => ({
      ...a,
      submittedCount: countMap[String(a._id)] || 0,
      totalActiveStudents,
      isPastDeadline: new Date() > new Date(a.deadline)
    }))

    return { assignments: assignmentsWithStats, totalActiveStudents }
  } else {
    // Student view
    const submissions = await AssignmentSubmission.find({
      classId,
      studentId: user._id
    }).lean()

    const subMap = {}
    for (const s of submissions) {
      subMap[String(s.assignmentId)] = s
    }

    const assignmentsWithStatus = assignments.map(a => {
      const mySub = subMap[String(a._id)] || null
      return {
        ...a,
        totalActiveStudents,
        mySubmission: mySub,
        hasSubmitted: Boolean(mySub),
        isPastDeadline: new Date() > new Date(a.deadline)
      }
    })

    return { assignments: assignmentsWithStatus, totalActiveStudents }
  }
}

/**
 * Create a new assignment (Teacher only)
 */
export const createAssignment = async (classId, user, { title, description, deadline, allowLate }, file) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  if (!title || !title.trim()) {
    if (file) removeFile(path.join(ASSIGNMENTS_DIR, file.filename))
    const err = new Error('Assignment title is required')
    err.status = 400
    throw err
  }

  if (!deadline) {
    if (file) removeFile(path.join(ASSIGNMENTS_DIR, file.filename))
    const err = new Error('Deadline is required')
    err.status = 400
    throw err
  }

  const parsedDeadline = new Date(deadline)
  if (isNaN(parsedDeadline.getTime())) {
    if (file) removeFile(path.join(ASSIGNMENTS_DIR, file.filename))
    const err = new Error('A valid deadline date is required')
    err.status = 400
    throw err
  }

  const assignment = await ClassAssignment.create({
    classId,
    createdBy: user._id,
    title: title.trim(),
    description: description ? description.trim() : '',
    deadline: parsedDeadline,
    allowLate: Boolean(allowLate),
    originalFileName: file ? file.originalname : null,
    storedFileName: file ? file.filename : null,
    mimeType: file ? file.mimetype : null,
    sizeBytes: file ? file.size : null
  })

  return assignment
}

/**
 * Get single assignment detail
 */
export const getAssignmentById = async (classId, assignmentId, user) => {
  const { isTeacher } = await verifyClassAccess(classId, user)

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId }).lean()
  if (!assignment) {
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  const totalActiveStudents = await ClassMember.countDocuments({ classId, status: 'active' })

  if (isTeacher) {
    const submittedCount = await AssignmentSubmission.countDocuments({ assignmentId })
    return {
      assignment: {
        ...assignment,
        submittedCount,
        totalActiveStudents,
        isPastDeadline: new Date() > new Date(assignment.deadline)
      }
    }
  } else {
    const mySubmission = await AssignmentSubmission.findOne({
      assignmentId,
      studentId: user._id
    }).lean()

    return {
      assignment: {
        ...assignment,
        totalActiveStudents,
        mySubmission,
        hasSubmitted: Boolean(mySubmission),
        isPastDeadline: new Date() > new Date(assignment.deadline)
      }
    }
  }
}

/**
 * Download assignment attached file (Teacher or active student)
 */
export const downloadAssignmentFile = async (classId, assignmentId, user) => {
  await verifyClassAccess(classId, user)

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId }).lean()
  if (!assignment) {
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  if (!assignment.storedFileName) {
    const err = new Error('This assignment does not have an attached file')
    err.status = 404
    throw err
  }

  const filePath = path.join(ASSIGNMENTS_DIR, assignment.storedFileName)
  if (!fs.existsSync(filePath)) {
    const err = new Error('Assignment file not found on server')
    err.status = 404
    throw err
  }

  return { assignment, filePath }
}

/**
 * Submit or replace assignment submission (Active student only, enforce deadline)
 */
export const submitAssignment = async (classId, assignmentId, user, file) => {
  await verifyClassAccess(classId, user, { requireActiveStudent: true })

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId })
  if (!assignment) {
    if (file) removeFile(path.join(SUBMISSIONS_DIR, file.filename))
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  const now = new Date()
  if (now > new Date(assignment.deadline) && !assignment.allowLate) {
    if (file) removeFile(path.join(SUBMISSIONS_DIR, file.filename))
    const err = new Error('Deadline has passed')
    err.status = 400
    throw err
  }

  if (!file) {
    const err = new Error('Submission file is required')
    err.status = 400
    throw err
  }

  const existingSubmission = await AssignmentSubmission.findOne({
    assignmentId,
    studentId: user._id
  })

  if (existingSubmission) {
    // Delete previous file from disk
    const oldFilePath = path.join(SUBMISSIONS_DIR, existingSubmission.storedFileName)
    removeFile(oldFilePath)

    existingSubmission.originalFileName = file.originalname
    existingSubmission.storedFileName = file.filename
    existingSubmission.mimeType = file.mimetype
    existingSubmission.sizeBytes = file.size
    existingSubmission.submittedAt = now
    await existingSubmission.save()

    return {
      message: 'Assignment submission updated successfully',
      submission: existingSubmission,
      overwritten: true
    }
  } else {
    const newSubmission = await AssignmentSubmission.create({
      assignmentId,
      classId,
      studentId: user._id,
      originalFileName: file.originalname,
      storedFileName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      submittedAt: now
    })

    return {
      message: 'Assignment submitted successfully',
      submission: newSubmission,
      overwritten: false
    }
  }
}

/**
 * List all active students in class and their submission status (Teacher only)
 */
export const getSubmissionsForAssignment = async (classId, assignmentId, user) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId }).lean()
  if (!assignment) {
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  const activeMembers = await ClassMember.find({ classId, status: 'active' })
    .populate('studentId', 'name email profileImage')
    .lean()

  const submissions = await AssignmentSubmission.find({ assignmentId }).lean()
  const subMap = {}
  for (const s of submissions) {
    subMap[String(s.studentId)] = s
  }

  const rows = activeMembers.map(m => {
    const stu = m.studentId
    const sub = stu ? subMap[String(stu._id)] : null
    return {
      student: stu ? {
        _id: stu._id,
        name: stu.name,
        email: stu.email,
        profileImage: stu.profileImage
      } : { _id: m.studentId, name: 'Unknown Student', email: '' },
      hasSubmitted: Boolean(sub),
      submittedAt: sub ? sub.submittedAt : null,
      submission: sub ? {
        _id: sub._id,
        originalFileName: sub.originalFileName,
        sizeBytes: sub.sizeBytes,
        mimeType: sub.mimeType,
        submittedAt: sub.submittedAt
      } : null
    }
  })

  // Sort: submitted first (newest to oldest), then not submitted (alphabetical by student name)
  rows.sort((a, b) => {
    if (a.hasSubmitted && !b.hasSubmitted) return -1
    if (!a.hasSubmitted && b.hasSubmitted) return 1
    if (a.hasSubmitted && b.hasSubmitted) {
      return new Date(b.submittedAt) - new Date(a.submittedAt)
    }
    return (a.student?.name || '').localeCompare(b.student?.name || '')
  })

  return {
    assignment,
    submissions: rows,
    submittedCount: submissions.length,
    totalActiveStudents: activeMembers.length,
    isPastDeadline: new Date() > new Date(assignment.deadline)
  }
}

/**
 * Download a single student's submission (Teacher or that specific student)
 */
export const downloadStudentSubmission = async (classId, assignmentId, studentId, user) => {
  const { isTeacher } = await verifyClassAccess(classId, user)

  if (!isTeacher && String(user._id) !== String(studentId)) {
    const err = new Error('You can only download your own submission')
    err.status = 403
    throw err
  }

  const submission = await AssignmentSubmission.findOne({
    assignmentId,
    classId,
    studentId
  }).populate('studentId', 'name email').lean()

  if (!submission) {
    const err = new Error('Submission not found')
    err.status = 404
    throw err
  }

  const filePath = path.join(SUBMISSIONS_DIR, submission.storedFileName)
  if (!fs.existsSync(filePath)) {
    const err = new Error('Submission file not found on server')
    err.status = 404
    throw err
  }

  return { submission, filePath }
}

/**
 * Prepare bulk download submissions for assignment (Teacher only)
 */
export const getSubmissionsForBulkDownload = async (classId, assignmentId, user) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId }).lean()
  if (!assignment) {
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  const submissions = await AssignmentSubmission.find({ assignmentId })
    .populate('studentId', 'name email')
    .lean()

  return { assignment, submissions }
}

/**
 * Delete assignment and all submissions (Teacher only)
 */
export const deleteAssignment = async (classId, assignmentId, user) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  const assignment = await ClassAssignment.findOne({ _id: assignmentId, classId })
  if (!assignment) {
    const err = new Error('Assignment not found')
    err.status = 404
    throw err
  }

  // Delete attached assignment file if present
  if (assignment.storedFileName) {
    removeFile(path.join(ASSIGNMENTS_DIR, assignment.storedFileName))
  }

  // Delete all student submission files from disk
  const submissions = await AssignmentSubmission.find({ assignmentId })
  for (const s of submissions) {
    removeFile(path.join(SUBMISSIONS_DIR, s.storedFileName))
  }

  await AssignmentSubmission.deleteMany({ assignmentId })
  await ClassAssignment.deleteOne({ _id: assignmentId })

  return { success: true, message: 'Assignment and all submissions deleted successfully' }
}
