export type AuthUser = {
  sub: string;
  organizationId: string;
  username: string;
  displayName: string;
  roleCodes: string[];
  permissions: string[];
  dataScopes: string[];
  tokenVersion: number;
  mustChangePassword: boolean;
};
