import { useState } from 'react'
import { Search, Filter, Play, Image, Music, Heart, MessageCircle, Share2, Download, SlidersHorizontal } from 'lucide-react'
import PublicHeader from '../components/layout/PublicHeader'
import Footer from '../components/layout/Footer'
import { mediaItems, schools, categories } from '../data/mockData'

function MediaCard({ item }) {
  const [liked, setLiked] = useState(false)
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-card hover:shadow-card-lg transition-shadow group">
      <div className={`relative h-48 bg-gradient-to-br ${item.gradient}`}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        {item.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
              <Play size={20} className="text-white fill-white ml-1" />
            </div>
          </div>
        )}
        {item.type === 'audio' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-10">
              {[4, 7, 5, 9, 6, 8, 4, 7, 5, 9, 6, 8, 4, 7].map((h, i) => (
                <div key={i} className="w-1 bg-white/70 rounded-full" style={{ height: `${h * 3}px` }} />
              ))}
            </div>
          </div>
        )}
        {item.type === 'photo' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Image size={36} className="text-white/30" />
          </div>
        )}
        <div className="absolute bottom-2 right-2">
          {item.duration && <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">{item.duration}</span>}
          {item.count && <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1"><Image size={10} />{item.count}</span>}
        </div>
        <div className="absolute top-2 left-2">
          <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full capitalize">{item.category}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: schools.find(s => s.id === item.schoolId)?.color || '#2563EB' }}>
            {schools.find(s => s.id === item.schoolId)?.initials?.slice(0, 1)}
          </div>
          <span className="text-xs text-gray-500 truncate">{item.school}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 mb-3 leading-tight">{item.title}</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <button onClick={() => setLiked(!liked)} className="flex items-center gap-1 hover:text-red-500 transition-colors">
            <Heart size={13} className={liked ? 'fill-red-500 text-red-500' : ''} />
            <span>{item.likes + (liked ? 1 : 0)}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
            <MessageCircle size={13} /><span>{item.comments}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
            <Share2 size={13} /><span>{item.shares}</span>
          </button>
          <button className="ml-auto hover:text-blue-500 transition-colors"><Download size={13} /></button>
        </div>
      </div>
    </div>
  )
}

export default function ExplorerPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('Tous')
  const [sortBy, setSortBy] = useState('recent')

  const typeOptions = ['Tous', 'Vidéos', 'Photos', 'Audios']
  const sortOptions = [
    { value: 'recent', label: 'Plus récent' },
    { value: 'popular', label: 'Plus populaire' },
    { value: 'school', label: 'Par école' },
  ]

  const filtered = mediaItems.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.school.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'Tous' ||
      (typeFilter === 'Vidéos' && item.type === 'video') ||
      (typeFilter === 'Photos' && item.type === 'photo') ||
      (typeFilter === 'Audios' && item.type === 'audio')
    return matchSearch && matchType
  })

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl font-bold mb-3">Explorer les contenus</h1>
          <p className="text-blue-100 mb-6">Découvrez les activités scolaires de toutes les écoles</p>
          <div className="max-w-xl mx-auto relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher des vidéos, photos, audios..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            {typeOptions.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  typeFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {t === 'Vidéos' && <Play size={12} className="inline mr-1" />}
                {t === 'Photos' && <Image size={12} className="inline mr-1" />}
                {t === 'Audios' && <Music size={12} className="inline mr-1" />}
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input text-sm py-2 w-auto"
            >
              {sortOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button key={cat} className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
              {cat}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">{filtered.length} contenu(s) trouvé(s)</p>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-base">Aucun contenu trouvé</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
