const BASE_URL = "http://localhost:3000";
// const BASE_URL = "https://inscription-ecefa.onrender.com";


// ------------------ Initialisation ------------------
document.addEventListener("DOMContentLoaded", async () => {
  await chargerFormulaireActif();             // 🔹 Important pour charger les bons labels
  await chargerInscriptions();                // 🔹 Ensuite charger les données avec ces labels
  await chargerStatistiques();
  await majStatusChart(statusChart);
  await majFormationsChart(formationsChart);
  remplirFiltreFormations();
  await chargerListeFormulaires();

});





let champsFormulaireActif = [];

// Charger les champs du formulaire actif
async function chargerFormulaireActif() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/formulaires/actif`);
    const formulaire = await res.json();
    champsFormulaireActif = formulaire.champs || [];
  } catch (err) {
    console.error("Erreur chargement formulaire actif", err);
  }
}

// Extraire la valeur depuis les champs dynamiques
function extraireValeur(inscrit, labelRecherche) {
  const index = champsFormulaireActif.findIndex(champ =>
    champ.label?.toLowerCase().includes(labelRecherche.toLowerCase()) ||
    champ.key?.toLowerCase() === labelRecherche.toLowerCase()
  );
  if (index === -1) return '—';
  return inscrit.donnees[`champ_${index}`] || '—';
}


let idEtudiantSelectionne = null;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/connectAdmin.html";
    return null;
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

async function fetchWithAuth(url, options = {}) {
  const headers = getAuthHeaders();
  if (!headers) return;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      window.location.href = "/connectAdmin.html";
      return;
    }

    return res;
  } catch (err) {
    console.error("Erreur fetch sécurisée :", err);
    throw err;
  }
}

// ------------------ Animation de fond ------------------
const bgAnimation = document.getElementById('bgAnimation');
for (let i = 0; i < 15; i++) {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble');

  const size = Math.random() * 120 + 30;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${Math.random() * 100}%`;
  bubble.style.animationDelay = `${Math.random() * 20}s`;
  bubble.style.animationDuration = `${15 + Math.random() * 25}s`;

  bgAnimation.appendChild(bubble);
}

// ------------------ Hover Cards ------------------
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const x = e.pageX - card.offsetLeft;
    const y = e.pageY - card.offsetTop;
    const centerX = card.offsetWidth / 2;
    const centerY = card.offsetHeight / 2;

    const angleY = (x - centerX) / 25;
    const angleX = (centerY - y) / 25;

    card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale(1.05)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
  });
});

// ------------------ Hover sur tableau ------------------
document.querySelectorAll('tbody').forEach(tbody => {
  tbody.addEventListener('mouseover', e => {
    const row = e.target.closest('tr');
    if (row) row.style.transform = 'translateX(10px)';
  });

  tbody.addEventListener('mouseout', e => {
    const row = e.target.closest('tr');
    if (row) row.style.transform = 'translateX(0)';
  });
});

// ------------------ Graphiques ------------------
const formationsCtx = document.getElementById('formationsChart').getContext('2d');
const formationsChart = new Chart(formationsCtx, {
  type: 'bar',
  data: {
    labels: [],
    datasets: [{
      label: "Nombre d'inscriptions",
      data: [],
      backgroundColor: [
        'rgba(67, 97, 238, 0.7)',
        'rgba(58, 12, 163, 0.7)',
        'rgba(76, 201, 240, 0.7)',
        'rgba(46, 196, 182, 0.7)',
        'rgba(255, 158, 0, 0.7)'
      ],
      borderColor: [
        'rgb(67, 97, 238)',
        'rgb(58, 12, 163)',
        'rgb(76, 201, 240)',
        'rgb(46, 196, 182)',
        'rgb(255, 158, 0)'
      ],
      borderWidth: 1,
      borderRadius: 10,
      borderSkipped: false
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true },
      x: { grid: { display: false } }
    }
  }
});

const statusCtx = document.getElementById('statusChart').getContext('2d');
const statusChart = new Chart(statusCtx, {
  type: 'doughnut',
  data: {
    labels: ['Confirmées', 'En attente'],
    datasets: [{
      data: [0, 0],
      backgroundColor: [
        'rgba(46, 196, 182, 0.8)',
        'rgba(255, 158, 0, 0.8)'
      ],
      borderColor: [
        'rgb(46, 196, 182)',
        'rgb(255, 158, 0)'
      ],
      borderWidth: 1,
      hoverOffset: 15
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    }
  }
});

async function majStatusChart(chart) {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/inscription/stats`);
    const data = await res.json();
    const { confirmees, enAttente } = data;

    chart.data.labels = ['Confirmées', 'En attente'];
    chart.data.datasets[0].data = [confirmees, enAttente];
    chart.update();
  } catch (err) {
    console.error("Erreur maj graphique doughnut", err);
  }
}

async function majFormationsChart(chart) {
  const indexFormation = champsFormulaireActif.findIndex(champ =>
    champ.label?.toLowerCase().includes("formation")
  );

  if (indexFormation === -1) {
    console.warn("Aucun champ de formation trouvé");
    return;
  }

  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/inscription`);
    const inscrits = await res.json();

    // Grouper les inscriptions par valeur de formation
    const compteur = {};

    inscrits.forEach(inscrit => {
      const valeur = inscrit.donnees[`champ_${indexFormation}`]?.trim() || "Inconnue";
      compteur[valeur] = (compteur[valeur] || 0) + 1;
    });

    const labels = Object.keys(compteur);
    const data = Object.values(compteur);

    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  } catch (err) {
    console.error("Erreur maj graphique formations", err);
  }
}

// chager les inscriptions dans le tableau

async function chargerInscriptions(filtreTexte = "", filtreFormation = "", dateDebut = "", dateFin = "") {
  const tbody = document.getElementById("inscriptionsBody");
  tbody.innerHTML = "";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/inscription`);
    const inscrits = await res.json();

    const resultat = inscrits.filter(inscrit => {
      const nom = extraireValeur(inscrit, 'nom');
      const tel = extraireValeur(inscrit, 'téléphone');
      const formation = extraireValeur(inscrit, 'formation');

      const nomOk = nom.toLowerCase().includes(filtreTexte.toLowerCase()) ||
                    tel.toLowerCase().includes(filtreTexte.toLowerCase());

      const formationOk = !filtreFormation || formation === filtreFormation;

      const dateInscription = new Date(inscrit.createdAt);
      const debutOk = !dateDebut || new Date(dateDebut) <= dateInscription;
      const finOk = !dateFin || dateInscription <= new Date(dateFin);

      return nomOk && formationOk && debutOk && finOk;
    });

    resultat.forEach(inscrit => {
      const nom = extraireValeur(inscrit, 'nom');
      const tel = extraireValeur(inscrit, 'téléphone');
      const formation = extraireValeur(inscrit, 'formation');
      const statut = inscrit.statut || 'En attente';
      const date = new Date(inscrit.createdAt).toLocaleDateString();

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${nom}</td>
        <td>${formation}</td>
        <td>${date}</td>
        <td>${tel}</td>
        <td><span class="status ${statut === 'Confirmée' ? 'confirmed' : 'pending'}">${statut}</span></td>
        <td class="actions">
          <button class="action-btn view" data-id="${inscrit._id}"><i class="fas fa-eye"></i></button>
          <button class="action-btn edit" data-id="${inscrit._id}"><i class="fas fa-edit"></i></button>
        </td>
      `;

      tr.addEventListener('dblclick', () => {
        idEtudiantSelectionne = inscrit._id;
        activerBoutonPDF(inscrit._id);
        document.querySelectorAll('tbody tr').forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
      });

      tbody.appendChild(tr);
    });

    // 👁‍🗨 Bouton "Vue" pour confirmation
    document.querySelectorAll('.view').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await fetchWithAuth(`${BASE_URL}/api/inscription/confirmer/${id}`, { method: "PATCH" });
        chargerInscriptions(document.getElementById("searchInput").value);
      });
    });

  } catch (err) {
    console.error("Erreur chargement des inscriptions", err);
  }
}

// ------------------ Statistiques ------------------
async function chargerStatistiques() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/inscription/stats`);
    const data = await res.json();

    const {
      total, confirmees, enAttente,
      totalCeMois, confirmeesCeMois, enAttenteCeMois,
      tauxConfirmation, variationTaux
    } = data;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-confirmees").textContent = confirmees;
    document.getElementById("stat-attente").textContent = enAttente;

    document.getElementById("var-total").textContent = `${Math.round((totalCeMois / total) * 100 || 0)}% ce mois`;
    document.getElementById("var-confirmees").textContent = `${Math.round((confirmeesCeMois / confirmees) * 100 || 0)}% ce mois`;
    document.getElementById("var-attente").textContent = `${Math.round((enAttenteCeMois / enAttente) * 100 || 0)}% ce mois`;

    document.getElementById("taux-confirmation").textContent = `${tauxConfirmation}%`;
    document.getElementById("var-confirmation").textContent = `${variationTaux >= 0 ? '+' : ''}${variationTaux}% ce mois`;
  } catch (err) {
    console.error("Erreur chargement stats", err);
  }
}



// ------------------ Barre de recherche ------------------
document.getElementById("searchInput").addEventListener("input", (e) => {
  const filtre = e.target.value;
  chargerInscriptions(filtre);
});

// ------------------ Bouton PDF ------------------
const btnDownloadPDF = document.getElementById("btnDownloadPDF");

function activerBoutonPDF(id) {
  idEtudiantSelectionne = id;
  btnDownloadPDF.disabled = false;
}

btnDownloadPDF.addEventListener("click", () => {
  if (idEtudiantSelectionne) {
    window.open(`${BASE_URL}/api/inscription/fiche/${idEtudiantSelectionne}`, "_blank");
  }
});

// ------------------ Menu admin ------------------
document.addEventListener("DOMContentLoaded", () => {
  const profile = document.querySelector(".user-profile");
  const dropdown = document.getElementById("adminDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  profile.addEventListener("click", () => {
    dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", (e) => {
    if (!profile.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/connectAdmin.html"; 
  });
});

// ------------------ MODAL EDITION ------------------
const modal = document.getElementById('editModal');
const closeModal = document.getElementById('closeEditModal');
const editForm = document.getElementById('editForm');
let currentEditId = null;

closeModal.addEventListener('click', () => modal.style.display = 'none');

document.addEventListener('click', async (e) => {
  if (e.target.closest('.action-btn.edit')) {
    const btn = e.target.closest('.action-btn.edit');
    currentEditId = btn.dataset.id;

    try {
      const res = await fetchWithAuth(`${BASE_URL}/api/inscription/${currentEditId}`);
      if (!res.ok) throw new Error("Étudiant introuvable");
      const data = await res.json();

      editForm.nom_prenom.value = data.nom_prenom || '';
      editForm.formation.value = data.formation || '';
      editForm.createdAt.value = data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : '';

      modal.style.display = 'block';
    } catch (err) {
      console.error("Erreur chargement étudiant", err);
      alert("Impossible de charger les données.");
    }
  }
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    nom_prenom: editForm.nom_prenom.value,
    formation: editForm.formation.value,
    createdAt: editForm.createdAt.value
  };

  try {
    await fetchWithAuth(`${BASE_URL}/api/inscription/${currentEditId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    modal.style.display = 'none';
    chargerInscriptions(document.getElementById("searchInput").value);
  } catch (err) {
    console.error("Erreur mise à jour", err);
    alert("Erreur lors de la mise à jour.");
  }
});

// ------------------ Filtrage ------------------
document.getElementById("btnFiltrer").addEventListener("click", () => {
  const formation = document.getElementById("filtreFormation").value;
  const dateDebut = document.getElementById("dateDebut").value;
  const dateFin = document.getElementById("dateFin").value;
  const filtreTexte = document.getElementById("searchInput").value;

  chargerInscriptions(filtreTexte, formation, dateDebut, dateFin);
});

// ------------------ PDF Liste filtrée ------------------
document.getElementById("btnPDFFiltre").addEventListener("click", () => {
  const formation = document.getElementById("filtreFormation").value;
  const dateDebut = document.getElementById("dateDebut").value;
  const dateFin = document.getElementById("dateFin").value;

  const url = new URL(`${BASE_URL}/api/inscription/pdf-liste`);
  if (formation) url.searchParams.append("formation", formation);
  if (dateDebut) url.searchParams.append("debut", dateDebut);
  if (dateFin) url.searchParams.append("fin", dateFin);

  window.open(url.toString(), "_blank");
});


// ------------------ remplir filtre ------------------

async function remplirFiltreFormations() {
  const select = document.getElementById("filtreFormation");
  select.innerHTML = `<option value="">Toutes les formations</option>`;

  // 🔍 Trouver l’index du champ "formation"





 const indexFormation = champsFormulaireActif.findIndex(champ =>
  champ.label?.toLowerCase().includes("formation")
);


  if (indexFormation === -1) {
    console.warn("Aucun champ avec key='formation' trouvé");
    return;
  }

  try {
    const res = await fetchWithAuth(`${BASE_URL}/api/inscription`);
    const inscrits = await res.json();

    const formationsSet = new Set();

    inscrits.forEach(inscrit => {
      const valeur = inscrit.donnees[`champ_${indexFormation}`];
      if (valeur) formationsSet.add(valeur.trim());
    });

    [...formationsSet].sort().forEach(formation => {
      const option = document.createElement("option");
      option.value = formation;
      option.textContent = formation;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Erreur chargement des formations pour le filtre", err);
  }
}












// ------------------ Gestion des formulaires ------------------
const formFieldsContainer = document.getElementById("formFieldsContainer");
const addFieldBtn = document.getElementById("addFieldBtn");
const saveFormBtn = document.getElementById("saveFormBtn");
const BASE_FORM_API = `${BASE_URL}/api/formulaires`;

let champsFormulaire = [];

const typesDisponibles = [
  { value: "text", label: "Texte" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "title", label: "Titre" },
  { value: "paragraph", label: "Paragraphe" },
  { value: "select", label: "Liste déroulante" }
];

// ➕ Ajouter un champ
addFieldBtn.addEventListener("click", () => {
  const fieldIndex = champsFormulaire.length;
  const champ = {
    type: "text",
    label: "",
    placeholder: "",
    options: [],
    value: ""
  };
  champsFormulaire.push(champ);
  afficherChamps();
});

// 🧾 Afficher les champs dans le DOM
function afficherChamps() {
  formFieldsContainer.innerHTML = "";
  champsFormulaire.forEach((champ, index) => {
    const fieldBlock = document.createElement("div");
    fieldBlock.classList.add("field-block");

    fieldBlock.innerHTML = `
      <select onchange="changerTypeChamp(${index}, this.value)">
        ${typesDisponibles.map(type => `<option value="${type.value}" ${champ.type === type.value ? 'selected' : ''}>${type.label}</option>`).join("")}
      </select>

      <input type="checkbox" onchange="changerRequired(${index}, this.checked)" ${champ.required ? "checked" : ""}> Requis


      <input type="text" placeholder="Label" value="${champ.label || ''}" onchange="changerLabel(${index}, this.value)">
      <input type="text" placeholder="Placeholder" value="${champ.placeholder || ''}" onchange="changerPlaceholder(${index}, this.value)">

      ${champ.type === 'select' ? `<input type="text" placeholder="Option1,Option2" value="${champ.options.join(',')}" onchange="changerOptions(${index}, this.value)">` : ''}

      ${champ.type === 'title' || champ.type === 'paragraph' ? `<input type="text" placeholder="Contenu" value="${champ.value || ''}" onchange="changerValue(${index}, this.value)">` : ''}
      

      <button onclick="supprimerChamp(${index})">X</button>
    `;

    formFieldsContainer.appendChild(fieldBlock);
  });
}

// Fonctions pour mettre à jour les champs
function changerTypeChamp(index, value) {
  champsFormulaire[index].type = value;
  if (value === 'select') champsFormulaire[index].options = [];
  afficherChamps();
}

function changerLabel(index, value) {
  champsFormulaire[index].label = value;
}

function changerPlaceholder(index, value) {
  champsFormulaire[index].placeholder = value;
}

function changerOptions(index, value) {
  champsFormulaire[index].options = value.split(',').map(opt => opt.trim());
}

function changerValue(index, value) {
  champsFormulaire[index].value = value;
}

function supprimerChamp(index) {
  champsFormulaire.splice(index, 1);
  afficherChamps();
}

function changerRequired(index, value) {
  champsFormulaire[index].required = value;
}


saveFormBtn.addEventListener("click", async () => {
  const nom = document.getElementById("formName").value.trim();
  if (!nom) return alert("Le nom du formulaire est requis !");
  if (champsFormulaire.length === 0) return alert("Ajoutez au moins un champ");

  const actif = document.getElementById("formActif").checked;

  // 🔁 Générer des clés techniques avant d’envoyer au backend
  const champsAvecKeys = champsFormulaire.map(champ => ({
    ...champ,
    key: champ.label
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprimer accents
      .replace(/\s+/g, "_")                             // Remplacer espaces par _
      .replace(/[^\w_]/g, "")                           // Supprimer caractères spéciaux
  }));

  try {
    const res = await fetchWithAuth(BASE_FORM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, champs: champsAvecKeys, actif })  // 👈 Ici, on envoie bien champsAvecKeys
    });

    if (!res.ok) throw new Error("Erreur API");

    const data = await res.json();
    alert("Formulaire enregistré avec succès !");
    document.getElementById("formName").value = "";
    document.getElementById("formActif").checked = false;
    champsFormulaire = [];
    afficherChamps();
  } catch (err) {
    alert("Erreur lors de l’enregistrement");
    console.error(err);
  }
});





// ------------------ Gestion des formulaires (affichage) ------------------

window.changerLabel = changerLabel;
window.changerPlaceholder = changerPlaceholder;
window.changerOptions = changerOptions;
window.changerValue = changerValue;
window.supprimerChamp = supprimerChamp;
window.changerTypeChamp = changerTypeChamp;












// Charger la liste des formulaires depuis l’API


async function chargerListeFormulaires() {
  const tbody = document.querySelector("#formListTable tbody");
  tbody.innerHTML = "";

  try {
    const res = await fetchWithAuth(BASE_FORM_API);
    if (!res.ok) throw new Error("Erreur API formulaires");
    const formulaires = await res.json();

    formulaires.forEach(form => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${form.nom}</td>
        <td>${form.actif ? '<span class="status confirmed">Oui</span>' : '<span class="status pending">Non</span>'}</td>
        <td>
          <button class="edit-form-btn" data-id="${form._id}"><i class="fas fa-edit"></i></button>
          <button class="activate-form-btn" data-id="${form._id}">${form.actif ? 'Désactiver' : 'Activer'}</button>
          <button class="delete-form-btn" data-id="${form._id}"><i class="fas fa-trash"></i></button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Écouteurs sur les boutons après création
    document.querySelectorAll(".edit-form-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await chargerFormulairePourEdition(id);
      });
    });

    document.querySelectorAll(".activate-form-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await activerDesactiverFormulaire(id);
      });
    });

    document.querySelectorAll(".delete-form-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (confirm("Voulez-vous vraiment supprimer ce formulaire ?")) {
          await supprimerFormulaire(id);
        }
      });
    });

  } catch (err) {
    console.error("Erreur chargement liste formulaires", err);
    alert("Impossible de charger la liste des formulaires.");
  }
}



// Charger le formulaire pour édition


async function chargerFormulairePourEdition(id) {
  try {
    const res = await fetchWithAuth(`${BASE_FORM_API}/id/${id}`);

    if (!res.ok) throw new Error("Formulaire introuvable");
    const form = await res.json();

    document.getElementById("formName").value = form.nom;
    document.getElementById("formActif").checked = form.actif || false;

    champsFormulaire = form.champs || [];
    afficherChamps();

    // Garder en mémoire l'id pour update au lieu de créer
    currentFormulaireId = id;
  } catch (err) {
    console.error("Erreur chargement formulaire pour édition", err);
    alert("Impossible de charger le formulaire pour modification.");
  }
}




// Modifier le bouton "Enregistrer" pour gérer la création ou mise à jour


let currentFormulaireId = null;

saveFormBtn.addEventListener("click", async () => {
  const nom = document.getElementById("formName").value.trim();
  if (!nom) return alert("Le nom du formulaire est requis !");
  if (champsFormulaire.length === 0) return alert("Ajoutez au moins un champ");

  const actif = document.getElementById("formActif").checked;

  const champsAvecKeys = champsFormulaire.map(champ => ({
    ...champ,
    key: champ.label
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "")
  }));

  try {
    const method = currentFormulaireId ? "PUT" : "POST";
    const url = currentFormulaireId ? `${BASE_FORM_API}/${currentFormulaireId}` : BASE_FORM_API;

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, champs: champsAvecKeys, actif })
    });

    if (!res.ok) throw new Error("Erreur API");

    alert(`Formulaire ${currentFormulaireId ? "mis à jour" : "enregistré"} avec succès !`);

    // Reset
    currentFormulaireId = null;
    document.getElementById("formName").value = "";
    document.getElementById("formActif").checked = false;
    champsFormulaire = [];
    afficherChamps();

    // Recharge la liste des formulaires
    chargerListeFormulaires();

  } catch (err) {
    alert("Erreur lors de l’enregistrement");
    console.error(err);
  }
});








// Activer ou désactiver un formulaire

async function activerDesactiverFormulaire(id) {
  try {
    // Idéalement backend : un PATCH /api/formulaires/:id/actif
    const res = await fetchWithAuth(`${BASE_FORM_API}/${id}/actif`, { method: 'PATCH' });
    if (!res.ok) throw new Error("Erreur API activation");

    alert("Statut activé/désactivé avec succès !");
    chargerListeFormulaires();
  } catch (err) {
    alert("Erreur lors de la mise à jour du statut");
    console.error(err);
  }
}



// Supprimer un formulaire


async function supprimerFormulaire(id) {
  try {
    const res = await fetchWithAuth(`${BASE_FORM_API}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error("Erreur API suppression");

    alert("Formulaire supprimé avec succès !");
    chargerListeFormulaires();
  } catch (err) {
    alert("Erreur lors de la suppression");
    console.error(err);
  }
}





//  ------------------ Changement de mot de passe ------------------



document.getElementById('passwordChangeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const messageEl = document.getElementById('passwordChangeMessage');

  try {
    const token = localStorage.getItem('token'); // ⬅️ Assure-toi de stocker le token au login
    const response = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const result = await response.json();

    if (response.ok) {
      messageEl.style.color = 'green';
    } else {
      messageEl.style.color = 'red';
    }
    messageEl.textContent = result.message;
  } catch (error) {
    messageEl.style.color = 'red';
    messageEl.textContent = '❌ Erreur lors de la mise à jour du mot de passe.';
    console.error(error);
  }
});













document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('.main-section');
  const navLinks = document.querySelectorAll('.nav-link');

  function showSection(idToShow) {
    sections.forEach(section => {
      section.style.display = (section.id === idToShow) ? 'block' : 'none';
    });

    // Met à jour la classe active sur les nav-items
    navLinks.forEach(link => {
      const parentNavItem = link.closest('.nav-item');
      if (link.getAttribute('href') === '#' + idToShow) {
        parentNavItem.classList.add('active');
      } else {
        parentNavItem.classList.remove('active');
      }
    });
  }

  // Au départ, on affiche la section inscriptions par exemple
  showSection('table-inscription');

  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      showSection(targetId);

      // Optionnel : Scroll vers le haut du contenu principal
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
