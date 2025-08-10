<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório Clínico de Riscos de Saúde</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
        }
        
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 24px;
        }
        
        .header p {
            margin: 5px 0;
            color: #666;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h2 {
            color: #2563eb;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
        }
        
        .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }
        
        .info-row {
            display: table-row;
        }
        
        .info-label {
            display: table-cell;
            width: 200px;
            padding: 5px;
            font-weight: bold;
            color: #666;
        }
        
        .info-value {
            display: table-cell;
            padding: 5px;
        }
        
        .metrics-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .metric-card {
            flex: 1;
            min-width: 150px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            background-color: #f9fafb;
        }
        
        .metric-card h3 {
            margin: 0;
            color: #666;
            font-size: 12px;
            font-weight: normal;
        }
        
        .metric-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin: 5px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        
        tr:hover {
            background-color: #f9fafb;
        }
        
        .priority-emergency { color: #dc2626; font-weight: bold; }
        .priority-urgent { color: #ea580c; font-weight: bold; }
        .priority-high { color: #f59e0b; font-weight: bold; }
        .priority-medium { color: #3b82f6; }
        .priority-low { color: #6b7280; }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 10px;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        .chart-placeholder {
            width: 100%;
            height: 200px;
            background-color: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <h1>Relatório Clínico de Riscos de Saúde</h1>
        <p>{{ ucfirst(str_replace('_', ' ', $report->report_type)) }}</p>
        <p>Período: {{ $start_date->format('d/m/Y') }} - {{ $end_date->format('d/m/Y') }}</p>
    </div>
    
    <!-- Report Information -->
    <div class="section">
        <h2>Informações do Relatório</h2>
        <div class="info-grid">
            <div class="info-row">
                <div class="info-label">ID do Relatório:</div>
                <div class="info-value">{{ $report->id }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Gerado por:</div>
                <div class="info-value">{{ $generated_by->name ?? 'Sistema' }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Data de Geração:</div>
                <div class="info-value">{{ now()->format('d/m/Y H:i:s') }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Total de Alertas:</div>
                <div class="info-value">{{ $alerts->count() }}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Beneficiários Únicos:</div>
                <div class="info-value">{{ $beneficiaries_count }}</div>
            </div>
        </div>
    </div>
    
    <!-- Key Metrics -->
    <div class="section">
        <h2>Métricas Principais</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>Total de Alertas</h3>
                <div class="value">{{ $metrics['total_alerts'] }}</div>
            </div>
            <div class="metric-card">
                <h3>Taxa de Resolução</h3>
                <div class="value">{{ $metrics['resolution_rate'] }}%</div>
            </div>
            <div class="metric-card">
                <h3>Conformidade SLA</h3>
                <div class="value">{{ $metrics['sla_compliance'] }}%</div>
            </div>
            <div class="metric-card">
                <h3>Score Médio de Risco</h3>
                <div class="value">{{ $metrics['average_risk_score'] }}</div>
            </div>
            <div class="metric-card">
                <h3>Alertas Críticos</h3>
                <div class="value">{{ $metrics['critical_alerts'] }}</div>
            </div>
            <div class="metric-card">
                <h3>Tempo Médio de Resolução</h3>
                <div class="value">{{ $metrics['average_resolution_time'] }}h</div>
            </div>
        </div>
    </div>
    
    <!-- Distribution by Category -->
    <div class="section">
        <h2>Distribuição por Categoria</h2>
        <table>
            <thead>
                <tr>
                    <th>Categoria</th>
                    <th>Quantidade</th>
                    <th>Percentual</th>
                </tr>
            </thead>
            <tbody>
                @foreach($category_distribution as $category => $count)
                <tr>
                    <td>{{ ucfirst(str_replace('_', ' ', $category)) }}</td>
                    <td>{{ $count }}</td>
                    <td>{{ round(($count / $metrics['total_alerts']) * 100, 1) }}%</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    
    <!-- Distribution by Priority -->
    <div class="section">
        <h2>Distribuição por Prioridade</h2>
        <table>
            <thead>
                <tr>
                    <th>Prioridade</th>
                    <th>Quantidade</th>
                    <th>Percentual</th>
                </tr>
            </thead>
            <tbody>
                @foreach($priority_distribution as $priority => $count)
                <tr>
                    <td class="priority-{{ $priority }}">{{ ucfirst($priority) }}</td>
                    <td>{{ $count }}</td>
                    <td>{{ round(($count / $metrics['total_alerts']) * 100, 1) }}%</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    
    <!-- Page Break -->
    <div class="page-break"></div>
    
    <!-- Top Beneficiaries -->
    <div class="section">
        <h2>Top 10 Beneficiários com Mais Alertas</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Quantidade de Alertas</th>
                    <th>Score Médio de Risco</th>
                </tr>
            </thead>
            <tbody>
                @php $position = 1; @endphp
                @foreach($top_beneficiaries as $item)
                <tr>
                    <td>{{ $position++ }}</td>
                    <td>{{ $item['beneficiary']->full_name ?? 'N/A' }}</td>
                    <td>{{ $item['beneficiary']->cpf ?? 'N/A' }}</td>
                    <td>{{ $item['alert_count'] }}</td>
                    <td>{{ round($item['average_risk_score'], 1) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    
    @if($report->report_type === 'detailed' && $report->parameters['include_recommendations'] ?? false)
    <!-- Clinical Recommendations Summary -->
    <div class="section">
        <h2>Resumo de Recomendações Clínicas</h2>
        @php
            $recommendations = $alerts->pluck('clinical_recommendations')->flatten()->countBy();
        @endphp
        <table>
            <thead>
                <tr>
                    <th>Recomendação</th>
                    <th>Frequência</th>
                </tr>
            </thead>
            <tbody>
                @foreach($recommendations->sortDesc()->take(10) as $recommendation => $count)
                <tr>
                    <td>{{ $recommendation }}</td>
                    <td>{{ $count }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    @endif
    
    <!-- Footer -->
    <div class="footer">
        <p>Este relatório foi gerado automaticamente pelo Sistema de Gestão de Riscos de Saúde</p>
        <p>Confidencial - Contém informações protegidas por sigilo médico</p>
        <p>© {{ date('Y') }} - Todos os direitos reservados</p>
    </div>
</body>
</html>