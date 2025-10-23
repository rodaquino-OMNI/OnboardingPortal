/**
 * Minimal Profile Form Component
 * Sprint 2C - Registration Pages
 *
 * Pure presentation component for minimal profile completion
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
 * Minimal profile form presentation component
 * Collects essential user information after email verification
 */
export function MinimalProfileForm({ onSubmit, isLoading = false, error = null, initialData = {} }) {
    const [formData, setFormData] = React.useState({
        fullName: initialData.fullName || '',
        dateOfBirth: initialData.dateOfBirth || '',
        address: initialData.address || '',
        city: initialData.city || '',
        state: initialData.state || '',
        zipCode: initialData.zipCode || '',
    });
    const [validationErrors, setValidationErrors] = React.useState({});
    const handleChange = (field) => (e) => {
        setFormData(prev => ({ ...prev, [field]: e.target.value }));
        // Clear validation error when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };
    const validate = () => {
        const errors = {};
        if (!formData.fullName || formData.fullName.trim().length < 3) {
            errors.fullName = 'Nome completo é obrigatório (mínimo 3 caracteres)';
        }
        if (!formData.dateOfBirth) {
            errors.dateOfBirth = 'Data de nascimento é obrigatória';
        }
        else {
            const birthDate = new Date(formData.dateOfBirth);
            const age = (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
            if (age < 18) {
                errors.dateOfBirth = 'Você deve ter pelo menos 18 anos';
            }
        }
        if (!formData.address || formData.address.trim().length < 5) {
            errors.address = 'Endereço é obrigatório';
        }
        if (!formData.city || formData.city.trim().length < 2) {
            errors.city = 'Cidade é obrigatória';
        }
        if (!formData.state || formData.state.length !== 2) {
            errors.state = 'Estado é obrigatório (sigla de 2 letras)';
        }
        if (!formData.zipCode || !/^\d{5}-?\d{3}$/.test(formData.zipCode)) {
            errors.zipCode = 'CEP inválido (formato: 00000-000)';
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
    const brazilianStates = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
        'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
        'SP', 'SE', 'TO'
    ];
    return (_jsxs(Card, { className: "w-full max-w-md mx-auto p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-2", children: "Complete seu Perfil" }), _jsx("p", { className: "text-gray-600", children: "Precisamos de algumas informa\u00E7\u00F5es adicionais" })] }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "fullName", children: "Nome Completo" }), _jsx(Input, { id: "fullName", type: "text", value: formData.fullName, onChange: handleChange('fullName'), disabled: isLoading, className: validationErrors.fullName ? 'border-red-500' : '' }), validationErrors.fullName && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.fullName }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "dateOfBirth", children: "Data de Nascimento" }), _jsx(Input, { id: "dateOfBirth", type: "date", value: formData.dateOfBirth, onChange: handleChange('dateOfBirth'), disabled: isLoading, className: validationErrors.dateOfBirth ? 'border-red-500' : '' }), validationErrors.dateOfBirth && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.dateOfBirth }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "address", children: "Endere\u00E7o" }), _jsx(Input, { id: "address", type: "text", placeholder: "Rua, n\u00FAmero, complemento", value: formData.address, onChange: handleChange('address'), disabled: isLoading, className: validationErrors.address ? 'border-red-500' : '' }), validationErrors.address && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.address }))] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx(Label, { htmlFor: "city", children: "Cidade" }), _jsx(Input, { id: "city", type: "text", value: formData.city, onChange: handleChange('city'), disabled: isLoading, className: validationErrors.city ? 'border-red-500' : '' }), validationErrors.city && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.city }))] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "state", children: "Estado" }), _jsxs("select", { id: "state", value: formData.state, onChange: handleChange('state'), disabled: isLoading, className: `w-full px-3 py-2 border rounded-md ${validationErrors.state ? 'border-red-500' : ''}`, children: [_jsx("option", { value: "", children: "Selecione" }), brazilianStates.map(state => (_jsx("option", { value: state, children: state }, state)))] }), validationErrors.state && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.state }))] })] }), _jsxs("div", { children: [_jsx(Label, { htmlFor: "zipCode", children: "CEP" }), _jsx(Input, { id: "zipCode", type: "text", placeholder: "00000-000", value: formData.zipCode, onChange: handleChange('zipCode'), disabled: isLoading, className: validationErrors.zipCode ? 'border-red-500' : '' }), validationErrors.zipCode && (_jsx("p", { className: "text-red-500 text-xs mt-1", children: validationErrors.zipCode }))] }), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, children: isLoading ? 'Salvando...' : 'Continuar' })] })] }));
}
