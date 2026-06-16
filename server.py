from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import time
import json

DB_PATH = 'comments.db'


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


conn = get_db()
conn.execute('''
CREATE TABLE IF NOT EXISTS comentarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    texto TEXT NOT NULL,
    autorToken TEXT NOT NULL,
    created_at INTEGER NOT NULL
)
''')
conn.commit()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ComentarioIn(BaseModel):
    id: str | None = None
    nome: str
    texto: str
    autorToken: str


clients: list[WebSocket] = []


def broadcast(message: dict):
    data = json.dumps(message)
    to_remove = []
    for ws in clients:
        try:
            import asyncio
            asyncio.create_task(ws.send_text(data))
        except Exception:
            to_remove.append(ws)
    for r in to_remove:
        try:
            clients.remove(r)
        except ValueError:
            pass


@app.get('/comments')
def get_comments():
    cur = conn.execute('SELECT * FROM comentarios ORDER BY created_at DESC')
    rows = [dict(r) for r in cur.fetchall()]
    return rows


@app.post('/comments')
def post_comment(c: ComentarioIn):
    nid = c.id or f"id_{int(time.time()*1000)}"
    now = int(time.time())
    try:
        conn.execute('INSERT INTO comentarios (id,nome,texto,autorToken,created_at) VALUES (?,?,?,?,?)',
                     (nid, c.nome, c.texto, c.autorToken, now))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail='ID já existe')
    broadcast({'action': 'new', 'id': nid})
    return {'status': 'ok', 'id': nid}


@app.delete('/comments/{cid}')
def delete_comment(cid: str, token: str | None = None):
    if not token:
        raise HTTPException(status_code=400, detail='token é necessário')
    cur = conn.execute('SELECT autorToken FROM comentarios WHERE id = ?', (cid,)).fetchone()
    if not cur:
        raise HTTPException(status_code=404, detail='comentário não encontrado')
    if cur['autorToken'] != token:
        raise HTTPException(status_code=403, detail='somente o autor pode deletar')
    conn.execute('DELETE FROM comentarios WHERE id = ?', (cid,))
    conn.commit()
    broadcast({'action': 'delete', 'id': cid})
    return {'status': 'deleted'}


@app.websocket('/ws/comments')
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        try:
            clients.remove(ws)
        except ValueError:
            pass
