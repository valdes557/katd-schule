// Libellés des rôles, adaptés au cycle de l'école.
// Au Secondaire : « directeur » s'affiche « Principal » et « enseignant » s'affiche « Professeur ».
const BASE_LABELS = {
  super_admin: 'Super Admin',
  directeur: 'Directeur',
  enseignant: 'Enseignant',
  parent: 'Parent',
  eleve: 'Élève',
  utilisateur: 'Utilisateur',
  vice_principal: 'Vice-Principal',
  surveillant_general: 'Surveillant Général',
  caissiere: 'Caissière',
  secretaire: 'Secrétaire',
  portier: 'Portier',
}

const SECONDARY_OVERRIDES = {
  directeur: 'Principal',
  enseignant: 'Professeur',
}

export function isSecondarySchool(school) {
  if (!school) return false
  if (school.subscription?.cycle === 'Secondaire') return true
  return Array.isArray(school.cycles) && school.cycles.includes('Secondaire')
}

export function roleLabel(role, school) {
  if (isSecondarySchool(school) && SECONDARY_OVERRIDES[role]) return SECONDARY_OVERRIDES[role]
  return BASE_LABELS[role] || role
}

export default roleLabel
