/**
 * Responsabilidade do arquivo:
 * - Abrir hipoteses derivadas a partir das tensoes dialogicas.
 * - Entregar ramas inferenciais para consumo do modulo inferential/epistemico.
 * - Manter hipoteses testaveis e semanticamente alinhadas ao seed.
 */
import type { DialogicalTension, HypothesisBranch, IdeaSeed } from "./communicative-elaboration.types";

export function expandHypotheses(seed: IdeaSeed, tensions: DialogicalTension[]): HypothesisBranch[] {
  const branches = tensions.map((tension, index) => ({
    id: `hyp-branch-${index + 1}`,
    claim:
      `Hipotese ${index + 1}: ao equilibrar '${tension.poleA}' e '${tension.poleB}', ` +
      `a explicacao para "${seed.coreClaim}" ganha mais poder explicativo.`,
    epistemicHooks: [
      "classificar_fato_inferencia_hipotese",
      "buscar_evidencia_de_suporte_e_contraste",
      "medir_risco_de_extrapolacao",
    ],
    supportingHooks: [
      tension.productiveQuestion,
      `testar_polo_${index + 1}_com_dados`,
    ],
  }));

  if (!branches.length) {
    return [
      {
        id: "hyp-branch-1",
        claim: `Hipotese base: a formulacao atual pode ser melhorada com refinamento progressivo de "${seed.coreClaim}".`,
        epistemicHooks: ["classificar_fato_inferencia_hipotese"],
        supportingHooks: ["pedir_delimitacao_de_escopo"],
      },
    ];
  }

  return branches.slice(0, 5);
}

