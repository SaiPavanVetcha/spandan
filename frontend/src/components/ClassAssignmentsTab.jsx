import React, { useState, useEffect } from 'react'
import { assignmentApi } from '../lib/api'
import useSocketStore from '../stores/socketStore'
import {
  primaryButton,
  ghostButton,
  inputStyle,
  Pill,
  EmptyState
} from './AppUI'
import { cardStyle, SectionHeader } from './InsightUI'
import { formatBytes, getFilePillTone } from './ClassMaterialsTab'
import {
  ClipboardList,
  Plus,
  Calendar,
  Clock,
  Download,
  Trash2,
  Upload,
  Archive,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  FileCheck,
  Lock,
  RefreshCw,
  Paperclip
} from 'lucide-react'


export default function ClassAssignmentsTab({
  classId,
  isTeacher,
  user,
  isMobile
}) {
  const { socket } = useSocketStore()

  const [assignments, setAssignments] = useState([])
  const [totalActiveStudents, setTotalActiveStudents] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Teacher: Create Assignment Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newFile, setNewFile] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  // Teacher: Expanded submissions state per assignment
  // { [assignmentId]: { open: boolean, loading: boolean, data: { submissions: [] } } }
  const [submissionsState, setSubmissionsState] = useState({})

  // Student: Submission form state per assignment
  // { [assignmentId]: { file: File, isSubmitting: boolean, showReplace: boolean } }
  const [studentActionState, setStudentActionState] = useState({})

  // Download loading trackers
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const fetchAssignments = async () => {
    try {
      setIsLoading(true)
      const res = await assignmentApi.getAll(classId)
      setAssignments(res.assignments || [])
      setTotalActiveStudents(res.totalActiveStudents || 0)
      setError(null)
    } catch (err) {
      console.error('Failed to load assignments:', err)
      setError(err.message || 'Failed to load assignments')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (classId) {
      fetchAssignments()
    }
  }, [classId])

  // Real-time socket events
  useEffect(() => {
    if (!socket || !classId) return

    const handleCreated = (data) => {
      if (String(data.classId) === String(classId)) {
        fetchAssignments()
      }
    }

    const handleDeleted = (data) => {
      if (String(data.classId) === String(classId)) {
        setAssignments(prev => prev.filter(a => a._id !== data.assignmentId))
      }
    }

    const handleSubmitted = (data) => {
      if (String(data.classId) === String(classId)) {
        fetchAssignments()
        // If teacher has submissions opened for this assignment, reload them
        if (isTeacher && submissionsState[data.assignmentId]?.open) {
          loadSubmissions(data.assignmentId)
        }
      }
    }

    socket.on('class:assignment-created', handleCreated)
    socket.on('class:assignment-deleted', handleDeleted)
    socket.on('class:assignment-submitted', handleSubmitted)

    return () => {
      socket.off('class:assignment-created', handleCreated)
      socket.off('class:assignment-deleted', handleDeleted)
      socket.off('class:assignment-submitted', handleSubmitted)
    }
  }, [socket, classId, isTeacher, submissionsState])

  // Helper for datetime-local minimum value
  const getMinDeadlineLocal = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  // Teacher: Create Assignment
  const handleCreateAssignment = async (e) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      setError('Assignment title is required')
      return
    }
    if (!newDeadline) {
      setError('Deadline is required')
      return
    }

    const deadlineDate = new Date(newDeadline)
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      setError('Deadline must be a future date and time')
      return
    }

    setIsCreating(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('title', newTitle.trim())
      if (newDescription.trim()) {
        formData.append('description', newDescription.trim())
      }
      formData.append('deadline', deadlineDate.toISOString())
      if (newFile) {
        formData.append('file', newFile)
      }


      await assignmentApi.create(classId, formData)

      setSuccessMsg('Assignment created successfully')
      setShowCreateModal(false)
      setNewTitle('')
      setNewDescription('')
      setNewDeadline('')
      setNewFile(null)

      setTimeout(() => setSuccessMsg(null), 3500)
      await fetchAssignments()
    } catch (err) {
      setError(err.message || 'Failed to create assignment')
    } finally {
      setIsCreating(false)
    }
  }

  // Teacher: Delete Assignment
  const handleDeleteAssignment = async (assignmentId, title) => {
    if (!window.confirm(`Delete assignment "${title}" and all its student submissions? This cannot be undone.`)) {
      return
    }

    setError(null)
    try {
      await assignmentApi.delete(classId, assignmentId)
      setAssignments(prev => prev.filter(a => a._id !== assignmentId))
      setSuccessMsg('Assignment deleted')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete assignment')
    }
  }

  // Teacher: Toggle & Load Submissions
  const toggleSubmissions = async (assignmentId) => {
    const current = submissionsState[assignmentId]
    if (current?.open) {
      setSubmissionsState(prev => ({
        ...prev,
        [assignmentId]: { ...current, open: false }
      }))
      return
    }

    loadSubmissions(assignmentId)
  }

  const loadSubmissions = async (assignmentId) => {
    setSubmissionsState(prev => ({
      ...prev,
      [assignmentId]: { ...(prev[assignmentId] || {}), open: true, loading: true }
    }))

    try {
      const data = await assignmentApi.getSubmissions(classId, assignmentId)
      setSubmissionsState(prev => ({
        ...prev,
        [assignmentId]: { open: true, loading: false, data }
      }))
    } catch (err) {
      setError(err.message || 'Failed to load submissions')
      setSubmissionsState(prev => ({
        ...prev,
        [assignmentId]: { open: false, loading: false, data: null }
      }))
    }
  }

  // Teacher: Bulk Download Submissions as ZIP
  const handleBulkDownload = async (assignmentId, title) => {
    setActionLoadingId(`bulk-${assignmentId}`)
    try {
      const safeTitle = title.replace(/\s+/g, '_')
      await assignmentApi.bulkDownload(classId, assignmentId, `Submissions_${safeTitle}.zip`)
    } catch (err) {
      setError(err.message || 'Bulk download failed')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Teacher: Download single student submission
  const handleDownloadStudentSubmission = async (assignmentId, studentId, filename) => {
    setActionLoadingId(`sub-${studentId}`)
    try {
      await assignmentApi.downloadSubmission(classId, assignmentId, studentId, filename)
    } catch (err) {
      setError(err.message || 'Download failed')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Student / Teacher: Download Assignment Brief / attached file
  const handleDownloadAssignmentBrief = async (assignmentId, filename) => {
    setActionLoadingId(`brief-${assignmentId}`)
    try {
      await assignmentApi.downloadAssignment(classId, assignmentId, filename)
    } catch (err) {
      setError(err.message || 'Download failed')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Student: Submit / Replace submission
  const handleStudentSubmit = async (assignmentId) => {
    const file = studentActionState[assignmentId]?.file
    if (!file) {
      setError('Please select a file to submit (max ~25MB)')
      return
    }

    setStudentActionState(prev => ({
      ...prev,
      [assignmentId]: { ...(prev[assignmentId] || {}), isSubmitting: true }
    }))
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      await assignmentApi.submit(classId, assignmentId, formData)

      setSuccessMsg('Assignment submitted successfully!')
      setStudentActionState(prev => ({
        ...prev,
        [assignmentId]: { file: null, isSubmitting: false, showReplace: false }
      }))

      setTimeout(() => setSuccessMsg(null), 3500)
      await fetchAssignments()
    } catch (err) {
      setError(err.message || 'Submission failed')
      setStudentActionState(prev => ({
        ...prev,
        [assignmentId]: { ...(prev[assignmentId] || {}), isSubmitting: false }
      }))
    }
  }

  return (
    <div>
      {/* Alert banners */}
      {!showCreateModal && error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 14,
          background: 'color-mix(in srgb, #ef4444 12%, var(--bg-card))',
          border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
          color: '#ef4444',
          marginBottom: 16,
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 14,
          background: 'color-mix(in srgb, #10b981 12%, var(--bg-card))',
          border: '1px solid color-mix(in srgb, #10b981 35%, transparent)',
          color: '#10b981',
          marginBottom: 16,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Teacher Action Bar */}
      {isTeacher && (
        <div style={{
          ...cardStyle(isMobile),
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Course Assignments ({assignments.length})
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Create assignments, enforce strict deadlines, track submissions, and bulk-download student work as ZIP.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={primaryButton(false, {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13.5,
              padding: '10px 18px'
            })}
          >
            <Plus size={16} /> Create Assignment
          </button>
        </div>
      )}

      {/* Assignments List */}
      {isLoading ? (
        <div style={{ ...cardStyle(isMobile), padding: 48, textAlign: 'center' }}>
          <div style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ ...cardStyle(isMobile), padding: 36 }}>
          <EmptyState
            icon={ClipboardList}
            title="No assignments posted yet"
            description={
              isTeacher
                ? "Create assignments with deadlines and attach reference worksheets or problem sets."
                : "Your teacher has not assigned any homework or projects yet."
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {assignments.map((assignment) => {
            const isPastDeadline = Boolean(assignment.isPastDeadline || (assignment.deadline && new Date() > new Date(assignment.deadline)))
            const deadlineDate = assignment.deadline ? new Date(assignment.deadline) : null
            const deadlineFormatted = deadlineDate
              ? deadlineDate.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })
              : '—'

            const mySub = assignment.mySubmission || null
            const hasSubmitted = Boolean(assignment.hasSubmitted || mySub)
            const subState = submissionsState[assignment._id] || {}
            const studentAction = studentActionState[assignment._id] || {}

            return (
              <div
                key={assignment._id}
                style={{
                  ...cardStyle(isMobile),
                  marginBottom: 0,
                  border: isPastDeadline
                    ? '1px solid var(--border-color)'
                    : '1px solid color-mix(in srgb, var(--accent) 30%, var(--border-color))'
                }}
              >
                {/* Top Row: Title, Deadline status pill, and actions */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isPastDeadline
                        ? 'color-mix(in srgb, var(--text-secondary) 12%, var(--bg-card))'
                        : 'color-mix(in srgb, var(--accent) 15%, var(--bg-card))',
                      color: isPastDeadline ? 'var(--text-secondary)' : 'var(--accent)',
                      flexShrink: 0
                    }}>
                      <ClipboardList size={20} />
                    </span>

                    <div>
                      <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 750, color: 'var(--text-primary)' }}>
                        {assignment.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12.5,
                          color: isPastDeadline ? '#ef4444' : 'var(--text-secondary)',
                          fontWeight: 600
                        }}>
                          <Clock size={13} />
                          Deadline: {deadlineFormatted}
                        </span>

                        {isPastDeadline ? (
                          <Pill tone="#ef4444">Deadline Passed</Pill>
                        ) : (
                          <Pill tone="#10b981">Active</Pill>
                        )}

                        {isTeacher && (
                          <Pill tone="var(--accent)">
                            {assignment.submittedCount || 0} / {totalActiveStudents} submitted
                          </Pill>
                        )}

                        {!isTeacher && (
                          hasSubmitted ? (
                            <Pill tone="#10b981" dot>Submitted</Pill>
                          ) : isPastDeadline ? (
                            <Pill tone="#ef4444">Missing</Pill>
                          ) : (
                            <Pill tone="#f59e0b">Pending Submission</Pill>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top Right Quick Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: isMobile ? 'flex-end' : 'center' }}>
                    {/* Attached file download if provided */}
                    {assignment.originalFileName && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAssignmentBrief(assignment._id, assignment.originalFileName)}
                        disabled={actionLoadingId === `brief-${assignment._id}`}
                        style={ghostButton({
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          padding: '7px 12px'
                        })}
                      >
                        <Download size={13} />
                        {actionLoadingId === `brief-${assignment._id}` ? 'Downloading...' : 'Assignment Brief'}
                      </button>
                    )}

                    {/* Teacher: Delete Button */}
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(assignment._id, assignment.title)}
                        title="Delete Assignment"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '7px 10px',
                          border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                          background: 'color-mix(in srgb, #ef4444 8%, transparent)',
                          color: '#ef4444',
                          borderRadius: 10,
                          cursor: 'pointer',
                          fontSize: 12.5
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {assignment.description && (
                  <p style={{
                    margin: '0 0 14px',
                    fontSize: 13.5,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {assignment.description}
                  </p>
                )}

                {/* ---------------- TEACHER VIEW: Submissions & Bulk Download ---------------- */}
                {isTeacher && (
                  <div style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10
                    }}>
                      <button
                        type="button"
                        onClick={() => toggleSubmissions(assignment._id)}
                        style={ghostButton({
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 650
                        })}
                      >
                        <Users size={14} />
                        {subState.open ? 'Hide Student Submissions' : `View Student Submissions (${assignment.submittedCount || 0}/${totalActiveStudents})`}
                        {subState.open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkDownload(assignment._id, assignment.title)}
                        disabled={actionLoadingId === `bulk-${assignment._id}` || (assignment.submittedCount || 0) === 0}
                        title={
                          (assignment.submittedCount || 0) === 0
                            ? 'No submissions to download'
                            : 'Download all submissions as ZIP'
                        }
                        style={primaryButton(
                          actionLoadingId === `bulk-${assignment._id}` || (assignment.submittedCount || 0) === 0,
                          {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12.5,
                            padding: '8px 14px'
                          }
                        )}
                      >
                        <Archive size={14} />
                        {actionLoadingId === `bulk-${assignment._id}` ? 'Archiving ZIP...' : 'Bulk Download (.zip)'}
                      </button>
                    </div>

                    {/* Submissions Table when toggled */}
                    {subState.open && (
                      <div style={{
                        marginTop: 14,
                        borderRadius: 14,
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        background: 'var(--input-bg)'
                      }}>
                        {subState.loading ? (
                          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                            Loading student submissions...
                          </div>
                        ) : !subState.data?.submissions?.length ? (
                          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                            No active students enrolled in this class.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: 'color-mix(in srgb, var(--text-secondary) 8%, var(--bg-card))', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase' }}>Student</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase' }}>Status</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase' }}>Submitted At</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase' }}>File Details</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subState.data.submissions.map((row) => {
                                  const stu = row.student || {}
                                  const sub = row.submission
                                  return (
                                    <tr key={stu._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                      {/* Student info */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
                                          {stu.name || 'Student'}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                          {stu.email}
                                        </div>
                                      </td>

                                      {/* Status */}
                                      <td style={{ padding: '10px 14px' }}>
                                        {row.hasSubmitted ? (
                                          <Pill tone="#10b981">Submitted</Pill>
                                        ) : (
                                          <Pill tone="var(--text-secondary)">Not Submitted</Pill>
                                        )}
                                      </td>

                                      {/* Submitted At */}
                                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                        {row.submittedAt
                                          ? new Date(row.submittedAt).toLocaleString(undefined, {
                                              month: 'short',
                                              day: 'numeric',
                                              hour: 'numeric',
                                              minute: '2-digit'
                                            })
                                          : '—'}
                                      </td>

                                      {/* File Details */}
                                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                                        {sub ? (
                                          <div>
                                            <span style={{ fontWeight: 600 }}>{sub.originalFileName}</span>
                                            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginLeft: 6 }}>
                                              ({formatBytes(sub.sizeBytes)})
                                            </span>
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                        )}
                                      </td>

                                      {/* Action Download */}
                                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                        {sub ? (
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadStudentSubmission(assignment._id, stu._id, sub.originalFileName)}
                                            disabled={actionLoadingId === `sub-${stu._id}`}
                                            style={ghostButton({
                                              padding: '5px 10px',
                                              fontSize: 12,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 4
                                            })}
                                          >
                                            <Download size={12} />
                                            {actionLoadingId === `sub-${stu._id}` ? 'Downloading...' : 'Download'}
                                          </button>
                                        ) : (
                                          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------- STUDENT VIEW: Submission Status & Upload ---------------- */}
                {!isTeacher && (
                  <div style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid var(--border-color)'
                  }}>
                    {hasSubmitted ? (
                      /* Student Already Submitted */
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: 'color-mix(in srgb, #10b981 8%, var(--bg-card))',
                        border: '1px solid color-mix(in srgb, #10b981 25%, transparent)',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: '#10b981' }}>
                            <CheckCircle2 size={20} />
                          </span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                              Your submission: {mySub?.originalFileName || 'Uploaded file'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                              Submitted on{' '}
                              {mySub?.submittedAt
                                ? new Date(mySub.submittedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })
                                : 'recently'}{' '}
                              · {formatBytes(mySub?.sizeBytes)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                          <button
                            type="button"
                            onClick={() => handleDownloadStudentSubmission(assignment._id, user?._id, mySub?.originalFileName || 'my-submission')}
                            disabled={actionLoadingId === `sub-${user?._id}`}
                            style={ghostButton({
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12.5,
                              padding: '7px 12px'
                            })}
                          >
                            <Download size={13} />
                            {actionLoadingId === `sub-${user?._id}` ? 'Downloading...' : 'Download My File'}
                          </button>

                          {/* Replace allowed only if before deadline */}
                          {!isPastDeadline ? (
                            <button
                              type="button"
                              onClick={() => {
                                setStudentActionState(prev => ({
                                  ...prev,
                                  [assignment._id]: {
                                    ...(prev[assignment._id] || {}),
                                    showReplace: !studentAction.showReplace
                                  }
                                }))
                              }}
                              style={primaryButton(false, {
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 12.5,
                                padding: '7px 14px'
                              })}
                            >
                              <RefreshCw size={13} />
                              {studentAction.showReplace ? 'Cancel' : 'Replace File'}
                            </button>
                          ) : (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 12,
                              color: 'var(--text-secondary)'
                            }}>
                              <Lock size={13} /> Submission locked
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Student Not Submitted Yet */
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: 14,
                        background: isPastDeadline
                          ? 'color-mix(in srgb, #ef4444 8%, var(--bg-card))'
                          : 'color-mix(in srgb, var(--accent) 7%, var(--bg-card))',
                        border: isPastDeadline
                          ? '1px solid color-mix(in srgb, #ef4444 25%, transparent)'
                          : '1px solid color-mix(in srgb, var(--accent) 25%, transparent)'
                      }}>
                        {isPastDeadline ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ef4444', fontSize: 13.5, fontWeight: 650 }}>
                            <XCircle size={18} />
                            <span>Deadline has passed. Submissions for this assignment are closed.</span>
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            justifyContent: 'space-between',
                            gap: 12
                          }}>
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Ready to submit your assignment?
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                Accepted types: PDF, DOC, DOCX, PPT, PPTX, Images (Max 25MB)
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
                              <input
                                type="file"
                                id={`file-input-${assignment._id}`}
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null
                                  setStudentActionState(prev => ({
                                    ...prev,
                                    [assignment._id]: { ...(prev[assignment._id] || {}), file }
                                  }))
                                }}
                                style={{ display: 'none' }}
                              />

                              <label
                                htmlFor={`file-input-${assignment._id}`}
                                style={ghostButton({
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12.5,
                                  padding: '7px 12px',
                                  cursor: 'pointer'
                                })}
                              >
                                <Paperclip size={13} />
                                {studentAction.file ? studentAction.file.name : 'Choose File'}
                              </label>

                              <button
                                type="button"
                                disabled={!studentAction.file || studentAction.isSubmitting}
                                onClick={() => handleStudentSubmit(assignment._id)}
                                style={primaryButton(!studentAction.file || studentAction.isSubmitting, {
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 12.5,
                                  padding: '7px 16px'
                                })}
                              >
                                <Upload size={13} />
                                {studentAction.isSubmitting ? 'Submitting...' : 'Submit'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Replace Form if student requested replacement before deadline */}
                    {!isPastDeadline && studentAction.showReplace && (
                      <div style={{
                        marginTop: 10,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'var(--input-bg)',
                        border: '1px dashed var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null
                              setStudentActionState(prev => ({
                                ...prev,
                                [assignment._id]: { ...(prev[assignment._id] || {}), file }
                              }))
                            }}
                            style={{ fontSize: 12.5, color: 'var(--text-primary)' }}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!studentAction.file || studentAction.isSubmitting}
                          onClick={() => handleStudentSubmit(assignment._id)}
                          style={primaryButton(!studentAction.file || studentAction.isSubmitting, {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            padding: '6px 14px'
                          })}
                        >
                          {studentAction.isSubmitting ? 'Overwriting...' : 'Upload Replacement'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ---------------- TEACHER CREATE ASSIGNMENT MODAL ---------------- */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 24,
            padding: 28,
            width: '100%',
            maxWidth: 540,
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                  color: 'var(--accent)'
                }}>
                  <ClipboardList size={20} />
                </span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: 'var(--text-primary)' }}>
                  Create New Assignment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'color-mix(in srgb, #ef4444 12%, var(--bg-card))',
                  border: '1px solid color-mix(in srgb, #ef4444 35%, transparent)',
                  color: '#ef4444',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Assignment Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Assignment 1: Distributed Snapshot Algorithm"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={inputStyle()}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Instructions / Description <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide problem prompts, submission guidelines, or rubrics..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ ...inputStyle(), resize: 'vertical' }}
                />
              </div>

              {/* Strict Deadline */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Submission Deadline <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                    (Strict deadline enforced)
                  </span>
                </label>
                <input
                  type="datetime-local"
                  required
                  min={getMinDeadlineLocal()}
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  style={inputStyle()}
                />

              </div>

              {/* Optional brief attachment file */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Attachment / Worksheet <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>(optional, max 25MB)</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 12,
                    background: 'var(--input-bg)',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                />
                {newFile && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 12.5,
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <FileCheck size={14} />
                    <span>Attached: {newFile.name} ({formatBytes(newFile.size)})</span>
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={ghostButton({ padding: '10px 18px', fontSize: 13.5 })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  style={primaryButton(isCreating, {
                    padding: '10px 22px',
                    fontSize: 13.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  })}
                >
                  {isCreating ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
