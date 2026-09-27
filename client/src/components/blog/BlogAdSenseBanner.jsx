import { useState, useEffect, useRef } from 'react'
import { platformApi } from '../../lib/api'

export default function BlogAdSenseBanner({ slot, format = 'auto', className = '' }) {
  const [config, setConfig] = useState(null)
  const adRef = useRef(null)
  const pushedRef = useRef(false)

  useEffect(() => {
    let alive = true
    platformApi.getAdsense()
      .then((res) => {
        if (!alive) return
        setConfig(res?.adsense || null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!config || !config.enabled || !config.client) return
    // Charger le script Google AdSense une seule fois s'il n'est pas déjà présent
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const script = document.createElement('script')
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`
      script.async = true
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }

    // Déclencher l'affichage de l'annonce si l'élément est prêt
    if (!pushedRef.current && adRef.current) {
      try {
        pushedRef.current = true
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (_) {}
    }
  }, [config])

  if (!config || !config.enabled || !config.client) {
    return null
  }

  const effectiveSlot = slot || config.blogSlot || ''

  return (
    <div className={`my-4 overflow-hidden text-center bg-slate-50/50 rounded-xl p-2 border border-slate-100 ${className}`}>
      <span className="block text-[10px] text-gray-400 uppercase tracking-widest mb-1 select-none">
        Publicité
      </span>
      <ins
        ref={adRef}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={config.client}
        data-ad-slot={effectiveSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
