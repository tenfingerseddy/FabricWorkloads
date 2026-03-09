/**
 * Mock Fabric items for testing.
 */
import type { FabricItem } from "../../fabric-client.ts";

export const mockItems: Record<string, FabricItem[]> = {
  "ws-001": [
    {
      id: "item-pipeline-001",
      displayName: "ETL-Daily-Load",
      description: "Daily ETL pipeline",
      type: "DataPipeline",
      workspaceId: "ws-001",
    },
    {
      id: "item-notebook-001",
      displayName: "Transform-Sales-Data",
      description: "Sales data transformation notebook",
      type: "Notebook",
      workspaceId: "ws-001",
    },
    {
      id: "item-notebook-002",
      displayName: "Validate-Inventory",
      description: "Inventory validation notebook",
      type: "Notebook",
      workspaceId: "ws-001",
    },
    {
      id: "item-lakehouse-001",
      displayName: "Sales-Lakehouse",
      description: "Sales data lakehouse",
      type: "Lakehouse",
      workspaceId: "ws-001",
    },
    {
      id: "item-model-001",
      displayName: "Revenue-Model",
      description: "Revenue semantic model",
      type: "SemanticModel",
      workspaceId: "ws-001",
    },
    {
      id: "item-report-001",
      displayName: "Sales-Dashboard",
      description: "A Power BI report (not job-capable)",
      type: "Report",
      workspaceId: "ws-001",
    },
  ],
  "ws-002": [
    {
      id: "item-pipeline-002",
      displayName: "Dev-Pipeline",
      description: "Development pipeline",
      type: "DataPipeline",
      workspaceId: "ws-002",
    },
    {
      id: "item-notebook-003",
      displayName: "Experiment-Notebook",
      description: "ML experiment notebook",
      type: "Notebook",
      workspaceId: "ws-002",
    },
  ],
  "ws-003": [
    {
      id: "item-spark-001",
      displayName: "Spark-Aggregation",
      description: "Spark job for data aggregation",
      type: "SparkJobDefinition",
      workspaceId: "ws-003",
    },
    {
      id: "item-copyjob-001",
      displayName: "Copy-Raw-Data",
      description: "Copy job for raw data ingestion",
      type: "CopyJob",
      workspaceId: "ws-003",
    },
  ],
};

/** All items flattened into a single array */
export const allMockItems: FabricItem[] = Object.values(mockItems).flat();

/** Helper to get items for a workspace */
export function getItemsForWorkspace(workspaceId: string): FabricItem[] {
  return mockItems[workspaceId] ?? [];
}
