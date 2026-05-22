import { useState, useEffect } from 'react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import ExperiencesTab from '../components/landing/ExperiencesTab'
import { platformApi } from '../lib/api'

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState([])

  useEffect(() => {
    platformApi.getExperiences().then((r) => setExperiences(r.data || [])).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ExperiencesTab experiences={experiences} setExperiences={setExperiences} />
      </div>
      <Footer />
    </div>
  )
}
