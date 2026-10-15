import { ShieldCheck, UserRound } from "lucide-react";

/** Landing page for a user's roles. */
export function homeFor(roles = []) {
  return roles.includes("ADMIN") || roles.includes("SECURITY_ANALYST") ? "/admin" : "/assistant";
}

/** The two role-based entry points (RBAC on the first page). */
export const PORTALS = {
  employee: {
    icon: UserRound,
    tone: "from-[#3b82f6] to-[#4f7cff]",
    name: "Employee workspace",
    title: "Sign in to use AI safely.",
    text: "Ask the department's AI assistant. ZeroTwo checks every message and every answer for you.",
    button: "Sign in to employee workspace",
    allowed: null, // every signed-in role may use the assistant
  },
  admin: {
    icon: ShieldCheck,
    tone: "from-[#7c3aed] to-[#a855f7]",
    name: "Administrator workspace",
    title: "Sign in to run security.",
    text: "Incidents, prompt log, policies, approvals and the audit trail. For administrators and security analysts only.",
    button: "Sign in to administrator workspace",
    allowed: ["ADMIN", "SECURITY_ANALYST"],
  },
};
