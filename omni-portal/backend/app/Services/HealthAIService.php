<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HealthAIService
{
    protected $apiKey;
    protected $apiUrl;
    protected $model;

    public function __construct()
    {
        $this->apiKey = config('services.anthropic.api_key');
        $this->apiUrl = 'https://api.anthropic.com/v1/messages';
        $this->model = 'claude-3-sonnet-20240229';
    }

    /**
     * Analyze health-related user query
     */
    public function analyzeHealthQuery(string $question, array $existingResponses = [], array $context = []): array
    {
        $systemPrompt = $this->buildHealthSystemPrompt();
        $userPrompt = $this->buildHealthAnalysisPrompt($question, $existingResponses, $context);

        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'x-api-key' => $this->apiKey,
                    'anthropic-version' => '2023-06-01'
                ])
                ->post($this->apiUrl, [
                    'model' => $this->model,
                    'max_tokens' => 1000,
                    'temperature' => 0.3,
                    'system' => $systemPrompt,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $userPrompt
                        ]
                    ]
                ]);

            if ($response->successful()) {
                $result = $response->json();
                $content = $result['content'][0]['text'] ?? '';
                
                return $this->parseAIResponse($content);
            } else {
                Log::error('Claude API error: ' . $response->body());
                return $this->getFallbackResponse();
            }
        } catch (\Exception $e) {
            Log::error('HealthAI Service error: ' . $e->getMessage());
            return $this->getFallbackResponse();
        }
    }

    /**
     * Generate health recommendations based on questionnaire responses
     */
    public function generateRecommendations(array $responses, float $score, string $riskLevel): array
    {
        $systemPrompt = $this->buildRecommendationSystemPrompt();
        $userPrompt = $this->buildRecommendationPrompt($responses, $score, $riskLevel);

        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'x-api-key' => $this->apiKey,
                    'anthropic-version' => '2023-06-01'
                ])
                ->post($this->apiUrl, [
                    'model' => $this->model,
                    'max_tokens' => 1500,
                    'temperature' => 0.4,
                    'system' => $systemPrompt,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $userPrompt
                        ]
                    ]
                ]);

            if ($response->successful()) {
                $result = $response->json();
                $content = $result['content'][0]['text'] ?? '';
                
                return $this->parseRecommendations($content);
            } else {
                return $this->getDefaultRecommendations($riskLevel);
            }
        } catch (\Exception $e) {
            Log::error('Recommendations generation error: ' . $e->getMessage());
            return $this->getDefaultRecommendations($riskLevel);
        }
    }

    /**
     * Analyze questionnaire responses (method required by HealthQuestionnaireController)
     */
    public function analyzeResponses(array $responses, string $templateCode): array
    {
        try {
            // Build comprehensive analysis prompt
            $systemPrompt = $this->buildAnalysisSystemPrompt();
            $userPrompt = $this->buildAnalysisPrompt($responses, $templateCode);

            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'x-api-key' => $this->apiKey,
                    'anthropic-version' => '2023-06-01'
                ])
                ->post($this->apiUrl, [
                    'model' => $this->model,
                    'max_tokens' => 2000,
                    'temperature' => 0.3,
                    'system' => $systemPrompt,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $userPrompt
                        ]
                    ]
                ]);

            if ($response->successful()) {
                $result = $response->json();
                $content = $result['content'][0]['text'] ?? '';
                
                return $this->parseAnalysisResponse($content, $responses);
            } else {
                Log::error('Claude API error in analyzeResponses: ' . $response->body());
                return $this->getFallbackAnalysis($responses);
            }
        } catch (\Exception $e) {
            Log::error('HealthAI analyzeResponses error: ' . $e->getMessage());
            return $this->getFallbackAnalysis($responses);
        }
    }

    /**
     * Detect pre-existing conditions from conversational input
     */
    public function detectPreExistingConditions(string $conversationText): array
    {
        $systemPrompt = $this->buildConditionDetectionPrompt();
        
        $userPrompt = "Analyze this health conversation for potential pre-existing conditions:\n\n" . $conversationText . "\n\nReturn structured analysis in JSON format.";

        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'x-api-key' => $this->apiKey,
                    'anthropic-version' => '2023-06-01'
                ])
                ->post($this->apiUrl, [
                    'model' => $this->model,
                    'max_tokens' => 800,
                    'temperature' => 0.2, // Lower temperature for medical accuracy
                    'system' => $systemPrompt,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => $userPrompt
                        ]
                    ]
                ]);

            if ($response->successful()) {
                $result = $response->json();
                $content = $result['content'][0]['text'] ?? '';
                
                return $this->parseConditionDetection($content);
            } else {
                return ['detected_conditions' => [], 'confidence' => 0];
            }
        } catch (\Exception $e) {
            Log::error('Condition detection error: ' . $e->getMessage());
            return ['detected_conditions' => [], 'confidence' => 0];
        }
    }

    /**
     * Build system prompt for health analysis
     */
    protected function buildHealthSystemPrompt(): string
    {
        return "You are a healthcare intake assistant helping with health questionnaires for a Brazilian health insurance company. 

Your role is to:
1. Answer health-related questions in Portuguese (Brazil)
2. Provide educational information only - never diagnose or treat
3. Detect potential health conditions from user responses
4. Suggest follow-up questions when appropriate
5. Always remind users that AI responses are not medical advice

Guidelines:
- Be empathetic and professional
- Use simple, clear Portuguese
- Focus on prevention and general wellness
- Encourage users to consult healthcare professionals for specific concerns
- Be culturally sensitive to Brazilian healthcare context

Always respond in JSON format with:
{
  \"response\": \"Your response in Portuguese\",
  \"confidence\": 0.0-1.0,
  \"follow_up_questions\": [\"question1\", \"question2\"],
  \"detected_conditions\": [\"condition1\", \"condition2\"],
  \"recommendations\": [\"recommendation1\", \"recommendation2\"]
}";
    }

    /**
     * Build user prompt for health analysis
     */
    protected function buildHealthAnalysisPrompt(string $question, array $responses, array $context): string
    {
        $prompt = "User question: {$question}\n\n";
        
        if (!empty($responses)) {
            $prompt .= "Previous questionnaire responses:\n";
            foreach ($responses as $key => $value) {
                $prompt .= "- {$key}: " . (is_array($value) ? implode(', ', $value) : $value) . "\n";
            }
            $prompt .= "\n";
        }

        if (!empty($context)) {
            $prompt .= "Additional context:\n";
            foreach ($context as $key => $value) {
                $prompt .= "- {$key}: {$value}\n";
            }
            $prompt .= "\n";
        }

        $prompt .= "Please provide a helpful response in Portuguese, including any follow-up questions that might help assess the user's health status more accurately.";

        return $prompt;
    }

    /**
     * Build system prompt for recommendations
     */
    protected function buildRecommendationSystemPrompt(): string
    {
        return "You are a health recommendation engine for a Brazilian health insurance platform.

Generate personalized health recommendations based on questionnaire responses and risk assessment.

Guidelines:
- Focus on prevention and lifestyle improvements
- Consider Brazilian healthcare context and culture
- Provide actionable, specific recommendations
- Include both immediate actions and long-term goals
- Respect cultural food preferences and lifestyle patterns
- Always encourage professional medical consultation when appropriate

Return recommendations in JSON format:
{
  \"lifestyle\": [\"lifestyle recommendations\"],
  \"diet\": [\"dietary recommendations\"],
  \"exercise\": [\"exercise recommendations\"],
  \"preventive_care\": [\"preventive care recommendations\"],
  \"priority_actions\": [\"immediate actions to take\"],
  \"medical_consultation\": \"reason if professional consultation is recommended\"
}";
    }

    /**
     * Build recommendation prompt
     */
    protected function buildRecommendationPrompt(array $responses, float $score, string $riskLevel): string
    {
        $prompt = "Health Assessment Results:\n";
        $prompt .= "Risk Level: {$riskLevel}\n";
        $prompt .= "Health Score: {$score}\n\n";
        
        $prompt .= "Questionnaire Responses:\n";
        foreach ($responses as $key => $value) {
            $prompt .= "- {$key}: " . (is_array($value) ? implode(', ', $value) : $value) . "\n";
        }
        
        $prompt .= "\nGenerate comprehensive health recommendations for this Brazilian individual.";

        return $prompt;
    }

    /**
     * Build condition detection system prompt
     */
    protected function buildConditionDetectionPrompt(): string
    {
        return "You are a medical entity recognition system specialized in detecting pre-existing health conditions from conversational text.

Your task is to analyze health conversations and identify:
1. Mentioned chronic conditions (diabetes, hypertension, etc.)
2. Medications that suggest underlying conditions
3. Symptoms that may indicate undiagnosed conditions
4. Family history that creates risk factors

Return analysis in JSON format:
{
  \"detected_conditions\": [
    {
      \"condition\": \"condition name\",
      \"confidence\": 0.0-1.0,
      \"evidence\": \"text that suggests this condition\",
      \"type\": \"diagnosed|suspected|family_history\"
    }
  ],
  \"medications\": [\"mentioned medications\"],
  \"symptoms\": [\"mentioned symptoms\"],
  \"risk_factors\": [\"identified risk factors\"],
  \"confidence\": 0.0-1.0
}";
    }

    /**
     * Parse AI response into structured format
     */
    protected function parseAIResponse(string $content): array
    {
        // Try to extract JSON from the response
        if (preg_match('/\{.*\}/s', $content, $matches)) {
            $json = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return array_merge([
                    'response' => '',
                    'confidence' => 0.8,
                    'follow_up_questions' => [],
                    'detected_conditions' => [],
                    'recommendations' => []
                ], $json);
            }
        }

        // Fallback to plain text parsing
        return [
            'response' => $content,
            'confidence' => 0.7,
            'follow_up_questions' => [],
            'detected_conditions' => [],
            'recommendations' => []
        ];
    }

    /**
     * Parse recommendations from AI response
     */
    protected function parseRecommendations(string $content): array
    {
        if (preg_match('/\{.*\}/s', $content, $matches)) {
            $json = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $json;
            }
        }

        return $this->getDefaultRecommendations('medium');
    }

    /**
     * Parse condition detection results
     */
    protected function parseConditionDetection(string $content): array
    {
        if (preg_match('/\{.*\}/s', $content, $matches)) {
            $json = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $json;
            }
        }

        return [
            'detected_conditions' => [],
            'medications' => [],
            'symptoms' => [],
            'risk_factors' => [],
            'confidence' => 0
        ];
    }

    /**
     * Get fallback response when AI service fails
     */
    protected function getFallbackResponse(): array
    {
        return [
            'response' => 'Desculpe, o serviço de assistência está temporariamente indisponível. Por favor, continue com o questionário ou entre em contato com nossa equipe de suporte.',
            'confidence' => 0.5,
            'follow_up_questions' => [],
            'detected_conditions' => [],
            'recommendations' => []
        ];
    }

    /**
     * Get default recommendations based on risk level
     */
    public function getDefaultRecommendations(string $riskLevel): array
    {
        $baseRecommendations = [
            'lifestyle' => [
                'Manter uma rotina regular de sono (7-8 horas por noite)',
                'Gerenciar o estresse através de técnicas de relaxamento',
                'Evitar o tabagismo e limitar o consumo de álcool'
            ],
            'diet' => [
                'Seguir uma dieta balanceada rica em frutas e vegetais',
                'Reduzir o consumo de alimentos ultraprocessados',
                'Manter hidratação adequada (pelo menos 2L de água por dia)'
            ],
            'exercise' => [
                'Praticar pelo menos 150 minutos de atividade física moderada por semana',
                'Incluir exercícios de fortalecimento muscular 2x por semana',
                'Incorporar atividades físicas no dia a dia (caminhadas, escadas)'
            ],
            'preventive_care' => [
                'Realizar check-ups médicos anuais',
                'Manter as vacinas em dia',
                'Realizar exames preventivos conforme idade e fatores de risco'
            ]
        ];

        if ($riskLevel === 'high') {
            $baseRecommendations['priority_actions'] = [
                'Agendar consulta médica o mais breve possível',
                'Monitorar sinais vitais regularmente',
                'Seguir rigorosamente as recomendações médicas existentes'
            ];
            $baseRecommendations['medical_consultation'] = 'Alto risco detectado - consulta médica urgente recomendada';
        } elseif ($riskLevel === 'medium') {
            $baseRecommendations['priority_actions'] = [
                'Agendar consulta médica nos próximos 30 dias',
                'Implementar mudanças no estilo de vida gradualmente',
                'Monitorar sintomas e procurar ajuda se piorarem'
            ];
        } else {
            $baseRecommendations['priority_actions'] = [
                'Manter hábitos saudáveis atuais',
                'Realizar check-up anual preventivo',
                'Continuar monitorando sua saúde regularmente'
            ];
        }

        return $baseRecommendations;
    }

    /**
     * Build system prompt for comprehensive analysis
     */
    protected function buildAnalysisSystemPrompt(): string
    {
        return "You are a comprehensive health assessment AI for a Brazilian health insurance platform.

Your role is to analyze complete health questionnaire responses and provide structured insights including:
1. Risk assessment and scoring
2. Clinical recommendations 
3. Detected health patterns and conditions
4. Next steps for care
5. Emergency indicators

Guidelines:
- Provide thorough but concise analysis
- Focus on actionable insights
- Consider Brazilian healthcare context
- Always recommend professional consultation for serious concerns
- Be culturally sensitive and appropriate

Return analysis in JSON format:
{
  \"risk_scores\": {
    \"overall_risk\": 0-100,
    \"mental_health_risk\": 0-100,
    \"physical_health_risk\": 0-100,
    \"lifestyle_risk\": 0-100
  },
  \"recommendations\": [\"recommendation1\", \"recommendation2\"],
  \"detected_conditions\": [\"condition1\", \"condition2\"],
  \"next_steps\": [\"step1\", \"step2\"],
  \"emergency_indicators\": [],
  \"confidence_score\": 0.0-1.0,
  \"analysis_summary\": \"Brief summary in Portuguese\"
}";
    }

    /**
     * Build analysis prompt for questionnaire responses
     */
    protected function buildAnalysisPrompt(array $responses, string $templateCode): string
    {
        $prompt = "Template Code: {$templateCode}\n\n";
        $prompt .= "Complete Health Questionnaire Responses:\n";
        
        foreach ($responses as $key => $value) {
            if (is_array($value)) {
                $prompt .= "- {$key}: " . implode(', ', $value) . "\n";
            } else {
                $prompt .= "- {$key}: {$value}\n";
            }
        }
        
        $prompt .= "\nProvide comprehensive health analysis with risk scoring, recommendations, and next steps.";
        
        return $prompt;
    }

    /**
     * Parse comprehensive analysis response
     */
    protected function parseAnalysisResponse(string $content, array $responses): array
    {
        // Try to extract JSON from the response
        if (preg_match('/\{.*\}/s', $content, $matches)) {
            $json = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $json;
            }
        }

        // Fallback analysis
        return $this->getFallbackAnalysis($responses);
    }

    /**
     * Generate fallback analysis when AI service fails
     */
    protected function getFallbackAnalysis(array $responses): array
    {
        // Basic risk calculation based on response patterns
        $riskScore = $this->calculateBasicRiskScore($responses);
        
        return [
            'risk_scores' => [
                'overall_risk' => $riskScore,
                'mental_health_risk' => $this->extractMentalHealthRisk($responses),
                'physical_health_risk' => $this->extractPhysicalHealthRisk($responses),
                'lifestyle_risk' => $this->extractLifestyleRisk($responses)
            ],
            'recommendations' => $this->getBasicRecommendations($riskScore),
            'detected_conditions' => [],
            'next_steps' => [
                'Complete your onboarding process',
                'Schedule a health consultation if needed',
                'Continue with document upload'
            ],
            'emergency_indicators' => [],
            'confidence_score' => 0.6,
            'analysis_summary' => 'Análise básica concluída. Recomendamos consulta médica para avaliação completa.'
        ];
    }

    /**
     * Calculate basic risk score from responses
     */
    protected function calculateBasicRiskScore(array $responses): int
    {
        $riskFactors = 0;
        $totalQuestions = count($responses);
        
        // Look for common risk indicators
        foreach ($responses as $key => $value) {
            if (is_string($value)) {
                $value = strtolower($value);
                if (in_array($value, ['yes', 'sim', 'true', '1', 'high', 'alto'])) {
                    $riskFactors++;
                }
            } elseif (is_numeric($value) && $value > 2) {
                $riskFactors++;
            }
        }
        
        return $totalQuestions > 0 ? min(100, round(($riskFactors / $totalQuestions) * 100)) : 0;
    }

    /**
     * Extract mental health risk score
     */
    protected function extractMentalHealthRisk(array $responses): int
    {
        $mentalHealthKeys = ['phq', 'gad', 'depression', 'anxiety', 'stress', 'mental'];
        $mentalRisk = 0;
        $count = 0;
        
        foreach ($responses as $key => $value) {
            foreach ($mentalHealthKeys as $mentalKey) {
                if (stripos($key, $mentalKey) !== false) {
                    if (is_numeric($value)) {
                        $mentalRisk += (int) $value;
                        $count++;
                    }
                }
            }
        }
        
        return $count > 0 ? min(100, round(($mentalRisk / $count) * 10)) : 0;
    }

    /**
     * Extract physical health risk score
     */
    protected function extractPhysicalHealthRisk(array $responses): int
    {
        $physicalKeys = ['pain', 'chronic', 'medication', 'surgery', 'condition'];
        $physicalRisk = 0;
        $count = 0;
        
        foreach ($responses as $key => $value) {
            foreach ($physicalKeys as $physicalKey) {
                if (stripos($key, $physicalKey) !== false) {
                    if ($value === 'yes' || $value === 'sim' || $value === true) {
                        $physicalRisk += 20;
                        $count++;
                    }
                }
            }
        }
        
        return min(100, $physicalRisk);
    }

    /**
     * Extract lifestyle risk score
     */
    protected function extractLifestyleRisk(array $responses): int
    {
        $lifestyleKeys = ['smoking', 'alcohol', 'exercise', 'diet', 'sleep'];
        $lifestyleRisk = 0;
        $count = 0;
        
        foreach ($responses as $key => $value) {
            foreach ($lifestyleKeys as $lifestyleKey) {
                if (stripos($key, $lifestyleKey) !== false) {
                    if (is_numeric($value)) {
                        $lifestyleRisk += (int) $value;
                        $count++;
                    }
                }
            }
        }
        
        return $count > 0 ? min(100, round(($lifestyleRisk / $count) * 15)) : 0;
    }

    /**
     * Get basic recommendations based on risk score
     */
    protected function getBasicRecommendations(int $riskScore): array
    {
        if ($riskScore > 70) {
            return [
                'Agendar consulta médica urgente',
                'Monitorar sintomas de perto',
                'Seguir recomendações médicas existentes',
                'Considerar suporte especializado'
            ];
        } elseif ($riskScore > 40) {
            return [
                'Agendar consulta médica preventiva',
                'Implementar mudanças no estilo de vida',
                'Aumentar atividade física',
                'Melhorar hábitos alimentares'
            ];
        } else {
            return [
                'Manter hábitos saudáveis atuais',
                'Realizar check-ups anuais',
                'Continuar monitoramento regular',
                'Focar em prevenção'
            ];
        }
    }
}