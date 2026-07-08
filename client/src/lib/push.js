import { pushApi } from './api'

// Utilitaires Web Push côté client : enregistrement du service worker,
// abonnement/désabonnement, et détection du support navigateur.

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Convertit la clé VAPID publique (base64 url-safe) en Uint8Array attendu par pushManager.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

let swRegistration = null

// Enregistre le service worker (idempotent). Appelé au démarrage de l'app.
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    return swRegistration
  } catch (e) {
    return null
  }
}

async function getRegistration() {
  if (swRegistration) return swRegistration
  if (!('serviceWorker' in navigator)) return null
  swRegistration = await navigator.serviceWorker.ready
  return swRegistration
}

// Demande la permission ET abonne l'utilisateur au push. Renvoie true si abonné.
export async function subscribeToPush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: permission } // 'denied' | 'default'

  const reg = await getRegistration()
  if (!reg) return { ok: false, reason: 'no-sw' }

  // Récupère la clé publique VAPID du serveur.
  let publicKey = ''
  try {
    const res = await pushApi.getVapid()
    publicKey = res.publicKey
  } catch (_) {}
  if (!publicKey) return { ok: false, reason: 'no-vapid' }

  // Réutilise l'abonnement existant s'il y en a un, sinon en crée un.
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const json = sub.toJSON()
  await pushApi.subscribe({ endpoint: sub.endpoint, keys: json.keys })
  return { ok: true }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await getRegistration()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await pushApi.unsubscribe({ endpoint: sub.endpoint }).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  } catch (_) {}
}

export function permissionState() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'granted' | 'denied' | 'default'
}
