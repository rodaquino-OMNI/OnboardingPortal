<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Validation Utility Service
 * 
 * Provides comprehensive validation utilities for various data types
 * with proper edge case handling and Brazilian-specific validations.
 */
class ValidationUtilityService
{
    protected BrazilianDocumentService $documentService;
    
    public function __construct(BrazilianDocumentService $documentService)
    {
        $this->documentService = $documentService;
    }
    
    /**
     * Validate OCR confidence scores with proper thresholds
     * 
     * @param array $confidenceScores
     * @param array $thresholds
     * @return array
     */
    public function validateOCRConfidence(array $confidenceScores, array $thresholds = []): array
    {
        $defaultThresholds = [
            'min_confidence' => config('ocr.quality.min_confidence', 70),
            'fallback_threshold' => config('ocr.quality.fallback_threshold', 50),
            'retry_threshold' => config('ocr.quality.retry_threshold', 30),
            'critical_threshold' => 85, // For critical data like CPF
        ];
        
        $thresholds = array_merge($defaultThresholds, $thresholds);
        
        $result = [
            'is_acceptable' => false,
            'average_confidence' => 0,
            'min_confidence' => 0,
            'max_confidence' => 0,
            'needs_fallback' => false,
            'needs_retry' => false,
            'quality_level' => 'poor',
            'recommendations' => []
        ];
        
        if (empty($confidenceScores)) {
            $result['recommendations'][] = 'Nenhuma pontuação de confiança fornecida';
            return $result;
        }
        
        // Filter valid confidence scores (0-100)
        $validScores = array_filter($confidenceScores, function($score) {
            return is_numeric($score) && $score >= 0 && $score <= 100;
        });
        
        if (empty($validScores)) {
            $result['recommendations'][] = 'Pontuações de confiança inválidas';
            return $result;
        }
        
        // Calculate statistics
        $result['average_confidence'] = round(array_sum($validScores) / count($validScores), 2);
        $result['min_confidence'] = min($validScores);
        $result['max_confidence'] = max($validScores);
        
        // Determine quality level
        if ($result['average_confidence'] >= $thresholds['critical_threshold']) {
            $result['quality_level'] = 'excellent';
        } elseif ($result['average_confidence'] >= $thresholds['min_confidence']) {
            $result['quality_level'] = 'good';
        } elseif ($result['average_confidence'] >= $thresholds['fallback_threshold']) {
            $result['quality_level'] = 'acceptable';
        } elseif ($result['average_confidence'] >= $thresholds['retry_threshold']) {
            $result['quality_level'] = 'poor';
        } else {
            $result['quality_level'] = 'unacceptable';
        }
        
        // Determine flags
        $result['is_acceptable'] = $result['average_confidence'] >= $thresholds['min_confidence'];
        $result['needs_fallback'] = $result['average_confidence'] < $thresholds['fallback_threshold'];
        $result['needs_retry'] = $result['average_confidence'] < $thresholds['retry_threshold'];
        
        // Generate recommendations
        if ($result['min_confidence'] < 50) {
            $result['recommendations'][] = 'Alguns campos têm confiança muito baixa, considere melhorar a qualidade da imagem';
        }
        
        if ($result['needs_retry']) {
            $result['recommendations'][] = 'Qualidade geral muito baixa, recomenda-se nova captura';
        } elseif ($result['needs_fallback']) {
            $result['recommendations'][] = 'Qualidade insuficiente, usar OCR alternativo';
        }
        
        if ($result['quality_level'] === 'excellent') {
            $result['recommendations'][] = 'Qualidade excelente, processamento confiável';
        }
        
        return $result;
    }
    
    /**
     * Validate email with comprehensive checks
     * 
     * @param string $email
     * @param array $options
     * @return array
     */
    public function validateEmail(string $email, array $options = []): array
    {
        $result = [
            'is_valid' => false,
            'normalized' => '',
            'original' => $email,
            'errors' => [],
            'warnings' => []
        ];
        
        // Basic validation
        if (empty(trim($email))) {
            $result['errors'][] = 'Email é obrigatório';
            return $result;
        }
        
        // Normalize email
        $normalized = mb_strtolower(trim($email), 'UTF-8');
        $result['normalized'] = $normalized;
        
        // Length validation
        if (strlen($normalized) > 255) {
            $result['errors'][] = 'Email muito longo (máximo 255 caracteres)';
        }
        
        // Format validation
        if (!filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
            $result['errors'][] = 'Formato de email inválido';
        }
        
        // Additional checks
        if (empty($result['errors'])) {
            // Check for common issues
            if (strpos($normalized, '..') !== false) {
                $result['warnings'][] = 'Email contém pontos consecutivos';
            }
            
            if (preg_match('/[^a-z0-9@._+-]/', $normalized)) {
                $result['warnings'][] = 'Email contém caracteres não padrão';
            }
            
            // Check for disposable email domains (optional)
            if (!empty($options['check_disposable']) && $this->isDisposableEmail($normalized)) {
                $result['warnings'][] = 'Email pode ser temporário/descartável';
            }
            
            $result['is_valid'] = true;
        }
        
        return $result;
    }
    
    /**
     * Validate phone number (Brazilian format)
     * 
     * @param string $phone
     * @return array
     */
    public function validatePhone(string $phone): array
    {
        $result = [
            'is_valid' => false,
            'formatted' => '',
            'clean' => '',
            'original' => $phone,
            'type' => 'unknown',
            'errors' => []
        ];
        
        // Clean phone - remove all non-numeric characters
        $clean = preg_replace('/[^0-9]/', '', $phone);
        $result['clean'] = $clean;
        
        if (empty($clean)) {
            $result['errors'][] = 'Telefone é obrigatório';
            return $result;
        }
        
        // Brazilian phone patterns
        if (preg_match('/^(\d{2})(\d{4,5})(\d{4})$/', $clean, $matches)) {
            $areaCode = $matches[1];
            $number1 = $matches[2];
            $number2 = $matches[3];
            
            // Validate area code
            $validAreaCodes = [
                11, 12, 13, 14, 15, 16, 17, 18, 19, // São Paulo
                21, 22, 24, // Rio de Janeiro
                27, 28, // Espírito Santo
                31, 32, 33, 34, 35, 37, 38, // Minas Gerais
                41, 42, 43, 44, 45, 46, // Paraná
                47, 48, 49, // Santa Catarina
                51, 53, 54, 55, // Rio Grande do Sul
                61, // Distrito Federal
                62, 64, // Goiás
                63, // Tocantins
                65, 66, // Mato Grosso
                67, // Mato Grosso do Sul
                68, // Acre
                69, // Rondônia
                71, 73, 74, 75, 77, // Bahia
                79, // Sergipe
                81, 87, // Pernambuco
                82, // Alagoas
                83, // Paraíba
                84, // Rio Grande do Norte
                85, 88, // Ceará
                86, 89, // Piauí
                91, 93, 94, // Pará
                92, 97, // Amazonas
                95, // Roraima
                96, // Amapá
                98, 99, // Maranhão
            ];
            
            if (!in_array(intval($areaCode), $validAreaCodes)) {
                $result['errors'][] = 'Código de área inválido';
            }
            
            // Determine type
            if (strlen($number1) === 5) {
                // Mobile (9 digits after area code)
                if ($number1[0] === '9') {
                    $result['type'] = 'mobile';
                    $result['formatted'] = "+55 ($areaCode) $number1-$number2";
                } else {
                    $result['errors'][] = 'Celular deve começar com 9';
                }
            } elseif (strlen($number1) === 4) {
                // Landline (8 digits after area code)
                $result['type'] = 'landline';
                $result['formatted'] = "+55 ($areaCode) $number1-$number2";
            } else {
                $result['errors'][] = 'Número de telefone com formato incorreto';
            }
            
            if (empty($result['errors'])) {
                $result['is_valid'] = true;
            }
            
        } else {
            $result['errors'][] = 'Formato de telefone inválido';
        }
        
        return $result;
    }
    
    /**
     * Validate Brazilian CEP (postal code)
     * 
     * @param string $cep
     * @return array
     */
    public function validateCEP(string $cep): array
    {
        $result = [
            'is_valid' => false,
            'formatted' => '',
            'clean' => '',
            'original' => $cep,
            'errors' => []
        ];
        
        // Clean CEP - remove all non-numeric characters
        $clean = preg_replace('/[^0-9]/', '', $cep);
        $result['clean'] = $clean;
        
        if (empty($clean)) {
            $result['errors'][] = 'CEP é obrigatório';
            return $result;
        }
        
        // Must have exactly 8 digits
        if (strlen($clean) !== 8) {
            $result['errors'][] = 'CEP deve ter exatamente 8 dígitos';
            return $result;
        }
        
        // Check for invalid patterns
        if (preg_match('/^(\d)\1{7}$/', $clean)) {
            $result['errors'][] = 'CEP com todos os dígitos iguais não é válido';
            return $result;
        }
        
        // Format CEP
        $result['formatted'] = substr($clean, 0, 5) . '-' . substr($clean, 5, 3);
        $result['is_valid'] = true;
        
        return $result;
    }
    
    /**
     * Sanitize and validate text input
     * 
     * @param string $text
     * @param array $options
     * @return array
     */
    public function sanitizeText(string $text, array $options = []): array
    {
        $defaultOptions = [
            'max_length' => 255,
            'min_length' => 0,
            'allow_html' => false,
            'preserve_line_breaks' => false,
            'trim_whitespace' => true,
            'normalize_spaces' => true
        ];
        
        $options = array_merge($defaultOptions, $options);
        
        $result = [
            'is_valid' => true,
            'sanitized' => $text,
            'original' => $text,
            'errors' => [],
            'warnings' => []
        ];
        
        $sanitized = $text;
        
        // Trim whitespace
        if ($options['trim_whitespace']) {
            $sanitized = trim($sanitized);
        }
        
        // Normalize spaces
        if ($options['normalize_spaces']) {
            if ($options['preserve_line_breaks']) {
                $sanitized = preg_replace('/[^\S\n]+/', ' ', $sanitized);
            } else {
                $sanitized = preg_replace('/\s+/', ' ', $sanitized);
            }
        }
        
        // Handle HTML
        if (!$options['allow_html']) {
            $sanitized = strip_tags($sanitized);
            if ($sanitized !== $text) {
                $result['warnings'][] = 'Tags HTML foram removidas';
            }
        } else {
            $sanitized = htmlspecialchars($sanitized, ENT_QUOTES, 'UTF-8');
        }
        
        // Length validation
        $length = mb_strlen($sanitized, 'UTF-8');
        
        if ($length < $options['min_length']) {
            $result['errors'][] = "Texto muito curto (mínimo {$options['min_length']} caracteres)";
            $result['is_valid'] = false;
        }
        
        if ($length > $options['max_length']) {
            $result['errors'][] = "Texto muito longo (máximo {$options['max_length']} caracteres)";
            $result['is_valid'] = false;
        }
        
        $result['sanitized'] = $sanitized;
        
        return $result;
    }
    
    /**
     * Check if email domain is disposable/temporary
     * 
     * @param string $email
     * @return bool
     */
    private function isDisposableEmail(string $email): bool
    {
        $disposableDomains = [
            '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
            'mailinator.com', 'throwaway.email', 'temp-mail.org'
        ];
        
        $domain = substr(strrchr($email, '@'), 1);
        
        return in_array($domain, $disposableDomains);
    }
    
    /**
     * Comprehensive validation for user registration data
     * 
     * @param array $data
     * @return array
     */
    public function validateUserRegistration(array $data): array
    {
        $result = [
            'is_valid' => true,
            'validated_data' => [],
            'errors' => [],
            'warnings' => []
        ];
        
        // Validate name
        if (isset($data['name'])) {
            $nameValidation = $this->sanitizeText($data['name'], [
                'min_length' => 3,
                'max_length' => 255
            ]);
            
            if ($nameValidation['is_valid']) {
                $result['validated_data']['name'] = $nameValidation['sanitized'];
            } else {
                $result['errors'] = array_merge($result['errors'], $nameValidation['errors']);
                $result['is_valid'] = false;
            }
        }
        
        // Validate email
        if (isset($data['email'])) {
            $emailValidation = $this->validateEmail($data['email'], ['check_disposable' => true]);
            
            if ($emailValidation['is_valid']) {
                $result['validated_data']['email'] = $emailValidation['normalized'];
                $result['warnings'] = array_merge($result['warnings'], $emailValidation['warnings']);
            } else {
                $result['errors'] = array_merge($result['errors'], $emailValidation['errors']);
                $result['is_valid'] = false;
            }
        }
        
        // Validate CPF
        if (isset($data['cpf'])) {
            $cpfValidation = $this->documentService->validateCPF($data['cpf']);
            
            if ($cpfValidation['is_valid']) {
                $result['validated_data']['cpf'] = $cpfValidation['clean'];
            } else {
                $result['errors'] = array_merge($result['errors'], $cpfValidation['errors']);
                $result['is_valid'] = false;
            }
        }
        
        // Validate phone
        if (isset($data['phone'])) {
            $phoneValidation = $this->validatePhone($data['phone']);
            
            if ($phoneValidation['is_valid']) {
                $result['validated_data']['phone'] = $phoneValidation['clean'];
            } else {
                $result['errors'] = array_merge($result['errors'], $phoneValidation['errors']);
                $result['is_valid'] = false;
            }
        }
        
        return $result;
    }
}