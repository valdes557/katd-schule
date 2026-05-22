const mongoose = require('mongoose')

const platformPageSchema = new mongoose.Schema(
  {
    // À propos
    about: {
      content: { type: String, default: '' },
      images: [{ type: String }],
    },

    // Contacts
    contacts: [
      {
        type: { type: String, enum: ['whatsapp', 'phone', 'email'], default: 'phone' },
        value: { type: String },
        label: { type: String },
      },
    ],

    // Aide: support, FAQ, privacy, terms
    help: {
      support: { type: String, default: '' },
      faq: { type: String, default: '' },
      privacy: { type: String, default: '' },
      terms: { type: String, default: '' },
    },

    // Ressources
    resources: {
      schoolGuide: { type: String, default: '' },
      blog: { type: String, default: '' },
      supportText: { type: String, default: '' },
    },

    // Support Social (donations)
    donationAccounts: [
      {
        accountName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
      },
    ],
    donationMinAmount: { type: Number, default: 100 },
    donationDescription: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('PlatformPage', platformPageSchema)
