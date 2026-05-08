import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { FileExportGroup } from "./FileExportGroup";
import { FileNewGroup } from "./FileNewGroup";
import { FileOpenGroup } from "./FileOpenGroup";
import { FileRecentGroup } from "./FileRecentGroup";
import { FileSaveGroup } from "./FileSaveGroup";

export function FileRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <FileNewGroup />
      <FileOpenGroup />
      <FileSaveGroup />
      <FileExportGroup />
      <FileRecentGroup />
    </RibbonTabLayout>
  );
}
