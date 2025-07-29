<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AdminAction;
use App\Models\Beneficiary;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class UserManagementController extends Controller
{
    /**
     * Get paginated list of users with filters and search
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'page' => 'integer|min:1',
            'per_page' => 'integer|min:1|max:100',
            'search' => 'string|max:255',
            'status' => 'in:active,inactive,locked,all',
            'role' => 'string|exists:roles,name',
            'registration_status' => 'in:completed,incomplete,all',
            'sort_by' => 'in:name,email,created_at,last_login_at',
            'sort_order' => 'in:asc,desc',
        ]);

        try {
            $query = User::with(['roles', 'beneficiary', 'gamificationProgress']);

            // Apply search
            if ($request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('cpf', 'like', "%{$search}%")
                      ->orWhere('employee_id', 'like', "%{$search}%");
                });
            }

            // Apply status filter
            if ($request->status && $request->status !== 'all') {
                switch ($request->status) {
                    case 'active':
                        $query->where('is_active', true);
                        break;
                    case 'inactive':
                        $query->where('is_active', false);
                        break;
                    case 'locked':
                        $query->whereNotNull('locked_until')
                              ->where('locked_until', '>', now());
                        break;
                }
            }

            // Apply role filter
            if ($request->role) {
                $query->role($request->role);
            }

            // Apply registration status filter
            if ($request->registration_status && $request->registration_status !== 'all') {
                switch ($request->registration_status) {
                    case 'completed':
                        $query->where('registration_step', 'completed');
                        break;
                    case 'incomplete':
                        $query->where('registration_step', '!=', 'completed');
                        break;
                }
            }

            // Apply sorting
            $sortBy = $request->sort_by ?? 'created_at';
            $sortOrder = $request->sort_order ?? 'desc';
            $query->orderBy($sortBy, $sortOrder);

            $users = $query->paginate($request->per_page ?? 20);

            AdminAction::logAction(
                auth()->id(),
                'users_list_view',
                'Visualizou lista de usuários',
                null,
                $request->only(['search', 'status', 'role', 'registration_status'])
            );

            return response()->json($users);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao carregar usuários',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single user details
     */
    public function show(int $id): JsonResponse
    {
        try {
            $user = User::with([
                'roles', 
                'permissions', 
                'beneficiary', 
                'gamificationProgress',
                'documents',
                'healthQuestionnaires'
            ])->findOrFail($id);

            AdminAction::logAction(
                auth()->id(),
                'user_view',
                "Visualizou detalhes do usuário: {$user->name}",
                $user->id
            );

            return response()->json(['user' => $user]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Usuário não encontrado',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Create new user
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'cpf' => ['required', 'string', 'size:11', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'phone' => ['nullable', 'string', 'max:20'],
            'department' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employee_id' => ['nullable', 'string', 'max:50', 'unique:users'],
            'start_date' => ['nullable', 'date'],
            'role' => ['required', 'string', 'exists:roles,name'],
            'is_active' => ['boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $userData = $request->only([
                'name', 'email', 'cpf', 'phone', 'department', 
                'job_title', 'employee_id', 'start_date'
            ]);
            
            $userData['password'] = Hash::make($request->password);
            $userData['is_active'] = $request->boolean('is_active', true);
            $userData['registration_step'] = 'completed';
            $userData['email_verified_at'] = now();

            $user = User::create($userData);
            $user->assignRole($request->role);

            // Create beneficiary record if needed
            if (!$user->beneficiary) {
                Beneficiary::create([
                    'user_id' => $user->id,
                    'registration_completed' => true,
                ]);
            }

            AdminAction::logAction(
                auth()->id(),
                'user_create',
                "Criou novo usuário: {$user->name}",
                $user->id,
                ['role' => $request->role]
            );

            return response()->json([
                'message' => 'Usuário criado com sucesso',
                'user' => $user->load(['roles', 'beneficiary'])
            ], 201);

        } catch (\Exception $e) {
            AdminAction::logAction(
                auth()->id(),
                'user_create',
                'Erro ao criar usuário',
                null,
                null,
                false,
                $e->getMessage()
            );

            return response()->json([
                'message' => 'Erro ao criar usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update user
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => ['string', 'max:255'],
            'email' => ['string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'cpf' => ['string', 'size:11', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'department' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users')->ignore($user->id)],
            'start_date' => ['nullable', 'date'],
            'is_active' => ['boolean'],
            'role' => ['string', 'exists:roles,name'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $originalData = $user->toArray();
            
            $user->update($request->only([
                'name', 'email', 'cpf', 'phone', 'department', 
                'job_title', 'employee_id', 'start_date', 'is_active'
            ]));

            // Update role if provided
            if ($request->has('role')) {
                $user->syncRoles([$request->role]);
            }

            $changedFields = array_keys(array_diff_assoc($user->toArray(), $originalData));

            AdminAction::logAction(
                auth()->id(),
                'user_update',
                "Atualizou usuário: {$user->name}",
                $user->id,
                ['changed_fields' => $changedFields]
            );

            return response()->json([
                'message' => 'Usuário atualizado com sucesso',
                'user' => $user->load(['roles', 'beneficiary'])
            ]);

        } catch (\Exception $e) {
            AdminAction::logAction(
                auth()->id(),
                'user_update',
                "Erro ao atualizar usuário: {$user->name}",
                $user->id,
                null,
                false,
                $e->getMessage()
            );

            return response()->json([
                'message' => 'Erro ao atualizar usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete user (soft delete)
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);

            // Prevent self-deletion
            if ($user->id === auth()->id()) {
                return response()->json([
                    'message' => 'Não é possível excluir sua própria conta'
                ], 403);
            }

            // Prevent deletion of super-admin
            if ($user->hasRole('super-admin')) {
                return response()->json([
                    'message' => 'Não é possível excluir um super-administrador'
                ], 403);
            }

            $userName = $user->name;
            $user->delete();

            AdminAction::logAction(
                auth()->id(),
                'user_delete',
                "Excluiu usuário: {$userName}",
                $user->id
            );

            return response()->json([
                'message' => 'Usuário excluído com sucesso'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao excluir usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Activate user account
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);
            $user->update(['is_active' => true]);

            AdminAction::logAction(
                auth()->id(),
                'user_activate',
                "Ativou conta do usuário: {$user->name}",
                $user->id
            );

            return response()->json([
                'message' => 'Usuário ativado com sucesso'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao ativar usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Deactivate user account
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);

            // Prevent self-deactivation
            if ($user->id === auth()->id()) {
                return response()->json([
                    'message' => 'Não é possível desativar sua própria conta'
                ], 403);
            }

            $user->update(['is_active' => false]);

            // Revoke all tokens
            $user->tokens()->delete();

            AdminAction::logAction(
                auth()->id(),
                'user_deactivate',
                "Desativou conta do usuário: {$user->name}",
                $user->id
            );

            return response()->json([
                'message' => 'Usuário desativado com sucesso'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao desativar usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Unlock user account
     */
    public function unlock(int $id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);
            $user->update([
                'locked_until' => null,
                'failed_login_attempts' => 0
            ]);

            AdminAction::logAction(
                auth()->id(),
                'user_unlock',
                "Desbloqueou conta do usuário: {$user->name}",
                $user->id
            );

            return response()->json([
                'message' => 'Usuário desbloqueado com sucesso'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao desbloquear usuário',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset user password
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        try {
            $user = User::findOrFail($id);
            $user->update([
                'password' => Hash::make($request->password)
            ]);

            // Revoke all existing tokens to force re-login
            $user->tokens()->delete();

            AdminAction::logAction(
                auth()->id(),
                'user_password_reset',
                "Redefiniu senha do usuário: {$user->name}",
                $user->id
            );

            return response()->json([
                'message' => 'Senha redefinida com sucesso'
            ]);

        } catch (\Exception $e) {
            AdminAction::logAction(
                auth()->id(),
                'user_password_reset',
                "Erro ao redefinir senha do usuário",
                $id,
                null,
                false,
                $e->getMessage()
            );

            return response()->json([
                'message' => 'Erro ao redefinir senha',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk operations on users
     */
    public function bulkOperation(Request $request): JsonResponse
    {
        $request->validate([
            'operation' => ['required', 'in:activate,deactivate,delete,assign_role'],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'role' => ['required_if:operation,assign_role', 'string', 'exists:roles,name'],
        ]);

        try {
            $userIds = $request->user_ids;
            $operation = $request->operation;
            $results = ['success' => [], 'failed' => []];

            // Prevent operations on self
            if (in_array(auth()->id(), $userIds)) {
                return response()->json([
                    'message' => 'Não é possível executar operações em massa na sua própria conta'
                ], 403);
            }

            foreach ($userIds as $userId) {
                try {
                    $user = User::findOrFail($userId);

                    switch ($operation) {
                        case 'activate':
                            $user->update(['is_active' => true]);
                            break;
                        case 'deactivate':
                            if (!$user->hasRole('super-admin')) {
                                $user->update(['is_active' => false]);
                                $user->tokens()->delete();
                            }
                            break;
                        case 'delete':
                            if (!$user->hasRole('super-admin')) {
                                $user->delete();
                            }
                            break;
                        case 'assign_role':
                            $user->syncRoles([$request->role]);
                            break;
                    }

                    $results['success'][] = $userId;

                } catch (\Exception $e) {
                    $results['failed'][] = ['user_id' => $userId, 'error' => $e->getMessage()];
                }
            }

            AdminAction::logAction(
                auth()->id(),
                'users_bulk_operation',
                "Executou operação em massa: {$operation}",
                null,
                [
                    'operation' => $operation,
                    'total_users' => count($userIds),
                    'successful' => count($results['success']),
                    'failed' => count($results['failed'])
                ]
            );

            return response()->json([
                'message' => 'Operação em massa executada',
                'results' => $results
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro na operação em massa',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available roles for assignment
     */
    public function getRoles(): JsonResponse
    {
        try {
            $roles = Role::all(['id', 'name', 'guard_name']);
            
            return response()->json(['roles' => $roles]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao carregar roles',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}