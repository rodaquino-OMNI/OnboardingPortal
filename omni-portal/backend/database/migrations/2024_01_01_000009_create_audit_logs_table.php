<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->string('user_type')->nullable(); // 'beneficiary', 'admin', 'system'
            $table->string('event_type'); // 'login', 'logout', 'data_access', 'data_modification', 'data_deletion', etc.
            $table->string('event_category'); // 'authentication', 'data_privacy', 'security', 'administrative'
            $table->string('model_type')->nullable(); // The Laravel model class
            $table->bigInteger('model_id')->nullable(); // The model's ID
            $table->string('action'); // 'create', 'read', 'update', 'delete', 'export', 'share'
            $table->json('old_values')->nullable(); // Previous data (for updates)
            $table->json('new_values')->nullable(); // New data (for updates/creates)
            $table->json('changed_fields')->nullable(); // List of fields that changed
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('browser')->nullable();
            $table->string('browser_version')->nullable();
            $table->string('platform')->nullable();
            $table->string('device_type')->nullable(); // 'desktop', 'mobile', 'tablet'
            $table->string('country', 2)->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('session_id')->nullable();
            $table->string('request_id')->nullable(); // Unique request identifier
            $table->string('request_method')->nullable(); // GET, POST, PUT, DELETE
            $table->string('request_url')->nullable();
            $table->json('request_headers')->nullable(); // Sanitized headers
            $table->json('request_body')->nullable(); // Sanitized request data
            $table->integer('response_status')->nullable(); // HTTP status code
            $table->decimal('response_time', 8, 3)->nullable(); // in milliseconds
            $table->boolean('is_sensitive_data')->default(false); // LGPD flag
            $table->boolean('is_successful')->default(true);
            $table->text('error_message')->nullable();
            $table->string('data_classification')->nullable(); // 'public', 'internal', 'confidential', 'restricted'
            $table->string('legal_basis')->nullable(); // LGPD legal basis for processing
            $table->boolean('user_consent')->default(false); // User gave consent for this action
            $table->timestamp('consent_timestamp')->nullable();
            $table->string('purpose')->nullable(); // Purpose of data processing
            $table->integer('retention_days')->nullable(); // How long to keep this log
            $table->timestamp('expires_at')->nullable(); // When this log should be deleted
            $table->json('tags')->nullable(); // Additional categorization
            $table->json('context')->nullable(); // Additional context data
            $table->timestamps();
            
            // Indexes for performance and compliance queries
            $table->index('user_id');
            $table->index('event_type');
            $table->index('event_category');
            $table->index('model_type');
            $table->index('model_id');
            $table->index('action');
            $table->index('created_at');
            $table->index('ip_address');
            $table->index('is_sensitive_data');
            $table->index('expires_at');
            $table->index(['model_type', 'model_id']);
            $table->index(['user_id', 'event_type', 'created_at']);
            $table->index(['event_category', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};