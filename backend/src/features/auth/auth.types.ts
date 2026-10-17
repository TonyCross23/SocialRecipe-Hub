export interface PublicUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  dob: string;
  role: string;
  permissions: string[];
  status: 'ACTIVE' | 'BANNED';
  bannedReason: string | null;
  createdAt: Date;
}

export interface AuthenticatedUser {
  profile: PublicUser;
  passwordHash: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  image?: string | null;
  dob: string;
}

export interface TokenClaims {
  userId: string;
  sessionId: string;
  tokenId: string;
}

export interface TokenRecord {
  id: string;
  tokenHash: string;
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

export type RotationResult = 'rotated' | 'invalid' | 'reused';

export interface AuthRepository {
  updateProfile(
    userId: string,
    input: { name: string; dob: string; image: string | null },
  ): Promise<PublicUser>;
  createMember(
    input: Omit<RegisterInput, 'password'> & { passwordHash: string },
  ): Promise<PublicUser>;
  changePassword(
    userId: string,
    previousHash: string,
    nextHash: string,
    now: Date,
  ): Promise<boolean>;
  findByEmail(email: string): Promise<AuthenticatedUser | null>;
  getProfile(userId: string): Promise<PublicUser | null>;
  createSession(session: SessionRecord, token: TokenRecord): Promise<void>;
  getActiveSession(sessionId: string, userId: string, now: Date): Promise<SessionRecord | null>;
  rotateToken(current: TokenRecord, next: TokenRecord, now: Date): Promise<RotationResult>;
  revokeSession(sessionId: string, userId: string, now: Date): Promise<void>;
}

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  dummyVerify(password: string): Promise<void>;
}

export interface TokenService {
  issueAccess(claims: TokenClaims): Promise<string>;
  issueRefresh(claims: TokenClaims, expiresAt: Date): Promise<string>;
  verifyAccess(token: string): Promise<TokenClaims>;
  verifyRefresh(token: string): Promise<TokenClaims & { expiresAt: Date }>;
  digest(token: string): string;
}
