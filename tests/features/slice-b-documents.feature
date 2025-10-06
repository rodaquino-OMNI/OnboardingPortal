Feature: Document Upload and Approval (Slice B)
  As a verified user
  I want to upload my identity documents
  So that I can complete onboarding and earn document approval points

  Background:
    Given the feature flag "slice_b_documents" is enabled
    And I am a verified user with 100 points at Level 1

  Scenario: Successful RG upload and approval
    Given I am on the documents page
    When I select a clear RG image file
    And I click "Upload RG"
    Then I should see "Uploading..." status
    And the file should be uploaded to S3 with encryption
    And OCR processing should begin

    When OCR completes successfully
    Then I should see "Processing Complete" status
    And the document fields should be extracted:
      | rg_number | 12.345.678-9 |
      | name      | João Silva   |
      | birth_date| 1990-01-15   |

    When an admin approves the document
    Then I should see "Document Approved" notification
    And I should earn 150 approval points
    And my points balance should be 250
    And a badge check should be triggered for "Documentos Prontos"
    And an audit log entry should exist with action "document_approved"
    And an analytics event "document_approved" should be emitted

  Scenario: Fraud detection - rapid progression
    Given I complete registration in 90 seconds
    And I upload all 3 documents in 30 seconds
    And all documents are approved instantly
    Then a fraud flag should be raised with reason "rapid_progression"
    And the user account should be marked for manual review
    And an admin alert should be sent
    And an analytics event "fraud_detected" should be emitted

  Scenario: Document rejection - poor quality
    Given I upload a blurry RG image
    When OCR processing fails with "low_confidence"
    Then I should see "Document quality too low"
    And I should be prompted to re-upload
    And no points should be awarded
    And an analytics event "document_rejected" should be emitted

  Scenario: Badge unlock - "Documentos Prontos"
    Given I have uploaded and approved 3 documents (RG, CPF, Proof of Address)
    Then the "Documentos Prontos" badge should be awarded
    And I should see a badge unlock celebration modal
    And my badges collection should include "Documentos Prontos"
    And an analytics event "badge_unlocked" should be emitted

  Scenario: Document file size validation
    Given I am on the documents page
    When I attempt to upload a document larger than 10MB
    Then I should see "File size must be less than 10MB"
    And the upload should be rejected

  Scenario: Document file type validation
    Given I am on the documents page
    When I attempt to upload a .exe file
    Then I should see "Invalid file type. Please upload JPG, PNG, or PDF"
    And the upload should be rejected

  Scenario: Concurrent document uploads
    Given I am on the documents page
    When I upload RG, CPF, and Proof of Address simultaneously
    Then all three uploads should process independently
    And no upload should block others
    And I should see progress for all three documents

  Scenario: OCR retry on temporary failure
    Given I upload a valid RG document
    When OCR processing fails with a temporary error
    Then the system should retry OCR up to 3 times
    And I should see "Processing... (retry 2 of 3)"
    And if all retries fail, I should see "Processing failed. Please re-upload"

  Scenario: Document encryption at rest
    Given I have uploaded a document
    Then the document should be stored in S3 with AES-256 encryption
    And the encryption key should be managed by AWS KMS
    And access logs should record all document access

  Scenario: Document approval workflow
    Given I have uploaded a document pending review
    When an admin views the pending documents queue
    Then they should see my document with extracted data preview
    And they should be able to approve or reject with a reason
    And their action should be logged in the audit trail

  Scenario: Points reversal on document rejection
    Given I have been awarded 150 points for document approval
    When the document is later flagged as fraudulent and rejected
    Then the 150 points should be reversed
    And a negative points transaction should be created
    And my points balance should be reduced by 150
    And an audit log entry should exist with action "points_reversed"

  Scenario: Real-time notification on document approval
    Given I have uploaded a document pending review
    When an admin approves my document
    Then I should receive a real-time WebSocket notification
    And I should see a toast notification "Your RG was approved!"
    And the document status should update from "pending" to "approved"
    And the progress header should update to show new points balance
