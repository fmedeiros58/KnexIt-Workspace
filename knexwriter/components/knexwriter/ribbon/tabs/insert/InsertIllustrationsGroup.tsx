import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertIllustrationsGroup() {
  return (
    <WriterRibbonGroup title="Ilustrações">
      <RibbonCommandButton label="Imagem" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

