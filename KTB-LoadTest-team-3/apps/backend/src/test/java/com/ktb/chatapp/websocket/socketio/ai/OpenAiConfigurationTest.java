package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.repository.MessageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OpenAiConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withBean(ChatClient.Builder.class, () -> {
                ChatClient.Builder builder = mock(ChatClient.Builder.class);
                when(builder.build()).thenReturn(mock(ChatClient.class));
                return builder;
            })
            .withBean(MessageRepository.class, () -> mock(MessageRepository.class))
            .withUserConfiguration(AiService.class);

    @Test
    void openAiPropertiesUseSpringAi2NamesAndEnvironmentFallbacks() {
        contextRunner
                .withPropertyValues(
                        "socketio.enabled=true",
                        "spring.ai.openai.api-key=test-openai-key",
                        "spring.ai.openai.chat.options.model=gpt-4.1-mini",
                        "spring.ai.openai.chat.options.temperature=0.7")
                .run(context -> {
                    assertNotNull(context.getBean(AiService.class));
                    assertEquals(
                            "test-openai-key",
                            context.getEnvironment().getProperty("spring.ai.openai.api-key"));
                    assertEquals(
                            "gpt-4.1-mini",
                            context.getEnvironment().getProperty("spring.ai.openai.chat.options.model"));
                    assertEquals(
                            "0.7",
                            context.getEnvironment().getProperty("spring.ai.openai.chat.options.temperature"));
                });
    }

    @Test
    void aiServiceIsNotWiredWhenSocketIoIsDisabled() {
        contextRunner
                .withPropertyValues("socketio.enabled=false")
                .run(context -> org.junit.jupiter.api.Assertions.assertFalse(context.containsBean("aiService")));
    }
}
