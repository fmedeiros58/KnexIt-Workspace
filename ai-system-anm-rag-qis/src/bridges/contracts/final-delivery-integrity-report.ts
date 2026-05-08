/**
 * @file final-delivery-integrity-report.ts
 * @description Define o relatorio de integridade terminal da entrega ao front-end.
 * @layer bridges/contracts
 * @purpose Permitir auditoria estruturada entre texto semantico final e texto terminal entregue por REST, SSE ou WebSocket.
 * @inputs Canal de entrega, texto semantico serializado e corpo final entregue ao front-end.
 * @outputs Hashes, contagem de eventos terminais, sinais de divergencia e status de correcao.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy presentation-front-bridge, observabilidade e testes de regressao de streaming.
 * @invariants O relatorio nao altera a resposta; ele apenas registra se a entrega terminal corresponde ao texto final.
 * @notes Hash simples e deterministico e suficiente para auditoria local sem acoplar a camada a APIs de cripto.
 */
import type { DeliveryChannel } from "../../shared/enums/delivery-enums";

export interface FinalDeliveryIntegrityReport {
  channel: DeliveryChannel;
  semanticTextHash: string;
  terminalTextHash: string;
  semanticCharCount: number;
  terminalCharCount: number;
  doneEventCount: number;
  terminalMatchesSemanticText: boolean;
  terminalTextShorterThanSemantic: boolean;
  correctiveTerminalLikelyAppended: boolean;
  issues: string[];
}

