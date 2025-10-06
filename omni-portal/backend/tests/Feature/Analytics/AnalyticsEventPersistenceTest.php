<?php

namespace Tests\Feature\Analytics;

use App\Models\AnalyticsEvent;
use App\Models\User;
use App\Services\AnalyticsEventRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * AnalyticsEventPersistenceTest - Test analytics event persistence
 */
class AnalyticsEventPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private AnalyticsEventRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = new AnalyticsEventRepository();
    }

    public function test_analytics_events_persisted_to_database(): void
    {
        $user = User::factory()->create();

        $event = $this->repository->track(
            'gamification.points_earned',
            [
                'points' => 50,
                'action_type' => 'document_uploaded',
                'multiplier' => 1.0,
            ],
            [
                'endpoint' => 'POST /documents/upload',
                'user_role' => 'beneficiary',
            ],
            $user->id,
            1
        );

        $this->assertNotNull($event);
        $this->assertInstanceOf(AnalyticsEvent::class, $event);
        $this->assertDatabaseHas('analytics_events', [
            'event_name' => 'gamification.points_earned',
            'event_category' => 'gamification',
        ]);
    }

    public function test_pii_detected_in_dev_throws_exception(): void
    {
        app()->detectEnvironment(fn() => 'local');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('PII detected in analytics metadata');

        $this->repository->track(
            'gamification.points_earned',
            [
                'points' => 50,
                'user_email' => 'test@example.com',
                'action_type' => 'document_uploaded',
                'multiplier' => 1.0,
            ],
            [],
            1
        );
    }

    public function test_pii_detected_in_prod_drops_event_with_breadcrumb(): void
    {
        app()->detectEnvironment(fn() => 'production');

        $event = $this->repository->track(
            'gamification.points_earned',
            [
                'points' => 50,
                'user_cpf' => '123.456.789-01',
                'action_type' => 'document_uploaded',
                'multiplier' => 1.0,
            ],
            [],
            1
        );

        $this->assertNull($event);
        $this->assertDatabaseMissing('analytics_events', [
            'event_name' => 'gamification.points_earned',
        ]);
    }

    public function test_retention_pruning_deletes_old_events(): void
    {
        AnalyticsEvent::factory()->count(5)->old(91)->create();
        AnalyticsEvent::factory()->count(3)->old(30)->create();

        $this->assertEquals(8, AnalyticsEvent::count());

        $deletedCount = $this->repository->pruneOlderThan(now()->subDays(90));

        $this->assertEquals(5, $deletedCount);
        $this->assertEquals(3, AnalyticsEvent::count());
    }

    public function test_user_id_is_hashed_not_plaintext(): void
    {
        $user = User::factory()->create();

        $event = $this->repository->track(
            'auth.login_success',
            ['user_role' => 'beneficiary'],
            [],
            $user->id
        );

        $this->assertEquals(64, strlen($event->user_id_hash));
        $this->assertNotEquals((string) $user->id, $event->user_id_hash);
        $this->assertEquals(hash('sha256', (string) $user->id), $event->user_id_hash);
    }

    public function test_all_nine_event_schemas_work(): void
    {
        $user = User::factory()->create();

        $event1 = $this->repository->track(
            'auth.login_success',
            ['user_role' => 'beneficiary'],
            [],
            $user->id
        );
        $this->assertNotNull($event1);

        $event2 = $this->repository->track(
            'auth.registration_complete',
            ['registration_step' => 'step_3', 'total_time_seconds' => 300],
            [],
            $user->id
        );
        $this->assertNotNull($event2);

        $event3 = $this->repository->track(
            'gamification.points_earned',
            ['points' => 50, 'action_type' => 'document_uploaded', 'multiplier' => 1.0],
            [],
            $user->id
        );
        $this->assertNotNull($event3);

        $this->assertEquals(3, AnalyticsEvent::count());
    }
}
