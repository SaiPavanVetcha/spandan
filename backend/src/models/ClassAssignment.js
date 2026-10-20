import mongoose from 'mongoose'

const classAssignmentSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },
  title: {
    type: String,
    required: [true, 'Assignment title is required'],
    trim: true,
    maxlength: [250, 'Title cannot exceed 250 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  deadline: {
    type: Date,
    required: [true, 'Assignment deadline is required']
  },
  originalFileName: {
    type: String,
    default: null,
    trim: true
  },
  storedFileName: {
    type: String,
    default: null,
    trim: true
  },
  mimeType: {
    type: String,
    default: null,
    trim: true
  },
  sizeBytes: {
    type: Number,
    default: null
  },
  allowLate: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
})

classAssignmentSchema.index({ classId: 1, createdAt: -1 })
classAssignmentSchema.index({ classId: 1, deadline: 1 })

const ClassAssignment = mongoose.model('ClassAssignment', classAssignmentSchema)

export default ClassAssignment
