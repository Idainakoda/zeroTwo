package com.cybercup.cybercup_backend.controller;
import com.cybercup.cybercup_backend.dto.AuthMeResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

import com.cybercup.cybercup_backend.dto.LoginRequest;
import com.cybercup.cybercup_backend.dto.LoginResponse;
import com.cybercup.cybercup_backend.dto.RegisterRequest;
import com.cybercup.cybercup_backend.dto.RegisterResponse;
import com.cybercup.cybercup_backend.entity.User;
import com.cybercup.cybercup_backend.service.AuthService;
import com.cybercup.cybercup_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final AuthService authService;

    public AuthController(
            UserService userService,
            AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterResponse register(
            @Valid @RequestBody RegisterRequest request) {

        User user = userService.registerUser(request);

        return new RegisterResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                "Registration successful"
        );
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request) {

        return authService.login(request);
    }


    @GetMapping("/me")
    public AuthMeResponse getCurrentUser(Authentication authentication) {
        User user = userService.getById(
                com.cybercup.cybercup_backend.web.CurrentUser.id(authentication));
        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName()).sorted().toList();
        AuthMeResponse response = new AuthMeResponse(
                user.getId(), user.getFullName(), user.getEmail(), roles);
        response.setDepartment(user.getDepartment());
        response.setClearance(user.getClearance());
        return response;
    }

}