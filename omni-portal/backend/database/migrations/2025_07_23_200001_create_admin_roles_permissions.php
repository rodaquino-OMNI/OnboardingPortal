<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations - Admin-specific roles and permissions
     */
    public function up(): void
    {
        // Admin roles table (separate from Spatie roles for admin-specific hierarchy)
        Schema::create('admin_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // super_admin, admin, manager, analyst, support
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->integer('hierarchy_level')->default(0); // Higher number = more permissions
            $table->boolean('is_system_role')->default(false); // Can't be deleted
            $table->json('permissions')->nullable(); // Direct permissions for this role
            $table->json('metadata')->nullable(); // Additional role configuration
            $table->timestamps();
            
            $table->index('hierarchy_level');
            $table->index('is_system_role');
        });

        // Admin permissions table with granular resource-based permissions
        Schema::create('admin_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('resource'); // users, beneficiaries, documents, analytics, etc.
            $table->string('action'); // view, create, edit, delete, export, approve, etc.
            $table->string('scope')->default('all'); // all, own, department, team
            $table->text('conditions')->nullable(); // JSON conditions for dynamic permissions
            $table->string('display_name');
            $table->text('description')->nullable();
            $table->boolean('is_sensitive')->default(false); // Requires additional verification
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->unique(['resource', 'action', 'scope']);
            $table->index(['resource', 'action']);
            $table->index('is_sensitive');
        });

        // Admin role permissions pivot table
        Schema::create('admin_role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_role_id')->constrained('admin_roles')->onDelete('cascade');
            $table->foreignId('admin_permission_id')->constrained('admin_permissions')->onDelete('cascade');
            $table->json('conditions')->nullable(); // Override conditions for this role
            $table->timestamp('granted_at')->nullable();
            $table->foreignId('granted_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            
            $table->unique(['admin_role_id', 'admin_permission_id']);
        });

        // Admin user assignments table
        Schema::create('admin_user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('admin_role_id')->constrained('admin_roles')->onDelete('cascade');
            $table->timestamp('assigned_at');
            $table->timestamp('expires_at')->nullable(); // Role expiration
            $table->foreignId('assigned_by')->constrained('users')->onDelete('cascade');
            $table->text('assignment_reason')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->unique(['user_id', 'admin_role_id']);
            $table->index(['user_id', 'is_active']);
            $table->index('expires_at');
        });

        // Admin sessions for enhanced tracking
        Schema::create('admin_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('session_id')->unique();
            $table->string('ip_address', 45);
            $table->string('user_agent');
            $table->json('device_info')->nullable(); // Browser, OS, device details
            $table->timestamp('login_at');
            $table->timestamp('last_activity_at');
            $table->timestamp('logout_at')->nullable();
            $table->string('logout_reason')->nullable(); // manual, timeout, forced, security
            $table->boolean('is_active')->default(true);
            $table->json('security_flags')->nullable(); // suspicious activity indicators
            $table->json('permissions_snapshot')->nullable(); // Permissions at login time
            $table->timestamps();
            
            $table->index(['user_id', 'is_active']);
            $table->index('last_activity_at');
            $table->index('login_at');
        });

        // Admin action logs for detailed audit trail
        Schema::create('admin_action_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('admin_session_id')->nullable()->constrained('admin_sessions')->onDelete('set null');
            $table->string('action_type'); // view, create, update, delete, export, approve, etc.
            $table->string('resource_type'); // Model class name
            $table->unsignedBigInteger('resource_id')->nullable(); // Model ID
            $table->string('resource_identifier')->nullable(); // Human-readable identifier
            $table->json('action_data')->nullable(); // What was changed/accessed
            $table->json('old_values')->nullable(); // Previous state
            $table->json('new_values')->nullable(); // New state
            $table->string('ip_address', 45);
            $table->string('user_agent');
            $table->string('request_method'); // GET, POST, PUT, DELETE
            $table->string('request_url');
            $table->json('request_payload')->nullable(); // Sanitized request data
            $table->integer('response_status');
            $table->decimal('execution_time_ms', 8, 3)->nullable();
            $table->string('risk_level')->default('low'); // low, medium, high, critical
            $table->boolean('requires_approval')->default(false);
            $table->boolean('is_approved')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_notes')->nullable();
            $table->json('security_context')->nullable(); // Additional security information
            $table->timestamps();
            
            $table->index(['user_id', 'created_at']);
            $table->index(['resource_type', 'resource_id']);
            $table->index('action_type');
            $table->index('risk_level');
            $table->index(['requires_approval', 'is_approved']);
        });

        // Admin notifications system
        Schema::create('admin_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('cascade'); // null = system-wide
            $table->string('type'); // security_alert, approval_required, system_maintenance, etc.
            $table->string('severity'); // info, warning, error, critical
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable(); // Additional notification data
            $table->string('action_url')->nullable(); // Where to go when clicked
            $table->timestamp('read_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_persistent')->default(false); // Survives logout
            $table->string('source')->nullable(); // What generated this notification
            $table->timestamps();
            
            $table->index(['user_id', 'read_at']);
            $table->index(['severity', 'created_at']);
            $table->index('expires_at');
        });

        // Admin dashboard widgets configuration
        Schema::create('admin_dashboard_widgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('widget_type'); // chart, table, metric, alert, etc.
            $table->string('widget_name');
            $table->json('widget_config'); // Widget-specific configuration
            $table->integer('position_x')->default(0);
            $table->integer('position_y')->default(0);
            $table->integer('width')->default(4);
            $table->integer('height')->default(3);
            $table->boolean('is_visible')->default(true);
            $table->integer('refresh_interval')->default(300); // seconds
            $table->json('filters')->nullable(); // Applied filters
            $table->timestamps();
            
            $table->index(['user_id', 'is_visible']);
            $table->unique(['user_id', 'widget_name']);
        });

        // Admin system settings
        Schema::create('admin_system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('category'); // security, ui, notifications, etc.
            $table->string('key')->unique();
            $table->text('value'); // JSON value
            $table->string('type'); // string, number, boolean, json
            $table->text('description')->nullable();
            $table->boolean('is_sensitive')->default(false);
            $table->boolean('requires_restart')->default(false);
            $table->string('validation_rules')->nullable(); // Laravel validation rules
            $table->foreignId('last_modified_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('last_modified_at')->nullable();
            $table->timestamps();
            
            $table->index('category');
            $table->index('is_sensitive');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('admin_system_settings');
        Schema::dropIfExists('admin_dashboard_widgets');
        Schema::dropIfExists('admin_notifications');
        Schema::dropIfExists('admin_action_logs');
        Schema::dropIfExists('admin_sessions');
        Schema::dropIfExists('admin_user_roles');
        Schema::dropIfExists('admin_role_permissions');
        Schema::dropIfExists('admin_permissions');
        Schema::dropIfExists('admin_roles');
    }
};