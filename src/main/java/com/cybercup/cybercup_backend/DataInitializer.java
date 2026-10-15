package com.cybercup.cybercup_backend;

import com.cybercup.cybercup_backend.entity.Policy;
import com.cybercup.cybercup_backend.entity.Role;
import com.cybercup.cybercup_backend.entity.User;
import com.cybercup.cybercup_backend.repository.PolicyRepository;
import com.cybercup.cybercup_backend.repository.RoleRepository;
import com.cybercup.cybercup_backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class DataInitializer {

    @Value("${app.seed-demo:true}")
    private boolean seedDemo;

    @Bean
    CommandLineRunner initializeData(RoleRepository roleRepository, UserRepository userRepository,
                                     PolicyRepository policyRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            createRoleIfMissing(roleRepository, "ADMIN");
            createRoleIfMissing(roleRepository, "SECURITY_ANALYST");
            createRoleIfMissing(roleRepository, "EMPLOYEE");

            seedPolicies(policyRepository);

            if (seedDemo) {
                // Demo accounts for the prototype (local use only; disable with app.seed-demo=false).
                seedUser(userRepository, roleRepository, passwordEncoder, "Security Admin", "admin@cybercup.demo",
                        "Admin@2026", "ADMIN", "SOC", "SECRET");
                seedUser(userRepository, roleRepository, passwordEncoder, "Riya Analyst", "analyst@cybercup.demo",
                        "Analyst@2026", "SECURITY_ANALYST", "SOC", "SECRET");
                seedUser(userRepository, roleRepository, passwordEncoder, "Asha Clerk", "asha@cybercup.demo",
                        "Asha@2026", "EMPLOYEE", "Revenue", "INTERNAL");
                seedUser(userRepository, roleRepository, passwordEncoder, "Meera Officer", "meera@cybercup.demo",
                        "Meera@2026", "EMPLOYEE", "Finance", "CONFIDENTIAL");
            }
        };
    }

    private void seedPolicies(PolicyRepository policies) {
        List<String[]> defaults = List.of(
                new String[]{"Personal data (Aadhaar, PAN, phone, email...)", "PII", "MASK",
                        "Replace personal identifiers with placeholders; restore them in the answer for the same user."},
                new String[]{"Financial details (cards, bank accounts, UPI, GSTIN)", "FINANCIAL", "MASK",
                        "Mask financial identifiers before they reach the AI model."},
                new String[]{"Passwords, API keys and credentials", "SECRET", "REDACT",
                        "Credentials are removed permanently and never restored."},
                new String[]{"Classified / confidential content", "CONFIDENTIAL", "REQUIRE_APPROVAL",
                        "Documents with classification markings or internal codenames need supervisor approval."},
                new String[]{"Internal infrastructure (private IPs, hosts)", "INFRASTRUCTURE", "MASK",
                        "Hide internal network details."},
                new String[]{"Prompt injection and extraction attempts", "INJECTION", "BLOCK",
                        "Attempts to override instructions, reveal the system prompt or obtain other users' data."},
                new String[]{"Bulk personal data export", "BULK_PII", "REQUIRE_APPROVAL",
                        "More than 10 personal identifiers in one request."},
                new String[]{"Unauthorised document retrieval", "RAG_ACCESS", "BLOCK",
                        "Requests that match documents above the user's clearance."});
        for (String[] d : defaults) {
            if (!policies.existsByNameIgnoreCase(d[0])) {
                Policy p = new Policy();
                p.setName(d[0]);
                p.setPolicyType(d[1]);
                p.setAction(d[2]);
                p.setDescription(d[3]);
                p.setEnabled(true);
                policies.save(p);
            }
        }
    }

    private void seedUser(UserRepository users, RoleRepository roles, PasswordEncoder encoder, String name,
                          String email, String password, String role, String department, String clearance) {
        if (users.existsByEmail(email)) {
            return;
        }
        User u = new User(name, email, encoder.encode(password));
        Role r = roles.findByName(role).orElseThrow();
        u.setRoles(new HashSet<>(Set.of(r)));
        u.setDepartment(department);
        u.setClearance(clearance);
        users.save(u);
        System.out.println("Created demo user: " + email + " (" + role + ", " + clearance + ")");
    }

    private void createRoleIfMissing(RoleRepository roleRepository, String roleName) {
        if (roleRepository.findByName(roleName).isEmpty()) {
            roleRepository.save(new Role(roleName));
            System.out.println("Created role: " + roleName);
        }
    }
}
