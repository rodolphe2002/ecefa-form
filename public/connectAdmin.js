  // const BASE_URL = "http://localhost:3000";
  const BASE_URL = "https://ecefa-form.onrender.com";


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

        const data = await res.json();

        if (res.ok) {
          alert('✅ Connexion réussie !');
          localStorage.setItem('token', data.token);
          window.location.href = '/admin.html';
        } else {
          alert('❌ ' + (data.message || 'Échec de la connexion.'));
        }
      } catch (err) {
        alert('❌ Erreur de connexion au serveur.');
        console.error(err);
      }
    });
  }
});
