/**
 * IncidentTimeline — Cross-item correlation visualization.
 *
 * Shows upstream triggers and downstream impacts for a selected event,
 * with a horizontal timeline of correlated events linked by relationship type.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  Text
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowRight20Regular,
  ArrowCircleRight20Regular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Warning20Filled,
  Info20Regular,
  Dismiss20Regular,
  Clock20Regular,
  PlugConnected20Regular
} from "@fluentui/react-icons";
import TimelineNode, {
  TimelineEvent,
  TimelineLink,
  formatDuration,
  formatTimestamp
} from "./TimelineNode";
import "./IncidentTimeline.scss";

// ============================================================================
// Types
// ============================================================================

interface IncidentTimelineProps {
  /** The event ID to build the timeline around */
  selectedEventId: string;
  /** Item name for the header */
  selectedItemName: string;
  /** Callback to close the timeline view */
  onClose: () => void;
}

/** Combined chain of events with their correlation links */
interface CorrelationChain {
  upstream: TimelineEvent[];
  focal: TimelineEvent | null;
  downstream: TimelineEvent[];
  links: TimelineLink[];
}

// ============================================================================
// Sample data (used until live KQL is wired)
// ============================================================================

function getSampleChain(focalEventId: string, focalName: string): CorrelationChain {
  const now = new Date();
  const h = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600000).toISOString();

  return {
    upstream: [
      {
        eventId: "upstream-pipeline-001",
        itemName: "PL_DailyRefresh",
        itemType: "DataPipeline",
        status: "Completed",
        startTimeUtc: h(2.5),
        endTimeUtc: h(2.0),
        durationSeconds: 1800,
        failureReason: "",
        workspaceName: "FrameworkProduction"
      }
    ],
    focal: {
      eventId: focalEventId,
      itemName: focalName,
      itemType: "Notebook",
      status: "Failed",
      startTimeUtc: h(2.0),
      endTimeUtc: h(1.8),
      durationSeconds: 720,
      failureReason: "SparkException: Job aborted due to stage failure. Task timed out after 600 seconds.",
      workspaceName: "FrameworkProduction"
    },
    downstream: [
      {
        eventId: "downstream-notebook-001",
        itemName: "NB_TransformSales",
        itemType: "Notebook",
        status: "Completed",
        startTimeUtc: h(1.8),
        endTimeUtc: h(1.5),
        durationSeconds: 1080,
        failureReason: "",
        workspaceName: "FrameworkProduction"
      },
      {
        eventId: "downstream-refresh-001",
        itemName: "SM_SalesReport",
        itemType: "SemanticModel",
        status: "Failed",
        startTimeUtc: h(1.5),
        endTimeUtc: h(1.3),
        durationSeconds: 720,
        failureReason: "Refresh failed: upstream data not available. The data source returned an incomplete dataset.",
        workspaceName: "FrameworkProduction"
      }
    ],
    links: [
      {
        upstreamEventId: "upstream-pipeline-001",
        downstreamEventId: focalEventId,
        relationshipType: "activityRun",
        confidenceScore: 0.99
      },
      {
        upstreamEventId: focalEventId,
        downstreamEventId: "downstream-notebook-001",
        relationshipType: "timeWindow",
        confidenceScore: 0.7
      },
      {
        upstreamEventId: focalEventId,
        downstreamEventId: "downstream-refresh-001",
        relationshipType: "timeWindow",
        confidenceScore: 0.7
      }
    ]
  };
}

// ============================================================================
// Component
// ============================================================================

const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  selectedEventId,
  selectedItemName,
  onClose
}) => {
  const [chain, setChain] = useState<CorrelationChain | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(selectedEventId);

  // Fetch correlation chain
  useEffect(() => {
    let cancelled = false;

    async function fetchChain() {
      setIsLoading(true);
      setError(null);
      try {
        // TODO: Replace with kqlQueryService.getCorrelationChain(selectedEventId)
        // For now, use sample data
        await new Promise((r) => setTimeout(r, 400));
        if (!cancelled) {
          setChain(getSampleChain(selectedEventId, selectedItemName));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load correlation data";
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchChain();
    return () => { cancelled = true; };
  }, [selectedEventId, selectedItemName]);

  // All events in timeline order
  const allEvents = useMemo(() => {
    if (!chain) return [];
    const events: TimelineEvent[] = [];
    events.push(...chain.upstream);
    if (chain.focal) events.push(chain.focal);
    events.push(...chain.downstream);
    return events;
  }, [chain]);

  // Selected event detail
  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.eventId === selectedNodeId) ?? null,
    [allEvents, selectedNodeId]
  );

  // Get link between two events
  const getLinkForPair = useCallback(
    (upId: string, downId: string): TimelineLink | undefined => {
      return chain?.links.find(
        (l) => l.upstreamEventId === upId && l.downstreamEventId === downId
      );
    },
    [chain]
  );

  // Stats
  const stats = useMemo(() => {
    if (!chain) return { total: 0, failed: 0, succeeded: 0, impactDuration: 0 };
    const total = allEvents.length;
    const failed = allEvents.filter((e) => e.status.toLowerCase() === "failed").length;
    const succeeded = allEvents.filter((e) => e.status.toLowerCase() === "completed").length;
    const impactDuration = allEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
    return { total, failed, succeeded, impactDuration };
  }, [chain, allEvents]);

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="incident-timeline">
        <div className="incident-timeline-header">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={onClose}
          >
            Back to Dashboard
          </Button>
        </div>
        <div className="incident-timeline-loading">
          <Spinner size="medium" label="Building correlation chain..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="incident-timeline">
        <div className="incident-timeline-header">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={onClose}
          >
            Back to Dashboard
          </Button>
        </div>
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  if (!chain || allEvents.length === 0) {
    return (
      <div className="incident-timeline">
        <div className="incident-timeline-header">
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={onClose}
          >
            Back to Dashboard
          </Button>
        </div>
        <div className="incident-timeline-empty">
          <PlugConnected20Regular style={{ fontSize: 48, color: "#605e5c" }} />
          <Text size={400} weight="semibold">No correlations found</Text>
          <Text size={300} style={{ color: "#605e5c" }}>
            No upstream triggers or downstream impacts detected for this event.
            Correlations are built by the NB_ObsCorrelation notebook every 15 minutes.
          </Text>
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="incident-timeline">
      {/* Header */}
      <div className="incident-timeline-header">
        <Button
          appearance="subtle"
          icon={<ArrowLeft20Regular />}
          onClick={onClose}
        >
          Back to Dashboard
        </Button>
        <Text size={500} weight="bold">
          Incident Timeline: {selectedItemName}
        </Text>
      </div>

      {/* Summary stats */}
      <div className="incident-timeline-stats">
        <div className="incident-timeline-stat">
          <Text size={200} style={{ color: "#605e5c" }}>Events in Chain</Text>
          <Text size={500} weight="bold">{stats.total}</Text>
        </div>
        <div className="incident-timeline-stat">
          <Text size={200} style={{ color: "#605e5c" }}>Failed</Text>
          <Text size={500} weight="bold" style={{ color: "#d13438" }}>{stats.failed}</Text>
        </div>
        <div className="incident-timeline-stat">
          <Text size={200} style={{ color: "#605e5c" }}>Succeeded</Text>
          <Text size={500} weight="bold" style={{ color: "#107c10" }}>{stats.succeeded}</Text>
        </div>
        <div className="incident-timeline-stat">
          <Text size={200} style={{ color: "#605e5c" }}>Total Duration</Text>
          <Text size={500} weight="bold">{formatDuration(stats.impactDuration)}</Text>
        </div>
      </div>

      {/* Timeline track */}
      <div className="incident-timeline-track-container">
        {/* Section labels */}
        <div className="incident-timeline-sections">
          {chain.upstream.length > 0 && (
            <div className="incident-timeline-section-label incident-timeline-section-label--upstream">
              <ArrowRight20Regular />
              <Text size={200}>Upstream Triggers ({chain.upstream.length})</Text>
            </div>
          )}
          <div className="incident-timeline-section-label incident-timeline-section-label--focal">
            <ErrorCircle20Filled style={{ color: "#d13438" }} />
            <Text size={200}>Investigated Event</Text>
          </div>
          {chain.downstream.length > 0 && (
            <div className="incident-timeline-section-label incident-timeline-section-label--downstream">
              <ArrowCircleRight20Regular />
              <Text size={200}>Downstream Impact ({chain.downstream.length})</Text>
            </div>
          )}
        </div>

        {/* Timeline nodes */}
        <div className="incident-timeline-track" role="list" aria-label="Event correlation timeline">
          {allEvents.map((event, idx) => {
            const isFocal = event.eventId === selectedEventId;
            const position =
              allEvents.length === 1
                ? "single" as const
                : idx === 0
                  ? "start" as const
                  : idx === allEvents.length - 1
                    ? "end" as const
                    : "middle" as const;

            // Find link confidence between this and the next event
            const nextEvent = allEvents[idx + 1];
            const link = nextEvent ? getLinkForPair(event.eventId, nextEvent.eventId) : undefined;

            return (
              <React.Fragment key={event.eventId}>
                <div
                  className={`incident-timeline-node-slot ${isFocal ? "incident-timeline-node-slot--focal" : ""}`}
                  role="listitem"
                >
                  <TimelineNode
                    event={event}
                    isSelected={selectedNodeId === event.eventId}
                    onClick={setSelectedNodeId}
                    position={position}
                  />
                </div>

                {/* Connector with confidence label */}
                {nextEvent && (
                  <div className="incident-timeline-link">
                    <div className="incident-timeline-link-line" />
                    {link && (
                      <div className="incident-timeline-link-label">
                        <Badge
                          appearance="outline"
                          size="small"
                          color={link.confidenceScore >= 0.9 ? "success" : link.confidenceScore >= 0.7 ? "warning" : "informative"}
                        >
                          {link.relationshipType} ({Math.round(link.confidenceScore * 100)}%)
                        </Badge>
                      </div>
                    )}
                    <ArrowRight20Regular className="incident-timeline-link-arrow" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Event detail panel */}
      {selectedEvent && (
        <div className="incident-timeline-detail">
          <div className="incident-timeline-detail-header">
            <Text size={400} weight="semibold">
              {selectedEvent.itemName}
            </Text>
            <Badge
              appearance="filled"
              color={selectedEvent.status.toLowerCase() === "completed" ? "success" : selectedEvent.status.toLowerCase() === "failed" ? "danger" : "warning"}
            >
              {selectedEvent.status}
            </Badge>
          </div>

          <div className="incident-timeline-detail-grid">
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Item Type</Text>
              <Text>{selectedEvent.itemType}</Text>
            </div>
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Workspace</Text>
              <Text>{selectedEvent.workspaceName}</Text>
            </div>
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Start Time</Text>
              <Text>{selectedEvent.startTimeUtc ? new Date(selectedEvent.startTimeUtc).toLocaleString() : "—"}</Text>
            </div>
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>End Time</Text>
              <Text>{selectedEvent.endTimeUtc ? new Date(selectedEvent.endTimeUtc).toLocaleString() : "—"}</Text>
            </div>
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Duration</Text>
              <Text>{formatDuration(selectedEvent.durationSeconds)}</Text>
            </div>
            <div className="incident-timeline-detail-field">
              <Text size={200} style={{ color: "#605e5c" }}>Event ID</Text>
              <Text size={200} font="monospace">{selectedEvent.eventId}</Text>
            </div>
          </div>

          {selectedEvent.failureReason && (
            <div className="incident-timeline-detail-error">
              <Text size={200} weight="semibold" style={{ color: "#d13438" }}>
                Failure Reason
              </Text>
              <pre className="incident-timeline-detail-error-text">
                {selectedEvent.failureReason}
              </pre>
            </div>
          )}

          {/* Show links involving this event */}
          {chain.links.filter(
            (l) => l.upstreamEventId === selectedEvent.eventId || l.downstreamEventId === selectedEvent.eventId
          ).length > 0 && (
            <div className="incident-timeline-detail-links">
              <Text size={200} weight="semibold">Correlation Links</Text>
              {chain.links
                .filter((l) => l.upstreamEventId === selectedEvent.eventId || l.downstreamEventId === selectedEvent.eventId)
                .map((link, idx) => {
                  const isUpstream = link.downstreamEventId === selectedEvent.eventId;
                  const otherEvent = allEvents.find(
                    (e) => e.eventId === (isUpstream ? link.upstreamEventId : link.downstreamEventId)
                  );
                  return (
                    <div key={idx} className="incident-timeline-detail-link-row">
                      <Badge appearance="outline" size="small">
                        {isUpstream ? "triggered by" : "triggers"}
                      </Badge>
                      <Text size={200}>{otherEvent?.itemName ?? "Unknown"}</Text>
                      <Badge
                        appearance="outline"
                        size="small"
                        color={link.confidenceScore >= 0.9 ? "success" : "warning"}
                      >
                        {link.relationshipType} ({Math.round(link.confidenceScore * 100)}%)
                      </Badge>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
