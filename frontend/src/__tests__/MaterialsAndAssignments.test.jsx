import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClassMaterialsTab from '../components/ClassMaterialsTab'
import ClassAssignmentsTab from '../components/ClassAssignmentsTab'

// Mock Stores
jest.mock('../stores/authStore', () => () => ({
  user: { _id: 'teacher-1', name: 'Prof. Miller', email: 'miller@spandan.edu', role: 'teacher' },
  token: 'mock-token'
}))

jest.mock('../stores/socketStore', () => () => ({
  socket: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }
}))

jest.mock('../lib/api', () => {
  const materialsList = [
    {
      _id: 'mat-1',
      classId: 'class-1',
      title: 'Lecture 1 Slides',
      description: 'Overview of distributed consensus',
      sessionId: { _id: 'sess-1', name: 'Lecture 1: Raft' },
      originalFileName: 'consensus_overview.pdf',
      storedFileName: '123-stored.pdf',
      sizeBytes: 2048000,
      uploadedAt: '2026-10-15T10:00:00.000Z'
    },
    {
      _id: 'mat-2',
      classId: 'class-1',
      title: 'Syllabus & Course Policies',
      description: '',
      sessionId: null,
      originalFileName: 'syllabus.docx',
      storedFileName: '124-stored.docx',
      sizeBytes: 512000,
      uploadedAt: '2026-10-10T09:00:00.000Z'
    }
  ]

  const assignmentsList = [
    {
      _id: 'assign-1',
      classId: 'class-1',
      title: 'Homework 1: Consensus Algorithm',
      description: 'Implement leader election in Python or Go',
      deadline: '2026-12-31T23:59:59.000Z',
      originalFileName: 'hw1_spec.pdf',
      submittedCount: 2,
      isPastDeadline: false
    },
    {
      _id: 'assign-2',
      classId: 'class-1',
      title: 'Lab 0: Environment Setup',
      description: 'Setup Redis and Docker',
      deadline: '2026-01-01T23:59:59.000Z',
      originalFileName: null,
      submittedCount: 5,
      isPastDeadline: true
    }
  ]

  return {
    materialApi: {
      getAll: jest.fn().mockResolvedValue({ materials: materialsList }),
      upload: jest.fn().mockResolvedValue({ success: true }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      download: jest.fn().mockResolvedValue({ success: true })
    },
    assignmentApi: {
      getAll: jest.fn().mockResolvedValue({
        assignments: assignmentsList,
        totalActiveStudents: 5
      }),
      create: jest.fn().mockResolvedValue({ success: true }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      downloadAssignment: jest.fn().mockResolvedValue({ success: true }),
      downloadSubmission: jest.fn().mockResolvedValue({ success: true }),
      bulkDownload: jest.fn().mockResolvedValue({ success: true }),
      submit: jest.fn().mockResolvedValue({ success: true }),
      getSubmissions: jest.fn().mockResolvedValue({
        assignment: assignmentsList[0],
        submissions: [
          {
            student: { _id: 's1', name: 'Alice Smith', email: 'alice@uni.edu' },
            hasSubmitted: true,
            submittedAt: '2026-10-18T14:00:00.000Z',
            submission: { originalFileName: 'alice_hw1.pdf', sizeBytes: 1024000 }
          },
          {
            student: { _id: 's2', name: 'Bob Jones', email: 'bob@uni.edu' },
            hasSubmitted: false,
            submittedAt: null,
            submission: null
          }
        ],
        submittedCount: 1,
        totalActiveStudents: 2
      })
    }
  }
})

describe('ClassMaterialsTab', () => {
  it('renders materials list with title, file size, session link and download button', async () => {
    render(
      <ClassMaterialsTab
        classId="class-1"
        isTeacher={true}
        sessions={[{ _id: 'sess-1', name: 'Lecture 1: Raft' }]}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Lecture 1 Slides')).toBeInTheDocument()
    })

    expect(screen.getByText('Syllabus & Course Policies')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText(/consensus_overview.pdf/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Download/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Upload Material/i })).toBeInTheDocument()
  })

  it('opens upload material modal on click for teacher', async () => {
    render(
      <ClassMaterialsTab
        classId="class-1"
        isTeacher={true}
        sessions={[{ _id: 'sess-1', name: 'Lecture 1: Raft' }]}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Upload Material/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Upload Material/i }))

    expect(screen.getByText('Upload Course Material')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Week 3: Raft/i)).toBeInTheDocument()
  })

  it('hides upload button and delete button for student view', async () => {
    render(
      <ClassMaterialsTab
        classId="class-1"
        isTeacher={false}
        sessions={[{ _id: 'sess-1', name: 'Lecture 1: Raft' }]}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Lecture 1 Slides')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Upload Material/i })).not.toBeInTheDocument()
  })
})

describe('ClassAssignmentsTab', () => {
  it('renders assignments list with deadline, status, and submitted count for teacher', async () => {
    render(
      <ClassAssignmentsTab
        classId="class-1"
        isTeacher={true}
        user={{ _id: 'teacher-1', role: 'teacher' }}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Homework 1: Consensus Algorithm')).toBeInTheDocument()
    })

    expect(screen.getByText('Lab 0: Environment Setup')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Deadline Passed')).toBeInTheDocument()
    expect(screen.getByText('2 / 5 submitted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Assignment/i })).toBeInTheDocument()
  })

  it('opens and loads student submissions table when clicking View Student Submissions', async () => {
    render(
      <ClassAssignmentsTab
        classId="class-1"
        isTeacher={true}
        user={{ _id: 'teacher-1', role: 'teacher' }}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Homework 1: Consensus Algorithm')).toBeInTheDocument()
    })

    const viewSubmissionsBtn = screen.getAllByText(/View Student Submissions/i)[0]
    fireEvent.click(viewSubmissionsBtn)

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })

    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('alice_hw1.pdf')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Bulk Download/i }).length).toBeGreaterThanOrEqual(1)
  })


  it('renders student view with submission button and blocks submit after deadline', async () => {
    render(
      <ClassAssignmentsTab
        classId="class-1"
        isTeacher={false}
        user={{ _id: 'student-1', role: 'student' }}
        isMobile={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Homework 1: Consensus Algorithm')).toBeInTheDocument()
    })

    // Active assignment has Choose File + Submit buttons
    expect(screen.getByText('Ready to submit your assignment?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument()

    // Closed assignment shows deadline passed message
    expect(screen.getByText(/Deadline has passed\. Submissions for this assignment are closed\./i)).toBeInTheDocument()
  })
})
