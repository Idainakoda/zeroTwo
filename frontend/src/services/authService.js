
import { apiRequest } from "./apiClient";

export function loginUser(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function registerUser(fullName, email, password) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: { fullName, email, password },
  });
}

export function getCurrentUser(token) {
  return apiRequest("/api/auth/me", {
    method: "GET",
    token,
  });
}
