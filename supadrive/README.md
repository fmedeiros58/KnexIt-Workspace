# SupaDrive

Módulo de armazenamento e streaming que atua como origin server para o KnexIT Workspace. Faz ingestão de arquivos, empacotamento HLS/DASH e integração com CDN.

## Pastas
- `api/`: endpoints REST para upload, geração de URLs assinadas e webhooks de processamento.
- `encoder/`: workers responsáveis por transcodificação (FFmpeg, MediaConvert, etc.).
- `uploader/`: clientes/SDKs de upload direto (S3, GCS).
- `player/`: assets e SDK do player embutido.
- `routes/`: roteadores Express/Fastify.

## Execução
```bash
cd supadrive
npm install
npm run dev
```
Defina variáveis como `STORAGE_BUCKET`, `CDN_BASE_URL` e `AUTH_PUBLIC_KEY` para validar tokens emitidos pelo serviço `auth/`.

