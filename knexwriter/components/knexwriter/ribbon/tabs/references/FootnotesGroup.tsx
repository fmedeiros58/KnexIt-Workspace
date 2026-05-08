import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FootnotesGroup() {
  return (
    <WriterRibbonGroup title="Notas">
      <RibbonCommandButton label="Nota de rodapé" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

