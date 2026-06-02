# Pipeline Modular HTML Text - Ativação Permanente

**Data**: 01/06/2026  
**Status**: ✅ IMPLEMENTADO E COMPILANDO  
**Escopo**: Ativação automática para PDFs não-legados

---

## O Que Foi Mudado

### 1. **NativePdfSession** (pdfLoader.service.ts)
Adicionada propriedade `isLegacy` para rastrear se o PDF foi carregado com runtime legado:

```typescript
export type NativePdfSession = {
  // ... propriedades existentes ...
  
  /**
   * true se carregado com runtime PDF.js legado (versão 2.x)
   * false se carregado com runtime moderno (versão 3.x+)
   */
  isLegacy: boolean;
};
```

**Onde é definida**: Na função `loadNativePdfSession()`:
```typescript
return {
  // ...
  isLegacy: isLegacyPdfJsRuntime(pdfjs),  // ← Detecta versão 2.x vs 3.x+
};
```

### 2. **PdfPageView.tsx** - Nova Lógica de Ativação

#### Antes:
```typescript
function readModularPagePipelineEnabled(): boolean {
  return (
    getGlobalBoolean("KNEX_PDF_USE_MODULAR_PAGE_PIPELINE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE")
  );
}
// Resultado: Desativado por padrão, podia ser ativado via flags globais
```

#### Depois:
```typescript
function shouldUseModularPagePipeline(input: {
  isLegacyPdf: boolean;
  forceViaGlobal?: boolean;
}): boolean {
  // Se forçado globalmente, usar esse valor
  if (
    getGlobalBoolean("KNEX_PDF_USE_MODULAR_PAGE_PIPELINE") ||
    getGlobalBoolean("KNEX_PDF_FORCE_SINGLE_CANVAS_PAGE")
  ) {
    return true;
  }

  // Ativar automaticamente para PDFs não-legados ← MUDANÇA PRINCIPAL
  return !input.isLegacyPdf;
}
```

**Resultado**: 
- ✅ **Ativado por padrão** para PDFs modernos (PDF.js 3.x+)
- ✅ **Desativado** para PDFs legados (PDF.js 2.x) por compatibilidade
- ✅ Pode ser **forçado** via flags globais para testes

### 3. **PdfPageView.tsx** - Inicialização do Estado

**Antes**:
```typescript
const [modularPagePipelineEnabled, setModularPagePipelineEnabled] = useState(
  readModularPagePipelineEnabled,
);
```

**Depois**:
```typescript
const [modularPagePipelineEnabled, setModularPagePipelineEnabled] = useState(
  () => shouldUseModularPagePipeline({ isLegacyPdf: session.isLegacy }),  // ← Passa isLegacy
);
```

### 4. **PdfPageView.tsx** - Sincronização de Flags

**Antes**:
```typescript
useEffect(() => {
  const syncModularPipelineFlag = () => {
    const next = readModularPagePipelineEnabled();
    setModularPagePipelineEnabled(current => (current === next ? current : next));
  };
  // ... setup interval e listeners ...
}, []); // ← Sem dependencies
```

**Depois**:
```typescript
useEffect(() => {
  const syncModularPipelineFlag = () => {
    const next = shouldUseModularPagePipeline({ isLegacyPdf: session.isLegacy });
    setModularPagePipelineEnabled(current => (current === next ? current : next));
  };
  // ... setup interval e listeners ...
}, [session.isLegacy]); // ← Reexecuta se session.isLegacy muda
```

---

## Resultado Final

### Matriz de Ativação

| Cenário | PDF.js Version | session.isLegacy | Flag Global | Resultado |
|---------|---|---|---|---|
| Novo PDF carregado | 3.x+ | false | (nenhuma) | ✅ **Modular ativado** |
| PDF legado | 2.x | true | (nenhuma) | ❌ **Tiled canvas** (compatibilidade) |
| Novo PDF, flags override | 3.x+ | false | true | ✅ **Modular ativado** |
| PDF legado, força | 2.x | true | true | ✅ **Modular forçado** (para teste) |

### Fluxo de Renderização Automático

```
1. Usuário carrega PDF
   ↓
2. loadNativePdfSession() detecta versão do PDF.js
   ├─ PDF.js 2.x? isLegacy = true
   └─ PDF.js 3.x+? isLegacy = false
   ↓
3. PdfPageView usa shouldUseModularPagePipeline()
   ├─ Se isLegacy = false → Modular pipeline ativado ✅
   │  └─ Renderiza: PdfCanvasLayer + PdfHtmlTextLayer
   │
   └─ Se isLegacy = true → Tiled canvas (compatibilidade)
      └─ Renderiza: PdfTiledPageCanvas (sem HTML text)
   ↓
4. Texto HTML aparece automaticamente (se não-legado)
```

---

## Testando

### Teste 1: Verificar Ativação Automática

1. Abra o DevTools
2. Execute:
```javascript
// Verifique a propriedade da sessão
const session = /* acesso à sessão - depende do seu contexto */;
console.log("PDF é legado?", session.isLegacy);

// Procure por elementos HTML de texto
const htmlTextLayers = document.querySelectorAll('[data-knexread-html-text-layer="true"]');
console.log("HTML text layer renderizado:", htmlTextLayers.length > 0);
```

### Teste 2: Forçar em PDF Legado

```javascript
// Ativa modular mesmo em PDF legado (para debug)
window.KNEX_PDF_USE_MODULAR_PAGE_PIPELINE = true;
location.reload();

// Verifique se aparece:
document.querySelectorAll('[data-knexread-html-text-layer="true"]');
```

### Teste 3: Desabilitar em PDF Moderno

```javascript
// Não há como desabilitar via flag (por design)
// Modular pipelines sempre ativo para PDF.js 3.x+
// (para garantir melhor experiência de texto)
```

---

## Arquivos Modificados

### 1. `pdfLoader.service.ts`
- ✅ Adicionada propriedade `isLegacy` a `NativePdfSession`
- ✅ Detecta automaticamente via `isLegacyPdfJsRuntime(pdfjs)`

### 2. `PdfPageView.tsx`
- ✅ Removida função `readModularPagePipelineEnabled()`
- ✅ Adicionada função `shouldUseModularPagePipeline()`
- ✅ Atualizado estado inicial
- ✅ Atualizado useEffect de sincronização

### 3. Compilação
- ✅ `tsc --noEmit` passou sem erros
- ✅ Nenhuma mudança de tipo quebrada

---

## Benefícios

✅ **Sem intervenção manual**: PDFs modernos ativam HTML text automaticamente  
✅ **Compatibilidade**: PDFs legados continuam com tiled canvas  
✅ **Debugging**: Ainda pode forçar via flags globais  
✅ **Zero breaking changes**: Código legado continua funcionando  
✅ **Permanente**: Não precisa ativar via DevTools a cada reload

---

## Próximas Fases

### Phase 2 (Próxima)
- Testar renderização com PDFs variados
- Ajustar estilos CSS dos text runs
- Validar performance

### Phase 3+
- Melhorar OCR integration
- Refinamento de highlighting
- Suporte a anotações sobre texto HTML

---

**Resumo**: Pipeline modular agora ativado permanentemente e automaticamente para PDFs não-legados. Zero mudança no comportamento para PDFs legados. 🎯
