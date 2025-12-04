import { db, auth } from './config.js'; 
import { collection, onSnapshot, doc, updateDoc, getDocs, setDoc, addDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let estoqueLocal = [];
let colaboradoresCache = [];

// 1. CARREGAR DADOS
onSnapshot(collection(db, "estoque_insumos"), (snap) => {
    estoqueLocal = [];
    snap.forEach(d => estoqueLocal.push({ id: d.id, ...d.data() }));
    renderizar();
    atualizarDropdowns();
});

// Carrega RH
async function carregarRH() {
    try {
        const snap = await getDocs(collection(db, "colaboradores"));
        colaboradoresCache = [];
        snap.forEach(d => colaboradoresCache.push({ id: d.id, ...d.data() }));
    } catch (e) { console.log("RH vazio"); }
}
carregarRH();

// 2. FUNÇÃO DE ENTRADA (CÓDIGO | DESCRIÇÃO | EMBALAGEM)
window.realizarEntrada = async () => {
    const cod = document.getElementById('ent-cod').value.trim().toUpperCase();
    const desc = document.getElementById('ent-desc').value.trim().toUpperCase();
    const emb = document.getElementById('ent-emb').value.trim().toUpperCase();
    const qtdInput = parseInt(document.getElementById('ent-qtd').value);
    
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

    if (!cod || !desc || !emb || !qtdInput || qtdInput <= 0) return alert("Preencha todos os campos!");

    // O ID do documento será o CÓDIGO para garantir unicidade
    const idItem = cod.replace(/[^a-zA-Z0-9]/g, ''); 
    
    // Verifica se já existe para somar
    const itemExistente = estoqueLocal.find(i => i.id === idItem);
    let novaQtd = qtdInput;
    if (itemExistente) {
        novaQtd += itemExistente.qtd;
        // Se mudou a descrição ou embalagem, atualiza também
    }

    try {
        await setDoc(doc(db, "estoque_insumos", idItem), {
            id: idItem, // Salva o código como campo também
            nome: desc,
            emb: emb,
            qtd: novaQtd, 
            ultimaEntrada: new Date().toLocaleDateString()
        }, { merge: true });

        // LOG
        await addDoc(collection(db, "historico_logs"), {
            timestamp: Date.now(), data: new Date().toLocaleString(),
            tipo: 'ENTRADA_INSUMO', 
            ativo: `${desc} (${emb})`, 
            obs: `+${qtdInput} (Cod: ${cod})`, 
            colaborador: '-', 
            operador: operadorLogado
        });

        alert("✅ Estoque atualizado!");
        // Limpa campos
        document.getElementById('ent-cod').value = '';
        document.getElementById('ent-desc').value = '';
        document.getElementById('ent-emb').value = '';
        document.getElementById('ent-qtd').value = '';
        document.getElementById('ent-cod').focus();

    } catch (e) { console.error(e); alert("Erro ao salvar."); }
};

// 3. FUNÇÃO DE SAÍDA
window.realizarSaida = async () => {
    const cracha = document.getElementById('sai-cracha').value.toUpperCase();
    const idItem = document.getElementById('sai-item').value; // Isso pega o CÓDIGO
    const qtdInput = parseInt(document.getElementById('sai-qtd').value);
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

    if (!cracha || !idItem || qtdInput <= 0) return alert("Preencha tudo!");

    const colab = colaboradoresCache.find(c => c.id === cracha);
    if (!colab) return alert("🚨 Crachá não encontrado!");

    const item = estoqueLocal.find(i => i.id === idItem);
    if (!item) return alert("Item não encontrado!");
    if (item.qtd < qtdInput) return alert(`⛔ Saldo insuficiente! Disp: ${item.qtd}`);

    try {
        await updateDoc(doc(db, "estoque_insumos", idItem), { qtd: item.qtd - qtdInput });

        // LOG
        await addDoc(collection(db, "historico_logs"), {
            timestamp: Date.now(), data: new Date().toLocaleString(),
            tipo: 'SAIDA_INSUMO', 
            ativo: `${item.nome} (${item.emb})`, 
            obs: `-${qtdInput} (Cod: ${item.id})`, 
            colaborador: `${colab.nome} (${cracha})`, 
            operador: operadorLogado
        });

        alert(`✅ Retirada OK!`);
        
        document.getElementById('sai-item').value = '';
        document.getElementById('sai-qtd').value = '1';
        document.getElementById('label-saldo').innerText = 'Disp: -';
        document.getElementById('sai-cracha').focus();

    } catch (e) { console.error(e); alert("Erro na saída."); }
};

// 4. RENDERIZAÇÃO DA TABELA
function renderizar() {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';
    let critico = 0, ok = 0;

    // Ordena por Nome
    estoqueLocal.sort((a,b) => a.nome.localeCompare(b.nome));

    estoqueLocal.forEach(item => {
        let classeSaldo = 'saldo-tag';
        if(item.qtd <= 5) { classeSaldo += ' saldo-baixo'; critico++; } 
        else { ok++; }

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.id}</strong></td> <td>${item.nome}</td> <td><small>${item.emb}</small></td> <td><span class="${classeSaldo}">${item.qtd}</span></td> <td style="text-align:right">
                    <button onclick="preencherEntrada('${item.id}', '${item.nome}', '${item.emb}')" style="padding:5px 10px; background:var(--success); color:white; border:none; border-radius:4px; cursor:pointer;">+ Repor</button>
                </td>
            </tr>`;
    });
    document.getElementById('kpi-ok').innerText = ok;
    document.getElementById('kpi-baixo').innerText = critico;
}

function atualizarDropdowns() {
    const select = document.getElementById('sai-item');
    const valAtual = select.value; 
    select.innerHTML = '<option value="">Selecione o Material...</option>';
    
    estoqueLocal.forEach(i => {
        // Mostra: [CÓDIGO] DESCRIÇÃO (EMB) - Saldo: X
        select.innerHTML += `<option value="${i.id}">[${i.id}] ${i.nome} (${i.emb}) - Disp: ${i.qtd}</option>`;
    });
    select.value = valAtual;
}

document.getElementById('sai-item').addEventListener('change', function() {
    const item = estoqueLocal.find(i => i.id === this.value);
    document.getElementById('label-saldo').innerText = item ? `Disp: ${item.qtd} ${item.emb}` : 'Disp: -';
});

// Atalho para preencher a entrada clicando na tabela
window.preencherEntrada = (cod, nome, emb) => { 
    document.getElementById('ent-cod').value = cod;
    document.getElementById('ent-desc').value = nome; 
    document.getElementById('ent-emb').value = emb; 
    document.getElementById('ent-qtd').focus(); 
};

window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-corpo tr');
    linhas.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none');
};