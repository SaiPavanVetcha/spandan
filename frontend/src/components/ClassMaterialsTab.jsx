import React, { useState, useEffect } from 'react'
import { materialApi } from '../lib/api'
import useSocketStore from '../stores/socketStore'
import {
  primaryButton,
  ghostButton,
  inputStyle,
  Pill,
  EmptyState
} from './AppUI'
import { cardStyle, SectionHeader } from './InsightUI'
import {
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Plus,
  Filter,
  X,
  FileCheck,
  Calendar,
  Layers,
  Paperclip,
  CheckCircle2
} from 'lucide-react'

// Helper to format file size cleanly (B, KB, MB)
export const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

// Return appropriate badge / tone based on file extension
export const getFilePillTone = (fileName) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return { tone: '#ef4444', label: 'PDF' }
    case 'doc':
    case 'docx':
      return { tone: '#3b82f6', label: 'DOC' }
    case 'ppt':
    case 'pptx':
      return { tone: '#f97316', label: 'PPT' }
    case 'png':
    case 'jpg':
    case 'jpeg':
      return { tone: '#8b5cf6', label: 'IMG' }
    default:
      return { tone: 'var(--text-secondary)', label: ext?.toUpperCase() || 'FILE' }
  }
}

export default function ClassMaterialsTab({
  classId,
  isTeacher,
  sessions = [],
  isMobile
}) {
  const { socket } = useSocketStore()

  const [materials, setMaterials] = useState([])
  const [selectedSessionFilter, setSelectedSessionFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Upload modal state (Teacher only)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadSessionId, setUploadSessionId] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Deleting state
  const [deletingId, setDeletingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const fetchMaterials = async (sessionIdFilter = selectedSessionFilter) => {
    try {
      setIsLoading(true)
      const filterParam = sessionIdFilter === 'all' ? null : sessionIdFilter
      const res = await materialApi.getAll(classId, filterParam)
      setMaterials(res.materials || [])
      setError(null)
    } catch (err) {
      console.error('Failed to load materials:', err)
      setError(err.message || 'Failed to load materials')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (classId) {
      fetchMaterials(selectedSessionFilter)
    }
  }, [classId, selectedSessionFilter])

  // Socket updates for real-time synchronization
  useEffect(() => {
    if (!socket || !classId) return

    const handleCreated = (data) => {
      if (String(data.classId) === String(classId)) {
        fetchMaterials(selectedSessionFilter)
      }
    }

    const handleDeleted = (data) => {
      if (String(data.classId) === String(classId)) {
        setMaterials(prev => prev.filter(m => m._id !== data.materialId))
      }
    }

    socket.on('class:material-created', handleCreated)
    socket.on('class:material-deleted', handleDeleted)

    return () => {
      socket.off('class:material-created', handleCreated)
      socket.off('class:material-deleted', handleDeleted)
    }
  }, [socket, classId, selectedSessionFilter])

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    if (!uploadTitle.trim()) {
      setError('Topic / Title is required')
      return
    }
    if (!selectedFile) {
      setError('Please select a file to upload (max ~25MB)')
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('title', uploadTitle.trim())
      if (uploadDescription.trim()) {
        formData.append('description', uploadDescription.trim())
      }
      if (uploadSessionId && uploadSessionId !== 'general') {
        formData.append('sessionId', uploadSessionId)
      }
      formData.append('file', selectedFile)

      await materialApi.upload(classId, formData)

      setSuccessMsg('Material uploaded successfully')
      setShowUploadModal(false)
      setUploadTitle('')
      setUploadDescription('')
      setUploadSessionId('')
      setSelectedFile(null)

      setTimeout(() => setSuccessMsg(null), 3500)
      await fetchMaterials(selectedSessionFilter)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (materialId, materialTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${materialTitle}"? This cannot be undone.`)) {
      return
    }

    setDeletingId(materialId)
    setError(null)
    try {
      await materialApi.delete(classId, materialId)
      setMaterials(prev => prev.filter(m => m._id !== materialId))
      setSuccessMsg('Material deleted')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message || 'Failed to delete material')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = async (material) => {
    setDownloadingId(material._id)
    try {
      await materialApi.download(classId, material._id, material.originalFileName)
    } catch (err) {
      setError(err.message || 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      {/* Alert banner for error / success */}
      {error && (
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

      {/* Header with Session Filter + Upload Material Button */}
      <div style={{
        ...cardStyle(isMobile),
        marginBottom: 20,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 14
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <Filter size={15} />
            <span style={{ fontWeight: 600 }}>Filter:</span>
          </div>

          <select
            value={selectedSessionFilter}
            onChange={(e) => setSelectedSessionFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            <option value="all">All Course Materials ({materials.length})</option>
            <option value="general">General Class Materials</option>
            {sessions.map((s) => (
              <option key={s._id || s.roomId} value={s._id || s.roomId}>
                Session: {s.name || s.roomName}
              </option>
            ))}
          </select>
        </div>

        {isTeacher && (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            style={primaryButton(false, {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 13.5,
              padding: '10px 18px'
            })}
          >
            <Plus size={16} /> Upload Material
          </button>
        )}
      </div>

      {/* Materials List */}
      <div style={{ ...cardStyle(isMobile), padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{
              width: 36,
              height: 36,
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>Loading materials...</p>
          </div>
        ) : materials.length === 0 ? (
          <div style={{ padding: 36 }}>
            <EmptyState
              icon={FileText}
              title="No materials uploaded yet"
              description={
                isTeacher
                  ? "Share lecture slides, reference documents, readings, and notes with your students."
                  : "Your instructor hasn't uploaded any materials yet. Check back soon."
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--text-secondary) 5%, var(--bg-card))', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topic / Document</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Link</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uploaded Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>File Size</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((mat) => {
                  const pillInfo = getFilePillTone(mat.originalFileName)
                  return (
                    <tr
                      key={mat._id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Topic & Title */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <span style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `color-mix(in srgb, ${pillInfo.tone} 15%, var(--bg-card))`,
                            color: pillInfo.tone,
                            flexShrink: 0
                          }}>
                            <FileText size={18} />
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                                {mat.title}
                              </span>
                              <Pill tone={pillInfo.tone}>{pillInfo.label}</Pill>
                            </div>
                            {mat.description && (
                              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                                {mat.description}
                              </p>
                            )}
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                              {mat.originalFileName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Session */}
                      <td style={{ padding: '14px 18px' }}>
                        {mat.sessionId ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={13} color="var(--accent)" />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                              {mat.sessionId.name}
                            </span>
                          </div>
                        ) : (
                          <Pill tone="var(--text-secondary)">General</Pill>
                        )}
                      </td>

                      {/* Upload Date */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={13} />
                          <span>
                            {mat.uploadedAt
                              ? new Date(mat.uploadedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : '—'}
                          </span>
                        </div>
                      </td>

                      {/* File Size */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatBytes(mat.sizeBytes)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleDownload(mat)}
                            disabled={downloadingId === mat._id}
                            title="Download Material"
                            style={ghostButton({
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              fontSize: 12.5
                            })}
                          >
                            <Download size={13} />
                            {downloadingId === mat._id ? 'Downloading...' : 'Download'}
                          </button>

                          {isTeacher && (
                            <button
                              type="button"
                              onClick={() => handleDelete(mat._id, mat.title)}
                              disabled={deletingId === mat._id}
                              title="Delete Material"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px 10px',
                                border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                                background: 'color-mix(in srgb, #ef4444 8%, transparent)',
                                color: '#ef4444',
                                borderRadius: 10,
                                cursor: deletingId === mat._id ? 'not-allowed' : 'pointer',
                                fontSize: 12.5,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Material Modal (Teacher only) */}
      {showUploadModal && (
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
            maxWidth: 520,
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
                  <UploadCloud size={20} />
                </span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: 'var(--text-primary)' }}>
                  Upload Course Material
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Topic / Title */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Topic / Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Week 3: Raft Consensus Paper & Slides"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={inputStyle()}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Description <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief notes or reading instructions for students..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  style={{ ...inputStyle(), resize: 'vertical' }}
                />
              </div>

              {/* Session association */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Link to Session <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <select
                  value={uploadSessionId}
                  onChange={(e) => setUploadSessionId(e.target.value)}
                  style={inputStyle({ cursor: 'pointer' })}
                >
                  <option value="general">General Class Material (Not tied to a session)</option>
                  {sessions.map((sess) => (
                    <option key={sess._id || sess.roomId} value={sess._id || sess.roomId}>
                      Session: {sess.name || sess.roomName}
                    </option>
                  ))}
                </select>
              </div>

              {/* File picker */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 6 }}>
                  File <span style={{ color: '#ef4444' }}>*</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                    (PDF, DOC, DOCX, PPT, PPTX, PNG, JPG; max 25MB)
                  </span>
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
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
                {selectedFile && (
                  <div style={{
                    marginTop: 8,
                    fontSize: 12.5,
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <FileCheck size={14} />
                    <span>Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})</span>
                  </div>
                )}
              </div>

              {/* Modal footer buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={ghostButton({ padding: '10px 18px', fontSize: 13.5 })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  style={primaryButton(isUploading, {
                    padding: '10px 22px',
                    fontSize: 13.5,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  })}
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
