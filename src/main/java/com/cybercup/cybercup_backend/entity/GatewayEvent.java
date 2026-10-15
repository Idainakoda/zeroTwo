package com.cybercup.cybercup_backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * One row per request through the gateway (clean ones included), used for the
 * dashboard trends and the employee's history. Holds metadata only - no prompt text.
 */
@Entity
@Table(name = "gateway_events")
public class GatewayEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String requestId;

    @Column(nullable = false)
    private Long userId;

    @Column(length = 60)
    private String department;

    // Engine recommendation: ALLOW, SANITIZE or BLOCK
    @Column(length = 20)
    private String engineDecision;

    // Final action after policy: ALLOW, WARN, MASK, REDACT, BLOCK, REQUIRE_APPROVAL
    @Column(nullable = false, length = 30)
    private String action;

    // Result of response inspection: ALLOW, SANITIZE, BLOCK (null if no answer)
    @Column(length = 20)
    private String responseDecision;

    @Column(length = 300)
    private String categories;

    @Column(length = 500)
    private String findingTypes;

    @Column(length = 300)
    private String policyName;

    private Integer riskScore;

    private Double injectionScore;

    private boolean documentsUsed;

    private boolean unauthorisedRetrieval;

    @Column(length = 300)
    private String sources;

    @Column(length = 40)
    private String provider;

    private Long engineMs;

    private Long llmMs;

    private Long totalMs;

    // The prompt as stored for review: personal data and secrets replaced by placeholders
    // such as <AADHAAR_1>. Never the raw text (gateway.store-prompts=NONE disables it).
    @Lob
    private String promptText;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getEngineDecision() { return engineDecision; }
    public void setEngineDecision(String engineDecision) { this.engineDecision = engineDecision; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getResponseDecision() { return responseDecision; }
    public void setResponseDecision(String responseDecision) { this.responseDecision = responseDecision; }
    public String getCategories() { return categories; }
    public void setCategories(String categories) { this.categories = categories; }
    public String getFindingTypes() { return findingTypes; }
    public void setFindingTypes(String findingTypes) { this.findingTypes = findingTypes; }
    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }
    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) { this.riskScore = riskScore; }
    public Double getInjectionScore() { return injectionScore; }
    public void setInjectionScore(Double injectionScore) { this.injectionScore = injectionScore; }
    public boolean isDocumentsUsed() { return documentsUsed; }
    public void setDocumentsUsed(boolean documentsUsed) { this.documentsUsed = documentsUsed; }
    public boolean isUnauthorisedRetrieval() { return unauthorisedRetrieval; }
    public void setUnauthorisedRetrieval(boolean unauthorisedRetrieval) { this.unauthorisedRetrieval = unauthorisedRetrieval; }
    public String getSources() { return sources; }
    public void setSources(String sources) { this.sources = sources; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public Long getEngineMs() { return engineMs; }
    public void setEngineMs(Long engineMs) { this.engineMs = engineMs; }
    public Long getLlmMs() { return llmMs; }
    public void setLlmMs(Long llmMs) { this.llmMs = llmMs; }
    public Long getTotalMs() { return totalMs; }
    public void setTotalMs(Long totalMs) { this.totalMs = totalMs; }
    public String getPromptText() { return promptText; }
    public void setPromptText(String promptText) { this.promptText = promptText; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
