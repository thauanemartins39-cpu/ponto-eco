# Projeto Ponto Eco

Site estático para publicar no GitHub Pages, com comentários sincronizados por uma API separada.

## Como funciona

- O site pode ser hospedado no GitHub Pages.
- Os comentários precisam de um backend online para funcionar entre dispositivos.
- O front usa a URL configurada em `api-config.js`.

## Para publicar no GitHub Pages

1. Suba este repositório no GitHub.
2. Ative o GitHub Pages na branch principal.
3. Publique também o backend em um serviço separado, como Render, Railway ou outro host Python.
4. Troque o valor de `window.PONTO_ECO_API_URL` no arquivo `api-config.js` para a URL pública do backend.

## Para testar localmente

1. Rode o backend:
   `C:/Users/thauane/.local/bin/python3.14.exe server.py`
2. Abra o site pelo servidor local em `http://localhost:8000`.

## Observação

GitHub Pages não executa `server.py`, então ele sozinho não salva comentários compartilhados entre aparelhos.
