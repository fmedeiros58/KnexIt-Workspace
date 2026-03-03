# Reverse Proxy e Publicacao HTTPS da API

Data: 2026-03-03  
Escopo: exposicao segura da API em dominio proprio com backend interno.

## 1) Arquitetura final de portas

- Publico:
  - `80/tcp` (somente redirect para HTTPS)
  - `443/tcp` (API publica)
- Privado (localhost):
  - `127.0.0.1:3000` (backend Next API)
  - `127.0.0.1:8000` (vLLM)
  - `127.0.0.1:5432` ou equivalente (Postgres)

## 2) O que e publico vs privado

Publico:
- Reverse proxy (Nginx/Caddy) em `api.knexspace.com` e/ou `knexspace.com`.

Privado:
- Backend de aplicacao em `127.0.0.1:3000`.
- vLLM e bancos sem bind externo.

## 3) Artefatos versionados

- Nginx:
  - `deploy/nginx/knexspace.conf`
- Caddy:
  - `deploy/caddy/Caddyfile`
- Systemd (exemplo backend):
  - `deploy/systemd/knexspace-api.service`

## 4) Requisitos minimos da configuracao

Atendidos nos artefatos:
- `proxy_pass` / `reverse_proxy` para `127.0.0.1:3000`
- `Host`
- `X-Real-IP`
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- redirect HTTP -> HTTPS

## 5) Certificado TLS

### Nginx
- Recomendado: Certbot + Let's Encrypt.
- Certificado referenciado em:
  - `/etc/letsencrypt/live/api.knexspace.com/fullchain.pem`
  - `/etc/letsencrypt/live/api.knexspace.com/privkey.pem`

### Caddy
- TLS automatico por padrao (Let's Encrypt), sem bloco manual de certificado na maioria dos casos.

## 6) Headers e reverse proxy no backend

As rotas publicas (`/health`, `/ready`, `/chat`, `/query`, `/v1/chat/completions`) leem:
- `X-Forwarded-For`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`
- `X-Real-IP`

Isso garante contexto correto de cliente/protocolo sob proxy.

## 7) Firewall e exposicao de portas

No host:
- abrir somente `80` e `443` externamente;
- manter `3000`, `8000`, `5432` fechadas externamente.

Exemplo (UFW):
- permitir `Nginx Full` (ou regras equivalentes)
- negar acesso externo direto a portas internas.

## 8) Testes de configuracao

- Validar sintaxe Nginx: `nginx -t`
- Validar resposta externa:
  - `curl -I http://api.knexspace.com/health` (deve redirecionar para https)
  - `curl -I https://api.knexspace.com/health` (200)
  - `curl https://api.knexspace.com/ready` (200/503 conforme dependencia)

## 9) Depuracao comum

- `502 Bad Gateway`:
  - backend nao esta ativo em `127.0.0.1:3000`
  - unit systemd parada
- TLS invalido:
  - certificado nao emitido/expirado
  - paths de certificado incorretos
- CORS 403:
  - origem nao cadastrada em `PUBLIC_API_ALLOWED_ORIGINS`/`VERCEL_FRONTEND_ORIGIN`.

