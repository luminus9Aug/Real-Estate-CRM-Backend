export interface AuthEmailJobPayload {
  email: string;
  name: string;
  otp: string;
  expiresInMinutes: number;
}
