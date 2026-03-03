# Runbook Operacional - Nginx/Caddy para API Publica

Data: 2026-03-03  
Escopo: ativacao, validacao e manutencao segura da publicacao HTTPS.

## 1) Pre-requisitos

- Dominio apontando para IP do servidor:
  - `api.knexspace.com` (preferencial)
  - opcional: `knexspace.com`
- Backend ativo em `127.0.0.1:3000`
- Variaveis de API publica configuradas:
  - `PUBLIC_API_ALLOWED_ORIGINS`
  - `PUBLIC_API_KEY` (ou `PUBLIC_API_KEYS`)
- Portas publicas abertas: `80`, `443`
- Portas internas nao expostas: `3000`, `8000`, `5432`

## 2) Ativacao com Nginx (Ubuntu)

1. Copiar config versionada:
   - `deploy/nginx/knexspace.conf` -> `/etc/nginx/sites-available/knexspace.conf`
2. Criar symlink:
   - `/etc/nginx/sites-enabled/knexspace.conf`
3. Testar sintaxe:
   - `sudo nginx -t`
4. Recarregar:
   - `sudo systemctl reload nginx`

## 3) Emissao TLS (Nginx + Certbot)

1. Instalar Certbot para Nginx.
2. Emitir certificado:
   - `sudo certbot --nginx -d api.knexspace.com -d knexspace.com`
3. Validar renovacao:
   - `sudo certbot renew --dry-run`
4. Revalidar config:
   - `sudo nginx -t && sudo systemctl reload nginx`

## 4) Ativacao com Caddy

1. Copiar `deploy/caddy/Caddyfile` para `/etc/caddy/Caddyfile`.
2. Validar:
   - `sudo caddy validate --config /etc/caddy/Caddyfile`
3. Reload:
   - `sudo systemctl reload caddy`

TLS automatico sera emitido pelo Caddy apos DNS e portas estarem corretos.

## 5) Backend via systemd (exemplo)

Arquivo versionado:
- `deploy/systemd/knexspace-api.service`

Passos:
1. Copiar para `/etc/systemd/system/knexspace-api.service`.
2. Ajustar `WorkingDirectory`, `EnvironmentFile`, usuario/grupo.
3. Executar:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now knexspace-api`
   - `sudo systemctl status knexspace-api`

## 6) Testes operacionais

1. Health:
   - `curl -sS https://api.knexspace.com/health`
2. Ready:
   - `curl -sS https://api.knexspace.com/ready`
3. Chat protegido:
   - `curl -X POST https://api.knexspace.com/chat -H "x-api-key: <KEY>" -H "content-type: application/json" -d "{\"message\":\"teste\"}"`
4. OpenAI-compatible:
   - `curl -X POST https://api.knexspace.com/v1/chat/completions -H "Authorization: Bearer <KEY>" -H "content-type: application/json" -d "{\"model\":\"mistral-awq\",\"messages\":[{\"role\":\"user\",\"content\":\"teste\"}],\"stream\":false}"`

## 7) Reload seguro

- Nginx:
  - sempre `nginx -t` antes de reload.
  - usar `systemctl reload nginx` (evita downtime de restart completo).
- Caddy:
  - sempre `caddy validate` antes de reload.
  - usar `systemctl reload caddy`.

## 8) Erros comuns e diagnostico

- `401 PUBLIC_API_UNAUTHORIZED`
  - API key ausente/invalida.
- `503 PUBLIC_API_KEY_NOT_CONFIGURED`
  - backend em producao sem `PUBLIC_API_KEY(S)`.
- `503 /ready` com `vectorDb` ou `llm` falhando
  - dependencia interna indisponivel.
- `502` no proxy
  - backend fora do ar em `127.0.0.1:3000`.
- `CORS_ORIGIN_FORBIDDEN`
  - frontend nao cadastrado na allowlist.

## 9) Passos manuais obrigatorios (nao automatizados)

- Ajustar DNS do dominio.
- Copiar/ativar arquivos no servidor (`/etc/nginx` ou `/etc/caddy`).
- Emitir certificado TLS.
- Configurar firewall.
- Provisionar arquivo de ambiente de producao com secrets reais.

