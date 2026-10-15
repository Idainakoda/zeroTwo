package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.entity.Policy;
import com.cybercup.cybercup_backend.repository.PolicyRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.lang.reflect.Proxy;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PolicyDecisionServiceTests {
    private PolicyDecisionService service(String configuredAction) {
        Policy policy = new Policy();
        policy.setName("PII rule");
        policy.setPolicyType("PII");
        policy.setAction(configuredAction);
        PolicyRepository repository = (PolicyRepository) Proxy.newProxyInstance(
                PolicyRepository.class.getClassLoader(), new Class<?>[]{PolicyRepository.class},
                (proxy, method, args) -> {
                    if ("findByEnabled".equals(method.getName())) {
                        return List.of(policy);
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
        return new PolicyDecisionService(repository);
    }

    @Test
    void allowPolicyCannotForwardResidualData() {
        assertEquals("BLOCK", service("ALLOW").decide(Map.of(
                "decision", "SANITIZE", "residual_risk", true, "findings", List.of())).action());
    }

    @Test
    void engineBlockCannotBeOverriddenByPolicy() {
        assertEquals("BLOCK", service("ALLOW").decide(Map.of(
                "decision", "BLOCK", "residual_risk", false, "findings", List.of())).action());
    }

    @Test
    void safetyBlockCannotBeOverriddenByPolicy() {
        assertEquals("BLOCK", service("ALLOW").decide(Map.of(
                "decision", "BLOCK", "safety_block", true, "residual_risk", false, "findings", List.of())).action());
    }

    @Test
    void classifiedContentBlockedByEngineGoesToApproval() {
        assertEquals("REQUIRE_APPROVAL", service("MASK").decide(Map.of(
                "decision", "BLOCK", "safety_block", false, "residual_risk", false, "findings", List.of(Map.of(
                        "category", "CONFIDENTIAL", "type", "CLASSIFICATION_MARKING", "severity", 3,
                        "redactable", false)))).action());
    }

    @Test
    void bulkPersonalDataBlockedByEngineGoesToApproval() {
        assertEquals("REQUIRE_APPROVAL", service("MASK").decide(Map.of(
                "decision", "BLOCK", "safety_block", false, "residual_risk", false, "findings", List.of(
                        Map.of("category", "PII", "type", "BULK_PERSONAL_DATA", "severity", 4, "redactable", false),
                        Map.of("category", "PII", "type", "PHONE_IN", "severity", 3, "redactable", true)))).action());
    }

    @Test
    void privateKeyStillBlocksEvenWithoutSafetyFlag() {
        assertEquals("BLOCK", service("MASK").decide(Map.of(
                "decision", "BLOCK", "safety_block", false, "residual_risk", false, "findings", List.of(Map.of(
                        "category", "SECRET", "type", "PRIVATE_KEY", "severity", 4, "redactable", false)))).action());
    }

    @Test
    void ordinaryPersonalDataStillUsesMaskPolicy() {
        assertEquals("MASK", service("MASK").decide(Map.of(
                "decision", "SANITIZE", "findings", List.of(Map.of(
                        "category", "PII", "type", "POSSIBLE_AADHAAR", "severity", 4,
                        "redactable", true)))).action());
    }
}
