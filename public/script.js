const BASE_URL = "http://localhost:3000";
// const BASE_URL = "https://ecefa-form.onrender.com";

// 🌟 Animation de bulles de fond
const bgAnimation = document.getElementById('bgAnimation');
for (let i = 0; i < 20; i++) {
    const bubble = document.createElement('div');
    bubble.classList.add('bubble');
    const size = Math.random() * 100 + 20;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.animationDelay = `${Math.random() * 15}s`;
    bubble.style.animationDuration = `${10 + Math.random() * 20}s`;
    bgAnimation.appendChild(bubble);
}

// 🌟 Animation des champs et bouton
function relancerAnimationsFormulaire() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.parentElement.style.transform = 'translateZ(30px)';
        });
        input.addEventListener('blur', function () {
            this.parentElement.parentElement.style.transform = 'translateZ(0)';
        });
    });

    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.querySelector('i').style.transform = 'translateX(5px)';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.querySelector('i').style.transform = 'translateX(0)';
        });
    }
}

// 🌟 Animation de la carte 3D
const card = document.querySelector('.card');
document.addEventListener('mousemove', (e) => {
    const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
    const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
    card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
});
card.addEventListener('mouseleave', () => {
    card.style.transform = 'rotateY(0deg) rotateX(0deg)';
    card.style.transition = 'all 0.5s ease';
    setTimeout(() => { card.style.transition = ''; }, 500);
});
card.addEventListener('mouseenter', () => {
    card.style.transition = 'none';
});

// 🌟 Générer une clé de stockage locale
function generateLocalKey(nom, telephone) {
    const nomSafe = (nom || "").trim().toLowerCase().replace(/\s+/g, '_');
    const telSafe = (telephone || "").trim();
    return `ecefa_${nomSafe}_${telSafe}`;
}

// 🌟 Vérification automatique si déjà inscrit
function verifierInscriptionAuto() {
    const nomInput = document.getElementById("nom_prenom");
    const naissanceInput = document.getElementById("date_naissance");
    const telInput = document.getElementById("telephone");

    if (!nomInput || !naissanceInput || !telInput) return;

    const nom = nomInput.value.trim();
    const naissance = naissanceInput.value;
    const tel = telInput.value.trim();

    const count = [nom, naissance, tel].filter(Boolean).length;
    if (count < 2) return;

    const url = `${BASE_URL}/api/inscription/verifier?` +
        `nom_prenom=${encodeURIComponent(nom)}&` +
        `date_naissance=${encodeURIComponent(naissance)}&` +
        `telephone=${encodeURIComponent(tel)}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.inscrit) {
                const presentationText = document.getElementById("presentationText");
                if (presentationText) {
                    presentationText.textContent = `Bonjour Monsieur ${data.nom}, vous êtes déjà inscrit pour votre formation.`;
                }
                document.querySelector("form").style.display = "none";
                localStorage.setItem(generateLocalKey(nom, tel), '1');
                localStorage.setItem('nom_inscrit', nom);
                localStorage.setItem('tel_inscrit', tel);
            }
        })
        .catch(err => console.error("Erreur vérification auto :", err));
}

// 🌟 Chargement dynamique du formulaire
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.querySelector("form.form-container");
    form.innerHTML = "";

    try {
        const res = await fetch(`${BASE_URL}/api/formulaires/actif`);
        const formulaire = await res.json();

        if (!formulaire || !formulaire.champs) throw new Error("Aucun formulaire actif");

        // Mise à jour dynamique du titre et du paragraphe
        const titreElement = document.querySelector('.header h1');
        if (titreElement && formulaire.nom) {
            titreElement.textContent = formulaire.nom;
        }

        const presentationElement = document.getElementById('presentationText');
        if (presentationElement) {
            const champParagraphe = formulaire.champs.find(champ => champ.type === 'paragraph');
            if (champParagraphe && (champParagraphe.value || champParagraphe.label)) {
                presentationElement.textContent = champParagraphe.value || champParagraphe.label;
            }
        }


        formulaire.champs.forEach((champ, index) => {
            const groupe = document.createElement("div");
            groupe.className = "form-group";

            let iconHTML = `<i class="fas fa-circle"></i>`;
            if (champ.type === "text") iconHTML = `<i class="fas fa-user"></i>`;
            if (champ.type === "email") iconHTML = `<i class="fas fa-envelope"></i>`;
            if (champ.type === "date") iconHTML = `<i class="fas fa-calendar-alt"></i>`;
            if (champ.type === "month") iconHTML = `<i class="fas fa-calendar-check"></i>`;
            if (champ.type === "tel") iconHTML = `<i class="fas fa-phone"></i>`;
            if (champ.type === "whatsapp") iconHTML = `<i class="fab fa-whatsapp"></i>`;
            if (champ.type === "select") iconHTML = `<i class="fas fa-chevron-down"></i>`;

            let champHTML = "";
            const id = champ.key || `champ_${index}`; // 👈 nouvelle ligne
            const name = id;


            if (champ.type === "title") {

            } else if (champ.type === "paragraph") {

            } else if (champ.type === "select") {
                champHTML = `
                    <select id="${id}" name="${name}" required>
                        <option value="" disabled selected>${champ.placeholder || "Sélectionnez une option"}</option>
                        ${champ.options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
                    </select>
                `;
            } else {
                champHTML = `
                    <input
                        type="${champ.type}"
                        id="${id}"
                        name="${name}"
                        required
                        placeholder="${champ.placeholder || ""}"
                    >
                `;
            }

            groupe.innerHTML = `
                ${champ.label ? `<label for="${id}">${champ.label}</label>` : ""}
                <div class="input-container">
                    ${iconHTML}
                    ${champHTML}
                </div>
            `;
            form.appendChild(groupe);
        });

        // Bouton de soumission
        const submitBtn = document.createElement("button");
        submitBtn.type = "submit";
        submitBtn.className = "btn-submit";
        submitBtn.innerHTML = `<span>S'inscrire maintenant</span><i class="fas fa-arrow-right"></i>`;
        form.appendChild(submitBtn);

        relancerAnimationsFormulaire();

        // Vérification auto lors du blur
        ["nom_prenom", "date_naissance", "telephone"].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener("blur", verifierInscriptionAuto);
        });

        // 🌟 Soumission du formulaire dynamique
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const inputs = form.querySelectorAll("input, select");
            const donnees = {};

            inputs.forEach(input => {
                if (input.id) {
                    donnees[input.id] = input.value;
                }
            });

            const nom = donnees.nom_prenom;
            const tel = donnees.telephone;
            const localKey = generateLocalKey(nom, tel);

            if (localStorage.getItem(localKey) === '1') {
                alert("⚠️ Vous êtes déjà inscrit depuis ce navigateur.");
                return;
            }

            try {
                const res = await fetch(`${BASE_URL}/api/inscription`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(donnees)
                });

                const result = await res.json();
                if (res.ok) {
                    alert(result.message);
                    localStorage.setItem(localKey, '1');
                    localStorage.setItem('nom_inscrit', nom);
                    localStorage.setItem('tel_inscrit', tel);
                    form.reset();
                    form.style.display = "none";
                } else {
                    alert(result.message || "Erreur.");
                }

            } catch (err) {
                alert("❌ Erreur de connexion au serveur.");
            }
        });

    } catch (err) {
        console.error("Erreur chargement formulaire :", err);
        form.innerHTML = `<p style="color:red; text-align:center;">❌ Formulaire indisponible</p>`;
    }
});
