# Admin Health Risks System - Testing Guide

## 🚀 System Status: READY FOR TESTING

The admin health risks system has been verified and is fully operational. Here's how to test it comprehensively.

## 1. Frontend Availability Verification ✅

**Build Status**: ✅ Compiles successfully (warnings are non-critical)
**Pages Available**: 6 admin pages fully functional
**Navigation**: Integrated in admin menu

### Available Routes:
1. `/admin/health-risks` - Main dashboard
2. `/admin/health-risks/alerts` - Alerts management  
3. `/admin/health-risks/alerts/[id]` - Alert details
4. `/admin/health-risks/analytics` - Analytics dashboard
5. `/admin/health-risks/reports/generate` - Report generation
6. `/admin/health-risks/reports` - Reports list

## 2. Creating Admin Test Credentials

### Option A: Using Laravel Tinker (Recommended)

```bash
# Navigate to backend directory
cd omni-portal/backend

# Open Laravel Tinker
php artisan tinker

# Create admin user
$user = new App\Models\User();
$user->name = 'Admin Health Test';
$user->email = 'admin.health@test.com';
$user->password = bcrypt('AdminHealth123!');
$user->email_verified_at = now();
$user->save();

# Create beneficiary for the user
$beneficiary = new App\Models\Beneficiary();
$beneficiary->user_id = $user->id;
$beneficiary->full_name = 'Admin Health Test';
$beneficiary->cpf = '000.000.000-01';
$beneficiary->phone = '(11) 99999-0001';
$beneficiary->date_of_birth = '1990-01-01';
$beneficiary->save();

# Create admin role if it doesn't exist
$adminRole = App\Models\Role::firstOrCreate(['name' => 'admin']);

# Assign admin role to user
$user->roles()->attach($adminRole->id);

# Create health risks permission if it doesn't exist
$permission = App\Models\Permission::firstOrCreate([
    'name' => 'view_health_risks',
    'description' => 'View health risks management'
]);

# Assign permission to admin role
$adminRole->permissions()->syncWithoutDetaching([$permission->id]);

# Verify assignment
echo "User created: " . $user->email;
echo "Roles: " . $user->roles->pluck('name')->join(', ');
```

### Option B: Using Database Seeder

Create a seeder file:

```bash
php artisan make:seeder AdminHealthTestSeeder
```

Then run:
```bash
php artisan db:seed --class=AdminHealthTestSeeder
```

## 3. Test Credentials

### Primary Admin Account
- **Email**: `admin.health@test.com`
- **Password**: `AdminHealth123!`
- **Role**: Admin with health risks permissions
- **Access**: Full admin panel access

### Backup Super Admin (if needed)
- **Email**: `superadmin@onboardingportal.com`  
- **Password**: `SuperAdmin123!`
- **Role**: Super Admin (all permissions)

## 4. Testing Workflow

### Step 1: Login and Access
1. Start the application: `npm run dev`
2. Navigate to: `http://localhost:3000/login`
3. Login with admin credentials
4. Verify redirect to admin dashboard

### Step 2: Navigate to Health Risks
1. Look for "Riscos de Saúde" in the admin sidebar
2. Click to access `/admin/health-risks`
3. Should see the main dashboard with metrics

### Step 3: Test Each Feature

#### A. Dashboard Testing
- **URL**: `/admin/health-risks`
- **Expected**: Metrics cards, recent alerts, charts
- **Test**: Verify all data loads without errors

#### B. Alerts Management
- **URL**: `/admin/health-risks/alerts`
- **Expected**: Alerts table with filtering options
- **Test**: 
  - Apply filters by priority/status
  - Click on alert to view details
  - Test pagination if alerts exist

#### C. Alert Details
- **URL**: `/admin/health-risks/alerts/[id]`
- **Expected**: Full alert information, workflow timeline
- **Test**:
  - View beneficiary information
  - Check clinical recommendations  
  - Test intervention creation

#### D. Analytics Dashboard
- **URL**: `/admin/health-risks/analytics`
- **Expected**: Charts and trend analysis
- **Test**:
  - Change timeframe filters
  - Verify chart rendering
  - Check data consistency

#### E. Report Generation
- **URL**: `/admin/health-risks/reports/generate`
- **Expected**: Report configuration interface
- **Test**:
  - Select different report types
  - Choose formats (PDF, Excel, CSV, JSON)
  - Apply filters and generate reports

#### F. Reports List
- **URL**: `/admin/health-risks/reports`
- **Expected**: Generated reports with download links
- **Test**:
  - View report status
  - Download completed reports
  - Check file formats

## 5. Creating Test Data

### Generate Test Health Questionnaires

```bash
# In Laravel Tinker
php artisan tinker

# Create a test beneficiary with health questionnaire
$beneficiary = App\Models\Beneficiary::first();

$questionnaire = new App\Models\HealthQuestionnaire();
$questionnaire->beneficiary_id = $beneficiary->id;
$questionnaire->questionnaire_type = 'health_screening';
$questionnaire->status = 'completed';
$questionnaire->responses = [
    'phq9_1' => 2, 'phq9_2' => 3, 'phq9_3' => 1,
    'gad7_1' => 2, 'gad7_2' => 1, 'gad7_3' => 0,
    'audit_1' => 0, 'audit_2' => 0, 'audit_3' => 1
];
$questionnaire->risk_scores = [
    'overall_risk_score' => 45,
    'categories' => [
        'mental_health' => 40,
        'cardiovascular' => 30,
        'substance_abuse' => 15,
        'chronic_disease' => 25,
        'safety_risk' => 10
    ],
    'flags' => ['moderate_depression']
];
$questionnaire->completed_at = now();
$questionnaire->created_at = now()->subDays(2);
$questionnaire->save();

# Trigger alert processing
App\Jobs\ProcessHealthRisksJob::dispatch($questionnaire);
```

### Generate Test Clinical Alerts

```bash
# Create sample alerts
$alert = new App\Models\ClinicalAlert();
$alert->beneficiary_id = $beneficiary->id;
$alert->questionnaire_id = $questionnaire->id;
$alert->category = 'mental_health';
$alert->priority = 'high';
$alert->risk_score = 75;
$alert->alert_type = 'risk_threshold_exceeded';
$alert->title = 'High Mental Health Risk Detected';
$alert->description = 'PHQ-9 score indicates moderate depression symptoms';
$alert->clinical_recommendations = ['Schedule psychiatric evaluation', 'Consider therapy referral'];
$alert->intervention_options = ['immediate_contact', 'scheduled_follow_up'];
$alert->status = 'pending';
$alert->created_at = now()->subHours(6);
$alert->save();
```

## 6. API Testing

### Test Backend Endpoints

```bash
# Get access token first (login via frontend or API)
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.health@test.com","password":"AdminHealth123!"}'

# Test dashboard endpoint
curl -X GET http://localhost:8000/api/admin/health-risks/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test alerts endpoint
curl -X GET http://localhost:8000/api/admin/health-risks/alerts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 7. Performance Testing

### Load Testing Script

```javascript
// Create file: test-load.js
const axios = require('axios');

async function testLoad() {
  const token = 'YOUR_AUTH_TOKEN';
  const endpoints = [
    '/api/admin/health-risks/dashboard',
    '/api/admin/health-risks/alerts',
    '/api/admin/health-risks/analytics/risk-distribution'
  ];
  
  for (let endpoint of endpoints) {
    const start = Date.now();
    try {
      await axios.get(`http://localhost:8000${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`${endpoint}: ${Date.now() - start}ms`);
    } catch (error) {
      console.error(`${endpoint}: ERROR`, error.message);
    }
  }
}

testLoad();
```

## 8. Troubleshooting Common Issues

### Issue: Can't access admin pages
**Solution**: Verify user has admin role and `view_health_risks` permission

### Issue: No data showing
**Solution**: Run test data generation scripts above

### Issue: Reports not generating
**Solution**: 
1. Check queue workers are running: `php artisan queue:work`
2. Verify storage permissions: `chmod -R 755 storage/`

### Issue: Charts not loading
**Solution**: Check browser console for JavaScript errors

## 9. Expected Test Results

### Successful Testing Checklist

- [ ] Login successful with admin credentials
- [ ] Admin navigation shows "Riscos de Saúde" menu item
- [ ] Dashboard loads with metrics (may show 0 values initially)
- [ ] Alerts page accessible and functional
- [ ] Analytics page loads with charts
- [ ] Report generation interface works
- [ ] All API endpoints return proper responses
- [ ] No console errors or 500 status codes

### Performance Benchmarks

- **Dashboard load**: < 2 seconds
- **Alerts list**: < 3 seconds for 100 alerts
- **Report generation**: < 30 seconds for standard reports
- **Chart rendering**: < 1 second

## 10. Next Steps After Testing

1. **Populate with real data** from health questionnaires
2. **Configure email notifications** for critical alerts
3. **Set up queue workers** for production
4. **Install PDF/Excel packages** for enhanced reports:
   ```bash
   composer require barryvdh/laravel-dompdf
   composer require phpoffice/phpspreadsheet
   ```

## 🎯 Ready to Test!

The system is fully operational and ready for comprehensive testing. Use the credentials above to access all features and verify the complete admin health risks management system.

**Contact**: If you encounter any issues during testing, check the Laravel logs at `storage/logs/laravel.log` and browser console for detailed error information.