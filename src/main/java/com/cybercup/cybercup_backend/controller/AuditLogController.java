

package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.entity.AuditLog;
import com.cybercup.cybercup_backend.service.AuditLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

        import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<List<AuditLog>> getAllLogs() {
        return ResponseEntity.ok(auditLogService.getAllLogs());
    }

    /** Recomputes the hash chain: any edited or deleted row breaks it. */
    @GetMapping("/verify")
    public ResponseEntity<java.util.Map<String, Object>> verify() {
        return ResponseEntity.ok(auditLogService.verifyChain());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<AuditLog>> getLogsByUser(
            @PathVariable Long userId) {

        return ResponseEntity.ok(
                auditLogService.getLogsByUser(userId)
        );
    }

    @GetMapping("/action/{action}")
    public ResponseEntity<List<AuditLog>> getLogsByAction(
            @PathVariable String action) {

        return ResponseEntity.ok(
                auditLogService.getLogsByAction(action)
        );
    }
}
