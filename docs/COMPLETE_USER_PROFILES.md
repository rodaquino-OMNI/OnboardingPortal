# Complete User Profiles for Testing

All users now have complete profiles and can login without being redirected to registration.

## ✅ Ready-to-Use Test Accounts

### 1. 🔑 Admin Account
```json
{
  "email": "admin@omnihealth.com",
  "password": "Admin@123"
}
```
**Profile Details:**
- Name: Super Admin
- CPF: 11111111111
- Role: System Administrator
- Income: R$ 15,000
- Insurance: Bradesco Saúde
- Status: ✅ Onboarding Complete

### 2. 👩‍⚕️ Doctor Account
```json
{
  "email": "maria.silva@omnihealth.com",
  "password": "Doctor@123!"
}
```
**Profile Details:**
- Name: Dr. Maria Silva
- CPF: 22222222222
- Role: Medical Doctor
- Income: R$ 25,000
- Insurance: Amil
- CRM: 123456-SP
- Status: ✅ Onboarding Complete

### 3. 📋 Healthcare Coordinator
```json
{
  "email": "carlos.santos@omnihealth.com",
  "password": "Coord@123!"
}
```
**Profile Details:**
- Name: Carlos Santos
- CPF: 33333333333
- Role: Healthcare Coordinator
- Income: R$ 12,000
- Insurance: SulAmérica
- Team Size: 15 people
- Status: ✅ Onboarding Complete

### 4. 💼 Regular Employee
```json
{
  "email": "ana.costa@empresa.com",
  "password": "Employee@123!"
}
```
**Profile Details:**
- Name: Ana Costa
- CPF: 44444444444
- Role: Software Developer
- Income: R$ 8,000
- Insurance: Bradesco Saúde
- Department: IT
- Status: ✅ Onboarding Complete

## What Each User Can Access

### Admin (admin@omnihealth.com)
- Full system access
- Admin dashboard
- User management
- System settings
- All reports

### Doctor (maria.silva@omnihealth.com)
- Medical dashboard
- Patient records
- Health questionnaires
- Clinical features
- Medical reports

### Coordinator (carlos.santos@omnihealth.com)
- Team management
- Scheduling
- Reports
- Employee onboarding oversight

### Employee (ana.costa@empresa.com)
- Personal dashboard
- Health questionnaire
- Document upload
- Benefits access
- Personal profile

## Testing Instructions

1. **Clear browser cache** (Cmd+Shift+R or Ctrl+Shift+R)
2. **Navigate to:** http://localhost:3000/login
3. **Use any account above** - they will all bypass registration
4. **Each user will see** their personalized dashboard

## Technical Details

All users have:
- ✅ Complete beneficiary profiles
- ✅ Onboarding status: "completed"
- ✅ All required fields filled
- ✅ Emergency contacts
- ✅ Health insurance information
- ✅ Address details
- ✅ Personal information

No more "Registration incomplete" redirects!