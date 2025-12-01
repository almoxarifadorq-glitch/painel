import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.carregarHistorico = async () => {
    const tbody = document.getElementById('tabela-hist');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Buscando dados...</td></tr>';

    try {
        const q = query(collection(db, "historico_logs"), orderBy("timestamp", "desc"), limit(100));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        let cont = 0;

        snap.forEach(doc => {
            const d = doc.data();
            
            // FILTRO: Só mostra INSUMO
            if (!d.tipo.includes('INSUMO')) return;

            cont++;
            
            let estilo = d.tipo === 'ENTRADA_INSUMO' ? 'color:var(--success)' : 'color:var(--primary)'; // Azul para saída
            let icone = d.tipo === 'ENTRADA_INSUMO' ? 'add_circle' : 'remove_circle';
            let label = d.tipo === 'ENTRADA_INSUMO' ? 'ENTRADA' : 'SAÍDA';
            
            // Tratamento do Operador (Quem liberou)
            let liberadoPor = d.operador ? `<span style="color:#999">(${d.operador})</span>` : '';

            // CORREÇÃO AQUI: Tenta ler 'colaborador', se não tiver tenta 'user'
            let nomeResponsavel = d.colaborador || d.user || '-';

            tbody.innerHTML += `
                <tr>
                    <td style="font-size:0.9rem">${d.data}</td>
                    <td style="${estilo}; font-weight:bold;">
                        <span class="material-icons" style="font-size:14px; vertical-align:middle">${icone}</span> ${label}
                    </td>
                    <td><strong>${d.ativo}</strong></td>
                    <td style="font-weight:bold;">${d.obs}</td>
                    <td>${nomeResponsavel}</td> <td style="font-size:0.8rem;">${liberadoPor}</td>
                </tr>`;
        });

        if (cont === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma movimentação de Insumos.</td></tr>';

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar.</td></tr>';
    }
};

window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-hist tr');
    linhas.forEach(tr => tr.style.display = tr.innerText.toLowerCase().includes(termo) ? '' : 'none');
};