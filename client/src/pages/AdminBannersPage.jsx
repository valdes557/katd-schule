import { useState } from 'react'
import { bannersApi } from '../lib/api'
import { useCachedFetch } from '../hooks/useCachedFetch'
import { cache } from '../lib/cache'
import { Image as ImageIcon, Loader2, Plus, Pencil, Trash2, X, Upload, Eye, EyeOff } from 'lucide-react'

const EMPTY = { title: '', subtitle: '', link: '', isActive: true, sortOrder: 0, image: null, imagePreview: '' }

export default function AdminBannersPage() {
  const q = useCachedFetch('/banners/all', async () => (await bannersApi.listAll()).data || [], [])
  const banners = q.data || []
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const refresh = () => { cache.invalidate('/banners'); q.refetch() }

  const openCreate = () => setModal({ ...EMPTY })
  const openEdit = (b) => setModal({ ...EMPTY, ...b, image: null, imagePreview: b.image })

  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    if (file) setModal((m) => ({ ...m, image: file, imagePreview: URL.createObjectURL(file) }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!modal._id && !modal.image) { alert('Une image est requise'); return }
    setSaving(true)
    try {
      const payload = {
        title: modal.title, subtitle: modal.subtitle, link: modal.link,
        isActive: modal.isActive, sortOrder: Number(modal.sortOrder) || 0,
        ...(modal.image ? { image: modal.image } : {}),
      }
      if (modal._id) await bannersApi.update(modal._id, payload)
      else await bannersApi.create(payload)
      setModal(null); refresh()
    } catch (err) { alert(err.message) }
    setSaving(false)
  }

  const toggleActive = async (b) => {
    try { await bannersApi.update(b._id, { isActive: !b.isActive }); refresh() } catch (err) { alert(err.message) }
  }
  const remove = async (b) => {
    if (!window.confirm('Supprimer cette bannière ?')) return
    try { await bannersApi.remove(b._id); refresh() } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ImageIcon size={22} className="text-indigo-600" /> Bannières</h1>
          <p className="text-sm text-gray-500">Bannières promotionnelles affichées sur la page d'accueil.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm justify-center"><Plus size={15} /> Nouvelle bannière</button>
      </div>

      {q.loading ? (
        <div className="py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-blue-600" /></div>
      ) : banners.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aucune bannière. Créez la première.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div key={b._id} className="card overflow-hidden">
              <div className="relative aspect-[16/6] bg-gray-100">
                <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                {!b.isActive && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-gray-900/70 text-white">Inactive</span>}
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-gray-900 truncate">{b.title || '(sans titre)'}</p>
                {b.subtitle && <p className="text-xs text-gray-500 truncate">{b.subtitle}</p>}
                {b.link && <p className="text-[11px] text-blue-600 truncate mt-1">{b.link}</p>}
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-50">
                  <span className="text-[11px] text-gray-400 mr-auto">Ordre : {b.sortOrder}</span>
                  <button onClick={() => toggleActive(b)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title={b.isActive ? 'Désactiver' : 'Activer'}>
                    {b.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(b)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-gray-900">{modal._id ? 'Modifier la bannière' : 'Nouvelle bannière'}</h3>
              <button onClick={() => setModal(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Image *</label>
                <label className="mt-1 flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2.5 cursor-pointer hover:border-indigo-400 text-sm text-gray-500">
                  <Upload size={16} /><span className="truncate">{modal.image ? modal.image.name : (modal.imagePreview ? 'Changer l\'image' : 'Téléverser une image')}</span>
                  <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
                </label>
                {modal.imagePreview && <img src={modal.imagePreview} alt="" className="mt-2 w-full aspect-[16/6] object-cover rounded-lg" />}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Titre</label>
                <input value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} className="input text-sm w-full mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Sous-titre</label>
                <input value={modal.subtitle} onChange={(e) => setModal({ ...modal, subtitle: e.target.value })} className="input text-sm w-full mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Lien (au clic)</label>
                <input value={modal.link} onChange={(e) => setModal({ ...modal, link: e.target.value })} className="input text-sm w-full mt-1" placeholder="https://… ou /tarifs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Ordre</label>
                  <input type="number" value={modal.sortOrder} onChange={(e) => setModal({ ...modal, sortOrder: e.target.value })} className="input text-sm w-full mt-1" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 mt-5">
                  <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} /> Active
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-ghost border border-gray-200 flex-1 justify-center text-sm">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center text-sm">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {modal._id ? 'Enregistrer' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
