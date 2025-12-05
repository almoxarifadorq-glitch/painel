import { db } from './config.js';
import { collection, getDocs, query, where, orderBy, limit } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =========================================================
// 1. CARREGAR HISTÓRICO AUTOMATICAMENTE (AUDITORIA)
// =========================================================
async function carregarHistoricoAuditoria() {
    const tbody = document.getElementById('tabela-hist');
    if(!tbody) return; // Proteção caso a tabela não exista
    
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando dados...</td></tr>';

    try {
        const q = query(collection(db, "historico_logs"), orderBy("timestamp", "desc"), limit(100));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        let cont = 0;

        snap.forEach(doc => {
            const d = doc.data();
            if (d.tipo && d.tipo.includes('INSUMO')) {
                cont++;
                renderizarLinha(tbody, d);
            }
        });

        if (cont === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma movimentação recente.</td></tr>';

    } catch (e) {
        console.error("Erro Histórico:", e);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center">Erro ao carregar histórico.</td></tr>';
    }
}

function renderizarLinha(tbody, d) {
    let estilo = d.tipo === 'ENTRADA_INSUMO' ? 'color:var(--success)' : 'color:var(--primary)';
    let icone = d.tipo === 'ENTRADA_INSUMO' ? 'add_circle' : 'remove_circle';
    let label = d.tipo === 'ENTRADA_INSUMO' ? 'ENTRADA' : 'SAÍDA';
    let liberadoPor = d.operador ? `<span style="color:#999">(${d.operador})</span>` : '';
    let colabNome = d.colaborador || '-';

    tbody.innerHTML += `
        <tr>
            <td style="font-size:0.9rem">${d.data}</td>
            <td style="${estilo}; font-weight:bold;">
                <span class="material-icons" style="font-size:14px; vertical-align:middle">${icone}</span> ${label}
            </td>
            <td><strong>${d.ativo}</strong></td>
            <td style="font-weight:bold;">${d.obs}</td>
            <td>${colabNome}</td>
            <td style="font-size:0.8rem;">${liberadoPor}</td>
        </tr>`;
}

// =========================================================
// 2. GERA A ANÁLISE DE ESTOQUE (INTELIGÊNCIA)
// =========================================================
window.gerarAnalise = async () => {
    const tbody = document.getElementById('tabela-analise');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Calculando consumo...</td></tr>';

    try {
        // A. PEGA ESTOQUE ATUAL
        const snapEstoque = await getDocs(collection(db, "estoque_insumos"));
        let produtos = [];
        snapEstoque.forEach(doc => produtos.push(doc.data()));

        if (produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">Nenhum produto cadastrado no estoque.</td></tr>';
            return;
        }

        // B. PEGA CONSUMO (SAÍDAS) DOS ÚLTIMOS 30 DIAS
        const dataLimite = Date.now() - (30 * 24 * 60 * 60 * 1000);
        let consumoTotal = {}; 

        try {
            const qLogs = query(collection(db, "historico_logs"), where("timestamp", ">=", dataLimite), orderBy("timestamp", "desc"));
            const snapLogs = await getDocs(qLogs);

            snapLogs.forEach(doc => {
                const d = doc.data();
                if (d.tipo === 'SAIDA_INSUMO') {
                    // Tenta achar código
                    let codMatch = d.obs.match(/\(Cod: (.*?)\)/);
                    let codigo = codMatch ? codMatch[1] : null;
                    
                    // Fallback: Nome
                    if (!codigo) {
                        const prod = produtos.find(p => d.ativo.includes(p.nome));
                        if (prod) codigo = prod.id;
                    }

                    if (codigo) {
                        const qtd = Math.abs(parseInt(d.obs.split(' ')[0])) || 0;
                        if (!consumoTotal[codigo]) consumoTotal[codigo] = 0;
                        consumoTotal[codigo] += qtd;
                    }
                }
            });
        } catch (errIndex) {
            console.warn("Erro de índice (normal no primeiro uso):", errIndex);
            // Se der erro de índice, assume consumo zero e segue para mostrar a tabela
        }

        // C. MONTA TABELA
        tbody.innerHTML = '';
        produtos.sort((a,b) => a.id.localeCompare(b.id));

        produtos.forEach(prod => {
            const total30 = consumoTotal[prod.id] || 0;
            const saidaDia = total30 > 0 ? (total30 / 30) : 0;
            const saidaDiaVisual = saidaDia > 0 ? saidaDia.toFixed(1) : "0.0";
            
            let diasEstoque = 0;
            let diasVisivel = "";
            let statusHTML = '<span class="status-ok">OK</span>';
            let bgLinha = '';
            
            const leadTime = parseInt(prod.leadTime) || 7;

            // Lógica de Cálculo
            if (prod.qtd <= 0) {
                diasEstoque = 0;
                diasVisivel = "0 (ZERADO)";
                statusHTML = '<span class="status-critico">🚨 ACABOU</span>';
                bgLinha = 'background-color:#fadbd8';
            } else if (saidaDia === 0) {
                diasEstoque = 999;
                diasVisivel = "∞ (Sem Consumo)";
                statusHTML = '<span class="status-ok">PARADO</span>';
            } else {
                diasEstoque = Math.floor(prod.qtd / saidaDia);
                diasVisivel = diasEstoque + " dias";

                if (diasEstoque <= leadTime) {
                    statusHTML = '<span class="status-critico">⚠️ COMPRAR</span>';
                    bgLinha = 'background-color:#fff5f5';
                } else if (diasEstoque <= (leadTime + 5)) {
                    statusHTML = '<span class="status-atencao">⚠️ ATENÇÃO</span>';
                }
            }

            tbody.innerHTML += `
                <tr style="${bgLinha}">
                    <td>${prod.id}</td>
                    <td class="txt-left">${prod.nome}</td>
                    <td>${prod.emb}</td>
                    <td>${saidaDiaVisual}</td>
                    <td>${prod.qtd}</td>
                    <td style="font-weight:900; font-size:1.1rem;">${diasVisivel}</td>
                    <td>${leadTime}</td>
                    <td>${statusHTML}</td>
                </tr>`;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="color:red">Erro Fatal: ${e.message}</td></tr>`;
    }
};

window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-hist tr');
    linhas.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none');
};

// Inicia
carregarHistoricoAuditoria();