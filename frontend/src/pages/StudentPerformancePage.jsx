import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import Sidebar from '../components/Sidebar'
import ThemeToggle from '../components/ThemeToggle'
import ProfileDropdown from '../components/ProfileDropdown'
import useIsMobile from '../hooks/useIsMobile'
import { API_URL } from '../config.js'

const formatDate = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

const formatRank = (rank) => rank == null ? '—' : `#${rank}`

function getSessionLabel(point, index, maxLength = 10) {
  const name = String(point?.name || `Session ${index + 1}`)
  return name.length > maxLength ? `${name.slice(0, maxLength - 1)}…` : name
}


function TrendLine({ points, unit = '%', yLabel = 'Score (%)' }) {
  const cleanPoints = (points || []).filter(point => Number.isFinite(Number(point.value)))
  if (!cleanPoints.length) {
    return <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Complete a session to start your journey.</div>
  }

  // The score journey stays a line chart; all completed session names and axis labels are drawn inside the chart.
  const width = Math.max(600, cleanPoints.length * 40 + 80)
  const height = 300
  const left = 66
  const right = 18
  const top = 20
  const bottom = 68
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const xAt = index => left + (index / Math.max(cleanPoints.length - 1, 1)) * plotWidth
  const yAt = value => top + (100 - Math.max(0, Math.min(100, Number(value) || 0))) / 100 * plotHeight
  const path = cleanPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(1)} ${yAt(point.value).toFixed(1)}`).join(' ')
  const area = `${path} L ${xAt(cleanPoints.length - 1).toFixed(1)} ${top + plotHeight} L ${xAt(0).toFixed(1)} ${top + plotHeight} Z`

  return (
    <div style={{ minWidth: 0, overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} by session`} style={{ width: '100%', minWidth: width, height, display: 'block' }}>
        {[0, 20, 40, 60, 80, 100].map(tick => {
          const y = yAt(tick)
          return <g key={tick}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--border-color)" strokeDasharray="4 5" />
            <text x={left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">{tick}</text>
          </g>
        })}
        <path d={area} fill="#3b82f6" opacity="0.12" />
        <path className="trend-line" pathLength="1" d={path} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {cleanPoints.map((point, index) => (
          <g key={`${point.roomId || point.date || point.name}-${index}`}>
            <circle className="trend-point" cx={xAt(index)} cy={yAt(point.value)} r="5" fill="var(--bg-card)" stroke="#2563eb" strokeWidth="3">
              <title>{`${point.name || `Session ${index + 1}`}: ${point.value}${unit}`}</title>
            </circle>
            <text x={xAt(index)} y={top + plotHeight + 22} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{getSessionLabel(point, index, 10)}</text>
          </g>
        ))}
        <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="var(--border-color)" />
        <line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} stroke="var(--border-color)" />
        <text x="18" y={top + plotHeight / 2} transform={`rotate(-90 18 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">{yLabel}</text>
        <text x={left + plotWidth / 2} y={height - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Session name</text>
      </svg>
    </div>
  )
}

function AccuracyBarChart({ points }) {
  const cleanPoints = (points || []).filter(point => Number.isFinite(Number(point.value)))
  if (!cleanPoints.length) {
    return <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Accuracy data will appear after a completed session.</div>
  }
  const width = Math.max(720, cleanPoints.length * 68 + 100)
  const height = 320
  const left = 64
  const right = 22
  const top = 22
  const bottom = 72
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const average = cleanPoints.reduce((sum, point) => sum + Number(point.value), 0) / cleanPoints.length
  const xAt = index => left + ((index + 0.5) / cleanPoints.length) * plotWidth
  const yAt = value => top + (100 - Math.max(0, Math.min(100, Number(value) || 0))) / 100 * plotHeight
  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Accuracy percentage by session, shown as bars with an average accuracy line" style={{ width: '100%', minWidth: width, height, display: 'block' }}>
        {[0, 20, 40, 60, 80, 100].map(tick => {
          const y = yAt(tick)
          return <g key={tick}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--border-color)" strokeDasharray="4 5" />
            <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">{tick}</text>
          </g>
        })}
        {cleanPoints.map((point, index) => {
          const value = Math.max(0, Math.min(100, Number(point.value) || 0))
          const barWidth = Math.min(42, (plotWidth / cleanPoints.length) * 0.58)
          const y = yAt(value)
          return <g key={`${point.roomId || point.date || point.name}-${index}`}>
            <rect x={xAt(index) - barWidth / 2} y={y} width={barWidth} height={top + plotHeight - y} rx="5" fill="#8b5cf6" opacity="0.88">
              <title>{`${point.name || `Session ${index + 1}`}: ${value}% accuracy`}</title>
            </rect>
            <text x={xAt(index)} y={top + plotHeight + 22} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{getSessionLabel(point, index, 9)}</text>
          </g>
        })}
        <line x1={left} y1={yAt(average)} x2={width - right} y2={yAt(average)} stroke="#6d28d9" strokeWidth="2.5" strokeDasharray="7 5" />
        <text x={width - right - 3} y={Math.max(14, yAt(average) - 9)} textAnchor="end" fontSize="12" fontWeight="800" fill="#6d28d9">Average {Math.round(average)}%</text>
        <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="var(--border-color)" />
        <line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} stroke="var(--border-color)" />
        <text x="17" y={top + plotHeight / 2} transform={`rotate(-90 17 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Accuracy (%)</text>
        <text x={left + plotWidth / 2} y={height - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Session name</text>
      </svg>
    </div>
  )
}

function RankJourneyChart({ points }) {
  const cleanPoints = (points || []).filter(point => Number.isFinite(Number(point.value)) && Number(point.value) > 0)
  if (!cleanPoints.length) {
    return <div style={{ minHeight: 280, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Rank data will appear when session rankings are available.</div>
  }
  const width = Math.max(720, cleanPoints.length * 68 + 100)
  const height = 320
  const left = 64
  const right = 22
  const top = 22
  const bottom = 72
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const highestRank = Math.max(1, ...cleanPoints.map(point => Number(point.value)))
  const axisMax = Math.max(5, Math.ceil(highestRank / 5) * 5)
  const yAt = value => top + ((Math.max(1, Math.min(axisMax, Number(value) || 1)) - 1) / Math.max(axisMax - 1, 1)) * plotHeight
  const xAt = index => left + ((index + 0.5) / cleanPoints.length) * plotWidth
  const tickValues = Array.from({ length: 6 }, (_, index) => Math.round(1 + ((axisMax - 1) / 5) * index))
  let stepPath = ''
  cleanPoints.forEach((point, index) => {
    const x = xAt(index)
    const y = yAt(point.value)
    if (index === 0) stepPath = `M ${x} ${y}`
    else stepPath += ` H ${x} V ${y}`
  })
  const areaPath = `${stepPath} L ${xAt(cleanPoints.length - 1)} ${top + plotHeight} L ${xAt(0)} ${top + plotHeight} Z`
  return (
    <div style={{ overflowX: 'auto', minWidth: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rank by session. A lower rank number means a better position." style={{ width: '100%', minWidth: width, height, display: 'block' }}>
        {tickValues.map((tick, index) => {
          const y = yAt(tick)
          return <g key={`${tick}-${index}`}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--border-color)" strokeDasharray="4 5" />
            <text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="var(--text-secondary)">{tick}</text>
          </g>
        })}
        <path d={areaPath} fill="#f97316" opacity="0.10" />
        <path d={stepPath} fill="none" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 4" />
        {cleanPoints.map((point, index) => (
          <g key={`${point.roomId || point.date || point.name}-${index}`}>
            <circle cx={xAt(index)} cy={yAt(point.value)} r="5.5" fill="#f97316" stroke="var(--bg-card)" strokeWidth="2.5">
              <title>{`${point.name || `Session ${index + 1}`}: rank ${point.value} (lower is better)`}</title>
            </circle>
            <text x={xAt(index)} y={top + plotHeight + 22} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{getSessionLabel(point, index, 9)}</text>
          </g>
        ))}
        <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="var(--border-color)" />
        <line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} stroke="var(--border-color)" />
        <text x="17" y={top + plotHeight / 2} transform={`rotate(-90 17 ${top + plotHeight / 2})`} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Rank (lower is better)</text>
        <text x={left + plotWidth / 2} y={height - 9} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-secondary)">Session name</text>
      </svg>
    </div>
  )
}

function getAttendanceActivity(history) {
  const sessionsByDay = new Map()
  for (const session of (history || []).filter(item => item.attended && item.date)) {
    const date = new Date(session.date)
    if (Number.isNaN(date.getTime())) continue
    date.setHours(0, 0, 0, 0)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    sessionsByDay.set(key, (sessionsByDay.get(key) || 0) + 1)
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = []
  for (let offset = 27; offset >= 0; offset--) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const count = sessionsByDay.get(key) || 0
    days.push({ date, count, key, level: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3 })
  }
  let longestStreak = 0
  let streak = 0
  for (const day of days) {
    streak = day.count ? streak + 1 : 0
    longestStreak = Math.max(longestStreak, streak)
  }
  let currentStreak = 0
  let index = days.length - 1
  // Keep a streak alive through today if the last attendance was yesterday.
  if (index >= 0 && days[index].count === 0) index -= 1
  while (index >= 0 && days[index].count > 0) {
    currentStreak += 1
    index -= 1
  }
  const activeDays = days.filter(day => day.count > 0).length
  return { days, currentStreak, longestStreak, activeDays }
}

function AttendanceStreak({ history, isMobile }) {
  const activity = getAttendanceActivity(history)
  const cellColors = ['var(--bg-secondary, #eef2f7)', '#d9f99d', '#86efac', '#16a34a']
  return (
    <section className="chart-card attendance-streak" style={{ padding: isMobile ? 16 : 22, marginBottom: 18, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22 }} aria-label="Session attendance streak">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 180 }}>
          <div style={{ width: 54, height: 54, display: 'grid', placeItems: 'center', borderRadius: 17, background: 'linear-gradient(135deg, rgba(249,115,22,.16), rgba(234,88,12,.06))', fontSize: 30 }} aria-hidden="true">🔥</div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 800 }}>Session Streak</div>
            <div style={{ color: '#ea580c', fontSize: 25, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-0.03em' }}>{activity.currentStreak} {activity.currentStreak === 1 ? 'day' : 'days'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>{activity.currentStreak ? 'Great consistency—keep your streak going!' : 'Attend sessions regularly to start building your streak.'}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Your activity over the last 28 days</div>
          <div className="streak-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(28, minmax(5px, 1fr))', gap: 4, alignItems: 'center' }}>
            {activity.days.map(day => (
              <span key={day.key} title={`${formatDate(day.date)}: ${day.count} attended ${day.count === 1 ? 'session' : 'sessions'}`} aria-label={`${formatDate(day.date)}: ${day.count} sessions`} style={{ display: 'block', aspectRatio: '1', minWidth: 5, borderRadius: 3, background: cellColors[day.level], outline: day.count ? '1px solid rgba(22,163,74,.12)' : '1px solid var(--border-color)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-secondary)', fontSize: 10, marginTop: 6 }}><span>28 days ago</span><span>Today</span></div>
        </div>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center', paddingLeft: isMobile ? 0 : 18, borderLeft: isMobile ? 'none' : '1px solid var(--border-color)' }}>
          <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Longest in 28 days</div><strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 21, marginTop: 4 }}>{activity.longestStreak} days</strong></div>
          <div><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Active days</div><strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 21, marginTop: 4 }}>{activity.activeDays}/28</strong></div>
        </div>
      </div>
    </section>
  )
}

function PerformanceMetric({ label, value, caption, icon }) {
  return (
    <div className="performance-metric" style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '18px',
      padding: '20px',
      boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
      minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span className="metric-icon" style={{ fontSize: 19 }}>{icon}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>{caption}</div>
    </div>
  )
}

function NextAccuracyMilestone({ history, isMobile }) {
  const attended = (history || []).filter(session => session?.attended)
  const previousSessions = attended.slice(-6, -3)
  const recentSessions = attended.slice(-3)

  const calculateAccuracy = (sessions) => {
    const attempted = sessions.reduce((total, session) => total + (Number(session.attemptedQuestions) || 0), 0)
    const correct = sessions.reduce((total, session) => total + (Number(session.correctAnswers) || 0), 0)
    return attempted > 0 ? Math.round((correct / attempted) * 100) : null
  }

  const baselineAccuracy = calculateAccuracy(previousSessions)
  const recentAccuracy = calculateAccuracy(recentSessions)

  if (recentAccuracy == null) {
    return (
      <section className="chart-card" style={{ padding: isMobile ? 16 : 22, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22, boxShadow: 'var(--shadow-md)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} aria-label="Next accuracy milestone">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span aria-hidden="true" style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(22,163,74,.10)', fontSize: 22 }}>🎯</span>
          <div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Next Accuracy Milestone</h2><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>A goal based on your real session results</p></div>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>Your accuracy goal will appear after you answer questions in a completed live session.</p>
      </section>
    )
  }

  const hasComparison = baselineAccuracy != null
  const targetBase = hasComparison ? baselineAccuracy : recentAccuracy
  const targetAccuracy = Math.min(100, targetBase + 5)
  const goalRange = targetAccuracy - targetBase
  const progress = hasComparison
    ? (goalRange <= 0
        ? (recentAccuracy >= targetAccuracy ? 100 : 0)
        : Math.max(0, Math.min(100, Math.round(((recentAccuracy - targetBase) / goalRange) * 100))))
    : null
  const goalReached = hasComparison && recentAccuracy >= targetAccuracy
  const difference = recentAccuracy - (baselineAccuracy ?? recentAccuracy)

  return (
    <section className="chart-card" style={{ padding: isMobile ? 16 : 22, background: 'linear-gradient(145deg, rgba(22,163,74,.07), var(--bg-card) 66%)', border: '1px solid var(--border-color)', borderRadius: 22, boxShadow: 'var(--shadow-md)', minWidth: 0, display: 'flex', flexDirection: 'column' }} aria-label="Next accuracy milestone">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span aria-hidden="true" style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(22,163,74,.12)', fontSize: 22 }}>🎯</span>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Next Accuracy Milestone</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>A personal target calculated from session data</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Next target</div>
          <div style={{ color: '#15803d', fontSize: 38, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em' }}>{targetAccuracy}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 4 }}>Recent accuracy</div>
          <div style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 850 }}>{recentAccuracy}%</div>
        </div>
      </div>

      {hasComparison ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Progress toward target</span>
            <strong style={{ color: goalReached ? '#15803d' : 'var(--text-primary)', fontSize: 12 }}>{goalReached ? 'Goal reached 🎉' : `${progress}%`}</strong>
          </div>
          <div role="progressbar" aria-label="Progress toward next accuracy milestone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-secondary, #e5e7eb)' }}>
            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: goalReached ? '#16a34a' : 'linear-gradient(90deg, #22c55e, #0d9488)', transition: 'width .3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, color: 'var(--text-secondary)', fontSize: 11 }}>
            <span>Baseline: {baselineAccuracy}%</span>
            <span>Target: {targetAccuracy}%</span>
          </div>
          <div style={{ marginTop: 14, borderRadius: 12, padding: 11, background: 'rgba(22,163,74,.08)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>
            {goalReached
              ? `You have reached the target based on the previous ${previousSessions.length} attended ${previousSessions.length === 1 ? 'session' : 'sessions'}. Keep up the consistency in your next live sessions.`
              : difference > 0
                ? `Your latest ${recentSessions.length} attended sessions are ${difference} percentage point${difference === 1 ? '' : 's'} above the previous baseline. Keep checking each option carefully to reach the target.`
                : `Aim to improve by up to 5 percentage points from the previous-session baseline. Read each question and its options carefully before submitting.`}
          </div>
        </>
      ) : (
        <>
          <div style={{ height: 10, borderRadius: 999, background: 'var(--bg-secondary, #e5e7eb)', overflow: 'hidden' }}>
            <div style={{ width: '0%', height: '100%', borderRadius: 999, background: '#16a34a' }} />
          </div>
          <div style={{ marginTop: 12, borderRadius: 12, padding: 11, background: 'rgba(22,163,74,.08)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>
            Your starting accuracy is based on your latest {recentSessions.length} attended {recentSessions.length === 1 ? 'session' : 'sessions'}. The target is set 5 percentage points higher (up to 100%). Complete more sessions to compare against a previous baseline and calculate meaningful progress.
          </div>
        </>
      )}
    </section>
  )
}

function EmptyState({ onJoin }) {
  return (
    <div className="journey-empty" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22,
      padding: 36, textAlign: 'center', boxShadow: 'var(--shadow-md)'
    }}>
      <div className="empty-icon" style={{ fontSize: 46, marginBottom: 12 }}>📈</div>
      <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 22 }}>Your performance journey starts here</h2>
      <p style={{ margin: '10px auto 20px', maxWidth: 520, color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>
        Finish a Spandan live session and this page will automatically build your long-term performance history.
      </p>
      <button className="empty-join-btn" onClick={onJoin} style={{
        border: 'none', borderRadius: 12, padding: '11px 18px', background: 'var(--accent-gradient)', color: '#fff',
        fontWeight: 700, cursor: 'pointer', fontSize: 14
      }}>Join a Session</button>
    </div>
  )
}

function buildAnsweringInsights(summary, sessions, questionTypes) {
  const strengths = []
  const improvements = []
  const keyInsights = []
  const validTypes = questionTypes
    .filter(item => Number(item.attempted) >= 5 && Number.isFinite(Number(item.accuracy)))
    .map(item => ({ ...item, attempted: Number(item.attempted), accuracy: Number(item.accuracy) }))
  const overallAccuracy = Number(summary?.overallAccuracy) || 0
  const totalQuestions = Number(summary?.totalQuestions) || 0
  const missedQuestions = Number(summary?.missedQuestions) || 0
  const attemptedQuestions = Number(summary?.attemptedQuestions) || 0
  const missedRate = totalQuestions > 0 ? missedQuestions / totalQuestions * 100 : 0

  // Prefer a well-supported question type that performs above the student's overall accuracy.
  const strongestType = [...validTypes].sort((a, b) => b.accuracy - a.accuracy || b.attempted - a.attempted)[0]
  if (strongestType && (strongestType.accuracy >= 70 || strongestType.accuracy >= overallAccuracy + 5)) {
    strengths.push({
      title: 'Strong question type',
      text: `You are doing well with ${strongestType.label} questions. In upcoming live sessions, keep reading each question carefully and use the approach that is working for you.`
    })
  }

  // Use overall accuracy as a second evidence-based strength when type-level data isn't decisive.
  if (overallAccuracy >= 70 && attemptedQuestions >= 5 && strengths.length < 2) {
    strengths.push({
      title: 'Good overall accuracy',
      text: `Your overall answers are going well. Keep reading the full question and checking your choice before submitting in upcoming live sessions.`
    })
  }
  if (missedRate < 5 && totalQuestions >= 10 && strengths.length < 2) {
    strengths.push({
      title: 'Consistent participation',
      text: `You have been attempting almost all available questions. Keep participating throughout each live session and submit before the poll closes.`
    })
  }

  const weakestType = [...validTypes].sort((a, b) => a.accuracy - b.accuracy || b.attempted - a.attempted)[0]
  if (weakestType && (weakestType.accuracy < 65 || weakestType.accuracy <= overallAccuracy - 10)) {
    improvements.push({
      title: 'Question type to practise',
      text: `Your ${weakestType.label} answers need more attention. In your next live session, read every option carefully and check all correct choices before submitting.`
    })
  }
  if (totalQuestions > 0 && missedRate >= 10) {
    improvements.push({
      title: 'Unanswered questions',
      text: `Some questions were left unanswered. Keep an eye on the poll timer and submit an answer before each live question closes.`
    })
  }
  if (!improvements.length && attemptedQuestions >= 5 && overallAccuracy < 60) {
    improvements.push({
      title: 'Overall accuracy to improve',
      text: `In your next live session, slow down enough to understand each question and check the available choices before submitting.`
    })
  }

  // Avoid duplicating the latest-session change as both a Strength and a Key Insight.
  if (sessions.length >= 4) {
    const windowSize = Math.min(3, Math.floor(sessions.length / 2))
    const previousWindow = sessions.slice(-2 * windowSize, -windowSize)
    const recentWindow = sessions.slice(-windowSize)
    const weightedAccuracy = items => {
      const attempted = items.reduce((sum, item) => sum + (Number(item.attemptedQuestions) || 0), 0)
      const correct = items.reduce((sum, item) => sum + (Number(item.correctAnswers) || 0), 0)
      return attempted > 0 ? Math.round(correct / attempted * 100) : null
    }
    const before = weightedAccuracy(previousWindow)
    const now = weightedAccuracy(recentWindow)
    if (before != null && now != null) {
      const change = now - before
      keyInsights.push({
        title: change >= 5 ? 'Long-term progress' : change <= -5 ? 'Long-term trend to review' : 'Long-term accuracy is steady',
        text: `Accuracy across the latest ${recentWindow.length} sessions is ${now}%, compared with ${before}% across the preceding ${previousWindow.length} sessions (${change > 0 ? '+' : ''}${change} percentage points).`
      })
    }
  }

  if (keyInsights.length < 2 && sessions.length >= 2) {
    const latest = sessions[sessions.length - 1]
    const previous = sessions[sessions.length - 2]
    const change = Number(latest.accuracy) - Number(previous.accuracy)
    keyInsights.push({
      title: change >= 5 ? 'Recent accuracy improved' : change <= -5 ? 'Recent accuracy declined' : 'Recent accuracy is steady',
      text: `Your latest session accuracy was ${latest.accuracy}% versus ${previous.accuracy}% in the previous session (${change > 0 ? '+' : ''}${change} percentage points).`
    })
  }

  if (!strengths.length) strengths.push({
    title: 'Strengths still emerging',
    text: validTypes.length
      ? `Keep building confidence with ${strongestType.label} questions. Continue reading the whole question carefully in your next live session.`
      : 'Complete more live-session questions to reveal the formats where you are most confident.'
  })
  if (!improvements.length) improvements.push({
    title: 'No major concern detected',
    text: validTypes.length || attemptedQuestions >= 5
      ? 'No clear issue stands out right now. Keep checking each question carefully and continue participating in live sessions.'
      : 'More answered questions are needed before a useful area to improve can be identified.'
  })
  if (!keyInsights.length) keyInsights.push({
    title: 'More sessions needed for trends',
    text: 'Complete another session to compare performance over time. Current values are based only on the history available.'
  })

  return { strengths: strengths.slice(0, 2), improvements: improvements.slice(0, 2), keyInsights: keyInsights.slice(0, 2) }
}

function AnsweringPatternSection({ summary, history, answeringPattern, isMobile }) {
  const attended = history.filter(item => item.attended)
  const recentSessions = attended.slice(-5)
  const typeLabels = { TF: 'True / False', MCQ: 'Single Answer (MCQ)', MSQ: 'Multiple Select (MSQ)' }
  const shortTypeLabels = { TF: 'True / False', MCQ: 'MCQ', MSQ: 'MSQ' }
  const questionTypes = ['MCQ', 'MSQ', 'TF'].map(type => {
    const existing = (answeringPattern?.questionTypes || []).find(item => String(item.type).toUpperCase() === type)
    return {
      type,
      label: typeLabels[type],
      shortLabel: shortTypeLabels[type],
      attempted: Number(existing?.attempted) || 0,
      correct: Number(existing?.correct) || 0,
      incorrect: Number(existing?.incorrect) || Math.max(0, (Number(existing?.attempted) || 0) - (Number(existing?.correct) || 0)),
      accuracy: Number(existing?.accuracy) || 0,
      available: Boolean(existing && Number(existing.attempted) > 0)
    }
  })
  const insights = buildAnsweringInsights(summary, attended, questionTypes)
  const correct = Number(summary?.correctAnswers) || 0
  const incorrect = Number(summary?.incorrectAnswers) || 0
  const unanswered = Number(summary?.missedQuestions) || 0
  const attemptedQuestions = Number(summary?.attemptedQuestions) || 0
  const totalQuestions = Number(summary?.totalQuestions) || 0
  const totalAnswers = correct + incorrect + unanswered
  const percent = value => totalAnswers > 0 ? Math.round((value / totalAnswers) * 100) : 0
  const averageResponseTime = answeringPattern?.averageResponseTime != null && Number.isFinite(Number(answeringPattern.averageResponseTime))
    ? Number(answeringPattern.averageResponseTime)
    : null
  const cardStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 22, padding: isMobile ? 16 : 22, minWidth: 0, boxShadow: 'var(--shadow-md)'
  }
  const miniStatStyle = { borderRadius: 13, padding: 12, background: 'var(--bg-secondary, rgba(127,127,127,0.06))', minWidth: 0 }
  const InsightList = ({ title, icon, color, items }) => (
    <div className="chart-card insight-list-card" style={{ ...cardStyle, background: `linear-gradient(145deg, color-mix(in srgb, ${color} 5%, var(--bg-card)), var(--bg-card))` }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, color, fontSize: 16, fontWeight: 800 }}><span aria-hidden="true">{icon}</span>{title}</h3>
      <div style={{ display: 'grid', gap: 7 }}>
        {items.map((item, index) => (
          <div className="insight-item" key={`${item.title}-${index}`} title={`${item.title}: ${item.text}`} tabIndex={0} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', borderRadius: 12, padding: 9, margin: '-2px -8px', outlineOffset: 2 }}>
            <span style={{ flex: '0 0 23px', height: 23, display: 'grid', placeItems: 'center', borderRadius: 8, background: `${color}18`, color, fontSize: 12, fontWeight: 800 }}>{index + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 13 }}>{item.title}</div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, margin: '24px 0 14px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isMobile ? 21 : 25, letterSpacing: '-0.03em' }}>Answering Pattern</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>See how you answer questions across your attended live sessions.</p>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Last {Math.min(5, attended.length)} attended sessions shown in the chart</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="chart-card" style={cardStyle}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 }}>Overall Answer Distribution</h3>
          <p style={{ margin: '5px 0 16px', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>A circular view of correct, incorrect and unanswered questions across attended sessions.</p>
          {totalAnswers === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No question data is available yet.</p> : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(160px, 0.85fr) minmax(150px, 1fr)', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'grid', placeItems: 'center', minWidth: 0 }}>
              <svg viewBox="0 0 160 160" role="img" aria-label={`Overall answer distribution: ${correct} correct, ${incorrect} incorrect, ${unanswered} unanswered`} style={{ width: '100%', maxWidth: 190, display: 'block' }}>
                <circle cx="80" cy="80" r="52" fill="none" stroke="var(--bg-secondary, #e5e7eb)" strokeWidth="17" />
                <g transform="rotate(-90 80 80)">
                  {[
                    { label: 'Correct', value: correct, color: '#16a34a' },
                    { label: 'Incorrect', value: incorrect, color: '#ef4444' },
                    { label: 'Unanswered', value: unanswered, color: '#94a3b8' }
                  ].map((part, index, parts) => {
                    const circumference = 2 * Math.PI * 52
                    const length = totalAnswers > 0 ? (part.value / totalAnswers) * circumference : 0
                    const offset = parts.slice(0, index).reduce((sum, previousPart) => sum + (totalAnswers > 0 ? (previousPart.value / totalAnswers) * circumference : 0), 0)
                    return <circle key={part.label} cx="80" cy="80" r="52" fill="none" stroke={part.color} strokeWidth="17" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} strokeLinecap="butt">
                      <title>{`${part.label}: ${part.value} (${percent(part.value)}%)`}</title>
                    </circle>
                  })}
                </g>
              </svg>
              <div style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center', marginTop: -2 }}>Across all attended sessions</div>
            </div>
            <div style={{ display: 'grid', gap: 13, minWidth: 0 }}>
              {[
                ['Correct', correct, '#16a34a'],
                ['Incorrect', incorrect, '#ef4444'],
                ['Unanswered', unanswered, '#94a3b8']
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: '10px 12px', borderRadius: 13, background: 'var(--bg-secondary, rgba(127,127,127,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />{label}</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: 13, whiteSpace: 'nowrap' }}>{value} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>({percent(value)}%)</span></strong>
                </div>
              ))}
              <div style={{ marginTop: 2, padding: '12px 13px', borderRadius: 13, border: '1px solid var(--border-color)', background: 'linear-gradient(135deg, rgba(99,102,241,0.09), rgba(6,182,212,0.07))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'rgba(99,102,241,0.13)', color: '#6366f1', fontSize: 17 }}>⏱</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 800 }}>Average response time</div>
                    <div style={{ marginTop: 3, color: 'var(--text-secondary)', fontSize: 10.5 }}>Across all attended sessions</div>
                  </div>
                </div>
                <strong style={{ color: 'var(--text-primary)', fontSize: 19, fontWeight: 900, whiteSpace: 'nowrap' }}>{averageResponseTime == null ? '—' : `${averageResponseTime.toFixed(1)}s`}</strong>
              </div>
            </div>
          </div>}
        </div>

        <div className="chart-card" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div><h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 }}>Answers per Session</h3><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>Last five attended sessions · question counts</p></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>{[['Correct', '#16a34a'], ['Incorrect', '#ef4444'], ['Unanswered', '#94a3b8']].map(([label, color]) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{label}</span>)}</div>
          </div>
          {recentSessions.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 20 }}>Attend a completed session to see this graph.</p> : (() => {
            const maxCount = Math.max(1, ...recentSessions.map(session => Number(session.totalQuestions) || ((Number(session.correctAnswers) || 0) + (Number(session.incorrectAnswers) || 0) + (Number(session.missedQuestions) || 0))))
            const axisMax = Math.max(5, Math.ceil(maxCount / 5) * 5)
            const ticks = 5
            return <div style={{ display: 'flex', gap: 7, alignItems: 'stretch', marginTop: 16 }}>
              <div aria-label="Y-axis: questions" style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700 }}>Questions</div>
              <div style={{ width: 25, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 4, color: 'var(--text-secondary)', fontSize: 10, textAlign: 'right' }}>
                {Array.from({ length: ticks + 1 }, (_, i) => Math.round(axisMax - (axisMax / ticks) * i)).map((value, i) => <span key={`${value}-${i}`}>{value}</span>)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ position: 'relative', height: 220, borderBottom: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)', background: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(20% - 1px), var(--border-color) calc(20% - 1px), var(--border-color) 20%)`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8, padding: '0 7px', boxSizing: 'border-box' }}>
                  {recentSessions.map((session, index) => {
                    const correctCount = Number(session.correctAnswers) || 0
                    const incorrectCount = Number(session.incorrectAnswers) || 0
                    const unansweredCount = Number(session.missedQuestions) || 0
                    const total = correctCount + incorrectCount + unansweredCount
                    const partHeight = value => `${(value / axisMax) * 100}%`
                    const title = `${session.name}: ${correctCount} correct, ${incorrectCount} incorrect, ${unansweredCount} unanswered (${total} total)`
                    return <div key={session.roomId || `${session.name}-${index}`} title={title} style={{ height: '100%', flex: '1 1 0', minWidth: 0, maxWidth: 68, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <div style={{ height: `${Math.min(100, (total / axisMax) * 100)}%`, width: 'min(100%, 42px)', minHeight: total > 0 ? 2 : 0, display: 'flex', flexDirection: 'column-reverse', overflow: 'hidden', borderRadius: '5px 5px 0 0', alignSelf: 'center' }}>
                        <div style={{ height: partHeight(correctCount), background: '#16a34a' }} />
                        <div style={{ height: partHeight(incorrectCount), background: '#ef4444' }} />
                        <div style={{ height: partHeight(unansweredCount), background: '#94a3b8' }} />
                      </div>
                    </div>
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${recentSessions.length}, minmax(0, 1fr))`, gap: 6, paddingTop: 7 }}>
                  {recentSessions.map((session, index) => <div key={session.roomId || `${session.name}-label-${index}`} title={session.name || 'Unnamed session'} style={{ minWidth: 0, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name || `Session ${index + 1}`}</div>)}
                </div>
                <div style={{ textAlign: 'center', paddingTop: 7, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Sessions</div>
              </div>
            </div>
          })()}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="chart-card" style={cardStyle}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 }}>Accuracy by Question Type</h3>
          <p style={{ margin: '5px 0 18px', color: 'var(--text-secondary)', fontSize: 12 }}>See which question formats feel strongest across your sessions.</p>
          <div style={{ display: 'grid', gap: 15 }}>
            {questionTypes.map(item => (
              <div key={item.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 12 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{item.label}</strong>
                  <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{item.available ? `${item.accuracy}% accuracy` : 'No data yet'}</span>
                </div>
                <div style={{ height: 9, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-secondary, #e5e7eb)' }}>
                  <div style={{ width: `${item.available ? Math.max(0, Math.min(100, item.accuracy)) : 0}%`, height: '100%', borderRadius: 999, background: !item.available ? 'transparent' : item.accuracy >= 75 ? '#16a34a' : item.accuracy >= 60 ? '#d97706' : '#ef4444', transition: 'width .3s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={cardStyle}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 17, fontWeight: 800 }}>Question Type Mix</h3>
          <p style={{ margin: '5px 0 18px', color: 'var(--text-secondary)', fontSize: 12 }}>How your attempted answers are distributed across question formats.</p>
          {questionTypes.every(item => !item.available) ? <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Question-type activity will appear after you answer questions.</p> : <div style={{ display: 'grid', gap: 14 }}>
            {questionTypes.map(item => {
              const typeShare = attemptedQuestions > 0 ? Math.round((item.attempted / attemptedQuestions) * 100) : 0
              return <div key={item.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: 12 }}><strong style={{ color: 'var(--text-primary)' }}>{item.shortLabel}</strong><span style={{ color: 'var(--text-secondary)' }}>{item.attempted} attempted · {typeShare}%</span></div>
                <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-secondary, #e5e7eb)' }}><div style={{ width: `${typeShare}%`, height: '100%', borderRadius: 999, background: item.type === 'MCQ' ? '#6366f1' : item.type === 'MSQ' ? '#0d9488' : '#f59e0b' }} /></div>
              </div>
            })}
          </div>}
        </div>
      </div>

      <div style={{ margin: '24px 0 14px' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isMobile ? 21 : 25, letterSpacing: '-0.03em' }}>Performance Insights</h2>
        <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Practical feedback based on your recorded session data.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <InsightList title="Strengths / Areas to Gain" icon="↗" color="#15803d" items={insights.strengths} />
        <InsightList title="Areas to Improve" icon="🎯" color="#b91c1c" items={insights.improvements} />
        <InsightList title="Key Insights" icon="✦" color="#6d28d9" items={insights.keyInsights} />
      </div>
    </div>
  )
}

function PerformanceHighlights({ best, weakest, history, isMobile, navigate }) {
  const highlightItems = [
    { label: 'Best Performance', description: 'Your highest-scoring attended session', item: best, icon: '🏅', color: '#15803d', background: 'rgba(22,163,74,.08)' },
    { label: 'Weakest Performance', description: 'A session worth reviewing', item: weakest, icon: '🔎', color: '#b45309', background: 'rgba(245,158,11,.09)' }
  ]
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 13 }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isMobile ? 21 : 24 }}>Best & Weakest Performance</h2>
        <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Compare your personal best with the session you may want to revisit.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {highlightItems.map(({ label, description, item, icon, color, background }) => {
          const relatedSession = item?.roomId ? history.find(session => String(session.roomId) === String(item.roomId)) : null
          return (
            <div className="chart-card highlight-card" key={label} style={{ position: 'relative', padding: isMobile ? 17 : 22, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, minWidth: 0, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: color }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, flexShrink: 0, borderRadius: 14, background, fontSize: 23 }}>{icon}</span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, color, fontSize: 16, fontWeight: 850 }}>{label}</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>{description}</p>
                </div>
              </div>
              {item ? <>
                <div style={{ color: 'var(--text-primary)', fontSize: 17, fontWeight: 850, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{item.name || 'Untitled session'}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{relatedSession?.date ? formatDate(relatedSession.date) : 'Completed session'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 17 }}>
                  <div style={{ borderRadius: 12, padding: 11, background: 'var(--bg-secondary, rgba(127,127,127,.06))' }}><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Score</div><strong style={{ display: 'block', color, fontSize: 20, marginTop: 3 }}>{Number(item.score) || 0}%</strong></div>
                  <div style={{ borderRadius: 12, padding: 11, background: 'var(--bg-secondary, rgba(127,127,127,.06))' }}><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Accuracy</div><strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 20, marginTop: 3 }}>{Number(item.accuracy) || 0}%</strong></div>
                  <div style={{ borderRadius: 12, padding: 11, background: 'var(--bg-secondary, rgba(127,127,127,.06))' }}><div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Rank</div><strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 20, marginTop: 3 }}>{formatRank(item.rank)}</strong></div>
                </div>
                {item.roomId && <button type="button" className="session-view-button" style={{ marginTop: 14 }} onClick={() => navigate(`/student/room/${item.roomId}/results`, { state: { from: 'performance' } })}>◉ View session details</button>}
              </> : <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>This insight will appear when enough completed-session data is available.</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RecentChangesSection({ history, recent, isMobile }) {
  const latest = history[history.length - 1] || null
  const previous = history[history.length - 2] || null
  const correctChange = latest && previous ? Number(latest.correctAnswers || 0) - Number(previous.correctAnswers || 0) : null
  const metrics = [
    { label: 'Score', value: recent?.scoreChange ?? (latest && previous ? latest.score - previous.score : null), unit: ' pts', detail: latest && previous ? `${previous.score}% → ${latest.score}%` : 'Need two sessions', icon: '📊', tone: (recent?.scoreChange ?? (latest && previous ? latest.score - previous.score : 0)) >= 0 ? 'positive' : 'negative' },
    { label: 'Accuracy', value: recent?.accuracyChange ?? (latest && previous ? latest.accuracy - previous.accuracy : null), unit: ' pp', detail: latest && previous ? `${previous.accuracy}% → ${latest.accuracy}%` : 'Need two sessions', icon: '🎯', tone: (recent?.accuracyChange ?? (latest && previous ? latest.accuracy - previous.accuracy : 0)) >= 0 ? 'positive' : 'negative' },
    { label: 'Correct Answers', value: correctChange, unit: ' answers', detail: latest && previous ? `${previous.correctAnswers || 0} → ${latest.correctAnswers || 0}` : 'Need two sessions', icon: '✅', tone: (correctChange ?? 0) >= 0 ? 'positive' : 'negative' },
    { label: 'Rank Improvement', value: recent?.rankChange ?? (latest && previous && latest.rank != null && previous.rank != null ? previous.rank - latest.rank : null), unit: ' places', detail: latest && previous ? `${formatRank(previous.rank)} → ${formatRank(latest.rank)}` : 'Need two sessions', icon: '🏆', tone: (recent?.rankChange ?? (latest && previous && latest.rank != null && previous.rank != null ? previous.rank - latest.rank : 0)) >= 0 ? 'positive' : 'negative' }
  ]
  return (
    <section style={{ marginTop: 22,marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isMobile ? 21 : 24 }}>Recent Changes</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>What changed between your two latest attended sessions.</p></div>
        <span style={{ borderRadius: 999, padding: '6px 10px', background: 'var(--bg-secondary, rgba(127,127,127,.06),)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 750 }}>Latest vs previous</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 13 }}>
        {metrics.map(metric => {
          const positive = metric.tone === 'positive'
          const neutral = metric.value === 0
          const statusLabel = metric.value == null ? 'Not enough data' : neutral ? 'No change' : positive ? 'Improved' : 'Decreased'
          const accent = metric.value == null || neutral ? '#64748b' : positive ? '#15803d' : '#b91c1c'
          const valueText = metric.value == null ? '—' : `${metric.value > 0 ? '+' : ''}${metric.value}${metric.unit}`
          return <div className="change-card" key={metric.label} style={{ padding: isMobile ? 14 : 18, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 19, minWidth: 0, boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,.05))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 15 }}>
              <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 13, background: `${accent}14`, fontSize: 21 }}>{metric.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '5px 7px', color: accent, background: `${accent}12`, whiteSpace: 'nowrap' }}>{statusLabel}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 750 }}>{metric.label}</div>
            <div style={{ color: accent, fontSize: isMobile ? 19 : 23, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.2, marginTop: 5, overflowWrap: 'anywhere' }}>{valueText}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border-color)' }}>{metric.detail}</div>
          </div>
        })}
      </div>
    </section>
  )
}



// Added analytics: kept separate from existing dashboard sections so the original
// charts, data calculations, navigation and session history remain untouched.
function AddedAnalyticsCard({ title, description, children, isMobile, accent = '#4f46e5', compact = false }) {
  return (
    <section className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: compact ? 18 : 22, padding: compact ? (isMobile ? 12 : 15) : (isMobile ? 16 : 22), boxShadow: 'var(--shadow-md)', minWidth: 0, height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? 8 : 10, marginBottom: compact ? 9 : 14 }}>
        <span aria-hidden="true" style={{ width: compact ? 5 : 7, alignSelf: 'stretch', minHeight: compact ? 32 : 40, borderRadius: 999, background: accent, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: compact ? 16 : 18, fontWeight: 850 }}>{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: compact ? 11 : 12, lineHeight: 1.5 }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function getSessionAccuracyValue(session) {
  const attempted = Number(session?.attemptedQuestions) || (Number(session?.correctAnswers || 0) + Number(session?.incorrectAnswers || 0))
  const correct = Number(session?.correctAnswers) || 0
  if (attempted > 0) return (correct / attempted) * 100
  if (session?.accuracy == null || session.accuracy === '') return null
  const accuracy = Number(session.accuracy)
  return Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 100 ? accuracy : null
}

function getSessionAverageResponseSeconds(session) {
  const secondsCandidates = [
    session?.averageResponseTimeSeconds,
    session?.avgResponseTimeSeconds,
    session?.meanResponseTimeSeconds,
    session?.averageResponseTime,
    session?.avgResponseTime,
    session?.responseStats?.averageResponseTimeSeconds,
    session?.responseStats?.averageResponseTime,
    session?.answeringPattern?.averageResponseTimeSeconds,
    session?.answeringPattern?.averageResponseTime,
    session?.timing?.averageResponseTimeSeconds,
    session?.timing?.averageResponseTime
  ]
  for (const candidate of secondsCandidates) {
    if (candidate != null && candidate !== '' && Number.isFinite(Number(candidate)) && Number(candidate) >= 0) return Number(candidate)
  }
  const milliseconds = Number(session?.averageResponseTimeMs ?? session?.avgResponseTimeMs)
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds / 1000
  return null
}

function getParticipantCount(session) {
  const candidates = [
    session?.participantCount,
    session?.totalParticipants,
    session?.participantsCount,
    session?.rankedParticipants,
    session?.rankedParticipantCount,
    session?.totalStudents,
    session?.attendeeCount,
    session?.participantTotal,
    session?.leaderboardCount,
    session?.participantStats?.total,
    session?.ranking?.participantCount,
    session?.ranking?.totalParticipants
  ]
  for (const candidate of candidates) {
    const number = Number(candidate)
    if (candidate != null && candidate !== '' && Number.isFinite(number) && number > 1) return Math.floor(number)
  }
  if (Array.isArray(session?.participants) && session.participants.length > 1) return session.participants.length
  return null
}

function AdvancedChartEmpty({ children }) {
  return <div style={{ minHeight: 150, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>{children}</div>
}

function AverageResponseTimeChart({ history }) {
  const values = (history || []).map((session, index) => ({
    session,
    index,
    seconds: getSessionAverageResponseSeconds(session)
  })).filter(point => point.seconds != null)
  if (!values.length) return <AdvancedChartEmpty>Per-session response times are not included in the current performance history. The backend must return an average response-time value for each session to plot this accurately; an overall average cannot be split into invented session values.</AdvancedChartEmpty>

  // Heatmap tiles make the relative speed pattern easy to scan without another line or bar chart.
  const sorted = values.slice(-8)
  const maxTime = Math.max(1, ...sorted.map(point => point.seconds))
  const minTime = Math.min(...sorted.map(point => point.seconds))
  const range = Math.max(1, maxTime - minTime)
  const tileColor = seconds => {
    const ratio = (seconds - minTime) / range
    return ratio < .34 ? '#0d9488' : ratio < .67 ? '#6366f1' : '#f97316'
  }
  return <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
    <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>Latest up to 8 sessions with recorded response-time data · teal is faster, orange is slower within this set.</div>
    <div role="img" aria-label="Response time heatmap by session. Each tile shows the recorded average response time in seconds; color compares speed within the displayed sessions." style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, sorted.length)}, minmax(0, 1fr))`, gridAutoRows: 'minmax(84px, 1fr)', gap: 9, flex: 1, alignContent: 'stretch' }}>
      {sorted.map((point, index) => {
        const color = tileColor(point.seconds)
        return <div key={`${point.session.roomId || point.session.name || point.index}-${index}`} title={`${point.session.name || `Session ${point.index + 1}`}: ${point.seconds.toFixed(2)} seconds average response time`} style={{ minWidth: 0, minHeight: 84, padding: '12px 7px', borderRadius: 13, background: `${color}16`, border: `1px solid ${color}55`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 10.5, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getSessionLabel(point.session, point.index, 12)}</span>
          <strong style={{ color, fontSize: 20, lineHeight: 1.1, fontWeight: 900 }}>{point.seconds.toFixed(1)}s</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 9.5 }}>{point.seconds === minTime ? 'Fastest' : point.seconds === maxTime ? 'Slowest' : 'Avg. time'}</span>
        </div>
      })}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 14, color: 'var(--text-secondary)', fontSize: 10.5 }}>
      {[['#0d9488', 'Faster'], ['#6366f1', 'Mid-range'], ['#f97316', 'Slower']].map(([color, label]) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />{label}</span>)}
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, lineHeight: 1.5, marginTop: 8 }}></div>
  </div>
}

function getWeekStart(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  return start
}

function summarizeAccuracy(sessions) {
  const attempted = sessions.reduce((sum, session) => sum + (Number(session.attemptedQuestions) || (Number(session.correctAnswers || 0) + Number(session.incorrectAnswers || 0))), 0)
  const correct = sessions.reduce((sum, session) => sum + (Number(session.correctAnswers) || 0), 0)
  if (attempted > 0) return correct / attempted * 100
  const valid = sessions.map(getSessionAccuracyValue).filter(value => value != null && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

function getWeekKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatWeekRange(start) {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const format = value => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(value)
  return `${format(start)}–${format(end)}`
}

function WeeklyPerformanceComparison({ history }) {
  // Compare the two latest calendar weeks that actually contain recorded accuracy data.
  // Anchoring this chart to available session records prevents it disappearing simply because
  // no session has happened yet in the current calendar week.
  const groupedWeeks = new Map()
  for (const session of history || []) {
    const rawDate = session?.date ?? session?.endedAt ?? session?.updatedAt ?? session?.createdAt
    if (!rawDate) continue
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime()) || getSessionAccuracyValue(session) == null) continue
    const start = getWeekStart(date)
    const key = getWeekKey(start)
    if (!groupedWeeks.has(key)) groupedWeeks.set(key, { start, sessions: [] })
    groupedWeeks.get(key).sessions.push(session)
  }

  const weeks = [...groupedWeeks.values()]
    .map(week => ({ ...week, accuracy: summarizeAccuracy(week.sessions) }))
    .filter(week => week.accuracy != null && Number.isFinite(week.accuracy))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (weeks.length < 2) {
    return <AdvancedChartEmpty>Week-by-week accuracy appears after your history contains sessions with valid accuracy data in at least two different calendar weeks. A missing week is not treated as 0%.</AdvancedChartEmpty>
  }

  const previous = weeks[weeks.length - 2]
  const current = weeks[weeks.length - 1]
  const todayWeek = getWeekStart(new Date())
  const latestWeekIsThisCalendarWeek = getWeekKey(current.start) === getWeekKey(todayWeek)
  const weeksAreAdjacent = (current.start.getTime() - previous.start.getTime()) <= (7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000)
  const previousLabel = latestWeekIsThisCalendarWeek && weeksAreAdjacent ? 'Previous week' : 'Previous recorded week'
  const currentLabel = latestWeekIsThisCalendarWeek ? 'Current week' : 'Latest recorded week'
  const delta = current.accuracy - previous.accuracy
  const changeColor = delta > 0 ? '#16a34a' : delta < 0 ? '#ea580c' : '#64748b'
  const changeLabel = `${delta > 0 ? '+' : ''}${delta.toFixed(1)} percentage points`

  // Compact, responsive chart: no horizontal scroll is needed for two bars.
  const width = 520, height = 285, left = 54, right = 18, top = 24, bottom = 62
  const plotH = height - top - bottom
  const plotW = width - left - right
  const y = value => top + (100 - Math.max(0, Math.min(100, value))) / 100 * plotH
  const centers = [left + plotW * 0.29, left + plotW * 0.73]
  const barW = 76
  const values = [previous.accuracy, current.accuracy]
  const fills = ['#94a3b8', delta >= 0 ? '#2563eb' : '#ea580c']
  const labels = [previousLabel, currentLabel]
  const ranges = [formatWeekRange(previous.start), formatWeekRange(current.start)]

  return <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{previousLabel}</div>
        <div style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 900 }}>{previous.accuracy.toFixed(1)}%</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{ranges[0]}</div>
      </div>
      <div style={{ textAlign: 'center', color: changeColor, fontSize: 11, fontWeight: 850, maxWidth: 120 }}>
        <div style={{ fontSize: 21, lineHeight: 1.1 }}>{delta > 0 ? '↗' : delta < 0 ? '↘' : '→'}</div>
        <div>{changeLabel}</div>
      </div>
      <div style={{ minWidth: 0, textAlign: 'right' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{currentLabel}</div>
        <div style={{ color: changeColor, fontSize: 22, fontWeight: 900 }}>{current.accuracy.toFixed(1)}%</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{ranges[1]}</div>
      </div>
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Week-by-week accuracy comparison. X-axis: recorded week. Y-axis: accuracy percentage. ${previousLabel} ${previous.accuracy.toFixed(1)}%, latest week ${current.accuracy.toFixed(1)}%, change ${changeLabel}.`} style={{ width: '100%', height: 'auto', minWidth: 0, display: 'block' }}>
      {[0, 25, 50, 75, 100].map(tick => <g key={tick}>
        <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} stroke="var(--border-color)" strokeDasharray="4 5" />
        <text x={left - 9} y={y(tick) + 4} textAnchor="end" fill="var(--text-secondary)" fontSize="10.5">{tick}%</text>
      </g>)}
      {values.map((value, index) => {
        const barY = y(value)
        return <g key={index}>
          <rect x={centers[index] - barW / 2} y={barY} width={barW} height={top + plotH - barY} rx="7" fill={fills[index]} opacity="0.93"><title>{`${labels[index]} (${ranges[index]}): ${value.toFixed(1)}% accuracy, ${[previous, current][index].sessions.length} attended sessions`}</title></rect>
          <text x={centers[index]} y={Math.max(14, barY - 7)} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="850">{value.toFixed(1)}%</text>
          <text x={centers[index]} y={height - 32} textAnchor="middle" fill="var(--text-secondary)" fontSize="10.5">{index === 0 ? 'Previous' : 'Latest'}</text>
        </g>
      })}
      <line x1={left} y1={top} x2={left} y2={top + plotH} stroke="var(--border-color)" />
      <line x1={left} y1={top + plotH} x2={width - right} y2={top + plotH} stroke="var(--border-color)" />
      <text x="15" y={top + plotH / 2} transform={`rotate(-90 15 ${top + plotH / 2})`} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="700">Accuracy (%)</text>
      <text x={left + plotW / 2} y={height - 7} textAnchor="middle" fill="var(--text-secondary)" fontSize="11" fontWeight="700">Recorded week</text>
    </svg>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, lineHeight: 1.5, marginTop: 5 }}>
      Compared {previous.sessions.length} session{previous.sessions.length === 1 ? '' : 's'} with {current.sessions.length} session{current.sessions.length === 1 ? '' : 's'}. {latestWeekIsThisCalendarWeek ? 'Current calendar week has data.' : 'No accuracy data exists in the current calendar week yet, so the chart uses the latest two recorded weeks.'}
    </div>
  </div>
}

function RankPercentileDistribution({ history }) {
  const points = (history || []).map((session, index) => {
    const rank = Number(session?.rank)
    const participants = getParticipantCount(session)
    if (!Number.isFinite(rank) || rank < 1 || participants == null || rank > participants) return null
    const standing = participants > 1 ? ((participants - rank) / (participants - 1)) * 100 : 100
    const topPercent = Math.max(1, Math.min(100, Math.ceil((rank / participants) * 100)))
    return { session, index, rank, participants, standing, topPercent }
  }).filter(Boolean).slice(-8)

  if (!points.length) return <AdvancedChartEmpty>Rank percentile needs a valid rank and participant count. The API's session history should include both values before this chart can calculate a real relative standing.</AdvancedChartEmpty>

  // Radial progress rings provide a different visual form from the dashboard's line, bar and scatter charts.
  const radius = 28
  const circumference = 2 * Math.PI * radius
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, marginBottom: 12 }}>Latest {points.length} sessions with rank data · higher relative standing is better.</div>
    <div className="rank-percentile-grid" role="img" aria-label="Rank percentile radial chart. Each ring shows relative standing from zero to one hundred percent." style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      {points.map((point, index) => {
        const color = point.standing >= 75 ? '#0d9488' : point.standing >= 50 ? '#6366f1' : '#f59e0b'
        const offset = circumference * (1 - point.standing / 100)
        return <div key={`${point.session.roomId || point.session.name || index}`} title={`${point.session.name || `Session ${point.index + 1}`}: rank ${point.rank} of ${point.participants}, top ${point.topPercent}%, relative standing ${point.standing.toFixed(1)}%`} style={{ minWidth: 0, padding: '12px 7px', border: '1px solid var(--border-color)', borderRadius: 14, background: 'var(--bg-secondary, rgba(127,127,127,.04))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <svg viewBox="0 0 76 76" style={{ width: 76, height: 76, display: 'block' }} aria-hidden="true">
            <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--border-color)" strokeWidth="7" />
            <circle cx="38" cy="38" r={radius} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 38 38)" />
            <text x="38" y="42" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="800">{Math.round(point.standing)}%</text>
          </svg>
          <strong style={{ color: 'var(--text-primary)', fontSize: 11, textAlign: 'center', overflowWrap: 'anywhere' }}>{getSessionLabel(point.session, point.index, 12)}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Rank #{point.rank}/{point.participants}</span>
        </div>
      })}
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, lineHeight: 1.5, marginTop: 10 }}>Relative standing is calculated from recorded rank and participant count; 100% represents first place.</div>
  </div>
}

function WhatIfLab({ history }) {
  const [mode, setMode] = useState('missed')
  const [missedExtra, setMissedExtra] = useState(0)
  const [incorrectExtra, setIncorrectExtra] = useState(0)
  const eligibleHistory = (history || []).filter(session => session?.attended !== false)
  const datedHistory = eligibleHistory.filter(session => session?.date && Number.isFinite(Date.parse(session.date)))
  const latest = datedHistory.length
    ? datedHistory.reduce((current, session) => Date.parse(session.date) > Date.parse(current.date) ? session : current)
    : eligibleHistory[eligibleHistory.length - 1] || null
  const correct = Number(latest?.correctAnswers) || 0
  const incorrect = Number(latest?.incorrectAnswers) || 0
  const missed = Number(latest?.missedQuestions) || 0
  const attempted = Number(latest?.attemptedQuestions) || (correct + incorrect)
  const totalQuestionsRaw = Number(latest?.totalQuestions)
  const totalAvailable = Number.isFinite(totalQuestionsRaw) && totalQuestionsRaw > 0 ? totalQuestionsRaw : attempted + missed
  const actualAccuracy = attempted > 0 ? (correct / attempted) * 100 : null
  const maxExtra = mode === 'incorrect' ? Math.min(5, incorrect) : missed
  const storedExtra = mode === 'missed' ? missedExtra : incorrectExtra
  const extra = Math.min(Math.max(0, storedExtra), maxExtra)
  const hypotheticalCorrect = correct + extra
  const hypotheticalAttempted = mode === 'missed' ? attempted + extra : attempted
  const hypotheticalAccuracy = hypotheticalAttempted > 0 ? (hypotheticalCorrect / hypotheticalAttempted) * 100 : null
  const buttonStyle = active => ({
    border: `1px solid ${active ? '#7c3aed' : 'var(--border-color)'}`,
    background: active ? 'rgba(124,58,237,.09)' : 'var(--bg-secondary, rgba(127,127,127,.04))',
    color: active ? '#7c3aed' : 'var(--text-primary)',
    borderRadius: 10,
    padding: '8px 9px',
    fontSize: 11,
    lineHeight: 1.35,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'left',
    minWidth: 0
  })
  const statStyle = { borderRadius: 10, padding: '8px 10px', background: 'var(--bg-secondary, rgba(127,127,127,.06))', minWidth: 0 }

  if (!latest || actualAccuracy == null) return <AdvancedChartEmpty>Complete a session with recorded question counts to use the What-If Lab.</AdvancedChartEmpty>

  return <div style={{ minWidth: 0 }}>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10.5, marginBottom: 8 }}>Based on: <strong style={{ color: 'var(--text-primary)' }}>{latest.name || 'Most recent session'}</strong></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7 }}>
      <div style={statStyle}><div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Correct</div><div style={{ color: 'var(--text-primary)', fontSize: 21, fontWeight: 900, marginTop: 2 }}>{correct}</div></div>
      <div style={statStyle}><div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Attempted</div><div style={{ color: 'var(--text-primary)', fontSize: 21, fontWeight: 900, marginTop: 2 }}>{attempted}</div></div>
      <div style={statStyle}><div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Unanswered</div><div style={{ color: 'var(--text-primary)', fontSize: 21, fontWeight: 900, marginTop: 2 }}>{missed}</div></div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 6, color: 'var(--text-secondary)', fontSize: 10.5 }}>
      <span>{totalAvailable} questions available</span><span>{incorrect} incorrect answers</span>
    </div>

    <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0 10px' }} />
    <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 850, marginBottom: 8 }}>Try a what-if scenario</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginBottom: 10 }}>
      <button type="button" aria-pressed={mode === 'missed'} style={buttonStyle(mode === 'missed')} onClick={() => setMode('missed')}>
        Answer missed correctly<span style={{ display: 'block', marginTop: 3, fontWeight: 600, opacity: .8 }}>{missed} unanswered</span>
      </button>
      <button type="button" aria-pressed={mode === 'incorrect'} style={buttonStyle(mode === 'incorrect')} onClick={() => setMode('incorrect')}>
        Turn incorrect correct<span style={{ display: 'block', marginTop: 3, fontWeight: 600, opacity: .8 }}>{incorrect} incorrect · change up to 5</span>
      </button>
    </div>

    {maxExtra > 0 ? <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <label htmlFor="what-if-extra" style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>{mode === 'missed' ? 'Missed answers changed to correct' : 'Incorrect answers changed to correct'}</label>
        <strong style={{ color: 'var(--text-primary)', fontSize: 14, flexShrink: 0 }}>{extra}/{maxExtra}</strong>
      </div>
      <input
        id="what-if-extra"
        type="range"
        min="0"
        max={maxExtra}
        step="1"
        value={extra}
        onChange={event => mode === 'missed' ? setMissedExtra(Number(event.target.value)) : setIncorrectExtra(Number(event.target.value))}
        aria-label={mode === 'missed' ? 'Number of unanswered questions hypothetically answered correctly' : 'Number of incorrect answers hypothetically corrected, up to five'}
        style={{ display: 'block', width: '100%', accentColor: '#7c3aed', cursor: 'pointer', margin: '5px 0 0' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text-secondary)', fontSize: 10, marginTop: 2 }}><span>0 changed</span><span>{mode === 'incorrect' ? `Maximum 5 (${incorrect} available)` : `${missed} available`}</span></div>
    </> : <div style={{ padding: 9, borderRadius: 9, background: 'var(--bg-secondary, rgba(127,127,127,.06))', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.45 }}>
      {mode === 'missed' ? 'There are no unanswered questions in this session. Select the other scenario to explore incorrect answers.' : 'There are no incorrect answers in this session. Select the other scenario to explore unanswered questions.'}
    </div>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, marginTop: 11 }}>
      <div style={{ padding: '9px 10px', border: '1px solid var(--border-color)', borderRadius: 10 }}><div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>Actual accuracy</div><div style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 900, marginTop: 2 }}>{actualAccuracy.toFixed(1)}%</div></div>
      <div style={{ padding: '9px 10px', border: '1px solid rgba(22,163,74,.35)', borderRadius: 10, background: 'rgba(22,163,74,.045)' }}><div style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>What-if accuracy</div><div style={{ color: '#16a34a', fontSize: 22, fontWeight: 900, marginTop: 2 }}>{hypotheticalAccuracy == null ? '—' : `${hypotheticalAccuracy.toFixed(1)}%`}</div><div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{hypotheticalAccuracy != null ? `${hypotheticalAccuracy - actualAccuracy >= 0 ? '+' : ''}${(hypotheticalAccuracy - actualAccuracy).toFixed(1)} pp` : '—'}</div></div>
    </div>
    <div style={{ color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.45, marginTop: 7 }}>Simulation only. It does not change saved results or predict the official Spandan score or rank.</div>
  </div>
}

function SessionToSessionScoreChangeChart({ history }) {
  // Include every attended session with a valid recorded score; do not truncate the history.
  const sessions = (history || [])
    .filter(session => session?.score != null && session.score !== '' && Number.isFinite(Number(session.score)) && Number(session.score) >= 0 && Number(session.score) <= 100)
    .map((session, index) => ({
      name: session.name || `Session ${index + 1}`,
      score: Number(session.score)
    }))
  const changes = sessions.slice(1).map((session, index) => ({
    name: session.name,
    previousName: sessions[index].name,
    change: Math.round((session.score - sessions[index].score) * 10) / 10
  }))
  if (changes.length < 1) {
    return <AdvancedChartEmpty>Session-to-session changes need at least two recorded session scores. Complete more sessions to compare your results.</AdvancedChartEmpty>
  }
  const maxAbs = Math.max(5, Math.ceil(Math.max(...changes.map(point => Math.abs(point.change))) / 5) * 5)
  // Give each session enough horizontal room; the wrapper below scrolls on narrower cards.
  const width = Math.max(760, changes.length * 88 + 110)
  const height = 250
  const left = 44
  const right = 14
  const top = 20
  const bottom = 52
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const zeroY = top + plotHeight / 2
  const xAt = index => left + ((index + 0.5) / changes.length) * plotWidth
  const yAt = value => zeroY - (value / maxAbs) * (plotHeight / 2)
  return <div style={{ minWidth: 0 }}>
    <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5, marginBottom: 8 }}>Each bar compares the named session with the previous attended session. Hover over a bar for both session names and the exact change.</div>
    <div className="advanced-chart-scroll" style={{ minWidth: 0 }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Score change compared with the previous session; positive means an increase and negative means a decrease" style={{ width: `${width}px`, minWidth: `${width}px`, height: 'auto', display: 'block' }}>
        {[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((tick, index) => {
          const y = yAt(tick)
          return <g key={`${tick}-${index}`}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke="var(--border-color)" strokeDasharray={tick === 0 ? '0' : '4 4'} strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">{tick > 0 ? `+${tick}` : tick}</text>
          </g>
        })}
        {changes.map((point, index) => {
          const x = xAt(index)
          const y = yAt(point.change)
          const color = point.change > 0 ? '#16a34a' : point.change < 0 ? '#ef4444' : '#94a3b8'
          return <g key={`${point.name}-${index}`}>
            <rect x={x - Math.min(17, plotWidth / changes.length * 0.28)} y={Math.min(y, zeroY)} width={Math.min(34, plotWidth / changes.length * 0.56)} height={Math.max(2, Math.abs(zeroY - y))} rx="5" fill={color} opacity="0.82">
              <title>{`${point.name}: ${point.change > 0 ? '+' : ''}${point.change} points versus ${point.previousName}`}</title>
            </rect>
            <circle cx={x} cy={y} r="3.5" fill={color} stroke="var(--bg-card)" strokeWidth="1.5" />
            <text x={x} y={point.change >= 0 ? Math.max(top + 10, y - 8) : Math.min(top + plotHeight - 2, y + 14)} textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{point.change > 0 ? '+' : ''}{point.change}</text>
            <text x={x} y={height - 28} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">{point.name.length > 10 ? `${point.name.slice(0, 9)}…` : point.name}</text>
          </g>
        })}
        <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-secondary)">Attended session</text>
      </svg>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, color: 'var(--text-secondary)', fontSize: 11 }}>
      <span><span style={{ color: '#16a34a', fontWeight: 900 }}>●</span> Score increased</span>
      <span><span style={{ color: '#ef4444', fontWeight: 900 }}>●</span> Score decreased</span>
      <span><span style={{ color: '#94a3b8', fontWeight: 900 }}>●</span> No change</span>
    </div>
  </div>
}

function SessionConsistencyGauge({ history }) {
  const scores = (history || [])
    .map(session => session?.score)
    .filter(value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100)
    .map(Number)

  if (scores.length < 2) {
    return <AdvancedChartEmpty>Session consistency needs at least two recorded session scores. Complete more sessions to see how steadily your scores are performing.</AdvancedChartEmpty>
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length
  const standardDeviation = Math.sqrt(variance)
  // Consistency index is 100 minus the population standard deviation in score percentage points.
  const consistency = Math.max(0, Math.min(100, 100 - standardDeviation))
  const status = standardDeviation <= 5
    ? { label: 'Very consistent', color: '#16a34a', detail: 'Your scores have varied only slightly across sessions.' }
    : standardDeviation <= 10
      ? { label: 'Fairly consistent', color: '#0d9488', detail: 'Your scores show some variation, but remain relatively steady.' }
      : { label: 'Scores vary', color: '#d97706', detail: 'Your scores have varied noticeably between sessions.' }

  return <div style={{ minWidth: 0 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
      <div style={{ minWidth: 0, textAlign: 'center' }}>
        <svg viewBox="0 0 200 126" role="img" aria-label={`Session consistency ${consistency.toFixed(1)} out of 100, based on ${scores.length} session scores. Standard deviation ${standardDeviation.toFixed(1)} percentage points.`} style={{ width: '100%', maxWidth: 250, display: 'block', margin: '0 auto' }}>
          <path d="M 24 104 A 76 76 0 0 1 176 104" fill="none" stroke="var(--bg-secondary, #e5e7eb)" strokeWidth="15" strokeLinecap="round" pathLength="100" />
          <path d="M 24 104 A 76 76 0 0 1 176 104" fill="none" stroke={status.color} strokeWidth="15" strokeLinecap="round" pathLength="100" strokeDasharray={`${consistency} 100`} />
          <text x="100" y="76" textAnchor="middle" fontSize="29" fontWeight="900" fill="var(--text-primary)">{Math.round(consistency)}</text>
          <text x="100" y="94" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--text-secondary)">OUT OF 100</text>
          <text x="23" y="122" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">0</text>
          <text x="177" y="122" textAnchor="middle" fontSize="10" fill="var(--text-secondary)">100</text>
        </svg>
        <div style={{ color: status.color, fontSize: 13, fontWeight: 850, marginTop: 0 }}>{status.label}</div>
      </div>
      <div style={{ display: 'grid', gap: 9, minWidth: 0 }}>
        <div style={{ borderRadius: 12, padding: 12, background: 'var(--bg-secondary, rgba(127,127,127,.06))' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Average score</div>
          <strong style={{ display: 'block', marginTop: 3, color: 'var(--text-primary)', fontSize: 23 }}>{average.toFixed(1)}%</strong>
        </div>
        <div style={{ borderRadius: 12, padding: 12, background: 'var(--bg-secondary, rgba(127,127,127,.06))' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Score variation (standard deviation)</div>
          <strong style={{ display: 'block', marginTop: 3, color: 'var(--text-primary)', fontSize: 23 }}>{standardDeviation.toFixed(1)} pp</strong>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>{scores.length} recorded session scores</div>
      </div>
    </div>
    <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.55 }}>
      {status.detail} Consistency index = 100 − score standard deviation (in percentage points). A
    </p>
  </div>
}

function AddedAnalyticsSection({ history, isMobile }) {
  const attended = (history || []).filter(session => session?.attended)
  return <>
    <style>{`
      .advanced-chart-scroll { width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.75) rgba(148,163,184,.12); -webkit-overflow-scrolling: touch; }
      .advanced-chart-scroll::-webkit-scrollbar { height: 9px; }
      .advanced-chart-scroll::-webkit-scrollbar-track { background: rgba(148,163,184,.12); border-radius: 999px; }
      .advanced-chart-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,.75); border-radius: 999px; }
      .advanced-chart-scroll { scrollbar-gutter: stable; }
      .rank-percentile-grid > div { height: 100%; box-sizing: border-box; }
      @media (max-width: 640px) {
        .rank-percentile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }
    `}</style>
    <section aria-label="Additional performance comparisons" style={{ marginTop: 24, marginBottom: 22 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: isMobile ? 21 : 24, letterSpacing: '-0.03em' }}>Advanced Performance Lab</h2>
        <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55 }}></p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'stretch' }}>
        <AddedAnalyticsCard title="What-If Lab" description="Explore hypothetical changes to your accuracy without changing saved results." isMobile={isMobile} accent="#7c3aed" compact>
          <WhatIfLab history={attended} />
        </AddedAnalyticsCard>
        <AddedAnalyticsCard title="Week-by-Week Accuracy Comparison" description="Two bars compare accuracy across equivalent periods of this week and last week, with an arrow showing the change." isMobile={isMobile} accent="#2563eb">
          <WeeklyPerformanceComparison history={attended} />
        </AddedAnalyticsCard>
        <AddedAnalyticsCard title="Rank Percentile Distribution" description="Radial progress rings compare your relative standing across sessions." isMobile={isMobile} accent="#0d9488">
          <RankPercentileDistribution history={attended} />
        </AddedAnalyticsCard>
        <AddedAnalyticsCard title="Average Response Time per Session" description="Same response-time heatmap, showing the latest eight recorded sessions." isMobile={isMobile} accent="#0d9488">
          <AverageResponseTimeChart history={attended} />
        </AddedAnalyticsCard>
        <AddedAnalyticsCard title="Session Consistency Gauge" description="Measure how steadily your recorded session scores perform over time." isMobile={isMobile} accent="#16a34a">
          <SessionConsistencyGauge history={attended} />
        </AddedAnalyticsCard>
        <AddedAnalyticsCard title="Session-to-Session Score Change" description="See how your score rises or falls compared with the previous attended session." isMobile={isMobile} accent="#2563eb">
          <SessionToSessionScoreChangeChart history={attended} />
        </AddedAnalyticsCard>
      </div>
    </section>
  </>
}

function StudentPerformancePage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchPerformance = useCallback(async (silent = false) => {
    if (!token || !user?._id) return
    if (!silent) setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/responses/performance/student/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load performance')
      setData(payload)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch student performance:', err)
      setError(err.message || 'Failed to load performance')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [token, user?._id])

  useEffect(() => {
    fetchPerformance()
  }, [fetchPerformance])

  // A completed session changes the journey state only after it ends. A modest refresh interval lets
  // an already-open dashboard pick up a newly completed session without touching the live room flow.
  useEffect(() => {
    if (!token) return undefined
    const id = window.setInterval(() => fetchPerformance(true), 60000)
    return () => window.clearInterval(id)
  }, [token, fetchPerformance])

  const summary = data?.summary
  const history = data?.history || []
  const hasHistory = history.length > 0
  const chartTrends = data?.trends || { score: [], accuracy: [], rank: [] }
  const answeringPattern = data?.answeringPattern || { averageResponseTime: null, totalResponses: 0, questionTypes: [] }
  const attendedHistory = history.filter(item => item.attended)
  const chartHistoryCount = attendedHistory.length
  const recent = summary?.recentComparison
  return (
    <>
      <style>{`
        /* ============================================================
           SPANDAN PERFORMANCE JOURNEY — VISUAL SYSTEM
           Presentation-only layer. No data, formulas, fetches or
           navigation logic are changed by this stylesheet.
           ============================================================ */
        @keyframes pjPageIn {
          from { opacity: 0; transform: translateY(18px) scale(.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pjHeaderGlow {
          0%, 100% { transform: translate3d(-8%, -4%, 0) scale(1); opacity: .45; }
          50% { transform: translate3d(8%, 4%, 0) scale(1.08); opacity: .72; }
        }

        @keyframes pjHeaderShine {
          0%, 48% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          55% { opacity: .55; }
          76%, 100% { transform: translateX(155%) skewX(-18deg); opacity: 0; }
        }

        @keyframes pjCardIn {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pjMetricPop {
          0% { opacity: 0; transform: translateY(18px) scale(.96); }
          70% { transform: translateY(-2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pjFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-5px) rotate(1.5deg); }
        }

        @keyframes pjPulseRing {
          0% { box-shadow: 0 0 0 0 rgba(99,102,241,.25); }
          70% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }

        @keyframes pjDrawTrend {
          from { stroke-dashoffset: 1; opacity: .15; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }

        @keyframes pjPointIn {
          0% { transform: scale(.35); opacity: 0; }
          65% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes pjSpin { to { transform: rotate(360deg); } }

        @keyframes pjShimmer {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }

        @keyframes pjBadgePop {
          from { opacity: 0; transform: translateY(5px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .performance-shell {
          --pj-brand: var(--accent, #4f46e5);
          --pj-brand-2: #7c3aed;
          --pj-cyan: #06b6d4;
          --pj-card: var(--bg-card, #ffffff);
          --pj-page: var(--bg-primary, #f6f8fc);
          --pj-soft: var(--bg-secondary, rgba(99,102,241,.055));
          --pj-border: var(--border-color, rgba(15,23,42,.08));
          --pj-muted: var(--text-secondary, #64748b);
          --pj-ink: var(--text-primary, #0f172a);
          /* glass surfaces derived from the app's card colour, so they follow light/dark automatically */
          --pj-glass-hi: color-mix(in srgb, var(--pj-card) 93%, transparent);
          --pj-glass-lo: color-mix(in srgb, var(--pj-card) 70%, transparent);
          --pj-glass-faint: color-mix(in srgb, var(--pj-card) 58%, transparent);
          --pj-edge: color-mix(in srgb, var(--pj-card), white 18%);
          position: relative;
          overflow-x: clip;
          background:
            radial-gradient(circle at 14% 10%, rgba(99,102,241,.08), transparent 26%),
            radial-gradient(circle at 90% 34%, rgba(6,182,212,.06), transparent 22%),
            var(--pj-page) !important;
          color: var(--pj-ink);
          animation: pjPageIn .7s cubic-bezier(.2,.75,.2,1) backwards;
        }

        .performance-shell::before,
        .performance-shell::after {
          content: '';
          position: fixed;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          filter: blur(70px);
          opacity: .12;
        }

        .performance-shell::before {
          top: 8%;
          right: -180px;
          background: #6366f1;
        }

        .performance-shell::after {
          bottom: -150px;
          left: 10%;
          background: #06b6d4;
        }

        .performance-shell > * { position: relative; z-index: 1; }

        .performance-header {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,.14);
          background: #192f59 !important;
          box-shadow: 0 16px 44px rgba(15,23,42,.18) !important;
        }

        .performance-header::before {
          content: '';
          position: absolute;
          width: 360px;
          height: 360px;
          top: -220px;
          right: 4%;
          border-radius: 50%;
          background: rgba(255,255,255,.13);
          filter: blur(12px);
          animation: pjHeaderGlow 8s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }

        .performance-header::after {
          content: '';
          position: absolute;
          top: -35%;
          bottom: -35%;
          left: -20%;
          width: 18%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          animation: pjHeaderShine 6.5s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }

        .performance-header h1 {
          text-shadow: 0 10px 28px rgba(0,0,0,.18);
          font-weight: 850 !important;
        }

        .performance-header p { letter-spacing: .01em; }

        .performance-header button,
        .performance-header [role='button'] {
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .performance-content {
          position: relative;
          z-index: 2;
        }

        .performance-content > * {
          animation: pjCardIn .65s cubic-bezier(.2,.75,.2,1) both;
        }

        .performance-content > *:nth-child(2) { animation-delay: .04s; }
        .performance-content > *:nth-child(3) { animation-delay: .08s; }
        .performance-content > *:nth-child(4) { animation-delay: .12s; }
        .performance-content > *:nth-child(5) { animation-delay: .16s; }
        .performance-content > *:nth-child(6) { animation-delay: .20s; }
        .performance-content > *:nth-child(7) { animation-delay: .24s; }

        .updated-label {
          padding: 8px 11px;
          width: fit-content;
          margin-left: auto;
          border: 1px solid var(--pj-border);
          border-radius: 999px;
          background: var(--pj-glass-faint);
          box-shadow: 0 8px 24px rgba(15,23,42,.045);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          animation: pjBadgePop .4s ease both;
        }

        /* ---- metric cards ---- */
        .performance-metric {
          position: relative;
          overflow: hidden;
          min-height: 126px;
          padding: 16px !important;
          border: 1px solid color-mix(in srgb, var(--pj-brand) 9%, var(--pj-border)) !important;
          border-radius: 24px !important;
          background:
            linear-gradient(145deg, var(--pj-glass-hi), var(--pj-glass-lo)) !important;
          box-shadow:
            0 10px 24px rgba(15,23,42,.055),
            inset 0 1px 0 var(--pj-edge) !important;
          animation: pjMetricPop .65s cubic-bezier(.2,.75,.2,1) both;
          transition:
            transform .35s cubic-bezier(.2,.75,.2,1),
            box-shadow .35s ease,
            border-color .3s ease,
            background .3s ease;
        }

        .performance-metric::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--pj-brand), var(--pj-brand-2), var(--pj-cyan));
          opacity: .82;
        }

        .performance-metric::after {
          content: '';
          position: absolute;
          width: 110px;
          height: 110px;
          right: -48px;
          bottom: -55px;
          border-radius: 50%;
          background: radial-gradient(circle, color-mix(in srgb, var(--pj-brand) 12%, transparent), transparent 68%);
          pointer-events: none;
          transition: transform .45s ease;
        }

        .performance-metric:hover {
          transform: translateY(-8px) scale(1.015);
          border-color: color-mix(in srgb, var(--pj-brand) 34%, var(--pj-border)) !important;
          box-shadow:
            0 20px 44px rgba(15,23,42,.12),
            0 0 0 1px color-mix(in srgb, var(--pj-brand) 7%, transparent),
            inset 0 1px 0 var(--pj-edge) !important;
        }

        .performance-metric:hover::after { transform: scale(1.35); }

        .performance-metric > div:nth-child(2) {
          font-size: 27px !important;
          letter-spacing: -.04em !important;
        }

        .metric-icon {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(99,102,241,.13), rgba(6,182,212,.10));
          border: 1px solid rgba(99,102,241,.12);
          box-shadow: 0 8px 18px rgba(99,102,241,.10);
          animation: pjFloat 4.2s ease-in-out infinite;
          transition: transform .3s ease, box-shadow .3s ease;
        }

        .performance-metric:hover .metric-icon {
          transform: translateY(-2px) rotate(5deg) scale(1.06);
          box-shadow: 0 12px 24px rgba(99,102,241,.16);
        }

        /* ---- chart / info cards ---- */
        .chart-card,
        .change-card,
        .highlight-card {
          position: relative;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--pj-brand) 7%, var(--pj-border)) !important;
          border-radius: 26px !important;
          background:
            linear-gradient(145deg, var(--pj-glass-hi), var(--pj-glass-lo)) !important;
          box-shadow:
            0 12px 30px rgba(15,23,42,.06),
            inset 0 1px 0 var(--pj-edge) !important;
          transition:
            transform .36s cubic-bezier(.2,.75,.2,1),
            box-shadow .36s ease,
            border-color .3s ease;
        }

        .chart-card::before,
        .change-card::before,
        .highlight-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 100% 0%, rgba(99,102,241,.08), transparent 34%);
          opacity: 0;
          transition: opacity .35s ease;
          pointer-events: none;
        }

        .chart-card:hover,
        .change-card:hover,
        .highlight-card:hover {
          transform: translateY(-6px);
          border-color: color-mix(in srgb, var(--pj-brand) 20%, var(--pj-border)) !important;
          box-shadow:
            0 22px 48px rgba(15,23,42,.11),
            0 0 0 1px rgba(99,102,241,.03),
            inset 0 1px 0 var(--pj-edge) !important;
        }

        .chart-card:hover::before,
        .change-card:hover::before,
        .highlight-card:hover::before { opacity: 1; }

        .chart-card h2,
        .change-card h2,
        .highlight-card h2 {
          position: relative;
          z-index: 1;
          font-weight: 820 !important;
          letter-spacing: -.025em;
        }

        .chart-card p,
        .change-card p { position: relative; z-index: 1; }

        .insight-list-card {
          cursor: default;
        }

        .insight-item {
          position: relative;
          transition: background .22s ease, transform .22s ease, box-shadow .22s ease;
        }

        .insight-item:hover,
        .insight-item:focus-visible {
          background: color-mix(in srgb, var(--pj-brand) 7%, transparent);
          transform: translateX(3px);
          box-shadow: inset 3px 0 0 var(--pj-brand);
        }

        .insight-item:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--pj-brand) 55%, transparent);
        }

        @media (prefers-reduced-motion: reduce) {
          .insight-item { transition: none !important; }
        }

        /* ---- trend visualization ---- */
        .chart-card > div > svg {
          border-radius: 18px;
          padding: 6px;
          background:
            linear-gradient(rgba(99,102,241,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,.045) 1px, transparent 1px);
          background-size: 40px 40px;
          box-sizing: border-box;
          filter: drop-shadow(0 9px 18px rgba(79,70,229,.08));
        }

        .trend-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: pjDrawTrend 1.45s cubic-bezier(.22,.61,.36,1) .12s forwards;
          vector-effect: non-scaling-stroke;
          filter: drop-shadow(0 4px 7px rgba(79,70,229,.22));
        }

        .trend-point {
          transform-box: fill-box;
          transform-origin: center;
          animation: pjPointIn .5s cubic-bezier(.2,.8,.2,1) both;
          transition: r .25s ease, stroke-width .25s ease, filter .25s ease;
          cursor: crosshair;
        }

        .trend-point:hover {
          r: 7 !important;
          stroke-width: 4;
          filter: drop-shadow(0 0 9px rgba(79,70,229,.55));
        }

        /* ---- recent change rows ---- */
        .change-card > div:last-child > div {
          transition: transform .25s ease, background .25s ease, box-shadow .25s ease;
        }

        .change-card > div:last-child > div:hover {
          transform: translateX(5px);
          background: rgba(99,102,241,.075) !important;
          box-shadow: 0 8px 18px rgba(15,23,42,.055);
        }

        /* ---- highlight cards ---- */
        .highlight-card > div:first-child {
          width: 5px !important;
          border-radius: 999px;
          box-shadow: 0 0 18px rgba(99,102,241,.25);
        }

        .highlight-card span {
          transition: transform .2s ease, background .2s ease, box-shadow .2s ease;
        }

        .highlight-card span:hover {
          transform: translateY(-2px);
          background: rgba(99,102,241,.09) !important;
          box-shadow: 0 8px 16px rgba(15,23,42,.05);
        }

        /* ---- compact stat cards ---- */
        .performance-content > div > div > div[style*='borderRadius: 18px'] {
          transition: transform .3s cubic-bezier(.2,.75,.2,1), box-shadow .3s ease, border-color .3s ease;
        }

        .performance-content > div > div > div[style*='borderRadius: 18px']:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 32px rgba(15,23,42,.09) !important;
          border-color: rgba(99,102,241,.22) !important;
        }

        /* ---- table ---- */
        .performance-content table {
          border-spacing: 0;
        }

        .performance-content thead tr {
          background: linear-gradient(90deg, rgba(99,102,241,.07), rgba(6,182,212,.045)) !important;
        }

        .performance-content th {
          position: sticky;
          top: 0;
          z-index: 1;
          font-weight: 800 !important;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .session-row {
          position: relative;
          transition: background .25s ease, transform .25s ease, box-shadow .25s ease;
        }

        .session-row:hover {
          background: linear-gradient(90deg, rgba(99,102,241,.065), rgba(6,182,212,.035)) !important;
          box-shadow: inset 4px 0 0 var(--pj-brand), 0 8px 18px rgba(15,23,42,.035);
        }

        .session-row:active {
          transform: scale(.997);
        }

        .session-row td {
          transition: color .2s ease;
        }

        .session-row:hover td:first-child {
          color: var(--pj-brand) !important;
        }

        /* ---- controls ---- */
        .header-action-btn,
        .empty-join-btn,
        .performance-content button {
          position: relative;
          overflow: hidden;
          transform: translateZ(0);
        }

        .header-action-btn::before,
        .empty-join-btn::before,
        .performance-content button::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: -60%;
          width: 34%;
          transform: skewX(-18deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.30), transparent);
          transition: transform .6s ease;
          pointer-events: none;
        }

        .header-action-btn:hover::before,
        .empty-join-btn:hover::before,
        .performance-content button:hover::before {
          transform: translateX(390%) skewX(-18deg);
        }

        .header-action-btn {
          transition: transform .22s cubic-bezier(.2,.75,.2,1), background .22s ease, border-color .22s ease, box-shadow .22s ease;
        }

        .header-action-btn:not(:disabled):hover {
          transform: translateY(-3px) scale(1.02);
          background: rgba(255,255,255,.17) !important;
          border-color: rgba(255,255,255,.50) !important;
          box-shadow: 0 10px 26px rgba(0,0,0,.14);
        }

        .header-action-btn:not(:disabled):active {
          transform: translateY(0) scale(.98);
        }

        .empty-join-btn {
          box-shadow: 0 14px 30px rgba(79,70,229,.22);
          transition: transform .28s cubic-bezier(.2,.75,.2,1), box-shadow .28s ease, filter .28s ease;
          animation: pjPulseRing 2.8s infinite;
        }

        .empty-join-btn:hover {
          transform: translateY(-4px) scale(1.025);
          filter: saturate(1.07) brightness(1.04);
          box-shadow: 0 20px 36px rgba(79,70,229,.30);
        }

        .empty-join-btn:active {
          transform: translateY(-1px) scale(.985);
        }

        /* ---- empty state ---- */
        .journey-empty {
          position: relative;
          overflow: hidden;
          min-height: 380px;
          display: grid;
          place-items: center;
          align-content: center;
          background:
            radial-gradient(circle at 16% 20%, rgba(99,102,241,.12), transparent 25%),
            radial-gradient(circle at 82% 80%, rgba(6,182,212,.10), transparent 24%),
            linear-gradient(145deg, var(--pj-glass-hi), var(--pj-glass-lo)) !important;
          border: 1px solid rgba(99,102,241,.12) !important;
          box-shadow: 0 24px 54px rgba(15,23,42,.08), inset 0 1px 0 var(--pj-edge) !important;
        }

        .journey-empty::before,
        .journey-empty::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(99,102,241,.10);
          pointer-events: none;
        }

        .journey-empty::before {
          width: 230px;
          height: 230px;
          top: -100px;
          left: -60px;
          box-shadow: 0 0 0 30px rgba(99,102,241,.025), 0 0 0 60px rgba(99,102,241,.018);
        }

        .journey-empty::after {
          width: 270px;
          height: 270px;
          right: -100px;
          bottom: -140px;
          box-shadow: 0 0 0 35px rgba(6,182,212,.022), 0 0 0 70px rgba(6,182,212,.015);
        }

        .empty-icon {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 78px;
          height: 78px;
          margin-bottom: 18px !important;
          border-radius: 24px;
          background: linear-gradient(145deg, rgba(99,102,241,.13), rgba(6,182,212,.10));
          border: 1px solid rgba(99,102,241,.12);
          box-shadow: 0 16px 32px rgba(99,102,241,.12);
          animation: pjFloat 4s ease-in-out infinite;
        }

        .journey-empty h2,
        .journey-empty p,
        .journey-empty button {
          position: relative;
          z-index: 1;
        }

        /* ---- loading ---- */
        .performance-loading {
          min-height: 320px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 14px;
          color: var(--pj-muted);
          font-size: 14px;
        }

        .loading-orbit {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 3px solid rgba(99,102,241,.11);
          border-top-color: var(--pj-brand);
          border-right-color: #06b6d4;
          animation: pjSpin .9s linear infinite;
          box-shadow: 0 0 0 10px rgba(99,102,241,.035);
        }

        /* ---- responsive touch feedback ---- */
        @media (max-width: 760px) {
          .performance-metric:hover,
          .chart-card:hover,
          .change-card:hover,
          .highlight-card:hover {
            transform: translateY(-3px);
          }

          .updated-label { margin-bottom: 12px; }
          .journey-empty { min-height: 340px; padding: 28px !important; }
        }

        @media (hover: none) {
          .performance-metric,
          .chart-card,
          .change-card,
          .highlight-card,
          .session-row,
          .header-action-btn,
          .empty-join-btn {
            transition-duration: .15s;
          }

          .performance-metric:active { transform: scale(.985); }
          .chart-card:active,
          .change-card:active,
          .highlight-card:active { transform: scale(.992); }
        }

        @media (prefers-reduced-motion: reduce) {
          .performance-shell,
          .performance-content > *,
          .performance-metric,
          .metric-icon,
          .trend-line,
          .trend-point,
          .performance-header::before,
          .performance-header::after,
          .loading-orbit,
          .journey-empty,
          .empty-icon,
          .empty-join-btn,
          .updated-label {
            animation: none !important;
          }

          .performance-metric,
          .chart-card,
          .change-card,
          .highlight-card,
          .session-row,
          .header-action-btn,
          .empty-join-btn {
            transition: none !important;
          }
        }

        .session-row:hover { background: color-mix(in srgb, var(--pj-brand) 5%, var(--pj-card)); }
        .session-view-button {
          border: 1px solid color-mix(in srgb, var(--pj-brand) 22%, var(--pj-border));
          color: var(--pj-brand); background: color-mix(in srgb, var(--pj-brand) 7%, var(--pj-card));
          border-radius: 9px; padding: 7px 11px; font-weight: 750; font-size: 12px; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px; transition: transform .2s ease, background .2s ease;
        }
        .session-view-button:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--pj-brand) 13%, var(--pj-card)); }
        .pagination-button {
          border: 1px solid var(--pj-border); border-radius: 10px; padding: 8px 12px;
          background: var(--pj-glass-hi); color: var(--pj-ink); font-size: 12px; font-weight: 750; cursor: pointer;
        }
        .pagination-button:disabled { opacity: .42; cursor: not-allowed; }
        .streak-grid span { transition: transform .15s ease, outline-color .15s ease; }
        .streak-grid span:hover { transform: scale(1.2); outline: 1px solid var(--pj-brand); z-index: 2; }
        @media (max-width: 900px) {
          .streak-grid { grid-template-columns: repeat(14, minmax(7px, 1fr)) !important; }
        }
        @media (max-width: 520px) {
          .streak-grid { grid-template-columns: repeat(7, minmax(10px, 1fr)) !important; }
        }
      `}</style>

      <div className="performance-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}>
        <Sidebar user={user} />
        <main style={{ flex: 1, minWidth: 0, marginLeft: 'var(--sidebar-width, 240px)' }}>
          <header className="performance-header" style={{ background: 'var(--header-bg)', color: '#fff', padding: isMobile ? '20px 16px 22px' : '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ paddingLeft: isMobile ? 48 : 0, minWidth: 0 }}>
                <div style={{ fontSize: 12, opacity: 0.78, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>Student Analytics</div>
                <h1 style={{ margin: '7px 0 0', fontSize: isMobile ? 23 : 30, lineHeight: 1.15, letterSpacing: '-0.035em' }}>My Growth</h1>
                <p style={{ margin: '8px 0 0', opacity: 0.86, fontSize: 14 }}>Track your progress and keep improving with every completed live session.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="header-action-btn" onClick={() => fetchPerformance()} disabled={isLoading} style={{ border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: 10, padding: '9px 12px', fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer' }}>{isLoading ? 'Refreshing…' : '↻ Refresh'}</button>
                <ThemeToggle />
                <ProfileDropdown />
              </div>
            </div>
          </header>

          <section className="performance-content" style={{ padding: isMobile ? '16px 14px 24px' : '24px 24px 32px', maxWidth: 1500, margin: '0 auto' }}>
            {lastUpdated && !error && <div className="updated-label" style={{ marginBottom: 14, display: 'flex', justifyContent: 'flex-end', color: 'var(--text-secondary)', fontSize: 12 }}>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}

            {error && <div style={{ marginBottom: 16, padding: '13px 15px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.08)', color: 'var(--text-primary)', fontSize: 14 }}><strong>Couldn’t load your performance.</strong> {error}<button onClick={() => fetchPerformance()} style={{ marginLeft: 10, border: 'none', background: 'transparent', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Try again</button></div>}

            {isLoading && !data ? (
              <div className="performance-loading" aria-live="polite"><div className="loading-orbit" aria-hidden="true" /><div>Loading your performance journey…</div></div>
            ) : !hasHistory ? (
              <div className="journey-empty-wrap"><EmptyState onJoin={() => navigate('/student/join-room')} /></div>
            ) : (
              <>
                {/* Primary KPIs: the rank and session-attendance cards were replaced by question metrics. */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                  <PerformanceMetric label="Overall Accuracy" value={`${summary?.overallAccuracy ?? 0}%`} caption="Correct answers out of attempted" icon="🎯" />
                  <PerformanceMetric label="Average Score" value={`${summary?.averageScore ?? 0}%`} caption={`Across ${summary?.totalSessions ?? chartHistoryCount} attended sessions`} icon="⭐" />
                  <PerformanceMetric label="Questions Attempted" value={summary?.attemptedQuestions ?? 0} caption="Answers submitted" icon="📝" />
                  <PerformanceMetric label="Correct Answers" value={summary?.correctAnswers ?? 0} caption="Correctly answered" icon="✅" />
                  <PerformanceMetric label="Incorrect Answers" value={summary?.incorrectAnswers ?? 0} caption="Answers to review" icon="❌" />
                  <PerformanceMetric label="Missed Questions" value={summary?.missedQuestions ?? 0} caption="Questions left unanswered" icon="⏭️" />
                </div>

                <RecentChangesSection history={attendedHistory} recent={recent} isMobile={isMobile} />

                <AttendanceStreak history={history} isMobile={isMobile} />


                {/* Score Journey and the data-driven accuracy milestone share a balanced 50/50 row. */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 20, alignItems: 'stretch' }}>
                  <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow-md)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 44, height: 44, borderRadius: 14, background: 'rgba(37,99,235,.10)', fontSize: 23 }}>📈</span>
                        <div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 19 }}>Score Journey</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Your score across each completed session.</p></div>
                      </div>
                    </div>
                    <div style={{ color: '#2563eb' }}><TrendLine points={chartTrends.score} yLabel="Score (%)" /></div>
                  </div>

                  <NextAccuracyMilestone history={attendedHistory} isMobile={isMobile} />

                  <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow-md)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 42, height: 42, borderRadius: 13, background: 'rgba(139,92,246,.12)', fontSize: 22 }}>🎯</span>
                        <div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Accuracy Trend</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>Session accuracy with an overall average reference.</p></div>
                      </div>
                    </div>
                    <AccuracyBarChart points={chartTrends.accuracy} />
                  </div>

                  <div className="chart-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 22, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow-md)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 42, height: 42, borderRadius: 13, background: 'rgba(234,88,12,.12)', fontSize: 22 }}>🏆</span>
                        <div><h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>Rank Journey</h2><p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>Rank movement across sessions; a smaller rank number is better.</p></div>
                      </div>
                    </div>
                    <RankJourneyChart points={chartTrends.rank} />
                  </div>
                </div>

                <PerformanceHighlights best={summary?.bestPerformance} weakest={summary?.weakestPerformance} history={attendedHistory} isMobile={isMobile} navigate={navigate} />

                <AnsweringPatternSection summary={summary} history={history} answeringPattern={answeringPattern} isMobile={isMobile} />

                <AddedAnalyticsSection history={attendedHistory} isMobile={isMobile} />


              </>
            )}
          </section>
        </main>
      </div>
    </>
  )
}

export default StudentPerformancePage