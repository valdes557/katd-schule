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
  const files = req.files ? req.files : req.file ? [req.file] : []
  if (files.length === 0) return multerNext()
  try {
    const results = await Promise.all(files.map((f) => uploadBuffer(f.buffer, f.mimetype)))
    const mapped = files.map((f, i) => ({
      ...f,
      path: results[i].secure_url,
      filename: results[i].public_id,
      size: results[i].bytes,
    }))
    if (req.files) req.files = mapped
    else req.file = mapped[0]
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

module.exports = { cloudinary, upload }
