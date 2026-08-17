# 부하테스트 성능 개선 정리

---

## 1. 채팅방 목록 페이지네이션 적용

```java
// RoomController.java

@GetMapping
@RateLimit
public ResponseEntity<?> getAllRooms(Principal principal) {

    try {
        RoomsResponse response = roomService.getAllRooms(principal.getName());

        // 캐시 설정
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofSeconds(10)))
            .header("Last-Modified", java.time.Instant.now().toString())
            .body(response);
		...
```

```java
// RoomService.java

public RoomsResponse getAllRooms(String name) {
	  try {
	      // 전체 방을 조회해 최신순으로 정렬한다
	      List<RoomResponse> roomResponses = roomRepository.findAll().stream()
	          .map(room -> mapToRoomResponse(room, name))
	          .sorted(Comparator.comparing(
	              RoomResponse::getCreatedAtDateTime,
	              Comparator.nullsLast(Comparator.reverseOrder())))
	          .collect(Collectors.toList());
		...
```

기존 백엔드 코드 레벨의 경우 `GET api/rooms` 호출을 통해 방 목록을 불러옴에 있어, 페이지네이션 없이 `findAll()` 을 통해 전체 방 데이터를 모두 로드하고 있었습니다.

방의 개수가 적을 경우 문제가 되지 않을 수 있지만, 많은 데이터가 쌓인 상황에서 다수의 사용자가 서비스를 이용한다면 빈번하게 호출되는 api인만큼 병목의 원인이 될 수 있다 판단했습니다.

```java
// RoomControlelr.java

@GetMapping
@RateLimit
public ResponseEntity<?> getAllRooms(
        Principal principal,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size) {

    try {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        RoomsResponse response = roomService.getAllRooms(principal.getName(), pageable);

        // 캐시 설정
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(Duration.ofSeconds(10)))
            .header("Last-Modified", java.time.Instant.now().toString())
            .body(response);
        ...
```

요청 파라미터로부터 받아온 데이터를 기반으로 페이지네이션을 적용하여 서비스 계층에 값을 전달하게 하였고

```java
// RoomService.java

public RoomsResponse getAllRooms(String name, Pageable pageable) {
		try {
				Page<Room> roomPage = roomRepository.findAll(pageable);
				...
```

`pageable` 을 통해 전체 방을 모두 조회하던 문제를 해결하였습니다.

추가로 api 계약 변동에 따라 기존 프론트엔드에서의 코드 역시 이에 맞추는 수정 작업을 진행했습니다.

```jsx
// before
const loadRooms = useCallback(async () => {
		await attemptConnection();
		const response = await axiosInstance.get('/api/rooms');

		if (!response?.data?.data) {
		    throw new Error('INVALID_RESPONSE');
    }
    
    setRooms(response.data.data);
    
}, [attemptConnection]);
```

```jsx
// after
const loadRoomsPage = useCallback(async (page, size) => {
		await attemptConnection();
		const response = await axiosInstance.get('/api/rooms', { params: { page, size } });
		
		if (!response?.data?.data) {
      throw new Error('INVALID_RESPONSE');
    }
    
    return response.data;
}, [attemptConnection]);
```

---

## 2. N+1 문제 해결

### 2-1) 최근 메시지 수 집계

`GET /api/rooms` 요청의 경우 앞서 기본 페이지 크기를 50으로 설정했었습니다.

요청 1번이 들어오면 `RoomService.buildRoomResponses`가 응답에 담을 방마다 `recentMessageCounter.countRecentMessages(roomId)`를 개별 호출하였는데

이는 최악의 경우 요청 1건이 MongoDB count 쿼리 최대 50번으로 증폭될 수 있었습니다.

해당 문제의 가장 주요한 원인은 `RoomService.java`의 `mapToRoomResponse(room, name, usersById)`가 방 하나당 한 번씩 카운트 쿼리를 실행하는 구조를 가지기 때문이었습니다.

참가자/생성자 정보는 이미 `userRepository.findAllById`로 배치 조회하고 있었는데, 최근 메시지 수만 배치화가 빠져 있었습니다.

```java
// RoomMessageCounter.java

// N개 방 렌더링 시, 각 방마다 개별 count 쿼리 N+1 문제 해결에 사용
public Map<String, Integer> countRecentMessagesForRooms(Collection<String> roomIds) {
    Map<String, Integer> counts = new HashMap<>();
    if (roomIds == null || roomIds.isEmpty()) {
        return counts;
    }

    LocalDateTime since = LocalDateTime.now().minus(RECENT_WINDOW);

    Aggregation aggregation = Aggregation.newAggregation(
            match(where("room").in(roomIds).and("timestamp").gte(since)),
            group("room").count().as("count")
    );

    AggregationResults<RoomMessageCount> results =
            mongoTemplate.aggregate(aggregation, "messages", RoomMessageCount.class);

    for (RoomMessageCount result : results.getMappedResults()) {
        counts.put(result.id(), result.count());
    }
    return counts;
}

private record RoomMessageCount(String id, int count) {
}
```

`RecentMessageCounter`에 MongoDB 집계 파이프라인(`$match` + `$group`)으로 여러 방의 최근 메시지 수를 한 번에 구하는 `countRecentMessagesForRooms(roomIds)`를 추가하고,

방 목록을 만드는 경로에서는 해당 배치 메서드를 사용하도록 수정하였습니다. ( 추가로, 방 하나만 필요한 생성/입장 응답 경로는 기존 단건 메서드를 그대로 사용하도록 하였습니다. )

결과적으로 같은 결과를 더 적은 쿼리로 얻도록 쿼리 실행 방식만 바꾸어, 기존의 경우 요청 1건당 최대 50회의 count 쿼리가 발생하던 문제를 요청 1건당 집계 쿼리 1회만 수행하여 N+1문제를 해결하였습니다.

### 2-2) 메시지 이력 로드 시 발신자 조회

채팅방 입장과 스크롤 페이지네이션마다 호출되는 `MessageLoader.loadMessagesInternal`이 배치(기본 30개) 메시지를 응답으로 만들 때,

메시지마다 `userRepository.findById(senderId)`를 개별 호출했습니다.

메시지 30건 로드가 사용자 조회 쿼리 최대 30번으로 증폭되는 구조로, 채팅에서 가장 자주 발생하는 이벤트(`fetchPreviousMessages`, `joinRoom`)에 걸려 있었습니다.

해당 문제의 원인은 메시지 리스트를 순회하며 `.map(message -> findUserById(message.getSenderId()))` 형태로 한 건씩 조회하는 전형적인 N+1 패턴이었습니다.

발신자는 방 참가자 범위 내에서 중복이 많은데도 캐싱/배치 없이 매번 개별 조회했습니다.

```java
// before
// MessageLoader.java

List<MessageResponse> messageResponses = sortedMessages.stream()
        .map(message -> {
            var user = findUserById(message.getSenderId());
            return messageResponseMapper.mapToMessageResponse(message, user);
        })
        .collect(Collectors.toList());
```

```java
// after
// MessageLoader.java

Set<String> senderIds = sortedMessages.stream()
                .map(Message::getSenderId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
Map<String, User> usersById = userRepository.findAllById(senderIds).stream()
        .collect(Collectors.toMap(User::getId, u -> u));

List<MessageResponse> messageResponses = sortedMessages.stream()
        .map(message -> {
            var user = usersById.get(message.getSenderId());
            return messageResponseMapper.mapToMessageResponse(message, user);
        })
        .collect(Collectors.toList());
```

해결 과정은 먼저 이번 배치에 등장하는 발신자 ID를 `Set`으로 중복 제거한 뒤

`userRepository.findAllById(senderIds)`로 한 번에 조회해 `Map<userId, User>`를 만들고, 메시지 응답 매핑 시 이 맵에서 꺼내 쓰도록 수정하였습니다.

더 이상 쓰이지 않는 개별 조회 헬퍼(`findUserById`)는 제거했습니다.

결과적으로는 메시지 30건의 경우 `findById` 가 최대 30회 발생하던 기존 코드 레벨의 문제를 `findAllById` 한 번의 실행으로 동일 결과를 얻을 수 있었습니다.

### 2-3) 방 입장 이후 참가자 정보 조회

`RoomJoinHandler.handleJoinRoom`이 입장 성공 응답을 만들 때,

방 참가자 ID 목록을 `.stream().map(userRepository::findById)`로 순회하며 참가자 수만큼 개별 조회하는 문제가 있었습니다.

참가자가 많은 방일수록, 그리고 사용자들이 동시에 몰릴수록 입장 처리 지연이 커지는 구조입니다.

```java
// before
// RoomJoinHandler.java
List<UserResponse> participants = roomOpt.get().getParticipantIds()
        .stream()
        .map(userRepository::findById)
        .filter(Optional::isPresent)
        .map(Optional::get)
        .map(UserResponse::from)
        .toList();
```

```java
// after
// RoomJoinHandler.java
// 기존 참가자 수만큼 findById => 한 번에 배치 조회
List<UserResponse> participants = userRepository.findAllById(roomOpt.get().getParticipantIds())
        .stream()
        .map(UserResponse::from)
        .toList();
```

`userRepository.findAllById(participantIds)`로 한 번에 배치 조회하도록 개선하여 해당 문제를 해결하였습니다.

응답에 담기는 참가자 목록과 내용은 동일하며 조회 결과 자체를 줄이거나 숨기지 않고 쿼리 실행 횟수만 줄일 수 있었습니다.

### 2-4) 읽음 상태 처리 로직 (findById + save)

`MessageReadStatusService.updateReadStatus`가 메시지 ID 리스트를 받아 메시지 하나마다,

findById로 조회 → 자바 컬렉션에서 중복 체크 → save로 저장을 반복했습니다.

이 메서드는 메시지 이력을 로드할 때(`MessageLoader`)와 명시적으로 읽음 처리할 때(`MessageReadHandler`) 모두 호출되는 가장 빈번한 메서드였는데

메시지 30건 기준 최대 60회(조회 30 + 저장 30)의 개별 MongoDB 왕복이 발생했습니다.

```java
// before
// MessageReadStatusService.java

...

try {
		for (String messageId : messageIds) {
		    var messageOptional = messageRepository.findById(messageId);
		    if (messageOptional.isPresent()) {
		        var message = messageOptional.get();
		        if (message.getReaders() == null) {
		            message.setReaders(new ArrayList<>());
		        }
		        boolean alreadyRead = message.getReaders().stream()
		                .anyMatch(r -> r.getUserId().equals(userId));
		        if (!alreadyRead) {
		            message.getReaders().add(readerInfo);
		        }
		        messageRepository.save(message);
		    }
		}
		log.debug("Read status updated for {} messages by user {}", messageIds.size(), userId);

...
```

문제의 원인은 읽음 여부(중복 방지) 판단과 갱신을 애플리케이션 레벨 for 루프로 처리하고 있었기 때문이었습니다.

하지만 해당 로직은 "아직 사용자가 읽지 않은 메시지에만 reader를 추가한다"는 조건부 갱신이었기에, MongoDB 쿼리 조건과 원자적 업데이트 연산자만으로도 표현 가능한 작업이었습니다.

```java
// before
// MessageReadStatusService.java

...

try {
		Query query = new Query(Criteria.where("id").in(messageIds).and("readers.userId").ne(userId));
		Update update = new Update().push("readers", readerInfo);
		
		var result = mongoTemplate.updateMulti(query, update, Message.class);
		log.debug("Read status updated for {} messages ({} matched) by user {}", result.getModifiedCount(), result.getMatchedCount(), userId);
                    
...
```

이를 해결하기 위해 `MongoTemplate.updateMulti`로 전환하였습니다.

쿼리 조건에 `_id in messageIds AND readers.userId != userId`를 걸어 "아직 안 읽은 메시지"만 대상으로 삼고,

업데이트로 `$push readers`를 적용해 모든 대상 메시지를 단 한 번의 요청으로 갱신하게 하였습니다. 중복 방지 로직도 애플리케이션 코드가 아니라 쿼리 조건 자체로 원자적으로 보장되었습니다.

결과적으로는 메시지 30건 당 최대 60회 왕복을 메시지 N건 당 오직 요청 1회 수행하도록 개선할 수 있었으며, 중복 읽음 방지가 쿼리 조건으로 원자화되었습니다.

읽음 상태 갱신이라는 동작 자체와 "이미 읽은 사용자는 중복 추가하지 않는다"는 규칙을 동일하게 유지하며 실행 경로만 바꾼 결과였습니다.

---

## 3. MongoDB 주요 조회 문서 인덱스 적용

기존 코드의 경우 채팅의 핵심 조회 경로인 `Message`, `Room`, `File` 문서에 인덱스가 걸려 있지 않았습니다.

`spring.data.mongodb.auto-index-creation=true`는 이미 켜져 있었지만, 정작 엔티티에는 `@Indexed`/`@CompoundIndex` 선언이 없어 실제로 생성되는 인덱스가 없는 상태였습니다.

주요 문제의 경우 먼저 `MessageRepository.findByRoomIdAndTimestampBefore(roomId, timestamp, pageable)` 은 채팅방 진입/스크롤마다(가장 빈번한 쿼리) 호출되지만 

`Message.roomId`와 `timestamp` 모두 인덱스가 없어 컬렉션 전체 스캔 + 인메모리 정렬이 발생합니다. 메시지가 쌓일수록 조회 시간이 선형으로 늘어나 문제가 발생할 수 있는 부분이었습니다.

`countRecentMessagesByRoomId`또한 동일하게 `room`+`timestamp` 조합으로 매 방 목록 조회 시 호출됩니다.

`MessageRepository.findByFileId`(파일 접근 권한 검증), `RoomRepository`의 `createdAt` 내림차순 페이지네이션(방 목록 화면 기본 페이지),

`FileRepository.findByFilename`(파일 다운로드/미리보기마다 호출)도 같은 이유로 매번 풀스캔되고 있었습니다.

```java
public class File {
    @Id
    private String id;

    // 파일 다운로드, 미리보기 요청마다 findByFilename 조회 => 인덱스
    @Indexed
    private String filename;

    ...
```

```java
@CompoundIndexes({
        @CompoundIndex(name = "room_timestamp_idx", def = "{'room': 1, 'timestamp': -1}")
})
public class Message {

		...

    @Field("file")
    @Indexed // findByFileId 조회 => 인덱스
    private String fileId;
    
    ...
```

```java
public class Room {
	
		...
		
    @CreatedDate
    @Indexed // 방 목록 조회(GET /api/rooms) => 항상 createdAt 내림차순 페이지네이션 => 인덱스 적용
    private LocalDateTime createdAt;
    
    ...
```

해당 부분에서의 수정 내용은 쿼리 패턴을 그대로 따라가는 인덱스를 추가한 것입니다.

특히 `room+timestamp` 컴파운드 인덱스는 메시지 페이지네이션과 최근 메시지 수 집계 두 쿼리를 동시에 커버하도록 설계했습니다.

결과적으로 쿼리 자체(정렬 기준, 조회 필드)는 요구사항에 맞게 그대로 두었고, 해당 쿼리가 실제로 타는 필드에 인덱스를 걸었습니다.

캐시로 증상만 가리거나 쿼리 결과를 임의로 제한하지 않고 데이터 규모가 커져도 동일하게 효과가 유지되도록 하였습니다.

결과적으로는 기존의 경우 컬렉션 전체 스켄 + 인메모리 정렬이 발생했지만, 수정 이후 인덱스 스켄을 적용하여 불필요한 풀스캔을 피할 수 있었습니다.

---

## 4. Socket.IO accept backlog 튜닝

netty-socketio 기본 accept backlog는 1024지만 기존 코드에서는 10으로 명시적으로 줄여져있음을 확인할 수 있었습니다.

채팅방 입장은 소켓 연결을 새로 맺는 동작이라 여러 사용자가 동시에 입장하는 순 OS의 TCP accept 큐가 빠르게 가득 차 연결 실패/재시도가 발생할 수 있습니다.

```java
// SocketIOConfig.java
socketConfig.setAcceptBackLog(10);
```

이에 백엔드 코드단에서 512로 backlog 값을 지정하였고, 실제 스프링부트가 실행되는 서버의 운영체제 설정값과 코드 레벨에서의 설정값 중 작은 값으로 실제 backlog가 지정되기에

실행 서버의 backlog 설정값은 최대로 지정하여 항상 코드 레벨에서의 지정값이 반영되도록 하였습니다. ( 추후 문제가 발생하면 해당 백로그 값의 수정을 통해 해결할 수 있도록 )

```java
socketConfig.setAcceptBackLog(512);
```

---

## 5. 세션 저장소 인메모리 → Redis/Redisson 전환

기존 Socket.IO 서버는 다음과 같이 `MemoryStoreFactory`를 사용해 세션과 Room 정보를 애플리케이션 인스턴스의 메모리에 저장하고 있었습니다.

```
config.setStoreFactory(new MemoryStoreFactory());
```

인메모리 방식은 세션 조회가 빠르다는 장점이 있지만, 동시 접속자가 증가할수록 Socket.IO 관련 데이터가 애플리케이션 힙에 누적됩니다.

이로 인해 메모리 사용량과 GC 부하가 증가하고, 단일 인스턴스의 CPU/메모리 한계가 전체 처리량을 제한할 수 있었습니다.

또한 여러 인스턴스를 운영할 경우 세션과 Room 정보가 서버별로 분리됩니다.

특정 서버에서 발생한 이벤트나 상태 변경을 다른 서버가 알 수 없어 트래픽을 여러 서버에 안정적으로 분산하기 어렵고, 수평 확장에도 제약이 있었습니다.

이를 개선하기 위해 `RedisConfig`를 추가하여 Spring Boot의 Redis 연결 정보로 `RedissonClient`를 생성했습니다.

```java
@Bean(destroyMethod = "shutdown")
@ConditionalOnProperty(
    name = "socketio.enabled",
    havingValue = "true",
    matchIfMissing = true
)
public RedissonClient redissonClient(
        DataRedisConnectionDetails connectionDetails) {
    // Redis 연결 설정
}
```

이후 Socket.IO의 저장소를 `MemoryStoreFactory`에서 `RedissonStoreFactory`로 변경했습니다.

```java
config.setStoreFactory(
    new RedissonStoreFactory(redissonClient)
);
```

기존에는 동시 접속자가 증가할수록 Socket.IO 서버 한 대의 힙 사용량과 GC 부하가 함께 증가했습니다.

단일 서버가 처리할 수 있는 연결 수를 초과하면 메시지 전달 지연과 연결 실패율이 급격히 증가할 가능성이 있었습니다.

Redis/Redisson 전환 후에는 세션 저장소가 애플리케이션 프로세스 외부로 분리되어 서버의 메모리 부담을 완화할 수 있습니다.

또한 여러 Socket.IO 서버가 동일한 저장소와 Pub/Sub 채널을 사용하므로, 부하가 증가했을 때 서버 인스턴스를 추가하여 연결과 메시지 처리를 분산할 수 있게 됐습니다.

---

## 6. 접속자 정보 저장소 Redis 전환 및 중복 로그 통보 Redis Pub/Sub 경유

기존에는 `LocalChatDataStore`가 `ConcurrentHashMap`을 사용해 접속자 정보를 저장했습니다.

```java
private final ConcurrentHashMap<String, Object> storage;
```

이를 `RedisChatDataStore`의 `RMap`으로 변경했습니다.

```java
private static final String MAP_NAME = "socketio:chat-data";
private final RMap<String, Object> storage;
```

```java
public RedisChatDataStore(RedissonClient redissonClient) {
    this.storage = redissonClient.getMap(MAP_NAME);
}
```

이 변경으로 접속자와 소켓 ID의 매핑 정보가 특정 애플리케이션 인스턴스에 종속되지 않게 됐습니다.

따라서 어떤 서버에서도 기존 접속자의 소켓 ID를 조회할 수 있어 다중 인스턴스 환경에서도 중복 로그인 여부를 판단할 수 있습니다.

이를 통해 접속자 수가 증가해도 사용자 매핑 데이터가 개별 서버의 힙에 계속 누적되는 현상을 줄일 수 있습니다.

추가로 기존에는 저장된 소켓 ID로 현재 서버의 클라이언트를 직접 조회했습니다.

```java
SocketIOClient existingClient =
    socketIOServer.getClient(UUID.fromString(existingSocketId));
```

`getClient()`는 현재 인스턴스에 연결된 클라이언트만 조회할 수 있기 때문에 기존 사용자가 다른 Socket.IO 서버에 연결돼 있으면 클라이언트를 찾지 못하고 중복 로그인 알림을 전달할 수 없었습니다.

이를 해결하기 위해 각 클라이언트가 자신의 소켓 ID를 기반으로 한 전용 Room에 참여하도록 변경했습니다.

```java
client.joinRooms(Set.of(
    "user:" + userId,
    "room-list",
    socketRoom(client.getSessionId().toString())
));
```

```java
private static String socketRoom(String socketId) {
    return "socket:" + socketId;
}
```

중복 로그인이 감지되면 로컬 클라이언트를 직접 조회하지 않고 해당 소켓의 전용 Room으로 이벤트를 전송합니다.

```java
var existingSocket =
    socketIOServer.getRoomOperations(socketRoom(existingSocketId));

existingSocket.sendEvent(
    DUPLICATE_LOGIN,
    Map.of(/* 알림 데이터 */)
);
```

이에 따라 기존 접속자가 어느 Socket.IO 서버에 연결돼 있는지와 관계없이 Redis Pub/Sub을 거쳐 중복 로그인 이벤트를 전달할 수 있도록 수정하였습니다.

이를 통해 중복 로그인 알림 처리를 여러 Socket.IO 서버로 분산할 수 있게 하여 서버에 부하가 몰리는 문제를 해결할 수 있도록 했습니다.

---

## 7. 로그인 헬스체크로 인한 폼 렌더링 지연 개선

로그인 폼(`login-email-input` 등)이 `/api/health` 헬스체크가 끝날 때까지 DOM에 아예 렌더되지 않고 있었습니다.

일반적인 경우에는 문제가 없으나 부하로 백엔드 응답이 느려지는 상황에서는 이 헬스체크 자체가 지연되어 로그인 폼 노출 시점이 함께 밀리고

E2E 테스트의 `fill()` 타임아웃과 실사용자 체감 로딩 지연으로 직결됐습니다.

따라서 폼 렌더링을 헬스체크 완료 여부에 의존하지 않도록, 렌더를 가로막던 `if (serverStatus.checking) { ... }` 조기 반환 블록을 제거했습니다.

헬스체크 로직 자체(백엔드 생존 확인, 연결 실패 시 안내 배너)는 그대로 유지되지만 이제는 폼과 동시에 백그라운드에서 진행되도록하며,

제출 버튼은 기존 로직 그대로 `!serverStatus.connected`일 때 비활성화되어 안전장치도 유지됩니다.

입력 필드는 애초에 `loading`에만 묶여 있어 즉시 활성화되며 회원가입 페이지에서 이미 사용한 패턴(게이트 없이 폼을 바로 렌더)과 동일한 방향으로 수정하였습니다.

```jsx
// apps/frontend/pages/index.js
// 전체 블록 제거

...

if (serverStatus.checking) {

  return (

    <div className="min-h-screen flex items-center justify-center ...">

      <VStack $css={{ ... }}>

        <div className="text-center mb-[2rem]">

          <img src="images/logo-h.png" ... />

        </div>

        <div className="text-center">

          <Text typography="body1">서버 연결 확인 중...</Text>

        </div>

      </VStack>

    </div>

  );

}

....
```

---

## 8. 언마운트 시 소켓 완전 재연결 → DB 쓰기 부하 개선

부하 테스트 리포트(VU 250명 대상)를 확인한  결과 `chatRoomCreationScenario`, `massMessageScenario`, `fileUploadScenario`, `forbiddenWordScenario` 등

대부분의 시나리오가`/chat`(방 목록) ↔ `/chat/<roomId>`(방 화면)를 반복 왕복하며, 이 과정에서 `toBeVisible` 타임아웃 실패가 다수 발생함을 확인할 수 있었습니다.

Socket.IO 연결은 `apps/frontend/services/socket.js`의 싱글턴 하나만 존재하고, 방 목록 화면과 방 화면이 이 연결을 공유하고 있었습니다.

그러나 두 화면 모두 자신이 언마운트될 때 이 공유 소켓을 무조건 `disconnect()` 하도록 짜여 있었습니다.

결과적으로 단순히 방 목록 → 방 → 목록 → 다른 방으로 이동하기만 해도 매번 완전히 새로운 WebSocket handshake(JWT 디코딩, 세션 검증, DB 조회 포함)가 발생했습니다.

실제로 코드 안에는 이미 소켓이 살아있으면 재사용하는 올바른 재연결 로직(`useChatRoomLifecycle.js`의 `rejoinRoom`, `cleanup(UNMOUNT)`의 `tryLeaveRoom` 등)이 별도로 구현되어 있었는데,

각 화면 자체의 언마운트 effect에 남아있던 이 `disconnect()` 호출이 그 설계를 매번 무력화시키고 있었습니다.

이러한 문제로 인해 소켓이 매번 완전히 끊어지므로, 백엔드의 `ConnectionLoginHandler.onDisconnect` 가 사용자가 참여 중이던 모든 방에 대해 퇴장 처리를,

직후 방 재입장시 `RoomJoinHandler.handleJoinRoom` 이 다시 입장 처리를 실행했습니다.

즉, 방을 잠깐 들여다보고 목록으로 돌아가기만 해도 실제로는 "퇴장 → 재입장"이 반복되며 불필요한 DB 쓰기와 방 전체 브로드캐스트가 계속 발생하는 구조였습니다.

- "OOO님이 입장/퇴장하였습니다" 시스템 메시지를 DB에 저장하고 방 전체에 브로드캐스트
- `RoomLeaveHandler.broadcastParticipantList` 가 참가자 수만큼 `userRepository.findById` 를 반복 호출(N+1 쿼리)
    - 동일 목적을 가진 `RoomJoinHandler` 는 이미 `findAllById` 로 배치 조회하도록 되어 있어 두 핸들러 사이에 비대칭이 존재

이에 언마운트 effect에서 무조건적인 `socketRef.current.disconnect()` 호출을 제거했습니다.

```jsx

  useEffect(() => {
    return () => {
      ...
      if (roomEventsUnsubscribeRef.current) { roomEventsUnsubscribeRef.current(); ... }

// 제거
//      if (socketRef.current) {
//        socketRef.current.disconnect();
//        socketRef.current = null;
      }
      // 소켓은 세션 동안 화면 간 공유되는 연결이다. 실제 방 퇴장은
      // useChatRoom 의 cleanup(UNMOUNT) 가 이미 처리한다.
    };
  }, []);
```

실제 "방 퇴장" 처리는 `useChatRoom.js`의 `cleanup('unmount')` 가 이미 소켓 연결은 유지한 채 해당 방에 대해서만 `leaveRoom` 이벤트를 보내도록 구현되어 있었으므로,

그 경로에 맡기고 여기서는 화면 자체의 이벤트 구독 해제만 수행하도록 정리했습니다.

추가로 언마운트 시 소켓을 끊는 대신, 이 화면이 직접 등록했던 6개 이벤트 리스너(`connect`, `disconnect`, `error`, `roomCreated`, `roomUpdated`, `roomActivity`)만

`socket.off(event, handler)` 로 정확히 제거하도록 변경했습니다.

또한 이미 연결돼 있던 소켓을 그대로 이어받는 경우 `connect` 이벤트가 다시 발생하지 않아 화면의 연결 상태 표시가 갱신되지 않는 문제를 막기 위해,

리스너 등록 직후 현재 소켓의 `connected` 값을 즉시 상태에 반영하도록 추가했습니다.

```jsx
  handlersRef.current = handlers;
  Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

// 추가
  // 이미 연결된 소켓을 이어받으면 'connect' 이벤트가 다시 오지 않는다 — 즉시 반영
  setConnectionStatus(socket.connected ? CONNECTED : DISCONNECTED);

  return () => {
// 제거  
//    if (socketRef.current) {
//      socketRef.current.disconnect();
//      socketRef.current = null;
//    }

// 추가
   if (socketRef.current && handlersRef.current) {
     Object.entries(handlersRef.current).forEach(([event, handler]) =>
       socketRef.current.off(event, handler));
   }
   socketRef.current = null;
   handlersRef.current = null;
  };
```

실제 로그아웃 시에는 `AuthContext.js`의 `logout()`이 `socketService.disconnect()`를 별도로 호출하므로, 세션 종료 시 연결이 정리되는 기존 동작은 그대로 유지됩니다.

마지막으로 백엔드 단에서도 `RoomJoinHandler`와 동일하게 `findAllById` 배치 조회로 교체하여, 방 퇴장 브로드캐스트 시 참가자 수만큼 DB를 왕복하던 부분을 한 번의 조회로 줄였습니다.

```java
// before
var participantList = roomOpt.get().getParticipantIds().stream()
     .map(userRepository::findById)
     .filter(Optional::isPresent)
     .map(Optional::get)
     .map(UserResponse::from)
     .toList();
```

```java
// after
var participantList = userRepository.findAllById(roomOpt.get().getParticipantIds())
     .stream()
     .map(UserResponse::from)
     .toList();
```

---

## 9. 금칙어 검사 알고리즘 O(N*M), CPU 비용 선형 누적 문제

VUser 250명 규모의 부하 테스트를 진행한 결과 금칙어 관련 처리 구간에서 성능 저하가 의심되었습니다.

이후 확인해본 결과 채팅 메시지가 Socket.IO를 통해 서버로 들어오면 `ChatMessageHandler.handleChatMessage()`가 매 메시지마다 동기적으로 다음을 수행하였는데

세션 검증 / Rate limit 체크 ⇒ 발신자/채팅방 조회 ⇒ `bannedWordChecker.containsBannedWord(content)` (메시지 저장 이전, 매 메시지마다 반드시 실행) ⇒ 메시지 저장 ⇒ 브로드캐스트

금칙어 검사는 캐시되거나 비동기로 빠지지 않고, 모든 채팅 메시지 전송 요청의 critical path에 그대로 놓여 있었습니다. 250명이 동시에 메시지를 보내면 이 검사가 250배로 늘어난 부하를 그대로 받았습니다.

```java
// before
// BannedWordChecker.java
public boolean containsBannedWord(String message) {
    if (message == null || message.isBlank()) {
        return false;
    }
    String normalizedMessage = message.toLowerCase(Locale.ROOT);
    return bannedWords.stream().anyMatch(normalizedMessage::contains);
}
```

금칙어 사전은 `apps/backend/src/main/resources/fake_banned_words_10k.txt`에서 로드되며 정확히 10,000개의 단어를 담고 있었습니다.

위 구현은 메시지 하나를 검사할 때마다 10,000개 금칙어 각각에 대해 `String.contains()`를 순차 호출하는데

이는 O(N × M) 시간복잡도로 (N = 금칙어 개수(10,000), M = 메시지 길이) 메시지 길이가 길어질수록, 그리고 동시 요청이 많아질수록

CPU 비용이 선형 이상으로 누적되어 금칙어 관련 부하에서 성능상 문제로 관측될 수밖에 없는 구조였습니다.

이에 메시지 저장 로직이나 이벤트 흐름을 바꾸는 대신, 근본 원인인 검사 알고리즘 자체를 교체했습니다.

다중 패턴 문자열 매칭에 표준적으로 쓰이는 Aho-Corasick 알고리즘을 적용하여, 10,000개 금칙어를 하나의 트라이(trie) + 실패 링크(failure link) 오토마톤으로 미리 컴파일해두고,

메시지는 단 한 번 순회하면서 모든 금칙어를 동시에 검사하도록 바꿨습니다.

- 생성자에서 금칙어 10,000개로 트라이를 1회 구축 (빈(bean) 초기화 시점, 요청 경로 밖)
- 각 노드에 실패 링크를 BFS로 계산 (표준 Aho-Corasick 전처리)
- 메시지 검사 시 문자 하나당 O(1) 상태 전이만 수행 → 전체 O(M)
- 트라이는 구축 후 불변이므로 별도 동기화 없이 여러 스레드가 동시에 안전하게 조회 가능

결과적으로 변경 반영 이후 시간복잡도를 O(N × M)에서 O(M)으로 개선할 수 있었습니다.

```java
public boolean containsBannedWord(String message) {
    if (message == null || message.isBlank()) {
        return false;
    }
    
    String normalizedMessage = message.toLowerCase(Locale.ROOT);

    Node current = root;
    for (int i = 0; i < normalizedMessage.length(); i++) {
        char c = normalizedMessage.charAt(i);
        while (current != root && !current.children.containsKey(c)) {
            current = current.fail;
        }
        current = current.children.getOrDefault(c, root);
        if (current.output) {
            return true;
        }
    }
    return false;
}
```