<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Brazilian Document Validation Service
 * 
 * Handles validation of Brazilian documents including CPF, RG, CNH
 * with proper edge case handling and format normalization.
 */
class BrazilianDocumentService
{
    /**
     * Validate CPF number with comprehensive edge case handling
     * 
     * @param string $cpf
     * @return array
     */
    public function validateCPF(string $cpf): array
    {
        $originalCpf = $cpf;
        
        // Clean CPF - remove all non-numeric characters
        $cpf = preg_replace('/[^0-9]/', '', $cpf);
        
        // Initialize validation result
        $result = [
            'is_valid' => false,
            'formatted' => '',
            'clean' => $cpf,
            'original' => $originalCpf,
            'errors' => []
        ];
        
        // Must have exactly 11 digits
        if (strlen($cpf) !== 11) {
            $result['errors'][] = 'CPF deve conter exatamente 11 dígitos';
            return $result;
        }
        
        // Check for known invalid patterns (all same digits)
        if (preg_match('/^(\d)\1{10}$/', $cpf)) {
            // Allow test CPFs in non-production environments
            if (app()->environment('production')) {
                $result['errors'][] = 'CPF com todos os dígitos iguais não é válido';
                return $result;
            } else {
                // In non-production, allow specific test CPFs
                $testCPFs = [
                    '11111111111', '22222222222', '33333333333',
                    '44444444444', '55555555555', '66666666666',
                    '77777777777', '88888888888', '99999999999',
                    '00000000000', '12345678901'
                ];
                
                if (in_array($cpf, $testCPFs)) {
                    $result['is_valid'] = true;
                    $result['formatted'] = $this->formatCPF($cpf);
                    return $result;
                }
            }
        }
        
        // Validate first check digit
        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += intval($cpf[$i]) * (10 - $i);
        }
        $remainder = $sum % 11;
        $digit1 = $remainder < 2 ? 0 : 11 - $remainder;
        
        if (intval($cpf[9]) !== $digit1) {
            $result['errors'][] = 'CPF possui dígito verificador inválido';
            return $result;
        }
        
        // Validate second check digit
        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += intval($cpf[$i]) * (11 - $i);
        }
        $remainder = $sum % 11;
        $digit2 = $remainder < 2 ? 0 : 11 - $remainder;
        
        if (intval($cpf[10]) !== $digit2) {
            $result['errors'][] = 'CPF possui segundo dígito verificador inválido';
            return $result;
        }
        
        // CPF is valid
        $result['is_valid'] = true;
        $result['formatted'] = $this->formatCPF($cpf);
        
        return $result;
    }
    
    /**
     * Format CPF with dots and dash
     * 
     * @param string $cpf
     * @return string
     */
    public function formatCPF(string $cpf): string
    {
        $cpf = preg_replace('/[^0-9]/', '', $cpf);
        
        if (strlen($cpf) !== 11) {
            return $cpf;
        }
        
        return substr($cpf, 0, 3) . '.' . 
               substr($cpf, 3, 3) . '.' . 
               substr($cpf, 6, 3) . '-' . 
               substr($cpf, 9, 2);
    }
    
    /**
     * Clean CPF (remove formatting)
     * 
     * @param string $cpf
     * @return string
     */
    public function cleanCPF(string $cpf): string
    {
        return preg_replace('/[^0-9]/', '', $cpf);
    }
    
    /**
     * Parse and validate Brazilian date with proper year handling
     * 
     * This fixes the edge case where '90' should become '1990', not '0090'
     * 
     * @param string $dateString
     * @param int $centuryThreshold
     * @return array
     */
    public function parseDate(string $dateString, int $centuryThreshold = 30): array
    {
        $result = [
            'is_valid' => false,
            'parsed_date' => null,
            'formatted' => '',
            'original' => $dateString,
            'errors' => []
        ];
        
        // Common Brazilian date formats
        $formats = [
            'd/m/Y' => '/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/',           // 15/05/1990
            'd-m-Y' => '/^(\d{1,2})-(\d{1,2})-(\d{4})$/',            // 15-05-1990
            'Y-m-d' => '/^(\d{4})-(\d{1,2})-(\d{1,2})$/',            // 1990-05-15
            'd/m/y' => '/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/',          // 15/05/90
            'd-m-y' => '/^(\d{1,2})-(\d{1,2})-(\d{2})$/',            // 15-05-90
        ];
        
        foreach ($formats as $format => $pattern) {
            if (preg_match($pattern, trim($dateString), $matches)) {
                try {
                    if ($format === 'Y-m-d') {
                        $year = intval($matches[1]);
                        $month = intval($matches[2]);
                        $day = intval($matches[3]);
                    } elseif (in_array($format, ['d/m/y', 'd-m-y'])) {
                        $day = intval($matches[1]);
                        $month = intval($matches[2]);
                        $year = intval($matches[3]);
                        
                        // Fix the 90 → 1990 issue (not 0090)
                        if ($year <= $centuryThreshold) {
                            $year += 2000; // 00-30 becomes 2000-2030
                        } else {
                            $year += 1900; // 31-99 becomes 1931-1999
                        }
                    } else {
                        $day = intval($matches[1]);
                        $month = intval($matches[2]);
                        $year = intval($matches[3]);
                    }
                    
                    // Validate date components
                    if (!checkdate($month, $day, $year)) {
                        $result['errors'][] = 'Data inválida: dia, mês ou ano incorretos';
                        continue;
                    }
                    
                    // Create Carbon instance
                    $date = Carbon::createFromDate($year, $month, $day);
                    
                    // Additional validations
                    $now = Carbon::now();
                    $minDate = Carbon::createFromDate(1900, 1, 1);
                    $maxDate = $now->addYears(100);
                    
                    if ($date->lt($minDate)) {
                        $result['errors'][] = 'Data muito antiga (anterior a 1900)';
                        continue;
                    }
                    
                    if ($date->gt($maxDate)) {
                        $result['errors'][] = 'Data muito futura';
                        continue;
                    }
                    
                    $result['is_valid'] = true;
                    $result['parsed_date'] = $date;
                    $result['formatted'] = $date->format('Y-m-d');
                    
                    return $result;
                    
                } catch (\Exception $e) {
                    $result['errors'][] = 'Erro ao processar data: ' . $e->getMessage();
                    continue;
                }
            }
        }
        
        if (empty($result['errors'])) {
            $result['errors'][] = 'Formato de data não reconhecido';
        }
        
        return $result;
    }
    
    /**
     * Normalize Brazilian string preserving special characters
     * 
     * This fixes string normalization to properly handle Brazilian characters
     * 
     * @param string $string
     * @param bool $preserveAccents
     * @return string
     */
    public function normalizeString(string $string, bool $preserveAccents = false): string
    {
        // Trim and normalize whitespace
        $normalized = trim(preg_replace('/\s+/', ' ', $string));
        
        if (!$preserveAccents) {
            // Convert accented characters to their base forms
            $accents = [
                'á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'ä' => 'a',
                'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
                'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
                'ó' => 'o', 'ò' => 'o', 'õ' => 'o', 'ô' => 'o', 'ö' => 'o',
                'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
                'ç' => 'c', 'ñ' => 'n',
                'Á' => 'A', 'À' => 'A', 'Ã' => 'A', 'Â' => 'A', 'Ä' => 'A',
                'É' => 'E', 'È' => 'E', 'Ê' => 'E', 'Ë' => 'E',
                'Í' => 'I', 'Ì' => 'I', 'Î' => 'I', 'Ï' => 'I',
                'Ó' => 'O', 'Ò' => 'O', 'Õ' => 'O', 'Ô' => 'O', 'Ö' => 'O',
                'Ú' => 'U', 'Ù' => 'U', 'Û' => 'U', 'Ü' => 'U',
                'Ç' => 'C', 'Ñ' => 'N'
            ];
            
            $normalized = strtr($normalized, $accents);
        }
        
        return mb_strtolower($normalized, 'UTF-8');
    }
    
    /**
     * Calculate string similarity with Brazilian character handling
     * 
     * @param string $str1
     * @param string $str2
     * @param bool $preserveAccents
     * @return float
     */
    public function calculateSimilarity(string $str1, string $str2, bool $preserveAccents = false): float
    {
        $normalized1 = $this->normalizeString($str1, $preserveAccents);
        $normalized2 = $this->normalizeString($str2, $preserveAccents);
        
        // Use Levenshtein distance for better accuracy with Brazilian names
        $maxLength = max(strlen($normalized1), strlen($normalized2));
        
        if ($maxLength === 0) {
            return 100.0;
        }
        
        $distance = levenshtein($normalized1, $normalized2);
        $similarity = (($maxLength - $distance) / $maxLength) * 100;
        
        return round($similarity, 2);
    }
    
    /**
     * Validate RG (Brazilian ID) format
     * 
     * @param string $rg
     * @return array
     */
    public function validateRG(string $rg): array
    {
        $result = [
            'is_valid' => false,
            'formatted' => '',
            'clean' => '',
            'original' => $rg,
            'errors' => []
        ];
        
        // Clean RG - remove all non-alphanumeric characters except X
        $cleanRg = preg_replace('/[^0-9X]/i', '', strtoupper($rg));
        $result['clean'] = $cleanRg;
        
        // Basic length validation (7-9 characters for most states)
        if (strlen($cleanRg) < 7 || strlen($cleanRg) > 9) {
            $result['errors'][] = 'RG deve ter entre 7 e 9 caracteres';
            return $result;
        }
        
        // Check for valid pattern (numbers and optionally X at the end)
        if (!preg_match('/^[0-9]{7,8}[0-9X]?$/i', $cleanRg)) {
            $result['errors'][] = 'RG possui formato inválido';
            return $result;
        }
        
        $result['is_valid'] = true;
        $result['formatted'] = $this->formatRG($cleanRg);
        
        return $result;
    }
    
    /**
     * Format RG with dots and dash
     * 
     * @param string $rg
     * @return string
     */
    private function formatRG(string $rg): string
    {
        $rg = strtoupper(preg_replace('/[^0-9X]/i', '', $rg));
        
        if (strlen($rg) === 8) {
            return substr($rg, 0, 2) . '.' . substr($rg, 2, 3) . '.' . substr($rg, 5, 3);
        } elseif (strlen($rg) === 9) {
            return substr($rg, 0, 2) . '.' . substr($rg, 2, 3) . '.' . substr($rg, 5, 3) . '-' . substr($rg, 8, 1);
        }
        
        return $rg;
    }
    
    /**
     * Validate CNH (Brazilian Driver's License) format
     * 
     * @param string $cnh
     * @return array
     */
    public function validateCNH(string $cnh): array
    {
        $result = [
            'is_valid' => false,
            'clean' => '',
            'original' => $cnh,
            'errors' => []
        ];
        
        // Clean CNH - remove all non-numeric characters
        $cleanCnh = preg_replace('/[^0-9]/', '', $cnh);
        $result['clean'] = $cleanCnh;
        
        // Must have exactly 11 digits
        if (strlen($cleanCnh) !== 11) {
            $result['errors'][] = 'CNH deve ter exatamente 11 dígitos';
            return $result;
        }
        
        // Check for known invalid patterns (all same digits)
        if (preg_match('/^(\d)\1{10}$/', $cleanCnh)) {
            $result['errors'][] = 'CNH com todos os dígitos iguais não é válida';
            return $result;
        }
        
        // CNH validation algorithm
        $sum = 0;
        $sequence = 0;
        
        for ($i = 0, $j = 9; $i < 9; $i++, $j--) {
            $sum += intval($cleanCnh[$i]) * $j;
        }
        
        $dv1 = $sum % 11;
        $dv1 = ($dv1 >= 2) ? (11 - $dv1) : 0;
        
        if (intval($cleanCnh[9]) !== $dv1) {
            $result['errors'][] = 'CNH possui dígito verificador inválido';
            return $result;
        }
        
        // Second digit calculation
        for ($i = 0; $i < 9; $i++) {
            if (intval($cleanCnh[$i]) === intval($cleanCnh[$i + 1])) {
                $sequence++;
            }
        }
        
        $sum = 0;
        for ($i = 0, $j = 1; $i < 9; $i++, $j++) {
            $sum += intval($cleanCnh[$i]) * $j;
        }
        
        $dv2 = $sum % 11;
        $dv2 = ($dv2 >= 2) ? (11 - $dv2) : 0;
        
        if ($sequence > 0) {
            $dv2 = ($dv2 === 1) ? 0 : $dv2 - 1;
        }
        
        if (intval($cleanCnh[10]) !== $dv2) {
            $result['errors'][] = 'CNH possui segundo dígito verificador inválido';
            return $result;
        }
        
        $result['is_valid'] = true;
        
        return $result;
    }
    
    /**
     * Log validation attempt for auditing
     * 
     * @param string $document_type
     * @param string $original_value
     * @param array $validation_result
     * @return void
     */
    private function logValidationAttempt(string $document_type, string $original_value, array $validation_result): void
    {
        if (config('app.debug', false)) {
            Log::channel('validation')->info('Document validation attempt', [
                'type' => $document_type,
                'original' => substr($original_value, 0, 3) . '***', // Mask for privacy
                'is_valid' => $validation_result['is_valid'],
                'errors' => $validation_result['errors'] ?? [],
                'timestamp' => now()->toISOString()
            ]);
        }
    }
}