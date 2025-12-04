import { db, auth } from './config.js'; // <--- IMPORTAMOS O AUTH AQUI
import { collection, addDoc, doc, updateDoc, onSnapshot, query, getDocs, where, limit, orderBy } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let frotaLocal = [];
let colaboradoresCache = [];

const qFrota = query(collection(db, "frota_tempo_real"));
onSnapshot(qFrota, (snapshot) => {
    frotaLocal = [];
    snapshot.forEach(doc => frotaLocal.push({ docId: doc.id, ...doc.data() }));
    renderizarTabela();
});

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

    // --- TRAVA NOVA: ANTI-CRACHÁ NO CAMPO ERRADO ---
    // Se o ativo tiver APENAS números (ex: 2705), é um crachá bipado errado.
    if (/^\d+$/.test(ativo)) { 
        alert("⛔ ERRO OPERACIONAL:\n\nVocê bipou um CRACHÁ no campo de EQUIPAMENTO!\nPor favor, bipe o Coletor, Headset ou Máquina.");
        elAtivo.value = ''; // Limpa só o ativo
        elAtivo.focus();
        return;
    }
    // ------------------------------------------------

    // Pega o Operador Logado
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

    // Validação de RH
    let colab = colaboradoresCache.find(c => c.id === cracha);
    if(!colab && colaboradoresCache.length > 0) return alert("🚨 Colaborador não cadastrado!");
    if(!colab) colab = { nome: "Colaborador", perms: ['COL', 'HST', 'EMP'] }; 

    // Validação de Permissão
    let tipoNecessario = 'COL';
    if(ativo.startsWith('EMP') || ativo.startsWith('TRA')) tipoNecessario = 'EMP';
    else if(ativo.startsWith('HST')) tipoNecessario = 'HST';

    if(colab.perms && !colab.perms.includes(tipoNecessario)) {
        alert(`⛔ ${colab.nome} NÃO TEM PERMISSÃO para ${tipoNecessario}!`);
        elAtivo.value = ''; elAtivo.focus(); return;
    }

    // Validação de Frota
    const itemFrota = frotaLocal.find(i => i.id === ativo);
    
    // --- MUDANÇA AQUI: BLOQUEIO TOTAL SE NÃO EXISTIR ---
    if(!itemFrota) {
        alert(`❌ ERRO: O ativo '${ativo}' NÃO EXISTE no cadastro!\n\nCadastre-o na tela de 'Gestão de Frota' primeiro.`);
        elAtivo.value = ''; 
        elAtivo.focus();
        return; // Para tudo aqui. Não cria nada.
    } 
    // ---------------------------------------------------

    if(itemFrota.status !== 'DISPONIVEL') return alert(`⛔ Ativo já está como ${itemFrota.status}`);
    
    // Se passou por tudo, atualiza
    await updateDoc(doc(db, "frota_tempo_real", itemFrota.docId), {
        status: 'EM USO', user: `${colab.nome} (${cracha})`, horaSaida: new Date().toLocaleTimeString()
    });

    // Log
    addDoc(collection(db, "historico_logs"), {
        timestamp: Date.now(), data: new Date().toLocaleString(),
        tipo: 'SAIDA', ativo: ativo, 
        colaborador: colab.nome, 
        operador: operadorLogado
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
    const operadorLogado = auth.currentUser ? auth.currentUser.email : "Desconhecido";

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
        tipo: 'ENTRADA', ativo: ativo, 
        colaborador: itemFrota.user, // Quem devolveu
        operador: operadorLogado, // Quem recebeu
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
    
    // Filtra apenas o que NÃO está disponível para mostrar na tabela (fica mais limpo)
    const ocupados = frotaLocal.filter(i => i.status !== 'DISPONIVEL');

    ocupados.forEach(item => {
        let icone = '';
        if(item.id.startsWith('COL')) icone = '<span class="material-icons icon-col">smartphone</span>';
        else if(item.id.startsWith('EMP') || item.id.startsWith('TRA')) icone = '<span class="material-icons icon-emp">agriculture</span>';
        else if(item.id.startsWith('HST')) icone = '<span class="material-icons icon-hst">headset_mic</span>';

        let badge = 'tag-uso';
        // Botão padrão de devolver
        let btn = `<button onclick="preencherDev('${item.id}')" style="padding:5px; width:auto; background:var(--primary);">⬇ Devolver</button>`;
        
        if(item.status === 'MANUTENCAO') { 
            badge = 'tag-manutencao'; 
            btn = `<button onclick="liberar('${item.docId}')" style="padding:5px; width:auto; background:var(--success);">✅ Liberar</button>`; 
        }
        else if(item.status === 'CARGA') { 
            badge = 'tag-carga'; 
            btn = `<button onclick="liberar('${item.docId}')" style="padding:5px; width:auto; background:var(--success);">✅ Carga OK</button>`; 
        }

        tbody.innerHTML += `
            <tr class="${item.status !== 'EM USO' ? 'row-blocked' : ''}">
                <td class="clickable-asset" onclick="abrirHistorico('${item.id}')"><strong>${icone} ${item.id}</strong></td>
                <td><span class="tag ${badge}">${item.status}</span></td>
                <td>${item.user || '-'}</td>
                <td style="text-align:right">${btn}</td>
            </tr>`;
    });

    // --- CORREÇÃO DOS KPIS (CONTADORES) ---
    const total = frotaLocal.length;
    const uso = frotaLocal.filter(i => i.status === 'EM USO').length;
    const manut = frotaLocal.filter(i => i.status === 'MANUTENCAO').length;
    const carga = frotaLocal.filter(i => i.status === 'CARGA').length;

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-uso').innerText = uso;
    document.getElementById('kpi-manutencao').innerText = manut;
    
    // AQUI ESTAVA FALTANDO: Calculamos o disponível por subtração (Mais seguro)
    document.getElementById('kpi-livre').innerText = total - uso - manut - carga;
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
