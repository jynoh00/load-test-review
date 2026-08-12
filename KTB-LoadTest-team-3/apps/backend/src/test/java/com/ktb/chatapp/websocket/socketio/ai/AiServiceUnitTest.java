package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.repository.MessageRepository;
import com.ktb.chatapp.websocket.socketio.handler.StreamingSession;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.ApplicationEventPublisher;
import reactor.test.StepVerifier;

import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiServiceUnitTest {

    @Mock private ChatClient.Builder chatClientBuilder;
    @Mock private ChatClient chatClient;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private MessageRepository messageRepository;

    @Test
    void streamResponse_rejectsUnknownPersonaBeforeCallingOpenAi() {
        when(chatClientBuilder.build()).thenReturn(chatClient);
        AiService aiService = new AiService(chatClientBuilder, eventPublisher, messageRepository);
        StreamingSession session = StreamingSession.builder()
                .messageId("ai-message-1")
                .roomId("room-1")
                .userId("user-1")
                .aiType("unknown")
                .query("hello")
                .timestamp(System.currentTimeMillis())
                .build();

        StepVerifier.create(aiService.streamResponse(session))
                .expectErrorMatches(error ->
                        error instanceof IllegalArgumentException
                                && error.getMessage().contains("Unknown AI persona"))
                .verify();
    }
}
