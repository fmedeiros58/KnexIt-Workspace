import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function CommentsGroup() {
  return (
    <WriterRibbonGroup title="Comentários">
      <RibbonCommandButton label="Novo comentário" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

