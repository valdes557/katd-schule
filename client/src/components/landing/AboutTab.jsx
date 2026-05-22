export default function AboutTab({ platformData }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">À propos de KATD-SCHÜLE</h2>
      {platformData?.about?.images?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platformData.about.images.map((img, i) => (
            <img key={i} src={img} alt="" className="rounded-xl w-full h-48 object-cover" />
          ))}
        </div>
      )}
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
        {platformData?.about?.content ||
          "KATD-SCHÜLE est une plateforme de gestion scolaire complète conçue pour les établissements africains. Notre mission est de digitaliser l'éducation et de connecter les écoles à travers le monde."}
      </div>
    </div>
  )
}
