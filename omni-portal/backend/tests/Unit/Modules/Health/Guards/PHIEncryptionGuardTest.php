<?php

namespace Tests\Unit\Modules\Health\Guards;

use App\Modules\Health\Guards\PHIEncryptionGuard;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;
use PHPUnit\Framework\TestCase;

/**
 * Test suite for PHI Encryption Guard
 *
 * Validates that PHI fields are encrypted before database save operations
 */
class PHIEncryptionGuardTest extends TestCase
{
    /**
     * Test model using PHI encryption guard
     */
    private function getTestModel(): Model
    {
        return new class extends Model {
            use PHIEncryptionGuard;

            protected $table = 'test_models';
            protected $fillable = ['name', 'email', 'phone', 'data'];

            // Define PHI fields that must be encrypted
            protected $encrypted = ['email', 'phone', 'data'];
        };
    }

    /**
     * Test that guard throws exception for unencrypted PHI field
     */
    public function test_throws_exception_for_unencrypted_phi_field(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage("PHI field 'email' MUST be encrypted before save");

        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = 'john@example.com'; // Unencrypted email

        // Trigger saving event (without actually saving to DB)
        $model->syncOriginal();
        $model->fireModelEvent('saving');
    }

    /**
     * Test that guard allows encrypted PHI field with Laravel prefix
     */
    public function test_allows_encrypted_phi_field_with_prefix(): void
    {
        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = 'encrypted:base64encodedencryptedvalue';

        // Should not throw exception
        $model->syncOriginal();
        $model->fireModelEvent('saving');

        $this->assertTrue(true); // Assertion to confirm no exception
    }

    /**
     * Test that guard allows encrypted PHI field with base64 format
     */
    public function test_allows_encrypted_phi_field_with_base64(): void
    {
        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = 'eyJpdiI6ImJhc2U2NGVuY29kZWQifQ==';

        // Should not throw exception
        $model->syncOriginal();
        $model->fireModelEvent('saving');

        $this->assertTrue(true);
    }

    /**
     * Test that guard allows null PHI fields
     */
    public function test_allows_null_phi_fields(): void
    {
        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = null;
        $model->phone = null;

        // Should not throw exception for null values
        $model->syncOriginal();
        $model->fireModelEvent('saving');

        $this->assertTrue(true);
    }

    /**
     * Test that guard allows empty string PHI fields
     */
    public function test_allows_empty_string_phi_fields(): void
    {
        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = '';
        $model->phone = '';

        // Should not throw exception for empty strings
        $model->syncOriginal();
        $model->fireModelEvent('saving');

        $this->assertTrue(true);
    }

    /**
     * Test that guard validates multiple PHI fields
     */
    public function test_validates_multiple_phi_fields(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/PHI field '(email|phone)' MUST be encrypted before save/");

        $model = $this->getTestModel();
        $model->name = 'John Doe';
        $model->email = 'encrypted:validencryptedvalue';
        $model->phone = '+1234567890'; // Unencrypted phone

        $model->syncOriginal();
        $model->fireModelEvent('saving');
    }

    /**
     * Test getEncryptedFields method returns correct fields
     */
    public function test_get_encrypted_fields_returns_correct_fields(): void
    {
        $model = $this->getTestModel();

        $encryptedFields = $model->getEncryptedFields();

        $this->assertIsArray($encryptedFields);
        $this->assertContains('email', $encryptedFields);
        $this->assertContains('phone', $encryptedFields);
        $this->assertContains('data', $encryptedFields);
    }

    /**
     * Test isFieldEncrypted method for encrypted field
     */
    public function test_is_field_encrypted_returns_true_for_encrypted(): void
    {
        $model = $this->getTestModel();
        $model->email = 'encrypted:base64value';

        $this->assertTrue($model->isFieldEncrypted('email'));
    }

    /**
     * Test isFieldEncrypted method for unencrypted field
     */
    public function test_is_field_encrypted_returns_false_for_unencrypted(): void
    {
        $model = $this->getTestModel();
        $model->email = 'plaintext@example.com';

        $this->assertFalse($model->isFieldEncrypted('email'));
    }

    /**
     * Test isFieldEncrypted method for non-PHI field
     */
    public function test_is_field_encrypted_returns_false_for_non_phi(): void
    {
        $model = $this->getTestModel();
        $model->name = 'John Doe';

        $this->assertFalse($model->isFieldEncrypted('name'));
    }

    /**
     * Test isFieldEncrypted method for empty field
     */
    public function test_is_field_encrypted_returns_true_for_empty(): void
    {
        $model = $this->getTestModel();
        $model->email = '';

        // Empty values are considered safe
        $this->assertTrue($model->isFieldEncrypted('email'));
    }

    /**
     * Test that guard works with model without encrypted property
     */
    public function test_handles_model_without_encrypted_property(): void
    {
        $model = new class extends Model {
            use PHIEncryptionGuard;

            protected $table = 'test_models';
            // No $encrypted property defined
        };

        $model->name = 'Test';

        // Should not throw exception, just log warning
        $model->syncOriginal();
        $model->fireModelEvent('saving');

        $this->assertTrue(true);
    }

    /**
     * Test exception message includes model information
     */
    public function test_exception_message_includes_model_info(): void
    {
        try {
            $model = $this->getTestModel();
            $model->email = 'unencrypted@example.com';

            $model->syncOriginal();
            $model->fireModelEvent('saving');

            $this->fail('Expected RuntimeException was not thrown');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('email', $e->getMessage());
            $this->assertStringContainsString('MUST be encrypted', $e->getMessage());
            $this->assertStringContainsString('Model:', $e->getMessage());
        }
    }
}
