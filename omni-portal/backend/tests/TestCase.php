<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

/**
 * Base TestCase for all tests
 *
 * Provides common test setup and utilities
 */
abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * Setup the test environment.
     *
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        // Disable query logging to improve test performance
        \DB::connection()->disableQueryLog();

        // Set testing environment
        putenv('APP_ENV=testing');
    }
}
