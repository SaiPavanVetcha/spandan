import path from 'path'
import fs from 'fs'
import ClassMaterial from '../models/ClassMaterial.js'
import Class from '../models/Class.js'
import ClassMember from '../models/ClassMember.js'
import Room from '../models/Room.js'
import { MATERIALS_DIR, removeFile } from '../utils/uploadHelper.js'

/**
 * Access verification helper for class materials and assignments
 */
export const verifyClassAccess = async (classId, user, { requireTeacher = false, requireActiveStudent = false } = {}) => {
  const cls = await Class.findById(classId)
  if (!cls) {
    const err = new Error('Class not found')
    err.status = 404
    throw err
  }

  const isTeacher = String(cls.teacher) === String(user._id)

  if (requireTeacher) {
    if (!isTeacher) {
      const err = new Error('Only the class teacher can perform this action')
      err.status = 403
      throw err
    }
    return { cls, isTeacher: true, member: null }
  }

  if (isTeacher) {
    return { cls, isTeacher: true, member: null }
  }

  // Check active student membership
  const member = await ClassMember.findOne({ classId, studentId: user._id, status: 'active' })
  if (!member) {
    const err = new Error('Access denied to this class')
    err.status = 403
    throw err
  }

  if (requireActiveStudent && user.role !== 'student') {
    const err = new Error('Only students can submit assignments')
    err.status = 403
    throw err
  }

  return { cls, isTeacher: false, member }
}

/**
 * Get all materials for a class, newest first, optional session filter
 */
export const getMaterials = async (classId, user, { sessionId } = {}) => {
  await verifyClassAccess(classId, user)

  const filter = { classId }
  if (sessionId !== undefined && sessionId !== null && sessionId !== '') {
    if (sessionId === 'general' || sessionId === 'null') {
      filter.sessionId = null
    } else {
      filter.sessionId = sessionId
    }
  }

  const materials = await ClassMaterial.find(filter)
    .sort({ uploadedAt: -1 })
    .populate('uploadedBy', 'name email profileImage')
    .populate('sessionId', 'name code createdAt')
    .lean()

  return materials
}

/**
 * Upload a new class material (Teacher only)
 */
export const createMaterial = async (classId, user, { title, description, sessionId }, file) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  if (!title || !title.trim()) {
    if (file) removeFile(path.join(MATERIALS_DIR, file.filename))
    const err = new Error('Topic / Title is required')
    err.status = 400
    throw err
  }

  if (!file) {
    const err = new Error('File is required')
    err.status = 400
    throw err
  }

  let validSessionId = null
  if (sessionId && sessionId !== 'null' && sessionId !== 'undefined' && sessionId !== 'general') {
    const room = await Room.findOne({ _id: sessionId, classId }).lean()
    if (room) {
      validSessionId = room._id
    }
  }

  const material = await ClassMaterial.create({
    classId,
    uploadedBy: user._id,
    title: title.trim(),
    description: description ? description.trim() : '',
    sessionId: validSessionId,
    originalFileName: file.originalname,
    storedFileName: file.filename,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    uploadedAt: new Date()
  })

  return ClassMaterial.findById(material._id)
    .populate('uploadedBy', 'name email')
    .populate('sessionId', 'name code')
    .lean()
}

/**
 * Get material for download with file existence check
 */
export const getMaterialForDownload = async (classId, materialId, user) => {
  await verifyClassAccess(classId, user)

  const material = await ClassMaterial.findOne({ _id: materialId, classId }).lean()
  if (!material) {
    const err = new Error('Material not found')
    err.status = 404
    throw err
  }

  const filePath = path.join(MATERIALS_DIR, material.storedFileName)
  if (!fs.existsSync(filePath)) {
    const err = new Error('File not found on server')
    err.status = 404
    throw err
  }

  return { material, filePath }
}

/**
 * Delete material (Teacher only) - removes file from disk and DB record
 */
export const deleteMaterial = async (classId, materialId, user) => {
  await verifyClassAccess(classId, user, { requireTeacher: true })

  const material = await ClassMaterial.findOne({ _id: materialId, classId })
  if (!material) {
    const err = new Error('Material not found')
    err.status = 404
    throw err
  }

  // Hard delete file from disk
  const filePath = path.join(MATERIALS_DIR, material.storedFileName)
  removeFile(filePath)

  await ClassMaterial.deleteOne({ _id: materialId })

  return { success: true, message: 'Material deleted successfully' }
}
