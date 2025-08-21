/*
  Usage:
    node backend/scripts/backfill_idFormulaire.js --dry-run
    node backend/scripts/backfill_idFormulaire.js

  Description:
    - Backfill "idFormulaire" for Etudiant documents that don't have it yet,
      by matching the active form's field keys with each student's "donnees" keys.
    - In dry-run mode, prints what would be updated without writing.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// Models
const Etudiant = require(path.join(__dirname, '..', 'models', 'Etudiant'));
const Formulaire = require(path.join(__dirname, '..', 'models', 'Formulaire'));

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  // 1) Récupérer le formulaire actif
  const formulaire = await Formulaire.findOne({ actif: true });
  if (!formulaire) {
    console.log('⚠️ Aucun formulaire actif. Rien à faire.');
    await mongoose.disconnect();
    return;
  }

  const keysFormulaireActif = (formulaire.champs || []).map(c => c.key);
  console.log(`ℹ️ Formulaire actif: ${formulaire.nom || formulaire._id} | ${keysFormulaireActif.length} clé(s)`);

  // 2) Récupérer candidats sans idFormulaire
  const candidats = await Etudiant.find({
    $or: [
      { idFormulaire: { $exists: false } },
      { idFormulaire: null }
    ]
  }).sort({ createdAt: -1 });

  console.log(`🔎 Candidats sans idFormulaire: ${candidats.length}`);

  const aMettreAJour = [];
  for (const etu of candidats) {
    const keysInscrit = Object.keys(etu.donnees || {});
    const compatible = keysFormulaireActif.length > 0 && keysFormulaireActif.every(k => keysInscrit.includes(k));
    if (compatible) {
      aMettreAJour.push(etu._id);
    }
  }

  console.log(`🧮 Compatibles avec le formulaire actif: ${aMettreAJour.length}`);

  if (DRY_RUN) {
    console.log('👀 Dry-run: aucun document ne sera modifié. Aperçu des 10 premiers IDs:');
    console.log(aMettreAJour.slice(0, 10).map(String));
  } else if (aMettreAJour.length > 0) {
    const res = await Etudiant.updateMany(
      { _id: { $in: aMettreAJour } },
      { $set: { idFormulaire: formulaire._id } }
    );
    console.log(`✅ Mise à jour effectuée: matched=${res.matchedCount || res.n}, modified=${res.modifiedCount || res.nModified}`);
  } else {
    console.log('✅ Rien à mettre à jour.');
  }

  await mongoose.disconnect();
  console.log('👋 Déconnecté.');
}

main().catch(err => {
  console.error('❌ Erreur backfill:', err);
  process.exit(1);
});
