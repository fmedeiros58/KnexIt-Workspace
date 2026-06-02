"use client";

import type { KnexPdfPageLinkAnnotation as PdfPageLinkAnnotation } from "../knex-pdf-engine";

export function PdfAnnotationLayer({
  links = [],
  onClickLink,
}: {
  links?: PdfPageLinkAnnotation[];
  onClickLink?: (link: PdfPageLinkAnnotation) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          className="pointer-events-auto absolute rounded-sm outline-none hover:bg-blue-300/20 focus-visible:bg-blue-300/25 focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            left: `${link.x}px`,
            top: `${link.y}px`,
            width: `${link.width}px`,
            height: `${link.height}px`,
          }}
          title={link.url ?? "Link interno do PDF"}
          onClick={(event) => {
            event.stopPropagation();
            onClickLink?.(link);
          }}
        />
      ))}
    </div>
  );
}
