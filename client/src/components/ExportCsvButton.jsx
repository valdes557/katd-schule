import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { exportToCsv } from '../lib/exportCsv'

/**
 * Bouton « Exporter (Excel) » réutilisable (F5 Secondaire). Produit un CSV
 * (BOM UTF-8, séparateur « ; ») qui s'ouvre directement dans Excel — aucune
 * dépendance ajoutée. Même apparence que DownloadPdfButton, mais en vert pour
 * distinguer l'export tableur de l'export PDF.
 *
 * Usage :
 *   <ExportCsvButton
 *     filename="journal-actions.csv"
 *     columns={[{ key: 'name', label: 'Nom' }, { key: 'date', label: 'Date', format: (v) => new Date(v).toLocaleString('fr-FR') }]}
 *     rows={rows}          // tableau d'objets, ou fonction async () => rows
 *   />
 */
export default function ExportCsvButton({ filename = 'export.csv', columns = [], rows = [], label = 'Exporter (Excel)', className = '', disabled = false }) {
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    if (busy) return
    setBusy(true)
    try {
      // rows peut être une fonction (chargement à la demande, ex. dépaginer)
      const data = typeof rows === 'function' ? await rows() : rows
      if (!data || data.length === 0) return
      exportToCsv(filename, columns, data)
    } catch (err) {
      console.error('Erreur export CSV:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy || disabled}
      className={`btn-ghost border border-green-200 text-green-700 text-sm disabled:opacity-50 ${className}`}
    >
      <FileSpreadsheet size={14} /> {busy ? 'Export…' : label}
    </button>
  )
}
