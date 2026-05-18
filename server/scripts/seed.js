require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const School = require('../models/School')

const demoUsers = [
  {
    name: 'Super Admin KATD',
    email: 'admin@katdschule.com',
    password: 'admin123',
    role: 'super_admin',
  },
  {
    name: 'Mme Diop Aïcha (Directrice)',
    email: 'directeur@ecole.ci',
    password: 'demo123',
    role: 'directeur',
    phone: '+225 07 12 34 56 78',
  },
  {
    name: 'M. Diop Ousmane',
    email: 'enseignant@ecole.ci',
    password: 'demo123',
    role: 'enseignant',
    phone: '+225 07 22 33 44 55',
  },
  {
    name: 'Mme Kouassi Fatou',
    email: 'parent@ecole.ci',
    password: 'demo123',
    role: 'parent',
    phone: '+225 05 11 22 33 44',
  },
  {
    name: 'Yao Amani',
    email: 'eleve@ecole.ci',
    password: 'demo123',
    role: 'eleve',
  },
]

const demoSchool = {
  name: 'École Les Petits Génies',
  description: "École primaire d'excellence située à Abidjan, Côte d'Ivoire",
  cycles: ['Maternelle', 'Primaire'],
  address: { city: 'Abidjan', country: "Côte d'Ivoire" },
  contact: {
    email: 'contact@petitsgenies.ci',
    phone: '+225 27 22 44 55 66',
  },
  isValidated: true,
  isActive: true,
  subscription: {
    cycle: 'Primaire',
    plan: 'annual',
    status: 'active',
    startDate: new Date('2023-09-01'),
    endDate: new Date('2024-08-31'),
    amount: 40000,
  },
  stats: { totalStudents: 248, totalTeachers: 18, totalClasses: 12 },
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connecté à MongoDB')

    console.log('🧹 Nettoyage des données existantes...')
    await User.deleteMany({ email: { $in: demoUsers.map((u) => u.email) } })
    await School.deleteMany({ name: demoSchool.name })

    console.log('🏫 Création de l\'école démo...')
    const school = await School.create(demoSchool)

    console.log('👥 Création des utilisateurs démo...')
    for (const u of demoUsers) {
      const user = await User.create({
        ...u,
        school: u.role !== 'super_admin' ? school._id : undefined,
      })
      console.log(`   ✓ ${u.role.padEnd(13)} → ${u.email}  /  ${u.password}`)

      if (u.role === 'directeur') {
        school.director = user._id
        await school.save()
      }
    }

    console.log('\n🎉 Seed terminé avec succès !')
    console.log('\n┌─ COMPTES DE DÉMONSTRATION ──────────────────────────────┐')
    console.log('│ Rôle         │ Email                    │ Mot de passe │')
    console.log('├──────────────┼──────────────────────────┼──────────────┤')
    demoUsers.forEach((u) => {
      console.log(`│ ${u.role.padEnd(12)} │ ${u.email.padEnd(24)} │ ${u.password.padEnd(12)} │`)
    })
    console.log('└──────────────┴──────────────────────────┴──────────────┘')

    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('❌ Erreur seed :', err)
    process.exit(1)
  }
}

seed()
