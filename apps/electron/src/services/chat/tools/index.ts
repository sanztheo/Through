import { ToolContext } from "./types.js";
import { createFileReadTools } from "./FileReadTools.js";
import { createSearchTools } from "./SearchTools.js";
import { createFileStructureTools } from "./FileStructureTools.js";
import { createFileWriteTools } from "./FileWriteTools.js";
import { createFileManagementTools } from "./FileManagementTools.js";
import { createProjectInfoTools } from "./ProjectInfoTools.js";

export function createTools(context: ToolContext) {
  return {
    ...createFileReadTools(context),
    ...createSearchTools(context),
    ...createFileStructureTools(context),
    ...createFileWriteTools(context),
    ...createFileManagementTools(context),
    ...createProjectInfoTools(context),
  };
}
