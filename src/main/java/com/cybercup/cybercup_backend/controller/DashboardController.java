package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.service.DashboardService;
import com.cybercup.cybercup_backend.service.EngineClient;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboard;
    private final EngineClient engine;

    public DashboardController(DashboardService dashboard, EngineClient engine) {
        this.dashboard = dashboard;
        this.engine = engine;
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(defaultValue = "7") int days) {
        return dashboard.stats(Math.max(1, Math.min(days, 60)));
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
