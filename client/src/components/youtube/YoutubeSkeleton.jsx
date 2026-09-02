// Skeleton loaders de la grille YouTube (état de chargement).
export default function YoutubeSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video rounded-xl bg-gray-200" />
          <div className="mt-2 h-3 bg-gray-200 rounded w-4/5" />
          <div className="mt-1.5 h-3 bg-gray-100 rounded w-2/5" />
        </div>
      ))}
    </div>
  )
}
