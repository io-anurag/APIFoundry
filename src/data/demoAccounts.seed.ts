import type { DemoAccount } from "../models/demoAccount";

/**
 * Fixed, feature-owned demo credentials — one per documented role — for POST /auth/login. Static
 * seed data with no create/update/delete lifecycle, so unlike the CRUD resources' seed files this
 * has no backing store or reset() (data-model.md).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: "demo.user",
    password: "user-pass-1",
    role: "user",
    scopes: ["products:read", "orders:read"],
  },
  {
    username: "demo.admin",
    password: "admin-pass-1",
    role: "admin",
    scopes: ["admin"],
  },
  {
    username: "demo.manager",
    password: "manager-pass-1",
    role: "manager",
    scopes: ["users:read", "products:read", "products:write", "orders:read", "orders:write"],
  },
  {
    username: "demo.readonly",
    password: "readonly-pass-1",
    role: "readonly",
    scopes: ["users:read", "products:read", "orders:read"],
  },
];

export function findDemoAccount(username: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.username === username);
}
