require('dotenv').config()
const connectDB = require('./config/db')
const User = require('./models/User')
const School = require('./models/School')
const SchoolPost = require('./models/SchoolPost')
const SchoolReview = require('./models/SchoolReview')
const PlatformPage = require('./models/PlatformPage')
const PlatformPaymentMethod = require('./models/PlatformPaymentMethod')

async function seedPlatform() {
  await connectDB()
  console.log('🌱 Seeding platform data...')

  // Clear existing platform data
  await SchoolPost.deleteMany({})
  await SchoolReview.deleteMany({ school: null })
  await PlatformPage.deleteMany({})
  await PlatformPaymentMethod.deleteMany({})

  const admin = await User.findOne({ role: 'super_admin' })
  const schools = await School.find({}).limit(4)
  if (!admin) { console.error('❌ No admin user found. Run seed.js first.'); process.exit(1) }

  // Create PlatformPage content
  await PlatformPage.create({
    about: {
      content: `KATD-SCHÜLE est la première plateforme africaine de gestion scolaire complète, née de la vision de connecter toutes les écoles d'Afrique francophone dans un réseau collaboratif puissant.\n\nNotre mission est simple : digitaliser l'éducation africaine, permettre à chaque établissement de gérer efficacement ses élèves, enseignants, et ressources, tout en bâtissant une communauté scolaire mondiale.\n\nDepuis notre lancement, nous accompagnons des centaines d'écoles au Cameroun, en Côte d'Ivoire, au Gabon, au Congo et au Sénégal. Nous croyons que chaque enfant mérite une éducation de qualité, et que la technologie est le levier pour y parvenir.\n\n📍 Siège : Yaoundé, Cameroun\n📧 contact@katd-schule.com\n📞 +237 699 000 000`,
      images: [],
    },
    contacts: [
      { type: 'whatsapp', label: 'WhatsApp Support', value: '+237 699 000 000' },
      { type: 'phone', label: 'Téléphone', value: '+237 699 000 000' },
      { type: 'email', label: 'Email', value: 'contact@katd-schule.com' },
    ],
    help: {
      support: 'Notre équipe de support est disponible 7j/7 de 8h à 22h. Vous pouvez nous contacter par WhatsApp, email ou via le formulaire de contact. Nous répondons sous 2 heures ouvrables.',
      faq: "Q: Comment inscrire mon école ?\nR: Cliquez sur 'Rejoindre' puis remplissez le formulaire d'inscription. Notre équipe valide votre dossier sous 48h.\n\nQ: Les données sont-elles sécurisées ?\nR: Oui, toutes les données sont chiffrées et hébergées sur des serveurs sécurisés certifiés.\n\nQ: Peut-on essayer gratuitement ?\nR: Oui, nous offrons une période d'essai de 30 jours sans engagement.\n\nQ: Comment fonctionne le paiement ?\nR: Nous acceptons MTN Mobile Money, Orange Money et virement bancaire.",
      privacy: "KATD-SCHÜLE s'engage à protéger la vie privée de tous ses utilisateurs. Les données personnelles collectées sont utilisées uniquement pour fournir nos services. Nous ne vendons jamais vos données à des tiers. Vous pouvez demander la suppression de vos données à tout moment en nous contactant.",
      terms: "En utilisant KATD-SCHÜLE, vous acceptez nos conditions générales d'utilisation. L'utilisation de la plateforme est soumise au respect de nos règles communautaires. Tout contenu inapproprié sera supprimé. Les abonnements sont non-remboursables sauf en cas de problème technique de notre part.",
    },
    resources: {
      blog: "Découvrez nos articles et guides sur la gestion scolaire moderne, les meilleures pratiques pédagogiques, et les innovations éducatives en Afrique.",
    },
    donationDescription: "Votre soutien nous aide à améliorer continuellement la plateforme et à offrir des solutions gratuites aux écoles dans le besoin. Chaque contribution, aussi petite soit-elle, fait une différence pour l'éducation en Afrique.",
    donationAccounts: [
      { accountName: 'KATD-SCHÜLE MTN', bankName: 'MTN Mobile Money', accountNumber: '6 99 00 00 00' },
      { accountName: 'KATD-SCHÜLE Orange', bankName: 'Orange Money', accountNumber: '6 55 00 00 00' },
    ],
  })
  console.log('✅ PlatformPage created')

  // Create platform payment methods
  await PlatformPaymentMethod.insertMany([
    { name: 'MTN Mobile Money', type: 'mobile_money', accountNumber: '6 99 00 00 00', accountName: 'KATD-SCHÜLE', instructions: 'Envoyez le montant au numéro MTN MoMo ci-dessus. Mentionnez votre nom d\'école comme référence.', isActive: true, sortOrder: 1 },
    { name: 'Orange Money', type: 'mobile_money', accountNumber: '6 55 00 00 00', accountName: 'KATD-SCHÜLE', instructions: 'Envoyez le montant via Orange Money. Mentionnez votre nom d\'école comme référence.', isActive: true, sortOrder: 2 },
    { name: 'Virement Bancaire', type: 'bank', accountNumber: 'CM21 10005 00001 00123456789 01', accountName: 'KATD Education SARL', instructions: 'Effectuez un virement bancaire. Mentionnez votre nom d\'école et numéro de facture.', isActive: true, sortOrder: 3 },
  ])
  console.log('✅ Payment methods created')

  // Create platform-level social posts
  const platformPosts = [
    { title: '🎉 KATD-SCHÜLE dépasse les 500 écoles inscrites !', content: 'Nous sommes fiers d\'annoncer que plus de 500 établissements scolaires font désormais confiance à notre plateforme. Merci à toutes les directrices et directeurs qui nous ont rejoints !', category: 'Éducation', isPlatform: true, isPublic: true, views: 1240 },
    { title: '📢 Nouvelle fonctionnalité : Bulletins numériques', content: 'Les directeurs peuvent maintenant générer et partager les bulletins scolaires directement depuis leur dashboard. Disponible pour tous les cycles.', category: 'Technologie', isPlatform: true, isPublic: true, views: 890 },
    { title: '🏆 Concours inter-écoles KATD 2025', content: 'KATD-SCHÜLE lance son premier concours inter-écoles en Mathématiques et Français. Les 50 meilleures écoles participantes recevront des prix spéciaux. Inscriptions ouvertes !', category: 'Éducation', isPlatform: true, isPublic: true, views: 2100 },
    { title: '📱 Application mobile disponible bientôt !', content: 'Notre application mobile pour Android et iOS est en cours de développement. Elle permettra aux parents et enseignants de suivre les élèves en temps réel. Préinscrivez-vous !', category: 'Technologie', isPlatform: true, isPublic: true, views: 3400 },
    { title: "🌍 KATD-SCHÜLE s'étend en Côte d'Ivoire et au Sénégal", content: "Suite à notre succès au Cameroun, nous sommes heureux d'annoncer notre expansion officielle en Côte d'Ivoire et au Sénégal. Des équipes locales sont déjà en place pour accompagner les écoles.", category: 'Éducation', isPlatform: true, isPublic: true, views: 1560 },
    { title: '💡 Guide : Comment digitaliser votre école en 5 étapes', content: 'Découvrez notre guide complet pour digitaliser votre établissement. De la gestion des notes à la communication avec les parents, chaque étape est détaillée avec des exemples concrets.', category: 'Ressources', isPlatform: true, isPublic: true, views: 720 },
  ]

  // School-level posts
  const schoolPosts = schools.slice(0, 2).flatMap((school, si) => [
    { school: school._id, author: admin._id, title: `Journée portes ouvertes — ${school.name}`, content: `Venez découvrir ${school.name} lors de notre journée portes ouvertes. Rencontrez nos enseignants et visitez nos installations modernes.`, category: 'Éducation', isPublic: true, views: 340 + si * 100 },
    { school: school._id, author: admin._id, title: `Résultats du 1er trimestre ${school.name}`, content: `Les résultats du premier trimestre 2025-2026 sont disponibles. La moyenne générale de l'établissement est de ${14 + si}/20. Félicitations à tous nos élèves !`, category: 'Éducation', isPublic: true, views: 450 + si * 80 },
  ])

  const allPostsData = [
    ...platformPosts.map(p => ({ ...p, author: admin._id })),
    ...schoolPosts,
  ]

  await SchoolPost.insertMany(allPostsData)
  console.log(`✅ ${allPostsData.length} posts created (${platformPosts.length} platform + ${schoolPosts.length} school)`)

  // Create approved experiences/testimonials
  await SchoolReview.insertMany([
    { school: null, authorName: 'Directeur Mballa Jean', rating: 5, content: 'KATD-SCHÜLE a complètement transformé la gestion de mon école. Je gère maintenant plus de 300 élèves avec une facilité déconcertante. Je recommande à 100% !', isApproved: true },
    { school: null, authorName: 'Mme Fouda Christine', rating: 5, content: 'Excellente plateforme ! La communication avec les parents est devenue tellement plus simple. Les bulletins numériques sont un vrai gain de temps.', isApproved: true },
    { school: null, authorName: 'M. Nguema Patrick', rating: 4, content: 'Très bonne interface, facile à prendre en main. Le support réagit rapidement. Je suggère juste d\'ajouter plus de modèles de bulletins.', isApproved: true },
    { school: null, authorName: 'Directrice Atangana Rose', rating: 5, content: 'Depuis que nous utilisons KATD-SCHÜLE, notre école est beaucoup mieux organisée. Les parents adorent le suivi en temps réel de leurs enfants.', isApproved: true },
    { school: null, authorName: 'M. Tchamba Alain', rating: 5, content: 'Parfait pour une école comme la nôtre avec 3 cycles. Tout est bien séparé et organisé. Le tableau de bord est très intuitif.', isApproved: true },
    { school: null, authorName: 'Mme Kamga Paulette', rating: 4, content: 'Très bonne plateforme. J\'utilise KATD-SCHÜLE depuis 6 mois et je n\'ai jamais eu de problèmes. Le système de gestion de présence est particulièrement utile.', isApproved: true },
  ])
  console.log('✅ Experiences (testimonials) created')

  console.log('\n🎉 Platform seed complete!')
  process.exit(0)
}

seedPlatform().catch((err) => { console.error('❌ Error:', err); process.exit(1) })
