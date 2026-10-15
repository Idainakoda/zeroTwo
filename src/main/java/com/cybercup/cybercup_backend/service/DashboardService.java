package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.entity.GatewayEvent;
import com.cybercup.cybercup_backend.repository.ApprovalRequestRepository;
import com.cybercup.cybercup_backend.repository.GatewayEventRepository;
import com.cybercup.cybercup_backend.repository.IncidentRepository;
import com.cybercup.cybercup_backend.repository.PolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/** Aggregates for the admin dashboard: incidents, data categories, blocked requests and trends. */
@Service
public class DashboardService {

    private final GatewayEventRepository events;
    private final IncidentRepository incidents;
    private final ApprovalRequestRepository approvals;
    private final PolicyRepository policies;

    public DashboardService(GatewayEventRepository events, IncidentRepository incidents,
                            ApprovalRequestRepository approvals, PolicyRepository policies) {
        this.events = events;
        this.incidents = incidents;
        this.approvals = approvals;
        this.policies = policies;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> stats(int days) {
        List<GatewayEvent> all = events.findAll();
        Map<String, Long> byAction = new LinkedHashMap<>();
        for (String a : PolicyDecisionService.ACTIONS) {
            byAction.put(a, 0L);
        }
        Map<String, Long> byCategory = new TreeMap<>();
        Map<String, Long> byType = new HashMap<>();
        Map<String, Long> byDepartment = new TreeMap<>();
        long responseBlocked = 0, responseRedacted = 0, retrievalDenied = 0, docsUsed = 0;
        List<Long> engineMs = new ArrayList<>();
        List<Long> totalMs = new ArrayList<>();

        for (GatewayEvent e : all) {
            byAction.merge(e.getAction(), 1L, Long::sum);
            if (e.getCategories() != null) {
                for (String c : e.getCategories().split(",")) {
                    if (!c.isBlank()) {
                        byCategory.merge(c, 1L, Long::sum);
                    }
                }
            }
            if (e.getFindingTypes() != null) {
                for (String t : e.getFindingTypes().split(",")) {
                    if (!t.isBlank()) {
                        byType.merge(t, 1L, Long::sum);
                    }
                }
            }
            if (!"ALLOW".equals(e.getAction())) {
                byDepartment.merge(e.getDepartment() == null || e.getDepartment().isBlank() ? "General" : e.getDepartment(),
                        1L, Long::sum);
            }
            if ("BLOCK".equals(e.getResponseDecision())) responseBlocked++;
            if ("SANITIZE".equals(e.getResponseDecision())) responseRedacted++;
            if (e.isUnauthorisedRetrieval()) retrievalDenied++;
            if (e.isDocumentsUsed()) docsUsed++;
            if (e.getEngineMs() != null) engineMs.add(e.getEngineMs());
            if (e.getTotalMs() != null) totalMs.add(e.getTotalMs());
        }

        // Daily trend for the last `days` days
        LocalDate today = LocalDate.now();
        Map<LocalDate, Map<String, Long>> trend = new LinkedHashMap<>();
        for (int i = days - 1; i >= 0; i--) {
            trend.put(today.minusDays(i), new LinkedHashMap<>(Map.of("requests", 0L, "blocked", 0L, "protected", 0L, "warned", 0L)));
        }
        for (GatewayEvent e : all) {
            Map<String, Long> day = trend.get(e.getCreatedAt().toLocalDate());
            if (day == null) continue;
            day.merge("requests", 1L, Long::sum);
            switch (e.getAction()) {
                case "BLOCK" -> day.merge("blocked", 1L, Long::sum);
                case "MASK", "REDACT", "REQUIRE_APPROVAL" -> day.merge("protected", 1L, Long::sum);
                case "WARN" -> day.merge("warned", 1L, Long::sum);
                default -> { }
            }
        }
        List<Map<String, Object>> trendList = new ArrayList<>();
        trend.forEach((date, counts) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", date.toString());
            row.putAll(counts);
            trendList.add(row);
        });

        List<Map<String, Object>> topTypes = byType.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()).limit(10)
                .map(en -> Map.<String, Object>of("type", en.getKey(), "count", en.getValue())).toList();

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("requests", (long) all.size());
        totals.put("incidents", incidents.count());
        totals.put("blocked", byAction.getOrDefault("BLOCK", 0L));
        totals.put("masked", byAction.getOrDefault("MASK", 0L) + byAction.getOrDefault("REDACT", 0L));
        totals.put("warned", byAction.getOrDefault("WARN", 0L));
        totals.put("pendingApprovals", approvals.countByStatus("PENDING"));
        totals.put("responseBlocked", responseBlocked);
        totals.put("responseRedacted", responseRedacted);
        totals.put("retrievalDenied", retrievalDenied);
        totals.put("documentsUsed", docsUsed);
        totals.put("activePolicies", policies.findByEnabled(true).size());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totals", totals);
        out.put("byAction", byAction);
        out.put("byCategory", byCategory);
        out.put("topTypes", topTypes);
        out.put("byDepartment", byDepartment);
        out.put("trend", trendList);
        out.put("latency", Map.of("engineP50", pct(engineMs, 0.5), "engineP95", pct(engineMs, 0.95),
                "totalP50", pct(totalMs, 0.5), "totalP95", pct(totalMs, 0.95)));
        return out;
    }

    private static long pct(List<Long> values, double q) {
        if (values.isEmpty()) return 0;
        List<Long> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        return sorted.get((int) Math.min(sorted.size() - 1, Math.round(q * (sorted.size() - 1))));
    }
}
