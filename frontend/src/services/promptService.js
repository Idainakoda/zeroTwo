import { apiRequest } from "./apiClient";

/** Full gateway: inspection -> policy -> documents -> AI model -> response inspection. */
export function sendPrompt(token, { prompt, useDocuments, attachment }) {
  return apiRequest("/api/gateway/chat", {
    method: "POST",
    token,
    body: { prompt, useDocuments, attachment: attachment || null },
  });
}

/** Reads an attachment (PDF, Word, picture via OCR, text) and recognises ID documents. Nothing is stored. */
export function extractAttachment(token, file) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest("/api/gateway/extract", { method: "POST", token, body: form });
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
