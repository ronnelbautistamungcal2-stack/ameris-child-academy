import { useState } from 'react'
import { useRouter } from 'next/router'

export default function NewActivity() {
  const [type, setType] = useState('MEAL')
  const [notes, setNotes] = useState('')
  const [childId, setChildId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const body = { childId, type, notes }
    const res = await fetch('/api/v1/activities', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    setLoading(false)
    if (res.ok) {
      router.push('/activities')
    } else {
      alert('Failed to create activity')
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', padding: 20 }}>
      <h2>New Activity</h2>
      <form onSubmit={submit}>
        <div style={{ marginBottom: 8 }}>
          <label>Child ID</label>
          <input value={childId} onChange={(e)=>setChildId(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Type</label>
          <select value={type} onChange={(e)=>setType(e.target.value)}>
            <option>MEAL</option>
            <option>NAP</option>
            <option>DIAPER_CHANGE</option>
            <option>ACTIVITY</option>
            <option>BEHAVIOR</option>
            <option>OTHER</option>
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>Notes</label>
          <input value={notes} onChange={(e)=>setNotes(e.target.value)} />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Create'}</button>
      </form>
    </div>
  )
}
