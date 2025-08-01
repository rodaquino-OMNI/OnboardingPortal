<?php

namespace App\Services;

use Aws\Textract\TextractClient;
use Illuminate\Support\Facades\Log;
use App\Models\Beneficiary;

class OCRService
{
    protected $textractClient;

    public function __construct()
    {
        $this->textractClient = new TextractClient([
            'version' => 'latest',
            'region' => config('services.aws.region', 'us-east-1'),
            'credentials' => [
                'key' => config('services.aws.key'),
                'secret' => config('services.aws.secret'),
            ]
        ]);
    }

    /**
     * Process document with AWS Textract
     */
    public function processDocument(string $s3Path): array
    {
        try {
            $bucket = config('filesystems.disks.s3.bucket');
            
            $result = $this->textractClient->analyzeDocument([
                'Document' => [
                    'S3Object' => [
                        'Bucket' => $bucket,
                        'Name' => $s3Path
                    ]
                ],
                'FeatureTypes' => ['FORMS', 'TABLES']
            ]);

            return $this->extractTextAndForms($result);
        } catch (\Exception $e) {
            Log::error('Textract processing failed: ' . $e->getMessage());
            throw new \Exception('OCR processing failed: ' . $e->getMessage());
        }
    }

    /**
     * Extract text and form data from Textract response
     */
    protected function extractTextAndForms($result): array
    {
        $blocks = $result['Blocks'];
        $extractedData = [
            'raw_text' => '',
            'forms' => [],
            'tables' => [],
            'confidence_scores' => []
        ];

        // Extract raw text
        foreach ($blocks as $block) {
            if ($block['BlockType'] === 'LINE') {
                $extractedData['raw_text'] .= $block['Text'] . "\n";
                $extractedData['confidence_scores'][] = $block['Confidence'];
            }
        }

        // Extract form data (key-value pairs)
        $keyMap = [];
        $valueMap = [];
        $blockMap = [];

        foreach ($blocks as $block) {
            $blockMap[$block['Id']] = $block;
        }

        foreach ($blocks as $block) {
            if ($block['BlockType'] === 'KEY_VALUE_SET') {
                if (isset($block['EntityTypes']) && in_array('KEY', $block['EntityTypes'])) {
                    $keyMap[$block['Id']] = $block;
                } elseif (isset($block['EntityTypes']) && in_array('VALUE', $block['EntityTypes'])) {
                    $valueMap[$block['Id']] = $block;
                }
            }
        }

        // Combine keys and values
        foreach ($keyMap as $keyId => $keyBlock) {
            $keyText = $this->getTextFromBlock($keyBlock, $blockMap);
            $valueText = '';

            if (isset($keyBlock['Relationships'])) {
                foreach ($keyBlock['Relationships'] as $relationship) {
                    if ($relationship['Type'] === 'VALUE') {
                        foreach ($relationship['Ids'] as $valueId) {
                            if (isset($valueMap[$valueId])) {
                                $valueText = $this->getTextFromBlock($valueMap[$valueId], $blockMap);
                                break;
                            }
                        }
                    }
                }
            }

            if ($keyText && $valueText) {
                $extractedData['forms'][] = [
                    'key' => trim($keyText),
                    'value' => trim($valueText),
                    'confidence' => $keyBlock['Confidence']
                ];
            }
        }

        return $extractedData;
    }

    /**
     * Get text content from a block and its children
     */
    protected function getTextFromBlock($block, $blockMap): string
    {
        $text = '';
        
        if (isset($block['Relationships'])) {
            foreach ($block['Relationships'] as $relationship) {
                if ($relationship['Type'] === 'CHILD') {
                    foreach ($relationship['Ids'] as $childId) {
                        if (isset($blockMap[$childId]) && $blockMap[$childId]['BlockType'] === 'WORD') {
                            $text .= $blockMap[$childId]['Text'] . ' ';
                        }
                    }
                }
            }
        }

        return trim($text);
    }

    /**
     * Extract structured data based on document type
     */
    public function extractStructuredData(string $documentType, array $ocrData): array
    {
        switch ($documentType) {
            case 'rg':
                return $this->extractRGData($ocrData);
            case 'cnh':
                return $this->extractCNHData($ocrData);
            case 'cpf':
                return $this->extractCPFData($ocrData);
            case 'comprovante_residencia':
                return $this->extractAddressProofData($ocrData);
            default:
                return $this->extractGenericData($ocrData);
        }
    }

    /**
     * Extract RG data
     */
    protected function extractRGData(array $ocrData): array
    {
        $data = [];
        $text = strtolower($ocrData['raw_text']);
        
        // Extract RG number
        if (preg_match('/(\d{1,2}\.?\d{3}\.?\d{3}-?\d{1})/', $ocrData['raw_text'], $matches)) {
            $data['rg_number'] = $matches[1];
        }

        // Extract name patterns
        if (preg_match('/nome[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i', $ocrData['raw_text'], $matches)) {
            $data['name'] = trim($matches[1]);
        }

        // Extract birth date
        if (preg_match('/(\d{1,2}\/\d{1,2}\/\d{4})/', $ocrData['raw_text'], $matches)) {
            $data['birth_date'] = $matches[1];
        }

        // Extract from forms data
        foreach ($ocrData['forms'] as $form) {
            $key = strtolower($form['key']);
            if (strpos($key, 'nome') !== false) {
                $data['name'] = $form['value'];
            } elseif (strpos($key, 'nascimento') !== false || strpos($key, 'nasc') !== false) {
                $data['birth_date'] = $form['value'];
            } elseif (strpos($key, 'rg') !== false || strpos($key, 'registro') !== false) {
                $data['rg_number'] = $form['value'];
            }
        }

        return $data;
    }

    /**
     * Extract CNH data
     */
    protected function extractCNHData(array $ocrData): array
    {
        $data = [];
        
        // Extract CNH number
        if (preg_match('/(\d{11})/', $ocrData['raw_text'], $matches)) {
            $data['cnh_number'] = $matches[1];
        }

        // Extract name
        if (preg_match('/nome[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i', $ocrData['raw_text'], $matches)) {
            $data['name'] = trim($matches[1]);
        }

        // Extract expiration date
        if (preg_match('/valid[ao][:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i', $ocrData['raw_text'], $matches)) {
            $data['expiration_date'] = $matches[1];
        }

        // Extract from forms
        foreach ($ocrData['forms'] as $form) {
            $key = strtolower($form['key']);
            if (strpos($key, 'nome') !== false) {
                $data['name'] = $form['value'];
            } elseif (strpos($key, 'valid') !== false || strpos($key, 'venc') !== false) {
                $data['expiration_date'] = $form['value'];
            } elseif (strpos($key, 'cnh') !== false || strpos($key, 'habilitação') !== false) {
                $data['cnh_number'] = $form['value'];
            }
        }

        return $data;
    }

    /**
     * Extract CPF data
     */
    protected function extractCPFData(array $ocrData): array
    {
        $data = [];
        
        // Extract CPF number
        if (preg_match('/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/', $ocrData['raw_text'], $matches)) {
            $data['cpf'] = $matches[1];
        }

        // Extract name
        if (preg_match('/nome[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i', $ocrData['raw_text'], $matches)) {
            $data['name'] = trim($matches[1]);
        }

        // Extract from forms
        foreach ($ocrData['forms'] as $form) {
            $key = strtolower($form['key']);
            if (strpos($key, 'nome') !== false) {
                $data['name'] = $form['value'];
            } elseif (strpos($key, 'cpf') !== false) {
                $data['cpf'] = $form['value'];
            }
        }

        return $data;
    }

    /**
     * Extract address proof data
     */
    protected function extractAddressProofData(array $ocrData): array
    {
        $data = [];
        $text = $ocrData['raw_text'];
        
        // Extract address patterns
        if (preg_match('/rua|av|avenida|alameda[:\s]*([^,\n]+)/i', $text, $matches)) {
            $data['street'] = trim($matches[1]);
        }

        // Extract CEP
        if (preg_match('/(\d{5}-?\d{3})/', $text, $matches)) {
            $data['cep'] = $matches[1];
        }

        // Extract city
        if (preg_match('/cidade[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i', $text, $matches)) {
            $data['city'] = trim($matches[1]);
        }

        // Extract from forms
        foreach ($ocrData['forms'] as $form) {
            $key = strtolower($form['key']);
            $value = $form['value'];
            
            if (strpos($key, 'endereco') !== false || strpos($key, 'rua') !== false) {
                $data['street'] = $value;
            } elseif (strpos($key, 'cep') !== false) {
                $data['cep'] = $value;
            } elseif (strpos($key, 'cidade') !== false) {
                $data['city'] = $value;
            } elseif (strpos($key, 'estado') !== false) {
                $data['state'] = $value;
            }
        }

        return $data;
    }

    /**
     * Extract generic data
     */
    protected function extractGenericData(array $ocrData): array
    {
        return [
            'extracted_forms' => $ocrData['forms'],
            'raw_text' => $ocrData['raw_text']
        ];
    }

    /**
     * Validate extracted data against beneficiary information
     */
    public function validateExtractedData(string $documentType, array $extractedData, Beneficiary $beneficiary): array
    {
        $validation = [
            'is_valid' => true,
            'errors' => [],
            'warnings' => [],
            'confidence_score' => 0
        ];

        switch ($documentType) {
            case 'rg':
            case 'cnh':
                $validation = $this->validateIdentityDocument($extractedData, $beneficiary, $validation);
                break;
            case 'cpf':
                $validation = $this->validateCPFDocument($extractedData, $beneficiary, $validation);
                break;
            case 'comprovante_residencia':
                $validation = $this->validateAddressDocument($extractedData, $beneficiary, $validation);
                break;
        }

        return $validation;
    }

    /**
     * Validate identity document (RG/CNH)
     */
    protected function validateIdentityDocument(array $data, Beneficiary $beneficiary, array $validation): array
    {
        // Name validation
        if (isset($data['name'])) {
            $similarity = 0;
            similar_text(
                strtolower($this->normalizeString($beneficiary->full_name)),
                strtolower($this->normalizeString($data['name'])),
                $similarity
            );
            
            if ($similarity < 70) {
                $validation['errors'][] = 'Nome no documento não confere com o cadastro';
                $validation['is_valid'] = false;
            } elseif ($similarity < 85) {
                $validation['warnings'][] = 'Nome no documento tem pequenas diferenças';
            }
            
            $validation['confidence_score'] += $similarity * 0.4;
        }

        // Birth date validation
        if (isset($data['birth_date']) && $beneficiary->birth_date) {
            $docDate = $this->parseDate($data['birth_date']);
            $beneficiaryDate = $beneficiary->birth_date->format('Y-m-d');
            
            if ($docDate !== $beneficiaryDate) {
                $validation['errors'][] = 'Data de nascimento não confere';
                $validation['is_valid'] = false;
            } else {
                $validation['confidence_score'] += 30;
            }
        }

        // Document expiration check (for CNH)
        if (isset($data['expiration_date'])) {
            $expirationDate = $this->parseDate($data['expiration_date']);
            if ($expirationDate && $expirationDate < now()->format('Y-m-d')) {
                $validation['errors'][] = 'Documento vencido';
                $validation['is_valid'] = false;
            }
        }

        $validation['confidence_score'] = min(100, $validation['confidence_score']);
        return $validation;
    }

    /**
     * Validate CPF document
     */
    protected function validateCPFDocument(array $data, Beneficiary $beneficiary, array $validation): array
    {
        if (isset($data['cpf'])) {
            $documentCPF = preg_replace('/[^0-9]/', '', $data['cpf']);
            $beneficiaryCPF = preg_replace('/[^0-9]/', '', $beneficiary->cpf);
            
            if ($documentCPF !== $beneficiaryCPF) {
                $validation['errors'][] = 'CPF do documento não confere';
                $validation['is_valid'] = false;
            } else {
                $validation['confidence_score'] += 50;
            }
        }

        if (isset($data['name'])) {
            $similarity = 0;
            similar_text(
                strtolower($this->normalizeString($beneficiary->full_name)),
                strtolower($this->normalizeString($data['name'])),
                $similarity
            );
            
            $validation['confidence_score'] += $similarity * 0.5;
            
            if ($similarity < 70) {
                $validation['warnings'][] = 'Nome tem diferenças significativas';
            }
        }

        return $validation;
    }

    /**
     * Validate address document
     */
    protected function validateAddressDocument(array $data, Beneficiary $beneficiary, array $validation): array
    {
        $beneficiaryAddress = $beneficiary->address ?? [];
        
        // CEP validation
        if (isset($data['cep']) && isset($beneficiaryAddress['cep'])) {
            $docCEP = preg_replace('/[^0-9]/', '', $data['cep']);
            $beneficiaryCEP = preg_replace('/[^0-9]/', '', $beneficiaryAddress['cep']);
            
            if ($docCEP === $beneficiaryCEP) {
                $validation['confidence_score'] += 40;
            } else {
                $validation['warnings'][] = 'CEP do documento difere do cadastro';
            }
        }

        // City validation
        if (isset($data['city']) && isset($beneficiaryAddress['city'])) {
            $similarity = 0;
            similar_text(
                strtolower($this->normalizeString($beneficiaryAddress['city'])),
                strtolower($this->normalizeString($data['city'])),
                $similarity
            );
            
            if ($similarity > 80) {
                $validation['confidence_score'] += 30;
            } else {
                $validation['warnings'][] = 'Cidade no documento difere do cadastro';
            }
        }

        // Street validation
        if (isset($data['street']) && isset($beneficiaryAddress['street'])) {
            $similarity = 0;
            similar_text(
                strtolower($this->normalizeString($beneficiaryAddress['street'])),
                strtolower($this->normalizeString($data['street'])),
                $similarity
            );
            
            if ($similarity > 60) {
                $validation['confidence_score'] += 30;
            } else {
                $validation['warnings'][] = 'Endereço no documento difere do cadastro';
            }
        }

        return $validation;
    }

    /**
     * Normalize string for comparison
     */
    protected function normalizeString(string $string): string
    {
        // Remove accents and special characters
        $string = iconv('UTF-8', 'ASCII//TRANSLIT', $string);
        // Remove extra spaces and convert to lowercase
        return trim(preg_replace('/\s+/', ' ', strtolower($string)));
    }

    /**
     * Parse date from various formats
     */
    protected function parseDate(string $dateString): ?string
    {
        $formats = ['d/m/Y', 'd-m-Y', 'Y-m-d', 'd/m/y', 'd-m-y'];
        
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $dateString);
            if ($date) {
                return $date->format('Y-m-d');
            }
        }
        
        return null;
    }
}