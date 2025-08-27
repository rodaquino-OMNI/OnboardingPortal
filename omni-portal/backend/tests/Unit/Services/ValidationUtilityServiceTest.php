<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\ValidationUtilityService;
use App\Services\BrazilianDocumentService;

class ValidationUtilityServiceTest extends TestCase
{
    protected ValidationUtilityService $service;
    protected BrazilianDocumentService $documentService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->documentService = new BrazilianDocumentService();
        $this->service = new ValidationUtilityService($this->documentService);
    }

    /** @test */
    public function it_validates_ocr_confidence_scores()
    {
        // High confidence scores
        $result = $this->service->validateOCRConfidence([95, 90, 88, 92]);
        
        $this->assertTrue($result['is_acceptable']);
        $this->assertFalse($result['needs_fallback']);
        $this->assertFalse($result['needs_retry']);
        $this->assertEquals('excellent', $result['quality_level']);
        $this->assertGreaterThan(90, $result['average_confidence']);

        // Low confidence scores
        $result = $this->service->validateOCRConfidence([30, 25, 35, 28]);
        
        $this->assertFalse($result['is_acceptable']);
        $this->assertTrue($result['needs_fallback']);
        $this->assertTrue($result['needs_retry']);
        $this->assertEquals('unacceptable', $result['quality_level']);
    }

    /** @test */
    public function it_validates_ocr_confidence_with_custom_thresholds()
    {
        $customThresholds = [
            'min_confidence' => 80,
            'fallback_threshold' => 60,
            'retry_threshold' => 40
        ];

        $result = $this->service->validateOCRConfidence([75, 70, 78], $customThresholds);
        
        $this->assertFalse($result['is_acceptable']); // Below 80
        $this->assertFalse($result['needs_fallback']); // Above 60 (average is ~74)
        $this->assertFalse($result['needs_retry']); // Above 40
    }

    /** @test */
    public function it_validates_email_addresses()
    {
        // Valid email
        $result = $this->service->validateEmail('test@example.com');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('test@example.com', $result['normalized']);
        $this->assertEmpty($result['errors']);

        // Invalid email format
        $result = $this->service->validateEmail('invalid-email');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Formato de email inválido', $result['errors']);

        // Email too long
        $longEmail = str_repeat('a', 250) . '@example.com';
        $result = $this->service->validateEmail($longEmail);
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Email muito longo (máximo 255 caracteres)', $result['errors']);

        // Email with consecutive dots
        $result = $this->service->validateEmail('test..email@example.com');
        $this->assertFalse($result['is_valid']); // Should be caught by filter_var
    }

    /** @test */
    public function it_validates_brazilian_phone_numbers()
    {
        // Valid mobile phone
        $result = $this->service->validatePhone('11999887766');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('mobile', $result['type']);
        $this->assertEquals('+55 (11) 99988-7766', $result['formatted']);

        // Valid landline phone
        $result = $this->service->validatePhone('1133334444');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('landline', $result['type']);
        $this->assertEquals('+55 (11) 3333-4444', $result['formatted']);

        // Invalid area code (90 is not a valid Brazilian area code)
        $result = $this->service->validatePhone('90999887766');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Código de área inválido', $result['errors']);

        // Mobile without 9
        $result = $this->service->validatePhone('11888776655');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Celular deve começar com 9', $result['errors']);

        // Wrong format
        $result = $this->service->validatePhone('123456');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Formato de telefone inválido', $result['errors']);
    }

    /** @test */
    public function it_validates_brazilian_cep()
    {
        // Valid CEP
        $result = $this->service->validateCEP('12345678');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('12345-678', $result['formatted']);
        $this->assertEquals('12345678', $result['clean']);

        // Valid CEP with formatting
        $result = $this->service->validateCEP('12345-678');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('12345-678', $result['formatted']);

        // Invalid CEP - wrong length
        $result = $this->service->validateCEP('1234567');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CEP deve ter exatamente 8 dígitos', $result['errors']);

        // Invalid CEP - all same digits
        $result = $this->service->validateCEP('11111111');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CEP com todos os dígitos iguais não é válido', $result['errors']);

        // Empty CEP
        $result = $this->service->validateCEP('');
        $this->assertFalse($result['is_valid']);
        $this->assertContains('CEP é obrigatório', $result['errors']);
    }

    /** @test */
    public function it_sanitizes_text_input()
    {
        // Basic sanitization
        $result = $this->service->sanitizeText('  Hello World  ');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('Hello World', $result['sanitized']);

        // HTML removal
        $result = $this->service->sanitizeText('<script>alert("xss")</script>Hello', [
            'allow_html' => false
        ]);
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('alert("xss")Hello', $result['sanitized']); // strip_tags removes tags but keeps content
        $this->assertContains('Tags HTML foram removidas', $result['warnings']);

        // Length validation
        $result = $this->service->sanitizeText('Hi', ['min_length' => 5]);
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Texto muito curto (mínimo 5 caracteres)', $result['errors']);

        $longText = str_repeat('a', 300);
        $result = $this->service->sanitizeText($longText, ['max_length' => 100]);
        $this->assertFalse($result['is_valid']);
        $this->assertContains('Texto muito longo (máximo 100 caracteres)', $result['errors']);

        // Space normalization - test with simple spaces
        $result = $this->service->sanitizeText('Hello    World    Test', [
            'normalize_spaces' => true
        ]);
        $this->assertEquals('Hello World Test', $result['sanitized']);
    }

    /** @test */
    public function it_validates_user_registration_data()
    {
        $validData = [
            'name' => 'João Silva Santos',
            'email' => 'joao@example.com',
            'cpf' => '123.456.789-09', // Valid CPF
            'phone' => '11999887766'
        ];

        $result = $this->service->validateUserRegistration($validData);
        
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('João Silva Santos', $result['validated_data']['name']);
        $this->assertEquals('joao@example.com', $result['validated_data']['email']);
        $this->assertEquals('12345678909', $result['validated_data']['cpf']);
        $this->assertEquals('11999887766', $result['validated_data']['phone']);

        // Invalid data
        $invalidData = [
            'name' => 'AB', // Too short
            'email' => 'invalid-email',
            'cpf' => '123.456.789-00', // Invalid CPF
            'phone' => '123456' // Invalid phone
        ];

        $result = $this->service->validateUserRegistration($invalidData);
        
        $this->assertFalse($result['is_valid']);
        $this->assertNotEmpty($result['errors']);
    }

    /** @test */
    public function it_handles_empty_confidence_scores()
    {
        $result = $this->service->validateOCRConfidence([]);
        
        $this->assertFalse($result['is_acceptable']);
        $this->assertEquals(0, $result['average_confidence']);
        $this->assertContains('Nenhuma pontuação de confiança fornecida', $result['recommendations']);
    }

    /** @test */
    public function it_handles_invalid_confidence_scores()
    {
        $result = $this->service->validateOCRConfidence([150, -10, 'invalid', null]);
        
        $this->assertFalse($result['is_acceptable']);
        $this->assertContains('Pontuações de confiança inválidas', $result['recommendations']);
    }

    /** @test */
    public function it_provides_appropriate_recommendations()
    {
        // Excellent quality
        $result = $this->service->validateOCRConfidence([95, 92, 90, 88]);
        $this->assertContains('Qualidade excelente, processamento confiável', $result['recommendations']);

        // Poor quality with low minimums
        $result = $this->service->validateOCRConfidence([70, 45, 65, 30]); // Make one value below 50
        $this->assertContains('Alguns campos têm confiança muito baixa, considere melhorar a qualidade da imagem', $result['recommendations']);

        // Needs retry
        $result = $this->service->validateOCRConfidence([25, 20, 15, 28]);
        $this->assertContains('Qualidade geral muito baixa, recomenda-se nova captura', $result['recommendations']);
    }

    /** @test */
    public function it_normalizes_email_to_lowercase()
    {
        $result = $this->service->validateEmail('TEST@EXAMPLE.COM');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('test@example.com', $result['normalized']);
    }

    /** @test */
    public function it_handles_phone_with_formatting()
    {
        // Phone with formatting (service expects Brazilian format without country code)
        $result = $this->service->validatePhone('(11) 99988-7766');
        $this->assertTrue($result['is_valid']); // Actually has 11 digits: 11 + 99988 + 7766, mobile format
        
        // Correct mobile phone without formatting
        $result = $this->service->validatePhone('11999887766');
        $this->assertTrue($result['is_valid']);
        $this->assertEquals('11999887766', $result['clean']);
        $this->assertEquals('mobile', $result['type']);
    }
}