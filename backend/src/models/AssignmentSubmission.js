import mongoose from 'mongoose'

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassAssignment',
    required: [true, 'Assignment ID is required'],
    index: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, 'Class ID is required'],
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required'],
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
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Unique constraint: one submission per student per assignment (overwrite updates this doc)
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true })
assignmentSubmissionSchema.index({ classId: 1, assignmentId: 1 })

const AssignmentSubmission = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema)

export default AssignmentSubmission
