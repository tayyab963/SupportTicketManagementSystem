import { ActivityType, TicketStatus } from './enums';
import { ActivityItem, describeActivity, formatDuration, getValidNextStatuses } from './ticket.model';

describe('getValidNextStatuses', () => {
  it('allows Open -> InProgress only', () => {
    expect(getValidNextStatuses(TicketStatus.Open)).toEqual([TicketStatus.InProgress]);
  });

  it('allows InProgress -> Resolved or back to Open', () => {
    expect(getValidNextStatuses(TicketStatus.InProgress)).toEqual([TicketStatus.Resolved, TicketStatus.Open]);
  });

  it('allows Resolved -> Closed or back to InProgress', () => {
    expect(getValidNextStatuses(TicketStatus.Resolved)).toEqual([TicketStatus.Closed, TicketStatus.InProgress]);
  });

  it('treats Closed as a terminal state', () => {
    expect(getValidNextStatuses(TicketStatus.Closed)).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('renders minutes only when under an hour', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('renders hours only on an exact hour', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('renders hours and minutes together', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('renders zero minutes as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});

describe('describeActivity', () => {
  function activity(overrides: Partial<ActivityItem>): ActivityItem {
    return {
      id: 'activity-1',
      activityType: ActivityType.Created,
      description: 'Created',
      userId: 'user-1',
      userName: 'Alice Admin',
      oldValue: null,
      newValue: null,
      createdAt: '2026-08-24T00:00:00Z',
      ...overrides
    };
  }

  it('describes ticket creation', () => {
    expect(describeActivity(activity({ activityType: ActivityType.Created }))).toBe('Ticket created');
  });

  it('describes a status change', () => {
    const result = describeActivity(
      activity({ activityType: ActivityType.StatusChanged, oldValue: 'Open', newValue: 'InProgress' })
    );
    expect(result).toBe('Status changed from Open to InProgress');
  });

  it('describes a priority change', () => {
    const result = describeActivity(
      activity({ activityType: ActivityType.PriorityChanged, oldValue: 'Medium', newValue: 'High' })
    );
    expect(result).toBe('Priority changed from Medium to High');
  });

  it('describes an assignment to an agent by name', () => {
    const result = describeActivity(
      activity({ activityType: ActivityType.AssignmentChanged, oldValue: 'Unassigned', newValue: 'John Agent' })
    );
    expect(result).toBe('Assigned to John Agent');
  });

  it('describes an unassignment', () => {
    const result = describeActivity(
      activity({ activityType: ActivityType.AssignmentChanged, oldValue: 'John Agent', newValue: 'Unassigned' })
    );
    expect(result).toBe('Unassigned (was John Agent)');
  });

  it('describes a comment being added', () => {
    expect(describeActivity(activity({ activityType: ActivityType.CommentAdded }))).toBe('Comment added');
  });

  it('describes logged time using formatDuration', () => {
    const result = describeActivity(activity({ activityType: ActivityType.TimeLogged, newValue: '90' }));
    expect(result).toBe('1h 30m logged');
  });

  it('describes closing', () => {
    expect(describeActivity(activity({ activityType: ActivityType.Closed }))).toBe('Ticket closed');
  });
});
