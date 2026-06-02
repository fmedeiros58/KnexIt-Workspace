import { FileText } from "lucide-react";
import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

function openKnexreadPage() {
  if (typeof window === "undefined") return;
  window.location.assign("/knexread/web");
}

export function KnexreadPdfRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <WriterRibbonGroup title="Knexread PDF">
        <RibbonCommandButton
          label="Abrir Knexread"
          tooltip="Abrir leitor PDF nativo do KnexWriter"
          icon={FileText}
          onClick={openKnexreadPage}
        />
      </WriterRibbonGroup>
    </RibbonTabLayout>
  );
}

