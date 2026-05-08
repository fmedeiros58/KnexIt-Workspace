import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function PreviewResultsGroup() {
  return (
    <WriterRibbonGroup title="Visualizar">
      <RibbonCommandButton label="Visualizar resultados" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

