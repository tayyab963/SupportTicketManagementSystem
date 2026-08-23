import { UserRole } from './enums';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  expiresAtUtc: string;
  user: CurrentUser;
}
