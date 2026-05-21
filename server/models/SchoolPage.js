const mongoose = require('mongoose')

const schoolPageSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, unique: true },

    // À propos
    about: {
      content: { type: String, default: '' },
      images: [{ type: String }],
    },

    // Conditions d'utilisation
    terms: { type: String, default: '' },

    // Politique de confidentialité
    privacy: { type: String, default: '' },

    // Aide
    help: { type: String, default: '' },

    // Comptes de donation
    donationAccounts: [
      {
        accountName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
      },
    ],

    // Contacts
    contacts: [
      {
        type: { type: String, enum: ['whatsapp', 'phone', 'email'], default: 'phone' },
        value: { type: String },
        label: { type: String },
      },
    ],
  },
  { timestamps: true }
)

module.exports = mongoose.model('SchoolPage', schoolPageSchema)
