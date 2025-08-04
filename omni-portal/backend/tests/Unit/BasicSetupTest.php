<?php

namespace Tests\Unit;

use Tests\TestCase;

class BasicSetupTest extends TestCase
{
    /**
     * Test that the test environment is properly configured.
     */
    public function test_environment_is_testing(): void
    {
        $this->assertEquals('testing', app()->environment());
    }

    /**
     * Test that database connection is sqlite memory.
     */
    public function test_database_is_sqlite_memory(): void
    {
        $this->assertEquals('sqlite', config('database.default'));
        $this->assertEquals(':memory:', config('database.connections.sqlite.database'));
    }

    /**
     * Test that cache driver is array.
     */
    public function test_cache_driver_is_array(): void
    {
        $this->assertEquals('array', config('cache.default'));
    }

    /**
     * Test that basic assertions work.
     */
    public function test_basic_assertion(): void
    {
        $this->assertTrue(true);
        $this->assertFalse(false);
        $this->assertEquals(2, 1 + 1);
    }
}