package com.ktb.chatapp.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.ktb.chatapp.dto.ErrorResponse;
import com.ktb.chatapp.dto.StandardResponse;
import com.ktb.chatapp.dto.ValidationError;
import com.ktb.chatapp.exception.GlobalExceptionHandler;
import jakarta.validation.Valid;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GlobalErrorContractTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Test
    void handleAuthenticationException_shouldReturnUnauthorizedHandlerContract() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/rooms");

        var response = handler.handleAuthenticationException(
                new BadCredentialsException("bad token"),
                request
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        StandardResponse<Object> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.isSuccess());
        assertEquals("UNAUTHORIZED", body.getCode());
        assertEquals("인증이 필요합니다.", body.getMessage());
        assertEquals("/api/rooms", body.getPath());
    }

    @Test
    void handleValidationException_shouldReturnValidationErrorContract() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/register");
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "registerRequest");
        bindingResult.addError(new FieldError(
                "registerRequest",
                "email",
                "올바른 이메일 형식이 아닙니다."
        ));
        MethodParameter parameter = new MethodParameter(
                GlobalErrorContractTest.class.getDeclaredMethod("validatedRequest", Object.class),
                0
        );

        var response = handler.handleValidationException(
                new MethodArgumentNotValidException(parameter, bindingResult),
                request
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        StandardResponse<Object> body = response.getBody();
        assertNotNull(body);
        assertFalse(body.isSuccess());
        assertEquals("VALIDATION_ERROR", body.getCode());
        assertEquals("/api/auth/register", body.getPath());
        assertEquals(1, body.getErrors().size());
        assertEquals("email", body.getErrors().getFirst().getField());
        assertEquals("올바른 이메일 형식이 아닙니다.", body.getErrors().getFirst().getMessage());
    }

    @Test
    void standardResponse_shouldSerializeCanonicalSuccessShapeWithoutNullFields() throws Exception {
        StandardResponse<String> response = StandardResponse.success("조회 성공", "payload");

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertEquals(true, json.get("success").asBoolean());
        assertEquals("조회 성공", json.get("message").asText());
        assertEquals("payload", json.get("data").asText());
        assertFalse(json.has("errors"));
        assertFalse(json.has("code"));
        assertFalse(json.has("stack"));
        assertFalse(json.has("path"));
        assertFalse(json.has("meta"));
    }

    @Test
    void standardResponse_shouldSerializeValidationErrorShapeWithoutNullFields() throws Exception {
        StandardResponse<Object> response = StandardResponse.validationError(List.of(
                ValidationError.builder()
                        .field("email")
                        .message("올바른 이메일 형식이 아닙니다.")
                        .build()
        ));
        response.setPath("/api/auth/register");

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertEquals(false, json.get("success").asBoolean());
        assertEquals("VALIDATION_ERROR", json.get("code").asText());
        assertEquals("/api/auth/register", json.get("path").asText());
        assertEquals("email", json.get("errors").get(0).get("field").asText());
        assertEquals("올바른 이메일 형식이 아닙니다.", json.get("errors").get(0).get("message").asText());
        assertFalse(json.has("message"));
        assertFalse(json.has("data"));
        assertFalse(json.has("stack"));
        assertFalse(json.has("meta"));
    }

    @Test
    void errorResponse_shouldSerializeWithoutNullDetailField() throws Exception {
        ErrorResponse response = new ErrorResponse(false, "채팅방 목록을 불러오는데 실패했습니다.");

        JsonNode json = objectMapper.readTree(objectMapper.writeValueAsString(response));

        assertEquals(false, json.get("success").asBoolean());
        assertEquals("채팅방 목록을 불러오는데 실패했습니다.", json.get("message").asText());
        assertFalse(json.has("error"));
    }

    @SuppressWarnings("unused")
    private void validatedRequest(@Valid Object request) {
    }
}
