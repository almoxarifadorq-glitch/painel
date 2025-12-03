import { db, auth } from './config.js';
import { collection, getDocs, query, orderBy, limit, where } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Função Global de Logout (caso precise aqui)
window.fazerLogout = () => {
    signOut(auth).then(() => window.location.href = 'login.html');
};

// 1. CARREGAR INICIAL (Últimos 50)
window.carregarHistorico = async () => {
    const tbody = document.getElementById('tabela-hist');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando dados...</td></tr>';

    try {
        const q = query(collection(db, "historico_logs"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);
        renderizarTabela(snap);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Erro ao carregar.</td></tr>';
    }
};

// 2. BUSCAR POR DATA (Query Específica)
window.filtrarPorData = async () => {
    const dataIni = document.getElementById('data-inicio').value;
    const dataFim = document.getElementById('data-fim').value;

    if (!dataIni || !dataFim) return alert("Selecione a Data de Início e Fim!");

    const tbody = document.getElementById('tabela-hist');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Buscando período...</td></tr>';

    // Converte datas para Timestamp (Milissegundos) para o Firebase entender
    // Inicio: 00:00:00 do dia | Fim: 23:59:59 do dia
    const startTs = new Date(dataIni + 'T00:00:00').getTime();
    const endTs = new Date(dataFim + 'T23:59:59').getTime();

    try {
        // Query com filtro de data (Range)
        const q = query(
            collection(db, "historico_logs"), 
            where("timestamp", ">=", startTs),
            where("timestamp", "<=", endTs),
            orderBy("timestamp", "desc")
        );
        
        const snap = await getDocs(q);
        
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhum registro neste período.</td></tr>';
        } else {
            renderizarTabela(snap);
        }

    } catch (e) {
        console.error("Erro no filtro de data:", e);
        // O Firebase as vezes pede para criar índice no console na primeira vez que usa filtro + ordem
        if(e.code === 'failed-precondition') {
            alert("Erro de Índice: Abra o Console (F12) e clique no link do Firebase para criar o índice automático.");
        } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red">Erro: ${e.message}</td></tr>`;
        }
    }
};

// 3. RENDERIZAR (Usado por ambos)
function renderizarTabela(snapshot) {
    const tbody = document.getElementById('tabela-hist');
    tbody.innerHTML = '';
    let cont = 0;

    snapshot.forEach(doc => {
        const d = doc.data();
        
        // FILTRO: Se for INSUMO, pula (mantém separado)
        if (d.tipo && d.tipo.includes('INSUMO')) return;

        cont++;
        const estiloAcao = d.tipo === 'SAIDA' ? 'color:var(--primary)' : 'color:var(--success)';
        const icone = d.tipo === 'SAIDA' ? 'outbound' : 'input';
        
        // Tratamento visual
        let obsVisual = d.obs || '';
        if(d.avaria) obsVisual = `<span style="color:var(--danger); font-weight:bold">🚨 AVARIA:</span> ${obsVisual}`;
        let liberadoPor = d.operador ? `<br><small style="color:#999">Lib: ${d.operador}</small>` : '';
        let nomeColaborador = d.colaborador || d.user || '-';

        tbody.innerHTML += `
            <tr>
                <td>${d.data}</td>
                <td style="${estiloAcao}; font-weight:bold;">
                    <span class="material-icons" style="font-size:1rem; vertical-align:middle">${icone}</span> ${d.tipo}
                </td>
                <td><strong>${d.ativo}</strong></td>
                <td style="font-weight:bold; color:#444;">${nomeColaborador}</td>
                <td style="font-size:0.85rem; color:#666;">${liberadoPor}</td>
                <td>${obsVisual}</td>
            </tr>`;
    });

    if (cont === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma movimentação de ativos encontrada.</td></tr>';
}

// 4. EXPORTAR PARA EXCEL (CSV)
window.exportarExcel = () => {
    const linhas = document.querySelectorAll('#tabela-hist tr');
    if(linhas.length <= 1) return alert("Não há dados para exportar!");

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para acentos
    csvContent += "DATA;ACAO;ATIVO;COLABORADOR;OPERADOR;OBS\n"; // Cabeçalho

    linhas.forEach(row => {
        const cols = row.querySelectorAll('td');
        if(cols.length > 0) {
            let rowData = [];
            // Limpa o HTML e pega só o texto
            cols.forEach(col => rowData.push(col.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim()));
            csvContent += rowData.join(";") + "\n";
        }
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_sgl.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 5. FILTRO DE TEXTO (NA TELA)
window.filtrarTexto = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-hist tr');
    linhas.forEach(tr => {
        const texto = tr.innerText.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
};

// Iniciar
window.carregarHistorico();