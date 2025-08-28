<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\OCRService;
use App\Services\BrazilianDocumentService;
use App\Services\ValidationUtilityService;
use App\Models\Beneficiary;
use App\Models\User;
use Aws\Textract\TextractClient;
use Aws\Result;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;

class TextractServiceTest extends TestCase
{
    use RefreshDatabase;

    protected $ocrService;
    protected $mockTextractClient;
    protected $beneficiary;

    protected function setUp(): void
    {
        parent::setUp();
        
        // Create mock Textract client
        $this->mockTextractClient = Mockery::mock(TextractClient::class);
        
        // Mock the required services for OCRService constructor
        $mockDocumentService = Mockery::mock(BrazilianDocumentService::class);
        $mockValidationService = Mockery::mock(ValidationUtilityService::class);
        
        // Create OCR service instance with required dependencies
        $this->ocrService = new OCRService($mockDocumentService, $mockValidationService);
        $reflection = new \ReflectionClass($this->ocrService);
        $property = $reflection->getProperty('textractClient');
        $property->setAccessible(true);
        $property->setValue($this->ocrService, $this->mockTextractClient);
        
        // Create test beneficiary
        $user = User::factory()->create();
        $this->beneficiary = Beneficiary::factory()->create([
            'user_id' => $user->id,
            'full_name' => 'João Silva Santos',
            'cpf' => '123.456.789-00',
            'birth_date' => '1990-05-15'
        ]);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /** @test */
    public function it_can_process_rg_document_with_textract()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "REGISTRO GERAL\nNome: JOÃO SILVA SANTOS\nRG: 12.345.678-9\nData Nascimento: 15/05/1990\nOrgão Emissor: SSP-SP",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 95.5],
                ['key' => 'RG', 'value' => '12.345.678-9', 'confidence' => 98.2],
                ['key' => 'Data Nascimento', 'value' => '15/05/1990', 'confidence' => 92.1]
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->with(Mockery::on(function ($params) {
                return isset($params['Document']['S3Object']) &&
                       isset($params['FeatureTypes']) &&
                       in_array('FORMS', $params['FeatureTypes']);
            }))
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/rg_test.jpg');

        $this->assertIsArray($result);
        $this->assertArrayHasKey('raw_text', $result);
        $this->assertArrayHasKey('forms', $result);
        $this->assertStringContainsString('JOÃO SILVA SANTOS', $result['raw_text']);
        $this->assertEquals('JOÃO SILVA SANTOS', $result['forms'][0]['value']);
        $this->assertGreaterThan(90, $result['forms'][0]['confidence']);
    }

    /** @test */
    public function it_can_process_cpf_document_with_textract()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "CADASTRO DE PESSOA FÍSICA\nNome: JOÃO SILVA SANTOS\nCPF: 123.456.789-00\nSituação: Regular",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 94.8],
                ['key' => 'CPF', 'value' => '123.456.789-00', 'confidence' => 99.1]
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/cpf_test.pdf');
        $extractedData = $this->ocrService->extractStructuredData('cpf', $result);

        $this->assertArrayHasKey('cpf', $extractedData);
        $this->assertArrayHasKey('name', $extractedData);
        $this->assertEquals('123.456.789-00', $extractedData['cpf']);
        $this->assertEquals('JOÃO SILVA SANTOS', $extractedData['name']);
    }

    /** @test */
    public function it_can_process_cnh_document_with_textract()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "CARTEIRA NACIONAL DE HABILITAÇÃO\nNome: JOÃO SILVA SANTOS\nCNH: 12345678901\nValida até: 15/05/2028",
            'forms' => [
                ['key' => 'Nome', 'value' => 'JOÃO SILVA SANTOS', 'confidence' => 96.3],
                ['key' => 'CNH', 'value' => '12345678901', 'confidence' => 97.8],
                ['key' => 'Valida até', 'value' => '15/05/2028', 'confidence' => 93.5]
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/cnh_test.jpg');
        $extractedData = $this->ocrService->extractStructuredData('cnh', $result);

        $this->assertArrayHasKey('cnh_number', $extractedData);
        $this->assertArrayHasKey('name', $extractedData);
        $this->assertArrayHasKey('expiration_date', $extractedData);
        $this->assertEquals('12345678901', $extractedData['cnh_number']);
        $this->assertEquals('JOÃO SILVA SANTOS', $extractedData['name']);
        $this->assertEquals('15/05/2028', $extractedData['expiration_date']);
    }

    /** @test */
    public function it_can_process_address_proof_with_textract()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "COMPROVANTE DE ENDEREÇO\nTitular: JOÃO SILVA SANTOS\nEndereço: Rua das Flores, 123\nBairro: Centro\nCidade: São Paulo - SP\nCEP: 01234-567",
            'forms' => [
                ['key' => 'Endereco', 'value' => 'Rua das Flores, 123', 'confidence' => 89.4],
                ['key' => 'Cidade', 'value' => 'São Paulo', 'confidence' => 95.1],
                ['key' => 'CEP', 'value' => '01234-567', 'confidence' => 98.7]
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/comprovante_test.pdf');
        $extractedData = $this->ocrService->extractStructuredData('comprovante_residencia', $result);

        $this->assertArrayHasKey('street', $extractedData);
        $this->assertArrayHasKey('city', $extractedData);
        $this->assertArrayHasKey('cep', $extractedData);
        $this->assertEquals('Rua das Flores, 123', $extractedData['street']);
        $this->assertEquals('São Paulo', $extractedData['city']);
        $this->assertEquals('01234-567', $extractedData['cep']);
    }

    /** @test */
    public function it_handles_textract_service_exceptions_gracefully()
    {
        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andThrow(new \Aws\Exception\AwsException('Textract service error', 
                Mockery::mock(\Aws\CommandInterface::class)));

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('OCR processing failed');

        $this->ocrService->processDocument('documents/invalid_test.jpg');
    }

    /** @test */
    public function it_validates_textract_confidence_scores()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "Low quality document text",
            'forms' => [
                ['key' => 'Campo1', 'value' => 'Valor1', 'confidence' => 45.2], // Low confidence
                ['key' => 'Campo2', 'value' => 'Valor2', 'confidence' => 89.8]  // Good confidence
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/low_quality_test.jpg');

        // Should have confidence scores available
        $this->assertArrayHasKey('confidence_scores', $result);
        $this->assertIsArray($result['confidence_scores']);
        
        // Should filter or flag low confidence results
        $confidenceScores = array_column($result['forms'], 'confidence');
        $this->assertContains(45.2, $confidenceScores);
        $this->assertContains(89.8, $confidenceScores);
    }

    /** @test */
    public function it_can_extract_tables_from_textract_response()
    {
        $mockResponse = $this->createMockTextractResponseWithTables();

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->with(Mockery::on(function ($params) {
                return in_array('TABLES', $params['FeatureTypes']);
            }))
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/table_test.pdf');

        $this->assertArrayHasKey('tables', $result);
        $this->assertIsArray($result['tables']);
    }

    /** @test */
    public function it_handles_portuguese_accents_correctly()
    {
        $mockResponse = $this->createMockTextractResponse([
            'raw_text' => "Nome: João da Silva Ção\nEndereço: Avenida São João",
            'forms' => [
                ['key' => 'Nome', 'value' => 'João da Silva Ção', 'confidence' => 92.1],
                ['key' => 'Endereco', 'value' => 'Avenida São João', 'confidence' => 88.5]
            ]
        ]);

        $this->mockTextractClient
            ->shouldReceive('analyzeDocument')
            ->once()
            ->andReturn($mockResponse);

        $result = $this->ocrService->processDocument('documents/accents_test.jpg');

        // Verify accented characters are preserved
        $this->assertStringContainsString('João', $result['raw_text']);
        $this->assertStringContainsString('Ção', $result['raw_text']);
        $this->assertStringContainsString('São João', $result['raw_text']);
    }

    /** @test */
    public function it_validates_brazilian_document_patterns()
    {
        $testCases = [
            ['cpf' => '123.456.789-00', 'valid' => true],
            ['cpf' => '12345678900', 'valid' => true],
            ['cpf' => '123.456.789-99', 'valid' => false], // Invalid CPF
            ['rg' => '12.345.678-9', 'valid' => true],
            ['rg' => '1.234.567-8', 'valid' => true],
            ['cep' => '01234-567', 'valid' => true],
            ['cep' => '01234567', 'valid' => true],
            ['cnh' => '12345678901', 'valid' => true],
            ['cnh' => '1234567890', 'valid' => false] // Too short
        ];

        foreach ($testCases as $case) {
            $field = array_keys($case)[0];
            $value = $case[$field];
            $shouldBeValid = $case['valid'];

            $isValid = $this->validateBrazilianPattern($field, $value);
            
            if ($shouldBeValid) {
                $this->assertTrue($isValid, "Pattern {$field}: {$value} should be valid");
            } else {
                $this->assertFalse($isValid, "Pattern {$field}: {$value} should be invalid");
            }
        }
    }

    /**
     * Create mock Textract response
     */
    protected function createMockTextractResponse(array $data): Result
    {
        $blocks = [];
        $blockId = 1;

        // Add LINE blocks for raw text
        foreach (explode("\n", $data['raw_text']) as $line) {
            if (trim($line)) {
                $blocks[] = [
                    'Id' => 'block-' . $blockId++,
                    'BlockType' => 'LINE',
                    'Text' => $line,
                    'Confidence' => 90.0 + rand(0, 999) / 100
                ];
            }
        }

        // Add KEY_VALUE_SET blocks for forms
        foreach ($data['forms'] as $form) {
            // Key block
            $keyId = 'key-' . $blockId++;
            $valueId = 'value-' . $blockId++;
            
            $blocks[] = [
                'Id' => $keyId,
                'BlockType' => 'KEY_VALUE_SET',
                'EntityTypes' => ['KEY'],
                'Confidence' => $form['confidence'],
                'Relationships' => [
                    [
                        'Type' => 'VALUE',
                        'Ids' => [$valueId]
                    ],
                    [
                        'Type' => 'CHILD',
                        'Ids' => ['word-' . $blockId++]
                    ]
                ]
            ];

            // Value block
            $blocks[] = [
                'Id' => $valueId,
                'BlockType' => 'KEY_VALUE_SET',
                'EntityTypes' => ['VALUE'],
                'Confidence' => $form['confidence'],
                'Relationships' => [
                    [
                        'Type' => 'CHILD',
                        'Ids' => ['word-' . $blockId++]
                    ]
                ]
            ];

            // Word blocks for key and value
            $blocks[] = [
                'Id' => 'word-' . ($blockId - 2),
                'BlockType' => 'WORD',
                'Text' => $form['key'],
                'Confidence' => $form['confidence']
            ];

            $blocks[] = [
                'Id' => 'word-' . ($blockId - 1),
                'BlockType' => 'WORD',
                'Text' => $form['value'],
                'Confidence' => $form['confidence']
            ];
        }

        return new Result(['Blocks' => $blocks]);
    }

    /**
     * Create mock Textract response with tables
     */
    protected function createMockTextractResponseWithTables(): Result
    {
        $blocks = [
            [
                'Id' => 'table-1',
                'BlockType' => 'TABLE',
                'Confidence' => 95.0,
                'Relationships' => [
                    [
                        'Type' => 'CHILD',
                        'Ids' => ['cell-1', 'cell-2', 'cell-3', 'cell-4']
                    ]
                ]
            ],
            [
                'Id' => 'cell-1',
                'BlockType' => 'CELL',
                'RowIndex' => 1,
                'ColumnIndex' => 1,
                'Text' => 'Campo',
                'Confidence' => 92.0
            ],
            [
                'Id' => 'cell-2',
                'BlockType' => 'CELL',
                'RowIndex' => 1,
                'ColumnIndex' => 2,
                'Text' => 'Valor',
                'Confidence' => 94.0
            ],
            [
                'Id' => 'cell-3',
                'BlockType' => 'CELL',
                'RowIndex' => 2,
                'ColumnIndex' => 1,
                'Text' => 'Nome',
                'Confidence' => 96.0
            ],
            [
                'Id' => 'cell-4',
                'BlockType' => 'CELL',
                'RowIndex' => 2,
                'ColumnIndex' => 2,
                'Text' => 'João Silva',
                'Confidence' => 91.0
            ]
        ];

        return new Result(['Blocks' => $blocks]);
    }

    /**
     * Validate Brazilian document patterns
     */
    protected function validateBrazilianPattern(string $type, string $value): bool
    {
        $patterns = [
            'cpf' => '/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/',
            'rg' => '/^\d{1,2}\.?\d{3}\.?\d{3}-?\d{1}$/',
            'cep' => '/^\d{5}-?\d{3}$/',
            'cnh' => '/^\d{11}$/'
        ];

        if (!isset($patterns[$type])) {
            return false;
        }

        return preg_match($patterns[$type], $value) === 1;
    }
}