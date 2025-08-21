/*
  Usage:
    node backend/scripts/normalize_dedupe.js --dry-run
    node backend/scripts/normalize_dedupe.js

  Description:
    - Normalise les numéros de téléphone (telephone et numero_whatsapp si présent)
      en supprimant espaces, points, slashs, etc., et en extrayant la première
      séquence de 10 à 14 chiffres (préférence 10).
    - Détecte les doublons par (telephone_normalisé, formation) ou (telephone_normalisé, nom),
      garde le plus récent et supprime les plus anciens.
*/

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const Etudiant = require(path.join(__dirname, '..', 'models', 'Etudiant'));
const Formulaire = require(path.join(__dirname, '..', 'models', 'Formulaire'));

const DRY_RUN = process.argv.includes('--dry-run');

function pickPhone(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Remplace séparateurs par espaces
  const cleaned = raw.replace(/[\./\\|,;]+/g, ' ');
  // Trouve toutes les séquences de chiffres de longueur >= 8
  const matches = cleaned.match(/\d{8,14}/g) || [];
  if (matches.length === 0) return '';
  // Priorise une séquence de 10 chiffres si dispo
  const ten = matches.find(m => m.length === 10);
  return (ten || matches[0]).trim();
}

async function main() {
  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI manquant dans .env');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB');

  // Récupère formulaire actif pour extraire la clé "formation" s'il existe
  const formulaire = await Formulaire.findOne({ actif: true });
  const formationKey = (formulaire?.champs || []).find(c => /formation/i.test(c.label || c.key))?.key || 'formation';
  const nomKey = (formulaire?.champs || []).find(c => /nom/i.test(c.label || c.key))?.key || 'nom_prenom';
  const whatsappKey = Object.keys(formulaire?.champs || {}).find?.(() => false); // fallback simple

  const all = await Etudiant.find().sort({ createdAt: -1 });
  console.log(`🔎 Documents chargés: ${all.length}`);

  // 1) Normalisation téléphone(s)
  let toUpdate = [];
  for (const e of all) {
    const d = e.donnees || {};
    const telRaw = d.telephone || d["numéro_whatsapp"] || d["numero_whatsapp"] || d["numéro"] || '';
    const telNorm = pickPhone(String(telRaw));

    let whatsRaw = d["numero_whatsapp"] || d["numéro_whatsapp"] || '';
    const whatsNorm = pickPhone(String(whatsRaw));

    const needTel = telNorm && telNorm !== d.telephone;
    const needWhats = whatsNorm && whatsNorm !== d["numero_whatsapp"] && whatsNorm !== d["numéro_whatsapp"];

    if (needTel || needWhats) {
      const newDonnees = { ...d };
      if (needTel) newDonnees.telephone = telNorm;
      if (needWhats) newDonnees.numero_whatsapp = whatsNorm;
      toUpdate.push({ _id: e._id, donnees: newDonnees });
    }
  }

  console.log(`📞 A normaliser (telephone/whatsapp): ${toUpdate.length}`);

  if (!DRY_RUN && toUpdate.length) {
    for (const u of toUpdate) {
      await Etudiant.updateOne({ _id: u._id }, { $set: { donnees: u.donnees } });
    }
    console.log('✅ Normalisation appliquée');
  } else if (DRY_RUN) {
    console.log('👀 Dry-run: normalisation non appliquée');
  }

  // 2) Déduplication
  const seen = new Map();
  const toDelete = [];

  for (const e of all) {
    const d = e.donnees || {};
    const tel = pickPhone(String(d.telephone || ''));
    const formation = (d[formationKey] || '').toString().trim().toLowerCase();
    const nom = (d[nomKey] || '').toString().trim().toLowerCase();

    const keys = [];
    if (tel) keys.push(`tel:${tel}|formation:${formation}`);
    if (tel && nom) keys.push(`tel:${tel}|nom:${nom}`);

    if (keys.length === 0) continue;

    let isDup = false;
    for (const k of keys) {
      if (seen.has(k)) {
        // Déjà vu → celui-ci est plus ancien (on parcourt du plus récent au plus ancien)
        toDelete.push(e._id);
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      for (const k of keys) seen.set(k, e._id);
    }
  }

  console.log(`🗑️ Doublons détectés: ${toDelete.length}`);

  if (!DRY_RUN && toDelete.length) {
    const res = await Etudiant.deleteMany({ _id: { $in: toDelete } });
    console.log(`✅ Doublons supprimés: ${res.deletedCount}`);
  } else if (DRY_RUN) {
    console.log('👀 Dry-run: suppressions non effectuées. Aperçu des 10 premiers IDs:');
    console.log(toDelete.slice(0, 10).map(String));
  }

  await mongoose.disconnect();
  console.log('👋 Déconnecté.');
}

main().catch(err => {
  console.error('❌ Erreur normalisation/dédoublonnage:', err);
  process.exit(1);
});
