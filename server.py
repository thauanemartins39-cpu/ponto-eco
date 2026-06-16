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
    parent_id TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(parent_id) REFERENCES comentarios(id) ON DELETE CASCADE
)
''')
conn.execute('''
CREATE TABLE IF NOT EXISTS reacoes (
    comment_id TEXT NOT NULL,
    user_token TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('up', 'down')),
    PRIMARY KEY (comment_id, user_token),
    FOREIGN KEY(comment_id) REFERENCES comentarios(id) ON DELETE CASCADE
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
    parentId: str | None = None


class ReactionIn(BaseModel):
    token: str
    reaction: str


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
    cur = conn.execute('''
        SELECT
            c.id,
            c.nome,
            c.texto,
            c.autorToken,
            c.parent_id,
            c.created_at,
            COALESCE(SUM(CASE WHEN r.reaction = 'up' THEN 1 ELSE 0 END), 0) AS upvotes,
            COALESCE(SUM(CASE WHEN r.reaction = 'down' THEN 1 ELSE 0 END), 0) AS downvotes
        FROM comentarios c
        LEFT JOIN reacoes r ON r.comment_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    ''')
    rows = [dict(r) for r in cur.fetchall()]
    return rows


@app.post('/comments')
def post_comment(c: ComentarioIn):
    nid = c.id or f"id_{int(time.time()*1000)}"
    now = int(time.time())
    try:
        conn.execute(
            'INSERT INTO comentarios (id,nome,texto,autorToken,parent_id,created_at) VALUES (?,?,?,?,?,?)',
            (nid, c.nome, c.texto, c.autorToken, c.parentId, now)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail='ID já existe')
    broadcast({'action': 'refresh'})
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
    broadcast({'action': 'refresh'})
    return {'status': 'deleted'}


@app.post('/comments/{cid}/reactions')
def react_comment(cid: str, payload: ReactionIn):
    cur = conn.execute('SELECT id FROM comentarios WHERE id = ?', (cid,)).fetchone()
    if not cur:
        raise HTTPException(status_code=404, detail='comentário não encontrado')

    existing = conn.execute(
        'SELECT reaction FROM reacoes WHERE comment_id = ? AND user_token = ?',
        (cid, payload.token)
    ).fetchone()

    if existing and existing['reaction'] == payload.reaction:
        conn.execute(
            'DELETE FROM reacoes WHERE comment_id = ? AND user_token = ?',
            (cid, payload.token)
        )
    else:
        conn.execute(
            'INSERT OR REPLACE INTO reacoes (comment_id, user_token, reaction) VALUES (?,?,?)',
            (cid, payload.token, payload.reaction)
        )

    conn.commit()
    broadcast({'action': 'refresh'})
    return {'status': 'ok'}


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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
