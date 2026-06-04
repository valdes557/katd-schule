import { useEffect, useState } from 'react'
import {
  FileText, Download, Loader2, User, GraduationCap, Calendar, School,
} from 'lucide-react'
import { parentApi } from '../lib/api'

const DOC_TYPES = {
  certificat_scolarite: { label: 'Certificat de scolarité', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
  attestation_inscription: { label: "Attestation d'inscription", icon: School, color: 'text-green-600', bg: 'bg-green-50' },
  bulletin: { label: 'Bulletin de notes', icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  attestation_reussite: { label: 'Attestation de réussite', icon: GraduationCap, color: 'text-amber-600', bg: 'bg-amber-50' },
}

export default function ParentDocumentsPage() {
  const [children, setChildren] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await parentApi.dashboard()
        const kids = r.data?.children || []
        setChildren(kids)
        if (kids.length > 0) setSelectedChild(kids[0]._id)
      } catch (err) { console.error(err) }
    })()
  }, [])

  useEffect(() => {
    if (!selectedChild) { setLoading(false); return }
    (async () => {
      setLoading(true)
      try {
        const r = await parentApi.documents(selectedChild)
        setDocuments(r.data || [])
      } catch (err) { console.error(err); setDocuments([]) }
      setLoading(false)
    })()
  }, [selectedChild])

  const handleGenerate = async (type) => {
    if (!selectedChild) return
    setGenerating(type)
    try {
      const r = await parentApi.generateDocument(selectedChild, type)
      if (r.data?.url) {
        window.open(r.data.url, '_blank')
      } else {
        // Refresh list
        const res = await parentApi.documents(selectedChild)
        setDocuments(res.data || [])
      }
    } catch (e) { alert(e.message || 'Erreur lors de la génération') }
    setGenerating(null)
  }

  const child = children.find((c) => c._id === selectedChild)

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><FileText size={22} className="text-blue-600" /> Documents Administratifs</h1>
        <p className="text-sm text-gray-500">Certificats, attestations et bulletins de vos enfants</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button key={c._id} onClick={() => setSelectedChild(c._id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${selectedChild === c._id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <User size={13} /> {c.fullName}
            </button>
          ))}
        </div>
      )}

      {child && (
        <div className="card p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <p className="text-xs font-bold mb-1">Documents pour</p>
          <p className="text-lg font-bold">{child.fullName}</p>
          <p className="text-xs text-blue-200">{child.class?.name} · {child.cycle} · Mat. {child.matricule}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : (
        <div className="space-y-5">
          {/* Quick generate buttons */}
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Demander un document</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(DOC_TYPES).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => handleGenerate(type)}
                  disabled={!!generating}
                  className={`card p-4 flex items-center gap-3 hover:shadow-card-lg transition-all group text-left ${info.bg} border-0`}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm flex-shrink-0">
                    {generating === type ? <Loader2 size={18} className="animate-spin text-blue-600" /> : <info.icon size={18} className={info.color} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{info.label}</p>
                    <p className="text-[10px] text-gray-500">Cliquez pour générer</p>
                  </div>
                  <Download size={14} className="text-gray-400 group-hover:text-gray-700" />
                </button>
              ))}
            </div>
          </div>

          {/* Existing documents */}
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Documents disponibles</h2>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun document disponible pour le moment</p>
                <p className="text-xs mt-1">Utilisez les boutons ci-dessus pour demander un document</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => {
                  const info = DOC_TYPES[doc.type] || DOC_TYPES.certificat_scolarite
                  return (
                    <div key={doc._id} className="card p-4 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${info.bg} flex-shrink-0`}>
                        <info.icon size={16} className={info.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{info.label}</p>
                        <p className="text-[10px] text-gray-500">
                          Généré le {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {doc.term && ` · ${doc.term}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${doc.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {doc.status === 'ready' ? 'Disponible' : 'En cours'}
                        </span>
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <Download size={14} className="text-blue-600" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
