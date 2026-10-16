import { useState, useEffect } from 'react'
import { FileText, Clock, ClipboardList, QrCode, MessageSquare, Bell, Globe, GraduationCap, History, Download, Loader2, X, Award, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import SecondaryRoleDashboard from './SecondaryRoleDashboard'
import { studentsApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { exportAttestationPassagePdf } from '../../lib/exportFichesPdf'

export default function EleveDashboardPage() {
  const { school } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [downloadingAttestation, setDownloadingAttestation] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await studentsApi.myProfile()
        if (res.data) setProfile(res.data)
      } catch (e) {
        // profile fetch error handled gracefully
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const currentClass = profile?.class
  const historyList = profile?.academicHistory || []
  const hasHistory = historyList.length > 0
  const lastHistory = hasHistory ? historyList[historyList.length - 1] : null

  const handleDownloadAttestation = async (hist) => {
    setDownloadingAttestation(true)
    try {
      await exportAttestationPassagePdf({ school, student: profile, historyItem: hist })
    } catch (err) {
      alert('Erreur lors du téléchargement : ' + err.message)
    } finally {
      setDownloadingAttestation(false)
    }
  }

  const subtitle = currentClass?.name
    ? `Classe actuelle : ${currentClass.name}${currentClass.level ? ` (${currentClass.level})` : ''} · Année scolaire ${profile.academicYear || ''}`
    : 'Mon espace élève'

  return (
    <SecondaryRoleDashboard
      subtitle={subtitle}
      quickButtons={[
        { label: 'Mes notes', path: '/dashboard/eleve/notes', icon: FileText, bg: 'bg-blue-600 hover:bg-blue-700' },
        { label: 'Mon emploi du temps', path: '/dashboard/eleve/emploi-du-temps', icon: Clock, bg: 'bg-purple-600 hover:bg-purple-700' },
        { label: 'Mes devoirs', path: '/dashboard/eleve/devoirs', icon: ClipboardList, bg: 'bg-teal-600 hover:bg-teal-700' },
        { label: 'Mon QR de présence', path: '/dashboard/eleve/mon-qr', icon: QrCode, bg: 'bg-orange-500 hover:bg-orange-600' },
        { label: 'Mon bulletin', path: '/dashboard/bulletin', icon: GraduationCap, bg: 'bg-indigo-600 hover:bg-indigo-700' },
        { label: 'Messenger', path: '/dashboard/messagerie', icon: MessageSquare, bg: 'bg-green-600 hover:bg-green-700' },
        { label: 'Annonces', path: '/dashboard/annonces', icon: Bell, bg: 'bg-amber-600 hover:bg-amber-700' },
        { label: 'Social', path: '/dashboard/social', icon: Globe, bg: 'bg-rose-600 hover:bg-rose-700' },
      ]}
    >
      {/* Carte d'information de promotion et preuve de scolarité */}
      {hasHistory && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <GraduationCap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900">
                    Félicitations ! Vous êtes admis en classe supérieure : {currentClass?.name || 'Nouvelle classe'}
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                    ✓ Admission validée
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Votre tableau de bord et vos cours pointent désormais sur la classe de <strong>{currentClass?.name}</strong>.
                  Toutes vos informations, notes et preuves de scolarité de <strong>{lastHistory?.className} ({lastHistory?.academicYear})</strong> sont certifiées et conservées.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-2 flex items-center gap-1.5 shadow-xs"
            >
              <History size={14} />
              <span>Voir mes preuves de scolarité</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: Historique académique et attestations pour l'élève */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-card-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Mes preuves scolaires & Historique</h3>
                  <p className="text-xs text-gray-500">Archives officielles de vos classes précédentes</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              {historyList.map((hist, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-900">{hist.className}</span>
                      <p className="text-xs text-gray-500">Année scolaire : <strong>{hist.academicYear}</strong></p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                      ✓ {hist.decisionLabel || 'Admis'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-gray-100">
                    <div>Admis en : <strong>{hist.targetClassName || currentClass?.name}</strong></div>
                    <div>Validation : <strong>{hist.promotedAt ? new Date(hist.promotedAt).toLocaleDateString('fr-FR') : '—'}</strong></div>
                  </div>

                  {hist.remarks && (
                    <p className="text-xs text-gray-500 italic">« {hist.remarks} »</p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadAttestation(hist)}
                      disabled={downloadingAttestation}
                      className="btn-ghost border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      {downloadingAttestation ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                      <span>Télécharger Attestation officielle (PDF)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="btn-primary text-sm px-5"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </SecondaryRoleDashboard>
  )
}
