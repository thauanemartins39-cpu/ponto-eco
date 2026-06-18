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
        const BACKEND_URL = String(window.PONTO_ECO_API_URL || (location.protocol.startsWith('http')
            ? location.origin
            : 'http://localhost:8000')).replace(/\/$/, '');

        const CHAVE_USUARIO = 'ponto_eco_token_voter';

        let tokenUsuario = localStorage.getItem(CHAVE_USUARIO);
        if (!tokenUsuario) {
            tokenUsuario = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now();
            localStorage.setItem(CHAVE_USUARIO, tokenUsuario);
        }

        const SYNC_KEY = 'ponto_eco_comments_sync';
        let broadcastChannel = null;
        const respostasAbertas = new Set();
        if ('BroadcastChannel' in window) {
            broadcastChannel = new BroadcastChannel('ponto_eco_comments');
            broadcastChannel.onmessage = () => atualizarInterface();
        }

        window.addEventListener('storage', (event) => {
            if (event.key === SYNC_KEY) {
                atualizarInterface();
            }
        });

        function notificarOutrasAbas() {
            if (broadcastChannel) {
                broadcastChannel.postMessage(Date.now());
            } else {
                localStorage.setItem(SYNC_KEY, String(Date.now()));
            }
        }

        function temRespostaAberta() {
            return respostasAbertas.size > 0;
        }

        async function buscarComentarios() {
            try {
                const resp = await fetch(`${BACKEND_URL}/comments`);
                if (!resp.ok) throw new Error('Falha ao buscar comentários');
                return await resp.json();
            } catch (e) {
                console.warn('Não foi possível atualizar os comentários agora.', e);
                return null;
            }
        }

        function criarElementoComentario(com) {
            const card = document.createElement('article');
            card.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 15px; margin-bottom: 12px; width: 100%;';

            const autor = document.createElement('strong');
            autor.style.cssText = 'color: #14b8a6; display: block; margin-bottom: 6px; font-size: 0.95rem;';
            autor.textContent = com.nome || 'Anônimo';

            const texto = document.createElement('p');
            texto.style.cssText = 'color: #e2e8f0; white-space: pre-wrap; margin: 0 0 10px 0; font-size: 0.9rem; line-height: 1.4;';
            texto.textContent = com.texto || '';

            const controles = document.createElement('div');
            controles.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';

            const botaoUp = document.createElement('button');
            botaoUp.type = 'button';
            botaoUp.textContent = `👍 ${Number(com.upvotes || 0)}`;
            botaoUp.style.cssText = 'background: rgba(20, 184, 166, 0.12); color: #d1fae5; border: 1px solid rgba(20, 184, 166, 0.35); border-radius: 999px; padding: 6px 10px; cursor: pointer;';
            botaoUp.addEventListener('click', async () => {
                await reagirComentario(com.id, 'up');
            });

            const botaoDown = document.createElement('button');
            botaoDown.type = 'button';
            botaoDown.textContent = `👎 ${Number(com.downvotes || 0)}`;
            botaoDown.style.cssText = 'background: rgba(248, 113, 113, 0.12); color: #fecaca; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 999px; padding: 6px 10px; cursor: pointer;';
            botaoDown.addEventListener('click', async () => {
                await reagirComentario(com.id, 'down');
            });

            const formResposta = document.createElement('form');
            formResposta.dataset.parentId = com.id;
            formResposta.style.cssText = 'display: none; visibility: hidden; margin-top: 10px;';
            formResposta.innerHTML = `
                <input type="text" placeholder="Seu nome" required style="width: 100%; margin-bottom: 8px; border-radius: 10px; padding: 10px; font-family: 'Montserrat', sans-serif;">
                <textarea placeholder="Escreva uma resposta..." rows="2" required style="width: 100%; min-height: 70px; border-radius: 10px; padding: 10px; font-family: 'Montserrat', sans-serif; resize: vertical;"></textarea>
                <button type="submit" style="margin-top: 8px; background: rgba(20, 184, 166, 0.18); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 8px 12px; cursor: pointer;">Enviar resposta</button>
            `;

            const botaoResponder = document.createElement('button');
            botaoResponder.type = 'button';
            botaoResponder.textContent = 'Responder';
            botaoResponder.style.cssText = 'background: transparent; color: #bfdbfe; border: 0; cursor: pointer; font-weight: 600;';
            botaoResponder.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                respostasAbertas.add(com.id);
                formResposta.style.display = 'block';
                formResposta.style.visibility = 'visible';
                formResposta.hidden = false;
                const inputNome = formResposta.querySelector('input');
                if (inputNome) {
                    inputNome.focus();
                }
            });
            formResposta.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nomeResposta = formResposta.querySelector('input')?.value.trim();
                const respostaTexto = formResposta.querySelector('textarea')?.value.trim();
                if (!nomeResposta || !respostaTexto) return;

                const parentId = formResposta.dataset.parentId || com.id;

                try {
                    const resp = await fetch(`${BACKEND_URL}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            nome: nomeResposta,
                            texto: respostaTexto,
                            autorToken: tokenUsuario,
                            parent_id: parentId
                        })
                    });
                    if (!resp.ok) throw new Error('Falha ao enviar resposta');
                    formResposta.reset();
                    respostasAbertas.delete(com.id);
                    formResposta.style.display = 'none';
                    formResposta.style.visibility = 'hidden';
                    formResposta.hidden = true;
                    await atualizarInterface();
                    notificarOutrasAbas();
                } catch (err) {
                    console.error('Erro ao enviar resposta:', err);
                    alert('Erro ao enviar resposta.');
                }
            });

            if (com.autorToken === tokenUsuario) {
                const botaoApagar = document.createElement('button');
                botaoApagar.type = 'button';
                botaoApagar.textContent = 'Apagar';
                botaoApagar.style.cssText = 'background: rgba(189, 29, 29, 0.15); color: #ff6b6b; border: 1px solid rgba(189, 29, 29, 0.4); border-radius: 999px; padding: 6px 10px; cursor: pointer;';
                botaoApagar.addEventListener('click', async () => {
                    await deletarComentario(com.id);
                });
                controles.appendChild(botaoApagar);
            }

            controles.appendChild(botaoUp);
            controles.appendChild(botaoDown);
            controles.appendChild(botaoResponder);
            card.appendChild(autor);
            card.appendChild(texto);
            card.appendChild(controles);
            card.appendChild(formResposta);

            if (respostasAbertas.has(com.id)) {
                formResposta.style.display = 'block';
                formResposta.style.visibility = 'visible';
                formResposta.hidden = false;
            }

            return card;
        }

        function criarListaComentarios(comentarios) {
            const comentariosTop = comentarios.filter(com => !com.parent_id);

            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

            function criarThreadComentario(comentario, nivel = 0) {
                const card = criarElementoComentario(comentario);
                if (nivel > 0) {
                    card.style.marginLeft = '24px';
                    card.style.borderLeft = '2px solid rgba(20, 184, 166, 0.25)';
                    card.style.paddingLeft = '12px';
                }

                const respostas = comentarios.filter(resp => resp.parent_id === comentario.id);
                if (respostas.length > 0) {
                    const containerRespostas = document.createElement('div');
                    containerRespostas.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 10px;';
                    respostas.forEach(resp => {
                        containerRespostas.appendChild(criarThreadComentario(resp, nivel + 1));
                    });
                    card.appendChild(containerRespostas);
                }

                return card;
            }

            comentariosTop.forEach(com => {
                container.appendChild(criarThreadComentario(com));
            });

            return container;
        }

        async function atualizarInterface() {
            if (temRespostaAberta()) {
                return;
            }

            const comentarios = await buscarComentarios();
            if (!Array.isArray(comentarios)) {
                return;
            }

            listaComentarios.innerHTML = '';

            if (comentarios.length === 0) {
                const semComentarios = document.createElement('p');
                semComentarios.style.color = '#cbd5e1';
                semComentarios.style.marginTop = '10px';
                semComentarios.textContent = 'Nenhum comentário ainda. Seja o primeiro a deixar sua opinião!';
                listaComentarios.appendChild(semComentarios);
                return;
            }

            listaComentarios.appendChild(criarListaComentarios(comentarios));
        }

        async function reagirComentario(id, tipo) {
            try {
                const resp = await fetch(`${BACKEND_URL}/comments/${encodeURIComponent(id)}/reactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: tokenUsuario, reaction: tipo })
                });
                if (!resp.ok) throw new Error('Falha ao reagir');
                await atualizarInterface();
                notificarOutrasAbas();
            } catch (e) {
                alert('Erro ao registrar reação.');
            }
        }

        async function deletarComentario(id) {
            try {
                const resp = await fetch(`${BACKEND_URL}/comments/${encodeURIComponent(id)}?token=${encodeURIComponent(tokenUsuario)}`, {
                    method: 'DELETE'
                });
                if (!resp.ok) throw new Error('Falha ao apagar comentário');
                await atualizarInterface();
                notificarOutrasAbas();
            } catch (e) {
                console.error('Erro ao apagar comentário:', e);
                alert(`Erro ao apagar comentário. Verifique se o servidor está rodando em ${BACKEND_URL}.`);
            }
        }

        function conectarWebSocket() {
            try {
                const apiUrl = new URL(BACKEND_URL, location.href);
                apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
                apiUrl.pathname = '/ws/comments';
                apiUrl.search = '';
                apiUrl.hash = '';
                const wsUrl = apiUrl.toString();
                const ws = new WebSocket(wsUrl);

                ws.addEventListener('message', () => atualizarInterface());
                ws.addEventListener('open', () => console.info('WebSocket conectado.'));
                ws.addEventListener('close', () => {
                    console.info('WebSocket desconectado.');
                    setTimeout(() => conectarWebSocket(), 3000);
                });
            } catch (err) {
                console.warn('WebSocket não disponível.', err);
            }
        }

        formDiretriz.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('nome-colaborador').value.trim();
            const texto = document.getElementById('texto-diretriz').value.trim();
            if (!nome || !texto) return;

            try {
                const resp = await fetch(`${BACKEND_URL}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome,
                        texto,
                        autorToken: tokenUsuario
                    })
                });
                if (!resp.ok) throw new Error('Falha ao salvar comentário');
                document.getElementById('nome-colaborador').value = '';
                document.getElementById('texto-diretriz').value = '';
                await atualizarInterface();
                notificarOutrasAbas();
            } catch (e) {
                console.error('Erro ao enviar comentário:', e);
                alert(`Erro ao enviar comentário. Verifique se o servidor está rodando em ${BACKEND_URL}.`);
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                atualizarInterface();
            }
        });

        window.addEventListener('focus', () => {
            atualizarInterface();
        });

        atualizarInterface();
        conectarWebSocket();
        setInterval(atualizarInterface, 5000);
    }
});