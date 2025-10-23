/**
 * Registration Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component - NO orchestration logic
 * ADR-003 Compliance: Components only render, pages orchestrate
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card } from '../../ui/card';
/**
 * Registration form presentation component
 * Receives data via props, emits events via callbacks
 */
export function RegistrationForm({ onSubmit, isLoading = false, error = null, utmParams }) {
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        confirmPassword: '',
        cpf: '',
        phone: '',
        lgpdConsent: false,
    });
    const [validationErrors, setValidationErrors] = React.useState({});
    const handleChange = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear validation error when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };
    const validate = () => {
        const errors = {};
        // Email validation
        if (!formData.email) {
            errors.email = 'Email é obrigatório';
        }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Email inválido';
        }
        // Password validation
        if (!formData.password) {
            errors.password = 'Senha é obrigatória';
        }
        else if (formData.password.length < 8) {
            errors.password = 'Senha deve ter no mínimo 8 caracteres';
        }
        // Confirm password
        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'As senhas não coincidem';
        }
        // CPF validation (basic)
        if (!formData.cpf) {
            errors.cpf = 'CPF é obrigatório';
        }
        else if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(formData.cpf) && !/^\d{11}$/.test(formData.cpf)) {
            errors.cpf = 'CPF inválido';
        }
        // Phone validation
        if (!formData.phone) {
            errors.phone = 'Telefone é obrigatório';
        }
        // LGPD consent
        if (!formData.lgpdConsent) {
            errors.lgpdConsent = 'É necessário aceitar os termos';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
        }
    };
    return (_jsxs(Card, { className: "w-full max-w-md mx-auto p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-2", children: "Criar Conta" }), _jsx("p", { className: "text-gray-600", children: "Preencha seus dados para come\u00E7ar" }), utmParams?.source && (_jsxs("p", { className: "text-xs text-gray-500 mt-2", children: ["Fonte: ", utmParams.source] }))] }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "email", children: "Email" }), _jsx(Input, { id: "email", type: "email", value: formData.email, onChange: handleChange('email'), disabled: isLoading, className: validationErrors.email ? 'border-red-500' : '' }), validationErrors.email && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.email }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "cpf", children: "CPF" }), _jsx(Input, { id: "cpf", type: "text", placeholder: "000.000.000-00", value: formData.cpf, onChange: handleChange('cpf'), disabled: isLoading, className: validationErrors.cpf ? 'border-red-500' : '' }), validationErrors.cpf && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.cpf }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "phone", children: "Telefone" }), _jsx(Input, { id: "phone", type: "tel", placeholder: "(00) 00000-0000", value: formData.phone, onChange: handleChange('phone'), disabled: isLoading, className: validationErrors.phone ? 'border-red-500' : '' }), validationErrors.phone && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.phone }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "password", children: "Senha" }), _jsx(Input, { id: "password", type: "password", value: formData.password, onChange: handleChange('password'), disabled: isLoading, className: validationErrors.password ? 'border-red-500' : '' }), validationErrors.password && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.password }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "confirmPassword", children: "Confirmar Senha" }), _jsx(Input, { id: "confirmPassword", type: "password", value: formData.confirmPassword, onChange: handleChange('confirmPassword'), disabled: isLoading, className: validationErrors.confirmPassword ? 'border-red-500' : '' }), validationErrors.confirmPassword && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.confirmPassword }))] }), _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("input", { type: "checkbox", id: "lgpdConsent", checked: formData.lgpdConsent, onChange: handleChange('lgpdConsent'), disabled: isLoading, className: "mt-1" }), _jsx(Label, { htmlFor: "lgpdConsent", className: "text-sm", children: "Aceito os termos de uso e pol\u00EDtica de privacidade (LGPD)" })] }), validationErrors.lgpdConsent && (_jsx("p", { className: "text-red-500 text-xs", children: validationErrors.lgpdConsent })), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, children: isLoading ? 'Criando conta...' : 'Criar Conta' })] })] }));
}
