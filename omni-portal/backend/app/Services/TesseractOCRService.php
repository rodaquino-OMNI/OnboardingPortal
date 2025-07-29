<?php

namespace App\Services;

use thiagoalessio\TesseractOCR\TesseractOCR;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;

class TesseractOCRService
{
    /**
     * Process document with Tesseract OCR
     */
    public function processDocument(string $filePath): array
    {
        try {
            // Get the file from storage
            $tempPath = $this->prepareFileForOCR($filePath);
            
            // Initialize Tesseract
            $tesseract = new TesseractOCR($tempPath);
            $tesseract->lang('por', 'eng'); // Portuguese and English
            
            // Get raw text
            $rawText = $tesseract->run();
            
            // Get detailed information with bounding boxes
            $tesseract->configFile('tsv');
            $tsvOutput = $tesseract->run();
            
            // Parse TSV output for structured data
            $structuredData = $this->parseTSVOutput($tsvOutput);
            
            // Clean up temp file
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }
            
            return [
                'raw_text' => $rawText,
                'blocks' => $structuredData['blocks'],
                'confidence_scores' => $structuredData['confidence_scores'],
                'forms' => $this->extractFormFields($structuredData['blocks'], $rawText),
            ];
            
        } catch (\Exception $e) {
            Log::error('Tesseract OCR processing failed: ' . $e->getMessage());
            throw new \Exception('OCR processing failed: ' . $e->getMessage());
        }
    }
    
    /**
     * Prepare file for OCR processing
     */
    protected function prepareFileForOCR(string $filePath): string
    {
        // Get file from storage
        $fileContent = Storage::disk('s3')->get($filePath);
        
        // Create temp file
        $tempPath = sys_get_temp_dir() . '/' . uniqid('ocr_') . '.png';
        
        // Check if it's a PDF
        if (str_ends_with(strtolower($filePath), '.pdf')) {
            // Convert PDF to image (requires Imagick)
            $imagick = new \Imagick();
            $imagick->readImageBlob($fileContent);
            $imagick->setImageFormat('png');
            $imagick->writeImage($tempPath);
        } else {
            // Process image to improve OCR accuracy
            $image = Image::make($fileContent);
            
            // Convert to grayscale
            $image->greyscale();
            
            // Increase contrast
            $image->contrast(20);
            
            // Sharpen
            $image->sharpen(10);
            
            // Save processed image
            $image->save($tempPath, 90, 'png');
        }
        
        return $tempPath;
    }
    
    /**
     * Parse TSV output from Tesseract
     */
    protected function parseTSVOutput(string $tsvOutput): array
    {
        $lines = explode("\n", $tsvOutput);
        $headers = str_getcsv(array_shift($lines), "\t");
        
        $blocks = [];
        $confidenceScores = [];
        $currentBlock = null;
        $currentBlockText = '';
        
        foreach ($lines as $line) {
            if (empty($line)) continue;
            
            $data = str_getcsv($line, "\t");
            if (count($data) !== count($headers)) continue;
            
            $row = array_combine($headers, $data);
            
            // Skip empty text
            if (empty($row['text']) || trim($row['text']) === '') continue;
            
            $confidence = (float) $row['conf'];
            if ($confidence < 0) continue; // Skip low confidence
            
            $confidenceScores[] = $confidence;
            
            // Group by block
            if ($row['block_num'] !== $currentBlock) {
                if ($currentBlock !== null && !empty($currentBlockText)) {
                    $blocks[] = [
                        'text' => trim($currentBlockText),
                        'confidence' => array_sum($confidenceScores) / count($confidenceScores),
                        'bbox' => [
                            'x' => (int) $row['left'],
                            'y' => (int) $row['top'],
                            'width' => (int) $row['width'],
                            'height' => (int) $row['height'],
                        ]
                    ];
                }
                $currentBlock = $row['block_num'];
                $currentBlockText = '';
            }
            
            $currentBlockText .= $row['text'] . ' ';
        }
        
        // Add last block
        if (!empty($currentBlockText)) {
            $blocks[] = [
                'text' => trim($currentBlockText),
                'confidence' => array_sum($confidenceScores) / count($confidenceScores),
            ];
        }
        
        return [
            'blocks' => $blocks,
            'confidence_scores' => $confidenceScores,
        ];
    }
    
    /**
     * Extract form fields from blocks
     */
    protected function extractFormFields(array $blocks, string $rawText): array
    {
        $forms = [];
        $text = strtolower($rawText);
        
        // Common patterns for Brazilian documents
        $patterns = [
            'nome' => '/nome[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i',
            'cpf' => '/cpf[:\s]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i',
            'rg' => '/rg[:\s]*(\d{1,2}\.?\d{3}\.?\d{3}-?\d{1})/i',
            'data_nascimento' => '/(?:nascimento|nasc)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i',
            'cep' => '/cep[:\s]*(\d{5}-?\d{3})/i',
            'endereco' => '/(?:endereço|endereco|rua|av|avenida)[:\s]*([^,\n]+)/i',
            'cidade' => '/cidade[:\s]*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]+)/i',
            'estado' => '/(?:estado|uf)[:\s]*([A-Z]{2})/i',
        ];
        
        foreach ($patterns as $key => $pattern) {
            if (preg_match($pattern, $rawText, $matches)) {
                $forms[] = [
                    'key' => $key,
                    'value' => trim($matches[1]),
                    'confidence' => 85, // Default confidence for regex matches
                ];
            }
        }
        
        // Also try to extract from structured blocks
        foreach ($blocks as $block) {
            $blockText = $block['text'];
            
            // Look for key-value patterns
            if (preg_match('/^([^:]+):\s*(.+)$/', $blockText, $matches)) {
                $key = $this->normalizeKey($matches[1]);
                $value = trim($matches[2]);
                
                if (!empty($key) && !empty($value)) {
                    $forms[] = [
                        'key' => $key,
                        'value' => $value,
                        'confidence' => $block['confidence'],
                    ];
                }
            }
        }
        
        return $forms;
    }
    
    /**
     * Normalize field keys
     */
    protected function normalizeKey(string $key): string
    {
        $key = strtolower(trim($key));
        $key = preg_replace('/[^a-z0-9_]/', '_', $key);
        $key = preg_replace('/_+/', '_', $key);
        return trim($key, '_');
    }
    
    /**
     * Validate OCR quality
     */
    public function validateOCRQuality(array $ocrData): array
    {
        $avgConfidence = 0;
        $minConfidence = 100;
        $issues = [];
        
        if (!empty($ocrData['confidence_scores'])) {
            $avgConfidence = array_sum($ocrData['confidence_scores']) / count($ocrData['confidence_scores']);
            $minConfidence = min($ocrData['confidence_scores']);
        }
        
        if ($avgConfidence < 70) {
            $issues[] = 'Baixa confiança geral na leitura';
        }
        
        if ($minConfidence < 50) {
            $issues[] = 'Algumas partes do documento estão ilegíveis';
        }
        
        if (strlen($ocrData['raw_text']) < 50) {
            $issues[] = 'Pouco texto detectado no documento';
        }
        
        return [
            'is_valid' => count($issues) === 0,
            'average_confidence' => round($avgConfidence, 2),
            'minimum_confidence' => round($minConfidence, 2),
            'issues' => $issues,
        ];
    }
    
    /**
     * Check if Tesseract is available
     */
    public static function isAvailable(): bool
    {
        try {
            $output = shell_exec('tesseract --version 2>&1');
            return strpos($output, 'tesseract') !== false;
        } catch (\Exception $e) {
            return false;
        }
    }
}