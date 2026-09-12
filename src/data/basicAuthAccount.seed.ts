/**
 * The single fixed, feature-owned demo credential for GET /auth-test/basic — independent of Spec
 * 005's JWT demo accounts and the Spec 002 `users` resource (research.md Decision 4). Basic Auth
 * exists to prove the mechanism itself, not to demonstrate roles, so one account suffices. Static
 * seed data with no create/update/delete lifecycle — no backing store or reset().
 */
export const BASIC_AUTH_DEMO_ACCOUNT: { username: string; password: string } = {
  username: "demo.basic",
  password: "basic-pass-1",
};
