package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.entity.GatewayEvent;
import com.cybercup.cybercup_backend.entity.User;
import com.cybercup.cybercup_backend.repository.GatewayEventRepository;
import com.cybercup.cybercup_backend.repository.UserRepository;
import com.cybercup.cybercup_backend.service.DashboardService;
import com.cybercup.cybercup_backend.service.EngineClient;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboard;
    private final EngineClient engine;
    private final GatewayEventRepository events;
    private final UserRepository users;

    public DashboardController(DashboardService dashboard, EngineClient engine,
                               GatewayEventRepository events, UserRepository users) {
        this.dashboard = dashboard;
        this.engine = engine;
        this.events = events;
        this.users = users;
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(defaultValue = "7") int days) {
        return dashboard.stats(Math.max(1, Math.min(days, 60)));
    }

    /** Recent prompts sent through the gateway (masked text + decision), newest first. */
    @GetMapping("/prompts")
    public List<Map<String, Object>> prompts() {
        List<GatewayEvent> recent = events.findTop200ByOrderByCreatedAtDesc();
        Map<Long, User> byId = users.findAllById(recent.stream().map(GatewayEvent::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (GatewayEvent e : recent) {
            User u = byId.get(e.getUserId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", e.getId());
            row.put("createdAt", e.getCreatedAt());
            row.put("userName", u == null ? "#" + e.getUserId() : u.getFullName());
            row.put("department", e.getDepartment());
            row.put("action", e.getAction());
            row.put("responseDecision", e.getResponseDecision());
            row.put("findingTypes", e.getFindingTypes());
            row.put("riskScore", e.getRiskScore());
            row.put("documentsUsed", e.isDocumentsUsed());
            row.put("unauthorisedRetrieval", e.isUnauthorisedRetrieval());
            row.put("promptText", e.getPromptText());
            row.put("totalMs", e.getTotalMs());
            out.add(row);
        }
        return out;
    }

    /** Runs the engine's evaluation set (accuracy, false positives, latency). */
    @PostMapping("/evaluation")
    public Map<String, Object> evaluation() {
        return engine.runEvaluation();
    }

    /** Blind robustness set: unseen reworded attacks, with each layer's contribution. */
    @PostMapping("/evaluation/blind")
    public Map<String, Object> blind() {
        return engine.runBlindEvaluation();
    }
}
