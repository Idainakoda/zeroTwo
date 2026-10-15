package com.cybercup.cybercup_backend.service;

import com.cybercup.cybercup_backend.entity.AuditLog;
import com.cybercup.cybercup_backend.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Privacy-aware, hash-chained audit log.
 * hash = SHA-256(prevHash | userId | action | details | requestId | metadata | createdAt)
 */
@Service
public class AuditLogService {

    private static final String GENESIS = "0".repeat(64);

    private final AuditLogRepository auditLogRepository;
    private final TransactionTemplate newTransaction;
    private final Object chainLock = new Object();

    public AuditLogService(AuditLogRepository auditLogRepository, PlatformTransactionManager txManager) {
        this.auditLogRepository = auditLogRepository;
        this.newTransaction = new TransactionTemplate(txManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void logAction(Long userId, String action, String details) {
        log(userId, action, details, null, null);
    }

    /**
     * Appends one entry to the chain. The read of the previous hash and the insert run in their own
     * transaction that COMMITS before the lock is released, so concurrent requests can never chain
     * onto the same previous entry. (Single backend instance; several instances would need a DB lock.)
     */
    public AuditLog log(Long userId, String action, String details, String requestId, String metadata) {
        synchronized (chainLock) {
            return newTransaction.execute(status -> {
                AuditLog entry = new AuditLog(userId == null ? 0L : userId, action, truncate(details, 500));
                entry.setRequestId(requestId);
                entry.setMetadata(truncate(metadata, 4000));
                entry.setCreatedAt(LocalDateTime.now().truncatedTo(ChronoUnit.MILLIS));
                String prev = auditLogRepository.findTopByOrderByIdDesc()
                        .map(a -> a.getHash() == null ? GENESIS : a.getHash())
                        .orElse(GENESIS);
                entry.setPrevHash(prev);
                entry.setHash(hashOf(entry, prev));
                return auditLogRepository.saveAndFlush(entry);
            });
        }
    }

    /** Recomputes the whole chain. Rows written before chaining existed (no hash) are skipped. */
    @Transactional(readOnly = true)
    public Map<String, Object> verifyChain() {
        List<AuditLog> all = auditLogRepository.findAllByOrderByIdAsc();
        String prev = null;
        int checked = 0;
        Map<String, Object> result = new LinkedHashMap<>();
        for (AuditLog a : all) {
            if (a.getHash() == null) {
                continue;
            }
            String expectedPrev = prev == null ? a.getPrevHash() : prev;
            if (!expectedPrev.equals(a.getPrevHash()) || !hashOf(a, a.getPrevHash()).equals(a.getHash())) {
                result.put("valid", false);
                result.put("brokenAtId", a.getId());
                result.put("checked", checked);
                return result;
            }
            prev = a.getHash();
            checked++;
        }
        result.put("valid", true);
        result.put("checked", checked);
        result.put("latestHash", prev);
        return result;
    }

    private static String hashOf(AuditLog a, String prev) {
        String material = String.join("|", prev, String.valueOf(a.getUserId()), nz(a.getAction()), nz(a.getDetails()),
                nz(a.getRequestId()), nz(a.getMetadata()),
                a.getCreatedAt() == null ? "" : a.getCreatedAt().truncatedTo(ChronoUnit.MILLIS).toString());
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(material.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getAllLogs() {
        return auditLogRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getLogsByUser(Long userId) {
        return auditLogRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> getLogsByAction(String action) {
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action);
    }
}
