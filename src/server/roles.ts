// Role helpers. No database imports here, so it is safe to use in middleware and client code.
export const ROLES = ["user", "viewer", "mod", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];
const level: Record<Role, number> = { user: 0, viewer: 1, mod: 2, admin: 3, owner: 4 };

export const isRole = (v: unknown): v is Role => typeof v === "string" && v in level;
export const hasRole = (role: Role | undefined, min: Role) => !!role && level[role] >= level[min];
export const isStaff = (role: Role | undefined) => hasRole(role, "viewer");
