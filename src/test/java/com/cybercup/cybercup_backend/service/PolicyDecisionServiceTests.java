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
    void ordinaryPersonalDataStillUsesMaskPolicy() {
        assertEquals("MASK", service("MASK").decide(Map.of(
                "decision", "SANITIZE", "findings", List.of(Map.of(
                        "category", "PII", "type", "POSSIBLE_AADHAAR", "severity", 4,
                        "redactable", true)))).action());
    }
}
