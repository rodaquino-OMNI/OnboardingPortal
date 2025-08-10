# 🚀 Quick Test Guide - Admin Health Risks System

## ✅ SYSTEM IS READY FOR TESTING!

The admin health risks system has been fully implemented and verified. Here's how to test it immediately.

## 1. Login Credentials

### Primary Admin Account
**Email**: `admin.health@test.com`  
**Password**: `AdminHealth123!`  
**Status**: ✅ Ready to use

## 2. How to Test

### Step 1: Start the Application
```bash
# Frontend (in frontend directory)
npm run dev

# Backend (in backend directory) 
php artisan serve

# Optional: Start queue worker for real-time processing
php artisan queue:work
```

### Step 2: Login
1. Navigate to: `http://localhost:3000/login`
2. Use the credentials above
3. You should be redirected to the admin dashboard

### Step 3: Access Health Risks System
1. Look for **"Riscos de Saúde"** in the admin sidebar (left menu)
2. Click it to access `/admin/health-risks`
3. You should see the main dashboard

## 3. Test Each Feature

### ✅ Dashboard (`/admin/health-risks`)
**Expected**: Metrics cards showing totals (may be 0 initially)
- Total Alerts
- Pending Alerts  
- Critical Alerts
- Resolved Today

### ✅ Alerts Management (`/admin/health-risks/alerts`)
**Expected**: Alerts table with filtering options
- Filter by priority (Emergency, Urgent, High, Medium, Low)
- Filter by status (Pending, Acknowledged, Resolved)
- Filter by category

### ✅ Analytics (`/admin/health-risks/analytics`)
**Expected**: Charts and trend analysis
- Risk distribution charts
- Trend analysis
- Top beneficiaries

### ✅ Report Generation (`/admin/health-risks/reports/generate`)
**Expected**: Report configuration interface
- Select report type (Summary, Detailed, etc.)
- Choose format (PDF, Excel, CSV, JSON)
- Set timeframe and filters

### ✅ Reports List (`/admin/health-risks/reports`)
**Expected**: Generated reports management
- View report status
- Download completed reports

## 4. Expected Initial State

Since this is a fresh system, you may see:
- **0 alerts** initially (normal)
- **Empty charts** (normal)
- **No reports** (normal)

This is expected behavior - the system is working correctly and waiting for health questionnaire data.

## 5. Creating Test Data (Optional)

If you want to see data in the system, you can:

### Option A: Submit a Health Questionnaire
1. Create a regular user account
2. Go through the onboarding process
3. Complete a health questionnaire
4. Wait 5 minutes (or run `php artisan queue:work`)
5. Check the admin panel for new alerts

### Option B: Use Laravel Tinker
```bash
php artisan tinker

# Create a test questionnaire with high risk scores
$user = \App\Models\User::first();
$beneficiary = $user->beneficiary ?? \App\Models\Beneficiary::create([
    'user_id' => $user->id,
    'full_name' => 'Test User',
    'cpf' => '000.000.000-00',
    'phone' => '(11) 99999-9999',
    'birth_date' => '1990-01-01',
    'address' => 'Test Address'
]);

$questionnaire = \App\Models\HealthQuestionnaire::create([
    'beneficiary_id' => $beneficiary->id,
    'questionnaire_type' => 'health_screening',
    'status' => 'completed',
    'responses' => ['phq9_1' => 3, 'phq9_2' => 3],
    'risk_scores' => [
        'overall_risk_score' => 75,
        'categories' => [
            'mental_health' => 80,
            'cardiovascular' => 60,
            'substance_abuse' => 20,
            'chronic_disease' => 40,
            'safety_risk' => 10
        ],
        'flags' => ['high_depression_risk']
    ],
    'completed_at' => now()
]);

# Manually trigger alert processing
\App\Jobs\ProcessHealthRisksJob::dispatch($questionnaire);
```

## 6. API Testing

You can also test the backend APIs directly:

```bash
# Login to get token
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.health@test.com","password":"AdminHealth123!"}'

# Test dashboard endpoint (replace YOUR_TOKEN)
curl -X GET http://localhost:8000/api/admin/health-risks/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 7. Troubleshooting

### Issue: Can't see "Riscos de Saúde" menu
**Solution**: The user needs admin role and `view_health_risks` permission (already configured)

### Issue: Pages show errors
**Solution**: Check browser console and Laravel logs at `backend/storage/logs/laravel.log`

### Issue: No data showing
**Solution**: This is normal for a fresh system. Create test data as shown above.

## 8. Success Indicators

✅ **Working correctly if you see:**
- Admin sidebar shows "Riscos de Saúde" menu item
- Dashboard loads without errors (even with 0 values)
- All 6 pages are accessible:
  - `/admin/health-risks` (Dashboard)
  - `/admin/health-risks/alerts` (Alerts)  
  - `/admin/health-risks/analytics` (Analytics)
  - `/admin/health-risks/reports/generate` (Generate)
  - `/admin/health-risks/reports` (Reports List)
- No console errors or 500 status codes

## 9. Next Steps

Once you confirm the system is working:

1. **Create real test data** using health questionnaires
2. **Install PDF/Excel packages** for enhanced reports:
   ```bash
   composer require barryvdh/laravel-dompdf
   composer require phpoffice/phpspreadsheet
   ```
3. **Configure email notifications** for critical alerts
4. **Set up queue workers** for production deployment

## 🎯 READY TO TEST!

The system is fully operational. Use the credentials above and follow the steps to verify all functionality is working correctly.

**Need help?** Check `backend/storage/logs/laravel.log` for any backend errors, or browser console for frontend issues.