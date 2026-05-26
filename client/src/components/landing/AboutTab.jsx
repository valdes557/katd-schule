export default function AboutTab({ platformData }) {
  const html = platformData?.about?.content
  const isHtml = typeof html === 'string' && /<\/?[a-z][\s\S]*>/i.test(html)
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
      {isHtml ? (
        <div
          className="about-content text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
          {html || "KATD-SCHÜLE est une plateforme de gestion scolaire complète conçue pour les établissements africains. Notre mission est de digitaliser l'éducation et de connecter les écoles à travers le monde."}
        </div>
      )}
      <style>{`
        .about-content h1,.about-content h2,.about-content h3 { font-weight: 700; color: #111827; margin: 1rem 0 .5rem; }
        .about-content h2 { font-size: 1.4rem; }
        .about-content h3 { font-size: 1.15rem; }
        .about-content p { margin: .5rem 0; }
        .about-content ul { list-style: disc; padding-left: 1.5rem; margin: .5rem 0; }
        .about-content ol { list-style: decimal; padding-left: 1.5rem; margin: .5rem 0; }
        .about-content blockquote { border-left: 3px solid #93C5FD; padding-left: .75rem; color: #4B5563; font-style: italic; margin: .75rem 0; }
        .about-content a { color: #2563EB; text-decoration: underline; }
        .about-content img { max-width: 100%; border-radius: .5rem; margin: .75rem 0; }
        .about-content strong { font-weight: 700; }
        .about-content em { font-style: italic; }
      `}</style>
    </div>
  )
}
