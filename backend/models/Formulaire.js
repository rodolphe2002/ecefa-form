// models/Formulaire.js
const mongoose = require('mongoose');

const champSchema = new mongoose.Schema({
  key: { type: String, required: true }, // ✅ Ajoute cette ligne
  type: { type: String, required: true },
  label: String,
  placeholder: String,
  options: [String],
  value: String
});

const formulaireSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  champs: [champSchema],
  actif: { type: Boolean, default: true },
  slug: { type: String, unique: true }, // pour créer des URL accessibles
  dateCreation: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Formulaire', formulaireSchema);