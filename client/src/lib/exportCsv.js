// lib/exportCsv.js — Export CSV universel (F5 Secondaire). Aucune dépendance :
// s'ouvre directement dans Excel / LibreOffice / Google Sheets grâce au BOM UTF-8
// (sinon les accents sont cassés dans Excel Windows). Échappement RFC 4180.
//
// Usage :
//   exportToCsv('journal.csv',
//     [{ key: 'name', label: 'Nom' }, { key: 'date', label: 'Date' }],
//     rows) // rows = tableau d'objets ; chaque colonne lit row[col.key]
// col.format(value, row) est optionnel (mise en forme d'une cellule).

// Échappe une valeur pour une cellule CSV : guillemets doublés, encadrement si
// la valeur contient séparateur, guillemet ou saut de ligne.
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * Construit le contenu CSV (séparateur point-virgule : convention FR, Excel
 * francophone l'ouvre en colonnes sans réglage).
 */
export function buildCsv(columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(';')
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = typeof c.key === 'function' ? c.key(row) : row[c.key]
        return escapeCell(c.format ? c.format(raw, row) : raw)
      })
      .join(';')
  )
  return [header, ...lines].join('\r\n')
}

/**
 * Déclenche le téléchargement d'un fichier CSV (fiable mobile + desktop).
 * BOM ﻿ en tête → Excel Windows lit l'UTF-8 correctement.
 */
export function exportToCsv(filename, columns, rows) {
  const csv = '﻿' + buildCsv(columns, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default exportToCsv
