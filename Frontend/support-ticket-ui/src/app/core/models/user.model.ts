import { UserRole } from './enums';

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}
