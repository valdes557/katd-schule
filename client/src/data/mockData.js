export const schools = [
  { id: 1, name: 'École Les Petits Génies', type: 'Maternelle', city: 'Yamoussoukro', color: '#F97316', initials: 'PG', cycles: ['Maternelle'] },
  { id: 2, name: 'École Horizon', type: 'Primaire', city: 'Abidjan', color: '#2563EB', initials: 'EH', cycles: ['Primaire'] },
  { id: 3, name: 'École Excellence', type: 'Secondaire', city: 'Bouaké', color: '#059669', initials: 'EE', cycles: ['Secondaire'] },
  { id: 4, name: 'Groupe Scolaire La Réussite', type: 'Primaire & Secondaire', city: 'Abidjan', color: '#7C3AED', initials: 'GR', cycles: ['Primaire', 'Secondaire'] },
  { id: 5, name: 'École Nouvelle Génération', type: 'Primaire', city: 'San-Pédro', color: '#DC2626', initials: 'NG', cycles: ['Primaire'] },
  { id: 6, name: 'École Le Flambeau', type: 'Maternelle & Primaire', city: 'Bouaké', color: '#D97706', initials: 'LF', cycles: ['Maternelle', 'Primaire'] },
]

export const mediaItems = [
  {
    id: 1, type: 'video', title: "Fête de fin d'année 2024",
    school: 'École Les Petits Génies', schoolId: 1,
    likes: 125, comments: 32, shares: 58, duration: '2:35',
    category: 'Cérémonies', date: '2024-05-20',
    gradient: 'from-purple-900 via-purple-700 to-indigo-600',
  },
  {
    id: 2, type: 'photo', title: 'Activité de sciences - Les plantes',
    school: 'École Horizon', schoolId: 2,
    likes: 98, comments: 21, shares: 34, count: 12,
    category: 'Sciences', date: '2024-05-18',
    gradient: 'from-blue-900 via-blue-700 to-cyan-600',
  },
  {
    id: 3, type: 'audio', title: "Chorale du collège - Hymne à l'éducation",
    school: 'École Excellence', schoolId: 3,
    likes: 76, comments: 18, shares: 24, duration: '3:45',
    category: 'Arts & Culture', date: '2024-05-15',
    gradient: 'from-slate-900 via-slate-700 to-slate-600',
  },
  {
    id: 4, type: 'video', title: 'Match amical inter-classes',
    school: 'Groupe Scolaire La Réussite', schoolId: 4,
    likes: 110, comments: 27, shares: 41, duration: '1:59',
    category: 'Sports', date: '2024-05-12',
    gradient: 'from-green-900 via-green-700 to-teal-600',
  },
  {
    id: 5, type: 'photo', title: "Exposition des travaux d'élèves",
    school: 'École Le Flambeau', schoolId: 6,
    likes: 89, comments: 16, shares: 29, count: 8,
    category: 'Arts & Culture', date: '2024-05-10',
    gradient: 'from-amber-900 via-amber-700 to-orange-600',
  },
  {
    id: 6, type: 'audio', title: 'Lecture d\'un poème par nos élèves',
    school: 'École Nouvelle Génération', schoolId: 5,
    likes: 64, comments: 12, shares: 20, duration: '2:20',
    category: 'Arts & Culture', date: '2024-05-08',
    gradient: 'from-rose-900 via-rose-700 to-pink-600',
  },
]

export const categories = [
  'Activités scolaires', 'Sports', 'Sciences',
  'Arts & Culture', 'Sorties pédagogiques',
  'Cérémonies', 'Concours', 'Conférences',
]

export const gradesChartData = [
  { month: 'Sept.', avg: 13.2 },
  { month: 'Oct.', avg: 12.8 },
  { month: 'Nov.', avg: 14.1 },
  { month: 'Déc.', avg: 13.5 },
  { month: 'Jan.', avg: 12.9 },
  { month: 'Fév.', avg: 13.8 },
  { month: 'Mars', avg: 14.5 },
  { month: 'Avr.', avg: 15.1 },
  { month: 'Mai', avg: 14.8 },
  { month: 'Juin', avg: 15.3 },
]

export const attendanceData = [
  { name: 'Présents', value: 322, percentage: 92, color: '#2563EB' },
  { name: 'Absents', value: 21, percentage: 6, color: '#EF4444' },
  { name: 'Retards', value: 7, percentage: 2, color: '#F59E0B' },
]

export const recentActivities = [
  {
    id: 1, type: 'homework',
    title: 'Devoir de Mathématiques ajouté par M. Diop',
    subtitle: 'Classe : CM2 A',
    time: "Aujourd'hui, 08:30",
    color: 'blue',
  },
  {
    id: 2, type: 'grade',
    title: "Note d'évaluation publiée",
    subtitle: 'Classe : CE2 B',
    time: 'Hier, 16:45',
    color: 'green',
  },
  {
    id: 3, type: 'absence',
    title: 'Absence signalée',
    subtitle: 'Élève : Kouassi A.',
    time: 'Hier, 10:15',
    color: 'orange',
  },
  {
    id: 4, type: 'document',
    title: 'Document partagé',
    subtitle: "Programme d'examen final.pdf",
    time: '12 Mai, 14:20',
    color: 'red',
  },
  {
    id: 5, type: 'payment',
    title: 'Paiement enregistré',
    subtitle: 'Abonnement annuel',
    time: '10 Mai, 11:05',
    color: 'purple',
  },
]

export const upcomingEvents = [
  { id: 1, day: '25', month: 'MAI', title: 'Réunion parents – enseignants', time: '09:00 – 11:00', color: 'blue' },
  { id: 2, day: '15', month: 'JUIN', title: "Fête de fin d'année", time: '15:00 – 18:00', color: 'green' },
  { id: 3, day: '20', month: 'AVR', title: 'Début des vacances de Pâques', time: 'Toute la journée', color: 'orange' },
  { id: 4, day: '05', month: 'MAI', title: 'Reprise des cours', time: '07:30 – 12:00', color: 'purple' },
]

export const students = [
  { id: 1, name: 'Kouassi Amani', matricule: 'ELP-2024-001', class: 'CM2 A', age: 11, gender: 'M', average: 14.5, attendance: 95, parentName: 'Mme Kouassi', status: 'active', city: 'Yamoussoukro' },
  { id: 2, name: 'Diallo Fatoumata', matricule: 'ELP-2024-002', class: 'CE2 B', age: 9, gender: 'F', average: 16.2, attendance: 98, parentName: 'M. Diallo', status: 'active', city: 'Yamoussoukro' },
  { id: 3, name: 'Traoré Moussa', matricule: 'ELP-2024-003', class: 'CM1 A', age: 10, gender: 'M', average: 11.8, attendance: 82, parentName: 'Mme Traoré', status: 'active', city: 'Yamoussoukro' },
  { id: 4, name: 'Koné Adjoua', matricule: 'ELP-2024-004', class: 'CM2 A', age: 11, gender: 'F', average: 13.7, attendance: 90, parentName: 'M. Koné', status: 'active', city: 'Toumodi' },
  { id: 5, name: 'Bamba Ibrahim', matricule: 'ELP-2024-005', class: 'CE1 A', age: 8, gender: 'M', average: 15.1, attendance: 97, parentName: 'Mme Bamba', status: 'active', city: 'Yamoussoukro' },
  { id: 6, name: 'Yao Serge', matricule: 'ELP-2024-006', class: 'CE2 B', age: 9, gender: 'M', average: 9.4, attendance: 75, parentName: 'M. Yao', status: 'warning', city: 'Yamoussoukro' },
  { id: 7, name: 'Coulibaly Mariam', matricule: 'ELP-2024-007', class: 'CM1 B', age: 10, gender: 'F', average: 17.3, attendance: 99, parentName: 'Mme Coulibaly', status: 'active', city: 'Kossou' },
  { id: 8, name: 'Goba Eric', matricule: 'ELP-2024-008', class: 'CP B', age: 7, gender: 'M', average: 12.0, attendance: 88, parentName: 'M. Goba', status: 'active', city: 'Yamoussoukro' },
]

export const teachers = [
  { id: 1, name: 'M. Diop Ousmane', subject: 'Mathématiques', classes: ['CM2 A', 'CM1 B'], email: 'o.diop@ecole.ci', phone: '+225 07 12 34 56', experience: '8 ans', status: 'active', attendance: 96 },
  { id: 2, name: 'Mme Konaté Aïcha', subject: 'Français', classes: ['CE2 B', 'CE1 A'], email: 'a.konate@ecole.ci', phone: '+225 05 67 89 01', experience: '5 ans', status: 'active', attendance: 99 },
  { id: 3, name: 'M. Touré Bakary', subject: 'Sciences', classes: ['CM2 A', 'CM2 B'], email: 'b.toure@ecole.ci', phone: '+225 07 23 45 67', experience: '12 ans', status: 'active', attendance: 94 },
  { id: 4, name: 'Mme N\'Guessan Clarisse', subject: 'Histoire-Géo', classes: ['CM1 A', 'CM1 B'], email: 'c.nguessan@ecole.ci', phone: '+225 05 89 01 23', experience: '3 ans', status: 'active', attendance: 100 },
  { id: 5, name: 'M. Cissé Mamadou', subject: 'EPS', classes: ['CM2 A', 'CM2 B', 'CM1 A', 'CM1 B'], email: 'm.cisse@ecole.ci', phone: '+225 07 45 67 89', experience: '10 ans', status: 'leave', attendance: 85 },
]

export const classes = [
  { id: 1, name: 'CP A', level: 'Cours Préparatoire', students: 28, teacher: 'Mme Aka', room: 'Salle 01' },
  { id: 2, name: 'CP B', level: 'Cours Préparatoire', students: 26, teacher: 'M. Soro', room: 'Salle 02' },
  { id: 3, name: 'CE1 A', level: 'Cours Élémentaire 1', students: 30, teacher: 'Mme Konaté', room: 'Salle 03' },
  { id: 4, name: 'CE1 B', level: 'Cours Élémentaire 1', students: 29, teacher: 'M. Koné', room: 'Salle 04' },
  { id: 5, name: 'CE2 A', level: 'Cours Élémentaire 2', students: 31, teacher: 'Mme Bah', room: 'Salle 05' },
  { id: 6, name: 'CE2 B', level: 'Cours Élémentaire 2', students: 30, teacher: 'Mme Konaté Aïcha', room: 'Salle 06' },
  { id: 7, name: 'CM1 A', level: 'Cours Moyen 1', students: 33, teacher: 'M. Touré', room: 'Salle 07' },
  { id: 8, name: 'CM1 B', level: 'Cours Moyen 1', students: 32, teacher: "Mme N'Guessan", room: 'Salle 08' },
  { id: 9, name: 'CM2 A', level: 'Cours Moyen 2', students: 35, teacher: 'M. Diop', room: 'Salle 09' },
  { id: 10, name: 'CM2 B', level: 'Cours Moyen 2', students: 34, teacher: 'Mme Sylla', room: 'Salle 10' },
]

export const messages = [
  {
    id: 1, from: 'M. Diop Ousmane', role: 'Enseignant', avatar: 'DO',
    subject: 'Résultats du devoir de mathématiques CM2 A',
    preview: 'Bonjour, je souhaitais vous informer que les résultats du devoir surveillé de mathématiques...',
    time: "Aujourd'hui, 09:15", read: false, color: '#2563EB',
  },
  {
    id: 2, from: 'Mme Kouassi', role: 'Parent', avatar: 'MK',
    subject: "Demande d'absence pour Amani Kouassi",
    preview: 'Bonjour, mon enfant Amani sera absent les 25 et 26 mai pour des raisons familiales...',
    time: 'Hier, 14:30', read: false, color: '#059669',
  },
  {
    id: 3, from: 'Direction', role: 'Directeur', avatar: 'DR',
    subject: 'Réunion pédagogique - 28 Mai 2024',
    preview: 'Chers collègues, une réunion pédagogique est prévue le 28 mai à 15h30 dans la salle de conférence...',
    time: '20 Mai, 11:00', read: true, color: '#7C3AED',
  },
  {
    id: 4, from: 'Mme Bamba', role: 'Parent', avatar: 'MB',
    subject: 'Félicitations pour le suivi scolaire',
    preview: 'Je tenais à vous remercier pour le suivi excellent de mon fils Ibrahim. Ses résultats sont en...',
    time: '18 Mai, 16:45', read: true, color: '#F59E0B',
  },
]

export const subscriptionPlans = [
  {
    cycle: 'Cycle Maternelle',
    icon: '🌱',
    color: 'orange',
    quarterly: { price: 15000, label: '15 000 F CFA / trimestre' },
    annual: { price: 40000, label: '40 000 F CFA / an (paiement unique)' },
  },
  {
    cycle: 'Cycle Primaire',
    icon: '📚',
    color: 'blue',
    quarterly: { price: 15000, label: '15 000 F CFA / trimestre' },
    annual: { price: 40000, label: '40 000 F CFA / an (paiement unique)' },
  },
  {
    cycle: 'Cycle Secondaire',
    icon: '🎓',
    color: 'green',
    quarterly: { price: 15000, label: '15 000 F CFA / trimestre' },
    annual: { price: 40000, label: '40 000 F CFA / an (paiement unique)' },
  },
]
