document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Lógica do Vídeo e Mudo ---
    const videoFundo = document.getElementById('video-fundo');
    const muteButton = document.getElementById('mute-button');

    if (videoFundo && muteButton) {
        muteButton.addEventListener('click', () => {
            videoFundo.muted = !videoFundo.muted;
            muteButton.textContent = videoFundo.muted ? '🔇 Mudo' : '🔊 Som';
        });
    }

    // --- 2. Menu Superior Sticky (Efeito de Vidro ao Rolar) ---
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

    // --- 3. Sistema de Comentários (Exclusivo da página Diretrizes) ---
    const formDiretriz = document.getElementById('form-diretriz');
    const listaComentarios = document.getElementById('lista-comentarios');

    // Só executa esta lógica se os elementos existirem na página atual
    if (formDiretriz && listaComentarios) {
        const SUPABASE_URL = 'SUA_URL_AQUI'; 
        const SUPABASE_KEY = 'SUA_KEY_ANON_AQUI';
        
        let supabase = null;
        // Verifica se a biblioteca foi carregada e se as chaves foram configuradas
        if (typeof supabasejs !== 'undefined' && SUPABASE_URL !== 'SUA_URL_AQUI') {
            supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        const CHAVE_STORAGE = 'ponto_eco_comentarios';
        const CHAVE_USUARIO = 'ponto_eco_token_voter';

        // Identificação do usuário no navegador (Token de Autoria)
        let tokenUsuario = localStorage.getItem(CHAVE_USUARIO);
        if (!tokenUsuario) {
            tokenUsuario = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now();
            localStorage.setItem(CHAVE_USUARIO, tokenUsuario);
        }

        async function atualizarInterface() {
            let comentarios = [];

            if (supabase) {
                // Busca comentários reais da nuvem (Outras pessoas veem)
                const { data, error } = await supabase.from('comentarios').select('*').order('id', { ascending: false });
                if (!error) comentarios = data;
            } else {
                // Fallback local se o banco não estiver configurado
                comentarios = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
                comentarios.reverse();
            }

            listaComentarios.innerHTML = '';

            comentarios.forEach(com => {
                const div = document.createElement('div');
                div.style.cssText = 'background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 15px; margin-bottom: 15px; width: 100%; animation: fadeIn 0.4s ease;';

                // REGRA DE SEGURANÇA: Só exibe o botão se o token gravado for igual ao do navegador
                const botaoApagar = (com.autorToken === tokenUsuario) 
                    ? `<button onclick="deletarComentario('${com.id}')" class="btn-apagar" style="background: rgba(189, 29, 29, 0.15); border: 1px solid rgba(189, 29, 29, 0.4); color: #ff6b6b; padding: 6px 14px; border-radius: 50px; cursor: pointer; font-size: 0.8rem; font-family: 'Montserrat', sans-serif; font-weight: 600; transition: 0.3s;">Apagar meu comentário</button>`
                    : '';

                div.innerHTML = `
                    <strong style="color: #14b8a6; display: block; margin-bottom: 5px; font-size: 0.95rem;">${com.nome}</strong>
                    <p style="color: #e2e8f0; white-space: pre-wrap; margin-bottom: 12px; font-size: 0.9rem; line-height: 1.4;">${com.texto}</p>
                    ${botaoApagar}
                `;
                listaComentarios.appendChild(div);
            });
        }

        formDiretriz.addEventListener('submit', async (e) => {
            e.preventDefault();
            const novoCom = {
                id: 'id_' + Date.now(),
                nome: document.getElementById('nome-colaborador').value,
                texto: document.getElementById('texto-diretriz').value,
                autorToken: tokenUsuario
            };

            if (supabase) {
                // Salva no banco de dados compartilhado
                await supabase.from('comentarios').insert([novoCom]);
            } else {
                const db = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
                db.push(novoCom);
                localStorage.setItem(CHAVE_STORAGE, JSON.stringify(db));
            }

            formDiretriz.reset();
            atualizarInterface();
        });

        window.deletarComentario = async (id) => {
            if (supabase) {
                // Deleta do banco real (validando o token para segurança)
                await supabase.from('comentarios').delete().eq('id', id).eq('autorToken', tokenUsuario);
            } else {
                let db = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || '[]');
                const comParaDeletar = db.find(item => item.id === id);
                if (comParaDeletar && comParaDeletar.autorToken === localStorage.getItem(CHAVE_USUARIO)) {
                    db = db.filter(item => item.id !== id);
                    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(db));
                } else if (comParaDeletar) {
                    alert("Ei! Você só pode apagar os seus próprios comentários. 😉");
                }
            }
            atualizarInterface();
        };

        atualizarInterface();
    }
});