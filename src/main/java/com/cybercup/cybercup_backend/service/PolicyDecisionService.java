package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.entity.Policy;
import com.cybercup.cybercup_backend.repository.PolicyRepository;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Turns the security engine's findings into the organisation's action.
 *
 * Each finding is mapped to a policy type (PII, FINANCIAL, SECRET, CONFIDENTIAL, INFRASTRUCTURE,
 * INJECTION, BULK_PII). Enabled policies give the action for each type; the strictest action wins:
 * BLOCK > REQUIRE_APPROVAL > REDACT > MASK > WARN > ALLOW.
 */
@Service
public class PolicyDecisionService {

    public static final List<String> ACTIONS = List.of("ALLOW", "WARN", "MASK", "REDACT", "REQUIRE_APPROVAL", "BLOCK");
    public static final List<String> TYPES = List.of("PII", "FINANCIAL", "SECRET", "CONFIDENTIAL", "INFRASTRUCTURE",
            "INJECTION", "BULK_PII", "RAG_ACCESS", "ID_DOCUMENT", "API_KEY", "CUSTOM");

    /** Used when no enabled policy exists for a type. ID_DOCUMENT: an attached Aadhaar/PAN card, passport... */
    public static final Map<String, String> DEFAULTS = Map.of(
            "PII", "MASK", "FINANCIAL", "MASK", "SECRET", "REDACT", "CONFIDENTIAL", "REQUIRE_APPROVAL",
            "INFRASTRUCTURE", "MASK", "INJECTION", "BLOCK", "BULK_PII", "REQUIRE_APPROVAL", "RAG_ACCESS", "BLOCK",
            "ID_DOCUMENT", "REQUIRE_APPROVAL");

    private static final double INJECTION_BLOCK = 0.70;
    private static final double INJECTION_WARN = 0.30;

    private final PolicyRepository policyRepository;

    public PolicyDecisionService(PolicyRepository policyRepository) {
        this.policyRepository = policyRepository;
    }

    public record Decision(String action, List<String> policyTypes, List<String> policies, List<String> notes) {
    }

    public static int rank(String action) {
        return ACTIONS.indexOf(normalizeAction(action));
    }

    public static String normalizeAction(String action) {
        if (action == null) {
            return "ALLOW";
        }
        String a = action.trim().toUpperCase();
        return switch (a) {
            case "SANITIZE" -> "MASK";
            case "APPROVAL", "REQUIRE-APPROVAL" -> "REQUIRE_APPROVAL";
            default -> a;
        };
    }

    public static String normalizeType(String type) {
        String t = type == null ? "CUSTOM" : type.trim().toUpperCase();
        return "API_KEY".equals(t) ? "SECRET" : t;
    }

    /** Action configured for a policy type (strictest enabled policy), plus the policy name. */
    public Map.Entry<String, String> actionFor(String type) {
        String action = null;
        String name = null;
        for (Policy p : policyRepository.findByEnabled(true)) {
            if (normalizeType(p.getPolicyType()).equals(type)) {
                String a = normalizeAction(p.getAction());
                if (action == null || rank(a) > rank(action)) {
                    action = a;
                    name = p.getName();
                }
            }
        }
        if (action == null) {
            return Map.entry(DEFAULTS.getOrDefault(type, "ALLOW"), "Default " + type + " rule");
        }
        return Map.entry(action, name);
    }

    @SuppressWarnings("unchecked")
    public Decision decide(Map<String, Object> analysis) {
        List<Map<String, Object>> findings = (List<Map<String, Object>>) analysis.getOrDefault("findings", List.of());
        double injection = ((Number) analysis.getOrDefault("injection_score", 0)).doubleValue();
        boolean residual = Boolean.TRUE.equals(analysis.get("residual_risk"));

        Set<String> types = new LinkedHashSet<>();
        Set<String> nonRedactableTypes = new HashSet<>();
        List<String> notes = new ArrayList<>();

        for (Map<String, Object> f : findings) {
            String category = String.valueOf(f.get("category"));
            String type = String.valueOf(f.get("type"));
            int severity = ((Number) f.getOrDefault("severity", 1)).intValue();
            boolean redactable = Boolean.TRUE.equals(f.get("redactable"));
            String policyType = switch (category) {
                case "INJECTION" -> null;      // decided by the fused injection score below
                case "PII" -> "BULK_PERSONAL_DATA".equals(type) ? "BULK_PII" : (severity >= 2 ? "PII" : null);
                case "FINANCIAL" -> severity >= 2 ? "FINANCIAL" : null;
                case "SECRET" -> "SECRET";
                case "CONFIDENTIAL" -> ("INTERNAL_IP".equals(type) || "INTERNAL_HOST".equals(type)) ? "INFRASTRUCTURE"
                        : (severity >= 2 ? "CONFIDENTIAL" : null);
                default -> null;
            };
            if (policyType != null) {
                types.add(policyType);
                if (!redactable && !"BULK_PII".equals(policyType)) {
                    nonRedactableTypes.add(policyType);
                }
            } else if ("SOURCE_CODE".equals(type)) {
                notes.add("Contains source code - make sure it is not proprietary and has no secrets.");
            } else if ("BUSINESS_CONTEXT_HINT".equals(type)) {
                notes.add("May contain internal business information - share only what is necessary.");
            }
        }
        if (injection >= INJECTION_BLOCK) {
            types.add("INJECTION");
        } else if (injection >= INJECTION_WARN) {
            notes.add(String.format("Suspicious wording (injection score %.2f) - logged for review.", injection));
        }

        String action = notes.isEmpty() ? "ALLOW" : "WARN";
        List<String> policies = new ArrayList<>();
        for (String type : types) {
            Map.Entry<String, String> rule = actionFor(type);
            String a = rule.getKey();
            // Masking cannot hide something that is not maskable (e.g. a private key block): escalate.
            if (("MASK".equals(a) || "REDACT".equals(a)) && nonRedactableTypes.contains(type)) {
                a = "BLOCK";
            }
            policies.add(rule.getValue() + " -> " + a);
            if (rank(a) > rank(action)) {
                action = a;
            }
        }
        // Engine safety failures (attack, unreviewable suspicion, residual data) cannot be weakened by
        // any policy. Engine blocks caused only by policy-type findings - classification markings,
        // bulk personal data - are left to the organisation's policy (e.g. REQUIRE_APPROVAL).
        // An engine that does not report safety_block is treated conservatively: its BLOCK is final.
        Object safetyFlag = analysis.get("safety_block");
        boolean safetyBlock = safetyFlag == null
                ? "BLOCK".equals(analysis.get("decision"))
                : Boolean.TRUE.equals(safetyFlag);
        if (residual || safetyBlock) {
            action = "BLOCK";
            policies.add(residual ? "Residual sensitive data after masking -> BLOCK"
                    : "Security engine safety decision -> BLOCK");
        }
        return new Decision(action, new ArrayList<>(types), policies, notes);
    }
}
