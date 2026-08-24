import { TicketStatus } from './enums';
import { getValidNextStatuses } from './ticket.model';

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
