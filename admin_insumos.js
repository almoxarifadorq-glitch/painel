import { db, auth } from './config.js'; 
import { collection, onSnapshot, doc, updateDoc, getDocs, setDoc, addDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Variáveis Globais
let estoqueLocal = [];
let colaboradoresCache = [];

// 1. CARREGAR DADOS EM TEMPO REAL
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

// 2. FUNÇÃO DE ENTRADA (ABASTECIMENTO)
window.realizarEntrada = async () => {
    const nomeItem = document.getElementById('ent-item').value.trim().toUpperCase();
    const qtdInput = parseInt(document.getElementById('ent-qtd').value);
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

    if (!nomeItem || !qtdInput || qtdInput <= 0) return alert("Preencha nome e quantidade!");

    const idItem = nomeItem.replace(/[^a-zA-Z0-9]/g, '_'); 
    const itemExistente = estoqueLocal.find(i => i.id === idItem);

    let novaQtd = qtdInput;
    if (itemExistente) novaQtd += itemExistente.qtd;

    try {
        await setDoc(doc(db, "estoque_insumos", idItem), {
            nome: nomeItem, qtd: novaQtd, ultimaEntrada: new Date().toLocaleDateString()
        }, { merge: true });

        // LOG DE ENTRADA
        await addDoc(collection(db, "historico_logs"), {
            timestamp: Date.now(), data: new Date().toLocaleString(),
            tipo: 'ENTRADA_INSUMO', 
            ativo: nomeItem, 
            obs: `+${qtdInput}`, 
            colaborador: '-', // Entrada não tem colaborador pegando
            operador: operadorLogado
        });

        alert("✅ Estoque atualizado!");
        document.getElementById('ent-item').value = '';
        document.getElementById('ent-qtd').value = '';

    } catch (e) { console.error(e); alert("Erro ao salvar."); }
};

// 3. FUNÇÃO DE SAÍDA (AQUI ESTAVA O PROBLEMA)
window.realizarSaida = async () => {
    const cracha = document.getElementById('sai-cracha').value.toUpperCase();
    const idItem = document.getElementById('sai-item').value;
    const qtdInput = parseInt(document.getElementById('sai-qtd').value);
    
    // Pega quem liberou
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

    if (!cracha || !idItem || qtdInput <= 0) return alert("Preencha tudo!");

    // Busca quem está pegando
    const colab = colaboradoresCache.find(c => c.id === cracha);
    if (!colab) return alert("🚨 Crachá não encontrado no RH!");

    const item = estoqueLocal.find(i => i.id === idItem);
    if (!item) return alert("Item não encontrado!");
    if (item.qtd < qtdInput) return alert(`⛔ Saldo insuficiente! Disp: ${item.qtd}`);

    try {
        // Atualiza saldo
        await updateDoc(doc(db, "estoque_insumos", idItem), { qtd: item.qtd - qtdInput });

        // LOG DE SAÍDA (BLINDADO)
        await addDoc(collection(db, "historico_logs"), {
            timestamp: Date.now(), data: new Date().toLocaleString(),
            tipo: 'SAIDA_INSUMO', 
            ativo: item.nome, 
            obs: `-${qtdInput}`, 
            
            // AQUI ESTÃO OS DOIS CAMPOS IMPORTANTES:
            colaborador: `${colab.nome} (${cracha})`, // Quem Pegou
            operador: operadorLogado                  // Quem Liberou
        });

        alert(`✅ Retirada OK para ${colab.nome}`);
        
        document.getElementById('sai-item').value = '';
        document.getElementById('sai-qtd').value = '1';
        document.getElementById('label-saldo').innerText = 'Disp: -';
        document.getElementById('sai-cracha').focus();

    } catch (e) { console.error(e); alert("Erro na saída."); }
};

// 4. RENDERIZAÇÃO
function renderizar() {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';
    let critico = 0, ok = 0;

    estoqueLocal.sort((a,b) => a.nome.localeCompare(b.nome));

    estoqueLocal.forEach(item => {
        let classeSaldo = 'saldo-tag';
        let status = 'OK';
        if(item.qtd <= 5) { classeSaldo += ' saldo-baixo'; status = 'BAIXO'; critico++; } 
        else { ok++; }

        tbody.innerHTML += `
            <tr>
                <td><strong>${item.nome}</strong></td>
                <td><span class="${classeSaldo}">${item.qtd}</span></td>
                <td>${status}</td>
                <td style="text-align:right">
                    <button onclick="preencherEntrada('${item.nome}')" style="padding:5px 10px; background:var(--success); color:white; border:none; border-radius:4px; cursor:pointer;">+ Repor</button>
                </td>
            </tr>`;
    });
    document.getElementById('kpi-ok').innerText = ok;
    document.getElementById('kpi-baixo').innerText = critico;
}

function atualizarDropdowns() {
    const datalist = document.getElementById('lista-itens');
    datalist.innerHTML = '';
    estoqueLocal.forEach(i => datalist.innerHTML += `<option value="${i.nome}">`);

    const select = document.getElementById('sai-item');
    const valAtual = select.value; 
    select.innerHTML = '<option value="">Selecione o Material...</option>';
    estoqueLocal.forEach(i => select.innerHTML += `<option value="${i.id}">${i.nome}</option>`);
    select.value = valAtual;
}

document.getElementById('sai-item').addEventListener('change', function() {
    const item = estoqueLocal.find(i => i.id === this.value);
    document.getElementById('label-saldo').innerText = item ? `Disp: ${item.qtd}` : 'Disp: -';
});

window.preencherEntrada = (n) => { document.getElementById('ent-item').value = n; document.getElementById('ent-qtd').focus(); };
window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-corpo tr');
    linhas.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none');
};