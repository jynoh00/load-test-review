package com.ktb.chatapp.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class CustomBearerTokenResolverTest {

    private final CustomBearerTokenResolver resolver = new CustomBearerTokenResolver();

    @Test
    void resolve_shouldPreferCustomHeaderOverQueryParameterAndAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-auth-token", "custom-token");
        request.addParameter("token", "query-token");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer authorization-token");

        assertEquals("custom-token", resolver.resolve(request));
    }

    @Test
    void resolve_shouldPreferQueryParameterOverAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addParameter("token", "query-token");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer authorization-token");

        assertEquals("query-token", resolver.resolve(request));
    }

    @Test
    void resolve_shouldUseBearerAuthorizationHeaderWhenHigherPrioritySourcesAreMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer authorization-token");

        assertEquals("authorization-token", resolver.resolve(request));
    }

    @Test
    void resolve_shouldIgnoreBlankHigherPrioritySourcesAndUseBearerAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-auth-token", " ");
        request.addParameter("token", "");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer authorization-token");

        assertEquals("authorization-token", resolver.resolve(request));
    }

    @Test
    void resolve_shouldIgnoreNonBearerAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Basic abc123");

        assertNull(resolver.resolve(request));
    }

    @Test
    void resolve_shouldIgnoreBlankBearerAuthorizationHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer ");

        assertNull(resolver.resolve(request));
    }
}
