import { db } from './config.js';
import { collection, onSnapshot, setDoc, doc, deleteDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Lista global para filtro
let listaColab = [];

onSnapshot(collection(db, "colaboradores"), (snap) => {
    listaColab = [];
    snap.forEach(d => listaColab.push({ docId: d.id, ...d.data() }));
    renderizar(listaColab);
});

function renderizar(lista) {
    const tbody = document.getElementById('lista-rh');
    tbody.innerHTML = '';
    
    // Ordena por nome
    lista.sort((a,b) => a.nome.localeCompare(b.nome));

    lista.forEach(c => {
        // Gera as tags de permissão visualmente
        let tags = '';
        if(c.perms.includes('COL')) tags += `<span class="tag" style="background:#d1ecf1; color:#0c5460; margin-right:3px">COL</span>`;
        if(c.perms.includes('HST')) tags += `<span class="tag" style="background:#e2e3e5; color:#383d41; margin-right:3px">HST</span>`;
        if(c.perms.includes('EMP')) tags += `<span class="tag" style="background:#fff3cd; color:#856404; margin-right:3px">MÁQ</span>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${c.id}</strong></td>
                <td>${c.nome}</td>
                <td>${tags}</td>
                <td style="text-align:right">
                    <button class="btn-clear" onclick="excluirRH('${c.docId}')" style="color:var(--danger); padding:5px;">🗑️</button>
                </td>
            </tr>`;
    });
}

window.salvarRH = async () => {
    const id = document.getElementById('novo-mat').value.toUpperCase();
    const nome = document.getElementById('novo-nome').value.toUpperCase();
    
    if(!id || !nome) return alert("Preencha Matrícula e Nome!");

    const perms = [];
    if(document.getElementById('perm-col').checked) perms.push('COL');
    if(document.getElementById('perm-hst').checked) perms.push('HST');
    if(document.getElementById('perm-emp').checked) perms.push('EMP');

    // Salva usando Matrícula como ID
    await setDoc(doc(db, "colaboradores", id), { id, nome, perms });
    
    alert("✅ Colaborador Salvo!");
    document.getElementById('novo-mat').value = '';
    document.getElementById('novo-nome').value = '';
    document.getElementById('novo-mat').focus();
};

window.excluirRH = async (id) => {
    if(confirm("Remover colaborador da base?")) {
        await deleteDoc(doc(db, "colaboradores", id));
    }
};

window.filtrarRH = () => {
    const termo = document.getElementById('busca').value.toLowerCase();
    const filtrados = listaColab.filter(c => c.nome.toLowerCase().includes(termo) || c.id.includes(termo));
    renderizar(filtrados);
};