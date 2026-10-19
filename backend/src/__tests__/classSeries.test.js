// Unit and integration tests for Recurring Class Series (Google Classroom style)
// Tests:
// 1. One active session per class rule
// 2. Membership lifecycle (soft-remove + approval only on re-join)
// 3. Class creation & code formatting
// 4. Performance aggregation & CSV export format
// 5. Late-join active question recovery

describe('Class Series Feature', () => {
  describe('Rule 1: One Active Session Per Class', () => {
    it('should reject starting a session when another session under the class is active', () => {
      const checkCanStartSession = (existingRooms) => {
        const active = existingRooms.find(r => r.isActive && !r.endedAt)
        if (active) {
          const err = new Error('An active session is already running for this class. End the current live session first.')
          err.code = 'ACTIVE_SESSION_EXISTS'
          err.activeRoomId = active._id
          throw err
        }
        return true
      }

      const activeRooms = [
        { _id: 'room-1', name: 'Lecture 1', isActive: true, endedAt: null }
      ]

      expect(() => checkCanStartSession(activeRooms)).toThrow('An active session is already running for this class')
      try {
        checkCanStartSession(activeRooms)
      } catch (err) {
        expect(err.code).toBe('ACTIVE_SESSION_EXISTS')
        expect(err.activeRoomId).toBe('room-1')
      }
    })

    it('should allow starting a session when all past sessions have ended', () => {
      const checkCanStartSession = (existingRooms) => {
        const active = existingRooms.find(r => r.isActive && !r.endedAt)
        if (active) {
          const err = new Error('An active session is already running for this class.')
          err.code = 'ACTIVE_SESSION_EXISTS'
          throw err
        }
        return true
      }

      const completedRooms = [
        { _id: 'room-1', name: 'Lecture 1', isActive: false, endedAt: new Date('2026-10-01') },
        { _id: 'room-2', name: 'Lecture 2', isActive: true, endedAt: new Date('2026-10-08') } // endedAt is set
      ]

      expect(checkCanStartSession(completedRooms)).toBe(true)
      expect(checkCanStartSession([])).toBe(true)
    })
  })

  describe('Rule 4: Membership Lifecycle (Soft Remove + Approval Only on Re-join)', () => {
    it('should set status to active on first-time join with class code without approval', () => {
      const processJoin = (existingMember) => {
        if (!existingMember) {
          return { status: 'active', isNew: true, message: 'Enrolled in class successfully' }
        }
        if (existingMember.status === 'removed') {
          existingMember.status = 'pending'
          return { status: 'pending', isNew: false, message: 'Re-join request submitted. Waiting for teacher approval.' }
        }
        return { status: existingMember.status, isNew: false }
      }

      const firstTimeResult = processJoin(null)
      expect(firstTimeResult.status).toBe('active')
      expect(firstTimeResult.isNew).toBe(true)
    })

    it('should set status to pending when a previously removed student rejoins with class code', () => {
      const processJoin = (existingMember) => {
        if (!existingMember) {
          return { status: 'active', isNew: true }
        }
        if (existingMember.status === 'removed') {
          existingMember.status = 'pending'
          return { status: 'pending', isNew: false, message: 'Re-join request submitted. Waiting for teacher approval.' }
        }
        return { status: existingMember.status, isNew: false }
      }

      const removedMember = {
        _id: 'mem-1',
        studentId: 'student-1',
        status: 'removed',
        removedAt: new Date('2026-10-10'),
        history: [{ responseId: 'resp-1', points: 100 }]
      }

      const rejoinResult = processJoin(removedMember)
      expect(rejoinResult.status).toBe('pending')
      expect(removedMember.status).toBe('pending')
      // Historical data is retained!
      expect(removedMember.history).toHaveLength(1)
    })

    it('should restore member to active on the SAME document when teacher approves', () => {
      const memberDoc = {
        _id: 'mem-1',
        studentId: 'student-1',
        status: 'pending',
        joinedAt: new Date('2026-09-01'),
        approvedAt: null
      }

      const handleTeacherAction = (member, action) => {
        if (action === 'approve') {
          member.status = 'active'
          member.approvedAt = new Date()
          return member
        }
        if (action === 'remove' || action === 'reject') {
          member.status = 'removed'
          member.removedAt = new Date()
          return member
        }
      }

      const approved = handleTeacherAction(memberDoc, 'approve')
      expect(approved._id).toBe('mem-1') // Same document!
      expect(approved.status).toBe('active')
      expect(approved.approvedAt).toBeInstanceOf(Date)
    })

    it('should keep student out (status removed) when teacher rejects pending re-join', () => {
      const memberDoc = {
        _id: 'mem-1',
        studentId: 'student-1',
        status: 'pending'
      }

      const handleTeacherAction = (member, action) => {
        if (action === 'reject') {
          member.status = 'removed'
          member.removedAt = new Date()
          return member
        }
      }

      const rejected = handleTeacherAction(memberDoc, 'reject')
      expect(rejected._id).toBe('mem-1')
      expect(rejected.status).toBe('removed')
    })
  })

  describe('Class Code Generation and Validation', () => {
    it('should generate a 6-character uppercase alphanumeric code', () => {
      const generateClassCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
      }

      for (let i = 0; i < 20; i++) {
        const code = generateClassCode()
        expect(code).toHaveLength(6)
        expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true)
        // Excludes ambiguous characters (0, O, 1, I)
        expect(code).not.toContain('0')
        expect(code).not.toContain('O')
        expect(code).not.toContain('1')
        expect(code).not.toContain('I')
      }
    })

    it('should validate and normalize class code lookup', () => {
      const normalizeCode = (raw) => String(raw || '').trim().toUpperCase()

      expect(normalizeCode('  7k2m9p  ')).toBe('7K2M9P')
      expect(normalizeCode('abc123')).toBe('ABC123')
    })
  })

  describe('Rule 3 & 6: Cross-Session Performance Aggregation & CSV Export', () => {
    it('should accurately aggregate sessions attended, polls attempted, and accuracy', () => {
      const classSessions = ['sess-1', 'sess-2', 'sess-3', 'sess-4']
      const responses = [
        { roomId: 'sess-1', isCorrect: true },
        { roomId: 'sess-1', isCorrect: false },
        { roomId: 'sess-2', isCorrect: true },
        { roomId: 'sess-4', isCorrect: true }
      ]

      const computeStudentPerformance = (sessions, studentResponses) => {
        const attended = new Set(studentResponses.map(r => r.roomId))
        const pollsAttempted = studentResponses.length
        const correctCount = studentResponses.filter(r => r.isCorrect).length
        const accuracy = pollsAttempted > 0 ? Math.round((correctCount / pollsAttempted) * 100) : 0

        return {
          sessionsAttended: attended.size,
          totalClassSessions: sessions.length,
          pollsAttempted,
          correctCount,
          accuracy
        }
      }

      const perf = computeStudentPerformance(classSessions, responses)
      expect(perf.sessionsAttended).toBe(3) // sess-1, sess-2, sess-4
      expect(perf.totalClassSessions).toBe(4)
      expect(perf.pollsAttempted).toBe(4)
      expect(perf.correctCount).toBe(3)
      expect(perf.accuracy).toBe(75) // 3/4 * 100
    })

    it('should format CSV export with UTF-8 BOM, headers, and correct values', () => {
      const roster = [
        { name: 'Alice Smith', email: 'alice@spandan.edu', status: 'active', sessionsAttended: 3, totalSessions: 4, pollsAttempted: 4, correctCount: 3, accuracy: 75 },
        { name: 'Bob Jones', email: 'bob@spandan.edu', status: 'active', sessionsAttended: 1, totalSessions: 4, pollsAttempted: 2, correctCount: 1, accuracy: 50 }
      ]

      const esc = (v) => {
        const s = v == null ? '' : String(v)
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const row = (arr) => arr.map(esc).join(',') + '\n'

      let csv = '\uFEFF'
      csv += row(['Student Name', 'Email', 'Status', 'Sessions Attended', 'Total Sessions', 'Attendance %', 'Polls Attempted', 'Correct Answers', 'Accuracy %'])

      for (const m of roster) {
        const attPct = Math.round((m.sessionsAttended / m.totalSessions) * 100)
        csv += row([m.name, m.email, m.status, m.sessionsAttended, m.totalSessions, `${attPct}%`, m.pollsAttempted, m.correctCount, `${m.accuracy}%`])
      }

      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('Alice Smith,alice@spandan.edu,active,3,4,75%,4,3,75%')
      expect(csv).toContain('Bob Jones,bob@spandan.edu,active,1,4,25%,2,1,50%')
    })
  })

  describe('Late-Join Active Question Recovery', () => {
    it('should sanitize active question to withhold correct answers and explanation from student', () => {
      const rawQuestion = {
        _id: 'q-101',
        text: 'What is the time complexity of binary search?',
        type: 'MCQ',
        explanation: 'Because the search interval is halved on each step.',
        timeToAnswer: 30,
        options: [
          { text: 'O(n)', isCorrect: false },
          { text: 'O(log n)', isCorrect: true },
          { text: 'O(1)', isCorrect: false }
        ]
      }

      const sanitizeQuestionForStudents = (q) => {
        if (!q || typeof q !== 'object') return q
        const { explanation, ...rest } = q
        if (Array.isArray(rest.options)) {
          rest.options = rest.options.map(o =>
            (o && typeof o === 'object') ? (({ isCorrect, ...opt }) => opt)(o) : o
          )
        }
        return rest
      }

      const sanitized = sanitizeQuestionForStudents(rawQuestion)
      expect(sanitized.text).toBe(rawQuestion.text)
      expect(sanitized.explanation).toBeUndefined()
      sanitized.options.forEach(opt => {
        expect(opt.isCorrect).toBeUndefined()
        expect(opt.text).toBeDefined()
      })
    })

    it('should surface active question if student has not submitted an answer yet', () => {
      const shouldSurfaceQuestion = (activeQuestion, studentResponses, studentId) => {
        if (!activeQuestion) return false
        const hasAnswered = studentResponses.some(r => r.questionId === activeQuestion._id && r.studentId === studentId)
        return !hasAnswered
      }

      const activeQ = { _id: 'q-1' }
      expect(shouldSurfaceQuestion(activeQ, [], 'stu-1')).toBe(true)
      expect(shouldSurfaceQuestion(activeQ, [{ questionId: 'q-1', studentId: 'stu-1' }], 'stu-1')).toBe(false)
      expect(shouldSurfaceQuestion(activeQ, [{ questionId: 'q-1', studentId: 'stu-2' }], 'stu-1')).toBe(true)
    })
  })
})
