package com.cybercup.cybercup_backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * A flagged request (anything other than a clean ALLOW). Stores what was flagged,
 * the policy that fired and the action taken - never the prompt or the detected values.
 */
@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 30)
    private String decision;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(length = 500)
    private String description;

    @Column(length = 64)
    private String requestId;

    // PROMPT, RESPONSE or RETRIEVAL
    @Column(length = 20)
    private String direction;

    // Detected types, e.g. "AADHAAR,PAN,PHONE_IN"
    @Column(length = 500)
    private String findingTypes;

    @Column(length = 300)
    private String policyName;

    private Integer riskScore;

    @Column(length = 30)
    private String severity;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Incident() {
    }

    public Incident(Long userId, String decision,
                    String category, String description) {
        this.userId = userId;
        this.decision = decision;
        this.category = category;
        this.description = description;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getDecision() {
        return decision;
    }

    public String getCategory() {
        return category;
    }

    public String getDescription() {
        return description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }

    public String getFindingTypes() {
        return findingTypes;
    }

    public void setFindingTypes(String findingTypes) {
        this.findingTypes = findingTypes;
    }

    public String getPolicyName() {
        return policyName;
    }

    public void setPolicyName(String policyName) {
        this.policyName = policyName;
    }

    public Integer getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(Integer riskScore) {
        this.riskScore = riskScore;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }
}
