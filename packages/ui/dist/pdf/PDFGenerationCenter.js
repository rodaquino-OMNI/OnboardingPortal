'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, FileText, Award, CheckCircle, Loader2, ExternalLink, Share2, Trophy, Star, Calendar, Clock, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFGenerationService, PDFUtils } from '@/lib/pdf-generation';
export function PDFGenerationCenter({ user, healthResults, onComplete, showImmediately = false }) {
    const [summaryState, setSummaryState] = useState({
        isGenerating: false,
        currentTask: '',
        progress: 0,
        completedTasks: [],
        error: null
    });
    const [certificateState, setCertificateState] = useState({
        isGenerating: false,
        currentTask: '',
        progress: 0,
        completedTasks: [],
        error: null
    });
    const [showCenter, setShowCenter] = useState(showImmediately);
    const [celebrationMode, setCelebrationMode] = useState(false);
    // CRITICAL FIX: Ensure healthResults has required structure
    const safeHealthResults = React.useMemo(() => ({
        ...healthResults,
        completedDomains: healthResults?.completedDomains || [],
        riskLevel: healthResults?.riskLevel || 'low',
        totalRiskScore: healthResults?.totalRiskScore || 0,
        recommendations: healthResults?.recommendations || [],
        nextSteps: healthResults?.nextSteps || [],
        riskScores: healthResults?.riskScores || {},
        responses: healthResults?.responses || {}
    }), [healthResults]);
    // Show center automatically after completion
    useEffect(() => {
        if (!showImmediately && safeHealthResults.riskLevel) {
            const timer = setTimeout(() => {
                setShowCenter(true);
                setCelebrationMode(true);
                // Hide celebration after 3 seconds
                setTimeout(() => setCelebrationMode(false), 3000);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [safeHealthResults, showImmediately]);
    const simulateProgress = useCallback((setState, tasks) => {
        let currentTaskIndex = 0;
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15 + 5; // Random progress between 5-20%
            if (progress >= 100) {
                progress = 100;
                setState(prev => ({
                    ...prev,
                    progress: 100,
                    currentTask: 'Finalizando...',
                    completedTasks: tasks,
                    isGenerating: false
                }));
                clearInterval(interval);
                return;
            }
            const taskProgress = (progress / 100) * tasks.length;
            const newTaskIndex = Math.floor(taskProgress);
            if (newTaskIndex !== currentTaskIndex && newTaskIndex < tasks.length) {
                currentTaskIndex = newTaskIndex;
                setState(prev => ({
                    ...prev,
                    progress,
                    currentTask: tasks[currentTaskIndex],
                    completedTasks: tasks.slice(0, currentTaskIndex)
                }));
            }
            else {
                setState(prev => ({ ...prev, progress }));
            }
        }, 200);
        return interval;
    }, []);
    const generateSummaryPDF = useCallback(async () => {
        setSummaryState(prev => ({ ...prev, isGenerating: true, error: null, progress: 0 }));
        const tasks = [
            'Analisando dados de saúde...',
            'Calculando riscos personalizados...',
            'Gerando gráficos e visualizações...',
            'Formatando recomendações...',
            'Integrando conquistas gamificadas...',
            'Aplicando design profissional...',
            'Preparando documento final...'
        ];
        const progressInterval = simulateProgress(setSummaryState, tasks);
        try {
            const options = {
                includePersonalData: true,
                includeMedicalDetails: true,
                includeRiskAssessment: true,
                includeRecommendations: true,
                templateStyle: 'professional'
            };
            const pdfData = await PDFGenerationService.generateHealthSummary(user, healthResults, options);
            const filename = PDFUtils.generateFilename('summary', user.name);
            // Add small delay to show completion
            setTimeout(() => {
                PDFUtils.downloadPDF(pdfData, filename);
                clearInterval(progressInterval);
            }, 500);
        }
        catch (error) {
            clearInterval(progressInterval);
            setSummaryState(prev => ({
                ...prev,
                isGenerating: false,
                error: 'Erro ao gerar relatório. Tente novamente.'
            }));
            console.error('Error generating summary PDF:', error);
        }
    }, [user, healthResults, simulateProgress]);
    const generateCertificatePDF = useCallback(async () => {
        setCertificateState(prev => ({ ...prev, isGenerating: true, error: null, progress: 0 }));
        const tasks = [
            'Verificando conquistas...',
            'Calculando nível de completude...',
            'Aplicando template universitário...',
            'Adicionando elementos decorativos...',
            'Personalizando certificado...',
            'Gerando documento colecionável...'
        ];
        const progressInterval = simulateProgress(setCertificateState, tasks);
        try {
            const options = {
                includePersonalData: true,
                includeMedicalDetails: false,
                includeRiskAssessment: false,
                includeRecommendations: false,
                templateStyle: 'university'
            };
            const pdfData = await PDFGenerationService.generateCompletionCertificate(user, healthResults, options);
            const filename = PDFUtils.generateFilename('certificate', user.name);
            // Add small delay to show completion
            setTimeout(() => {
                PDFUtils.downloadPDF(pdfData, filename);
                clearInterval(progressInterval);
            }, 500);
        }
        catch (error) {
            clearInterval(progressInterval);
            setCertificateState(prev => ({
                ...prev,
                isGenerating: false,
                error: 'Erro ao gerar certificado. Tente novamente.'
            }));
            console.error('Error generating certificate PDF:', error);
        }
    }, [user, healthResults, simulateProgress]);
    const openSummaryInNewTab = useCallback(async () => {
        try {
            const options = {
                includePersonalData: true,
                includeMedicalDetails: true,
                includeRiskAssessment: true,
                includeRecommendations: true,
                templateStyle: 'professional'
            };
            const pdfData = await PDFGenerationService.generateHealthSummary(user, healthResults, options);
            PDFUtils.openPDFInNewTab(pdfData);
        }
        catch (error) {
            console.error('Error opening summary PDF:', error);
        }
    }, [user, healthResults]);
    const getRiskLevelBadge = (riskLevel) => {
        const configs = {
            low: { label: 'Baixo Risco', color: 'bg-green-100 text-green-800' },
            moderate: { label: 'Risco Moderado', color: 'bg-yellow-100 text-yellow-800' },
            high: { label: 'Alto Risco', color: 'bg-orange-100 text-orange-800' },
            critical: { label: 'Risco Crítico', color: 'bg-red-100 text-red-800' }
        };
        const config = configs[riskLevel] || configs.low;
        return _jsx(Badge, { className: config.color, children: config.label });
    };
    if (!showCenter) {
        return null;
    }
    return (_jsx(AnimatePresence, { children: _jsxs(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.3 }, className: "space-y-6", children: [celebrationMode && (_jsxs(motion.div, { initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, className: "text-center py-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200", children: [_jsx(motion.div, { animate: {
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0]
                            }, transition: {
                                duration: 0.6,
                                repeat: Infinity,
                                repeatDelay: 2
                            }, className: "inline-block mb-4", children: _jsx(Trophy, { className: "w-16 h-16 text-yellow-500 mx-auto" }) }), _jsxs("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: ["\uD83C\uDF89 Parab\u00E9ns, ", user.name, "!"] }), _jsx("p", { className: "text-gray-600 mb-4", children: "Voc\u00EA completou sua avalia\u00E7\u00E3o de sa\u00FAde com sucesso!" }), _jsxs("div", { className: "flex justify-center items-center gap-4 text-sm text-gray-500", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Calendar, { className: "w-4 h-4" }), user.completionDate.toLocaleDateString('pt-BR')] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Clock, { className: "w-4 h-4" }), user.sessionDuration, " minutos"] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Target, { className: "w-4 h-4" }), "N\u00EDvel ", user.level] })] })] })), _jsxs(Card, { className: "p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Resumo da Avalia\u00E7\u00E3o" }), getRiskLevelBadge(safeHealthResults.riskLevel)] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: safeHealthResults.completedDomains.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Dom\u00EDnios Avaliados" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-green-600", children: user.badges.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Badges Conquistadas" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-purple-600", children: user.totalPoints }), _jsx("div", { className: "text-sm text-gray-600", children: "Pontos Totais" })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-orange-600", children: safeHealthResults.recommendations.length }), _jsx("div", { className: "text-sm text-gray-600", children: "Recomenda\u00E7\u00F5es" })] })] })] }), _jsxs("div", { className: "grid md:grid-cols-2 gap-6", children: [_jsx(Card, { className: "p-6 hover:shadow-lg transition-shadow", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center", children: _jsx(FileText, { className: "w-6 h-6 text-blue-600" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-2", children: "Relat\u00F3rio Completo de Sa\u00FAde" }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Documento detalhado com an\u00E1lise completa dos resultados, recomenda\u00E7\u00F5es personalizadas e conquistas gamificadas. Ideal para compartilhar com profissionais de sa\u00FAde." }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "An\u00E1lise detalhada por dom\u00EDnios"] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "Recomenda\u00E7\u00F5es personalizadas"] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "Conquistas e gamifica\u00E7\u00E3o"] })] }), summaryState.isGenerating && (_jsxs("div", { className: "space-y-3 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-blue-600", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), summaryState.currentTask] }), _jsx(Progress, { value: summaryState.progress, className: "h-2" }), summaryState.completedTasks.length > 0 && (_jsx("div", { className: "space-y-1", children: summaryState.completedTasks.map((task, index) => (_jsxs("div", { className: "flex items-center gap-2 text-xs text-green-600", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), task] }, index))) }))] })), summaryState.error && (_jsx(Alert, { className: "mb-4", children: _jsx(AlertDescription, { className: "text-red-600", children: summaryState.error }) })), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { onClick: generateSummaryPDF, disabled: summaryState.isGenerating, className: "flex-1", children: [summaryState.isGenerating ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : (_jsx(Download, { className: "w-4 h-4 mr-2" })), summaryState.isGenerating ? 'Gerando...' : 'Baixar PDF'] }), _jsx(Button, { variant: "outline", onClick: openSummaryInNewTab, disabled: summaryState.isGenerating, children: _jsx(ExternalLink, { className: "w-4 h-4" }) })] })] })] }) }), _jsx(Card, { className: "p-6 hover:shadow-lg transition-shadow border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50", children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center", children: _jsx(Award, { className: "w-6 h-6 text-yellow-600" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900", children: "Certificado de Conclus\u00E3o" }), _jsxs(Badge, { className: "bg-yellow-100 text-yellow-800", children: [_jsx(Star, { className: "w-3 h-3 mr-1" }), "Colecion\u00E1vel"] })] }), _jsx("p", { className: "text-gray-600 text-sm mb-4", children: "Certificado elegante no estilo universit\u00E1rio para comemorar sua dedica\u00E7\u00E3o ao bem-estar. Perfeito para imprimir e colecionar!" }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "Design universit\u00E1rio elegante"] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "Personalizado com suas conquistas"] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-600", children: [_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" }), "Formato ideal para impress\u00E3o"] })] }), certificateState.isGenerating && (_jsxs("div", { className: "space-y-3 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-yellow-600", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), certificateState.currentTask] }), _jsx(Progress, { value: certificateState.progress, className: "h-2" }), certificateState.completedTasks.length > 0 && (_jsx("div", { className: "space-y-1", children: certificateState.completedTasks.map((task, index) => (_jsxs("div", { className: "flex items-center gap-2 text-xs text-green-600", children: [_jsx(CheckCircle, { className: "w-3 h-3" }), task] }, index))) }))] })), certificateState.error && (_jsx(Alert, { className: "mb-4", children: _jsx(AlertDescription, { className: "text-red-600", children: certificateState.error }) })), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { onClick: generateCertificatePDF, disabled: certificateState.isGenerating, className: "flex-1 bg-yellow-600 hover:bg-yellow-700", children: [certificateState.isGenerating ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : (_jsx(Award, { className: "w-4 h-4 mr-2" })), certificateState.isGenerating ? 'Gerando...' : 'Gerar Certificado'] }), _jsx(Button, { variant: "outline", className: "border-yellow-300 hover:bg-yellow-50", children: _jsx(Share2, { className: "w-4 h-4" }) })] })] })] }) })] }), user.badges.length > 0 && (_jsxs(Card, { className: "p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Suas Conquistas Recentes" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: user.badges.slice(0, 8).map((badge, index) => (_jsxs(motion.div, { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { delay: index * 0.1 }, className: "flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors", children: [_jsx("span", { className: "text-2xl", children: badge.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-sm text-gray-900 truncate", children: badge.name }), _jsx("div", { className: "text-xs text-gray-500 capitalize", children: badge.rarity })] })] }, badge.id))) })] })), _jsxs("div", { className: "flex justify-center gap-4 pt-4", children: [_jsx(Button, { variant: "outline", onClick: onComplete, children: "Voltar ao Dashboard" }), _jsx(Button, { onClick: () => window.print(), children: "Imprimir P\u00E1gina" })] })] }) }));
}
