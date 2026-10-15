package com.cybercup.cybercup_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatRequest(
        @NotBlank(message = "Prompt cannot be empty")
        @Size(max = 20000, message = "Prompt is too long")
        String prompt,
        boolean useDocuments,
        @Size(max = 60000, message = "Attached document is too long")
        String attachment) {
}
