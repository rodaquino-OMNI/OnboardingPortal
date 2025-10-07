<?php

namespace Tests\Feature\SliceB;

use Tests\TestCase;
use App\Models\FeatureFlag;
use App\Services\FeatureFlagService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * FeatureFlagService Comprehensive Test Suite
 *
 * Purpose: Verify complete feature flag service functionality
 *
 * Coverage:
 * - isEnabled() returns boolean
 * - Rollout percentage respected
 * - Environment filtering works
 * - Flag toggle updates database
 * - Cache invalidation on update
 * - Default values for missing flags
 * - Flag creation validation
 * - Bulk flag operations
 *
 * Target: ≥75% service coverage
 */
class FeatureFlagServiceTest extends TestCase
{
    use RefreshDatabase;

    private FeatureFlagService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new FeatureFlagService();

        // Clear cache before each test
        Cache::flush();
    }

    /**
     * Test: isEnabled returns boolean
     *
     * @test
     */
    public function is_enabled_returns_boolean(): void
    {
        FeatureFlag::create([
            'key' => 'test_feature',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        $result = $this->service->isEnabled('test_feature');

        $this->assertIsBool($result);
        $this->assertTrue($result);

        // Test disabled flag
        FeatureFlag::create([
            'key' => 'disabled_feature',
            'enabled' => false,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        $result = $this->service->isEnabled('disabled_feature');
        $this->assertFalse($result);
    }

    /**
     * Test: Rollout percentage respected
     *
     * @test
     */
    public function rollout_percentage_respected(): void
    {
        // 0% rollout - nobody gets it
        FeatureFlag::create([
            'key' => 'zero_percent',
            'enabled' => true,
            'rollout_percentage' => 0,
            'environments' => ['testing'],
        ]);

        $this->assertFalse($this->service->isEnabled('zero_percent', 1));
        $this->assertFalse($this->service->isEnabled('zero_percent', 100));

        // 100% rollout - everyone gets it
        FeatureFlag::create([
            'key' => 'hundred_percent',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        $this->assertTrue($this->service->isEnabled('hundred_percent', 1));
        $this->assertTrue($this->service->isEnabled('hundred_percent', 100));

        // 50% rollout - consistent hashing
        FeatureFlag::create([
            'key' => 'fifty_percent',
            'enabled' => true,
            'rollout_percentage' => 50,
            'environments' => ['testing'],
        ]);

        // Same user ID should always get same result
        $result1 = $this->service->isEnabled('fifty_percent', 42);
        $result2 = $this->service->isEnabled('fifty_percent', 42);
        $this->assertEquals($result1, $result2);
    }

    /**
     * Test: Environment filtering works
     *
     * @test
     */
    public function environment_filtering_works(): void
    {
        // Flag enabled only in production
        FeatureFlag::create([
            'key' => 'prod_only',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['production'],
        ]);

        // Should be disabled in testing environment
        $this->assertFalse($this->service->isEnabled('prod_only'));

        // Flag enabled in testing environment
        FeatureFlag::create([
            'key' => 'test_enabled',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        $this->assertTrue($this->service->isEnabled('test_enabled'));

        // Flag with empty environments (allowed everywhere)
        FeatureFlag::create([
            'key' => 'all_envs',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => [],
        ]);

        $this->assertTrue($this->service->isEnabled('all_envs'));
    }

    /**
     * Test: Flag toggle updates database
     *
     * @test
     */
    public function flag_toggle_updates_database(): void
    {
        $flag = FeatureFlag::create([
            'key' => 'toggleable',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        // Toggle off
        $result = $this->service->toggle('toggleable');
        $this->assertFalse($result);
        $this->assertFalse($flag->fresh()->enabled);

        // Toggle on
        $result = $this->service->toggle('toggleable');
        $this->assertTrue($result);
        $this->assertTrue($flag->fresh()->enabled);
    }

    /**
     * Test: Cache invalidation on update
     *
     * @test
     */
    public function cache_invalidation_on_update(): void
    {
        $flag = FeatureFlag::create([
            'key' => 'cached_flag',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        // First call caches the flag
        $this->assertTrue($this->service->isEnabled('cached_flag'));

        // Verify it's in cache
        $this->assertTrue(Cache::has('feature_flag:cached_flag'));

        // Update the flag
        $this->service->set('cached_flag', false);

        // Cache should be invalidated
        $this->assertFalse(Cache::has('feature_flag:cached_flag'));

        // New value should be returned
        $this->assertFalse($this->service->isEnabled('cached_flag'));
    }

    /**
     * Test: Default values for missing flags
     *
     * @test
     */
    public function default_values_for_missing_flags(): void
    {
        // Non-existent flag should default to false
        $result = $this->service->isEnabled('nonexistent_flag');

        $this->assertFalse($result);
    }

    /**
     * Test: Flag creation validation
     *
     * @test
     */
    public function flag_creation_validation(): void
    {
        // Valid rollout percentage
        $flag = $this->service->set('valid_flag', true, 50, ['testing']);

        $this->assertNotNull($flag);
        $this->assertEquals(50, $flag->rollout_percentage);

        // Invalid rollout percentage - too high
        $this->expectException(\InvalidArgumentException::class);
        $this->service->set('invalid_flag', true, 101, ['testing']);
    }

    /**
     * Test: Invalid rollout percentage - negative
     *
     * @test
     */
    public function invalid_rollout_percentage_negative(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Rollout percentage must be between 0 and 100');

        $this->service->set('invalid_flag', true, -1, ['testing']);
    }

    /**
     * Test: Bulk flag operations
     *
     * @test
     */
    public function bulk_flag_operations(): void
    {
        // Create multiple flags
        $this->service->set('flag1', true, 100, ['testing'], 'First flag');
        $this->service->set('flag2', false, 50, ['production'], 'Second flag');
        $this->service->set('flag3', true, 25, ['staging'], 'Third flag');

        // Get all flags
        $flags = $this->service->all();

        $this->assertCount(3, $flags);

        // Clear all cache
        $this->service->clearAllCache();

        // Verify cache is cleared for all flags
        $this->assertFalse(Cache::has('feature_flag:flag1'));
        $this->assertFalse(Cache::has('feature_flag:flag2'));
        $this->assertFalse(Cache::has('feature_flag:flag3'));
    }

    /**
     * Test: Delete flag removes from database
     *
     * @test
     */
    public function delete_flag_removes_from_database(): void
    {
        FeatureFlag::create([
            'key' => 'to_delete',
            'enabled' => true,
            'rollout_percentage' => 100,
            'environments' => ['testing'],
        ]);

        $result = $this->service->delete('to_delete');

        $this->assertTrue($result);
        $this->assertDatabaseMissing('feature_flags', ['key' => 'to_delete']);

        // Deleting non-existent flag returns false
        $result = $this->service->delete('nonexistent');
        $this->assertFalse($result);
    }

    /**
     * Test: Flag update preserves key
     *
     * @test
     */
    public function flag_update_preserves_key(): void
    {
        $flag = $this->service->set('updateable', true, 100, ['testing']);

        // Update the flag
        $updated = $this->service->set('updateable', false, 50, ['production'], 'Updated description');

        $this->assertEquals($flag->id, $updated->id);
        $this->assertEquals('updateable', $updated->key);
        $this->assertFalse($updated->enabled);
        $this->assertEquals(50, $updated->rollout_percentage);
        $this->assertEquals(['production'], $updated->environments);
        $this->assertEquals('Updated description', $updated->description);
    }

    /**
     * Test: Logging on flag changes
     *
     * @test
     */
    public function logging_on_flag_changes(): void
    {
        Log::shouldReceive('info')
            ->once()
            ->with('Feature flag updated', \Mockery::on(function ($context) {
                return $context['key'] === 'logged_flag' &&
                       $context['enabled'] === true &&
                       $context['rollout_percentage'] === 75;
            }));

        $this->service->set('logged_flag', true, 75, ['testing']);
    }
}
