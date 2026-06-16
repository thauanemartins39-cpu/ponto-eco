document.addEventListener('DOMContentLoaded', () => {
    const videoFundo = document.getElementById('video-fundo');
    const muteButton = document.getElementById('mute-button');

    if (videoFundo && muteButton) {
        muteButton.addEventListener('click', () => {
            videoFundo.muted = !videoFundo.muted;
            muteButton.textContent = videoFundo.muted ? '🔇 Mudo' : '🔊 Som';
        });
    }

    const heroMenu = document.querySelector('.hero-menu');
    if (heroMenu) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                heroMenu.classList.add('hero-menu--sticky');
            } else {
                heroMenu.classList.remove('hero-menu--sticky');
            }
        });
    }

    const formDiretriz = document.getElementById('form-diretriz');
    const listaComentarios = document.getElementById('lista-comentarios');

    if (formDiretriz && listaComentarios) {
        const BACKEND_URL = location.protocol.startsWith('http')
            ? `${location.protocol}//${location.hostname}:8000`
            : 'http://localhost:8000';

        const CHAVE_USUARIO = 'ponto_eco_token_voter';

        let tokenUsuario = localStorage.getItem(CHAVE_USUARIO);
        if (!tokenUsuario) {
            tokenUsuario = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now();
            localStorage.setItem(CHAVE_USUARIO, tokenUsuario);
        }

        async function buscarComentarios() {
            try {
                const resp = await fetch(`${BACKEND_URL}/comments`);
                if (!resp.ok) throw new Error('Falha ao buscar comentários');
                return await resp.json();
            } catch (e) {
                return [];
            }
        }

        function criarComentarioHTML(com) {
            const div = document.createElement('div');
            div.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 15px; margin-bottom: 15px; width: 100%; animation: fadeIn 0.4s ease;';

            const botaoApagar = com.autorToken === tokenUsuario
                ? `<button onclick="deletarComentario('${com.id}')" class="btn-apagar" style="background: rgba(189, 29, 29, 0.15); border: 1px solid rgba(189, 29, 29, 0.4); color: #ff6b6b; padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 0.8rem; font-family: 'Montserrat', sans-serif; font-weight: 600; transition: 0.3s;">Apagar meu comentário</button>`
                : '';

            div.innerHTML = `
                <strong style="color: #14b8a6; display: block; margin-bottom: 5px; font-size: 0.95rem;">${com.nome}</strong>
                <p style="color: #e2e8f0; white-space: pre-wrap; margin-bottom: 12px; font-size: 0.9rem; line-height: 1.4;">${com.texto}</p>
                ${botaoApagar}
            `;
            return div;
        }

        async function atualizarInterface() {
            const comentarios = await buscarComentarios();
            listaComentarios.innerHTML = '';

            if (comentarios.length === 0) {
                const semComentarios = document.createElement('p');
                semComentarios.style.color = '#cbd5e1';
                semComentarios.style.marginTop = '10px';
                semComentarios.textContent = 'Nenhum comentário ainda. Seja o primeiro a deixar sua opinião!';
                listaComentarios.appendChild(semComentarios);
                return;
            }

            comentarios.forEach(com => listaComentarios.appendChild(criarComentarioHTML(com)));
        }

        function conectarWebSocket() {
            try {
                const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
                const host = location.hostname || 'localhost';
                const wsUrl = `${protocol}://${host}:8000/ws/comments`;
                const ws = new WebSocket(wsUrl);

                ws.addEventListener('message', () => atualizarInterface());
                ws.addEventListener('open', () => console.info('WebSocket conectado.'));
                ws.addEventListener('close', () => console.info('WebSocket desconectado.'));
            } catch (err) {
                console.warn('WebSocket não disponível.', err);
            }
        }

        formDiretriz.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('nome-colaborador').value.trim();
            const texto = document.getElementById('texto-diretriz').value.trim();
            if (!nome || !texto) return;

            const novoCom = {
                id: 'id_' + Date.now(),
                nome,
                texto,
                autorToken: tokenUsuario
            };

            try {
                const resp = await fetch(`${BACKEND_URL}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(novoCom)
                });
                if (!resp.ok) throw new Error('Falha ao salvar comentário');
                document.getElementById('nome-colaborador').value = '';
                document.getElementById('texto-diretriz').value = '';
            } catch (e) {
                alert('Erro ao enviar comentário. Verifique se o servidor está rodando.');
            }
        });

        window.deletarComentario = async (id) => {
            try {
                const resp = await fetch(`${BACKEND_URL}/comments/${encodeURIComponent(id)}?token=${encodeURIComponent(tokenUsuario)}`, {
                    method: 'DELETE'
                });
                if (!resp.ok) throw new Error('Falha ao apagar comentário');
            } catch (e) {
                alert('Erro ao apagar comentário.');
            }
        };

        atualizarInterface();
        conectarWebSocket();
    }
});