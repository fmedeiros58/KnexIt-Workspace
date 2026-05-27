export type RenderTaskToken = {
  pageNumber: number;
  renderVersion: number;
  cancelled: boolean;
};

export function createRenderTaskToken(pageNumber: number, renderVersion: number): RenderTaskToken {
  return {
    pageNumber,
    renderVersion,
    cancelled: false,
  };
}

export function cancelRenderTaskToken(token: RenderTaskToken) {
  token.cancelled = true;
}

export function isRenderTaskTokenCurrent(token: RenderTaskToken, renderVersion: number) {
  return !token.cancelled && token.renderVersion === renderVersion;
}
