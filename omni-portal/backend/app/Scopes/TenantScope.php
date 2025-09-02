<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class TenantScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model): void
    {
        // Only apply scope if user is authenticated and has a company_id
        if (Auth::check() && Auth::user()->company_id) {
            $builder->where($model->getTable() . '.company_id', Auth::user()->company_id);
        }
    }

    /**
     * Extend the query builder with the needed functions.
     */
    public function extend(Builder $builder): void
    {
        $this->addWithoutTenant($builder);
        $this->addWithTenant($builder);
        $this->addOnlyTenant($builder);
    }

    /**
     * Add the withoutTenant extension to the builder.
     */
    protected function addWithoutTenant(Builder $builder): void
    {
        $builder->macro('withoutTenant', function (Builder $builder) {
            return $builder->withoutGlobalScope($this);
        });
    }

    /**
     * Add the withTenant extension to the builder.
     */
    protected function addWithTenant(Builder $builder): void
    {
        $builder->macro('withTenant', function (Builder $builder, $tenantId) {
            return $builder->withoutGlobalScope($this)
                          ->where($builder->getModel()->getTable() . '.company_id', $tenantId);
        });
    }

    /**
     * Add the onlyTenant extension to the builder.
     */
    protected function addOnlyTenant(Builder $builder): void
    {
        $builder->macro('onlyTenant', function (Builder $builder, $tenantId) {
            return $builder->withoutGlobalScope($this)
                          ->where($builder->getModel()->getTable() . '.company_id', $tenantId);
        });
    }
}