import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function StartMailMergeGroup() {
  return (
    <WriterRibbonGroup title="Iniciar mala direta">
      <RibbonCommandButton label="Mala direta" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

