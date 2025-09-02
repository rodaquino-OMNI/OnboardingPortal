<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Display a listing of users
     */
    public function index(Request $request)
    {
        $query = User::query();

        // Apply filters
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('cpf', 'like', "%{$search}%");
            });
        }

        if ($request->has('department')) {
            $query->where('department', $request->input('department'));
        }

        if ($request->has('role')) {
            $query->whereHas('roles', function($q) use ($request) {
                $q->where('name', $request->input('role'));
            });
        }

        // Paginate results
        $users = $query->with('roles')
                      ->orderBy('created_at', 'desc')
                      ->paginate($request->input('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }

    /**
     * Display the specified user
     */
    public function show(User $user)
    {
        $user->load(['roles', 'permissions']);

        return response()->json([
            'success' => true,
            'data' => $user
        ]);
    }

    /**
     * Update the specified user
     */
    public function update(Request $request, User $user)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'phone' => 'sometimes|string|max:20',
            'department' => 'sometimes|string|max:100',
            'job_title' => 'sometimes|string|max:100',
            'birth_date' => 'sometimes|date|before:today',
            'gender' => 'sometimes|in:male,female,other,prefer_not_to_say',
            'marital_status' => 'sometimes|in:single,married,divorced,widowed,other',
            'preferred_language' => 'sometimes|string|max:10'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user->update($request->only([
                'name', 'email', 'phone', 'department', 
                'job_title', 'birth_date', 'gender', 
                'marital_status', 'preferred_language'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'User updated successfully',
                'data' => $user->fresh()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user'
            ], 500);
        }
    }

    /**
     * Remove the specified user
     */
    public function destroy(User $user)
    {
        // Prevent self-deletion
        if ($user->id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account'
            ], 403);
        }

        // Prevent deletion of super admins
        if ($user->hasRole('super-admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete super admin users'
            ], 403);
        }

        try {
            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user'
            ], 500);
        }
    }
}