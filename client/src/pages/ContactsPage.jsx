import { useState, useEffect } from 'react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import ContactsTab from '../components/landing/ContactsTab'
import { platformApi } from '../lib/api'

export default function ContactsPage() {
  const [platformData, setPlatformData] = useState(null)

  useEffect(() => {
    platformApi.get().then((r) => setPlatformData(r.data)).catch((err) => console.error(err))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ContactsTab platformData={platformData} />
      </div>
      <Footer />
    </div>
  )
}
