export type Role = "operator_admin" | "operator_staff" | "lender_viewer";

export const ROLE_LABEL: Record<Role, string> = {
  operator_admin: "Operator admin",
  operator_staff: "Operator staff",
  lender_viewer: "Lender viewer",
};
