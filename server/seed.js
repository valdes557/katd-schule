require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const connectDB = require('./config/db')

const User = require('./models/User')
const School = require('./models/School')
const Student = require('./models/Student')
const Teacher = require('./models/Teacher')
const Class = require('./models/Class')
const Grade = require('./models/Grade')
const Attendance = require('./models/Attendance')
const Media = require('./models/Media')
const Message = require('./models/Message')
const Location = require('./models/Location')
const Enrollment = require('./models/Enrollment')
const SchoolRegistration = require('./models/SchoolRegistration')

async function seed() {
  await connectDB()
  console.log('🌱 Seeding database...')

  // Clear all collections
  await Promise.all([
    User.deleteMany({}),
    School.deleteMany({}),
    Student.deleteMany({}),
    Teacher.deleteMany({}),
    Class.deleteMany({}),
    Grade.deleteMany({}),
    Attendance.deleteMany({}),
    Media.deleteMany({}),
    Message.deleteMany({}),
    Location.deleteMany({}),
    Enrollment.deleteMany({}),
    SchoolRegistration.deleteMany({}),
  ])

  // Create locations
  const cameroun = await Location.create({ type: 'country', name: 'Cameroun', code: 'CM' })
  const gabon = await Location.create({ type: 'country', name: 'Gabon', code: 'GA' })
  const congo = await Location.create({ type: 'country', name: 'Congo', code: 'CG' })
  const civ = await Location.create({ type: 'country', name: "Côte d'Ivoire", code: 'CI' })
  const senegal = await Location.create({ type: 'country', name: 'Sénégal', code: 'SN' })

  const yaounde = await Location.create({ type: 'city', name: 'Yaoundé', parent: cameroun._id })
  const douala = await Location.create({ type: 'city', name: 'Douala', parent: cameroun._id })
  const bafoussam = await Location.create({ type: 'city', name: 'Bafoussam', parent: cameroun._id })
  const garoua = await Location.create({ type: 'city', name: 'Garoua', parent: cameroun._id })
  const bamenda = await Location.create({ type: 'city', name: 'Bamenda', parent: cameroun._id })
  await Location.create({ type: 'city', name: 'Libreville', parent: gabon._id })
  await Location.create({ type: 'city', name: 'Port-Gentil', parent: gabon._id })
  await Location.create({ type: 'city', name: 'Brazzaville', parent: congo._id })
  await Location.create({ type: 'city', name: 'Pointe-Noire', parent: congo._id })
  await Location.create({ type: 'city', name: 'Abidjan', parent: civ._id })
  await Location.create({ type: 'city', name: 'Yamoussoukro', parent: civ._id })
  await Location.create({ type: 'city', name: 'Dakar', parent: senegal._id })

  await Location.insertMany([
    { type: 'neighborhood', name: 'Bastos', parent: yaounde._id },
    { type: 'neighborhood', name: 'Nlongkak', parent: yaounde._id },
    { type: 'neighborhood', name: 'Essos', parent: yaounde._id },
    { type: 'neighborhood', name: 'Mvog-Mbi', parent: yaounde._id },
    { type: 'neighborhood', name: 'Mvan', parent: yaounde._id },
    { type: 'neighborhood', name: 'Bonamoussadi', parent: douala._id },
    { type: 'neighborhood', name: 'Akwa', parent: douala._id },
    { type: 'neighborhood', name: 'Deïdo', parent: douala._id },
    { type: 'neighborhood', name: 'Bonapriso', parent: douala._id },
    { type: 'neighborhood', name: 'Tamdja', parent: bafoussam._id },
    { type: 'neighborhood', name: 'Djeleng', parent: bafoussam._id },
  ])
  console.log('📍 Locations created')

  // Create school
  const school = await School.create({
    name: 'Complexe Scolaire KATD',
    cycles: ['Maternelle', 'Primaire', 'Secondaire'],
    address: { city: 'Yaoundé', neighborhood: 'Bastos', country: 'Cameroun' },
    phone: '+237 699 000 000',
    email: 'contact@katd-schule.cm',
    subscription: { plan: 'premium', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000) },
  })

  // Create users
  const password = await bcrypt.hash('password123', 10)
  const users = await User.insertMany([
    { name: 'Directeur KATD', email: 'directeur@katd.com', password, role: 'directeur', school: school._id, isActive: true },
    { name: 'M. Nkoulou Pierre', email: 'enseignant@katd.com', password, role: 'enseignant', school: school._id, isActive: true },
    { name: 'Mme Fotso Marie', email: 'enseignant2@katd.com', password, role: 'enseignant', school: school._id, isActive: true },
    { name: 'Parent Mbarga', email: 'parent@katd.com', password, role: 'parent', school: school._id, isActive: true },
    { name: 'Super Admin', email: 'admin@katd.com', password, role: 'super_admin', school: school._id, isActive: true },
  ])

  const [directeur, enseignant1, enseignant2, parent, admin] = users

  // Update school director
  await School.findByIdAndUpdate(school._id, { director: directeur._id })

  // Create classes
  const classesData = [
    { name: 'SIL', level: 'SIL', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 35, enrollmentFee: 25000 },
    { name: 'CP', level: 'CP', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 35, enrollmentFee: 25000 },
    { name: 'CE1', level: 'CE1', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 40, enrollmentFee: 30000 },
    { name: 'CE2', level: 'CE2', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 40, enrollmentFee: 30000 },
    { name: 'CM1', level: 'CM1', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 40, enrollmentFee: 35000 },
    { name: 'CM2', level: 'CM2', cycle: 'Primaire', school: school._id, academicYear: '2025-2026', capacity: 45, enrollmentFee: 35000 },
    { name: '6ème A', level: '6ème', cycle: 'Secondaire', school: school._id, academicYear: '2025-2026', capacity: 50, enrollmentFee: 50000 },
    { name: '5ème A', level: '5ème', cycle: 'Secondaire', school: school._id, academicYear: '2025-2026', capacity: 50, enrollmentFee: 50000 },
    { name: '4ème A', level: '4ème', cycle: 'Secondaire', school: school._id, academicYear: '2025-2026', capacity: 50, enrollmentFee: 55000 },
    { name: '3ème A', level: '3ème', cycle: 'Secondaire', school: school._id, academicYear: '2025-2026', capacity: 50, enrollmentFee: 60000 },
    { name: 'PS', level: 'PS', cycle: 'Maternelle', school: school._id, academicYear: '2025-2026', capacity: 25, enrollmentFee: 20000 },
    { name: 'MS', level: 'MS', cycle: 'Maternelle', school: school._id, academicYear: '2025-2026', capacity: 25, enrollmentFee: 20000 },
    { name: 'GS', level: 'GS', cycle: 'Maternelle', school: school._id, academicYear: '2025-2026', capacity: 30, enrollmentFee: 22000 },
  ]
  const classes = await Class.insertMany(classesData)

  // Create teachers
  const teachersData = [
    { firstName: 'Pierre', lastName: 'Nkoulou', email: 'enseignant@katd.com', phone: '+237 690 111 111', gender: 'M', school: school._id, subjects: ['Mathématiques', 'Sciences'], speciality: 'Mathématiques', user: enseignant1._id, classes: [classes[4]._id, classes[5]._id] },
    { firstName: 'Marie', lastName: 'Fotso', email: 'enseignant2@katd.com', phone: '+237 690 222 222', gender: 'F', school: school._id, subjects: ['Français', 'Histoire'], speciality: 'Lettres', user: enseignant2._id, classes: [classes[3]._id, classes[4]._id] },
    { firstName: 'Jean', lastName: 'Mballa', email: 'mballa@katd.com', phone: '+237 690 333 333', gender: 'M', school: school._id, subjects: ['Anglais', 'Français'], speciality: 'Langues', classes: [classes[6]._id, classes[7]._id] },
    { firstName: 'Cécile', lastName: 'Nguema', email: 'nguema@katd.com', phone: '+237 690 444 444', gender: 'F', school: school._id, subjects: ['SVT', 'Chimie'], speciality: 'Sciences', classes: [classes[8]._id, classes[9]._id] },
    { firstName: 'Paul', lastName: 'Essomba', email: 'essomba@katd.com', phone: '+237 690 555 555', gender: 'M', school: school._id, subjects: ['EPS', 'Musique'], speciality: 'EPS', classes: [classes[0]._id, classes[1]._id] },
    { firstName: 'Rose', lastName: 'Atangana', email: 'atangana@katd.com', phone: '+237 690 666 666', gender: 'F', school: school._id, subjects: ['Mathématiques'], speciality: 'Mathématiques', classes: [classes[6]._id] },
    { firstName: 'Samuel', lastName: 'Biya', email: 'biya@katd.com', phone: '+237 690 777 777', gender: 'M', school: school._id, subjects: ['Physique', 'Technologie'], speciality: 'Physique', classes: [classes[7]._id, classes[8]._id] },
    { firstName: 'Agathe', lastName: 'Meka', email: 'meka@katd.com', phone: '+237 690 888 888', gender: 'F', school: school._id, subjects: ['Arts plastiques', 'Dessin'], speciality: 'Arts', classes: [classes[10]._id, classes[11]._id, classes[12]._id] },
  ]
  const teachers = await Teacher.insertMany(teachersData)

  // Assign mainTeacher to classes
  await Class.findByIdAndUpdate(classes[4]._id, { mainTeacher: teachers[0]._id })
  await Class.findByIdAndUpdate(classes[3]._id, { mainTeacher: teachers[1]._id })
  await Class.findByIdAndUpdate(classes[6]._id, { mainTeacher: teachers[2]._id })

  // Create students
  const firstNames = ['Amara', 'Brice', 'Cédric', 'Diane', 'Emmanuel', 'Fanta', 'Gaston', 'Hélène', 'Ibrahim', 'Josiane', 'Kevin', 'Linda', 'Martial', 'Noémie', 'Olivier', 'Patricia', 'Quentin', 'Rachelle', 'Serge', 'Thérèse', 'Ulrich', 'Vanessa', 'William', 'Xavière', 'Yannick', 'Zoé', 'Aïcha', 'Boris', 'Chantal', 'Denis']
  const lastNames = ['Mbarga', 'Nguema', 'Atangana', 'Fouda', 'Nkoulou', 'Essomba', 'Biya', 'Meka', 'Onana', 'Tchoumi', 'Kamga', 'Nganou', 'Fotso', 'Tchinda', 'Mbouda']

  const studentsData = []
  const year = new Date().getFullYear()
  for (let i = 0; i < 60; i++) {
    const classIndex = i % classes.length
    const cls = classes[classIndex]
    studentsData.push({
      firstName: firstNames[i % firstNames.length],
      lastName: lastNames[i % lastNames.length],
      matricule: `STU-${year}-${String(i + 1).padStart(4, '0')}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      school: school._id,
      class: cls._id,
      cycle: cls.cycle,
      dateOfBirth: new Date(2010 + (i % 8), i % 12, (i % 28) + 1),
      parent: { name: `Parent ${lastNames[i % lastNames.length]}`, phone: `+237 67${String(i).padStart(7, '0')}` },
      status: 'active',
    })
  }
  const students = await Student.insertMany(studentsData)

  // Update class stats
  for (const cls of classes) {
    const count = students.filter((s) => s.class.toString() === cls._id.toString()).length
    await Class.findByIdAndUpdate(cls._id, { 'stats.totalStudents': count })
  }

  // Create grades
  const subjects = ['Mathématiques', 'Français', 'Anglais', 'Sciences', 'Histoire', 'EPS']
  const terms = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3']
  const types = ['devoir', 'examen', 'composition']
  const gradesData = []
  for (let i = 0; i < students.length; i++) {
    const s = students[i]
    for (let j = 0; j < 3; j++) {
      const subject = subjects[j % subjects.length]
      gradesData.push({
        student: s._id,
        class: s.class,
        school: school._id,
        subject,
        teacher: teachers[j % teachers.length]._id,
        type: types[j % types.length],
        value: Math.round((8 + Math.random() * 12) * 10) / 10,
        coefficient: j === 2 ? 2 : 1,
        term: terms[0],
        academicYear: '2025-2026',
        date: new Date(2025, 9, 10 + j * 5),
      })
    }
  }
  await Grade.insertMany(gradesData)

  // Create attendance records
  const attendanceData = []
  for (let d = 0; d < 5; d++) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    for (const cls of classes.slice(0, 5)) {
      const classStudents = students.filter((s) => s.class.toString() === cls._id.toString())
      const records = classStudents.map((s) => ({
        student: s._id,
        status: Math.random() > 0.15 ? 'present' : Math.random() > 0.5 ? 'absent' : 'late',
      }))
      const summary = {
        total: records.length,
        present: records.filter((r) => r.status === 'present').length,
        absent: records.filter((r) => r.status === 'absent').length,
        late: records.filter((r) => r.status === 'late').length,
        excused: 0,
      }
      attendanceData.push({ class: cls._id, school: school._id, teacher: teachers[0]._id, date, records, summary })
    }
  }
  await Attendance.insertMany(attendanceData)

  // Create media content
  const mediaData = [
    { title: 'Cérémonie de remise des prix 2025', type: 'video', school: school._id, uploadedBy: directeur._id, category: 'Cérémonies', description: 'Les meilleurs élèves de l\'année récompensés lors de la cérémonie annuelle.', isPublic: true, stats: { likes: 45, comments: 12, shares: 8, downloads: 3, views: 230 } },
    { title: 'Journée sportive inter-classes', type: 'photo', school: school._id, uploadedBy: directeur._id, category: 'Sports', description: 'Compétitions de football, course et saut en longueur entre les classes.', isPublic: true, stats: { likes: 32, comments: 7, shares: 5, downloads: 2, views: 150 } },
    { title: 'Expérience scientifique CM2', type: 'video', school: school._id, uploadedBy: enseignant1._id, category: 'Sciences', description: 'Les élèves de CM2 réalisent une expérience sur les volcans.', isPublic: true, stats: { likes: 28, comments: 9, shares: 4, downloads: 1, views: 120 } },
    { title: 'Chorale de Noël', type: 'audio', school: school._id, uploadedBy: enseignant2._id, category: 'Arts & Culture', description: 'Les élèves chantent des cantiques pour le spectacle de fin d\'année.', isPublic: true, stats: { likes: 55, comments: 15, shares: 12, downloads: 8, views: 300 } },
    { title: 'Sortie au musée national', type: 'photo', school: school._id, uploadedBy: directeur._id, category: 'Sorties pédagogiques', description: 'Visite guidée au musée national pour les classes de 6ème.', isPublic: true, stats: { likes: 21, comments: 5, shares: 3, downloads: 1, views: 95 } },
    { title: 'Concours de dictée régional', type: 'video', school: school._id, uploadedBy: enseignant2._id, category: 'Concours', description: 'Nos élèves brillent au concours de dictée de la région Centre.', isPublic: true, stats: { likes: 38, comments: 11, shares: 7, downloads: 4, views: 180 } },
    { title: 'Atelier poterie maternelle', type: 'photo', school: school._id, uploadedBy: directeur._id, category: 'Arts & Culture', description: 'Les petits artistes créent des objets en argile.', isPublic: true, stats: { likes: 19, comments: 4, shares: 2, downloads: 0, views: 70 } },
    { title: 'Conférence sur l\'environnement', type: 'video', school: school._id, uploadedBy: directeur._id, category: 'Conférences', description: 'Un expert en écologie sensibilise nos élèves au réchauffement climatique.', isPublic: true, stats: { likes: 42, comments: 14, shares: 9, downloads: 5, views: 210 } },
  ]
  await Media.insertMany(mediaData)

  // Create messages
  const messagesData = [
    { conversationId: `conv_${directeur._id}_${enseignant1._id}`, sender: enseignant1._id, recipient: directeur._id, school: school._id, subject: 'Résultats du devoir', body: 'Bonjour Directeur, les résultats du devoir de mathématiques sont disponibles. La moyenne est de 13.4/20.', read: true },
    { conversationId: `conv_${directeur._id}_${enseignant1._id}`, sender: directeur._id, recipient: enseignant1._id, school: school._id, subject: 'Résultats du devoir', body: 'Merci M. Nkoulou. Pouvez-vous envoyer le détail par élève ?', read: true },
    { conversationId: `conv_${directeur._id}_${enseignant1._id}`, sender: enseignant1._id, recipient: directeur._id, school: school._id, subject: 'Résultats du devoir', body: 'Bien sûr, je prépare le tableau et vous l\'envoie avant ce soir.', read: false },
    { conversationId: `conv_${directeur._id}_${enseignant2._id}`, sender: enseignant2._id, recipient: directeur._id, school: school._id, subject: 'Réunion parents-profs', body: 'Bonjour, pouvons-nous fixer la date de la réunion parents-profs du 2ème trimestre ?', read: false },
    { conversationId: `conv_${directeur._id}_${parent._id}`, sender: parent._id, recipient: directeur._id, school: school._id, subject: 'Absence de mon fils', body: 'Bonjour Directeur, mon fils sera absent demain pour raison médicale. Merci de l\'excuser.', read: false },
  ]
  await Message.insertMany(messagesData)

  // Create second school for landing page
  await School.create({
    name: 'École Les Petits Génies',
    cycles: ['Maternelle', 'Primaire'],
    address: { city: 'Douala', neighborhood: 'Bonanjo', country: 'Cameroun' },
    phone: '+237 699 111 111',
    email: 'contact@petitsgenies.cm',
    subscription: { plan: 'standard', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000) },
  })

  await School.create({
    name: 'Lycée Bilingue de Yaoundé',
    cycles: ['Secondaire'],
    address: { city: 'Yaoundé', neighborhood: 'Melen', country: 'Cameroun' },
    phone: '+237 699 222 222',
    email: 'contact@lyceeby.cm',
    subscription: { plan: 'premium', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000) },
  })

  await School.create({
    name: 'Institut Samba',
    cycles: ['Primaire', 'Secondaire'],
    address: { city: 'Douala', neighborhood: 'Akwa', country: 'Cameroun' },
    phone: '+237 699 333 333',
    email: 'contact@samba.cm',
    subscription: { plan: 'standard', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 180 * 86400000) },
  })

  console.log('✅ Seed complete!')
  console.log('📋 Demo accounts:')
  console.log('   directeur@katd.com / password123 (Directeur)')
  console.log('   enseignant@katd.com / password123 (Enseignant)')
  console.log('   parent@katd.com / password123 (Parent)')
  console.log('   admin@katd.com / password123 (Super Admin)')
  console.log(`📊 Created: ${students.length} students, ${teachers.length} teachers, ${classes.length} classes, ${gradesData.length} grades, ${attendanceData.length} attendance records, ${mediaData.length} media`)

  process.exit(0)
}

seed().catch((err) => { console.error('❌ Seed error:', err); process.exit(1) })
