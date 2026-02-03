import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('admin@demo.com')
  const [password, setPassword] = useState('adminpass')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { redirect: false, email, password })
    setLoading(false)
    if (res && !res.error) {
      router.push('/dashboard')
    } else {
      setError(res?.error || 'Login failed')
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '4rem auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Ameris Child Academy</h1>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Sign In</h2>
      
      {error && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#dc2626', borderRadius: 4, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Email</label>
          <input 
            type="email"
            value={email} 
            onChange={(e)=>setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e)=>setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: loading ? '#ccc' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 500,
            marginBottom: 16
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: '#666' }}>
        Don't have an account?{' '}
        <Link href="/signup" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
          Create one
        </Link>
      </p>

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #ddd' }} />
      
      <div style={{ background: '#f3f4f6', padding: 12, borderRadius: 4, fontSize: 14 }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>Demo Credentials:</p>
        <p style={{ margin: '4px 0' }}>Admin: admin@demo.com / adminpass</p>
        <p style={{ margin: '4px 0' }}>Teacher: teacher@demo.com / teacherpass</p>
        <p style={{ margin: '4px 0' }}>Parent: parent@demo.com / parentpass</p>
      </div>
    </div>
  )
}
