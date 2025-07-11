<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'cnpj',
        'email',
        'phone',
        'website',
        'logo',
        'primary_color',
        'secondary_color',
        'address',
        'city',
        'state',
        'zip_code',
        'contact_person_name',
        'contact_person_email',
        'contact_person_phone',
        'contract_start_date',
        'contract_end_date',
        'max_beneficiaries',
        'is_active',
        'settings',
        'onboarding_config',
        'features_enabled',
        'custom_fields',
    ];

    protected $casts = [
        'contract_start_date' => 'date',
        'contract_end_date' => 'date',
        'is_active' => 'boolean',
        'settings' => 'array',
        'onboarding_config' => 'array',
        'features_enabled' => 'array',
        'custom_fields' => 'array',
        'max_beneficiaries' => 'integer',
    ];

    /**
     * Get the beneficiaries for the company.
     */
    public function beneficiaries(): HasMany
    {
        return $this->hasMany(Beneficiary::class);
    }

    /**
     * Get the users (HR/Admin) for the company.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}