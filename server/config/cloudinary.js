const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const multer = require('multer')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = 'katd-schule/general'
    if (file.mimetype.startsWith('video')) folder = 'katd-schule/videos'
    else if (file.mimetype.startsWith('image')) folder = 'katd-schule/images'
    else folder = 'katd-schule/files'

    return {
      folder,
      resource_type: file.mimetype.startsWith('video') ? 'video' : 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'pdf'],
    }
  },
})

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

module.exports = { cloudinary, upload }
