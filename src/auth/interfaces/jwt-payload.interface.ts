export interface JwtPayload {
  sub: string;   // User UUID
  email: string; // User email (for logging/debugging)
}
