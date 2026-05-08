# KnexWriter

**KnexWriter** é uma plataforma moderna de escrita assistida por IA, construída com Next.js e integrada com o sistema KnexAI.

## 🎯 Características Principais

- ✍️ **Editor de escrita em tempo real** com formatação rica
- 📄 **Paginação automática** (formato A4)
- 🤖 **Assistente de IA** para geração de conteúdo
- 📚 **Gerenciamento de projetos** de escrita
- 🔍 **Navegação por seções** com visualização de páginas
- 💾 **Sincronização automática** de rascunhos

## 📁 Estrutura do Projeto

```
knexwriter/
├── web/
│   └── page.tsx          # Página principal do editor
├── lib/
│   └── client.ts         # Funções cliente da API
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Como Usar

### Acessar KnexWriter

```
http://localhost:3000/knexwriter/web
```

### Criar um Novo Projeto

1. Clique em "Novo projeto"
2. Defina o título e objetivo
3. Comece a escrever

### Usar o Assistente de IA

1. Escreva uma instrução na caixa "Assistente de IA para escrita"
2. Clique em "Gerar"
3. O texto será inserido automaticamente no documento

### Formatar Texto

Use a barra de ferramentas para:
- Criar títulos (H1)
- Aplicar negrito, itálico, sublinhado
- Criar listas numeradas ou com pontos
- Criar blocos de citação

## 🔗 Integração com KnexAI

KnexWriter usa as mesmas APIs do KnexAI:

- `listWriteProjects()` - Lista projetos de escrita
- `getWriteProject()` - Carrega projeto específico
- `createWriteProject()` - Cria novo projeto
- `continueWrite()` - Gera continuação com IA

## 📝 Notas Técnicas

- Suporta múltiplas seções por projeto
- Cada seção pode ter múltiplos chunks (blocos gerados)
- Paginação A4 automática
- Estado salvo em localStorage
- Interface responsiva com Tailwind CSS

## 🎨 Personalização

Para modificar o layout da página A4, edite as constantes em `knexwriter/web/page.tsx`:

```typescript
const WRITING_PAGE_FORMAT_PRESETS = {
  a4: {
    widthPx: 794,   // Largura em pixels
    heightPx: 1123, // Altura em pixels
    // ... outras propriedades
  }
}
```

## 📚 Leitura Adicional

- [Documentação do KnexAI](/knexai/README.md)
- [API de Escrita](/docs/writing-api.md)
