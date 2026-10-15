package com.cybercup.cybercup_backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * A request held by a REQUIRE_APPROVAL policy. Only the MASKED prompt is stored
 * (sensitive values already replaced by placeholders).
 */
@Entity
@Table(name = "approval_requests")
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String requestId;

    @Column(nullable = false)
    private Long userId;

    @Column(length = 100)
    private String userName;

    @Column(length = 60)
    private String department;

    // Explicit length: with the default (255) MySQL creates TINYTEXT and longer prompts fail to save.
    @Lob
    @Column(nullable = false, length = 1_000_000)
    private String maskedPrompt;

    // Attached-document context, already scanned and redacted by the engine
    @Lob
    private String attachmentContext;

    private boolean useDocuments;

    @Column(length = 500)
    private String reason;

    @Column(length = 300)
    private String findingTypes;

    @Column(length = 300)
    private String policyName;

    private Integer riskScore;

    // PENDING, APPROVED, REJECTED
    @Column(nullable = false, length = 20)
    private String status = "PENDING";

    private Long reviewerId;

    @Column(length = 500)
    private String reviewerNote;

    @Lob
    private String answer;

    @Column(length = 20)
    private String answerDecision;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime decidedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getMaskedPrompt() { return maskedPrompt; }
    public void setMaskedPrompt(String maskedPrompt) { this.maskedPrompt = maskedPrompt; }
    public String getAttachmentContext() { return attachmentContext; }
    public void setAttachmentContext(String attachmentContext) { this.attachmentContext = attachmentContext; }
    public boolean isUseDocuments() { return useDocuments; }
    public void setUseDocuments(boolean useDocuments) { this.useDocuments = useDocuments; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getFindingTypes() { return findingTypes; }
    public void setFindingTypes(String findingTypes) { this.findingTypes = findingTypes; }
    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }
    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) { this.riskScore = riskScore; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getReviewerId() { return reviewerId; }
    public void setReviewerId(Long reviewerId) { this.reviewerId = reviewerId; }
    public String getReviewerNote() { return reviewerNote; }
    public void setReviewerNote(String reviewerNote) { this.reviewerNote = reviewerNote; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public String getAnswerDecision() { return answerDecision; }
    public void setAnswerDecision(String answerDecision) { this.answerDecision = answerDecision; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }
}
