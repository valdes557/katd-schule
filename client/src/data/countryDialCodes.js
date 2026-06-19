// Indicatifs téléphoniques par pays, indexés sur le code ISO 2 lettres (champ `code`
// des localités) avec repli sur le nom du pays. Permet d'afficher automatiquement
// l'indicatif (+237, …) dès que l'utilisateur choisit son pays dans un formulaire.

// ISO alpha-2 -> indicatif international
const BY_ISO = {
  // Afrique centrale & de l'ouest (cible principale de la plateforme)
  CM: '+237', GA: '+241', CG: '+242', CD: '+243', CI: '+225', SN: '+221',
  TD: '+235', CF: '+236', GQ: '+240', BJ: '+229', TG: '+228', BF: '+226',
  ML: '+223', NE: '+227', GN: '+224', GW: '+245', MR: '+222', GH: '+233',
  NG: '+234', LR: '+231', SL: '+232', GM: '+220',
  // Afrique du nord, est & australe
  MA: '+212', DZ: '+213', TN: '+216', LY: '+218', EG: '+20', SD: '+249',
  KE: '+254', TZ: '+255', UG: '+256', RW: '+250', BI: '+257', ET: '+251',
  SO: '+252', DJ: '+253', ZA: '+27', ZM: '+260', ZW: '+263', MZ: '+258',
  AO: '+244', MG: '+261', MU: '+230', CV: '+238', KM: '+269', BW: '+267',
  NA: '+264', MW: '+265',
  // Europe & Amérique (responsables expatriés)
  FR: '+33', BE: '+32', CH: '+41', LU: '+352', DE: '+49', ES: '+34',
  IT: '+39', PT: '+351', GB: '+44', NL: '+31', US: '+1', CA: '+1',
  // Moyen-Orient & Asie courants
  TR: '+90', SA: '+966', AE: '+971', QA: '+974', LB: '+961', CN: '+86', IN: '+91',
}

// Repli par nom (normalisé en minuscules sans accents) si le code ISO est absent.
const BY_NAME = {
  cameroun: '+237', gabon: '+241', congo: '+242',
  'republique democratique du congo': '+243', 'rd congo': '+243',
  "cote d'ivoire": '+225', 'cote divoire': '+225', senegal: '+221',
  tchad: '+235', centrafrique: '+236', 'guinee equatoriale': '+240',
  benin: '+229', togo: '+228', 'burkina faso': '+226', mali: '+223',
  niger: '+227', guinee: '+224', mauritanie: '+222', ghana: '+233',
  nigeria: '+234', maroc: '+212', algerie: '+213', tunisie: '+216',
  egypte: '+20', kenya: '+254', tanzanie: '+255', ouganda: '+256',
  rwanda: '+250', burundi: '+257', ethiopie: '+251', 'afrique du sud': '+27',
  france: '+33', belgique: '+32', suisse: '+41', canada: '+1',
  'etats-unis': '+1', allemagne: '+49', espagne: '+34', italie: '+39',
}

const normalize = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .trim()

// Renvoie l'indicatif (+xxx) d'un pays { name, code } ou '' si inconnu.
export function dialCodeFor(country) {
  if (!country) return ''
  const iso = (country.code || '').toUpperCase()
  if (iso && BY_ISO[iso]) return BY_ISO[iso]
  return BY_NAME[normalize(country.name)] || ''
}
