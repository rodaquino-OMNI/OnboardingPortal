<?php

namespace App\Services;

use App\Models\ClinicalReport;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Storage;

/**
 * Simple PDF Generator that works without external dependencies
 * This is a basic implementation that generates HTML-based PDFs
 * For production use, install barryvdh/laravel-dompdf
 */
class SimplePdfGenerator
{
    /**
     * Generate a simple PDF from HTML content
     * 
     * @param ClinicalReport $report
     * @param array $data
     * @return string File path
     */
    public function generate(ClinicalReport $report, array $data): string
    {
        // Render the Blade view to HTML
        $html = View::make('reports.clinical-report', $data)->render();
        
        // Add PDF-specific headers and wrapper
        $pdfHtml = $this->wrapHtmlForPdf($html, $report);
        
        // Generate file name and path
        $fileName = "clinical-report-{$report->id}-" . now()->format('YmdHis') . ".html";
        $filePath = "reports/pdf/{$fileName}";
        
        // Save as HTML file (can be printed to PDF by browser)
        Storage::put($filePath, $pdfHtml);
        
        return $filePath;
    }
    
    /**
     * Wrap HTML content with PDF-optimized structure
     */
    private function wrapHtmlForPdf(string $content, ClinicalReport $report): string
    {
        $title = "Relatório Clínico #{$report->id}";
        
        return <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title}</title>
    <style>
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            .no-print {
                display: none !important;
            }
            .page-break {
                page-break-after: always;
            }
        }
        
        /* PDF-specific styles */
        @page {
            size: A4;
            margin: 2cm;
        }
        
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
        }
        
        /* Ensure tables don't break across pages */
        table {
            page-break-inside: avoid;
        }
        
        /* Add print button for user convenience */
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #3b82f6;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
        }
        
        .print-button:hover {
            background-color: #2563eb;
        }
        
        @media screen {
            body {
                max-width: 210mm;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            
            .pdf-content {
                background-color: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                padding: 40px;
            }
        }
    </style>
    <script>
        function printPdf() {
            window.print();
        }
        
        // Auto-print option
        if (window.location.hash === '#autoprint') {
            window.onload = function() {
                window.print();
            };
        }
    </script>
</head>
<body>
    <button class="print-button no-print" onclick="printPdf()">
        Imprimir / Salvar como PDF
    </button>
    
    <div class="pdf-content">
        {$content}
    </div>
    
    <div class="no-print" style="margin-top: 40px; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
        <h3 style="margin-top: 0;">Instruções para salvar como PDF:</h3>
        <ol>
            <li>Clique no botão "Imprimir / Salvar como PDF" acima</li>
            <li>Na janela de impressão, selecione "Salvar como PDF" como destino</li>
            <li>Clique em "Salvar" e escolha onde salvar o arquivo</li>
        </ol>
        <p style="margin-bottom: 0;">
            <strong>Nota:</strong> Para melhor qualidade de PDF, instale o pacote barryvdh/laravel-dompdf
        </p>
    </div>
</body>
</html>
HTML;
    }
}