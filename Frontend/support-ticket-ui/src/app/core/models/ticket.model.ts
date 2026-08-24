import { ActivityType, TicketPriority, TicketStatus, UserRole } from './enums';

export interface TicketListItem {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  customerId: string;
  customerName: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  commentText: string;
  createdAt: string;
}

export interface TimeEntryItem {
  id: string;
  userId: string;
  userName: string;
  workDate: string;
  durationMinutes: number;
  description: string;
  createdAt: string;
}

export interface TicketDetail extends TicketListItem {
  description: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  comments: CommentItem[];
  /** Null for Customer callers — internal work logs are not exposed to customers. */
  timeEntries: TimeEntryItem[] | null;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: TicketPriority;
}

export interface UpdateTicketRequest {
  title: string;
  description: string;
}

export interface ChangeTicketStatusRequest {
  status: TicketStatus;
}

export interface ChangeTicketPriorityRequest {
  priority: TicketPriority;
}

export interface AssignTicketRequest {
  agentId: string | null;
}

export interface CreateCommentRequest {
  commentText: string;
}

export interface CreateTimeEntryRequest {
  workDate: string;
  durationMinutes: number;
  description: string;
}

export interface ActivityItem {
  id: string;
  activityType: ActivityType;
  description: string;
  userId: string;
  userName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TimeEntrySummary {
  entries: TimeEntryItem[];
  totalDurationMinutes: number;
}

/** "1h 30m" / "45m" / "2h" — used for both individual time-logged activities and the running total. */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/** Renders a raw ActivityDto into the human-readable line shown on the activity timeline. */
export function describeActivity(activity: ActivityItem): string {
  switch (activity.activityType) {
    case ActivityType.Created:
      return 'Ticket created';
    case ActivityType.StatusChanged:
      return `Status changed from ${activity.oldValue} to ${activity.newValue}`;
    case ActivityType.PriorityChanged:
      return `Priority changed from ${activity.oldValue} to ${activity.newValue}`;
    case ActivityType.AssignmentChanged:
      return activity.newValue === 'Unassigned'
        ? `Unassigned${activity.oldValue && activity.oldValue !== 'Unassigned' ? ` (was ${activity.oldValue})` : ''}`
        : `Assigned to ${activity.newValue}`;
    case ActivityType.CommentAdded:
      return 'Comment added';
    case ActivityType.TimeLogged:
      return `${formatDuration(Number(activity.newValue))} logged`;
    case ActivityType.Closed:
      return 'Ticket closed';
    default:
      return activity.description;
  }
}

export function activityIcon(type: ActivityType): string {
  switch (type) {
    case ActivityType.Created:
      return 'add_circle';
    case ActivityType.StatusChanged:
      return 'sync_alt';
    case ActivityType.PriorityChanged:
      return 'flag';
    case ActivityType.AssignmentChanged:
      return 'person';
    case ActivityType.CommentAdded:
      return 'comment';
    case ActivityType.TimeLogged:
      return 'schedule';
    case ActivityType.Closed:
      return 'check_circle';
    default:
      return 'circle';
  }
}

export type TicketSortBy = 'CreatedAt' | 'UpdatedAt' | 'Priority' | 'Status';

export interface TicketQueryParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedAgentId?: string;
  unassigned?: boolean;
  customerId?: string;
  sortBy?: TicketSortBy;
  sortDescending?: boolean;
}

/**
 * Which of a ticket's four statuses could plausibly come next, purely for populating the status
 * dropdown with sensible options. This is a UX convenience only — the backend
 * (TicketStatusTransitionRules + TicketService.EnsureCallerCanChangeStatus) is the sole authority on
 * whether a transition is actually legal and permitted for the caller's role, and re-validates every
 * request regardless of what this function suggested.
 */
export function getValidNextStatuses(current: TicketStatus): TicketStatus[] {
  switch (current) {
    case TicketStatus.Open:
      return [TicketStatus.InProgress];
    case TicketStatus.InProgress:
      return [TicketStatus.Resolved, TicketStatus.Open];
    case TicketStatus.Resolved:
      return [TicketStatus.Closed, TicketStatus.InProgress];
    case TicketStatus.Closed:
      return [];
  }
}
