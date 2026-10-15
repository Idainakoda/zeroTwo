package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.dto.ChatRequest;
import com.cybercup.cybercup_backend.entity.GatewayEvent;
import com.cybercup.cybercup_backend.entity.User;
import com.cybercup.cybercup_backend.repository.GatewayEventRepository;
import com.cybercup.cybercup_backend.service.EngineClient;
import com.cybercup.cybercup_backend.service.GatewayService;
import com.cybercup.cybercup_backend.service.LlmClient;
import com.cybercup.cybercup_backend.web.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class GatewayController {

    private final GatewayService gateway;
    private final EngineClient engine;
    private final LlmClient llm;
    private final GatewayEventRepository events;

    public GatewayController(GatewayService gateway, EngineClient engine, LlmClient llm, GatewayEventRepository events) {
        this.gateway = gateway;
        this.engine = engine;
        this.llm = llm;
        this.events = events;
    }

    /** Full gateway: inspect -> policy -> retrieval -> AI model -> response inspection. */
    @PostMapping("/gateway/chat")
    public Map<String, Object> chat(@Valid @RequestBody ChatRequest request, Authentication auth) {
        return gateway.chat(CurrentUser.id(auth), request.prompt(), request.useDocuments(), request.attachment(), true);
    }

    /**
     * Reads an attachment before it is sent: text from PDFs, Word files and pictures (OCR), and which
     * standard documents it looks like (Aadhaar card, PAN card...). Nothing is stored or sent to the AI;
     * the text is fully inspected again when it is attached to a prompt.
     */
    @PostMapping(value = "/gateway/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> extract(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("The file is empty.");
        }
        Map<String, Object> r = engine.extract(file.getOriginalFilename(), file.getBytes());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", r.get("filename"));
        out.put("kind", r.get("kind"));
        out.put("text", r.get("text"));
        out.put("chars", r.get("chars"));
        out.put("pages", r.get("pages"));
        out.put("ocrImages", r.get("ocr_images"));
        out.put("ocrMs", r.get("ocr_ms"));
        out.put("truncated", r.get("truncated"));
        out.put("warnings", r.get("warnings"));
        out.put("documentTypes", r.get("document_types"));
        return out;
    }

    /** The signed-in user's own history (metadata only, no prompt text). */
    @GetMapping("/gateway/history")
    public List<GatewayEvent> history(Authentication auth) {
        return events.findByUserIdOrderByCreatedAtDesc(CurrentUser.id(auth));
    }

    /** Health of the engine and the AI providers, for the status indicators in the UI. */
    @GetMapping("/gateway/status")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("engine", engine.health());
        out.put("gemini", Map.of("configured", llm.geminiConfigured(), "model", llm.geminiModel()));
        return out;
    }

    /** Documents in the knowledge base, with whether the signed-in user may access each one. */
    @GetMapping("/documents")
    public Map<String, Object> documents(Authentication auth) {
        User user = gateway.loadUser(CurrentUser.id(auth));
        // Titles of documents the user may not access are withheld (the title itself can be sensitive).
        List<Map<String, Object>> docs = engine.documents(user.getClearance(), user.getDepartment()).stream()
                .map(d -> {
                    Map<String, Object> copy = new LinkedHashMap<>(d);
                    if (!Boolean.TRUE.equals(d.get("accessible"))) {
                        copy.put("title", null);
                    }
                    return copy;
                }).toList();
        return Map.of("clearance", user.getClearance(), "department", user.getDepartment(), "documents", docs);
    }
}
