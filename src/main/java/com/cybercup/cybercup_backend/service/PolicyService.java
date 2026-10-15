package com.cybercup.cybercup_backend.service;





import com.cybercup.cybercup_backend.entity.Policy;
import com.cybercup.cybercup_backend.repository.PolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PolicyService {

    private final PolicyRepository policyRepository;

    public PolicyService(PolicyRepository policyRepository) {
        this.policyRepository = policyRepository;
    }

    @Transactional
    public Policy createPolicy(Policy policy) {

        if (policyRepository.existsByNameIgnoreCase(policy.getName().trim())) {
            throw new IllegalArgumentException(
                    "A policy with this name already exists"
            );
        }

        policy.setName(policy.getName().trim());
        policy.setPolicyType(policy.getPolicyType().trim().toUpperCase());
        policy.setAction(policy.getAction().trim().toUpperCase());

        validatePolicy(policy);

        return policyRepository.save(policy);
    }

    @Transactional(readOnly = true)
    public List<Policy> getAllPolicies() {
        return policyRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Policy getPolicyById(Long id) {
        return policyRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Policy not found: " + id)
                );
    }

    @Transactional
    public Policy updatePolicy(Long id, Policy updatedPolicy) {

        Policy existingPolicy = getPolicyById(id);

        if (!existingPolicy.getName().equalsIgnoreCase(
                updatedPolicy.getName().trim())
                && policyRepository.existsByNameIgnoreCase(
                updatedPolicy.getName().trim())) {
            throw new IllegalArgumentException(
                    "A policy with this name already exists"
            );
        }

        existingPolicy.setName(updatedPolicy.getName().trim());
        existingPolicy.setDescription(updatedPolicy.getDescription());
        existingPolicy.setPolicyType(
                updatedPolicy.getPolicyType().trim().toUpperCase()
        );
        existingPolicy.setAction(
                updatedPolicy.getAction().trim().toUpperCase()
        );
        existingPolicy.setEnabled(updatedPolicy.isEnabled());

        validatePolicy(existingPolicy);

        return policyRepository.save(existingPolicy);
    }

    @Transactional
    public Policy updatePolicyStatus(Long id, boolean enabled) {
        Policy policy = getPolicyById(id);
        policy.setEnabled(enabled);
        return policyRepository.save(policy);
    }

    private void validatePolicy(Policy policy) {
        if (!PolicyDecisionService.TYPES.contains(policy.getPolicyType())) {
            throw new IllegalArgumentException(
                    "Invalid policyType. Use one of " + PolicyDecisionService.TYPES
            );
        }
        String action = PolicyDecisionService.normalizeAction(policy.getAction());
        if (!PolicyDecisionService.ACTIONS.contains(action)) {
            throw new IllegalArgumentException(
                    "Invalid action. Use one of " + PolicyDecisionService.ACTIONS
            );
        }
        policy.setAction(action);
    }
}
