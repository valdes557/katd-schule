// lib/admobService.js — Service universel pour la monétisation (Google AdMob sur Mobile & Google AdSense sur Web)
// Détecte automatiquement la plateforme : application mobile native (Capacitor) vs navigateur Web.

const TEST_AD_UNITS = {
  // Identifiants de test officiels Google AdMob (Android)
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
}

class AdMobService {
  constructor() {
    this.initialized = false
    this.isNative = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.())
    this.config = {
      admobEnabled: true,
      admobAppId: '',
      admobBannerSlot: '',
      admobInterstitialSlot: '',
      admobRewardedSlot: '',
      adsenseClient: '',
      adSlot: '',
    }
  }

  // Initialisation avec la configuration reçue du backend (/api/youtube/ad-config)
  async init(remoteConfig = {}) {
    this.config = { ...this.config, ...remoteConfig }
    this.isNative = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.())

    if (this.isNative) {
      try {
        // Tente d'accéder au plugin natif Capacitor AdMob si installé
        if (window.Capacitor?.Plugins?.AdMob) {
          await window.Capacitor.Plugins.AdMob.initialize({
            initializeForTesting: !this.config.admobAppId,
          })
          this.initialized = true
        }
      } catch (err) {
        console.warn('[AdMob] Init natif non disponible:', err.message)
      }
    } else {
      // Sur le web : charge le script AdSense si configuré
      if (this.config.adsenseClient) {
        this.loadWebAdsense(this.config.adsenseClient)
      }
      this.initialized = true
    }
  }

  loadWebAdsense(client) {
    if (typeof document === 'undefined') return
    if (document.querySelector('script[data-adsbygoogle="1"]')) return
    const s = document.createElement('script')
    s.async = true
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    s.crossOrigin = 'anonymous'
    s.setAttribute('data-adsbygoogle', '1')
    document.head.appendChild(s)
  }

  // ── 1. Bannière publicitaire (en bas de l'écran sur mobile, bloc inline sur web) ──
  async showBanner(position = 'bottom') {
    if (this.isNative && window.Capacitor?.Plugins?.AdMob) {
      try {
        const adId = this.config.admobBannerSlot || TEST_AD_UNITS.banner
        await window.Capacitor.Plugins.AdMob.showBanner({
          adId,
          adSize: 'BANNER',
          position: position === 'top' ? 'TOP_CENTER' : 'BOTTOM_CENTER',
          margin: 0,
          isTesting: !this.config.admobBannerSlot,
        })
        return true
      } catch (err) {
        console.warn('[AdMob] Erreur showBanner:', err.message)
        return false
      }
    }
    return false
  }

  async hideBanner() {
    if (this.isNative && window.Capacitor?.Plugins?.AdMob) {
      try {
        await window.Capacitor.Plugins.AdMob.hideBanner()
        return true
      } catch (_) {
        return false
      }
    }
    return false
  }

  // ── 2. Interstitiel plein écran (avant ou après une vidéo) ──
  async showInterstitial() {
    if (this.isNative && window.Capacitor?.Plugins?.AdMob) {
      try {
        const adId = this.config.admobInterstitialSlot || TEST_AD_UNITS.interstitial
        await window.Capacitor.Plugins.AdMob.prepareInterstitial({
          adId,
          isTesting: !this.config.admobInterstitialSlot,
        })
        await window.Capacitor.Plugins.AdMob.showInterstitial()
        return true
      } catch (err) {
        console.warn('[AdMob] Erreur showInterstitial:', err.message)
        return false
      }
    }
    return false
  }

  // ── 3. Vidéo Récompensée (Rewarded Ad) avant le téléchargement d'une vidéo ──
  async showRewardedAd() {
    if (this.isNative && window.Capacitor?.Plugins?.AdMob) {
      try {
        const adId = this.config.admobRewardedSlot || TEST_AD_UNITS.rewarded
        await window.Capacitor.Plugins.AdMob.prepareRewardVideoAd({
          adId,
          isTesting: !this.config.admobRewardedSlot,
        })
        const result = await window.Capacitor.Plugins.AdMob.showRewardVideoAd()
        return result
      } catch (err) {
        console.warn('[AdMob] Erreur showRewardedAd:', err.message)
        return null
      }
    }
    return null
  }
}

export const admobService = new AdMobService()
export default admobService
