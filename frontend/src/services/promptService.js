import { apiRequest } from "./apiClient";

/** Full gateway: inspection -> policy -> documents -> AI model -> response inspection. */
export function sendPrompt(token, { prompt, useDocuments, attachment }) {
  return apiRequest("/api/gateway/chat", {
    method: "POST",
    token,
    body: { prompt, useDocuments, attachment: attachment || null },
  });
}

/** Inspection only (nothing is sent to the AI model). */
export function inspectPrompt(token, prompt) {
  return apiRequest("/api/gateway/inspect", {
    method: "POST",
    token,
    body: { prompt },
  });
}

export function getMyHistory(token) {
  return apiRequest("/api/gateway/history", { token });
}

export function getGatewayStatus(token) {
  return apiRequest("/api/gateway/status", { token });
}

export function getMyDocuments(token) {
  return apiRequest("/api/documents", { token });
}

export function getMyApprovals(token) {
  return apiRequest("/api/approvals/my", { token });
}

export function getMyIncidents(token) {
  return apiRequest("/api/incidents/my", { token });
}
