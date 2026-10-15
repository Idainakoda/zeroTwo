package com.cybercup.cybercup_backend.web;

import com.cybercup.cybercup_backend.service.EngineClient;
import com.cybercup.cybercup_backend.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.Map;

/** Returns {"message": ...} so the frontend can show a readable error. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final AuditLogService audit;

    public GlobalExceptionHandler(AuditLogService audit) {
        this.audit = audit;
    }

    @ExceptionHandler(EngineClient.EngineUnavailableException.class)
    public ResponseEntity<Map<String, String>> engineDown(EngineClient.EngineUnavailableException e) {
        log.warn("Security engine unreachable: {}", e.getCause() == null ? e.getMessage() : e.getCause().getMessage());
        audit.logAction(0L, "ENGINE_UNAVAILABLE", "request blocked (fail-closed)");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationCredentialsNotFoundException.class})
    public ResponseEntity<Map<String, String>> badCredentials(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<Map<String, String>> disabled(DisabledException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> badRequest(RuntimeException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> tooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE).body(Map.of("message", "The file is larger than 10 MB."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getDefaultMessage()).findFirst().orElse("Invalid request");
        return ResponseEntity.badRequest().body(Map.of("message", msg));
    }
}
