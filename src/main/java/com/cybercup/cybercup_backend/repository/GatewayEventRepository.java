package com.cybercup.cybercup_backend.repository;

import com.cybercup.cybercup_backend.entity.GatewayEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface GatewayEventRepository extends JpaRepository<GatewayEvent, Long> {

    List<GatewayEvent> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<GatewayEvent> findByCreatedAtAfterOrderByCreatedAtAsc(LocalDateTime after);

    List<GatewayEvent> findTop200ByOrderByCreatedAtDesc();
}
