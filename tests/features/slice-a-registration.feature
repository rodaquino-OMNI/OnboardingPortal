Feature: Registration to First Points (Slice A)
  As a new user
  I want to register and verify my email
  So that I can earn my first 100 points and start onboarding

  Background:
    Given the feature flag "slice_a_registration" is enabled
    And the system is in a clean state

  Scenario: Successful registration and email verification
    Given I am an anonymous user
    When I navigate to the registration page
    And I fill in "email" with "newuser@example.com"
    And I fill in "password" with "SecurePass123!"
    And I click "Create Account"
    Then I should see "Check your email for verification"
    And an email should be sent to "newuser@example.com"
    And an audit log entry should exist with action "registration_started"

    When I retrieve the verification token from the email
    And I visit the verification URL with the token
    Then I should see "Email Verified!"
    And I should see "You earned 100 points"
    And my user record should show:
      | points_balance | 100 |
      | current_level  | 1   |
      | email_verified | true |
    And a points transaction should exist with:
      | action | registration |
      | points | 100          |
    And an audit log entry should exist with action "points_awarded"
    And an analytics event "registration_completed" should be emitted

  Scenario: Duplicate registration attempt
    Given a user already exists with email "existing@example.com"
    When I attempt to register with email "existing@example.com"
    Then I should see an error "Email already registered"
    And no new user should be created

  Scenario: Invalid email format
    When I attempt to register with email "notanemail"
    Then I should see validation error "Invalid email format"

  Scenario: Weak password
    When I attempt to register with password "weak"
    Then I should see validation error "Password must be at least 8 characters"

  Scenario: Idempotent points award
    Given I have a verified user account
    When the system attempts to award registration points twice
    Then only one points transaction should be created
    And my points balance should be 100, not 200

  Scenario: Progress header updates in real-time
    Given I have verified my email and earned 100 points
    When I navigate to the profile page
    Then the progress header should display:
      | Points | 100       |
      | Level  | Level 1   |
      | Progress | 20% to Level 2 |

  Scenario: Email verification token expiry
    Given I have registered but not verified my email
    When the verification token expires after 24 hours
    And I attempt to verify with the expired token
    Then I should see "Verification link expired"
    And I should be able to request a new verification email

  Scenario: Session security during registration
    Given I am on the registration page
    When I submit the registration form
    Then the response should include secure session cookies
    And the cookies should have HttpOnly and Secure flags
    And the cookies should have SameSite=Strict attribute

  Scenario: Rate limiting on registration endpoint
    Given I have attempted to register 5 times in 1 minute
    When I attempt to register again
    Then I should see "Too many registration attempts"
    And I should be rate-limited for 60 seconds
