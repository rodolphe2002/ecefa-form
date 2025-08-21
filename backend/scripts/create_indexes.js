/*
  Usage:
    node backend/scripts/create_indexes.js

  Description:
    - Create recommended indexes for performance and correctness.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const Etudiant = require(path.join(__dirname, '..', 'models', 'Etudiant'));
const Formulaire = require(path.join(__dirname, '..', 'models', 'Formulaire'));

async function main() {
  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  // Etudiant indexes
  try {
    const res1 = await Etudiant.collection.createIndex({ idFormulaire: 1, createdAt: -1 }, { background: true, name: 'idx_idFormulaire_createdAt' });
    console.log('✅ Index créé:', res1);
  } catch (e) {
    console.warn('⚠️ Index idFormulaire_createdAt:', e.message);
  }

  try {
    const res2 = await Etudiant.collection.createIndex({ idFormulaire: 1, statut: 1 }, { background: true, name: 'idx_idFormulaire_statut' });
    console.log('✅ Index créé:', res2);
  } catch (e) {
    console.warn('⚠️ Index idFormulaire_statut:', e.message);
  }

  // Formulaire indexes
  try {
    const res3 = await Formulaire.collection.createIndex({ actif: 1 }, { background: true, name: 'idx_formulaire_actif' });
    console.log('✅ Index créé:', res3);
  } catch (e) {
    console.warn('⚠️ Index formulaire_actif:', e.message);
  }

  // Enforce only one active form at a time using a partial unique index
  try {
    const res4 = await Formulaire.collection.createIndex(
      { actif: 1 },
      {
        name: 'uniq_form_actif_true',
        unique: true,
        partialFilterExpression: { actif: true },
        background: true
      }
    );
    console.log('✅ Index créé:', res4);
  } catch (e) {
    console.warn('⚠️ Index uniq_form_actif_true:', e.message);
  }

  await mongoose.disconnect();
  console.log('👋 Déconnecté.');
}

main().catch(err => {
  console.error('❌ Erreur création d\'index:', err);
  process.exit(1);
});
