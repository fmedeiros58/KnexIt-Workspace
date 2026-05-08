import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function StyleSetGroup() {
  return (
    <WriterRibbonGroup title="Conjunto de estilos">
      <RibbonCommandButton label="Estilos" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

