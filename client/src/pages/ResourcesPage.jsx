import { useState, useEffect } from 'react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import ResourcesTab from '../components/landing/ResourcesTab'
import { platformApi } from '../lib/api'

export default function ResourcesPage() {
  const [platformData, setPlatformData] = useState(null)

  useEffect(() => {
    platformApi.get().then((r) => setPlatformData(r.data)).catch((err) => console.error(err))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <ResourcesTab platformData={platformData} />
      </div>
      <Footer />
    </div>
  )
}
