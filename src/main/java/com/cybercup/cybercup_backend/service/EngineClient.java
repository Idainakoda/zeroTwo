package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Client for the FastAPI security engine. Every call fails CLOSED: if the engine is
 * unreachable the caller gets an exception and the request is blocked, never forwarded.
 */
@Service
public class EngineClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {};

    private final RestClient client;
    private final RestClient slowClient;

    public EngineClient(@Value("${ai.engine.base-url}") String baseUrl,
                        @Value("${ai.engine.api-key:}") String apiKey) {
        this.client = build(baseUrl, apiKey, Duration.ofSeconds(60));
        this.slowClient = build(baseUrl, apiKey, Duration.ofMinutes(10));   // evaluation runs
    }

    private static RestClient build(String baseUrl, String apiKey, Duration readTimeout) {
        HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(readTimeout);
        RestClient.Builder builder = RestClient.builder().baseUrl(baseUrl).requestFactory(factory);
        if (apiKey != null && !apiKey.isBlank()) {
            builder.defaultHeader("X-Engine-Key", apiKey);
        }
        return builder.build();
    }

    public static Map<String, Object> userContext(User user) {
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("user_id", String.valueOf(user.getId()));
        ctx.put("role", user.getRoles().stream().map(r -> r.getName()).sorted().findFirst().orElse("EMPLOYEE"));
        ctx.put("department", user.getDepartment());
        ctx.put("clearance", user.getClearance());
        return ctx;
    }

    public Map<String, Object> analyzePrompt(String prompt, User user) {
        return post("/v1/analyze/prompt", Map.of("prompt", prompt, "user", userContext(user)));
    }

    public Map<String, Object> analyzeResponse(String requestId, String response, User user, boolean rehydrate) {
        return post("/v1/analyze/response", Map.of("request_id", requestId, "response", response,
                "user", userContext(user), "rehydrate", rehydrate));
    }

    public Map<String, Object> analyzeDocument(List<String> chunks, String source) {
        return post("/v1/analyze/document", Map.of("chunks", chunks, "source", source));
    }

    public Map<String, Object> ragSearch(String query, User user) {
        return post("/v1/rag/search", Map.of("query", query, "user", userContext(user), "top_k", 4));
    }

    public List<Map<String, Object>> documents(String clearance, String department) {
        try {
            return client.get()
                    .uri(b -> {
                        b.path("/v1/rag/documents");
                        if (clearance != null) {
                            b.queryParam("clearance", clearance).queryParam("department", department);
                        }
                        return b.build();
                    })
                    .retrieve().body(LIST);
        } catch (RestClientException e) {
            throw new EngineUnavailableException(e);
        }
    }

    public Map<String, Object> health() {
        try {
            return client.get().uri("/health").retrieve().body(MAP);
        } catch (RestClientException e) {
            return Map.of("status", "unreachable");
        }
    }

    public Map<String, Object> runEvaluation() {
        return post(slowClient, "/v1/eval/run", Map.of());
    }

    public Map<String, Object> runBlindEvaluation() {
        return post(slowClient, "/v1/eval/blind", Map.of());
    }

    private Map<String, Object> post(String path, Object body) {
        return post(client, path, body);
    }

    private Map<String, Object> post(RestClient c, String path, Object body) {
        try {
            return c.post().uri(path).body(body).retrieve().body(MAP);
        } catch (RestClientException e) {
            throw new EngineUnavailableException(e);
        }
    }

    public static class EngineUnavailableException extends RuntimeException {
        public EngineUnavailableException(Throwable cause) {
            super("Security engine is unavailable. The request was blocked (fail-closed).", cause);
        }
    }
}
