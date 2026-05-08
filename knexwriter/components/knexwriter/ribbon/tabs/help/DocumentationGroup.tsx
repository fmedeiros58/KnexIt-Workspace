import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function DocumentationGroup() {
  return (
    <WriterRibbonGroup title="Documentação">
      <RibbonCommandButton label="Documentação" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

