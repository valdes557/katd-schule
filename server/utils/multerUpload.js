const multer = require('multer')
const path = require('path')

/**
 * Create a multer disk-storage upload instance.
 *
 * @param {object} opts
 * @param {string}  [opts.prefix='']       - Filename prefix (e.g. 'proof-', 'report-').
 * @param {RegExp}  [opts.allowedExts]     - Regex of allowed extensions (e.g. /jpeg|jpg|png/).
 * @param {function} [opts.fileFilter]     - Custom file filter overriding allowedExts.
 * @param {number}  [opts.maxSize=10*1024*1024] - Max file size in bytes (default 10 MB).
 * @param {string}  [opts.dest='uploads/'] - Upload destination directory.
 */
function createUpload({ prefix = '', allowedExts, fileFilter: customFilter, maxSize = 10 * 1024 * 1024, dest = 'uploads/' } = {}) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
      cb(null, `${prefix}${unique}${path.extname(file.originalname)}`)
    },
  })

  const fileFilter = customFilter || (allowedExts
    ? (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
        if (allowedExts.test(ext)) cb(null, true)
        else cb(new Error('Type de fichier non autoris\u00e9'), false)
      }
    : undefined)

  return multer({ storage, fileFilter, limits: { fileSize: maxSize } })
}

module.exports = { createUpload }
