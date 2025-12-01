import { db } from './config.js';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Escuta em Tempo Real
onSnapshot(collection(db, "frota_tempo_real"), (snap) => {
    const tbody = document.getElementById('lista-corpo');
    tbody.innerHTML = '';
    
    const lista = [];
    snap.forEach(d => lista.push({ docId: d.id, ...d.data() }));
    // Ordena alfabeticamente pelo ID
    lista.sort((a,b) => a.id.localeCompare(b.id));

    lista.forEach(item => {
        let statusClass = item.status === 'DISPONIVEL' ? 'tag-uso' : 'tag-manut'; // Reuso das cores
        if(item.status === 'DISPONIVEL') statusClass = 'tag-uso'; // Verde visualmente se tiver style especifico ou usa padrao
        
        // Ajuste visual da tag
        let badge = `<span class="tag" style="background:#d4edda; color:#155724">DISPONÍVEL</span>`;
        if(item.status !== 'DISPONIVEL') badge = `<span class="tag tag-manutencao">${item.status}</span>`;

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.id}</strong></td>
                <td>${badge}</td>
                <td style="text-align:right">
                    ${item.status === 'MANUTENCAO' || item.status === 'CARGA' ? 
                    `<button class="btn-success" onclick="liberar('${item.docId}')" style="padding:5px; width:auto;">✅ Liberar</button>` : ''}
                    <button class="btn-clear" onclick="excluir('${item.docId}')" style="padding:5px; color:var(--danger);">🗑️</button>
                </td>
            </tr>`;
    });
});

// Funções Globais
window.cadastrarAtivo = async () => {
    const id = document.getElementById('novo-id').value.toUpperCase();
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    
    if(!id) return alert("Preencha o ID!");

    // Salva usando o ID como chave (evita duplicatas)
    await setDoc(doc(db, "frota_tempo_real", id), {
        id: id, tipo: tipo, status: 'DISPONIVEL', user: '', horaSaida: ''
    });
    
    alert("✅ Ativo Salvo!");
    document.getElementById('novo-id').value = '';
    document.getElementById('novo-id').focus();
};

window.excluir = async (id) => {
    if(confirm("Tem certeza que deseja excluir este ativo?")) {
        await deleteDoc(doc(db, "frota_tempo_real", id));
    }
};

window.liberar = async (id) => {
    await updateDoc(doc(db, "frota_tempo_real", id), { status: 'DISPONIVEL', user: '', horaSaida: '' });
};

window.detectarTipo = () => {
    const val = document.getElementById('novo-id').value.toUpperCase();
    if(val.startsWith('COL')) document.getElementById('radio-col').checked = true;
    else if(val.startsWith('HST')) document.getElementById('radio-hst').checked = true;
    else if(val.startsWith('EMP')||val.startsWith('TRA')) document.getElementById('radio-emp').checked = true;
};