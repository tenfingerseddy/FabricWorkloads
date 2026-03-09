/**
 * Mock workspace responses for testing.
 */
import type { FabricWorkspace } from "../../fabric-client.ts";
import type { WorkspaceSnapshot } from "../../collector.ts";

export const mockWorkspaces: FabricWorkspace[] = [
  {
    id: "ws-001",
    displayName: "Analytics-Production",
    description: "Production analytics workspace",
    type: "Workspace",
    state: "Active",
    capacityId: "cap-001",
  },
  {
    id: "ws-002",
    displayName: "Analytics-Development",
    description: "Development workspace for analytics team",
    type: "Workspace",
    state: "Active",
    capacityId: "cap-002",
  },
  {
    id: "ws-003",
    displayName: "Data-Engineering",
    description: "Data engineering workspace",
    type: "Workspace",
    state: "Active",
    capacityId: "cap-001",
  },
];

export function buildWorkspaceSnapshot(
  workspace: FabricWorkspace,
  items: import("../../fabric-client.ts").FabricItem[] = []
): WorkspaceSnapshot {
  return {
    workspace,
    items,
    collectedAt: "2026-03-09T10:00:00.000Z",
  };
}
