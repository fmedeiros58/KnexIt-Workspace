import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { ChangesGroup } from "./ChangesGroup";
import { CommentsGroup } from "./CommentsGroup";
import { CompareGroup } from "./CompareGroup";
import { ProofingGroup } from "./ProofingGroup";
import { ReviewToolsGroup } from "./ReviewToolsGroup";
import { TrackingGroup } from "./TrackingGroup";

export function ReviewRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <ProofingGroup />
      <CommentsGroup />
      <TrackingGroup />
      <ChangesGroup />
      <CompareGroup />
      <ReviewToolsGroup />
    </RibbonTabLayout>
  );
}
