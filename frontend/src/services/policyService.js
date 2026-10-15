import { apiRequest } from "./apiClient";

export const POLICY_TYPES = [
  "PII", "FINANCIAL", "SECRET", "CONFIDENTIAL", "INFRASTRUCTURE",
  "INJECTION", "BULK_PII", "RAG_ACCESS", "ID_DOCUMENT",
];

export const POLICY_ACTIONS = ["ALLOW", "WARN", "MASK", "REDACT", "REQUIRE_APPROVAL", "BLOCK"];

export function getPolicies(token) {
  return apiRequest("/api/policies", { token });
}

export function createPolicy(token, policy) {
  return apiRequest("/api/policies", { method: "POST", token, body: policy });
}

export function updatePolicy(token, id, policy) {
  return apiRequest(`/api/policies/${id}`, { method: "PUT", token, body: policy });
}

export function setPolicyEnabled(token, id, enabled) {
  return apiRequest(`/api/policies/${id}/status`, { method: "PATCH", token, body: { enabled } });
}
