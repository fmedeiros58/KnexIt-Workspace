import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { InsertHeaderFooterGroup } from "./InsertHeaderFooterGroup";
import { InsertIllustrationsGroup } from "./InsertIllustrationsGroup";
import { InsertLinksGroup } from "./InsertLinksGroup";
import { InsertObjectsGroup } from "./InsertObjectsGroup";
import { InsertPagesGroup } from "./InsertPagesGroup";
import { InsertTablesGroup } from "./InsertTablesGroup";
import { InsertTextGroup } from "./InsertTextGroup";

export function InsertRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <InsertPagesGroup />
      <InsertTablesGroup />
      <InsertIllustrationsGroup />
      <InsertLinksGroup />
      <InsertHeaderFooterGroup />
      <InsertTextGroup />
      <InsertObjectsGroup />
    </RibbonTabLayout>
  );
}
