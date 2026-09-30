const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const BlogPost = require('../models/BlogPost')
const BlogCategory = require('../models/BlogCategory')
const User = require('../models/User')
const { protect } = require('../middleware/auth')
const { upload } = require('../config/cloudinary')
const { sendNewBlogNotificationEmail } = require('../utils/emailService')

// Rôles autorisés à publier des articles de blog (Super Admin + tout le personnel Primaire et Secondaire)
const STAFF_ROLES = [
  'super_admin',
  'directeur',
  'enseignant',
  'vice_principal',
  'surveillant_general',
  'caissiere',
  'secretaire',
  'portier',
]

const staffOnly = (req, res, next) => {
  if (!req.user || !STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Seul le personnel de la plateforme peut publier ou gérer des articles de blog.' })
  }
  next()
}

// Middleware d'authentification optionnelle (ne bloque pas si non connecté, mais peuple req.user si token valide)
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password')
    } catch (_) {}
  }
  next()
}

// Génère un slug propre à partir d'un titre
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80)
}

// ── GET /api/blogs/categories — Liste des catégories ──
router.get('/categories', async (req, res) => {
  try {
    const categories = await BlogCategory.find().sort({ name: 1 })
    // Compter les articles par catégorie
    const counts = await BlogPost.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$categoryName', count: { $sum: 1 } } },
    ])
    const countMap = {}
    counts.forEach((c) => { countMap[c._id] = c.count })

    const data = categories.map((cat) => ({
      _id: cat._id,
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      description: cat.description,
      articlesCount: countMap[cat.name] || 0,
    }))
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── POST /api/blogs/categories — Créer une catégorie (staff) ──
router.post('/categories', protect, staffOnly, async (req, res) => {
  try {
    const { name, description, color } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Le nom de la catégorie est obligatoire' })
    }
    const slug = slugify(name)
    const existing = await BlogCategory.findOne({ $or: [{ name: name.trim() }, { slug }] })
    if (existing) {
      return res.status(400).json({ message: 'Cette catégorie existe déjà' })
    }
    const cat = await BlogCategory.create({
      name: name.trim(),
      slug,
      description: description || '',
      color: color || 'blue',
      createdBy: req.user._id,
    })
    res.status(201).json({ success: true, data: cat, message: 'Catégorie créée avec succès' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET /api/blogs — Liste des articles ──
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12, author, sort = 'recent' } = req.query
    const query = { status: 'published' }

    if (category && category !== 'all') {
      query.categoryName = category
    }
    if (author) {
      query.author = author
    }
    if (search && search.trim()) {
      const q = search.trim()
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } },
        { categoryName: { $regex: q, $options: 'i' } },
      ]
    }

    let sortOption = { createdAt: -1 }
    if (sort === 'popular') sortOption = { views: -1, createdAt: -1 }
    else if (sort === 'likes') sortOption = { likesCount: -1, createdAt: -1 }

    const skip = (Number(page) - 1) * Number(limit)
    const total = await BlogPost.countDocuments(query)

    const posts = await BlogPost.find(query)
      .select('-content -viewedIps') // Allège la liste, content récupéré sur la page détail
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit))
      .populate('author', 'name avatar role')

    const userId = req.user?._id ? String(req.user._id) : null

    const data = posts.map((p) => {
      const isLiked = userId ? p.likes.some((l) => String(l) === userId) : false
      return {
        _id: p._id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        coverImage: p.coverImage,
        categoryName: p.categoryName,
        category: p.category,
        author: p.author,
        authorName: p.authorName || p.author?.name || 'Auteur',
        authorRole: p.authorRole || p.author?.role || 'Personnel',
        authorAvatar: p.authorAvatar || p.author?.avatar || '',
        schoolName: p.schoolName || '',
        views: p.views,
        likesCount: p.likes?.length || 0,
        commentsCount: p.comments?.length || 0,
        sharesCount: p.sharesCount || 0,
        isLiked,
        createdAt: p.createdAt,
      }
    })

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      data,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET /api/blogs/my/stats — Statistiques des articles de l'auteur connecté ──
router.get('/my/stats', protect, staffOnly, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin'
    const query = isSuperAdmin ? {} : { author: req.user._id }

    const posts = await BlogPost.find(query).sort({ createdAt: -1 })

    let totalViews = 0
    let totalLikes = 0
    let totalComments = 0
    let totalShares = 0

    const articles = posts.map((p) => {
      const v = p.views || 0
      const l = p.likes?.length || 0
      const c = p.comments?.length || 0
      const s = p.sharesCount || 0

      totalViews += v
      totalLikes += l
      totalComments += c
      totalShares += s

      return {
        _id: p._id,
        title: p.title,
        slug: p.slug,
        coverImage: p.coverImage,
        categoryName: p.categoryName,
        status: p.status,
        views: v,
        likesCount: l,
        commentsCount: c,
        sharesCount: s,
        createdAt: p.createdAt,
      }
    })

    res.json({
      success: true,
      stats: {
        totalArticles: posts.length,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
      },
      articles,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── GET /api/blogs/:idOrSlug — Détail d'un article avec incrémentation de vue ──
router.get('/:idOrSlug', optionalAuth, async (req, res) => {
  try {
    const { idOrSlug } = req.params
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(idOrSlug)
    const filter = isMongoId ? { _id: idOrSlug } : { slug: idOrSlug }

    const post = await BlogPost.findOne(filter).populate('author', 'name avatar role')
    if (!post) {
      return res.status(404).json({ message: 'Article introuvable' })
    }

    // Incrémenter la vue avec dédoublonnage par IP
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
    const ipStr = String(clientIp).split(',')[0].trim()
    if (!post.viewedIps) post.viewedIps = []
    if (!post.viewedIps.includes(ipStr)) {
      post.viewedIps.push(ipStr)
      if (post.viewedIps.length > 500) post.viewedIps.shift()
      post.views = (post.views || 0) + 1
      await post.save({ validateBeforeSave: false })
    }

    const userId = req.user?._id ? String(req.user._id) : null
    const isLiked = userId ? post.likes.some((l) => String(l) === userId) : false

    // Lecture publique complète de l'article (accessible à tous les visiteurs et aux robots Google)
    // Seules les actions d'écriture (aimer, commenter) nécessitent une connexion.

    // Utilisateur connecté : contenu complet et commentaires
    res.json({
      success: true,
      requiresAuth: false,
      data: {
        _id: post._id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        coverImage: post.coverImage,
        categoryName: post.categoryName,
        category: post.category,
        author: post.author,
        authorName: post.authorName || post.author?.name || 'Auteur',
        authorRole: post.authorRole || post.author?.role || 'Personnel',
        authorAvatar: post.authorAvatar || post.author?.avatar || '',
        schoolName: post.schoolName || '',
        views: post.views,
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0,
        sharesCount: post.sharesCount || 0,
        isLiked,
        comments: post.comments || [],
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── POST /api/blogs — Rédiger un nouvel article (staff) ──
router.post('/', protect, staffOnly, upload.single('coverImage'), async (req, res) => {
  try {
    const { title, content, categoryName, excerpt, status = 'published' } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Le titre de l\'article est obligatoire' })
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Le contenu de l\'article est obligatoire' })
    }

    // Image de couverture : upload Cloudinary ou lien direct fourni dans le corps
    const coverImage = req.file?.path || req.body.coverImageUrl || ''

    // Résoudre la catégorie
    let catDoc = null
    const catName = (categoryName || 'Général').trim()
    catDoc = await BlogCategory.findOne({ name: catName })
    if (!catDoc) {
      catDoc = await BlogCategory.create({
        name: catName,
        slug: slugify(catName),
        color: 'blue',
        createdBy: req.user._id,
      })
    }

    // Slug unique
    const baseSlug = slugify(title)
    const randomSuffix = Math.random().toString(36).substring(2, 7)
    const slug = `${baseSlug}-${randomSuffix}`

    // Résumé automatique si non fourni
    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const autoExcerpt = excerpt && excerpt.trim() ? excerpt.trim() : plainText.slice(0, 220) + (plainText.length > 220 ? '...' : '')

    const post = await BlogPost.create({
      title: title.trim(),
      slug,
      content,
      excerpt: autoExcerpt,
      coverImage,
      category: catDoc._id,
      categoryName: catDoc.name,
      author: req.user._id,
      authorName: req.user.name || '',
      authorRole: req.user.role || 'Personnel',
      authorAvatar: req.user.avatar || '',
      school: req.user.school?._id || req.user.school || undefined,
      schoolName: req.user.school?.name || '',
      status: status === 'draft' ? 'draft' : 'published',
      isPublic: true,
    })

    // Notification par email à tous les utilisateurs UNIQUEMENT si l'article est publié par le super_admin
    const isSuperAdmin = req.user.role === 'super_admin'
    if (post.status === 'published' && isSuperAdmin) {
      setImmediate(async () => {
        try {
          const users = await User.find({ email: { $exists: true, $ne: '' }, isActive: { $ne: false } })
            .select('email name')
            .lean()
          const clientUrl = process.env.CLIENT_URL || 'https://katdschool.com'
          await sendNewBlogNotificationEmail({ post, users, clientUrl })
        } catch (emailErr) {
          console.error('[Blog Notification Email Error]:', emailErr.message)
        }
      })
    }

    res.status(201).json({
      success: true,
      data: post,
      message: 'Article de blog publié avec succès !',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── PUT /api/blogs/:id — Modifier un article (auteur ou super_admin) ──
router.put('/:id', protect, staffOnly, upload.single('coverImage'), async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Article introuvable' })

    const isAuthor = String(post.author) === String(req.user._id)
    const isSuperAdmin = req.user.role === 'super_admin'
    if (!isAuthor && !isSuperAdmin) {
      return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres articles' })
    }

    const wasDraft = post.status === 'draft'
    const { title, content, categoryName, excerpt, status } = req.body

    if (title && title.trim()) post.title = title.trim()
    if (content && content.trim()) post.content = content
    if (status) post.status = status

    if (req.file?.path) {
      post.coverImage = req.file.path
    } else if (req.body.coverImageUrl) {
      post.coverImage = req.body.coverImageUrl
    }

    if (categoryName && categoryName.trim()) {
      post.categoryName = categoryName.trim()
      const cat = await BlogCategory.findOne({ name: categoryName.trim() })
      if (cat) post.category = cat._id
    }

    if (excerpt !== undefined) {
      post.excerpt = excerpt.trim()
    } else if (content) {
      const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      post.excerpt = plainText.slice(0, 220) + (plainText.length > 220 ? '...' : '')
    }

    await post.save()

    // Si l'article passe de brouillon à publié, on notifie UNIQUEMENT si l'auteur/modificateur est le super_admin
    if (wasDraft && post.status === 'published' && isSuperAdmin) {
      setImmediate(async () => {
        try {
          const users = await User.find({ email: { $exists: true, $ne: '' }, isActive: { $ne: false } })
            .select('email name')
            .lean()
          const clientUrl = process.env.CLIENT_URL || 'https://katdschool.com'
          await sendNewBlogNotificationEmail({ post, users, clientUrl })
        } catch (emailErr) {
          console.error('[Blog Notification Email Error]:', emailErr.message)
        }
      })
    }

    res.json({ success: true, data: post, message: 'Article mis à jour' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── DELETE /api/blogs/:id — Supprimer un article (auteur ou super_admin) ──
router.delete('/:id', protect, staffOnly, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Article introuvable' })

    const isAuthor = String(post.author) === String(req.user._id)
    const isSuperAdmin = req.user.role === 'super_admin'
    if (!isAuthor && !isSuperAdmin) {
      return res.status(403).json({ message: 'Action non autorisée' })
    }

    await BlogPost.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Article supprimé' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── POST /api/blogs/:id/like — Liker / retirer le like (connecté) ──
router.post('/:id/like', protect, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Article introuvable' })

    const userId = req.user._id
    const index = post.likes.findIndex((l) => String(l) === String(userId))
    let liked = false

    if (index > -1) {
      post.likes.splice(index, 1)
      liked = false
    } else {
      post.likes.push(userId)
      liked = true
    }

    await post.save({ validateBeforeSave: false })
    res.json({
      success: true,
      liked,
      likesCount: post.likes.length,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── POST /api/blogs/:id/comments — Ajouter un commentaire (connecté) ──
router.post('/:id/comments', protect, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Le commentaire ne peut pas être vide' })
    }

    const post = await BlogPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Article introuvable' })

    const newComment = {
      user: req.user._id,
      userName: req.user.name || 'Utilisateur',
      userAvatar: req.user.avatar || '',
      content: content.trim(),
      createdAt: new Date(),
    }

    post.comments.push(newComment)
    await post.save({ validateBeforeSave: false })

    res.status(201).json({
      success: true,
      comment: newComment,
      commentsCount: post.comments.length,
      message: 'Commentaire ajouté',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ── POST /api/blogs/:id/share — Incrémenter le compteur de partages ──
router.post('/:id/share', async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Article introuvable' })
    post.sharesCount = (post.sharesCount || 0) + 1
    await post.save({ validateBeforeSave: false })
    res.json({ success: true, sharesCount: post.sharesCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
