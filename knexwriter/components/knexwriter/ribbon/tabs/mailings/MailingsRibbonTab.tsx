import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { CreateMailingsGroup } from "./CreateMailingsGroup";
import { FinishMailingsGroup } from "./FinishMailingsGroup";
import { PreviewResultsGroup } from "./PreviewResultsGroup";
import { StartMailMergeGroup } from "./StartMailMergeGroup";
import { WriteInsertFieldsGroup } from "./WriteInsertFieldsGroup";

export function MailingsRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <CreateMailingsGroup />
      <StartMailMergeGroup />
      <WriteInsertFieldsGroup />
      <PreviewResultsGroup />
      <FinishMailingsGroup />
    </RibbonTabLayout>
  );
}
