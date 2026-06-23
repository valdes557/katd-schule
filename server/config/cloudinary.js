const cloudinary = require('cloudinary').v2
const multer = require('multer')
const { Readable } = require('stream')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const memStorage = multer.memoryStorage()
const parseMultipart = multer({ storage: memStorage, limits: { fileSize: 100 * 1024 * 1024 } })

function uploadBuffer(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    let folder = 'katd-schule/general'
    if (mimetype.startsWith('video')) folder = 'katd-schule/videos'
    else if (mimetype.startsWith('image')) folder = 'katd-schule/images'
    else folder = 'katd-schule/files'

    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: mimetype.startsWith('video') ? 'video' : 'auto' },
      (err, result) => { if (err) return reject(err); resolve(result) }
    )
    Readable.from(buffer).pipe(stream)
  })
}

async function processFiles(req, res, multerNext) {
  // Detect mode: upload.fields() produces req.files as object {fieldName: [files]},
  // upload.array() produces req.files as a flat array, upload.single() produces req.file
  const isFieldsMode = req.files && !Array.isArray(req.files) && typeof req.files === 'object'
  let allFiles = []
  if (isFieldsMode) {
    Object.values(req.files).forEach((arr) => { if (Array.isArray(arr)) allFiles.push(...arr) })
  } else if (Array.isArray(req.files)) {
    allFiles = req.files
  } else if (req.file) {
    allFiles = [req.file]
  }
  if (allFiles.length === 0) return multerNext()

  try {
    const results = await Promise.all(allFiles.map((f) => uploadBuffer(f.buffer, f.mimetype)))
    const mapWithUrl = (f, i) => ({
      ...f,
      path: results[i].secure_url,
      filename: results[i].public_id,
      size: results[i].bytes,
      width: results[i].width,
      height: results[i].height,
    })

    if (isFieldsMode) {
      // Re-build the object structure with mapped files
      let idx = 0
      const out = {}
      Object.entries(req.files).forEach(([field, arr]) => {
        out[field] = arr.map((f) => mapWithUrl(f, idx++))
      })
      req.files = out
    } else if (Array.isArray(req.files)) {
      req.files = allFiles.map(mapWithUrl)
    } else if (req.file) {
      req.file = mapWithUrl(req.file, 0)
    }
    multerNext()
  } catch (e) { multerNext(e) }
}

const upload = {
  array(fieldName, maxCount = 10) {
    const mw = parseMultipart.array(fieldName, maxCount)
    return (req, res, next) => mw(req, res, (err) => err ? next(err) : processFiles(req, res, next))
  },
  single(fieldName) {
    const mw = parseMultipart.single(fieldName)
    return (req, res, next) => mw(req, res, (err) => err ? next(err) : processFiles(req, res, next))
  },
  fields(fieldsList) {
    const mw = parseMultipart.fields(fieldsList)
    return (req, res, next) => mw(req, res, (err) => err ? next(err) : processFiles(req, res, next))
  },
}

// Construit l'URL d'une miniature image (1re frame) à partir de l'URL Cloudinary d'une vidéo.
// Ex: .../video/upload/v123/dossier/clip.mp4 → .../video/upload/so_0/v123/dossier/clip.jpg
// Fonctionne aussi en rétroactif sur les vidéos déjà publiées (transformation à la volée).
function videoThumbnailUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return ''
  if (!videoUrl.includes('/upload/')) return ''
  // Insère la transformation so_0 (start offset 0s) juste après /upload/
  const withTransform = videoUrl.replace('/upload/', '/upload/so_0/')
  // Remplace l'extension vidéo par .jpg
  return withTransform.replace(/\.(mp4|mov|webm|avi|mkv|m4v|ogv)(\?.*)?$/i, '.jpg$2')
}

module.exports = { cloudinary, upload, videoThumbnailUrl }
