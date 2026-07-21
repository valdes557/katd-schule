import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { QrCode, Download, Loader2, AlertCircle } from 'lucide-react'
import { entryAttendanceApi } from '../../lib/api'

/** Chaque membre (élève, professeur, personnel) peut afficher SON QR de présence. */
export default function MyQrPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    entryAttendanceApi.myQr()
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const download = () => {
    const canvas = document.getElementById('my-qr-box')?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `mon-qr-presence.png`
    a.click()
  }

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
  if (error) return <div className="text-center py-16"><AlertCircle size={36} className="mx-auto text-red-400 mb-3" /><p className="text-sm text-gray-600">{error}</p></div>

  return (
    <div className="max-w-md mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><QrCode size={22} className="text-indigo-600" /> Mon QR de présence</h1>
        <p className="text-sm text-gray-500">Présentez ce QR au portier à l'entrée et à la sortie de l'établissement.</p>
      </div>
      <div className="card p-6 text-center">
        <div id="my-qr-box" className="flex justify-center">
          <QRCodeCanvas value={data?.qrId || ''} size={220} level="M" includeMargin />
        </div>
        <p className="text-base font-bold text-gray-900 mt-2">{data?.name}</p>
        {data?.matricule && <p className="text-xs text-gray-400 font-mono">{data.matricule}</p>}
        <button onClick={download} className="btn-primary text-sm mx-auto mt-4"><Download size={15} /> Télécharger</button>
      </div>
    </div>
  )
}
