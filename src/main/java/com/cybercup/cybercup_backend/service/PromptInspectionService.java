package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.dto.PromptInspectionRequest;
import com.cybercup.cybercup_backend.dto.PromptInspectionResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Inspect-only endpoint (/api/gateway/inspect): runs the full security-engine inspection and the
 * organisation's policies, records the result, but does not call the AI model.
 */
@Service
public class PromptInspectionService {

    private final GatewayService gatewayService;

    public PromptInspectionService(GatewayService gatewayService) {
        this.gatewayService = gatewayService;
    }

    @SuppressWarnings("unchecked")
    public PromptInspectionResponse inspect(PromptInspectionRequest request, Long userId) {
        Map<String, Object> result = gatewayService.chat(userId, request.getPrompt(), false, null, false);
        String action = String.valueOf(result.get("action"));
        List<String> reasons = (List<String>) result.get("reasons");
        return new PromptInspectionResponse(
                action,
                reasons == null || reasons.isEmpty() ? String.valueOf(result.get("message")) : String.join("; ", reasons),
                String.valueOf(result.get("requestId")),
                (String) result.get("sentPrompt"));
    }
}
