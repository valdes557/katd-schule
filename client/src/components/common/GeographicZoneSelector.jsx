import { useState, useEffect } from 'react'
import { MapPin, Info } from 'lucide-react'
import { zonesApi } from '../../lib/api'

export default function GeographicZoneSelector({
  value = {},
  onChange,
  helperText = "Par défaut : hérite de la zone de l'établissement",
  compact = false,
}) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    zonesApi
      .list()
      .then((res) => {
        if (res?.zones) setZones(res.zones)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const arrondissements = zones.filter((z) => z.type === 'arrondissement')
  const regions = zones.filter((z) => z.type === 'regional')
  const nationals = zones.filter((z) => z.type === 'national')
  const mondials = zones.filter((z) => z.type === 'international' || z.type === 'mondial')

  const handleSelect = (zoneId) => {
    if (!zoneId) {
      onChange({
        zoneId: null,
        zoneType: null,
        zoneName: '',
        arrondissementId: null,
        arrondissementName: '',
        regionId: null,
        regionName: '',
        countryId: null,
        countryName: '',
        mondialId: null,
        mondialName: '',
      })
      return
    }

    const matched = zones.find((z) => String(z._id) === String(zoneId))
    if (!matched) return

    const zoneType = matched.type
    const zoneName = matched.name

    onChange({
      zoneId: matched._id,
      zoneType,
      zoneName,
      arrondissementId: zoneType === 'arrondissement' ? matched._id : undefined,
      arrondissementName: zoneType === 'arrondissement' ? zoneName : undefined,
      regionId: zoneType === 'regional' ? matched._id : undefined,
      regionName: zoneType === 'regional' ? zoneName : undefined,
      countryId: zoneType === 'national' ? matched._id : undefined,
      countryName: zoneType === 'national' ? zoneName : undefined,
      mondialId: (zoneType === 'international' || zoneType === 'mondial') ? matched._id : undefined,
      mondialName: (zoneType === 'international' || zoneType === 'mondial') ? zoneName : undefined,
    })
  }

  const selectedId = value?.zoneId || value?.arrondissementId || value?.regionId || ''

  return (
    <div className="rounded-xl border border-indigo-150 bg-indigo-50/40 p-3 space-y-2 text-left">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
          <MapPin size={14} className="text-indigo-600" />
          <span>Zone géographique d'attribution (optionnel)</span>
        </label>
        {selectedId ? (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
            Personnalisée
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
            Héritage école
          </span>
        )}
      </div>

      <select
        value={selectedId}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={loading}
        className="input text-xs w-full py-2 bg-white font-medium border-indigo-200 focus:border-indigo-500"
      >
        <option value="">-- Par défaut (Zone de l'établissement scolaire) --</option>
        {arrondissements.length > 0 && (
          <optgroup label="Arrondissements">
            {arrondissements.map((z) => (
              <option key={z._id} value={z._id}>
                Arrondissement : {z.name} {z.code ? `(${z.code})` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {regions.length > 0 && (
          <optgroup label="Régions">
            {regions.map((z) => (
              <option key={z._id} value={z._id}>
                Région : {z.name} {z.code ? `(${z.code})` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {nationals.length > 0 && (
          <optgroup label="National">
            {nationals.map((z) => (
              <option key={z._id} value={z._id}>
                National : {z.name}
              </option>
            ))}
          </optgroup>
        )}
        {mondials.length > 0 && (
          <optgroup label="International / Mondial">
            {mondials.map((z) => (
              <option key={z._id} value={z._id}>
                Mondial : {z.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <p className="text-[11px] text-indigo-700/80 flex items-center gap-1">
        <Info size={11} className="shrink-0" />
        <span>{helperText}</span>
      </p>
    </div>
  )
}
