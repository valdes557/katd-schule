import { useState, useEffect } from 'react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import SocialTab from '../components/landing/SocialTab'
import { platformApi } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function SocialPage() {
  const [feed, setFeed] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    platformApi.getFeed().then((r) => setFeed(r.data || [])).catch((err) => console.error(err))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <SocialTab feed={feed} setFeed={setFeed} user={user} />
      </div>
      <Footer />
    </div>
  )
}
