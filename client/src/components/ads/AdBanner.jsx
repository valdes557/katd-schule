import { useEffect, useRef, useState } from 'react'
import { youtubeApi } from '../../lib/api'
import { admobService } from '../../lib/admobService'

export default function AdBanner({ slot = '', format = 'auto', className = '' }) {
  const [adConfig, setAdConfig] = useState(null)
  const adRef = useRef(null)
  const pushedRef = useRef(false)

  useEffect(() => {
    let alive = true
    youtubeApi.adConfig().then((cfg) => {
      if (!alive) return
      setAdConfig(cfg)
      admobService.init(cfg)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!adConfig) return
    const isNative = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.())

    if (isNative && adConfig.admobEnabled) {
      admobService.showBanner('bottom')
      return () => { admobService.hideBanner() }
    }

    // Web AdSense
    if (adConfig.adsenseClient && (slot || adConfig.adSlot) && !pushedRef.current) {
      pushedRef.current = true
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      } catch (_) {}
    }
  }, [adConfig, slot])

  if (!adConfig) return null

  const isNative = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.())
  if (isNative) {
    // Sur mobile natif, le bandeau AdMob s'affiche en overlay natif
    return null
  }

  // Si AdSense est configuré sur le Web
  const client = adConfig.adsenseClient
  const effectiveSlot = slot || adConfig.adSlot

  if (client && effectiveSlot) {
    return (
      <div className={`my-3 text-center overflow-hidden bg-gray-50 border border-gray-100 rounded-xl p-2 ${className}`}>
        <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Publicité sponsorisée</div>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={client}
          data-ad-slot={effectiveSlot}
          data-ad-format={format}
          data-full-width-responsive="true"
          ref={adRef}
        />
      </div>
    )
  }

  return null
}
