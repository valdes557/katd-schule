const mongoose = require('mongoose')

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: String, required: true },
    cycle: { type: String, enum: ['Maternelle', 'Primaire', 'Secondaire'], required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    mainTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    room: { type: String, trim: true },
    capacity: { type: Number, default: 40 },
    enrollmentFee: { type: Number, default: 0 },
    academicYear: { type: String },
    stats: {
      totalStudents: { type: Number, default: 0 },
      averageGrade: { type: Number, default: 0 },
      attendanceRate: { type: Number, default: 0 },
    },
    evaluationConfig: {
      types: [
        {
          name: { type: String, required: true },
          code: { type: String },
          periodicity: { type: String, enum: ['hebdomadaire', 'mensuelle', 'trimestrielle', 'annuelle'], default: 'trimestrielle' },
          weight: { type: Number, default: 1 },
          subjects: [{ type: String }],
          calculationMethod: { type: String, enum: ['moyenne_simple', 'moyenne_ponderee_coefficients'], default: 'moyenne_ponderee_coefficients' },
          appreciationRule: { type: String, default: 'par_matiere' },
        },
      ],
      annualCalculationMethod: { type: String, enum: ['moyenne_trimestres_egale', 'moyenne_trimestres_ponderee'], default: 'moyenne_trimestres_egale' },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Class', classSchema)
