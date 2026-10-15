package com.cybercup.cybercup_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Calls the AI model that answers employees.
 * External: Google Gemini (primary model, then a fallback model).
 * Local: Ollama - used for SECRET material, or when Gemini is not configured / fails.
 */
@Service
public class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

    private final RestClient http;
    private final String geminiKey;
    private final String geminiModel;
    private final String geminiFallback;
    private final String ollamaUrl;
    private final String ollamaModel;

    public record Result(String text, String provider, long ms, String error) {
        public boolean ok() {
            return text != null && !text.isBlank();
        }
    }

    public LlmClient(@Value("${gemini.api-key:}") String geminiKey,
                     @Value("${gemini.model}") String geminiModel,
                     @Value("${gemini.fallback-model}") String geminiFallback,
                     @Value("${ollama.base-url}") String ollamaUrl,
                     @Value("${ollama.model}") String ollamaModel) {
        HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(Duration.ofSeconds(45));
        this.http = RestClient.builder().requestFactory(factory).build();
        this.geminiKey = geminiKey == null ? "" : geminiKey.trim();
        this.geminiModel = geminiModel;
        this.geminiFallback = geminiFallback;
        this.ollamaUrl = ollamaUrl;
        this.ollamaModel = ollamaModel;
    }

    public boolean geminiConfigured() {
        return !geminiKey.isBlank();
    }

    public String geminiModel() {
        return geminiModel;
    }

    /** @param externalAllowed false when the context contains material that must stay on-premises */
    public Result generate(String system, String user, boolean externalAllowed) {
        String lastError = null;
        if (externalAllowed && geminiConfigured()) {
            for (String model : List.of(geminiModel, geminiFallback)) {
                Result r = gemini(model, system, user);
                if (r.ok()) {
                    return r;
                }
                lastError = r.error();
            }
        }
        Result local = ollama(system, user);
        if (local.ok()) {
            return local;
        }
        String reason = !externalAllowed
                ? "restricted material may only be processed by the local model, which is not running"
                : (geminiConfigured() ? "external AI failed (" + lastError + ") and no local model is running"
                                      : "no AI provider configured");
        return new Result(null, "none", 0, reason);
    }

    @SuppressWarnings("unchecked")
    private Result gemini(String model, String system, String user) {
        long t = System.currentTimeMillis();
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", system))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", user)))),
                "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", 2048));
        try {
            Map<String, Object> res = http.post()
                    .uri("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent")
                    .header("x-goog-api-key", geminiKey)
                    .body(body)
                    .retrieve().body(MAP);
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) res.get("candidates");
            StringBuilder text = new StringBuilder();
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
                if (content != null && content.get("parts") instanceof List<?> parts) {
                    for (Object p : parts) {
                        Object txt = ((Map<String, Object>) p).get("text");
                        Object thought = ((Map<String, Object>) p).get("thought");
                        if (txt != null && !Boolean.TRUE.equals(thought)) {
                            text.append(txt);
                        }
                    }
                }
            }
            return new Result(text.toString().trim(), "gemini:" + model, System.currentTimeMillis() - t,
                    text.isEmpty() ? "empty answer" : null);
        } catch (RestClientException e) {
            // Never log the key or the prompt; the status line is enough.
            String msg = e.getMessage() == null ? e.getClass().getSimpleName()
                    : e.getMessage().split("\n")[0];
            log.warn("Gemini {} failed: {}", model, msg.length() > 160 ? msg.substring(0, 160) : msg);
            return new Result(null, "gemini:" + model, System.currentTimeMillis() - t, msg);
        }
    }

    @SuppressWarnings("unchecked")
    private Result ollama(String system, String user) {
        long t = System.currentTimeMillis();
        Map<String, Object> body = Map.of(
                "model", ollamaModel, "stream", false,
                "options", Map.of("temperature", 0.3),
                "messages", List.of(Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)));
        try {
            Map<String, Object> res = http.post().uri(ollamaUrl + "/api/chat").body(body).retrieve().body(MAP);
            Map<String, Object> message = (Map<String, Object>) res.get("message");
            String text = message == null ? null : String.valueOf(message.get("content")).trim();
            return new Result(text, "local:" + ollamaModel, System.currentTimeMillis() - t, null);
        } catch (RestClientException e) {
            return new Result(null, "local:" + ollamaModel, System.currentTimeMillis() - t, "local model unavailable");
        }
    }
}
