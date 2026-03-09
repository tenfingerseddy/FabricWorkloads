/**
 * TimelineNode — Individual event node in the Incident Timeline.
 * Shows item name, type, status, duration with a status-colored indicator.
 */
import React from "react";
import { Badge, Text, Tooltip } from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Warning20Filled,
  Clock20Regular,
  Subtract20Regular
} from "@fluentui/react-icons";

// ============================================================================
// Types
// ============================================================================

export interface TimelineEvent {
  eventId: string;
  itemName: string;
  itemType: string;
  status: string;
  startTimeUtc: string;
  endTimeUtc: string;
  durationSeconds: number;
  failureReason: string;
  workspaceName: string;
}

export interface TimelineLink {
  upstreamEventId: string;
  downstreamEventId: string;
  relationshipType: string;
  confidenceScore: number;
}

interface TimelineNodeProps {
  event: TimelineEvent;
  isSelected: boolean;
  onClick: (eventId: string) => void;
  position: "start" | "middle" | "end" | "single";
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "#107c10";
    case "failed":
      return "#d13438";
    case "inprogress":
    case "in progress":
      return "#ca5010";
    case "cancelled":
    case "skipped":
      return "#8a8886";
    default:
      return "#605e5c";
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return <CheckmarkCircle20Filled style={{ color: "#107c10" }} />;
    case "failed":
      return <ErrorCircle20Filled style={{ color: "#d13438" }} />;
    case "inprogress":
    case "in progress":
      return <Warning20Filled style={{ color: "#ca5010" }} />;
    default:
      return <Subtract20Regular style={{ color: "#8a8886" }} />;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// Component
// ============================================================================

const TimelineNode: React.FC<TimelineNodeProps> = ({
  event,
  isSelected,
  onClick,
  position
}) => {
  const statusColor = getStatusColor(event.status);

  const tooltipContent = (
    <div style={{ fontSize: 12 }}>
      <div><strong>{event.itemName}</strong></div>
      <div>Type: {event.itemType}</div>
      <div>Workspace: {event.workspaceName}</div>
      <div>Start: {event.startTimeUtc ? new Date(event.startTimeUtc).toLocaleString() : "—"}</div>
      <div>End: {event.endTimeUtc ? new Date(event.endTimeUtc).toLocaleString() : "—"}</div>
      <div>Duration: {formatDuration(event.durationSeconds)}</div>
      {event.failureReason && (
        <div style={{ color: "#d13438", marginTop: 4 }}>
          Error: {event.failureReason.substring(0, 150)}
        </div>
      )}
    </div>
  );

  return (
    <div className={`incident-timeline-node-wrapper incident-timeline-node-wrapper--${position}`}>
      {/* Connector line (left) */}
      {position !== "start" && position !== "single" && (
        <div className="incident-timeline-connector incident-timeline-connector--left" />
      )}

      {/* Node card */}
      <Tooltip content={tooltipContent} relationship="description" positioning="above">
        <div
          className={`incident-timeline-node ${isSelected ? "incident-timeline-node--selected" : ""}`}
          style={{ borderLeftColor: statusColor }}
          onClick={() => onClick(event.eventId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick(event.eventId);
            }
          }}
          aria-label={`${event.itemName} - ${event.status}`}
        >
          <div className="incident-timeline-node-header">
            {getStatusIcon(event.status)}
            <Text weight="semibold" size={200} truncate wrap={false}>
              {event.itemName}
            </Text>
          </div>
          <div className="incident-timeline-node-meta">
            <Badge appearance="outline" size="small" color="informative">
              {event.itemType}
            </Badge>
            <span className="incident-timeline-node-duration">
              <Clock20Regular style={{ fontSize: 12 }} />
              {formatDuration(event.durationSeconds)}
            </span>
          </div>
          <div className="incident-timeline-node-time">
            {formatTimestamp(event.startTimeUtc)}
          </div>
        </div>
      </Tooltip>

      {/* Connector line (right) */}
      {position !== "end" && position !== "single" && (
        <div className="incident-timeline-connector incident-timeline-connector--right" />
      )}
    </div>
  );
};

export default TimelineNode;
export { formatDuration, formatTimestamp, getStatusColor };
