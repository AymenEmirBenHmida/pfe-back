export interface TokenPayload {
  userId: string;
  role?: string; // Basic authorization info only
  type:string; // Token type
}