import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

jest.mock('../config.js', () => ({
  API_URL: '/spandan/api',
  BASE_PATH: '/spandan',
  SOCKET_URL: ''
}))

window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {}
}))

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

// Mock API
jest.mock('../lib/api', () => ({
  classApi: {
    getAll: jest.fn().mockResolvedValue({
      classes: [
        {
          _id: 'class-1',
          name: 'Distributed Systems 2026',
          code: 'DS2026',
          totalSessions: 4,
          totalMembers: 12,
          pendingRequests: 1,
          activeSession: { _id: 'room-1', name: 'Lecture 4: Consensus', code: 'RAFT26' }
        }
      ]
    }),
    getById: jest.fn().mockResolvedValue({
      class: {
        _id: 'class-1',
        name: 'Distributed Systems 2026',
        code: 'DS2026',
        teacher: { _id: 'teacher-1', name: 'Prof. Miller', email: 'miller@spandan.edu' }
      },
      activeSession: { _id: 'room-1', name: 'Lecture 4: Consensus', code: 'RAFT26' },
      stats: { totalSessions: 4, totalMembers: 12, pendingRequests: 1 }
    }),
    getSessions: jest.fn().mockResolvedValue({
      sessions: [
        { _id: 'room-1', name: 'Lecture 4: Consensus', code: 'RAFT26', isActive: true, endedAt: null, questionCount: 2, responseCount: 15 },
        { _id: 'room-2', name: 'Lecture 3: Paxos', code: 'PAX301', isActive: false, endedAt: '2026-10-10', questionCount: 5, responseCount: 40 }
      ]
    }),
    getStats: jest.fn().mockResolvedValue({
      stats: {
        totalSessions: 4,
        totalMembers: 12,
        pendingRequests: 1,
        totalQuestions: 15,
        totalResponses: 150,
        averageAccuracy: 78
      }
    }),
    getMembers: jest.fn().mockResolvedValue({
      active: [
        { _id: 'm1', studentId: 's1', name: 'Alice Smith', email: 'alice@uni.edu', sessionsAttended: 4, pollsAttempted: 15, correctCount: 13, accuracy: 87, status: 'active' },
        { _id: 'm2', studentId: 's2', name: 'Bob Jones', email: 'bob@uni.edu', sessionsAttended: 3, pollsAttempted: 12, correctCount: 9, accuracy: 75, status: 'active' },
        { _id: 'm3', studentId: 's3', name: 'Charlie Brown', email: 'charlie@uni.edu', sessionsAttended: 2, pollsAttempted: 8, correctCount: 4, accuracy: 50, status: 'active' },
        { _id: 'm4', studentId: 's4', name: 'David Lee', email: 'david@uni.edu', sessionsAttended: 1, pollsAttempted: 4, correctCount: 2, accuracy: 50, status: 'active' },
        { _id: 'm5', studentId: 's5', name: 'Emma Wilson', email: 'emma@uni.edu', sessionsAttended: 4, pollsAttempted: 15, correctCount: 15, accuracy: 100, status: 'active' },
        { _id: 'm6', studentId: 's6', name: 'Frank Miller', email: 'frank@uni.edu', sessionsAttended: 3, pollsAttempted: 10, correctCount: 8, accuracy: 80, status: 'active' },
        { _id: 'm7', studentId: 's7', name: 'Grace Hopper', email: 'grace@uni.edu', sessionsAttended: 4, pollsAttempted: 15, correctCount: 14, accuracy: 93, status: 'active' },
        { _id: 'm8', studentId: 's8', name: 'Hank Rearden', email: 'hank@uni.edu', sessionsAttended: 2, pollsAttempted: 7, correctCount: 5, accuracy: 71, status: 'active' },
        { _id: 'm9', studentId: 's9', name: 'Ivy Chen', email: 'ivy@uni.edu', sessionsAttended: 1, pollsAttempted: 3, correctCount: 1, accuracy: 33, status: 'active' }
      ],
      pending: [
        { _id: 'p1', studentId: 'sp1', name: 'Pending Pete', email: 'pete@uni.edu', status: 'pending' }
      ],
      removed: [],
      totalClassSessions: 4
    }),
    getMemberPerformance: jest.fn().mockResolvedValue({
      student: { _id: 's1', name: 'Alice Smith', email: 'alice@uni.edu' },
      status: 'active',
      sessionsAttended: 4,
      totalClassSessions: 4,
      pollsAttempted: 15,
      correctCount: 13,
      accuracy: 87,
      sessions: [
        { roomId: 'room-1', roomName: 'Lecture 4: Consensus', date: '2026-10-15', attended: true, pollsAttempted: 2, correctCount: 2, accuracy: 100 }
      ]
    }),
    create: jest.fn(),
    join: jest.fn(),
    createSession: jest.fn(),
    updateMember: jest.fn().mockResolvedValue({ success: true })
  }
}))

import TeacherClassesPage from '../pages/TeacherClassesPage'
import TeacherClassDetailPage from '../pages/TeacherClassDetailPage'

describe('TeacherClassesPage', () => {
  it('renders classes list with code, live pill, and overview statistics', async () => {
    render(
      <MemoryRouter initialEntries={['/teacher/classes']}>
        <Routes>
          <Route path="/teacher/classes" element={<TeacherClassesPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Distributed Systems 2026')).toBeInTheDocument()
    })

    expect(screen.getByText('DS2026')).toBeInTheDocument()
    expect(screen.getByText('Live Session')).toBeInTheDocument()
    expect(screen.getByText('1 pending')).toBeInTheDocument()
    expect(screen.getByText('Total classes')).toBeInTheDocument()
  })
})

describe('TeacherClassDetailPage', () => {
  it('renders compact student table with columns: Avatar+Name, Email, Sessions attended, Polls attempted, Correct, Actions', async () => {
    render(
      <MemoryRouter initialEntries={['/teacher/classes/class-1']}>
        <Routes>
          <Route path="/teacher/classes/:id" element={<TeacherClassDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })

    // Enforce Rule 1: message "End the current live session first" appears when session is live
    expect(screen.getByText(/End the current live session first/)).toBeInTheDocument()

    // Requirement 3: Session list and live banner do NOT expose room codes
    expect(screen.queryByText('RAFT26')).not.toBeInTheDocument()
    expect(screen.queryByText('PAX301')).not.toBeInTheDocument()

    // Switch to Performance tab
    const perfTabButton = screen.getByRole('button', { name: /Performance/i })
    fireEvent.click(perfTabButton)

    // Check performance table headers
    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Sessions Attended')).toBeInTheDocument()
    expect(screen.getByText('Polls Attempted')).toBeInTheDocument()
    expect(screen.getByText('Correct (Count + %)')).toBeInTheDocument()
    expect(screen.getAllByText('Actions').length).toBeGreaterThanOrEqual(1)

    // Primary action: Export CSV button in Performance tab
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()

    // Enforce Rule 3: Compact list with Show More toggle (only first 7 students rendered initially)
    expect(screen.getByText(/Show more \(2 more\)/)).toBeInTheDocument()
    expect(screen.queryByText('Ivy Chen')).not.toBeInTheDocument() // 9th student initially hidden

    // Click "Show more"
    fireEvent.click(screen.getByText(/Show more/))
    expect(screen.getByText('Ivy Chen')).toBeInTheDocument() // Now visible
    expect(screen.getByText(/Show less/)).toBeInTheDocument()
  })

  it('renders pending requests section with Approve and Reject buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/teacher/classes/class-1']}>
        <Routes>
          <Route path="/teacher/classes/:id" element={<TeacherClassDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Pending Pete')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reject/ })).toBeInTheDocument()
  })

  it('opens person-wise performance panel when clicking View on a student row', async () => {
    render(
      <MemoryRouter initialEntries={['/teacher/classes/class-1']}>
        <Routes>
          <Route path="/teacher/classes/:id" element={<TeacherClassDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByRole('button', { name: /View/ })
    fireEvent.click(viewButtons[0]) // Click first student's View

    await waitFor(() => {
      expect(screen.getByText('Class Performance Summary')).toBeInTheDocument()
    })

    expect(screen.getByText('Per-Session Breakdown')).toBeInTheDocument()
    expect(screen.getAllByText('Lecture 4: Consensus').length).toBeGreaterThanOrEqual(1)
  })
})
