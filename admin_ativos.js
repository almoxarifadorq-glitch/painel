import { db } from './config.js';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Lista global para filtro
let listaAtivos = [];

// Escuta em Tempo Real
onSnapshot(collection(db, "frota_tempo_real"), (snap) => {
    listaAtivos = [];
    snap.forEach(d => listaAtivos.push({ docId: d.id, ...d.data() }));
    renderizar(listaAtivos);
});

function renderizar(lista) {
    const tbody = document.getElementById('lista-corpo');
    tbody.innerHTML = '';
    
    // Ordena alfabeticamente pelo ID
    lista.sort((a,b) => a.id.localeCompare(b.id));

    lista.forEach(item => {
        // Ajuste visual da tag
        let badge = `<span class="tag" style="background:#d4edda; color:#155724">DISPONÍVEL</span>`;
        if(item.status !== 'DISPONIVEL') badge = `<span class="tag tag-manutencao">${item.status}</span>`;

        let icone = '';
        if(item.id.startsWith('COL')) icone = '📱';
        else if(item.id.startsWith('HST')) icone = '🎧';
        else if(item.id.startsWith('EMP') || item.id.startsWith('TRA')) icone = '🚜';

        tbody.innerHTML += `
            <tr>
                <td><strong>${icone} ${item.id}</strong></td>
                <td>${badge}</td>
                <td style="text-align:right">
                    ${item.status === 'MANUTENCAO' || item.status === 'CARGA' ? 
                    `<button class="btn-success" onclick="liberar('${item.docId}')" style="padding:5px; width:auto;">✅ Liberar</button>` : ''}
                    <button class="btn-clear" onclick="excluir('${item.docId}')" style="padding:5px; color:var(--danger);">🗑️</button>
                </td>
            </tr>`;
    });
}

// CADASTRO INDIVIDUAL
window.cadastrarAtivo = async () => {
    const id = document.getElementById('novo-id').value.toUpperCase().trim();
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    
    if(!id) return alert("Preencha o ID!");

    await salvarNoBanco(id, tipo);
    
    alert("✅ Ativo Salvo!");
    document.getElementById('novo-id').value = '';
    document.getElementById('novo-id').focus();
};

// ========================================================
// NOVA FUNÇÃO: IMPORTAÇÃO EM MASSA INTELIGENTE
// ========================================================
window.importarMassaAtivos = async () => {
    const texto = document.getElementById('texto-importacao').value;
    if(!texto.trim()) return alert("Cole a lista do Excel primeiro!");

    // Separa por qualquer espaço em branco (enter, tab, espaço)
    // Isso permite colar várias colunas de uma vez
    const itens = texto.split(/\s+/); 
    
    if(!confirm(`Identifiquei ${itens.filter(i => i.trim()).length} códigos. Confirmar importação?`)) return;

    let contador = 0;

    for (let item of itens) {
        let id = item.trim().toUpperCase();
        if(id) {
            // DETECTA O TIPO AUTOMATICAMENTE
            let tipo = 'COL'; // Padrão
            if(id.startsWith('HST')) tipo = 'HST';
            else if(id.startsWith('EMP') || id.startsWith('TRA')) tipo = 'EMP';
            else if(id.startsWith('COL')) tipo = 'COL';
            else {
                // Se não tiver prefixo claro, usa o que estiver marcado no radio button
                tipo = document.querySelector('input[name="tipo"]:checked').value;
            }

            await salvarNoBanco(id, tipo);
            contador++;
        }
    }

    alert(`✅ Sucesso! ${contador} ativos importados/atualizados.`);
    document.getElementById('texto-importacao').value = '';
};

// Função Auxiliar de Salvar
async function salvarNoBanco(id, tipo) {
    // Usa 'setDoc' com merge:true para não apagar status se já existir, 
    // mas garante que cria se não existir.
    // Se quiser resetar o status pra DISPONIVEL sempre, remova o if.
    
    // Verifica se já existe pra não resetar status de quem tá em uso
    const existente = listaAtivos.find(i => i.id === id);
    
    if (!existente) {
        await setDoc(doc(db, "frota_tempo_real", id), {
            id: id, tipo: tipo, status: 'DISPONIVEL', user: '', horaSaida: ''
        });
    }
}

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

window.filtrarAtivos = () => {
    const termo = document.getElementById('busca').value.toLowerCase();
    const filtrados = listaAtivos.filter(i => i.id.toLowerCase().includes(termo));
    renderizar(filtrados);
};