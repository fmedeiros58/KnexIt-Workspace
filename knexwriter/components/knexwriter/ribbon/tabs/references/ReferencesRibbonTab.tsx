import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { CaptionsGroup } from "./CaptionsGroup";
import { CitationsBibliographyGroup } from "./CitationsBibliographyGroup";
import { FootnotesGroup } from "./FootnotesGroup";
import { IndexGroup } from "./IndexGroup";
import { TableOfContentsGroup } from "./TableOfContentsGroup";

export function ReferencesRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <TableOfContentsGroup />
      <FootnotesGroup />
      <CitationsBibliographyGroup />
      <CaptionsGroup />
      <IndexGroup />
    </RibbonTabLayout>
  );
}
