export interface AgentWorkload {
  agentId: string;
  agentName: string;
  totalAssigned: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface DashboardSummary {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  criticalTickets: number;
  lowPriorityTickets: number;
  mediumPriorityTickets: number;
  highPriorityTickets: number;
  averageResolutionMinutes: number;
  agentWorkload: AgentWorkload[];
}
