const express = require('express');
const router = express.Router();
const Etudiant = require('../models/Etudiant');
const PDFDocument = require('pdfkit');
const Formulaire = require('../models/Formulaire');



// Middleware anti-cache
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});





// 🔹 Fonction utilitaire pour extraire un champ à partir d'un label
function extraireChamp(etudiant, labelRecherche, champsFormulaire) {
  const champTrouvé = champsFormulaire.find(
    (champ) =>
      champ.label?.toLowerCase().trim() === labelRecherche.toLowerCase().trim()
  );
  if (!champTrouvé) return '—';
  const cle = champTrouvé.key;
  return etudiant.donnees?.[cle] || '—';
}




// 📎 Génération PDF liste
router.get('/pdf-liste', async (req, res) => {
  try {
    const { formation, debut, fin } = req.query;
    const filter = {};
    if (formation) filter['donnees.formation'] = formation;
    if (debut || fin) {
      filter.createdAt = {};
      if (debut) filter.createdAt.$gte = new Date(debut);
      if (fin) filter.createdAt.$lte = new Date(fin);
    }

    // 🔹 Récupérer les inscriptions
    const inscritsBruts = await Etudiant.find(filter).sort({ createdAt: -1 });

    // 🔹 Récupérer le formulaire actif
    const formulaire = await Formulaire.findOne({ actif: true });
    const champsFormulaire = formulaire?.champs || [];
    const keysFormulaireActif = champsFormulaire.map(c => c.key);

    // 🔹 Filtrer les inscrits pour ne garder que ceux correspondant au formulaire actif
    const inscrits = inscritsBruts.filter(inscrit => {
      const keysInscrit = Object.keys(inscrit.donnees || {});
      return keysFormulaireActif.every(key => keysInscrit.includes(key));
    });

    // 🔹 Préparer le document PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const filename = 'liste_inscriptions.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=${filename}`);
    doc.pipe(res);

    // 🔹 Titre
    let titre = "Liste des inscriptions";
    if (formation) titre += ` – ${formation}`;
    doc.fontSize(16).fillColor('#2c3e50').text(titre, { align: 'center' });
    doc.moveDown();

    // 🔹 Filtres
    doc.fontSize(10).fillColor('#555');
    if (formation) doc.text(`Formation : ${formation}`);
    if (debut) doc.text(`À partir du : ${new Date(debut).toLocaleDateString()}`);
    if (fin) doc.text(`Jusqu'au : ${new Date(fin).toLocaleDateString()}`);
    doc.moveDown();

    // 🔹 Colonnes dynamiques + fixes
    const colonnes = [
      ...champsFormulaire.map(champ => ({
        label: champ.label || champ.key,
        key: champ.key
      })),
      { label: "Date d'inscription", key: '__createdAt' },
      { label: "Statut", key: '__statut' }
    ];

    const colWidth = Math.floor(500 / colonnes.length);
    const rowHeight = 25;
    let x = 40;
    let y = doc.y;

    // 🔹 En-têtes
    doc.font('Helvetica-Bold').fontSize(10);
    colonnes.forEach(col => {
      doc.rect(x, y, colWidth, rowHeight).fill('#3498db');
      doc.fillColor('#fff').text(col.label, x + 5, y + 7, { width: colWidth - 10 });
      x += colWidth;
    });
    y += rowHeight;

    // 🔹 Lignes
    inscrits.forEach((etudiant, index) => {
      x = 40;
      const bg = index % 2 === 0 ? '#ecf0f1' : '#ffffff';
      doc.font('Helvetica').fontSize(9);

      colonnes.forEach(col => {
        doc.rect(x, y, colWidth, rowHeight).fill(bg);
        doc.fillColor('#000');

        let valeur = '—';
        if (col.key === '__createdAt') {
          valeur = etudiant.createdAt ? new Date(etudiant.createdAt).toLocaleDateString() : '—';
        } else if (col.key === '__statut') {
          valeur = etudiant.statut || "En attente";
        } else {
          valeur = etudiant.donnees?.[col.key] || '—';
        }

        doc.text(valeur, x + 5, y + 7, { width: colWidth - 10 });
        x += colWidth;
      });

      y += rowHeight;
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
    });

    // 🔹 Footer
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#888').text(`Total : ${inscrits.length} inscrit(s)`, { align: 'left' });
    doc.fontSize(10).fillColor('#888').text('Document généré automatiquement. Merci de vérifier les informations.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error("Erreur génération PDF liste :", err);
    res.status(500).send("Erreur serveur lors de la génération du PDF.");
  }
});




// POST /inscription
router.post('/', async (req, res) => {
  try {
    const donnees = req.body;

    // Récupérer le formulaire actif pour lier l'inscription
    const formulaireActif = await Formulaire.findOne({ actif: true });
    if (!formulaireActif) {
      return res.status(400).json({ message: "Aucun formulaire actif." });
    }
    const idFormulaire = formulaireActif._id;

    const nom_prenom = donnees?.nom_prenom?.trim() || null;
    const telephone = donnees?.telephone?.trim() || null;
    const date_naissance = donnees?.date_naissance || null;

    // ❗ Un des trois au moins doit exister pour qu’on tente la vérification
    const conditions = [];

    if (nom_prenom && telephone && date_naissance) {
      conditions.push({
        $and: [
          { "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') } },
          { "donnees.telephone": telephone },
          { "donnees.date_naissance": date_naissance }
        ]
      });
    }

    if (nom_prenom && telephone) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') },
        "donnees.telephone": telephone
      });
    }

    if (nom_prenom && date_naissance) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') },
        "donnees.date_naissance": date_naissance
      });
    }

    if (telephone && date_naissance) {
      conditions.push({
        "donnees.telephone": telephone,
        "donnees.date_naissance": date_naissance
      });
    }

    if (telephone) {
      conditions.push({ "donnees.telephone": telephone });
    }

    if (nom_prenom) {
      conditions.push({
        "donnees.nom_prenom": { $regex: new RegExp(`^${nom_prenom}$`, 'i') }
      });
    }

    if (conditions.length > 0) {
      const existing = await Etudiant.findOne({
        idFormulaire: idFormulaire,
        $or: conditions
      });
      if (existing) {
        return res.status(400).json({ message: "⚠️ Cette personne semble déjà inscrite à ce formulaire." });
      }
    }

    const etudiant = new Etudiant({ donnees, idFormulaire });
    await etudiant.save();

    res.status(201).json({ message: "✅ Inscription réussie !" });
  } catch (err) {
    console.error("Erreur POST /inscription :", err);
    res.status(500).json({ message: "❌ Erreur serveur", error: err.message });
  }
});

// ✅ Vérifier inscription
router.get('/verifier', async (req, res) => {
  const { nom_prenom, date_naissance, telephone } = req.query;

  const conditions = [];

  if (telephone) conditions.push({ "donnees.telephone": telephone });
  if (telephone && nom_prenom) conditions.push({ "donnees.telephone": telephone, "donnees.nom_prenom": nom_prenom });
  if (telephone && date_naissance) conditions.push({ "donnees.telephone": telephone, "donnees.date_naissance": date_naissance });
  if (nom_prenom && date_naissance) conditions.push({ "donnees.nom_prenom": nom_prenom, "donnees.date_naissance": date_naissance });

  const exist = await Etudiant.findOne({ $or: conditions });

  if (exist) {
    return res.status(200).json({ inscrit: true, nom: exist.donnees.nom_prenom });
  }

  return res.status(200).json({ inscrit: false });
});

// ✅ Voir tous les inscrits
router.get('/', async (req, res) => {
  try {
    // Permet de récupérer toutes les inscriptions (debug/admin): /api/inscription?all=true
    const returnAll = String(req.query.all || '').toLowerCase() === 'true';

    if (returnAll) {
      const etudiants = await Etudiant.find().sort({ createdAt: -1 });
      return res.json(etudiants);
    }

    // Sinon, par défaut, on renvoie uniquement les inscrits du formulaire actif,
    // avec la même logique de compatibilité que /stats pour cohérence.
    const formulaire = await Formulaire.findOne({ actif: true });
    if (!formulaire) {
      return res.status(404).json({ message: "Aucun formulaire actif." });
    }

    const keysFormulaireActif = (formulaire.champs || []).map(c => c.key);

    const inscritsBruts = await Etudiant.find().sort({ createdAt: -1 });
    const inscritsFormulaire = inscritsBruts.filter(inscrit => {
      if (inscrit.idFormulaire && String(inscrit.idFormulaire) === String(formulaire._id)) return true;
      const keysInscrit = Object.keys(inscrit.donnees || {});
      return keysFormulaireActif.length > 0 && keysFormulaireActif.every(key => keysInscrit.includes(key));
    });

    res.json(inscritsFormulaire);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ✅ Confirmer un inscrit
router.patch('/confirmer/:id', async (req, res) => {
  try {
    const updated = await Etudiant.findByIdAndUpdate(
      req.params.id,
      { statut: 'Confirmée' },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Etudiant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    // Récupérer le formulaire actif
    const formulaire = await Formulaire.findOne({ actif: true });
    if (!formulaire) {
      return res.status(404).json({ message: "Aucun formulaire actif." });
    }

    // Récupérer les inscrits du plus récent au plus ancien
    const inscritsBruts = await Etudiant.find().sort({ createdAt: -1 });

    // Filtrer par compatibilité avec le formulaire actif (fallback si idFormulaire absent sur anciens enregistrements)
    const keysFormulaireActif = (formulaire.champs || []).map(c => c.key);
    const inscritsFormulaire = inscritsBruts.filter(inscrit => {
      // Si idFormulaire correspond, on garde directement
      if (inscrit.idFormulaire && String(inscrit.idFormulaire) === String(formulaire._id)) return true;
      // Sinon, on vérifie la compatibilité des champs
      const keysInscrit = Object.keys(inscrit.donnees || {});
      return keysFormulaireActif.length > 0 && keysFormulaireActif.every(key => keysInscrit.includes(key));
    });

    // Calcul direct sans déduplication pour refléter le tableau
    const total = inscritsFormulaire.length;
    const confirmees = inscritsFormulaire.filter(i => i.statut === 'Confirmée').length;
    const enAttente = inscritsFormulaire.filter(i => i.statut === 'En attente').length;

    // Utiliser une frontière de mois en UTC pour cohérence inter-serveurs
    const now = new Date();
    const debutMoisUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const totalCeMois = inscritsFormulaire.filter(i => i.createdAt >= debutMoisUTC).length;
    const confirmeesCeMois = inscritsFormulaire.filter(i => i.statut === 'Confirmée' && i.createdAt >= debutMoisUTC).length;
    const enAttenteCeMois = inscritsFormulaire.filter(i => i.statut === 'En attente' && i.createdAt >= debutMoisUTC).length;

    const tauxConfirmation = total > 0 ? Math.round((confirmees / total) * 100) : 0;
    const tauxConfirmationCeMois = totalCeMois > 0 ? Math.round((confirmeesCeMois / totalCeMois) * 100) : 0;
    const variationTaux = tauxConfirmationCeMois - tauxConfirmation;

    res.json({
      total,
      confirmees,
      enAttente,
      totalCeMois,
      confirmeesCeMois,
      enAttenteCeMois,
      tauxConfirmation,
      variationTaux
    });
  } catch (err) {
    res.status(500).json({ message: "Erreur stats", error: err.message });
  }
});



router.get('/stats/formations', async (req, res) => {
  try {
    // Récupérer le formulaire actif pour filtrer
    const formulaire = await Formulaire.findOne({ actif: true });
    if (!formulaire) {
      return res.status(404).json({ message: "Aucun formulaire actif." });
    }

    const keysFormulaireActif = (formulaire.champs || []).map(c => c.key);

    // Récupérer tous les inscrits et filtrer comme pour /stats
    const inscritsBruts = await Etudiant.find({ "donnees.formation": { $exists: true, $ne: null } }).sort({ createdAt: -1 });
    const inscritsFormulaire = inscritsBruts.filter(inscrit => {
      if (inscrit.idFormulaire && String(inscrit.idFormulaire) === String(formulaire._id)) return true;
      const keysInscrit = Object.keys(inscrit.donnees || {});
      return keysFormulaireActif.length > 0 && keysFormulaireActif.every(key => keysInscrit.includes(key));
    });

    // Agréger côté application
    const counts = inscritsFormulaire.reduce((acc, i) => {
      const f = i.donnees?.formation || '—';
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});

    const stats = Object.entries(counts)
      .map(([formation, count]) => ({ _id: formation, count }))
      .sort((a, b) => b.count - a.count);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Erreur stats formations", error: err.message });
  }
});

// ✅ Fiche PDF étudiant
router.get('/fiche/:id', async (req, res) => {
  try {
    const etudiant = await Etudiant.findById(req.params.id);
    if (!etudiant) return res.status(404).send("Étudiant non trouvé");

    // Récupérer tous les champs dynamiques via Formulaire
    const formulaire = await Formulaire.findOne().sort({ createdAt: -1 }); // le plus récent
    const champs = formulaire?.champs || [];

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=fiche_etudiant.pdf');
    doc.pipe(res);

    // Titre
    doc.fontSize(20).fillColor('#3498db').text("Fiche d'inscription", { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).fillColor('#000');

    // Affichage dynamique des champs depuis etudiant.donnees
    champs.forEach(champ => {
      const cle = champ.key;
      const label = champ.label || cle;
      const valeur = etudiant.donnees?.[cle] ?? '—';
      doc.text(`${label} : ${valeur}`);
    });

    // Ajout du statut et date d’inscription
    doc.text(`Statut : ${etudiant.statut || 'En attente'}`);
    doc.text(`Date d'inscription : ${new Date(etudiant.createdAt).toLocaleDateString()}`);

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#888').text('Document généré automatiquement. Merci de vérifier les informations.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error("Erreur PDF :", err);
    res.status(500).send("Erreur serveur lors de la génération du PDF.");
  }
});


// ✅ Confirmer un inscrit (statut = Confirmée via PATCH)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    const updated = await Etudiant.findByIdAndUpdate(id, { statut }, { new: true });

    if (!updated) return res.status(404).json({ message: "Inscription non trouvée" });

    res.json(updated);
  } catch (err) {
    console.error("Erreur de mise à jour du statut :", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});



// ⚠️ Route par ID (toujours à la fin)
router.get('/:id', async (req, res) => {
  try {
    const etudiant = await Etudiant.findById(req.params.id);
    if (!etudiant) return res.status(404).json({ message: "Inscription non trouvée" });
    res.json(etudiant);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

// ✅ Supprimer un inscrit
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Etudiant.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Inscription non trouvée" });
    res.json({ message: "Inscription supprimée avec succès" });
  } catch (err) {
    console.error("Erreur suppression :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression" });
  }
});

module.exports = router;