  // // const BASE_URL = "http://localhost:3000";
  // const BASE_URL = "https://ecefa-form-0l7s.onrender.com";

  // Exemple automatique pour BASE_URL
const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : window.location.origin; // même origine en production (évite CORS inter-sous-domaines)

// Attendre que le DOM soit prêt avant d'ajouter les écouteurs
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');


  


  // ✅ Connexion admin
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = form.username.value.trim();
      const password = form.password.value;

      if (!username || !password) {
        alert('Veuillez remplir tous les champs.');
        return;
      }

      try {
        const res = await fetch(`${BASE_URL}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await res.json() : await res.text();

        if (res.ok) {
          const token = isJson ? payload.token : null;
          if (!token) {
            console.error('Réponse inattendue (pas de token):', payload);
            alert('Réponse inattendue du serveur.');
            return;
          }
          alert('✅ Connexion réussie !');
          localStorage.setItem('token', token);
          window.location.href = '/admin.html';
        } else {
          const message = isJson ? (payload.message || 'Échec de la connexion.') : payload?.slice(0, 200);
          alert('❌ ' + message);
        }
      } catch (err) {
        alert('❌ Erreur de connexion au serveur.');
        console.error(err);
      }
    });
  }
});
