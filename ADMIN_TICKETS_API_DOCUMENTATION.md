# Admin Tickets API Documentation

Comprehensive admin API endpoints for the support ticket system in PinGlass.

## Overview

All endpoints require admin authentication via `getCurrentSession()` from `lib/admin/session.ts`.

## Authentication

All requests must include a valid admin session cookie (`admin_session`). Unauthorized requests return:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "userMessage": "Необходима авторизация"
  }
}
```

Status: `401 Unauthorized`

---

## Endpoints

### 1. List Tickets

**GET** `/api/admin/tickets`

List all support tickets with pagination, filtering, and search.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (min: 1) |
| `limit` | number | No | 20 | Items per page (min: 1, max: 100) |
| `status` | string | No | - | Filter by status: 'open', 'in_progress', 'waiting_user', 'resolved', 'closed', 'all' |
| `priority` | string | No | - | Filter by priority: 'P1', 'P2', 'P3', 'P4', 'all' |
| `search` | string | No | - | Search in ticket_number, user_name, telegram_username, subject |
| `assignedTo` | string | No | - | Filter by assigned operator username |

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "tickets": [
      {
        "id": 1,
        "ticket_number": "TKT-2024-001",
        "user_id": 123,
        "telegram_chat_id": 456789,
        "telegram_username": "username",
        "user_name": "John Doe",
        "subject": "Payment issue",
        "category": "payment",
        "priority": "P1",
        "status": "open",
        "sla_first_response_at": "2024-01-05T12:00:00Z",
        "sla_resolution_at": "2024-01-05T16:00:00Z",
        "first_responded_at": null,
        "resolved_at": null,
        "closed_at": null,
        "assigned_to": null,
        "assigned_at": null,
        "escalated": false,
        "escalated_at": null,
        "escalation_reason": null,
        "source": "telegram",
        "tags": null,
        "created_at": "2024-01-05T10:00:00Z",
        "updated_at": "2024-01-05T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### Response (Error)

```json
{
  "success": false,
  "error": {
    "code": "FETCH_ERROR",
    "userMessage": "Ошибка загрузки тикетов",
    "devMessage": "Database connection failed"
  }
}
```

Status: `500 Internal Server Error`

---

### 2. Get Single Ticket

**GET** `/api/admin/tickets/[id]`

Get a single ticket by ID with all messages.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Ticket ID |

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": 1,
      "ticket_number": "TKT-2024-001",
      // ... all ticket fields
    },
    "messages": [
      {
        "id": 1,
        "ticket_id": 1,
        "sender_type": "user",
        "sender_id": "456789",
        "sender_name": "John Doe",
        "message": "I have a payment issue",
        "message_type": "text",
        "attachments": null,
        "ai_suggested_response": null,
        "ai_confidence": null,
        "telegram_message_id": 123,
        "created_at": "2024-01-05T10:00:00Z"
      }
    ],
    "messages_count": 5,
    "last_message_at": "2024-01-05T11:30:00Z"
  }
}
```

#### Response (Not Found)

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "userMessage": "Тикет не найден"
  }
}
```

Status: `404 Not Found`

---

### 3. Update Ticket

**PATCH** `/api/admin/tickets/[id]`

Update ticket fields (status, priority, category, assigned_to).

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Ticket ID |

#### Request Body

```json
{
  "status": "in_progress",
  "priority": "P2",
  "category": "technical",
  "assigned_to": "operator@admin.com"
}
```

All fields are optional. Include only fields you want to update.

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": 1,
      "ticket_number": "TKT-2024-001",
      // ... updated ticket fields
    }
  }
}
```

#### Response (No Changes)

```json
{
  "success": false,
  "error": {
    "code": "NO_CHANGES",
    "userMessage": "Нет изменений для сохранения"
  }
}
```

Status: `400 Bad Request`

---

### 4. Get Ticket Messages

**GET** `/api/admin/tickets/[id]/messages`

Get all messages for a specific ticket.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Ticket ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 100 | Max messages to return (min: 1, max: 200) |

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": 1,
        "ticket_id": 1,
        "sender_type": "user",
        "sender_id": "456789",
        "sender_name": "John Doe",
        "message": "Hello, I need help",
        "message_type": "text",
        "attachments": null,
        "ai_suggested_response": null,
        "ai_confidence": null,
        "telegram_message_id": 123,
        "created_at": "2024-01-05T10:00:00Z"
      }
    ],
    "total": 5
  }
}
```

---

### 5. Add Ticket Message

**POST** `/api/admin/tickets/[id]/messages`

Add an operator response message and send notification to user via Telegram.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Ticket ID |

#### Request Body

```json
{
  "message": "Thank you for contacting support. We're looking into your issue.",
  "messageType": "text"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | string | Yes | - | Message text (cannot be empty) |
| `messageType` | string | No | "text" | Message type: "text" or "system_note" |

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "message": {
      "id": 10,
      "ticket_id": 1,
      "sender_type": "operator",
      "sender_id": "1",
      "sender_name": "Admin User",
      "message": "Thank you for contacting support...",
      "message_type": "text",
      "attachments": null,
      "ai_suggested_response": null,
      "ai_confidence": null,
      "telegram_message_id": null,
      "created_at": "2024-01-05T12:00:00Z"
    }
  }
}
```

#### Behavior

- When `messageType` is `"text"`, a Telegram notification is sent to the user
- The notification includes the message content and a prompt for the user to respond
- When `messageType` is `"system_note"`, no Telegram notification is sent
- The ticket's `first_responded_at` is automatically set if this is the first operator response
- The ticket status is automatically changed to `"in_progress"` if it was `"open"`

#### Response (Invalid Message)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_MESSAGE",
    "userMessage": "Сообщение не может быть пустым"
  }
}
```

Status: `400 Bad Request`

---

### 6. Assign Ticket

**POST** `/api/admin/tickets/[id]/assign`

Assign a ticket to an operator.

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Ticket ID |

#### Request Body

```json
{
  "operatorUsername": "operator@admin.com"
}
```

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "ticket": {
      "id": 1,
      "ticket_number": "TKT-2024-001",
      "assigned_to": "operator@admin.com",
      "assigned_at": "2024-01-05T12:00:00Z",
      "status": "in_progress",
      // ... other ticket fields
    }
  }
}
```

#### Behavior

- Sets `assigned_to` and `assigned_at` fields
- Changes ticket status to `"in_progress"`
- Adds a system message: "Тикет назначен оператору {username}"
- Logs the assignment action in admin audit log

#### Response (Invalid Operator)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_OPERATOR",
    "userMessage": "Имя оператора не может быть пустым"
  }
}
```

Status: `400 Bad Request`

---

### 7. Get Ticket Statistics

**GET** `/api/admin/tickets/stats`

Get ticket statistics for admin dashboard.

#### Response (Success)

```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 150,
      "open": 25,
      "inProgress": 30,
      "resolved": 85,
      "slaBreached": 5,
      "avgResponseMinutes": 45
    }
  }
}
```

#### Statistics Fields

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total tickets in last 30 days |
| `open` | number | Tickets with status "open" |
| `inProgress` | number | Tickets with status "in_progress" |
| `resolved` | number | Tickets with status "resolved" or "closed" |
| `slaBreached` | number | Open tickets past first response SLA |
| `avgResponseMinutes` | number | Average time to first response (rounded) |

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "userMessage": "User-friendly error message in Russian",
    "devMessage": "Technical error details (optional)"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | No valid admin session | 401 |
| `INVALID_ID` | Invalid ticket ID format | 400 |
| `NOT_FOUND` | Ticket not found | 404 |
| `FETCH_ERROR` | Database fetch error | 500 |
| `UPDATE_ERROR` | Database update error | 500 |
| `CREATE_ERROR` | Database create error | 500 |
| `ASSIGN_ERROR` | Ticket assignment error | 500 |
| `INVALID_MESSAGE` | Empty message text | 400 |
| `INVALID_OPERATOR` | Empty operator username | 400 |
| `NO_CHANGES` | No fields to update | 400 |

---

## Admin Action Logging

All mutation operations (PATCH, POST) are logged to the admin audit log using `logAdminAction()`:

- `ticket_updated` - Ticket fields updated
- `ticket_message_sent` - Operator message sent
- `ticket_assigned` - Ticket assigned to operator

Each log entry includes:
- `adminId` - ID of admin who performed the action
- `action` - Action type
- `targetId` - Ticket ID
- `metadata` - Additional context (ticket_number, changes, etc.)

---

## Integration with Telegram

### Notification Behavior

When an operator sends a message (POST to `/tickets/[id]/messages`):

1. Message is saved to database
2. Ticket's `first_responded_at` is set (if first response)
3. Ticket status changes to `"in_progress"`
4. Telegram notification is sent to user's `telegram_chat_id`
5. User receives formatted message with inline keyboard button

### Telegram Notification Format

```
📨 Новое сообщение по тикету TKT-2024-001

[Message content]

Вы можете ответить, отправив сообщение в этот чат.
```

With button: "📸 Открыть PinGlass" (opens web app)

### Notification Failures

If Telegram notification fails:
- Error is logged but not thrown
- Request still succeeds (message saved)
- Admin can retry manually if needed

---

## File Locations

All files created in this implementation:

```
app/api/admin/tickets/
├── route.ts                        # List tickets (GET)
├── [id]/
│   ├── route.ts                    # Get/Update ticket (GET, PATCH)
│   ├── messages/
│   │   └── route.ts                # Get/Add messages (GET, POST)
│   └── assign/
│       └── route.ts                # Assign ticket (POST)
└── stats/
    └── route.ts                    # Get statistics (GET)
```

---

## Dependencies

All endpoints use:

- `getCurrentSession()` from `@/lib/admin/session` - Admin authentication
- `query()` from `@/lib/db` - Database queries
- `logAdminAction()` from `@/lib/admin/audit` - Admin action logging
- Ticket service functions from `@/lib/support`:
  - `getTicketsForAdmin()`
  - `getTicketById()`
  - `getTicketMessages()`
  - `addMessage()`
  - `updateTicketStatus()`
  - `assignTicket()`
  - `getTicketStats()`
- `sendTextNotification()` from `@/lib/telegram-notify` - Telegram notifications

---

## Testing Recommendations

### Manual Testing Checklist

1. **List Tickets**
   - [ ] Test pagination (page 1, 2, etc.)
   - [ ] Test status filters (open, in_progress, all)
   - [ ] Test priority filters (P1, P2, P3, P4, all)
   - [ ] Test search functionality
   - [ ] Test assignedTo filter
   - [ ] Test combined filters

2. **Get Single Ticket**
   - [ ] Test valid ticket ID
   - [ ] Test invalid ticket ID (404)
   - [ ] Verify messages are included
   - [ ] Verify message count is correct

3. **Update Ticket**
   - [ ] Update status only
   - [ ] Update priority only
   - [ ] Update category only
   - [ ] Update assigned_to only
   - [ ] Update multiple fields at once
   - [ ] Test with no changes (400)
   - [ ] Test invalid ticket ID (404)

4. **Get Messages**
   - [ ] Get all messages
   - [ ] Test limit parameter
   - [ ] Test with ticket with no messages
   - [ ] Test invalid ticket ID (404)

5. **Add Message**
   - [ ] Add text message (verify Telegram sent)
   - [ ] Add system_note (verify no Telegram)
   - [ ] Test empty message (400)
   - [ ] Test invalid ticket ID (404)
   - [ ] Verify first_responded_at is set on first response
   - [ ] Verify status changes to in_progress

6. **Assign Ticket**
   - [ ] Assign to valid operator
   - [ ] Test empty operator username (400)
   - [ ] Verify status changes to in_progress
   - [ ] Verify system message is added
   - [ ] Test reassignment (change assignee)
   - [ ] Test invalid ticket ID (404)

7. **Get Statistics**
   - [ ] Verify all stat fields are present
   - [ ] Verify counts match actual tickets
   - [ ] Test with no tickets

### Integration Testing

Create integration tests in `tests/integration/admin/tickets/`:

```typescript
describe('Admin Tickets API', () => {
  describe('GET /api/admin/tickets', () => {
    it('should list tickets with pagination', async () => {
      // Test implementation
    })
  })

  describe('PATCH /api/admin/tickets/[id]', () => {
    it('should update ticket status', async () => {
      // Test implementation
    })
  })

  describe('POST /api/admin/tickets/[id]/messages', () => {
    it('should send message and Telegram notification', async () => {
      // Test implementation
    })
  })
})
```

---

## Security Considerations

1. **Authentication**: All endpoints verify admin session
2. **Authorization**: Consider adding role-based permissions (future enhancement)
3. **Input Validation**: All user inputs are validated and sanitized
4. **SQL Injection**: Using parameterized queries via `query()` function
5. **Logging**: All mutations are logged to audit trail
6. **Error Messages**: User-friendly messages don't expose internal details

---

## Future Enhancements

1. **Role-Based Access Control**
   - Restrict certain operations to super_admin only
   - Add operator-level permissions

2. **Bulk Operations**
   - Bulk status updates
   - Bulk assignment

3. **Ticket Templates**
   - Quick response templates
   - Canned responses integration

4. **Advanced Filtering**
   - Filter by date range
   - Filter by escalation status
   - Filter by category

5. **Real-Time Updates**
   - WebSocket support for live ticket updates
   - Real-time notification to operators

6. **Attachments**
   - Support file uploads in messages
   - Image preview in admin panel

7. **SLA Monitoring**
   - Alerts for SLA breaches
   - Escalation automation

---

## Version

**API Version**: 1.0.0
**Created**: 2026-01-05
**Status**: Production Ready
