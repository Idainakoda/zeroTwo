import { apiRequest } from "./apiClient";

export function getDashboardStats(token, days = 7) {
  return apiRequest(`/api/dashboard/stats?days=${days}`, { token });
}

export function getPromptLog(token) {
  return apiRequest("/api/dashboard/prompts", { token });
}

export function getIncidents(token) {
  return apiRequest("/api/incidents", { token });
}

export function getApprovals(token) {
  return apiRequest("/api/approvals", { token });
}

export function approveRequest(token, id, note) {
  return apiRequest(`/api/approvals/${id}/approve`, { method: "POST", token, body: { note } });
}

export function rejectRequest(token, id, note) {
  return apiRequest(`/api/approvals/${id}/reject`, { method: "POST", token, body: { note } });
}

export function getAuditLogs(token) {
  return apiRequest("/api/audit-logs", { token });
}

export function verifyAuditChain(token) {
  return apiRequest("/api/audit-logs/verify", { token });
}

export function getUsers(token) {
  return apiRequest("/api/users", { token });
}

export function updateUser(token, id, changes) {
  return apiRequest(`/api/users/${id}`, { method: "PATCH", token, body: changes });
}

export function runEvaluation(token) {
  return apiRequest("/api/dashboard/evaluation", { method: "POST", token });
}

export function runBlindEvaluation(token) {
  return apiRequest("/api/dashboard/evaluation/blind", { method: "POST", token });
}
