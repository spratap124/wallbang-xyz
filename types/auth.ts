export type AuthUser = {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
};

export type SessionPayload = {
  sub: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
};
