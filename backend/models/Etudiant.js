const mongoose = require('mongoose');

const etudiantSchema = new mongoose.Schema({
  donnees: {
    type: Object,
    required: true
  },
  statut: {
    type: String,
    default: 'En attente'
  },
  idFormulaire: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Formulaire',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Etudiant', etudiantSchema);