import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * RegistrationForm - Pure presentation component
 *
 * ADR-003 Compliance:
 * ✅ NO network calls (fetch/axios)
 * ✅ NO storage (localStorage/sessionStorage/IndexedDB)
 * ✅ NO orchestration logic
 * ✅ ALL data via props
 * ✅ ALL interactions via callbacks
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: Component Boundaries
 */
import { useState, useCallback } from 'react';
/**
 * Client-side validation rules
 * Note: These are UX hints only. Real validation happens in API.
 */
const validateForm = (data) => {
    const errors = {};
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email) {
        errors.email = 'Email é obrigatório';
    }
    else if (!emailRegex.test(data.email)) {
        errors.email = 'Email inválido';
    }
    // Password strength validation
    if (!data.password) {
        errors.password = 'Senha é obrigatória';
    }
    else if (data.password.length < 8) {
        errors.password = 'Senha deve ter pelo menos 8 caracteres';
    }
    else if (!/[A-Z]/.test(data.password)) {
        errors.password = 'Senha deve conter pelo menos uma letra maiúscula';
    }
    else if (!/[a-z]/.test(data.password)) {
        errors.password = 'Senha deve conter pelo menos uma letra minúscula';
    }
    else if (!/[0-9]/.test(data.password)) {
        errors.password = 'Senha deve conter pelo menos um número';
    }
    else if (!/[^A-Za-z0-9]/.test(data.password)) {
        errors.password = 'Senha deve conter pelo menos um caractere especial';
    }
    // Password confirmation
    if (!data.confirmPassword) {
        errors.confirmPassword = 'Confirmação de senha é obrigatória';
    }
    else if (data.password !== data.confirmPassword) {
        errors.confirmPassword = 'As senhas não coincidem';
    }
    // Terms acceptance
    if (!data.termsAccepted) {
        errors.termsAccepted = 'Você deve aceitar os termos de uso';
    }
    return errors;
};
export const RegistrationForm = ({ onSubmit, isLoading = false, errors: serverErrors = {}, className = '', }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        termsAccepted: false,
    });
    const [clientErrors, setClientErrors] = useState({});
    const [touched, setTouched] = useState({
        email: false,
        password: false,
        confirmPassword: false,
        termsAccepted: false,
    });
    const handleChange = useCallback((field) => {
        return (e) => {
            const value = field === 'termsAccepted' ? e.target.checked : e.target.value;
            setFormData(prev => ({
                ...prev,
                [field]: value,
            }));
            // Clear client error for this field
            setClientErrors(prev => ({
                ...prev,
                [field]: undefined,
            }));
        };
    }, []);
    const handleBlur = useCallback((field) => {
        return () => {
            setTouched(prev => ({
                ...prev,
                [field]: true,
            }));
            // Validate on blur
            const errors = validateForm(formData);
            setClientErrors(errors);
        };
    }, [formData]);
    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        // Mark all fields as touched
        setTouched({
            email: true,
            password: true,
            confirmPassword: true,
            termsAccepted: true,
        });
        // Validate before submission
        const errors = validateForm(formData);
        setClientErrors(errors);
        // Only submit if no client-side errors
        if (Object.keys(errors).length === 0) {
            onSubmit(formData);
        }
    }, [formData, onSubmit]);
    // Merge client and server errors (server errors take precedence)
    const displayErrors = {
        ...clientErrors,
        ...serverErrors,
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: `registration-form ${className}`, noValidate: true, "aria-label": "Formul\u00E1rio de cadastro", children: [_jsxs("div", { className: "form-group", children: [_jsxs("label", { htmlFor: "email", className: "form-label", children: ["Email ", _jsx("span", { className: "required", "aria-label": "obrigat\u00F3rio", children: "*" })] }), _jsx("input", { id: "email", type: "email", value: formData.email, onChange: handleChange('email'), onBlur: handleBlur('email'), disabled: isLoading, className: `form-control ${touched.email && displayErrors.email ? 'is-invalid' : ''}`, "aria-required": "true", "aria-invalid": touched.email && !!displayErrors.email, "aria-describedby": displayErrors.email ? 'email-error' : undefined, placeholder: "seu@email.com", autoComplete: "email" }), touched.email && displayErrors.email && (_jsx("div", { id: "email-error", className: "error-message", role: "alert", children: displayErrors.email }))] }), _jsxs("div", { className: "form-group", children: [_jsxs("label", { htmlFor: "password", className: "form-label", children: ["Senha ", _jsx("span", { className: "required", "aria-label": "obrigat\u00F3rio", children: "*" })] }), _jsx("input", { id: "password", type: "password", value: formData.password, onChange: handleChange('password'), onBlur: handleBlur('password'), disabled: isLoading, className: `form-control ${touched.password && displayErrors.password ? 'is-invalid' : ''}`, "aria-required": "true", "aria-invalid": touched.password && !!displayErrors.password, "aria-describedby": displayErrors.password ? 'password-error password-requirements' : 'password-requirements', placeholder: "M\u00EDnimo 8 caracteres", autoComplete: "new-password" }), _jsx("div", { id: "password-requirements", className: "form-help", children: "M\u00EDnimo 8 caracteres com mai\u00FAscula, min\u00FAscula, n\u00FAmero e caractere especial" }), touched.password && displayErrors.password && (_jsx("div", { id: "password-error", className: "error-message", role: "alert", children: displayErrors.password }))] }), _jsxs("div", { className: "form-group", children: [_jsxs("label", { htmlFor: "confirmPassword", className: "form-label", children: ["Confirmar Senha ", _jsx("span", { className: "required", "aria-label": "obrigat\u00F3rio", children: "*" })] }), _jsx("input", { id: "confirmPassword", type: "password", value: formData.confirmPassword, onChange: handleChange('confirmPassword'), onBlur: handleBlur('confirmPassword'), disabled: isLoading, className: `form-control ${touched.confirmPassword && displayErrors.confirmPassword ? 'is-invalid' : ''}`, "aria-required": "true", "aria-invalid": touched.confirmPassword && !!displayErrors.confirmPassword, "aria-describedby": displayErrors.confirmPassword ? 'confirm-password-error' : undefined, placeholder: "Digite a senha novamente", autoComplete: "new-password" }), touched.confirmPassword && displayErrors.confirmPassword && (_jsx("div", { id: "confirm-password-error", className: "error-message", role: "alert", children: displayErrors.confirmPassword }))] }), _jsxs("div", { className: "form-group", children: [_jsxs("div", { className: "form-check", children: [_jsx("input", { id: "termsAccepted", type: "checkbox", checked: formData.termsAccepted, onChange: handleChange('termsAccepted'), onBlur: handleBlur('termsAccepted'), disabled: isLoading, className: `form-check-input ${touched.termsAccepted && displayErrors.termsAccepted ? 'is-invalid' : ''}`, "aria-required": "true", "aria-invalid": touched.termsAccepted && !!displayErrors.termsAccepted, "aria-describedby": displayErrors.termsAccepted ? 'terms-error' : undefined }), _jsxs("label", { htmlFor: "termsAccepted", className: "form-check-label", children: ["Aceito os ", _jsx("a", { href: "/terms", target: "_blank", rel: "noopener noreferrer", children: "termos de uso" }), " e", ' ', _jsx("a", { href: "/privacy", target: "_blank", rel: "noopener noreferrer", children: "pol\u00EDtica de privacidade" }), _jsx("span", { className: "required", "aria-label": "obrigat\u00F3rio", children: "*" })] })] }), touched.termsAccepted && displayErrors.termsAccepted && (_jsx("div", { id: "terms-error", className: "error-message", role: "alert", children: displayErrors.termsAccepted }))] }), _jsx("button", { type: "submit", disabled: isLoading, className: "btn btn-primary btn-block", "aria-busy": isLoading, children: isLoading ? 'Criando conta...' : 'Criar Conta' }), isLoading && (_jsx("div", { role: "status", className: "sr-only", children: "Criando sua conta, por favor aguarde..." }))] }));
};
export default RegistrationForm;
