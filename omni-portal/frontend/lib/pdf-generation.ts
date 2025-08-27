// PDF Generation Service - Health Assessment Summary & Certificate
// Implements beautiful, professional PDF generation with zero disruption to existing code

import { HealthAssessmentResults } from './unified-health-flow';
import { loadJsPDF } from './dynamic-imports';

// Dynamic jsPDF loading
let jsPDFInstance: any = null;

const initializeJsPDF = async () => {
  if (!jsPDFInstance) {
    const { jsPDF } = await loadJsPDF();
    jsPDFInstance = jsPDF;
  }
  return jsPDFInstance;
};

// Enhanced interfaces for PDF generation
export interface PDFGenerationOptions {
  includePersonalData: boolean;
  includeMedicalDetails: boolean;
  includeRiskAssessment: boolean;
  includeRecommendations: boolean;
  watermark?: string;
  templateStyle: 'professional' | 'modern' | 'clinical' | 'university';
}

export interface UserProfile {
  name: string;
  age: number;
  completionDate: Date;
  sessionDuration: number; // in minutes
  badges: Badge[];
  achievements: Achievement[];
  level: number;
  totalPoints: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate: Date;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  points: number;
  completedAt: Date;
}

export interface PDFTemplate {
  name: string;
  type: 'summary' | 'certificate';
  generatePages: (data: PDFGenerationData) => PDFPage[];
}

export interface PDFPage {
  render: (doc: any, pageNumber: number, totalPages: number) => void;
}

export interface PDFGenerationData {
  user: UserProfile;
  healthResults: HealthAssessmentResults;
  options: PDFGenerationOptions;
  metadata: {
    generatedAt: Date;
    version: string;
    sessionId: string;
  };
}

/**
 * Professional PDF Generation Service
 * Creates beautiful, personalized health assessment summaries and completion certificates
 */
export class PDFGenerationService {
  private static readonly BRAND_COLORS = {
    primary: '#2563eb', // blue-600
    secondary: '#10b981', // emerald-500  
    accent: '#f59e0b', // amber-500
    success: '#059669', // emerald-600
    warning: '#dc2626', // red-600
    muted: '#6b7280', // gray-500
    dark: '#1f2937', // gray-800
    light: '#f9fafb' // gray-50
  };

  private static readonly FONTS = {
    heading: 'Helvetica',
    body: 'Helvetica',
    accent: 'Times'
  };

  /**
   * Generate Health Assessment Summary PDF
   * Beautiful, comprehensive summary of health questionnaire results
   */
  public static async generateHealthSummary(
    user: UserProfile,
    healthResults: HealthAssessmentResults,
    options: PDFGenerationOptions = {
      includePersonalData: true,
      includeMedicalDetails: true,
      includeRiskAssessment: true,
      includeRecommendations: true,
      templateStyle: 'professional'
    }
  ): Promise<Uint8Array> {
    const jsPDF = await initializeJsPDF();
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const template = this.getTemplate('summary', options.templateStyle);
    const data: PDFGenerationData = {
      user,
      healthResults,
      options,
      metadata: {
        generatedAt: new Date(),
        version: '1.0.0',
        sessionId: crypto.randomUUID()
      }
    };

    const pages = template.generatePages(data);
    
    // Render each page
    pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      page.render(doc, index + 1, pages.length);
    });

    return doc.output('arraybuffer') as Uint8Array;
  }

  /**
   * Generate Completion Certificate PDF
   * University-style certificate for users to collect as achievement
   */
  public static async generateCompletionCertificate(
    user: UserProfile,
    healthResults: HealthAssessmentResults,
    options: PDFGenerationOptions = {
      includePersonalData: true,
      includeMedicalDetails: false,
      includeRiskAssessment: false,
      includeRecommendations: false,
      templateStyle: 'university'
    }
  ): Promise<Uint8Array> {
    const jsPDF = await initializeJsPDF();
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const template = this.getTemplate('certificate', options.templateStyle);
    const data: PDFGenerationData = {
      user,
      healthResults,
      options,
      metadata: {
        generatedAt: new Date(),
        version: '1.0.0',
        sessionId: crypto.randomUUID()
      }
    };

    const pages = template.generatePages(data);
    
    // Render certificate (usually single page)
    pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      page.render(doc, index + 1, pages.length);
    });

    return doc.output('arraybuffer') as Uint8Array;
  }

  private static getTemplate(type: 'summary' | 'certificate', style: string): PDFTemplate {
    switch (type) {
      case 'summary':
        return new ProfessionalSummaryTemplate();
      case 'certificate':
        return new UniversityCertificateTemplate();
      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }

  /**
   * Utility: Add branded header to any page
   */
  public static addBrandedHeader(doc: any, title: string, subtitle?: string): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header background
    doc.setFillColor(this.BRAND_COLORS.primary);
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    // Logo area (placeholder for future logo integration)
    doc.setFillColor(255, 255, 255);
    doc.circle(20, 12.5, 8, 'F');
    doc.setTextColor(this.BRAND_COLORS.primary);
    doc.setFontSize(12);
    doc.setFont(this.FONTS.heading, 'bold');
    doc.text('H+', 17, 15);
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(this.FONTS.heading, 'bold');
    doc.text(title, 35, 13);
    
    if (subtitle) {
      doc.setFontSize(10);
      doc.setFont(this.FONTS.body, 'normal');
      doc.text(subtitle, 35, 19);
    }
  }

  /**
   * Utility: Add branded footer with page numbers
   */
  public static addBrandedFooter(doc: any, pageNumber: number, totalPages: number): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Footer line
    doc.setDrawColor(this.BRAND_COLORS.muted);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
    
    // Generated date
    doc.setTextColor(this.BRAND_COLORS.muted);
    doc.setFontSize(8);
    doc.setFont(this.FONTS.body, 'normal');
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 20, pageHeight - 15);
    
    // Page numbers
    doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - 40, pageHeight - 15);
    
    // Confidentiality notice
    doc.text('Documento confidencial - Uso exclusivo do paciente', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  /**
   * Utility: Create risk level visualization
   */
  public static addRiskLevelIndicator(doc: any, x: number, y: number, riskLevel: string): void {
    const colors = {
      low: this.BRAND_COLORS.success,
      moderate: this.BRAND_COLORS.accent,
      high: this.BRAND_COLORS.warning,
      critical: '#dc2626'
    };

    const labels = {
      low: 'Baixo Risco',
      moderate: 'Risco Moderado', 
      high: 'Alto Risco',
      critical: 'Risco Crítico'
    };

    const color = colors[riskLevel as keyof typeof colors] || this.BRAND_COLORS.muted;
    const label = labels[riskLevel as keyof typeof labels] || 'Não Avaliado';

    // Risk indicator circle
    doc.setFillColor(color);
    doc.circle(x, y, 3, 'F');

    // Risk label
    doc.setTextColor(this.BRAND_COLORS.dark);
    doc.setFontSize(10);
    doc.setFont(this.FONTS.body, 'bold');
    doc.text(label, x + 8, y + 1);
  }

  /**
   * Utility: Format recommendations as bulleted list
   */
  public static addRecommendationsList(doc: any, x: number, y: number, recommendations: string[]): number {
    let currentY = y;
    
    doc.setTextColor(this.BRAND_COLORS.dark);
    doc.setFontSize(9);
    doc.setFont(this.FONTS.body, 'normal');

    recommendations.forEach((recommendation, index) => {
      // Bullet point
      doc.setFillColor(this.BRAND_COLORS.primary);
      doc.circle(x, currentY, 1, 'F');
      
      // Recommendation text (with word wrap)
      const lines = doc.splitTextToSize(recommendation, 150);
      doc.text(lines, x + 5, currentY);
      
      currentY += lines.length * 4 + 2;
    });

    return currentY;
  }
}

/**
 * Professional Health Summary Template
 * Clean, medical-grade report with comprehensive health insights
 */
class ProfessionalSummaryTemplate implements PDFTemplate {
  public name = 'Professional Health Summary';
  public type = 'summary' as const;

  public generatePages(data: PDFGenerationData): PDFPage[] {
    return [
      this.createCoverPage(data),
      this.createHealthOverviewPage(data),
      this.createDetailedResultsPage(data),
      this.createRecommendationsPage(data),
      this.createGamificationPage(data)
    ];
  }

  private createCoverPage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Header
        PDFGenerationService.addBrandedHeader(doc, 'Relatório de Avaliação de Saúde', 'Análise Personalizada e Confidencial');

        // Main title
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(24);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Relatório de Saúde', pageWidth / 2, 60, { align: 'center' });

        // Subtitle
        doc.setFontSize(14);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text('Avaliação Personalizada de Bem-estar', pageWidth / 2, 70, { align: 'center' });

        // User info card
        doc.setFillColor(PDFGenerationService['BRAND_COLORS'].light);
        doc.roundedRect(40, 90, pageWidth - 80, 40, 5, 5, 'F');
        
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(12);
        doc.setFont(PDFGenerationService['FONTS'].body, 'bold');
        doc.text('Informações do Paciente', 50, 100);
        
        doc.setFontSize(10);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text(`Nome: ${data.user.name}`, 50, 108);
        doc.text(`Idade: ${data.user.age} anos`, 50, 115);
        doc.text(`Data da Avaliação: ${data.user.completionDate.toLocaleDateString('pt-BR')}`, 50, 122);
        doc.text(`Duração da Sessão: ${data.user.sessionDuration} minutos`, pageWidth - 100, 108);
        doc.text(`Nível Gamificação: ${data.user.level}`, pageWidth - 100, 115);
        doc.text(`Total de Pontos: ${data.user.totalPoints}`, pageWidth - 100, 122);

        // Summary stats with defensive checks
        const riskLevel = data.healthResults?.riskLevel || 'low';
        const completedDomains = data.healthResults?.completedDomains?.length || 0;
        
        doc.setFillColor(PDFGenerationService['BRAND_COLORS'].primary);
        doc.roundedRect(40, 150, pageWidth - 80, 60, 5, 5, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Resumo da Avaliação', pageWidth / 2, 165, { align: 'center' });
        
        doc.setFontSize(11);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text(`Domínios Avaliados: ${completedDomains}`, 50, 180);
        doc.text(`Nível de Risco Geral: ${this.getRiskLevelLabel(riskLevel)}`, 50, 188);
        doc.text(`Recomendações: ${data.healthResults.recommendations.length}`, 50, 196);
        doc.text(`Próximos Passos: ${data.healthResults.nextSteps.length}`, pageWidth - 100, 180);
        doc.text(`Score de Confiabilidade: ${100 - data.healthResults.fraudDetectionScore}%`, pageWidth - 100, 188);
        doc.text(`Badges Conquistadas: ${data.user.badges.length}`, pageWidth - 100, 196);

        // Footer
        PDFGenerationService.addBrandedFooter(doc, pageNumber, totalPages);
      }
    };
  }

  private createHealthOverviewPage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        PDFGenerationService.addBrandedHeader(doc, 'Visão Geral da Saúde', 'Análise por Domínios');

        let currentY = 45;

        // Risk assessment overview
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Avaliação de Risco por Domínio', 20, currentY);
        currentY += 15;

        // Risk scores by domain
        Object.entries(data.healthResults.riskScores).forEach(([domain, score]) => {
          const domainLabel = this.getDomainLabel(domain);
          const riskLevel = this.calculateDomainRiskLevel(score);
          
          PDFGenerationService.addRiskLevelIndicator(doc, 25, currentY, riskLevel);
          
          doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
          doc.setFontSize(11);
          doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
          doc.text(`${domainLabel}: ${score} pontos`, 40, currentY + 1);
          
          currentY += 12;
        });

        currentY += 10;

        // Overall assessment
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Avaliação Geral', 20, currentY);
        currentY += 10;

        const overallRisk = data.healthResults.riskLevel;
        PDFGenerationService.addRiskLevelIndicator(doc, 25, currentY, overallRisk);
        
        doc.setFontSize(12);
        doc.setFont(PDFGenerationService['FONTS'].body, 'bold');
        doc.text(`Nível de Risco: ${this.getRiskLevelLabel(overallRisk)}`, 40, currentY + 1);
        currentY += 8;

        doc.setFontSize(10);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text(`Pontuação Total: ${data.healthResults.totalRiskScore} pontos`, 25, currentY);
        currentY += 6;
        doc.text(`Domínios Completados: ${data.healthResults?.completedDomains?.length || 0}`, 25, currentY);

        // Footer
        PDFGenerationService.addBrandedFooter(doc, pageNumber, totalPages);
      }
    };
  }

  private createDetailedResultsPage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        // Header
        PDFGenerationService.addBrandedHeader(doc, 'Resultados Detalhados', 'Análise Completa das Respostas');

        let currentY = 45;

        // Key findings section
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Principais Achados', 20, currentY);
        currentY += 15;

        // This would include detailed analysis of specific responses
        // For brevity, showing key highlights
        doc.setFontSize(10);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        
        const keyFindings = this.extractKeyFindings(data.healthResults);
        keyFindings.forEach(finding => {
          const lines = doc.splitTextToSize(`• ${finding}`, 160);
          doc.text(lines, 25, currentY);
          currentY += lines.length * 4 + 2;
        });

        // Footer
        PDFGenerationService.addBrandedFooter(doc, pageNumber, totalPages);
      }
    };
  }

  private createRecommendationsPage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        // Header
        PDFGenerationService.addBrandedHeader(doc, 'Recomendações Personalizadas', 'Orientações para Melhorar sua Saúde');

        let currentY = 45;

        // Recommendations section
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Recomendações de Saúde', 20, currentY);
        currentY += 15;

        currentY = PDFGenerationService.addRecommendationsList(doc, 25, currentY, data.healthResults.recommendations);
        currentY += 15;

        // Next steps section
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Próximos Passos', 20, currentY);
        currentY += 15;

        currentY = PDFGenerationService.addRecommendationsList(doc, 25, currentY, data.healthResults.nextSteps);

        // Footer
        PDFGenerationService.addBrandedFooter(doc, pageNumber, totalPages);
      }
    };
  }

  private createGamificationPage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        PDFGenerationService.addBrandedHeader(doc, 'Conquistas e Progresso', 'Gamificação e Engajamento');

        let currentY = 45;

        // Achievement summary
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(16);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('Suas Conquistas', 20, currentY);
        currentY += 15;

        // Badges earned
        doc.setFontSize(12);
        doc.setFont(PDFGenerationService['FONTS'].body, 'bold');
        doc.text(`Badges Conquistadas: ${data.user.badges.length}`, 25, currentY);
        currentY += 10;

        data.user.badges.forEach(badge => {
          doc.setFontSize(10);
          doc.setFont(PDFGenerationService['FONTS'].body, 'bold');
          doc.text(`${badge.icon} ${badge.name}`, 30, currentY);
          currentY += 5;
          
          doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
          const lines = doc.splitTextToSize(badge.description, 140);
          doc.text(lines, 35, currentY);
          currentY += lines.length * 4 + 3;
        });

        // Footer
        PDFGenerationService.addBrandedFooter(doc, pageNumber, totalPages);
      }
    };
  }

  private getRiskLevelLabel(riskLevel: string): string {
    const labels = {
      low: 'Baixo',
      moderate: 'Moderado',
      high: 'Alto', 
      critical: 'Crítico'
    };
    return labels[riskLevel as keyof typeof labels] || 'Não Avaliado';
  }

  private getDomainLabel(domain: string): string {
    const labels = {
      pain: 'Dor',
      mental_health: 'Saúde Mental',
      chronic_disease: 'Doenças Crônicas',
      lifestyle: 'Estilo de Vida',
      family_history: 'Histórico Familiar',
      risk_behaviors: 'Comportamentos de Risco'
    };
    return labels[domain as keyof typeof labels] || domain;
  }

  private calculateDomainRiskLevel(score: number): string {
    if (score >= 15) return 'high';
    if (score >= 8) return 'moderate';
    if (score >= 3) return 'low';
    return 'low';
  }

  private extractKeyFindings(results: HealthAssessmentResults): string[] {
    const findings: string[] = [];
    
    // Add logic to extract meaningful insights from health results
    if (results.riskScores.mental_health && results.riskScores.mental_health >= 8) {
      findings.push('Indicadores de saúde mental requerem atenção especializada');
    }
    
    if (results.riskScores.pain && results.riskScores.pain >= 6) {
      findings.push('Níveis de dor podem estar impactando qualidade de vida');
    }

    if (results.riskScores.lifestyle && results.riskScores.lifestyle >= 8) {
      findings.push('Mudanças no estilo de vida podem trazer benefícios significativos');
    }

    if (findings.length === 0) {
      findings.push('Avaliação geral indica boa saúde com oportunidades de melhoria');
    }

    return findings;
  }
}

/**
 * University-Style Completion Certificate Template  
 * Elegant, collectible certificate for users to commemorate their completion
 */
class UniversityCertificateTemplate implements PDFTemplate {
  public name = 'University Completion Certificate';
  public type = 'certificate' as const;

  public generatePages(data: PDFGenerationData): PDFPage[] {
    return [this.createCertificatePage(data)];
  }

  private createCertificatePage(data: PDFGenerationData): PDFPage {
    return {
      render: (doc: any, pageNumber: number, totalPages: number) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Certificate border
        doc.setDrawColor(PDFGenerationService['BRAND_COLORS'].primary);
        doc.setLineWidth(2);
        doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
        
        doc.setLineWidth(0.5);
        doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

        // Certificate header
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].primary);
        doc.setFontSize(20);
        doc.setFont(PDFGenerationService['FONTS'].accent, 'bold');
        doc.text('CERTIFICADO DE CONCLUSÃO', pageWidth / 2, 40, { align: 'center' });

        // Institution name
        doc.setFontSize(12);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text('Instituto de Saúde Digital', pageWidth / 2, 50, { align: 'center' });

        // Main certificate text
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].dark);
        doc.setFontSize(14);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text('Certifica que', pageWidth / 2, 80, { align: 'center' });

        // User name (highlighted)
        doc.setFontSize(24);
        doc.setFont(PDFGenerationService['FONTS'].accent, 'bold');
        doc.text(data.user.name.toUpperCase(), pageWidth / 2, 100, { align: 'center' });

        // Achievement description
        doc.setFontSize(14);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text('completou com sucesso a', pageWidth / 2, 120, { align: 'center' });

        doc.setFontSize(18);
        doc.setFont(PDFGenerationService['FONTS'].heading, 'bold');
        doc.text('AVALIAÇÃO COMPLETA DE SAÚDE DIGITAL', pageWidth / 2, 135, { align: 'center' });

        // Achievement stats
        doc.setFontSize(12);
        doc.setFont(PDFGenerationService['FONTS'].body, 'normal');
        doc.text(`Demonstrando dedicação ao bem-estar pessoal`, pageWidth / 2, 155, { align: 'center' });
        doc.text(`e comprometimento com a saúde integral`, pageWidth / 2, 165, { align: 'center' });

        // Date and signature area
        const completionDate = data.user.completionDate.toLocaleDateString('pt-BR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        doc.setFontSize(10);
        doc.text(`Emitido em ${completionDate}`, 50, pageHeight - 40);
        
        // Digital signature placeholder
        doc.text('_______________________', pageWidth - 100, pageHeight - 50);
        doc.text('Instituto de Saúde Digital', pageWidth - 100, pageHeight - 45);
        doc.text('Diretor Acadêmico', pageWidth - 100, pageHeight - 40);

        // Certificate ID
        doc.setFontSize(8);
        doc.setTextColor(PDFGenerationService['BRAND_COLORS'].muted);
        doc.text(`Certificado ID: ${data.metadata.sessionId}`, pageWidth / 2, pageHeight - 25, { align: 'center' });
        doc.text('Verifique a autenticidade em: saude.digital/verify', pageWidth / 2, pageHeight - 20, { align: 'center' });
      }
    };
  }
}

// Export utility functions for easy integration
export const PDFUtils = {
  /**
   * Download PDF as file
   */
  downloadPDF: (pdfData: Uint8Array, filename: string): void => {
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Open PDF in new tab
   */
  openPDFInNewTab: (pdfData: Uint8Array): void => {
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    URL.revokeObjectURL(url);
  },

  /**
   * Generate filename with timestamp
   */
  generateFilename: (type: 'summary' | 'certificate', userName: string): string => {
    const date = new Date().toISOString().split('T')[0];
    const cleanName = userName.replace(/[^a-zA-Z0-9]/g, '');
    return `${type === 'summary' ? 'relatorio' : 'certificado'}_saude_${cleanName}_${date}.pdf`;
  }
};