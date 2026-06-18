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
        const CHAVE_USUARIO = 'ponto_eco_token_voter';
        const CHAVE_COMENTARIOS = 'ponto_eco_comentarios_locais';
        const COMENTARIOS_EXEMPLO = [
            {
                id: 'exemplo_1',
                nome: 'Maria',
                texto: 'Gostei muito do projeto, achei a ideia importante para a comunidade.',
                autorToken: 'exemplo_maria',
                parent_id: null,
                created_at: Date.now() - 300000,
                upvotes: 2,
                downvotes: 0
            },
            {
                id: 'exemplo_2',
                nome: 'João',
                texto: 'Seria legal incluir mais fotos das ações do grupo.',
                autorToken: 'exemplo_joao',
                parent_id: null,
                created_at: Date.now() - 180000,
                upvotes: 1,
                downvotes: 0
            }
        ];

        let tokenUsuario = localStorage.getItem(CHAVE_USUARIO);
        if (!tokenUsuario) {
            tokenUsuario = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now();
            localStorage.setItem(CHAVE_USUARIO, tokenUsuario);
        }

        const respostasAbertas = new Set();

        window.addEventListener('storage', (event) => {
            if (event.key === CHAVE_COMENTARIOS) {
                atualizarInterface();
            }
        });

        function carregarComentarios() {
            try {
                const salvos = localStorage.getItem(CHAVE_COMENTARIOS);
                if (!salvos) {
                    return [...COMENTARIOS_EXEMPLO];
                }

                const comentarios = JSON.parse(salvos);
                return Array.isArray(comentarios) ? comentarios : [...COMENTARIOS_EXEMPLO];
            } catch (e) {
                console.warn('Não foi possível carregar os comentários locais.', e);
                return [...COMENTARIOS_EXEMPLO];
            }
        }

        function salvarComentarios(comentarios) {
            localStorage.setItem(CHAVE_COMENTARIOS, JSON.stringify(comentarios));
        }

        function obterComentariosOrdenados() {
            return carregarComentarios().sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        }

        function criarIdComentario() {
            return 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        }

        function temRespostaAberta() {
            return respostasAbertas.size > 0;
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
                    const comentarios = carregarComentarios();
                    comentarios.push({
                        id: criarIdComentario(),
                        nome: nomeResposta,
                        texto: respostaTexto,
                        autorToken: tokenUsuario,
                        parent_id: parentId,
                        created_at: Date.now(),
                        upvotes: 0,
                        downvotes: 0
                    });
                    salvarComentarios(comentarios);
                    formResposta.reset();
                    respostasAbertas.delete(com.id);
                    formResposta.style.display = 'none';
                    formResposta.style.visibility = 'hidden';
                    formResposta.hidden = true;
                    await atualizarInterface();
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

            const comentarios = obterComentariosOrdenados();

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
                const comentarios = carregarComentarios();
                const comentario = comentarios.find(com => com.id === id);
                if (!comentario) throw new Error('Comentário não encontrado');

                comentario.upvotes = Number(comentario.upvotes || 0);
                comentario.downvotes = Number(comentario.downvotes || 0);

                const votoAnterior = comentario.reacaoUsuario;
                if (votoAnterior === tipo) {
                    if (tipo === 'up') comentario.upvotes = Math.max(0, comentario.upvotes - 1);
                    if (tipo === 'down') comentario.downvotes = Math.max(0, comentario.downvotes - 1);
                    delete comentario.reacaoUsuario;
                } else {
                    if (votoAnterior === 'up') comentario.upvotes = Math.max(0, comentario.upvotes - 1);
                    if (votoAnterior === 'down') comentario.downvotes = Math.max(0, comentario.downvotes - 1);

                    if (tipo === 'up') comentario.upvotes += 1;
                    if (tipo === 'down') comentario.downvotes += 1;
                    comentario.reacaoUsuario = tipo;
                }

                salvarComentarios(comentarios);
                await atualizarInterface();
            } catch (e) {
                alert('Erro ao registrar reação.');
            }
        }

        async function deletarComentario(id) {
            try {
                const comentarios = carregarComentarios();
                const comentario = comentarios.find(com => com.id === id);
                if (!comentario) throw new Error('Falha ao apagar comentário');
                if (comentario.autorToken !== tokenUsuario) throw new Error('Somente o autor pode apagar');

                const idsParaRemover = new Set([id]);

                function coletarFilhos(parentId) {
                    comentarios.forEach(com => {
                        if (com.parent_id === parentId && !idsParaRemover.has(com.id)) {
                            idsParaRemover.add(com.id);
                            coletarFilhos(com.id);
                        }
                    });
                }

                coletarFilhos(id);
                salvarComentarios(comentarios.filter(com => !idsParaRemover.has(com.id)));
                await atualizarInterface();
            } catch (e) {
                console.error('Erro ao apagar comentário:', e);
                alert('Erro ao apagar comentário.');
            }
        }

        formDiretriz.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nomeInput = document.getElementById('nome-colaborador');
            const textoInput = document.getElementById('texto-diretriz');
            const nome = nomeInput.value.trim();
            const texto = textoInput.value.trim();
            if (!nome || !texto) return;

            try {
                const comentarios = carregarComentarios();
                comentarios.push({
                    id: criarIdComentario(),
                    nome,
                    texto,
                    autorToken: tokenUsuario,
                    parent_id: null,
                    created_at: Date.now(),
                    upvotes: 0,
                    downvotes: 0
                });
                salvarComentarios(comentarios);
                nomeInput.value = '';
                textoInput.value = '';
                await atualizarInterface();
            } catch (e) {
                console.error('Erro ao enviar comentário:', e);
                alert('Erro ao enviar comentário.');
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
    }
});