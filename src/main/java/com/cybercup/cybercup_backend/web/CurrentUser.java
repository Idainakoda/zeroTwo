package com.cybercup.cybercup_backend.web;

import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** Reads the user id from the JWT issued at login. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Long id(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            Object claim = jwt.getToken().getClaim("userId");
            if (claim instanceof Number n) {
                return n.longValue();
            }
        }
        throw new AuthenticationCredentialsNotFoundException("Not signed in");
    }
}
