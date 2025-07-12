<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\OCRService;
use App\Models\Beneficiary;
use App\Models\User;
use Aws\Textract\TextractClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

class OCRServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $ocrService;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->ocrService = new OCRService();
        
        // Create test beneficiary
        $user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $user->id,
            'full_name' => 'João Silva Santos',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-05-15',
            'address' => 'Rua das Flores',
            'number' => '123',
            'city' => 'São Paulo',
            'state' => 'SP',
            'zip_code' => '01234-567'
        ]);
    }

    /** @test */
    public function it_can_extract_rg_data_from_ocr_result()
    {
        $mockOcrData = [
            'raw_text' => "REGISTRO GERAL\nNome: JOÃO SILVA SANTOS\nRG: 12.345.678-9\nData Nascimento: 15/05/1990\nOrgão Emissor: SSP-SP",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 0.95],
                ['key' => 'RG', 'value' => '12.345.678-9', 'confidence' => 0.98],
                ['key' => 'Data Nascimento', 'value' => '15/05/1990', 'confidence' => 0.92]
            ]
        ];

        $extractedData = $this->ocrService->extractStructuredData('rg', $mockOcrData);

        $this->assertArrayHasKey('name', $extractedData);
        $this->assertArrayHasKey('rg_number', $extractedData);
        $this->assertArrayHasKey('birth_date', $extractedData);
        $this->assertEquals('JOÃO SILVA SANTOS', $extractedData['name']);
        $this->assertEquals('12.345.678-9', $extractedData['rg_number']);
        $this->assertEquals('15/05/1990', $extractedData['birth_date']);
    }

    /** @test */
    public function it_can_extract_cnh_data_from_ocr_result()
    {
        $mockOcrData = [
            'raw_text' => "CARTEIRA NACIONAL DE HABILITAÇÃO\nNome: JOÃO SILVA SANTOS\nCNH: 12345678901\nValida até: 15/05/2025",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 0.95],
                ['key' => 'CNH', 'value' => '12345678901', 'confidence' => 0.98],
                ['key' => 'Valida até', 'value' => '15/05/2025', 'confidence' => 0.92]
            ]
        ];

        $extractedData = $this->ocrService->extractStructuredData('cnh', $mockOcrData);

        $this->assertArrayHasKey('name', $extractedData);
        $this->assertArrayHasKey('cnh_number', $extractedData);
        $this->assertArrayHasKey('expiration_date', $extractedData);
        $this->assertEquals('JOÃO SILVA SANTOS', $extractedData['name']);
        $this->assertEquals('12345678901', $extractedData['cnh_number']);
        $this->assertEquals('15/05/2025', $extractedData['expiration_date']);
    }

    /** @test */
    public function it_can_extract_cpf_data_from_ocr_result()
    {
        $mockOcrData = [
            'raw_text' => "CADASTRO DE PESSOA FÍSICA\nNome: JOÃO SILVA SANTOS\nCPF: 123.456.789-00",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 0.95],
                ['key' => 'CPF', 'value' => '123.456.789-00', 'confidence' => 0.98]
            ]
        ];

        $extractedData = $this->ocrService->extractStructuredData('cpf', $mockOcrData);

        $this->assertArrayHasKey('name', $extractedData);
        $this->assertArrayHasKey('cpf', $extractedData);
        $this->assertEquals('JOÃO SILVA SANTOS', $extractedData['name']);
        $this->assertEquals('123.456.789-00', $extractedData['cpf']);
    }

    /** @test */
    public function it_can_extract_address_proof_data()
    {
        $mockOcrData = [
            'raw_text' => "COMPROVANTE DE ENDEREÇO\nRua das Flores, 123\nSão Paulo - SP\nCEP: 01234-567",
            'forms' => [
                ['key' => 'Endereco', 'value' => 'Rua das Flores, 123', 'confidence' => 0.90],
                ['key' => 'Cidade', 'value' => 'São Paulo', 'confidence' => 0.95],
                ['key' => 'CEP', 'value' => '01234-567', 'confidence' => 0.98]
            ]
        ];

        $extractedData = $this->ocrService->extractStructuredData('comprovante_residencia', $mockOcrData);

        $this->assertArrayHasKey('street', $extractedData);
        $this->assertArrayHasKey('city', $extractedData);
        $this->assertArrayHasKey('cep', $extractedData);
        $this->assertEquals('Rua das Flores, 123', $extractedData['street']);
        $this->assertEquals('São Paulo', $extractedData['city']);
        $this->assertEquals('01234-567', $extractedData['cep']);
    }

    /** @test */
    public function it_validates_identity_document_correctly()
    {
        $extractedData = [
            'name' => 'JOÃO SILVA SANTOS',
            'birth_date' => '15/05/1990'
        ];

        $validation = $this->ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);

        $this->assertTrue($validation['is_valid']);
        $this->assertEmpty($validation['errors']);
        $this->assertGreaterThan(70, $validation['confidence_score']);
    }

    /** @test */
    public function it_detects_name_mismatch_in_validation()
    {
        $extractedData = [
            'name' => 'MARIA OLIVEIRA COSTA',
            'birth_date' => '15/05/1990'
        ];

        $validation = $this->ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);

        $this->assertFalse($validation['is_valid']);
        $this->assertContains('Nome no documento não confere com o cadastro', $validation['errors']);
    }

    /** @test */
    public function it_detects_birth_date_mismatch()
    {
        $extractedData = [
            'name' => 'JOÃO SILVA SANTOS',
            'birth_date' => '20/12/1985'
        ];

        $validation = $this->ocrService->validateExtractedData('rg', $extractedData, $this->beneficiary);

        $this->assertFalse($validation['is_valid']);
        $this->assertContains('Data de nascimento não confere', $validation['errors']);
    }

    /** @test */
    public function it_validates_cpf_document_correctly()
    {
        $extractedData = [
            'cpf' => '123.456.789-00',
            'name' => 'JOÃO SILVA SANTOS'
        ];

        $validation = $this->ocrService->validateExtractedData('cpf', $extractedData, $this->beneficiary);

        $this->assertTrue($validation['is_valid']);
        $this->assertGreaterThan(70, $validation['confidence_score']);
    }

    /** @test */
    public function it_detects_cpf_mismatch()
    {
        $extractedData = [
            'cpf' => '987.654.321-00',
            'name' => 'JOÃO SILVA SANTOS'
        ];

        $validation = $this->ocrService->validateExtractedData('cpf', $extractedData, $this->beneficiary);

        $this->assertFalse($validation['is_valid']);
        $this->assertContains('CPF do documento não confere', $validation['errors']);
    }

    /** @test */
    public function it_validates_address_document_with_warnings()
    {
        $extractedData = [
            'street' => 'Rua das Flores, 123',
            'city' => 'São Paulo', 
            'cep' => '01234-567'
        ];

        $validation = $this->ocrService->validateExtractedData('comprovante_residencia', $extractedData, $this->beneficiary);

        $this->assertTrue($validation['is_valid']);
        $this->assertGreaterThan(50, $validation['confidence_score']);
    }

    /** @test */
    public function it_detects_expired_cnh_document()
    {
        $extractedData = [
            'name' => 'JOÃO SILVA SANTOS',
            'cnh_number' => '12345678901',
            'expiration_date' => '15/05/2020' // Expired date
        ];

        $validation = $this->ocrService->validateExtractedData('cnh', $extractedData, $this->beneficiary);

        $this->assertFalse($validation['is_valid']);
        $this->assertContains('Documento vencido', $validation['errors']);
    }

    /** @test */
    public function it_normalizes_strings_correctly_for_comparison()
    {
        $testString = 'João da Silva Ção';
        $normalized = $this->invokeMethod($this->ocrService, 'normalizeString', [$testString]);
        
        // Should remove accents and convert to lowercase
        $this->assertEquals('joao da silva cao', $normalized);
    }

    /** @test */
    public function it_parses_dates_in_various_formats()
    {
        $testCases = [
            '15/05/1990' => '1990-05-15',
            '15-05-1990' => '1990-05-15',
            '1990-05-15' => '1990-05-15',
            '15/05/90' => '1990-05-15'
        ];

        foreach ($testCases as $input => $expected) {
            $result = $this->invokeMethod($this->ocrService, 'parseDate', [$input]);
            $this->assertEquals($expected, $result, "Failed to parse date: {$input}");
        }
    }

    /**
     * Helper method to invoke private methods for testing
     */
    protected function invokeMethod($object, $methodName, array $parameters = [])
    {
        $reflection = new \ReflectionClass(get_class($object));
        $method = $reflection->getMethod($methodName);
        $method->setAccessible(true);

        return $method->invokeArgs($object, $parameters);
    }
}