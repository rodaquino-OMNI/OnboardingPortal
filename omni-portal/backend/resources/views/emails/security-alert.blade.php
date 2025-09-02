<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Security Alert - {{ $appName }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
        }
        .content {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #dee2e6;
        }
        .alert-details {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
            border-left: 4px solid #dc3545;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-label {
            font-weight: 600;
            color: #495057;
        }
        .detail-value {
            color: #212529;
        }
        .severity-critical {
            color: #dc3545;
            font-weight: bold;
        }
        .severity-high {
            color: #fd7e14;
            font-weight: bold;
        }
        .footer {
            margin-top: 20px;
            padding: 15px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 14px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 Security Alert</h1>
        <p>{{ $alertData['type'] ?? 'Security Event Detected' }}</p>
    </div>
    
    <div class="content">
        <p>A critical security event has been detected in {{ $appName }}. Please review the details below and take appropriate action.</p>
        
        <div class="alert-details">
            <h3>Alert Details</h3>
            
            <div class="detail-row">
                <span class="detail-label">Event Type:</span>
                <span class="detail-value">{{ $alertData['type'] ?? 'Unknown' }}</span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Severity:</span>
                <span class="detail-value severity-{{ strtolower($alertData['severity'] ?? 'medium') }}">
                    {{ $alertData['severity'] ?? 'Medium' }}
                </span>
            </div>
            
            <div class="detail-row">
                <span class="detail-label">Timestamp:</span>
                <span class="detail-value">{{ $alertData['timestamp'] ?? $timestamp }}</span>
            </div>
            
            @if(isset($alertData['user_id']))
            <div class="detail-row">
                <span class="detail-label">User ID:</span>
                <span class="detail-value">{{ $alertData['user_id'] }}</span>
            </div>
            @endif
            
            @if(isset($alertData['ip_address']))
            <div class="detail-row">
                <span class="detail-label">IP Address:</span>
                <span class="detail-value">{{ $alertData['ip_address'] }}</span>
            </div>
            @endif
            
            @if(isset($alertData['reason']))
            <div class="detail-row">
                <span class="detail-label">Reason:</span>
                <span class="detail-value">{{ $alertData['reason'] }}</span>
            </div>
            @endif
            
            @if(isset($alertData['mismatch_count']))
            <div class="detail-row">
                <span class="detail-label">Mismatch Count:</span>
                <span class="detail-value">{{ $alertData['mismatch_count'] }}</span>
            </div>
            @endif
            
            @foreach($alertData as $key => $value)
                @if(!in_array($key, ['type', 'severity', 'timestamp', 'user_id', 'ip_address', 'reason', 'mismatch_count']) && is_scalar($value))
                <div class="detail-row">
                    <span class="detail-label">{{ ucwords(str_replace('_', ' ', $key)) }}:</span>
                    <span class="detail-value">{{ $value }}</span>
                </div>
                @endif
            @endforeach
        </div>
        
        <h3>Recommended Actions</h3>
        <ul>
            <li>Review the user's recent activity logs</li>
            <li>Check for additional suspicious activity from the same IP address</li>
            <li>Consider temporarily restricting the affected user account</li>
            <li>Review and update security policies if needed</li>
            <li>Monitor for similar patterns in other user accounts</li>
        </ul>
    </div>
    
    <div class="footer">
        <p><strong>Note:</strong> This is an automated security alert from {{ $appName }}. Please do not reply to this email. For questions or concerns, contact your system administrator.</p>
        <p>Generated at: {{ $timestamp }}</p>
    </div>
</body>
</html>