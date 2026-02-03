import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (session) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [session, status, router])

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <p>Redirecting...</p>
    </div>
  )
}
