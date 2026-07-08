import { uploadsApi } from './api'

// Upload DIRECT navigateur -> Cloudinary (le fichier ne passe plus par le VPS/Nginx).
// Supprime la limite Nginx 60 Mo et le timeout 60s qui provoquaient l'erreur
// "Impossible de joindre le serveur" et les vidéos lentes.
//
// uploadToCloudinary(file, { onProgress, resourceType, folder })
//   -> { secureUrl, publicId, width, height, duration, thumbnailUrl, bytes, resourceType }
//
// Le serveur signe la requête (POST /api/uploads/sign) sans exposer le secret Cloudinary.

function resourceTypeFor(file) {
  if (file.type?.startsWith('video')) return 'video'
  if (file.type?.startsWith('image')) return 'image'
  return 'auto'
}

// Construit l'URL d'une miniature (1re frame) d'une vidéo Cloudinary.
function videoThumb(secureUrl) {
  if (!secureUrl || !secureUrl.includes('/upload/')) return ''
  return secureUrl
    .replace('/upload/', '/upload/so_0/')
    .replace(/\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i, '.jpg$2')
}

function postToCloudinary({ cloudName, resourceType, formData, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const rt = resourceType === 'image' ? 'image' : resourceType === 'video' ? 'video' : 'auto'
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${rt}/upload`)
    // 10 minutes : large pour les grosses vidéos sur connexion lente.
    xhr.timeout = 10 * 60 * 1000
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch (_) { reject(new Error('Réponse Cloudinary invalide')) }
      } else {
        let msg = `Échec de l'envoi (${xhr.status})`
        try { msg = JSON.parse(xhr.responseText).error?.message || msg } catch (_) {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('__network__'))
    xhr.ontimeout = () => reject(new Error("L'envoi a expiré. Réessayez avec une meilleure connexion."))
    xhr.send(formData)
  })
}

export async function uploadToCloudinary(file, { onProgress, resourceType, folder } = {}) {
  const rt = resourceType || resourceTypeFor(file)
  const rtFolder = folder || (rt === 'video' ? 'katd-schule/videos' : rt === 'image' ? 'katd-schule/images' : 'katd-schule/files')

  // 1) Signature côté serveur (secret Cloudinary jamais exposé).
  const sign = await uploadsApi.sign({ folder: rtFolder, resourceType: rt })

  const buildForm = () => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('api_key', sign.apiKey)
    fd.append('timestamp', sign.timestamp)
    fd.append('signature', sign.signature)
    fd.append('folder', sign.folder)
    return fd
  }

  // 2) Upload direct, avec 1 retry en cas d'erreur réseau transitoire.
  let result
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      result = await postToCloudinary({
        cloudName: sign.cloudName,
        resourceType: rt,
        formData: buildForm(),
        onProgress,
      })
      break
    } catch (e) {
      if (e.message === '__network__' && attempt < 1) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      if (e.message === '__network__') {
        throw new Error('Connexion interrompue pendant l\'envoi. Vérifiez votre connexion et réessayez.')
      }
      throw e
    }
  }

  const isVideo = result.resource_type === 'video'
  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width || 0,
    height: result.height || 0,
    duration: result.duration || 0,
    bytes: result.bytes || 0,
    resourceType: result.resource_type,
    thumbnailUrl: isVideo ? videoThumb(result.secure_url) : '',
  }
}
