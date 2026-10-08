import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Chatbot from './Chatbot.jsx'
import './App.css'

const api = axios.create({ withCredentials: false })
api.interceptors.request.use((config) => {
  if (jwtToken) {
    config.headers.Authorization = `Bearer ${jwtToken}`
  }
  return config
})
const symptomOptions = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Acne', 'Tenderness', 'Cravings']
const mealPlan = [
  { day: 'Monday', breakfast: 'Warm oats, pear & pumpkin seeds', lunch: 'Lentil, cucumber & herb bowl', dinner: 'Roasted vegetables with brown rice', vegetarian: true },
  { day: 'Tuesday', breakfast: 'Eggs or tofu with spinach toast', lunch: 'Chickpea and tomato wrap', dinner: 'Bean chili with avocado', vegetarian: true },
  { day: 'Wednesday', breakfast: 'Plain yogurt or soy yogurt with berries', lunch: 'Vegetable soup with whole-grain bread', dinner: 'Baked fish or tofu with greens', vegetarian: false },
  { day: 'Thursday', breakfast: 'Peanut butter banana toast', lunch: 'Quinoa, edamame & crunchy vegetables', dinner: 'Lentil pasta with tomato and greens', vegetarian: true },
  { day: 'Friday', breakfast: 'Overnight oats with chia and apple', lunch: 'Hummus and roasted vegetable plate', dinner: 'Chicken or tempeh with vegetables', vegetarian: false },
  { day: 'Saturday', breakfast: 'Vegetable omelet or chickpea scramble', lunch: 'Brown rice bowl with beans and salsa', dinner: 'Coconut chickpea curry with vegetables', vegetarian: true },
  { day: 'Sunday', breakfast: 'Cottage cheese or tofu with fruit', lunch: 'Whole-grain pita with falafel and salad', dinner: 'Mushroom, barley & vegetable stew', vegetarian: true },
]

let jwtToken = localStorage.getItem('herhealth-jwt') || ''

function setJwtToken(token) {
  jwtToken = token
  if (token) {
    localStorage.setItem('herhealth-jwt', token)
  } else {
    localStorage.removeItem('herhealth-jwt')
  }
}

function todayString() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function dateDifference(start, end) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000)
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return 'Not recorded'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, options)
}

function getErrorMessage(error, fallback) {
  const response = error.response?.data
  return response?.message || (typeof response === 'string' ? response : fallback)
}

function emptyWellness(date = todayString()) {
  return { entryDate: date, mood: 'okay', sleepHours: '8', waterMl: '1500', exerciseMinutes: '0', symptoms: [], note: '' }
}

function estimateCycle(cycles) {
  const starts = [...new Set(cycles.map((cycle) => cycle.startDate))].sort().reverse()
  if (!starts.length) return null
  const intervals = starts.slice(0, 5).slice(0, -1).map((date, index) => dateDifference(starts[index + 1], date))
  const length = intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : 28
  const today = todayString()
  return {
    cycleDay: dateDifference(starts[0], today) + 1,
    nextStart: addDays(starts[0], length),
    averageLength: length,
    basedOnHistory: intervals.length > 0,
  }
}

function App() {
  const [account, setAccount] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authError, setAuthError] = useState('')
  const [cycles, setCycles] = useState([])
  const [entries, setEntries] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const activeView = location.pathname.replace(/^\//, '') || 'overview'

  useEffect(() => {
    let active = true
    async function restoreSession() {
      try {
        const response = await api.get('/api/auth/me')
        if (active) setAccount(response.data)
      } catch {
        if (active) {
          setJwtToken('')
          setAccount(null)
        }
      } finally {
        if (active) setCheckingSession(false)
      }
    }
    if (jwtToken) {
      restoreSession()
    } else {
      setCheckingSession(false)
    }
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!account) return
    let active = true
    async function loadData() {
      setLoadingData(true)
      setDashboardError('')
      try {
        const [cycleResponse, wellnessResponse, appointmentResponse] = await Promise.all([
          api.get('/api/cycles'),
          api.get('/api/wellness'),
          api.get('/api/appointments'),
        ])
        if (active) {
          setCycles(cycleResponse.data)
          setEntries(wellnessResponse.data)
          setAppointments(appointmentResponse.data)
        }
      } catch (error) {
        if (active) setDashboardError(getErrorMessage(error, 'Could not load your saved wellness data.'))
      } finally {
        if (active) setLoadingData(false)
      }
    }
    loadData()
    return () => { active = false }
  }, [account])

  async function register(payload) {
    await api.post('/api/users/register', payload)
  }

  async function login(email, password) {
    const body = new URLSearchParams({ email, password })
    const response = await api.post('/api/auth/login', body)
    setJwtToken(response.data.token)
    const accountResponse = await api.get('/api/auth/me')
    setAuthError('')
    setAccount(accountResponse.data)
  }

  async function logout() {
    setJwtToken('')
    setAccount(null)
    setCycles([])
    setEntries([])
  }

  if (checkingSession) return <div className="loading-screen">Opening your wellness space…</div>
  if (!account) {
    return <AuthScreen onLogin={login} onRegister={register} serverError={authError} setServerError={setAuthError} />
  }

  const estimate = estimateCycle(cycles)
  const todayEntry = entries.find((entry) => entry.entryDate === todayString())
  const recentEntries = [...entries].sort((left, right) => left.entryDate.localeCompare(right.entryDate)).slice(-7)

  function navigateTo(view) {
    const path = view === 'overview' ? '/' : `/${view}`
    navigate(path)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand app-brand" onClick={() => navigateTo('overview')}>
          <span className="brand-mark" aria-hidden="true">H</span><span>HerHealth</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {[
            ['overview', 'Overview'],
            ['cycle', 'Cycle'],
            ['daily', 'Daily log'],
            ['appointments', 'Appointments'],
            ['meals', 'Meal ideas'],
          ].map(([view, label]) => (
            <button key={view} type="button" className={activeView === view ? 'nav-button active' : 'nav-button'} onClick={() => navigateTo(view)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="account-menu">
          <span className="account-name">{account.name}</span>
          <button type="button" className="quiet-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-content">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<><p className="visually-hidden">Overview page</p>{dashboardError && <p className="error-message page-error" role="alert">{dashboardError}</p>}{loadingData && <p className="loading-note">Loading your saved entries…</p>}<OverviewView account={account} estimate={estimate} todayEntry={todayEntry} entries={recentEntries} onNavigate={navigateTo} /></>} />
          <Route path="/cycle" element={<><p className="visually-hidden">Cycle page</p><CycleView cycles={cycles} estimate={estimate} onSave={(cycle) => setCycles((previous) => [cycle, ...previous.filter((item) => item.id !== cycle.id)])} /></>} />
          <Route path="/daily" element={<><p className="visually-hidden">Daily log page</p>{loadingData && <p className="loading-note">Loading your saved entries…</p>}<DailyView entries={entries} onSave={(entry) => setEntries((previous) => [entry, ...previous.filter((item) => item.entryDate !== entry.entryDate)])} /></>} />
          <Route path="/appointments" element={<><p className="visually-hidden">Appointments page</p><AppointmentsView appointments={appointments} onSave={(appointment) => setAppointments((previous) => [appointment, ...previous.filter((item) => item.id !== appointment.id)])} onDelete={(id) => setAppointments((previous) => previous.filter((item) => item.id !== id))} /></>} />
          <Route path="/meals" element={<><p className="visually-hidden">Meal ideas page</p><MealsView /></>} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
        <footer className="app-footer">HerHealth is for personal wellness tracking and does not provide medical diagnosis or treatment.</footer>
        <Chatbot account={account} cycleEstimate={estimate} appointments={appointments} />
      </main>
    </div>
  )
}

function AuthScreen({ onLogin, onRegister, serverError, setServerError }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isRegister = mode === 'register'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setServerError('')
    setSubmitting(true)
    try {
      if (isRegister) {
        await onRegister(form)
        setMode('login')
        setForm((previous) => ({ ...previous, password: '' }))
        setMessage('Account created. Sign in to continue.')
      } else {
        await onLogin(form.email, form.password)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, isRegister ? 'Could not create your account.' : 'Could not sign in.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="signup-layout">
      <aside className="welcome-panel">
        <a className="brand" href="/" aria-label="HerHealth home">
          <span className="brand-mark" aria-hidden="true">H</span><span>HerHealth</span>
        </a>
        <div className="welcome-copy">
          <p className="eyebrow">A little more in tune</p>
          <h1>Your health,<br />on your terms.</h1>
          <p className="welcome-note">Make space for the care you deserve.</p>
        </div>
        <span className="panel-index" aria-hidden="true">01 / YOUR WELLBEING</span>
      </aside>

      <section className="form-panel" aria-labelledby="form-title">
        <div className="form-wrap">
          <p className="eyebrow form-eyebrow">WELCOME TO HERHEALTH</p>
          <h2 id="form-title">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
          <p className="form-intro">{isRegister ? 'Start with the basics. You can update your details later.' : 'Sign in to see your personal wellness dashboard.'}</p>

          <form className="signup-form" onSubmit={submit}>
            {isRegister && <>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </>}
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 8 : undefined} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            {isRegister && <p className="field-hint">Use at least 8 characters.</p>}
            {(error || serverError) && <p className="error-message" role="alert">{error || serverError}</p>}
            {message && <p className="success-inline" role="status">{message}</p>}
            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to HerHealth?'}{' '}
            <button type="button" onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); setMessage('') }}>
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </p>
          <p className="privacy-note">Your personal details stay private and secure.</p>
        </div>
      </section>
    </main>
  )
}

function OverviewView({ account, estimate, todayEntry, entries, onNavigate }) {
  return (
    <>
      <div className="page-heading">
        <div><p className="eyebrow form-eyebrow">YOUR WELLNESS, AT A GLANCE</p><h1>Good to see you, {account.name.split(' ')[0]}.</h1><p>Small notes can help you notice your own patterns over time.</p></div>
        <button type="button" className="submit-button heading-action" onClick={() => onNavigate('daily')}>Log today <span aria-hidden="true">+</span></button>
      </div>
      <section className="overview-grid">
        <article className="cycle-feature">
          <p className="card-kicker">CYCLE SNAPSHOT</p>
          {estimate ? <>
            <p className="cycle-day">Day {estimate.cycleDay}</p>
            <p className="feature-description">in your current tracked cycle</p>
            <div className="feature-divider" />
            <p className="feature-label">Estimated next period</p>
            <p className="feature-date">{formatDate(estimate.nextStart, { month: 'long', day: 'numeric' })}</p>
            <p className="estimate-note">{estimate.basedOnHistory ? `Based on your logged cycles (${estimate.averageLength}-day average).` : 'Initial estimate only. Log more cycles to see your personal average.'}</p>
          </> : <>
            <p className="cycle-day cycle-empty">Start tracking</p>
            <p className="feature-description">Add a period start date to see your cycle day.</p>
            <button type="button" className="text-link light-link" onClick={() => onNavigate('cycle')}>Add a cycle <span aria-hidden="true">→</span></button>
          </>}
        </article>

        <article className="summary-panel">
          <div className="section-title-row"><div><p className="card-kicker">TODAY</p><h2>Daily check-in</h2></div><button type="button" className="text-link" onClick={() => onNavigate('daily')}>{todayEntry ? 'Edit log' : 'Add log'} <span aria-hidden="true">→</span></button></div>
          {todayEntry ? <div className="today-metrics">
            <Metric label="Mood" value={todayEntry.mood} />
            <Metric label="Sleep" value={`${todayEntry.sleepHours} h`} />
            <Metric label="Water" value={`${todayEntry.waterMl} ml`} />
            <Metric label="Movement" value={`${todayEntry.exerciseMinutes} min`} />
            <p className="symptom-summary">{todayEntry.symptoms?.length ? `Symptoms: ${todayEntry.symptoms.join(', ')}` : 'No symptoms recorded today.'}</p>
          </div> : <p className="empty-copy">Nothing logged yet. Add a quick check-in whenever you’re ready.</p>}
        </article>

        <article className="chart-panel">
          <div className="section-title-row"><div><p className="card-kicker">RECENT HISTORY</p><h2>Sleep, hours</h2></div><button type="button" className="text-link" onClick={() => onNavigate('daily')}>View log <span aria-hidden="true">→</span></button></div>
          {entries.length ? <div className="chart-container"><ResponsiveContainer width="100%" height={220}>
            <LineChart data={entries} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#e4e8df" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="entryDate" tickFormatter={(date) => date.slice(5)} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 12]} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(date) => formatDate(date, { month: 'long', day: 'numeric', year: 'numeric' })} />
              <Line type="monotone" dataKey="sleepHours" stroke="#a24f3e" strokeWidth={3} dot={{ r: 4, fill: '#a24f3e' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer></div> : <p className="empty-copy">Your sleep history will appear here after you log a few days.</p>}
        </article>

        <article className="meal-promo">
          <div><p className="card-kicker">FLEXIBLE FOOD IDEAS</p><h2>Plan a week that works for you.</h2><p>Browse balanced meal ideas and adjust them to your preferences.</p></div>
          <button type="button" className="text-link" onClick={() => onNavigate('meals')}>See meal ideas <span aria-hidden="true">→</span></button>
        </article>
      </section>
    </>
  )
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function wellnessFormValues(entry) {
  return {
    ...entry,
    sleepHours: String(entry.sleepHours),
    waterMl: String(entry.waterMl),
    exerciseMinutes: String(entry.exerciseMinutes),
    symptoms: entry.symptoms || [],
    note: entry.note || '',
  }
}

function CycleView({ cycles, estimate, onSave }) {
  const [form, setForm] = useState({ startDate: todayString(), endDate: '' })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveCycle(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = { startDate: form.startDate, endDate: form.endDate || null }
      const response = editingId
        ? await api.put(`/api/cycles/${editingId}`, payload)
        : await api.post('/api/cycles', payload)
      onSave(response.data)
      setForm({ startDate: todayString(), endDate: '' })
      setEditingId(null)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save this cycle. Check the dates and try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow form-eyebrow">CYCLE TRACKER</p><h1>Your cycle, over time.</h1><p>Record period dates to build a personal timeline.</p></div></div>
      <section className="tracking-grid">
        <article className="form-card">
          <p className="card-kicker">PERIOD DATES</p><h2>{editingId ? 'Add an end date' : 'Log a period'}</h2>
          <form className="data-form" onSubmit={saveCycle}>
            <label htmlFor="period-start">Period start date</label>
            <input id="period-start" type="date" max={todayString()} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required />
            <label htmlFor="period-end">Period end date <span className="optional-label">Optional</span></label>
            <input id="period-end" type="date" min={form.startDate} max={todayString()} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save dates' : 'Add period'}<span aria-hidden="true">→</span></button>
            {editingId && <button className="quiet-button cancel-button" type="button" onClick={() => { setEditingId(null); setForm({ startDate: todayString(), endDate: '' }) }}>Cancel edit</button>}
          </form>
        </article>
        <article className="estimate-card">
          <p className="card-kicker">CURRENT ESTIMATE</p>
          {estimate ? <>
            <p className="estimate-cycle-day">Cycle day {estimate.cycleDay}</p>
            <p>Next period estimate: <strong>{formatDate(estimate.nextStart, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></p>
            <p className="estimate-note">{estimate.basedOnHistory ? `Calculated from your recent logged cycle intervals (average ${estimate.averageLength} days).` : 'A general 28-day estimate is shown until you have logged more than one cycle.'}</p>
          </> : <p className="empty-copy">Log your first period to start a timeline. Predictions become more personal as you add records.</p>}
          <p className="medical-note">Cycle timing varies. These dates are estimates for personal tracking, not medical advice or contraception.</p>
        </article>
      </section>
      <section className="history-section">
        <div className="section-title-row"><div><p className="card-kicker">YOUR RECORDS</p><h2>Period history</h2></div><span className="record-count">{cycles.length} {cycles.length === 1 ? 'period' : 'periods'}</span></div>
        {cycles.length ? <div className="record-list">{[...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((cycle) => <div className="record-row" key={cycle.id}>
          <div><strong>{formatDate(cycle.startDate, { month: 'long', day: 'numeric', year: 'numeric' })}</strong><span>{cycle.endDate ? `Ended ${formatDate(cycle.endDate, { month: 'short', day: 'numeric' })}` : 'End date not recorded'}</span></div>
          <button type="button" className="quiet-button" onClick={() => { setEditingId(cycle.id); setForm({ startDate: cycle.startDate, endDate: cycle.endDate || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit dates</button>
        </div>)}</div> : <p className="empty-copy">No periods recorded yet.</p>}
      </section>
    </>
  )
}

function DailyView({ entries, onSave }) {
  const [form, setForm] = useState(() => wellnessFormValues(entries.find((entry) => entry.entryDate === todayString()) || emptyWellness()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function setValue(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  function selectDate(entryDate) {
    const existing = entries.find((entry) => entry.entryDate === entryDate)
    setForm(wellnessFormValues(existing || emptyWellness(entryDate)))
  }

  function toggleSymptom(symptom) {
    setForm((previous) => ({ ...previous, symptoms: previous.symptoms.includes(symptom) ? previous.symptoms.filter((item) => item !== symptom) : [...previous.symptoms, symptom] }))
  }

  async function saveEntry(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = { ...form, sleepHours: Number(form.sleepHours), waterMl: Number(form.waterMl), exerciseMinutes: Number(form.exerciseMinutes) }
      const response = await api.put('/api/wellness', payload)
      onSave(response.data)
      setForm(wellnessFormValues(response.data))
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save today’s log. Check the values and try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-heading"><div><p className="eyebrow form-eyebrow">DAILY WELLNESS</p><h1>Check in with yourself.</h1><p>Track what you notice. There’s no right or wrong entry.</p></div></div>
      <div className="tracking-grid">
        <form className="form-card data-form wellness-form" onSubmit={saveEntry}>
          <p className="card-kicker">YOUR DAILY NOTE</p><h2>How was today?</h2>
          <label htmlFor="log-date">Date</label>
          <input id="log-date" type="date" max={todayString()} value={form.entryDate} onChange={(event) => selectDate(event.target.value)} required />
          <label htmlFor="mood">Mood</label>
          <select id="mood" value={form.mood} onChange={(event) => setValue('mood', event.target.value)}>
            <option value="good">Good</option><option value="okay">Okay</option><option value="low">Low</option><option value="anxious">Anxious</option><option value="irritable">Irritable</option>
          </select>
          <div className="field-pair">
            <div><label htmlFor="sleep">Sleep (hours)</label><input id="sleep" type="number" min="0" max="24" step="0.5" value={form.sleepHours} onChange={(event) => setValue('sleepHours', event.target.value)} required /></div>
            <div><label htmlFor="water">Water (ml)</label><input id="water" type="number" min="0" max="10000" step="100" value={form.waterMl} onChange={(event) => setValue('waterMl', event.target.value)} required /></div>
          </div>
          <label htmlFor="exercise">Movement (minutes)</label>
          <input id="exercise" type="number" min="0" max="1440" step="5" value={form.exerciseMinutes} onChange={(event) => setValue('exerciseMinutes', event.target.value)} required />
          <fieldset className="symptom-fieldset"><legend>Symptoms <span className="optional-label">Optional</span></legend><div className="symptom-options">{symptomOptions.map((symptom) => <label key={symptom} className={form.symptoms.includes(symptom) ? 'symptom-option selected' : 'symptom-option'}><input type="checkbox" checked={form.symptoms.includes(symptom)} onChange={() => toggleSymptom(symptom)} />{symptom}</label>)}</div></fieldset>
          <label htmlFor="note">Private note <span className="optional-label">Optional</span></label>
          <textarea id="note" maxLength="1000" rows="3" value={form.note} onChange={(event) => setValue('note', event.target.value)} />
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save daily log'}<span aria-hidden="true">→</span></button>
        </form>
        <section className="history-section daily-history"><div className="section-title-row"><div><p className="card-kicker">RECENT ENTRIES</p><h2>Your notes</h2></div></div>
          {entries.length ? <div className="record-list">{entries.slice(0, 10).map((entry) => <button className="entry-row" type="button" key={entry.id} onClick={() => selectDate(entry.entryDate)}>
            <span><strong>{formatDate(entry.entryDate, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><small>{entry.mood} · {entry.sleepHours}h sleep</small></span><span className="entry-arrow" aria-hidden="true">→</span>
          </button>)}</div> : <p className="empty-copy">Saved entries will appear here.</p>}
        </section>
      </div>
    </>
  )
}

function AppointmentsView({ appointments, onSave, onDelete }) {
  const [form, setForm] = useState({ title: '', appointmentDate: todayString(), appointmentTime: '09:00', notes: '', status: 'scheduled' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  async function saveAppointment(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = { ...form, notes: form.notes.trim() }
      const response = editingId
        ? await api.put(`/api/appointments/${editingId}`, payload)
        : await api.post('/api/appointments', payload)
      onSave(response.data)
      setForm({ title: '', appointmentDate: todayString(), appointmentTime: '09:00', notes: '', status: 'scheduled' })
      setEditingId(null)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save the appointment.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteAppointment(id) {
    try {
      await api.delete(`/api/appointments/${id}`)
      onDelete(id)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not delete the appointment.'))
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow form-eyebrow">CARE APPOINTMENTS</p>
          <h1>Plan your next visit.</h1>
          <p>Keep your appointments and notes in one place.</p>
        </div>
      </div>
      <section className="tracking-grid">
        <form className="form-card data-form" onSubmit={saveAppointment}>
          <p className="card-kicker">{editingId ? 'UPDATE APPOINTMENT' : 'NEW APPOINTMENT'}</p>
          <h2>{editingId ? 'Edit appointment' : 'Schedule an appointment'}</h2>
          <label htmlFor="appointment-title">Title</label>
          <input id="appointment-title" type="text" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <div className="field-pair">
            <div>
              <label htmlFor="appointment-date">Date</label>
              <input id="appointment-date" type="date" min={todayString()} value={form.appointmentDate} onChange={(event) => setForm({ ...form, appointmentDate: event.target.value })} required />
            </div>
            <div>
              <label htmlFor="appointment-time">Time</label>
              <input id="appointment-time" type="time" value={form.appointmentTime} onChange={(event) => setForm({ ...form, appointmentTime: event.target.value })} required />
            </div>
          </div>
          <label htmlFor="appointment-status">Status</label>
          <select id="appointment-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <label htmlFor="appointment-notes">Notes</label>
          <textarea id="appointment-notes" rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update appointment' : 'Save appointment'}<span aria-hidden="true">→</span></button>
          {editingId && <button className="quiet-button cancel-button" type="button" onClick={() => { setEditingId(null); setForm({ title: '', appointmentDate: todayString(), appointmentTime: '09:00', notes: '', status: 'scheduled' }) }}>Cancel edit</button>}
        </form>
        <section className="history-section">
          <div className="section-title-row">
            <div><p className="card-kicker">YOUR SCHEDULE</p><h2>Appointments</h2></div>
            <span className="record-count">{appointments.length}</span>
          </div>
          {appointments.length ? <div className="record-list">{[...appointments].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate)).map((appointment) => <div className="record-row" key={appointment.id}>
            <div><strong>{appointment.title}</strong><span>{formatDate(appointment.appointmentDate, { month: 'short', day: 'numeric', year: 'numeric' })} at {appointment.appointmentTime}</span><small>{appointment.status}</small></div>
            <div className="appointment-actions">
              <button type="button" className="quiet-button" onClick={() => { setEditingId(appointment.id); setForm(appointment) }}>Edit</button>
              <button type="button" className="quiet-button" onClick={() => deleteAppointment(appointment.id)}>Delete</button>
            </div>
          </div>)}</div> : <p className="empty-copy">No appointments scheduled yet.</p>}
        </section>
      </section>
    </>
  )
}

function MealsView() {
  const [preference, setPreference] = useState('all')
  const meals = preference === 'vegetarian' ? mealPlan.map((day) => ({ ...day, dinner: day.vegetarian ? day.dinner : 'Lentil and roasted vegetable bowl' })) : mealPlan

  return (
    <>
      <div className="page-heading meals-heading"><div><p className="eyebrow form-eyebrow">FLEXIBLE FOOD IDEAS</p><h1>A plan you can make your own.</h1><p>Simple meal inspiration for balanced everyday eating.</p></div>
        <label className="preference-select">Show
          <select value={preference} onChange={(event) => setPreference(event.target.value)}><option value="all">All meal ideas</option><option value="vegetarian">Vegetarian ideas</option></select>
        </label>
      </div>
      <aside className="nutrition-note"><strong>About PCOD and food</strong><span>These are general meal ideas, not a treatment plan. Choose foods that suit your needs, culture, budget, and allergies; ask a qualified clinician or dietitian for personal advice.</span></aside>
      <section className="meal-week" aria-label="Seven-day meal ideas">
        {meals.map((day) => <article className="meal-day" key={day.day}>
          <h2>{day.day}</h2>
          <Meal name="Breakfast" text={day.breakfast} />
          <Meal name="Lunch" text={day.lunch} />
          <Meal name="Dinner" text={day.dinner} />
        </article>)}
      </section>
    </>
  )
}

function Meal({ name, text }) {
  return <div className="meal-item"><span className="meal-label">{name}</span><p>{text}</p></div>
}

export default App
