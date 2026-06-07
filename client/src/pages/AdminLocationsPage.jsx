import { useEffect, useState } from 'react'
import { MapPin, Plus, Trash2, Loader2, Globe, Building2, Home, Search, AlertCircle } from 'lucide-react'
import { locationsApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'

const TYPE_LABELS = { country: 'Pays', city: 'Ville', neighborhood: 'Quartier' }
const TYPE_ICONS = { country: Globe, city: Building2, neighborhood: Home }

export default function AdminLocationsPage() {
  const [tab, setTab] = useState('country')
  const [form, setForm] = useState({ type: 'country', name: '', parent: '', code: '' })
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  const locationsQ = useCachedFetch(`/locations?type=${tab}`, async () => {
    const res = await locationsApi.list(`type=${tab}`)
    return res.data || []
  }, [tab])

  const countriesQ = useCachedFetch('/locations?type=country', async () => {
    const res = await locationsApi.list('type=country')
    return res.data || []
  }, [])

  const citiesQ = useCachedFetch(
    tab === 'neighborhood' ? '/locations?type=city' : null,
    async () => {
      const res = await locationsApi.list('type=city')
      return res.data || []
    },
    [tab],
  )

  const locations = locationsQ.data || []
  const countries = countriesQ.data || []
  const cities = citiesQ.data || []
  const loading = locationsQ.loading

  const refreshLocations = () => {
    cache.invalidate('/locations')
    locationsQ.refetch()
    countriesQ.refetch()
    if (tab === 'neighborhood') citiesQ.refetch()
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      await locationsApi.create({ type: form.type, name: form.name.trim(), parent: form.parent || undefined, code: form.code?.trim() || undefined })
      setForm({ type: tab, name: '', parent: '', code: '' })
      refreshLocations()
    } catch (err) {
      setError(err.message || 'Erreur lors de la création')
    }
    setAdding(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette localité et tous ses enfants ?')) return
    try {
      await locationsApi.remove(id)
      refreshLocations()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin size={22} className="text-blue-600" /> Gestion des localités
        </h1>
        <p className="text-sm text-gray-500">Créez et gérez les pays, villes et quartiers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['country', 'city', 'neighborhood'].map((t) => {
          const Icon = TYPE_ICONS[t]
          return (
            <button key={t} onClick={() => { setTab(t); setForm({ ...form, type: t, parent: '' }) }} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              <Icon size={12} /> {TYPE_LABELS[t]}s
            </button>
          )
        })}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="card p-4 flex flex-wrap items-end gap-3">
        {(tab === 'city' || tab === 'neighborhood') && (
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-gray-600 mb-1 block">{tab === 'city' ? 'Pays parent' : 'Ville parente'} *</label>
            <select required value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} className="input text-sm">
              <option value="">Sélectionner...</option>
              {(tab === 'city' ? countries : cities).map((l) => (
                <option key={l._id} value={l._id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm" placeholder={`Nom du ${TYPE_LABELS[tab].toLowerCase()}`} />
        </div>
        {tab === 'country' && (
          <div className="w-24">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Code</label>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input text-sm" placeholder="CM" />
          </div>
        )}
        <button type="submit" disabled={adding} className="btn-primary text-sm py-2">
          {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Erreur</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-xs text-red-500 hover:underline">Fermer</button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Rechercher un ${TYPE_LABELS[tab].toLowerCase()}...`}
          className="input pl-9 text-sm"
        />
      </div>

      {/* List */}
      {(() => {
        const q = search.trim().toLowerCase()
        const filtered = q
          ? locations.filter((l) =>
              l.name?.toLowerCase().includes(q) ||
              l.code?.toLowerCase().includes(q) ||
              l.parent?.name?.toLowerCase().includes(q)
            )
          : locations
        return loading ? (
          <div className="text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MapPin size={36} className="mx-auto mb-2 opacity-20" />
            <p>{q ? `Aucun résultat pour « ${search} »` : `Aucun ${TYPE_LABELS[tab].toLowerCase()} créé`}</p>
          </div>
        ) : (
        <>
        <p className="text-xs text-gray-400">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}{q ? ` pour « ${search} »` : ''}</p>
        <div className="grid gap-2">
          {filtered.map((loc) => (
            <div key={loc._id} className="card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  {(() => { const Icon = TYPE_ICONS[loc.type]; return <Icon size={14} /> })()}
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                  {loc.code && <span className="text-xs text-gray-400 ml-2">({loc.code})</span>}
                  {loc.parent && <span className="text-xs text-gray-400 ml-2">← {loc.parent.name}</span>}
                </div>
              </div>
              <button onClick={() => handleDelete(loc._id)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        </>
        )
      })()}
    </div>
  )
}
