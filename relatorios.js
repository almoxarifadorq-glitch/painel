import { db } from './config.js';
import { collection, getDocs, query, orderBy, limit } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.carregarHistorico = async () => {
    // Agora são 6 colunas (colspan="6")
    const tbody = document.getElementById('tabela-hist');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando dados...</td></tr>';

    try {
        const q = query(collection(db, "historico_logs"), orderBy("timestamp", "desc"), limit(50));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        let cont = 0;

        snap.forEach(doc => {
            const d = doc.data();
            
            // FILTRO: Se for INSUMO, não mostra aqui (Mostra lá na outra página)
            if (d.tipo.includes('INSUMO')) return;

            cont++;
            
            // Define Cores e Ícones
            const estiloAcao = d.tipo === 'SAIDA' ? 'color:var(--primary)' : 'color:var(--success)';
            const icone = d.tipo === 'SAIDA' ? 'outbound' : 'input';
            const nomeAcao = d.tipo === 'SAIDA' ? 'SAÍDA' : 'DEVOLUÇÃO';
            
            // Tratamento visual para Avaria
            let obsVisual = d.obs || '';
            if(d.avaria) obsVisual = `<span style="color:var(--danger); font-weight:bold">🚨 AVARIA:</span> ${obsVisual}`;

            // Tratamento de nomes (Compatibilidade com dados antigos que usavam 'user')
            let nomeColaborador = d.colaborador || d.user || '-';
            let nomeOperador = d.operador || '-';

            // Se for sistema antigo ou vazio, deixa mais discreto
            if (nomeOperador === 'Desconhecido') nomeOperador = '<span style="color:#ccc">Sistema</span>';

            tbody.innerHTML += `
                <tr>
                    <td style="font-size:0.9rem">${d.data}</td>
                    <td style="${estiloAcao}; font-weight:bold;">
                        <span class="material-icons" style="font-size:1rem; vertical-align:middle">${icone}</span> ${nomeAcao}
                    </td>
                    <td><strong>${d.ativo}</strong></td>
                    
                    <td style="font-weight:bold; color:#444;">${nomeColaborador}</td>
                    
                    <td style="font-size:0.85rem; color:#666;">${nomeOperador}</td>
                    
                    <td>${obsVisual}</td>
                </tr>`;
        });

        if (cont === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhuma movimentação de ativos encontrada.</td></tr>';

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Erro ao carregar.</td></tr>';
    }
};

window.filtrar = () => {
    const termo = document.getElementById('filtro').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-hist tr');
    
    linhas.forEach(tr => {
        const texto = tr.innerText.toLowerCase();
        tr.style.display = texto.includes(termo) ? '' : 'none';
    });
};

window.carregarHistorico();