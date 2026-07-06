// Validation de durée des vidéos avant upload (limite plateforme : 30 minutes).
// Utilisé sur toutes les surfaces d'upload de vidéo (dashboards + espace utilisateur).

export const MAX_VIDEO_MINUTES = 30
export const MAX_VIDEO_SECONDS = MAX_VIDEO_MINUTES * 60

// Lit la durée (en secondes) d'un fichier vidéo côté navigateur.
export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration || 0)
      }
      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        reject(new Error('Impossible de lire la vidéo.'))
      }
      video.src = URL.createObjectURL(file)
    } catch (e) {
      reject(e)
    }
  })
}

// Vérifie qu'un fichier vidéo ne dépasse pas la limite. Lève une erreur explicite sinon.
// Renvoie true si le fichier n'est pas une vidéo (rien à vérifier).
export async function assertVideoWithinLimit(file, maxMinutes = MAX_VIDEO_MINUTES) {
  if (!file || !file.type?.startsWith('video')) return true
  let duration = 0
  try {
    duration = await getVideoDuration(file)
  } catch {
    // Si la durée est illisible, on laisse passer (le serveur/Cloudinary reste garde-fou).
    return true
  }
  if (duration > maxMinutes * 60) {
    const mins = Math.floor(duration / 60)
    const secs = Math.round(duration % 60)
    throw new Error(`La vidéo est trop longue (${mins} min ${secs}s). Durée maximale autorisée : ${maxMinutes} minutes.`)
  }
  return true
}
