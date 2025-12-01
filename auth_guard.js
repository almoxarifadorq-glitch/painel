import { auth } from './config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Verifica se tem alguém logado
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // SE NÃO TIVER LOGADO, CHUTA PRO LOGIN
        // (Mas só se a gente já não estiver na tela de login pra não dar loop)
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // SE TIVER LOGADO
        console.log("Usuário logado:", user.email);
        
        // Se estiver na tela de login, manda pro painel
        if (window.location.href.includes('login.html')) {
            window.location.href = 'index.html';
        }

        // Atualiza o nome no topo (se existir o elemento)
        const userDisplay = document.getElementById('user-display');
        if(userDisplay) userDisplay.innerHTML = `👤 <strong>${user.email}</strong>`;
    }
});

// Função Global de Logout
window.fazerLogout = () => {
    signOut(auth).then(() => {
        alert("Desconectado!");
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error(error);
    });
};