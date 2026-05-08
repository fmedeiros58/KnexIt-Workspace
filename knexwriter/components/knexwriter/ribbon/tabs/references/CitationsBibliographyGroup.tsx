import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function CitationsBibliographyGroup() {
  return (
    <WriterRibbonGroup title="Citações">
      <RibbonCommandButton label="Citação" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

