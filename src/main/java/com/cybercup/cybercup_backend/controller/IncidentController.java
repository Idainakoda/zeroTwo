package com.cybercup.cybercup_backend.controller;


import com.cybercup.cybercup_backend.entity.Incident;
import com.cybercup.cybercup_backend.service.IncidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

        import java.util.List;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @GetMapping
    public ResponseEntity<List<Incident>> getAllIncidents() {
        return ResponseEntity.ok(
                incidentService.getAllIncidents()
        );
    }

    @GetMapping("/my")
    public ResponseEntity<List<Incident>> myIncidents(
            org.springframework.security.core.Authentication authentication) {
        return ResponseEntity.ok(incidentService.getIncidentsByUser(
                com.cybercup.cybercup_backend.web.CurrentUser.id(authentication)));
    }

    @GetMapping("/decision/{decision}")
    public ResponseEntity<List<Incident>> getIncidentsByDecision(
            @PathVariable String decision) {

        return ResponseEntity.ok(
                incidentService.getIncidentsByDecision(decision)
        );
    }
}
