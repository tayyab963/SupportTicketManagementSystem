export enum UserRole {
  Admin = 'Admin',
  SupportAgent = 'SupportAgent',
  Customer = 'Customer'
}

export enum TicketStatus {
  Open = 'Open',
  InProgress = 'InProgress',
  Resolved = 'Resolved',
  Closed = 'Closed'
}

export enum TicketPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export enum ActivityType {
  Created = 'Created',
  StatusChanged = 'StatusChanged',
  PriorityChanged = 'PriorityChanged',
  AssignmentChanged = 'AssignmentChanged',
  CommentAdded = 'CommentAdded',
  TimeLogged = 'TimeLogged',
  Closed = 'Closed'
}
