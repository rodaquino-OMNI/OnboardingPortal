# Interview Scheduling API Architecture Specification

## 🏗️ System Overview

The Interview Scheduling API provides a comprehensive RESTful interface for managing healthcare professional availability, beneficiary interview bookings, and real-time conflict detection. This design follows existing Laravel patterns and integrates seamlessly with the current authentication, gamification, and notification systems.

## 🎯 Key Design Principles

- **RESTful Architecture**: Following existing `/api/` route patterns
- **Service Layer Pattern**: Business logic separated into dedicated services
- **Real-time Conflict Detection**: Immediate availability validation
- **Multi-timezone Support**: UTC storage with timezone conversion
- **Gamification Integration**: Interview milestones earn points
- **LGPD Compliance**: Data privacy and audit trails
- **Performance Optimized**: Indexed queries and caching strategies

## 📡 API Endpoint Structure

### 1. Interview Slots Management (Healthcare Professionals)

#### **GET /api/interview-slots**
*Retrieve available interview slots for the authenticated healthcare professional*

**Authentication**: `auth:sanctum` + `role:healthcare_professional`

**Query Parameters**:
```php
date_from: string (Y-m-d, optional) - Start date filter
date_to: string (Y-m-d, optional) - End date filter  
availability: boolean (optional) - Filter by availability status
type: string (optional) - Filter by interview type
timezone: string (optional) - Client timezone for display
page: integer (optional) - Pagination
per_page: integer (optional) - Items per page (max 100)
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "slots": [
      {
        "id": 1,
        "date": "2025-07-25",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "timezone_display": "2025-07-25 11:00:00 (GMT-03:00)",
        "is_available": true,
        "max_interviews": 3,
        "current_bookings": 1,
        "available_spots": 2,
        "location": "Online",
        "interview_type": "initial_assessment",
        "duration_minutes": 60,
        "created_at": "2025-07-23T20:00:00Z",
        "updated_at": "2025-07-23T20:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 15,
      "total": 45,
      "last_page": 3
    },
    "meta": {
      "total_available_slots": 28,
      "upcoming_interviews": 12,
      "timezone": "America/Sao_Paulo"
    }
  }
}
```

#### **POST /api/interview-slots**
*Create new interview slot availability*

**Request Body**:
```json
{
  "date": "2025-07-25",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "timezone": "America/Sao_Paulo",
  "slot_duration": 60,
  "break_duration": 15,
  "max_interviews_per_slot": 3,
  "interview_types": ["initial_assessment", "follow_up"],
  "location": "Online",
  "notes": "Available for urgent cases",
  "recurring": {
    "enabled": true,
    "frequency": "weekly",
    "end_date": "2025-12-31",
    "exceptions": ["2025-08-15", "2025-12-25"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Interview slots created successfully",
  "data": {
    "created_slots": 8,
    "slot_ids": [1, 2, 3, 4, 5, 6, 7, 8],
    "first_slot": {
      "id": 1,
      "date": "2025-07-25",
      "start_time": "09:00:00",
      "end_time": "10:00:00"
    }
  }
}
```

#### **PUT /api/interview-slots/{slot}**
*Update existing interview slot*

**Request Body**:
```json
{
  "is_available": false,
  "max_interviews": 2,
  "notes": "Limited availability due to emergency",
  "notification_preferences": {
    "notify_beneficiaries": true,
    "advance_notice_hours": 24
  }
}
```

### 2. Interview Booking (Beneficiaries)

#### **GET /api/interviews/available-slots**
*Get available interview slots for booking*

**Authentication**: `auth:sanctum` + `registration.completed`

**Query Parameters**:
```php
date_from: string (Y-m-d, optional)
date_to: string (Y-m-d, optional)
interview_type: string (optional)
timezone: string (optional)
interviewer_id: integer (optional)
preferred_time: string (morning|afternoon|evening, optional)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "available_slots": [
      {
        "slot_id": 1,
        "interviewer": {
          "id": 15,
          "name": "Dr. Ana Silva",
          "specialization": "Psicologia Clínica",
          "rating": 4.8,
          "profile_photo": "https://storage.com/photos/ana-silva.jpg"
        },
        "date": "2025-07-25",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "timezone_display": "25/07/2025 às 11:00 (Horário de Brasília)",
        "duration_minutes": 60,
        "interview_type": "initial_assessment",
        "location": "Online",
        "available_spots": 2,
        "meeting_platform": "Google Meet",
        "preparation_required": [
          "Documentos de identidade",
          "Histórico médico recente"
        ]
      }
    ],
    "booking_info": {
      "can_reschedule": true,
      "cancellation_policy": "24 hours advance notice required",
      "timezone": "America/Sao_Paulo"
    }
  }
}
```

#### **POST /api/interviews**
*Book an interview appointment*

**Request Body**:
```json
{
  "interview_slot_id": 1,
  "interview_type": "initial_assessment",
  "timezone": "America/Sao_Paulo",
  "notes": "First time appointment, anxious about process",
  "contact_preference": "whatsapp",
  "emergency_contact": {
    "name": "Maria Santos",
    "phone": "+5511999888777",
    "relationship": "spouse"
  },
  "preparation_confirmed": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Interview scheduled successfully",
  "data": {
    "interview": {
      "id": 1,
      "reference_number": "INT-2025-001",
      "status": "scheduled",
      "scheduled_at": "2025-07-25T12:00:00Z",
      "display_time": "25/07/2025 às 09:00 (Horário de Brasília)",
      "duration_minutes": 60,
      "interviewer": {
        "name": "Dr. Ana Silva",
        "email": "ana.silva@hospital.com",
        "phone": "+5511988776655"
      },
      "meeting_details": {
        "platform": "Google Meet",
        "link": "https://meet.google.com/abc-defg-hij",
        "backup_phone": "+5511900000000"
      },
      "preparation_checklist": [
        "Prepare identity documents",
        "Review medical history",
        "Test camera and microphone"
      ]
    },
    "gamification": {
      "points_earned": 150,
      "achievement_unlocked": "Interview Scheduled",
      "next_milestone": "Complete First Interview (200 points)"
    },
    "notifications": {
      "email_confirmation_sent": true,
      "sms_reminder_scheduled": true,
      "calendar_invite_sent": true
    }
  }
}
```

### 3. Interview Management

#### **GET /api/interviews**
*List user's interviews*

**Query Parameters**:
```php
status: string (optional) - scheduled|completed|cancelled|rescheduled
upcoming: boolean (optional) - Filter upcoming interviews
page: integer (optional)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "interviews": [
      {
        "id": 1,
        "reference_number": "INT-2025-001",
        "status": "scheduled",
        "type": "initial_assessment",
        "scheduled_at": "2025-07-25T12:00:00Z",
        "display_time": "25/07/2025 às 09:00 (Horário de Brasília)",
        "interviewer": {
          "name": "Dr. Ana Silva",
          "photo": "https://storage.com/photos/ana-silva.jpg"
        },
        "meeting_link": "https://meet.google.com/abc-defg-hij",
        "can_reschedule": true,
        "can_cancel": true,
        "reschedule_deadline": "2025-07-24T12:00:00Z",
        "time_until_interview": "2 days, 5 hours"
      }
    ],
    "summary": {
      "total_interviews": 1,
      "upcoming": 1,
      "completed": 0,
      "cancelled": 0
    }
  }
}
```

#### **PUT /api/interviews/{interview}/reschedule**
*Reschedule an interview*

**Request Body**:
```json
{
  "new_interview_slot_id": 5,
  "reason": "Conflict with work schedule",
  "timezone": "America/Sao_Paulo"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Interview rescheduled successfully",
  "data": {
    "interview": {
      "id": 1,
      "status": "rescheduled",
      "old_scheduled_at": "2025-07-25T12:00:00Z",
      "new_scheduled_at": "2025-07-26T14:00:00Z",
      "rescheduled_count": 1,
      "max_reschedules": 3
    },
    "notifications": {
      "interviewer_notified": true,
      "confirmation_email_sent": true
    }
  }
}
```

#### **DELETE /api/interviews/{interview}**
*Cancel an interview*

**Request Body**:
```json
{
  "cancellation_reason": "Personal emergency",
  "notify_interviewer": true
}
```

### 4. Real-time Conflict Detection

#### **POST /api/interviews/check-availability**
*Validate slot availability before booking*

**Request Body**:
```json
{
  "interview_slot_id": 1,
  "beneficiary_id": 123,
  "requested_duration": 60
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "available": true,
    "slot_details": {
      "remaining_spots": 2,
      "conflicts": [],
      "recommended_preparation_time": 15,
      "interviewer_availability": "confirmed"
    },
    "alternative_slots": []
  }
}
```

### 5. Notification Management

#### **GET /api/interviews/notifications**
*Get interview-related notifications*

#### **POST /api/interviews/{interview}/notifications**
*Configure notification preferences*

**Request Body**:
```json
{
  "email_reminders": true,
  "sms_reminders": true,
  "reminder_intervals": [24, 2], // hours before interview
  "calendar_sync": true
}
```

## 🏗️ Service Layer Architecture

### InterviewSchedulingService

**Core Responsibilities**:
- Availability management and conflict detection
- Timezone conversion and validation
- Business rule enforcement
- Integration with gamification system

**Key Methods**:
```php
class InterviewSchedulingService
{
    public function createInterviewSlots(array $data): Collection
    public function checkAvailability(int $slotId, array $constraints): bool
    public function bookInterview(Beneficiary $beneficiary, array $data): Interview
    public function rescheduleInterview(Interview $interview, int $newSlotId): Interview
    public function cancelInterview(Interview $interview, string $reason): bool
    public function getAvailableSlots(array $filters): Collection
    public function detectConflicts(int $slotId, array $bookings): array
    public function convertTimezone(string $time, string $fromTz, string $toTz): string
}
```

### NotificationService (Extended)

**Interview-specific notifications**:
```php
class NotificationService
{
    public function sendInterviewConfirmation(Interview $interview): void
    public function sendReminderNotifications(Interview $interview): void
    public function sendRescheduleNotification(Interview $interview): void
    public function sendCancellationNotification(Interview $interview): void
    public function scheduleAutomaticReminders(Interview $interview): void
}
```

## 🚀 Performance Optimization Strategy

### Database Indexing
```sql
-- High-performance indexes for interview scheduling
CREATE INDEX idx_interview_slots_date_availability ON interview_slots(date, is_available);
CREATE INDEX idx_interview_slots_interviewer_date ON interview_slots(interviewer_id, date, start_time);
CREATE INDEX idx_interviews_beneficiary_status ON interviews(beneficiary_id, status, scheduled_at);
CREATE INDEX idx_interviews_slot_status ON interviews(interview_slot_id, status);
CREATE INDEX idx_interviews_scheduled_at ON interviews(scheduled_at);
```

### Caching Strategy
```php
// Cache frequently accessed data
Cache::remember("available_slots_{$date}_{$interviewerId}", 300, function() {
    return $this->getAvailableSlots($date, $interviewerId);
});

// Cache user's upcoming interviews
Cache::remember("user_interviews_{$userId}", 600, function() {
    return $this->getUserInterviews($userId);
});
```

### Query Optimization
```php
// Optimized availability query with eager loading
$availableSlots = InterviewSlot::with(['interviewer:id,name,specialization'])
    ->where('date', '>=', now()->toDateString())
    ->where('is_available', true)
    ->whereRaw('current_bookings < max_interviews')
    ->orderBy('date')
    ->orderBy('start_time')
    ->paginate(15);
```

## 🔒 Security & LGPD Compliance

### Data Protection
```php
// Audit trail for LGPD compliance
class InterviewAuditLog extends Model
{
    protected $fillable = [
        'interview_id',
        'action',
        'actor_id',
        'actor_type',
        'old_data',
        'new_data',
        'ip_address',
        'user_agent',
        'gdpr_lawful_basis'
    ];
}
```

### Access Control
- Role-based permissions for healthcare professionals vs beneficiaries
- Interview data encryption for sensitive information
- Automatic data anonymization after retention period

## 🎮 Gamification Integration

### Point System
```php
const INTERVIEW_POINTS = [
    'interview_scheduled' => 150,
    'interview_completed' => 200,
    'interview_early_arrival' => 25,
    'interview_feedback_provided' => 50,
    'consecutive_interviews_attended' => 100, // Streak bonus
];
```

### Achievement Integration
- "Punctual Patient" - Attend 5 interviews on time
- "Health Journey Starter" - Complete first interview
- "Wellness Warrior" - Complete 10 interviews

## 🌍 Multi-timezone Support

### Timezone Handling Strategy
```php
class TimezoneService
{
    public function convertToUserTimezone(string $utcTime, string $userTimezone): string
    {
        return Carbon::parse($utcTime, 'UTC')
            ->setTimezone($userTimezone)
            ->format('Y-m-d H:i:s T');
    }
    
    public function getBusinessHours(string $timezone): array
    {
        // Return business hours for specific timezone
        return [
            'start' => '08:00:00',
            'end' => '18:00:00',
            'timezone' => $timezone
        ];
    }
}
```

## 📊 Real-time Conflict Detection Algorithm

### Conflict Detection Logic
```php
public function detectConflicts(int $slotId, array $constraints): array
{
    $slot = InterviewSlot::with('interviews')->find($slotId);
    $conflicts = [];
    
    // Check slot capacity
    if ($slot->current_bookings >= $slot->max_interviews) {
        $conflicts[] = ['type' => 'capacity', 'message' => 'Slot fully booked'];
    }
    
    // Check interviewer availability
    if (!$this->isInterviewerAvailable($slot->interviewer_id, $slot->date, $slot->start_time)) {
        $conflicts[] = ['type' => 'interviewer_conflict', 'message' => 'Interviewer has conflicting appointment'];
    }
    
    // Check beneficiary conflicts
    if ($this->hasBeneficiaryConflict($constraints['beneficiary_id'], $slot->scheduled_at)) {
        $conflicts[] = ['type' => 'beneficiary_conflict', 'message' => 'You have another appointment at this time'];
    }
    
    return $conflicts;
}
```

## 🔄 Integration Points

### Existing System Integration
1. **Authentication**: Seamless integration with `auth:sanctum` middleware
2. **Gamification**: Automatic point allocation for interview milestones
3. **Notifications**: Leverages existing notification infrastructure
4. **User Management**: Integrates with User and Beneficiary models
5. **LGPD Compliance**: Extends existing privacy and consent management

### Middleware Stack
```php
Route::middleware(['auth:sanctum', 'registration.completed', 'account.active'])
    ->prefix('interviews')
    ->group(function () {
        // Interview booking routes
    });

Route::middleware(['auth:sanctum', 'role:healthcare_professional'])
    ->prefix('interview-slots')
    ->group(function () {
        // Healthcare professional routes
    });
```

## 📈 Monitoring & Analytics

### Key Metrics
- Interview booking conversion rate
- Average time to schedule
- Cancellation and reschedule rates
- Healthcare professional utilization
- Peak booking times and patterns

### Performance Monitoring
```php
// Track API response times
Route::middleware(['prometheus.metrics'])
    ->prefix('api/interviews')
    ->group(function () {
        // All interview routes with automatic metrics
    });
```

---

## 🚀 Implementation Roadmap

### Phase 1: Core API Development (Week 1-2)
- Implement basic CRUD operations for interview slots
- Build interview booking functionality
- Set up service layer architecture

### Phase 2: Advanced Features (Week 3-4)
- Real-time conflict detection
- Multi-timezone support
- Notification system integration

### Phase 3: Integration & Optimization (Week 5-6)
- Gamification integration
- Performance optimization
- Security auditing and LGPD compliance

### Phase 4: Testing & Deployment (Week 7-8)
- Comprehensive API testing
- Load testing and performance validation
- Production deployment with monitoring

This API architecture provides a robust, scalable, and user-friendly interview scheduling system that seamlessly integrates with the existing onboarding portal infrastructure while maintaining high performance and security standards.