const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const UNAUTHORIZED_EVENT = "zerotwo:unauthorized";

export async function apiRequest(
  endpoint,
  { method = "GET", body, token, headers = {} } = {}
) {
  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Cannot connect to the ZeroTwo backend. Check that the server is running."
    );
  }

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  // Expired or invalid session: let the auth context sign the user out.
  if (response.status === 401 && token) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? data.message || data.error
        : null;

    throw new Error(
      message || `Request failed with status ${response.status}`
    );
  }

  return data;
}
