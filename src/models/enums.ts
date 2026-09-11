export const USER_ROLES = ["user", "admin", "manager", "readonly"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRODUCT_CATEGORIES = [
  "electronics",
  "books",
  "clothing",
  "home",
  "toys",
  "grocery",
  "sports",
  "beauty",
  "automotive",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
