// script.js (Atualizado para usar config.js)
import { db } from './config.js'; // <--- Lê a configuração compartilhada
import { collection, addDoc, doc, updateDoc, onSnapshot, query, getDocs, where, limit, orderBy } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// VARIÁVEIS GLOBAIS
let frotaLocal = [];
let colaboradoresCache = [];

// --- INICIALIZAÇÃO ---

// Escuta em Tempo Real (Frota)
const qFrota = query(collection(db, "frota_tempo_real"));
onSnapshot(qFrota, (snapshot) => {
    frotaLocal = [];
    snapshot.forEach(doc => frotaLocal.push({ docId: doc.id, ...doc.data() }));
    renderizarTabela();
});

// Carrega Colaboradores (RH)
async function carregarRH() {
    try {
        const snap = await getDocs(collection(db, "colaboradores"));
        colaboradoresCache = [];
        snap.forEach(doc => colaboradoresCache.push({ id: doc.id, ...doc.data() }));
    } catch (e) { console.log("RH vazio."); }
}
carregarRH();

// --- OPERAÇÃO ---

window.realizarRetirada = async () => {
    const elCracha = document.getElementById('ret-cracha');
    const elAtivo = document.getElementById('ret-ativo');
    const cracha = elCracha.value.toUpperCase();
    const ativo = elAtivo.value.toUpperCase();

    if(!cracha || !ativo) return alert("Preencha Crachá e Ativo!");

    // 1. Busca Colaborador
    let colab = colaboradoresCache.find(c => c.id === cracha);
    if(!colab && colaboradoresCache.length > 0) return alert("🚨 Colaborador não cadastrado!");
    if(!colab) colab = { nome: "Colaborador", perms: ['COL', 'HST', 'EMP'] }; // Fallback inicial

    // 2. Valida Permissão
    let tipoNecessario = 'COL';
    if(ativo.startsWith('EMP') || ativo.startsWith('TRA')) tipoNecessario = 'EMP';
    else if(ativo.startsWith('HST')) tipoNecessario = 'HST';

    if(colab.perms && !colab.perms.includes(tipoNecessario)) {
        alert(`⛔ ${colab.nome} NÃO TEM PERMISSÃO para ${tipoNecessario}!`);
        elAtivo.value = ''; elAtivo.focus(); return;
    }

    // 3. Valida Frota
    const itemFrota = frotaLocal.find(i => i.id === ativo);
    
    if(!itemFrota) {
        if(!confirm(`Ativo ${ativo} não cadastrado. Cadastrar agora?`)) return;
        // Criação automática para facilitar
        await addDoc(collection(db, "frota_tempo_real"), {
            id: ativo, tipo: tipoNecessario, status: 'EM USO', 
            user: `${colab.nome} (${cracha})`, horaSaida: new Date().toLocaleTimeString()
        });
    } else {
        if(itemFrota.status !== 'DISPONIVEL') return alert(`⛔ Ativo já está como ${itemFrota.status}`);
        await updateDoc(doc(db, "frota_tempo_real", itemFrota.docId), {
            status: 'EM USO', user: `${colab.nome} (${cracha})`, horaSaida: new Date().toLocaleTimeString()
        });
    }

    // Log Histórico
    addDoc(collection(db, "historico_logs"), {
        timestamp: Date.now(), data: new Date().toLocaleString(),
        tipo: 'SAIDA', ativo: ativo, user: colab.nome
    });

    // Comboio
    elAtivo.value = ''; elAtivo.focus();
    elCracha.classList.add('input-locked'); elCracha.readOnly = true;
    document.getElementById('btn-destravar').style.display = 'block';
};

window.realizarDevolucao = async () => {
    const ativo = document.getElementById('dev-ativo').value.toUpperCase();
    const condicao = document.querySelector('input[name="condicao"]:checked').value;
    const bateria = document.querySelector('input[name="bateria"]:checked').value;
    const obs = document.getElementById('obs-avaria').value;

    const itemFrota = frotaLocal.find(i => i.id === ativo);
    if(!itemFrota || itemFrota.status === 'DISPONIVEL') return alert("Item não encontrado em uso!");

    let novoStatus = 'DISPONIVEL';
    let obsLog = '';

    if(condicao === 'AVARIADO') { novoStatus = 'MANUTENCAO'; obsLog = `Avaria: ${obs}`; }
    else if(bateria === 'BAIXA') { novoStatus = 'CARGA'; obsLog = 'Bateria Baixa'; }

    await updateDoc(doc(db, "frota_tempo_real", itemFrota.docId), {
        status: novoStatus, user: '', horaSaida: ''
    });

    addDoc(collection(db, "historico_logs"), {
        timestamp: Date.now(), data: new Date().toLocaleString(),
        tipo: 'ENTRADA', ativo: ativo, user: itemFrota.user,
        obs: obsLog, avaria: (condicao==='AVARIADO')
    });

    alert("✅ Devolvido!");
    resetDev();
};

window.abrirHistorico = async (ativo) => {
    document.getElementById('modal-historico').style.display = 'flex';
    document.querySelector('.modal-title').innerText = `Histórico: ${ativo}`;
    const lista = document.getElementById('lista-historico');
    lista.innerHTML = 'Carregando...';

    const qHist = query(collection(db, "historico_logs"), where("ativo", "==", ativo), orderBy("timestamp", "desc"), limit(5));
    const snap = await getDocs(qHist);
    
    lista.innerHTML = '';
    snap.forEach(doc => {
        const d = doc.data();
        lista.innerHTML += `<li class="hist-item"><strong>${d.tipo}</strong> - ${d.data}<br><small>${d.user} ${d.obs||''}</small></li>`;
    });
};

// --- VISUAL ---
function renderizarTabela() {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';
    const ocupados = frotaLocal.filter(i => i.status !== 'DISPONIVEL');

    ocupados.forEach(item => {
        let icone = '';
        if(item.id.startsWith('COL')) icone = '<span class="material-icons icon-col">smartphone</span>';
        else if(item.id.startsWith('EMP') || item.id.startsWith('TRA')) icone = '<span class="material-icons icon-emp">agriculture</span>';
        else if(item.id.startsWith('HST')) icone = '<span class="material-icons icon-hst">headset_mic</span>';

        let badge = 'tag-uso';
        // Botão de devolver para todos (mesmo manutenção, para liberar rápido)
        let btn = `<button onclick="preencherDev('${item.id}')" style="padding:5px; width:auto; background:var(--primary);">⬇ Devolver</button>`;
        
        if(item.status === 'MANUTENCAO') { badge = 'tag-manutencao'; }
        else if(item.status === 'CARGA') { badge = 'tag-carga'; }

        tbody.innerHTML += `
            <tr class="${item.status !== 'EM USO' ? 'row-blocked' : ''}">
                <td class="clickable-asset" onclick="abrirHistorico('${item.id}')"><strong>${icone} ${item.id}</strong></td>
                <td><span class="tag ${badge}">${item.status}</span></td>
                <td>${item.user || '-'}</td>
                <td style="text-align:right">${btn}</td>
            </tr>`;
    });

    document.getElementById('kpi-uso').innerText = frotaLocal.filter(i => i.status === 'EM USO').length;
    document.getElementById('kpi-manutencao').innerText = frotaLocal.filter(i => i.status === 'MANUTENCAO').length;
    document.getElementById('kpi-total').innerText = frotaLocal.length;
}

// Utilitários Globais
window.preencherDev = (val) => { 
    const el = document.getElementById('dev-ativo'); el.value = val; el.focus(); 
    el.dispatchEvent(new Event('keyup'));
}
window.destravarCracha = () => {
    const el = document.getElementById('ret-cracha'); el.value=''; el.readOnly=false; 
    el.classList.remove('input-locked'); document.getElementById('btn-destravar').style.display='none'; el.focus();
}
window.toggleAvaria = (s) => document.getElementById('box-avaria').style.display = s ? 'block' : 'none';
window.fecharHistorico = () => document.getElementById('modal-historico').style.display = 'none';
window.alternarTema = () => document.body.classList.toggle('dark-mode');
window.resetDev = () => {
    document.getElementById('dev-ativo').value = '';
    document.getElementById('obs-avaria').value = '';
    document.getElementById('box-avaria').style.display = 'none';
    document.querySelector('input[name="condicao"][value="OK"]').checked = true;
}
window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-corpo tr');
    linhas.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none');
};

// Listeners
document.getElementById('ret-cracha').addEventListener('keyup', (e) => { if(e.key==='Enter') document.getElementById('ret-ativo').focus(); });
document.getElementById('ret-ativo').addEventListener('keyup', (e) => { if(e.key==='Enter') realizarRetirada(); });
document.getElementById('dev-ativo').addEventListener('keyup', (e) => { 
    const val = e.target.value.toUpperCase();
    const lbl = document.getElementById('titulo-energia');
    if(val.startsWith('EMP')||val.startsWith('TRA')) lbl.innerText = '🚜 Nível de Gás / Carga:';
    else if(val.startsWith('COL')) lbl.innerText = '🔋 Nível de Bateria:';
    else if(val.startsWith('HST')) lbl.innerText = '🎧 Bateria Headset:';
    if(e.key==='Enter') realizarDevolucao(); 
});
document.addEventListener('keydown', (e) => { if(e.key==='Escape') destravarCracha(); });
window.onclick = (e) => { if(e.target == document.getElementById('modal-historico')) fecharHistorico(); }