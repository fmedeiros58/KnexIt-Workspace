# KnexIT Core Library

Pacote interno compartilhado que concentra configurações, middlewares e utilidades reutilizadas por todos os microserviços. Publicado como biblioteca Node.js para consumo via `npm install ../core` ou registry privado.

## Estrutura
- `config/`: loaders de env, schemas e toggles de recursos.
- `utils/`: helpers genéricos (logger, formatadores, adapters HTTP).
- `database/`: clientes e factories para Postgres, Redis, Storage.
- `shared/`: tipos, middlewares Express e hooks cross-service.

### Uso
```ts
import { logger } from "@knexit/core/utils/logger";
logger.info("service booting");
```
Execute `npm run build` após editar o pacote para gerar `dist/` consumível pelos demais serviços.
