<?php

namespace App\Models;

use App\Modules\Health\Models\QuestionnaireResponse;

/**
 * HealthQuestionnaire Model (Alias)
 *
 * This is a backwards-compatibility alias for QuestionnaireResponse.
 * Many legacy tests and services reference HealthQuestionnaire, so this
 * class extends QuestionnaireResponse to maintain compatibility.
 *
 * @deprecated Use App\Modules\Health\Models\QuestionnaireResponse instead
 *
 * @see App\Modules\Health\Models\QuestionnaireResponse
 */
class HealthQuestionnaire extends QuestionnaireResponse
{
    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'questionnaire_responses';

    /**
     * Indicates if this is an alias model.
     *
     * @var bool
     */
    public static $isAlias = true;
}
