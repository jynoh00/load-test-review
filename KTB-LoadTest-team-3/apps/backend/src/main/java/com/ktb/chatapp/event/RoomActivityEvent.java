package com.ktb.chatapp.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RoomActivityEvent extends ApplicationEvent {
    private final String roomId;
    private final int recentMessageCount;

    public RoomActivityEvent(Object source, String roomId, int recentMessageCount) {
        super(source);
        this.roomId = roomId;
        this.recentMessageCount = recentMessageCount;
    }
}
