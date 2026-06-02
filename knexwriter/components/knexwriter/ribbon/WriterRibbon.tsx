import type { WriterRibbonProps } from "../shell/KnexWriterShell";
import { DesignRibbonTab } from "./tabs/design/DesignRibbonTab";
import { FileRibbonTab } from "./tabs/file/FileRibbonTab";
import { HelpRibbonTab } from "./tabs/help/HelpRibbonTab";
import { HomeRibbonTab } from "./tabs/home/HomeRibbonTab";
import { InsertRibbonTab } from "./tabs/insert/InsertRibbonTab";
import { LayoutRibbonTab } from "./tabs/layout/LayoutRibbonTab";
import { MailingsRibbonTab } from "./tabs/mailings/MailingsRibbonTab";
import { KnexreadPdfRibbonTab } from "./tabs/knexread/KnexreadPdfRibbonTab";
import { ReferencesRibbonTab } from "./tabs/references/ReferencesRibbonTab";
import { ReviewRibbonTab } from "./tabs/review/ReviewRibbonTab";
import { ViewRibbonTab } from "./tabs/view/ViewRibbonTab";

export function WriterRibbon(props: WriterRibbonProps) {
  const { state } = props;

  switch (state.activeHeaderTab) {
    case "file":
      return <FileRibbonTab {...props} />;
    case "home":
      return <HomeRibbonTab {...props} />;
    case "insert":
      return <InsertRibbonTab {...props} />;
    case "design":
      return <DesignRibbonTab {...props} />;
    case "layout":
      return <LayoutRibbonTab {...props} />;
    case "references":
      return <ReferencesRibbonTab {...props} />;
    case "mailings":
      return <MailingsRibbonTab {...props} />;
    case "review":
      return <ReviewRibbonTab {...props} />;
    case "view":
      return <ViewRibbonTab {...props} />;
    case "knexreadPdf":
      return <KnexreadPdfRibbonTab {...props} />;
    case "help":
      return <HelpRibbonTab {...props} />;
    default:
      return <HomeRibbonTab {...props} />;
  }
}


