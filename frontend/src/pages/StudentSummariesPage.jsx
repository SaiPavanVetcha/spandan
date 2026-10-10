import React, { useState, useEffect } from 'react'
import { summaryApi } from '../lib/api.js'
import useAuthStore from '../stores/authStore'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import ProfileDropdown from '../components/ProfileDropdown'
import useIsMobile from '../hooks/useIsMobile'

export default function StudentSummariesPage() {
  const { user } = useAuthStore()
  const isMobile = useIsMobile()
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSummary, setExpandedSummary] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    fetchSummaries()
  }, [])

  const fetchSummaries = async () => {
    try {
      const res = await summaryApi.listPublished()
      setSummaries(res)
    } catch (err) {
      console.error('Failed to fetch published summaries:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExpand = async (id) => {
    if (expandedSummary?._id === id) {
      setExpandedSummary(null)
      return
    }

    setLoadingId(id)
    try {
      const detail = await summaryApi.get(id)
      setExpandedSummary(detail)
    } catch (err) {
      console.error('Failed to fetch summary details:', err)
      alert(err.message || 'Failed to fetch details')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar user={user} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', marginLeft: 'var(--sidebar-width, 240px)', transition: 'margin-left 0.2s ease', boxSizing: 'border-box' }}>
        <header style={{ background: 'var(--header-bg)', color: 'white', padding: isMobile ? '20px 16px' : '24px 32px', paddingLeft: isMobile ? '64px' : '32px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Lecture Summaries
              </h1>
              <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: '14px' }}>
                Review AI-generated summaries and transcripts from your classes
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <ThemeToggle />
              <ProfileDropdown />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: isMobile ? '16px' : '32px', boxSizing: 'border-box', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
          
          <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Published Summaries</h2>
          
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
          ) : summaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
              No summaries have been published yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {summaries.map(summary => {
                const isExpanded = expandedSummary?._id === summary._id
                const isLoadingDetail = loadingId === summary._id
                return (
                  <div key={summary._id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                    <div onClick={() => handleExpand(summary._id)} style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{summary.title}</h3>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span>Teacher: <strong>{summary.teacherId?.name || 'Unknown'}</strong></span>
                          <span>•</span>
                          <span>{new Date(summary.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {isLoadingDetail ? '...' : isExpanded ? '▲' : '▼'}
                      </div>
                    </div>

                    {isExpanded && expandedSummary && (
                      <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                        <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: 'var(--text-primary)' }}>Overview</h4>
                        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{expandedSummary.overview}</p>
                        
                        <h4 style={{ margin: '0 0 10px', fontSize: '15px', color: 'var(--text-primary)' }}>Key Takeaways</h4>
                        <ul style={{ margin: '0 0 24px', paddingLeft: '20px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {expandedSummary.keyTakeaways?.map((point, idx) => (
                            <li key={idx} style={{ marginBottom: '8px' }}>{point}</li>
                          ))}
                        </ul>

                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>View Full Transcript</summary>
                          <div style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', lineHeight: 1.6 }}>
                            {expandedSummary.cleanedText || 'No transcript available.'}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
