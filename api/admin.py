"""Servidor de administração do OrbisOS.

Roda na Vercel (Python), não no navegador: só aqui existem as credenciais de administrador do
Firebase, então só aqui dá para liberar, bloquear e excluir contas.

GET  /api/admin            -> diz se o servidor está configurado (sem segredo nenhum)
POST /api/admin            -> ações, com "Authorization: Bearer <token da conta>"
     {"acao": "permitidos"}                   lista quem pode entrar
     {"acao": "permitir", "email": "..."}     libera um e-mail
     {"acao": "bloquear", "email": "..."}     tira o e-mail da lista
     {"acao": "contas"}                       lista as contas criadas
     {"acao": "excluir-conta", "email": "..."} apaga a conta
"""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

PROJETO = os.environ.get('FIREBASE_PROJETO', 'orbisos-plauska')
FIRESTORE = f'https://firestore.googleapis.com/v1/projects/{PROJETO}/databases/(default)/documents'
CONTAS = f'https://identitytoolkit.googleapis.com/v1/projects/{PROJETO}/accounts'
ESCOPO = ['https://www.googleapis.com/auth/cloud-platform']


class Recusa(Exception):
    """Resposta de erro já pronta para a tela: código HTTP e texto em português."""

    def __init__(self, codigo: int, mensagem: str):
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem


def token_de_administrador() -> str:
    bruto = os.environ.get('FIREBASE_CREDENCIAIS')
    if not bruto:
        raise Recusa(503, 'O servidor ainda não tem a credencial do Firebase (FIREBASE_CREDENCIAIS).')
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account
    credencial = service_account.Credentials.from_service_account_info(json.loads(bruto), scopes=ESCOPO)
    credencial.refresh(Request())
    return str(credencial.token)


def chamar(url: str, token: str, corpo: object = None, metodo: str = 'GET') -> dict:
    dados = json.dumps(corpo).encode() if corpo is not None else None
    pedido = urllib.request.Request(url, data=dados, method=metodo, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(pedido, timeout=20) as resposta:
            texto = resposta.read().decode()
    except urllib.error.HTTPError as erro:
        detalhe = erro.read().decode()[:300]
        raise Recusa(502, f'O Firebase respondeu {erro.code}: {detalhe}') from erro
    return json.loads(texto) if texto else {}


def emails_de_administrador() -> list[str]:
    return [e.strip().lower() for e in os.environ.get('ORBIS_ADMINS', '').split(',') if e.strip()]


def quem_pediu(cabecalho: str | None, token: str) -> str:
    """Confere o token da conta no próprio Firebase e devolve o e-mail de quem chamou."""
    if not cabecalho or not cabecalho.lower().startswith('bearer '):
        raise Recusa(401, 'Entre na sua conta para usar esta tela.')
    conta = chamar(f'{CONTAS}:lookup', token, {'idToken': cabecalho[7:].strip()}, 'POST')
    email = (conta.get('users') or [{}])[0].get('email', '').lower()
    if not email:
        raise Recusa(401, 'Sua sessão expirou. Saia e entre de novo.')
    admins = emails_de_administrador()
    if not admins:
        raise Recusa(503, 'O servidor ainda não sabe quem é administrador (ORBIS_ADMINS).')
    if email not in admins:
        raise Recusa(403, 'Esta tela é só para a administração do sistema.')
    return email


def permitidos(token: str) -> dict:
    pagina = chamar(f'{FIRESTORE}/permitidos?pageSize=300', token)
    lista = [
        {
            'email': d['name'].rsplit('/', 1)[-1],
            'desde': d.get('fields', {}).get('desde', {}).get('stringValue'),
        }
        for d in pagina.get('documents', [])
    ]
    return {'permitidos': sorted(lista, key=lambda p: p['email'])}


def contas(token: str) -> dict:
    pagina = chamar(f'{CONTAS}:query', token, {'returnUserInfo': True}, 'POST')
    return {'contas': [
        {
            'email': u.get('email'),
            'uid': u.get('localId'),
            'criadaEm': u.get('createdAt'),
            'ultimoAcesso': u.get('lastLoginAt'),
        }
        for u in pagina.get('userInfo', [])
    ]}


def email_do_pedido(pedido: dict) -> str:
    email = str(pedido.get('email', '')).strip().lower()
    if '@' not in email:
        raise Recusa(400, 'Digite um e-mail válido.')
    return email


def responder(metodo: str, cabecalho_auth: str | None, pedido: dict) -> tuple[int, dict]:
    if metodo == 'GET':
        return 200, {
            'servidor': 'python',
            'projeto': PROJETO,
            'configurado': bool(os.environ.get('FIREBASE_CREDENCIAIS')) and bool(emails_de_administrador()),
        }

    acao = str(pedido.get('acao', ''))
    if acao not in {'permitidos', 'permitir', 'bloquear', 'contas', 'excluir-conta'}:
        raise Recusa(400, f'Não conheço a ação "{acao}".')

    token = token_de_administrador()
    autor = quem_pediu(cabecalho_auth, token)

    if acao == 'permitidos':
        return 200, permitidos(token)
    if acao == 'contas':
        return 200, contas(token)

    email = email_do_pedido(pedido)
    if email == autor and acao in {'bloquear', 'excluir-conta'}:
        raise Recusa(400, 'Você não pode tirar o seu próprio acesso por aqui.')

    if acao == 'permitir':
        chamar(f'{FIRESTORE}/permitidos/{email}', token, {'fields': {
            'email': {'stringValue': email},
            'desde': {'stringValue': datetime.now(timezone.utc).isoformat()},
            'liberadoPor': {'stringValue': autor},
        }}, 'PATCH')
        return 200, {'feito': f'{email} agora pode entrar.', **permitidos(token)}

    if acao == 'bloquear':
        chamar(f'{FIRESTORE}/permitidos/{email}', token, None, 'DELETE')
        return 200, {'feito': f'{email} não entra mais.', **permitidos(token)}

    achadas = chamar(f'{CONTAS}:lookup', token, {'email': [email]}, 'POST').get('users') or []
    if not achadas:
        raise Recusa(404, f'Não existe conta com o e-mail {email}.')
    chamar(f'{CONTAS}:delete', token, {'localId': achadas[0]['localId']}, 'POST')
    return 200, {'feito': f'A conta {email} foi apagada.', **contas(token)}


class handler(BaseHTTPRequestHandler):

    def _responder(self, metodo: str):
        try:
            tamanho = int(self.headers.get('Content-Length') or 0)
            pedido = json.loads(self.rfile.read(tamanho) or b'{}') if tamanho else {}
            codigo, corpo = responder(metodo, self.headers.get('Authorization'), pedido)
        except Recusa as recusa:
            codigo, corpo = recusa.codigo, {'erro': recusa.mensagem}
        except Exception as erro:  # a tela precisa de um texto, não de uma página de erro da Vercel
            codigo, corpo = 500, {'erro': f'Erro no servidor: {erro}'}
        saida = json.dumps(corpo, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(saida)))
        self.end_headers()
        self.wfile.write(saida)

    def do_GET(self):
        self._responder('GET')

    def do_POST(self):
        self._responder('POST')
