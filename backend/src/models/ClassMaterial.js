import mongoose from 'mongoose'

const classMaterialSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required'],
    index: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader ID is required']
  },
  title: {
    type: String,
    required: [true, 'Topic / Title is required'],
    trim: true,
    maxlength: [250, 'Title cannot exceed 250 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null,
    index: true
  },
  originalFileName: {
    type: String,
    required: [true, 'Original file name is required'],
    trim: true
  },
  storedFileName: {
    type: String,
    required: [true, 'Stored file name is required'],
    trim: true
  },
  mimeType: {
    type: String,
    required: true,
    trim: true
  },
  sizeBytes: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
})

// Fast query indexes: list by class newest first, optionally filtered by session
classMaterialSchema.index({ classId: 1, uploadedAt: -1 })
classMaterialSchema.index({ classId: 1, sessionId: 1, uploadedAt: -1 })

const ClassMaterial = mongoose.model('ClassMaterial', classMaterialSchema)

export default ClassMaterial
