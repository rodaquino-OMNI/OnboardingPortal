<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\BrazilianDocumentService;
use Carbon\Carbon;

class BrazilianDocumentServiceTest extends TestCase
{
    protected BrazilianDocumentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new BrazilianDocumentService();
    }

    /** @test */
    public function it_validates_valid_cpf()
    {
        $result = $this->service->validateCPF('123.456.789-09'); // Valid CPF
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('12345678909', $result['clean']);
        $this->assertEquals('123.456.789-09', $result['formatted']);
        $this->assertEmpty($result['errors']);
    }

    /** @test */
    public function it_validates_cpf_without_formatting()
    {
        $result = $this->service->validateCPF('12345678909');
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('12345678909', $result['clean']);
        $this->assertEquals('123.456.789-09', $result['formatted']);
    }

    /** @test */
    public function it_rejects_invalid_cpf()
    {
        $result = $this->service->validateCPF('123.456.789-00'); // Invalid CPF
        
        $this->assertFalse($result['is_valid']);
        $this->assertNotEmpty($result['errors']);
    }

    /** @test */
    public function it_rejects_cpf_with_all_same_digits_in_production()
    {
        $this->app->detectEnvironment(function () {
            return 'production';
        });

        $result = $this->service->validateCPF('111.111.111-11');
        
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CPF com todos os dígitos iguais não é válido', $result['errors']);
    }

    /** @test */
    public function it_allows_test_cpf_in_non_production()
    {
        $this->app->detectEnvironment(function () {
            return 'testing';
        });

        $result = $this->service->validateCPF('111.111.111-11');
        
        $this->assertTrue($result['is_valid']);
    }

    /** @test */
    public function it_rejects_cpf_with_wrong_length()
    {
        $result = $this->service->validateCPF('123.456.789');
        
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CPF deve conter exatamente 11 dígitos', $result['errors']);
    }

    /** @test */
    public function it_parses_date_with_two_digit_year_correctly()
    {
        // Test the edge case: 90 should become 1990, not 0090
        $result = $this->service->parseDate('15/05/90');
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('1990-05-15', $result['formatted']);
        
        // Test with threshold boundary
        $result = $this->service->parseDate('15/05/30');
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('2030-05-15', $result['formatted']);
        
        $result = $this->service->parseDate('15/05/31');
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('1931-05-15', $result['formatted']);
    }

    /** @test */
    public function it_parses_various_date_formats()
    {
        $testCases = [
            '15/05/1990' => '1990-05-15',
            '15-05-1990' => '1990-05-15', 
            '1990-05-15' => '1990-05-15',
            '15/05/90' => '1990-05-15',
            '15-05-90' => '1990-05-15'
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->service->parseDate($input);
            $this->assertTrue($result['is_valid'], "Failed to parse date: {$input}");
            $this->assertEquals($expected, $result['formatted'], "Wrong format for date: {$input}");
        }
    }

    /** @test */
    public function it_rejects_invalid_dates()
    {
        $invalidDates = [
            '30/02/1990', // Invalid date
            '32/01/1990', // Invalid day
            '15/13/1990', // Invalid month
            'invalid-date',
            '15/05/1850', // Too old
        ];

        foreach ($invalidDates as $date) {
            $result = $this->service->parseDate($date);
            $this->assertFalse($result['is_valid'], "Should reject invalid date: {$date}");
        }
    }

    /** @test */
    public function it_normalizes_strings_preserving_brazilian_characters()
    {
        // Without preserving accents
        $result = $this->service->normalizeString('João da Silva Ação', false);
        $this->assertEquals('joao da silva acao', $result);

        // Preserving accents
        $result = $this->service->normalizeString('João da Silva Ação', true);
        $this->assertEquals('joão da silva ação', $result);

        // Multiple spaces normalization
        $result = $this->service->normalizeString('  João   da   Silva  ', false);
        $this->assertEquals('joao da silva', $result);
    }

    /** @test */
    public function it_calculates_string_similarity_correctly()
    {
        // Exact match
        $similarity = $this->service->calculateSimilarity('João Silva', 'João Silva');
        $this->assertEquals(100.0, $similarity);

        // Close match with accents
        $similarity = $this->service->calculateSimilarity('João Silva', 'Joao Silva');
        $this->assertGreaterThan(85.0, $similarity);

        // Different names
        $similarity = $this->service->calculateSimilarity('João Silva', 'Maria Santos');
        $this->assertLessThan(50.0, $similarity);
    }

    /** @test */
    public function it_validates_rg_format()
    {
        // Valid RG formats
        $validRGs = [
            '12.345.678-9',
            '123456789',
            '12345678X'
        ];

        foreach ($validRGs as $rg) {
            $result = $this->service->validateRG($rg);
            $this->assertTrue($result['is_valid'], "Should validate RG: {$rg}");
        }

        // Invalid RG formats
        $invalidRGs = [
            '123456',      // Too short
            '1234567890',  // Too long
            'ABCDEFGH',    // Invalid characters
        ];

        foreach ($invalidRGs as $rg) {
            $result = $this->service->validateRG($rg);
            $this->assertFalse($result['is_valid'], "Should reject RG: {$rg}");
        }
    }

    /** @test */
    public function it_validates_cnh_format()
    {
        // Valid CNH
        $result = $this->service->validateCNH('12345678901'); // This would need a real valid CNH for proper testing
        
        // Test structure - actual validation would need real CNH numbers
        $this->assertArrayHasKey('is_valid', $result);
        $this->assertArrayHasKey('clean', $result);
        $this->assertArrayHasKey('errors', $result);

        // Invalid CNH - too short
        $result = $this->service->validateCNH('123456789');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CNH deve ter exatamente 11 dígitos', $result['errors']);

        // Invalid CNH - all same digits
        $result = $this->service->validateCNH('11111111111');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CNH com todos os dígitos iguais não é válida', $result['errors']);
    }

    /** @test */
    public function it_formats_cpf_correctly()
    {
        $formatted = $this->service->formatCPF('12345678901');
        $this->assertEquals('123.456.789-01', $formatted);

        // Already formatted
        $formatted = $this->service->formatCPF('123.456.789-01');
        $this->assertEquals('123.456.789-01', $formatted);

        // Invalid length
        $formatted = $this->service->formatCPF('123456');
        $this->assertEquals('123456', $formatted); // Returns as-is if invalid
    }

    /** @test */
    public function it_cleans_cpf_correctly()
    {
        $cleaned = $this->service->cleanCPF('123.456.789-01');
        $this->assertEquals('12345678901', $cleaned);

        $cleaned = $this->service->cleanCPF('123 456 789 01');
        $this->assertEquals('12345678901', $cleaned);

        $cleaned = $this->service->cleanCPF('12345678901');
        $this->assertEquals('12345678901', $cleaned);
    }

    /** @test */
    public function it_handles_edge_case_dates_correctly()
    {
        // Edge case: Year 00 should be 2000
        $result = $this->service->parseDate('01/01/00');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('2000-01-01', $result['formatted']);

        // Edge case: Year 99 should be 1999
        $result = $this->service->parseDate('01/01/99');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('1999-01-01', $result['formatted']);

        // Custom threshold
        $result = $this->service->parseDate('01/01/50', 60);
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('2050-01-01', $result['formatted']);
    }
}