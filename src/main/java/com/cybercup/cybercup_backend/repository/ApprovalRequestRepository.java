package com.cybercup.cybercup_backend.repository;

import com.cybercup.cybercup_backend.entity.ApprovalRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {

    List<ApprovalRequest> findAllByOrderByCreatedAtDesc();

    List<ApprovalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    long countByStatus(String status);

    Optional<ApprovalRequest> findByRequestId(String requestId);
}
