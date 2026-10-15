package com.cybercup.cybercup_backend.controller;

import com.cybercup.cybercup_backend.entity.Role;
import com.cybercup.cybercup_backend.entity.User;
import com.cybercup.cybercup_backend.repository.RoleRepository;
import com.cybercup.cybercup_backend.repository.UserRepository;
import com.cybercup.cybercup_backend.service.AuditLogService;
import com.cybercup.cybercup_backend.web.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** ADMIN: manage departments, clearance levels and roles (these drive access-controlled RAG). */
@RestController
@RequestMapping("/api/users")
public class UserAdminController {

    private static final List<String> CLEARANCES = List.of("PUBLIC", "INTERNAL", "CONFIDENTIAL", "SECRET");

    private final UserRepository users;
    private final RoleRepository roles;
    private final AuditLogService audit;

    public UserAdminController(UserRepository users, RoleRepository roles, AuditLogService audit) {
        this.users = users;
        this.roles = roles;
        this.audit = audit;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return users.findAll().stream().map(UserAdminController::view).toList();
    }

    @PatchMapping("/{id}")
    @Transactional
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, String> body, Authentication auth) {
        User user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        List<String> changes = new ArrayList<>();
        if (body.containsKey("clearance")) {
            String c = body.get("clearance").trim().toUpperCase();
            if (!CLEARANCES.contains(c)) {
                throw new IllegalArgumentException("Clearance must be one of " + CLEARANCES);
            }
            user.setClearance(c);
            changes.add("clearance=" + c);
        }
        if (body.containsKey("department")) {
            user.setDepartment(body.get("department").trim());
            changes.add("department=" + user.getDepartment());
        }
        if (body.containsKey("role")) {
            Role role = roles.findByName(body.get("role").trim().toUpperCase())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role"));
            user.setRoles(new HashSet<>(Set.of(role)));
            changes.add("role=" + role.getName());
        }
        if (body.containsKey("enabled")) {
            user.setEnabled(Boolean.parseBoolean(body.get("enabled")));
            changes.add("enabled=" + user.isEnabled());
        }
        users.save(user);
        audit.logAction(CurrentUser.id(auth), "USER_UPDATED", "user=" + id + "; " + String.join("; ", changes));
        return view(user);
    }

    static Map<String, Object> view(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("fullName", u.getFullName());
        m.put("email", u.getEmail());
        m.put("department", u.getDepartment());
        m.put("clearance", u.getClearance());
        m.put("roles", u.getRoles().stream().map(Role::getName).sorted().toList());
        m.put("enabled", u.isEnabled());
        return m;
    }
}
