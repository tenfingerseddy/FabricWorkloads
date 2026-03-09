
/***
 * Interface representing the definition of a WorkbenchDashboard item.
 * This information is stored in Fabric as Item definition.
 * It will be returned once the item definition is loaded.
 */
export interface WorkbenchDashboardDefinition {
  workspaceIds?: string[];
  timeRange?: string;
  pinnedSLOs?: string[];
  filters?: Record<string, string>;
}
