export type KnexWriterRetentionMaskRect = {
  topPx: number;
  heightPx: number;
};

export type KnexWriterNonRegressionSnapshot = {
  featureLineAwareRetentionEnabled: boolean;
  featureBodyBoundsRetentionEnabled: boolean;
  featurePageGapMaskEnabled: boolean;
  featureCursorPlacementFallbackEnabled: boolean;
  masks: KnexWriterRetentionMaskRect[];
  pageCount: number;
  pageHeightPx: number;
  pageStridePx: number;
  bodyTopPx: number;
  bodyBottomPx: number;
};

type KnexWriterNonRegressionReport = {
  ok: boolean;
  reasons: string[];
};

function getMaskCoverageTop(
  masks: KnexWriterRetentionMaskRect[],
  pageTopPx: number,
  pageBottomPx: number,
) {
  let coverageTop = Number.POSITIVE_INFINITY;

  for (const mask of masks) {
    const maskStart = Math.max(pageTopPx, mask.topPx);
    const maskEnd = Math.min(pageBottomPx, mask.topPx + mask.heightPx);
    if (maskEnd - maskStart <= 0) continue;
    if (maskStart < coverageTop) coverageTop = maskStart;
  }

  return coverageTop;
}

function getMaskCoverageBottom(
  masks: KnexWriterRetentionMaskRect[],
  pageTopPx: number,
  pageBottomPx: number,
) {
  let coverageBottom = Number.NEGATIVE_INFINITY;

  for (const mask of masks) {
    const maskStart = Math.max(pageTopPx, mask.topPx);
    const maskEnd = Math.min(pageBottomPx, mask.topPx + mask.heightPx);
    if (maskEnd - maskStart <= 0) continue;
    if (maskEnd > coverageBottom) coverageBottom = maskEnd;
  }

  return coverageBottom;
}

export function evaluateKnexWriterNonRegression(
  snapshot: KnexWriterNonRegressionSnapshot,
): KnexWriterNonRegressionReport {
  const reasons: string[] = [];

  if (!snapshot.featureLineAwareRetentionEnabled) {
    reasons.push("line-aware retention está desativado.");
  }

  if (!snapshot.featureBodyBoundsRetentionEnabled) {
    reasons.push("retenção por limites de corpo (header/footer) está desativada.");
  }

  if (!snapshot.featurePageGapMaskEnabled) {
    reasons.push("máscara de vão entre páginas está desativada.");
  }

  if (!snapshot.featureCursorPlacementFallbackEnabled) {
    reasons.push("fallback de posicionamento de cursor por clique está desativado.");
  }

  const safePageCount = Math.max(1, snapshot.pageCount);
  const bodyTopLimitOffset = Math.max(0, snapshot.bodyTopPx);
  const bodyBottomLimitOffset = Math.max(0, snapshot.bodyBottomPx);
  const tolerance = 1.1;

  for (let pageIndex = 0; pageIndex < safePageCount; pageIndex += 1) {
    const pageTopPx = pageIndex * snapshot.pageStridePx;
    const pageBottomPx = pageTopPx + snapshot.pageHeightPx;
    const expectedTopLimit = pageTopPx + bodyTopLimitOffset;
    const expectedBottomLimit = pageBottomPx - bodyBottomLimitOffset;

    const maskCoverageTop = getMaskCoverageTop(snapshot.masks, pageTopPx, pageBottomPx);
    const maskCoverageBottom = getMaskCoverageBottom(
      snapshot.masks,
      pageTopPx,
      pageBottomPx,
    );

    if (Number.isFinite(maskCoverageTop)) {
      if (Math.abs(maskCoverageTop - pageTopPx) > tolerance) {
        reasons.push(`máscara superior da página ${pageIndex + 1} não começa no topo da página.`);
      }
    } else if (bodyTopLimitOffset > tolerance) {
      reasons.push(`máscara superior ausente na página ${pageIndex + 1}.`);
    }

    if (Number.isFinite(maskCoverageBottom)) {
      if (Math.abs(maskCoverageBottom - pageBottomPx) > tolerance) {
        reasons.push(`máscara inferior da página ${pageIndex + 1} não termina no fim da página.`);
      }
    } else if (bodyBottomLimitOffset > tolerance) {
      reasons.push(`máscara inferior ausente na página ${pageIndex + 1}.`);
    }

    const hasTopRetention = snapshot.masks.some((mask) => {
      const maskStart = mask.topPx;
      const maskEnd = mask.topPx + mask.heightPx;
      return (
        maskStart <= pageTopPx + tolerance &&
        maskEnd >= expectedTopLimit - tolerance
      );
    });

    const hasBottomRetention = snapshot.masks.some((mask) => {
      const maskStart = mask.topPx;
      const maskEnd = mask.topPx + mask.heightPx;
      return (
        maskStart <= expectedBottomLimit + tolerance &&
        maskEnd >= pageBottomPx - tolerance
      );
    });

    if (!hasTopRetention && bodyTopLimitOffset > tolerance) {
      reasons.push(
        `retenção superior (header) não cobre completamente a página ${pageIndex + 1}.`,
      );
    }

    if (!hasBottomRetention && bodyBottomLimitOffset > tolerance) {
      reasons.push(
        `retenção inferior (footer) não cobre completamente a página ${pageIndex + 1}.`,
      );
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function assertKnexWriterNonRegression(
  snapshot: KnexWriterNonRegressionSnapshot,
) {
  const report = evaluateKnexWriterNonRegression(snapshot);
  if (report.ok) return;

  throw new Error(
    [
      "[KnexWriter][NonRegressionGuard] Regressão detectada.",
      ...report.reasons.map((reason) => `- ${reason}`),
    ].join("\n"),
  );
}
