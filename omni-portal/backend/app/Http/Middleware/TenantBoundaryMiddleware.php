<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response as BaseResponse;

class TenantBoundaryMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): BaseResponse
    {
        // Skip for unauthenticated users or super admins
        if (!Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();

        // Super admins can access all tenants
        if ($user->hasRole('super-admin')) {
            return $next($request);
        }

        // If user has no company_id, they can only access their own resources
        if (!$user->company_id) {
            $this->enforceUserResourceBoundary($request, $user);
            return $next($request);
        }

        // Enforce tenant boundary for company users
        $this->enforceTenantBoundary($request, $user);

        return $next($request);
    }

    /**
     * Enforce tenant boundary for company users.
     */
    private function enforceTenantBoundary(Request $request, $user): void
    {
        $route = Route::current();
        $routeName = $route->getName();
        $routeParameters = $route->parameters();

        // Check route parameters for tenant-related models
        foreach ($routeParameters as $paramName => $paramValue) {
            $this->validateRouteParameter($paramName, $paramValue, $user);
        }

        // Validate request data for tenant fields
        $this->validateRequestData($request, $user);
    }

    /**
     * Validate route parameters against tenant boundaries.
     */
    private function validateRouteParameter(string $paramName, $paramValue, $user): void
    {
        $modelMappings = [
            'beneficiary' => \App\Models\Beneficiary::class,
            'document' => \App\Models\Document::class,
            'health_questionnaire' => \App\Models\HealthQuestionnaire::class,
            'interview' => \App\Models\Interview::class,
            'user' => \App\Models\User::class,
        ];

        if (!isset($modelMappings[$paramName])) {
            return;
        }

        $modelClass = $modelMappings[$paramName];
        
        if (!class_exists($modelClass)) {
            return;
        }

        try {
            $model = $modelClass::find($paramValue);
            
            if (!$model) {
                return; // Let the controller handle not found
            }

            // Check if model has company_id and belongs to current tenant
            if (isset($model->company_id) && $model->company_id !== $user->company_id) {
                abort(403, 'Access denied: Resource belongs to different tenant');
            }

            // Special case for User model - check access permissions
            if ($model instanceof \App\Models\User) {
                $this->validateUserAccess($model, $user);
            }
        } catch (\Exception $e) {
            // Log error but don't break the request
            \Log::warning("Tenant boundary check failed for {$paramName}: " . $e->getMessage());
        }
    }

    /**
     * Validate user access based on roles and tenant membership.
     */
    private function validateUserAccess($targetUser, $currentUser): void
    {
        // Users can access their own profile
        if ($targetUser->id === $currentUser->id) {
            return;
        }

        // Company admins can access users in their company
        if ($currentUser->hasRole(['company_admin', 'hr', 'manager']) && 
            $targetUser->company_id === $currentUser->company_id) {
            return;
        }

        // Check if accessing user from different company
        if ($targetUser->company_id !== $currentUser->company_id) {
            abort(403, 'Access denied: User belongs to different company');
        }
    }

    /**
     * Validate request data for tenant consistency.
     */
    private function validateRequestData(Request $request, $user): void
    {
        $data = $request->all();

        // Check if request tries to set company_id to different tenant
        if (isset($data['company_id']) && $data['company_id'] !== $user->company_id) {
            abort(403, 'Access denied: Cannot assign resources to different tenant');
        }

        // Check nested data for company_id
        foreach ($data as $key => $value) {
            if (is_array($value) && isset($value['company_id'])) {
                if ($value['company_id'] !== $user->company_id) {
                    abort(403, 'Access denied: Cannot assign nested resources to different tenant');
                }
            }
        }
    }

    /**
     * Enforce boundary for users without company_id.
     */
    private function enforceUserResourceBoundary(Request $request, $user): void
    {
        $route = Route::current();
        $routeParameters = $route->parameters();

        // Users without company can only access their own user record
        if (isset($routeParameters['user'])) {
            $userId = $routeParameters['user'];
            if ((int) $userId !== $user->id) {
                abort(403, 'Access denied: Can only access own user resources');
            }
        }

        // Block access to tenant-specific resources
        $tenantResources = ['beneficiary', 'document', 'health_questionnaire', 'interview'];
        
        foreach ($tenantResources as $resource) {
            if (isset($routeParameters[$resource])) {
                abort(403, 'Access denied: No company membership required for this resource');
            }
        }
    }
}