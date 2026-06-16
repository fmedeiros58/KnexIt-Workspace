/**
 * ZoomScrollConstants.ts
 * -----------------------------------------------------------------------------
 * Constantes centrais da nova arquitetura de zoom/scroll.
 *
 * Objetivo:
 * impedir que velocidade, settle, limites e multiplicadores fiquem espalhados.
 *
 * Regra:
 * - se uma constante afeta a sensação de velocidade do zoom, ela deve estar aqui;
 * - se uma constante afeta apenas render/text-layer, ela NÃO deve estar aqui;
 * - PdfZoomFramePolicy não deve mais controlar velocidade de wheel;
 * - PdfWheelInteractionPolicy não deve mais controlar velocidade final de zoom.
 *
 * PERFIL ATUAL:
 * - zoom-in agressivo, com resposta forte em pequenos movimentos da roda;
 * - zoom-out ainda mais agressivo em zoom alto, com sensação de retorno em mola;
 * - renderZoom/committedRenderZoom confirma rápido, mas continua separado do
 *   visualZoom para evitar render pesado durante o gesto.
 */

export const ZOOM_SCROLL_MIN_ZOOM_PERCENT = 10;
export const ZOOM_SCROLL_MAX_ZOOM_PERCENT = 2000;

/**
 * Multiplicador principal de velocidade do wheel zoom.
 *
 * Este é o ponto auditável para a sensação de velocidade.
 *
 * Antes: 6
 * Agora: 12
 *
 * Efeito esperado:
 * - menos giros do wheel para chegar a zoom alto;
 * - zoom-out mais responsivo;
 * - maior sensação de "mola" quando retorna de 2000%, 1600%, 1200% etc.
 */
export const ZOOM_SCROLL_WHEEL_ZOOM_SPEED_MULTIPLIER = 12;

/**
 * Uma roda comum costuma enviar deltaY próximo de 100/120 por "notch".
 *
 * Antes: 120
 * Agora: 96
 *
 * Reduzir este valor aumenta a sensibilidade, porque o mesmo delta físico
 * passa a equivaler a mais "notches" lógicos.
 */
export const ZOOM_SCROLL_WHEEL_NOTCH_PIXELS = 96;

/**
 * Fator máximo de crescimento por evento/coalescência.
 *
 * Antes: 1.9
 * Agora: 3.2
 *
 * Exemplo:
 * - 100% pode ir até 320% em uma entrada forte;
 * - 300% pode ir até 960%;
 * - ainda há clamp global em 2000%.
 */
export const ZOOM_SCROLL_MAX_ZOOM_IN_FACTOR_PER_INPUT = 3.2;

/**
 * Fator mínimo de redução por evento/coalescência.
 *
 * Antes: 0.32
 * Agora: 0.12
 *
 * Exemplo:
 * - 2000% pode cair até 240% em uma entrada forte;
 * - 1600% pode cair até 192%;
 * - isso dá a percepção de retorno imediato no zoom-out.
 */
export const ZOOM_SCROLL_MIN_ZOOM_OUT_FACTOR_PER_INPUT = 0.12;

/**
 * Ganho extra para zoom-out em zoom alto.
 *
 * Antes: 1.45
 * Agora: 2.8
 *
 * A intenção é dar sensação real de "mola de retorno":
 * quanto mais ampliado, mais rápido ele volta.
 */
export const ZOOM_SCROLL_HIGH_ZOOM_OUT_RETURN_BOOST = 2.8;

/**
 * Freio perto do teto de 2000%.
 *
 * Antes: 0.52
 * Agora: 0.25
 *
 * Reduzimos o freio porque o objetivo agora é velocidade.
 * Mantemos algum freio mínimo apenas para evitar tremulação no teto.
 */
export const ZOOM_SCROLL_NEAR_MAX_ZOOM_BRAKE = 0.25;

/**
 * Settle do render final.
 *
 * visualZoom muda imediatamente; renderZoom só confirma depois.
 *
 * Antes: 84
 * Agora: 48
 *
 * Efeito esperado:
 * - render final confirma mais rápido depois que o usuário para de girar;
 * - sem prender a resposta visual, porque visualZoom já foi aplicado antes.
 */
export const ZOOM_SCROLL_RENDER_COMMIT_SETTLE_MS = 48;

/**
 * Janela de interação após último evento wheel.
 *
 * Antes: 140
 * Agora: 96
 *
 * Mantém PageView/Tiles/Observers em modo leve durante o gesto, mas libera
 * mais rápido depois que o usuário para.
 */
export const ZOOM_SCROLL_INTERACTION_SETTLE_MS = 96;

/**
 * Scroll comum.
 *
 * Estes valores são usados pelo ScrollMotionController, não pelo zoom.
 * Mantive conservador para não confundir correção de zoom com correção de scroll.
 */
export const ZOOM_SCROLL_SCROLL_PRIMER_RATIO = 0.08;
export const ZOOM_SCROLL_SCROLL_PRIMER_MAX_PX = 36;
export const ZOOM_SCROLL_SCROLL_VELOCITY_IMPULSE = 0.018;
export const ZOOM_SCROLL_SCROLL_MAX_VELOCITY_PX_PER_MS = 3.8;
export const ZOOM_SCROLL_SCROLL_FRICTION_PER_16MS = 0.72;
export const ZOOM_SCROLL_SCROLL_MIN_VELOCITY_PX_PER_MS = 0.015;
export const ZOOM_SCROLL_SCROLL_MAX_FRAME_DT_MS = 24;

/**
 * Tolerâncias.
 */
export const ZOOM_SCROLL_EPSILON = 0.000001;
export const ZOOM_SCROLL_ASSIGNMENT_EPSILON = 0.01;

/**
 * Conversão de deltaMode.
 */
export const ZOOM_SCROLL_LINE_DELTA_PX = 16;
export const ZOOM_SCROLL_PAGE_DELTA_PX = 800;
