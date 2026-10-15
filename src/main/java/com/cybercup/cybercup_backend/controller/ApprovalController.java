package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.entity.ApprovalRequest;
import com.cybercup.cybercup_backend.repository.ApprovalRequestRepository;
import com.cybercup.cybercup_backend.service.GatewayService;
import com.cybercup.cybercup_backend.web.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/approvals")
public class ApprovalController {

    private final ApprovalRequestRepository approvals;
    private final GatewayService gateway;

    public ApprovalController(ApprovalRequestRepository approvals, GatewayService gateway) {
        this.approvals = approvals;
        this.gateway = gateway;
    }

    /** All approval requests (ADMIN / SECURITY_ANALYST). */
    @GetMapping
    public List<ApprovalRequest> all() {
        return approvals.findAllByOrderByCreatedAtDesc();
    }

    /** The signed-in user's own held requests and their answers. */
    @GetMapping("/my")
    public List<ApprovalRequest> mine(Authentication auth) {
        return approvals.findByUserIdOrderByCreatedAtDesc(CurrentUser.id(auth));
    }

    @PostMapping("/{id}/approve")
    public ApprovalRequest approve(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                   Authentication auth) {
        return gateway.approve(id, CurrentUser.id(auth), body == null ? null : body.get("note"));
    }

    @PostMapping("/{id}/reject")
    public ApprovalRequest reject(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body,
                                  Authentication auth) {
        return gateway.reject(id, CurrentUser.id(auth), body == null ? null : body.get("note"));
    }
}
