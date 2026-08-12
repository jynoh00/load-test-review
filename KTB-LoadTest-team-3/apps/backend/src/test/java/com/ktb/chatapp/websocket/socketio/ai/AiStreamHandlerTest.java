package com.ktb.chatapp.websocket.socketio.ai;

import com.ktb.chatapp.event.AiMessageChunkEvent;
import com.ktb.chatapp.event.AiMessageCompleteEvent;
import com.ktb.chatapp.event.AiMessageErrorEvent;
import com.ktb.chatapp.model.AiType;
import com.ktb.chatapp.websocket.socketio.handler.StreamingSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.reactivestreams.Subscription;
import org.springframework.context.ApplicationEvent;
import org.springframework.context.ApplicationEventPublisher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AiStreamHandlerTest {

    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private Subscription subscription;

    private StreamingSession session;
    private AiStreamHandler handler;

    @BeforeEach
    void setUp() {
        session = StreamingSession.builder()
                .messageId("ai-message-1")
                .roomId("room-1")
                .userId("user-1")
                .aiType("wayneai")
                .query("hello")
                .timestamp(System.currentTimeMillis())
                .build();
        handler = new AiStreamHandler(session, eventPublisher);
    }

    @Test
    void onSubscribe_requestsUnboundedDemand() {
        handler.onSubscribe(subscription);

        verify(subscription).request(Long.MAX_VALUE);
    }

    @Test
    void onNext_appendsChunkAndPublishesAccumulatedContent() {
        handler.onNext(new ChunkData("hello", false));
        handler.onNext(new ChunkData(" world", true));

        ArgumentCaptor<ApplicationEvent> eventCaptor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(eventPublisher, org.mockito.Mockito.times(2)).publishEvent(eventCaptor.capture());

        AiMessageChunkEvent firstEvent =
                assertInstanceOf(AiMessageChunkEvent.class, eventCaptor.getAllValues().getFirst());
        assertEquals("room-1", firstEvent.getRoomId());
        assertEquals("ai-message-1", firstEvent.getMessageId());
        assertEquals("hello", firstEvent.getFullContent());
        assertFalse(firstEvent.isCodeBlock());

        AiMessageChunkEvent secondEvent =
                assertInstanceOf(AiMessageChunkEvent.class, eventCaptor.getAllValues().get(1));
        assertEquals("hello world", secondEvent.getFullContent());
        assertTrue(secondEvent.isCodeBlock());
    }

    @Test
    void onComplete_publishesCompleteEventWithSessionContent() {
        handler.onNext(new ChunkData("answer", false));

        handler.onComplete();

        ArgumentCaptor<ApplicationEvent> eventCaptor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(eventPublisher, org.mockito.Mockito.times(2)).publishEvent(eventCaptor.capture());
        AiMessageCompleteEvent completeEvent =
                assertInstanceOf(AiMessageCompleteEvent.class, eventCaptor.getAllValues().get(1));
        assertEquals("room-1", completeEvent.getRoomId());
        assertEquals("ai-message-1", completeEvent.getMessageId());
        assertEquals("answer", completeEvent.getContent());
        assertEquals(AiType.WAYNE_AI, completeEvent.getAiType());
        assertEquals("hello", completeEvent.getQuery());
        assertTrue(completeEvent.getGenerationTime() >= 0);
    }

    @Test
    void onComplete_publishesErrorEventWhenCompletionPublishFails() {
        handler.onNext(new ChunkData("answer", false));
        doThrow(new IllegalStateException("event bus down"))
                .when(eventPublisher)
                .publishEvent(isA(AiMessageCompleteEvent.class));

        handler.onComplete();

        ArgumentCaptor<ApplicationEvent> eventCaptor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(eventPublisher, org.mockito.Mockito.times(3)).publishEvent(eventCaptor.capture());
        AiMessageErrorEvent errorEvent =
                assertInstanceOf(AiMessageErrorEvent.class, eventCaptor.getAllValues().get(2));
        assertEquals("AI 메시지 완료 처리 중 오류가 발생했습니다.", errorEvent.getErrorMessage());
    }

    @Test
    void onError_publishesErrorEventWithoutCallingOpenAi() {
        handler.onError(new IllegalStateException("stream down"));

        ArgumentCaptor<ApplicationEvent> eventCaptor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        AiMessageErrorEvent errorEvent =
                assertInstanceOf(AiMessageErrorEvent.class, eventCaptor.getValue());
        assertEquals("room-1", errorEvent.getRoomId());
        assertEquals("ai-message-1", errorEvent.getMessageId());
        assertEquals("stream down", errorEvent.getErrorMessage());
        assertEquals(AiType.WAYNE_AI, errorEvent.getAiType());
    }

    @Test
    void onError_usesFallbackMessageWhenThrowableMessageIsNull() {
        handler.onError(new IllegalStateException());

        ArgumentCaptor<ApplicationEvent> eventCaptor = ArgumentCaptor.forClass(ApplicationEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        AiMessageErrorEvent errorEvent =
                assertInstanceOf(AiMessageErrorEvent.class, eventCaptor.getValue());
        assertEquals("AI 응답 생성 중 오류가 발생했습니다.", errorEvent.getErrorMessage());
    }

    @Test
    void onNext_appendsChunkButDoesNotPublishWhenRoomIsMissing() {
        session.setRoomId(null);

        handler.onNext(new ChunkData("orphan", false));

        assertEquals("orphan", session.getContent());
        verify(eventPublisher, never()).publishEvent(isA(ApplicationEvent.class));
    }

    @Test
    void cancel_cancelsSubscriptionWhenPresent() {
        handler.onSubscribe(subscription);

        handler.cancel();

        verify(subscription).cancel();
    }
}
