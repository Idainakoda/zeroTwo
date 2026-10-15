/** Landing page for a user's roles. */
export function homeFor(roles = []) {
  return roles.includes("ADMIN") || roles.includes("SECURITY_ANALYST") ? "/admin" : "/assistant";
}
