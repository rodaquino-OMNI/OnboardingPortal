<?php

namespace Database\Seeders;

use App\Modules\Health\Models\Questionnaire;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * QuestionnaireSeeder - Seed health questionnaire templates
 *
 * Creates comprehensive questionnaire templates for testing and development:
 * - PHQ-9 (Patient Health Questionnaire - Depression)
 * - GAD-7 (Generalized Anxiety Disorder)
 * - General Health Assessment
 *
 * Each questionnaire includes:
 * - Question schema with validation rules
 * - Branching logic for adaptive questioning
 * - Scoring rules for risk assessment
 * - Multiple language support
 *
 * @see app/Modules/Health/Models/Questionnaire.php
 * @see docs/phase1-health-services-implementation.md
 */
class QuestionnaireSeeder extends Seeder
{
    /**
     * Run the database seeds
     */
    public function run(): void
    {
        // Ensure we have a system user for questionnaire ownership
        $systemUser = User::firstOrCreate(
            ['email' => 'system@onboardingportal.com'],
            [
                'name' => 'System User',
                'email_verified_at' => now(),
                'password' => bcrypt('system-password-' . bin2hex(random_bytes(16))),
            ]
        );

        // 1. PHQ-9 - Depression Screening Questionnaire
        $this->seedPHQ9Questionnaire($systemUser);

        // 2. GAD-7 - Anxiety Screening Questionnaire
        $this->seedGAD7Questionnaire($systemUser);

        // 3. General Health Assessment
        $this->seedGeneralHealthQuestionnaire($systemUser);

        $this->command->info('✅ Seeded 3 questionnaire templates');
    }

    /**
     * Seed PHQ-9 (Patient Health Questionnaire for Depression)
     *
     * Standard clinical instrument for assessing depression severity
     * Scoring: 0-27 (minimal, mild, moderate, moderately severe, severe)
     */
    private function seedPHQ9Questionnaire(User $user): void
    {
        Questionnaire::updateOrCreate(
            [
                'user_id' => $user->id,
                'version' => 1,
            ],
            [
                'schema_json' => [
                    'title' => 'PHQ-9 - Depression Screening',
                    'description' => 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
                    'sections' => [
                        [
                            'id' => 'section_1',
                            'title' => 'Depression Symptoms',
                            'questions' => [
                                [
                                    'id' => 'phq9_q1',
                                    'text' => 'Little interest or pleasure in doing things',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q2',
                                    'text' => 'Feeling down, depressed, or hopeless',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q3',
                                    'text' => 'Trouble falling or staying asleep, or sleeping too much',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q4',
                                    'text' => 'Feeling tired or having little energy',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q5',
                                    'text' => 'Poor appetite or overeating',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q6',
                                    'text' => 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q7',
                                    'text' => 'Trouble concentrating on things, such as reading the newspaper or watching television',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q8',
                                    'text' => 'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'phq9_q9',
                                    'text' => 'Thoughts that you would be better off dead, or of hurting yourself in some way',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                            ],
                        ],
                        [
                            'id' => 'section_2',
                            'title' => 'Impact Assessment',
                            'condition' => [
                                'operator' => '>',
                                'question_id' => 'total_score',
                                'value' => 0,
                            ],
                            'questions' => [
                                [
                                    'id' => 'phq9_q10',
                                    'text' => 'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?',
                                    'type' => 'select',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not difficult at all'],
                                        ['value' => 1, 'label' => 'Somewhat difficult'],
                                        ['value' => 2, 'label' => 'Very difficult'],
                                        ['value' => 3, 'label' => 'Extremely difficult'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    'scoring_rules' => [
                        'type' => 'sum',
                        'questions' => ['phq9_q1', 'phq9_q2', 'phq9_q3', 'phq9_q4', 'phq9_q5', 'phq9_q6', 'phq9_q7', 'phq9_q8', 'phq9_q9'],
                        'max_score' => 27,
                        'risk_bands' => [
                            ['min' => 0, 'max' => 4, 'label' => 'low', 'severity' => 'Minimal depression'],
                            ['min' => 5, 'max' => 9, 'label' => 'low', 'severity' => 'Mild depression'],
                            ['min' => 10, 'max' => 14, 'label' => 'moderate', 'severity' => 'Moderate depression'],
                            ['min' => 15, 'max' => 19, 'label' => 'high', 'severity' => 'Moderately severe depression'],
                            ['min' => 20, 'max' => 27, 'label' => 'critical', 'severity' => 'Severe depression'],
                        ],
                    ],
                    'branching_rules' => [
                        'phq9_q9' => [
                            'if_gt_0' => [
                                'action' => 'flag_for_review',
                                'message' => 'Immediate safety assessment recommended',
                            ],
                        ],
                    ],
                ],
                'status' => 'reviewed',
                'published_at' => now(),
                'is_active' => true,
            ]
        );
    }

    /**
     * Seed GAD-7 (Generalized Anxiety Disorder)
     *
     * Standard clinical instrument for assessing anxiety severity
     * Scoring: 0-21 (minimal, mild, moderate, severe)
     */
    private function seedGAD7Questionnaire(User $user): void
    {
        Questionnaire::updateOrCreate(
            [
                'user_id' => $user->id,
                'version' => 2,
            ],
            [
                'schema_json' => [
                    'title' => 'GAD-7 - Anxiety Screening',
                    'description' => 'Over the last 2 weeks, how often have you been bothered by the following problems?',
                    'sections' => [
                        [
                            'id' => 'section_1',
                            'title' => 'Anxiety Symptoms',
                            'questions' => [
                                [
                                    'id' => 'gad7_q1',
                                    'text' => 'Feeling nervous, anxious, or on edge',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q2',
                                    'text' => 'Not being able to stop or control worrying',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q3',
                                    'text' => 'Worrying too much about different things',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q4',
                                    'text' => 'Trouble relaxing',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q5',
                                    'text' => 'Being so restless that it is hard to sit still',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q6',
                                    'text' => 'Becoming easily annoyed or irritable',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                                [
                                    'id' => 'gad7_q7',
                                    'text' => 'Feeling afraid, as if something awful might happen',
                                    'type' => 'likert',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 0, 'label' => 'Not at all'],
                                        ['value' => 1, 'label' => 'Several days'],
                                        ['value' => 2, 'label' => 'More than half the days'],
                                        ['value' => 3, 'label' => 'Nearly every day'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    'scoring_rules' => [
                        'type' => 'sum',
                        'questions' => ['gad7_q1', 'gad7_q2', 'gad7_q3', 'gad7_q4', 'gad7_q5', 'gad7_q6', 'gad7_q7'],
                        'max_score' => 21,
                        'risk_bands' => [
                            ['min' => 0, 'max' => 4, 'label' => 'low', 'severity' => 'Minimal anxiety'],
                            ['min' => 5, 'max' => 9, 'label' => 'low', 'severity' => 'Mild anxiety'],
                            ['min' => 10, 'max' => 14, 'label' => 'moderate', 'severity' => 'Moderate anxiety'],
                            ['min' => 15, 'max' => 21, 'label' => 'high', 'severity' => 'Severe anxiety'],
                        ],
                    ],
                ],
                'status' => 'reviewed',
                'published_at' => now()->subDays(7),
                'is_active' => false, // Not currently active
            ]
        );
    }

    /**
     * Seed General Health Assessment
     *
     * Simplified health questionnaire for general onboarding
     */
    private function seedGeneralHealthQuestionnaire(User $user): void
    {
        Questionnaire::updateOrCreate(
            [
                'user_id' => $user->id,
                'version' => 3,
            ],
            [
                'schema_json' => [
                    'title' => 'General Health Assessment',
                    'description' => 'Please answer the following questions about your general health',
                    'sections' => [
                        [
                            'id' => 'section_1',
                            'title' => 'Medical History',
                            'questions' => [
                                [
                                    'id' => 'q1',
                                    'text' => 'Do you have any pre-existing health conditions?',
                                    'type' => 'boolean',
                                    'required' => true,
                                ],
                                [
                                    'id' => 'q2',
                                    'text' => 'Are you currently taking any medications?',
                                    'type' => 'boolean',
                                    'required' => true,
                                    'conditional' => ['q1' => true],
                                ],
                                [
                                    'id' => 'q3',
                                    'text' => 'Do you have any allergies?',
                                    'type' => 'boolean',
                                    'required' => true,
                                ],
                                [
                                    'id' => 'q4',
                                    'text' => 'Have you been hospitalized in the past year?',
                                    'type' => 'boolean',
                                    'required' => true,
                                ],
                            ],
                        ],
                        [
                            'id' => 'section_2',
                            'title' => 'Lifestyle',
                            'questions' => [
                                [
                                    'id' => 'q5',
                                    'text' => 'How would you rate your overall health?',
                                    'type' => 'select',
                                    'required' => true,
                                    'options' => [
                                        ['value' => 5, 'label' => 'Excellent'],
                                        ['value' => 4, 'label' => 'Very good'],
                                        ['value' => 3, 'label' => 'Good'],
                                        ['value' => 2, 'label' => 'Fair'],
                                        ['value' => 1, 'label' => 'Poor'],
                                    ],
                                ],
                                [
                                    'id' => 'q6',
                                    'text' => 'How many days per week do you exercise?',
                                    'type' => 'number',
                                    'required' => true,
                                    'min' => 0,
                                    'max' => 7,
                                ],
                            ],
                        ],
                    ],
                    'scoring_rules' => [
                        'type' => 'custom',
                        'description' => 'Simple health score based on lifestyle and conditions',
                    ],
                    'branching_rules' => [
                        'q1' => [
                            'if_true' => ['show' => ['q2']],
                            'if_false' => ['skip' => ['q2']],
                        ],
                    ],
                ],
                'status' => 'reviewed',
                'published_at' => now()->subDays(30),
                'is_active' => false, // Backup questionnaire
            ]
        );
    }
}
