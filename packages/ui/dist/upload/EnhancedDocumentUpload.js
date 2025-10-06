'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Camera, FileText, CheckCircle, XCircle, Loader2, Eye, AlertTriangle } from 'lucide-react';
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const DEFAULT_MAX_SIZE_MB = 10;
export default function EnhancedDocumentUpload({ documentType, onFileSelect, onUploadProgress, uploadStatus = 'idle', uploadMessage, maxSizeMB = DEFAULT_MAX_SIZE_MB, acceptedTypes = DEFAULT_ACCEPTED_TYPES, }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [validationError, setValidationError] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef(null);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
        // Cleanup preview URL on unmount
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);
    const validateFile = useCallback((selectedFile) => {
        // MIME type validation
        if (!acceptedTypes.includes(selectedFile.type)) {
            return `Tipo de arquivo não suportado. Aceitos: ${acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`;
        }
        // Size validation (convert MB to bytes)
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (selectedFile.size > maxSizeBytes) {
            return `O arquivo deve ter no máximo ${maxSizeMB}MB`;
        }
        return null;
    }, [acceptedTypes, maxSizeMB]);
    const handleFileSelect = useCallback(async (selectedFile) => {
        const error = validateFile(selectedFile);
        if (error) {
            setValidationError(error);
            setFile(null);
            setPreview(null);
            return;
        }
        setValidationError(null);
        setFile(selectedFile);
        // Generate preview for images (NOT for PHI extraction, just UI)
        if (selectedFile.type.startsWith('image/')) {
            const previewUrl = URL.createObjectURL(selectedFile);
            setPreview(previewUrl);
        }
        else {
            setPreview(null);
        }
        // Notify parent - parent will handle server upload
        onFileSelect(selectedFile);
    }, [validateFile, onFileSelect]);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);
    const handleCameraCapture = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);
    const handleClear = useCallback(() => {
        setFile(null);
        setPreview(null);
        setValidationError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    return (_jsxs("div", { className: "w-full space-y-4", children: [_jsxs("div", { className: "flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200", children: [_jsx(FileText, { className: "w-5 h-5 text-blue-600 mt-0.5" }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "font-medium text-blue-900", children: documentType.name }), documentType.description && (_jsx("p", { className: "text-sm text-blue-700 mt-1", children: documentType.description })), documentType.tips && (_jsxs("p", { className: "text-xs text-blue-600 mt-2 flex items-start gap-1", children: [_jsx(AlertTriangle, { className: "w-3 h-3 mt-0.5" }), documentType.tips] }))] })] }), _jsxs("div", { className: "relative", onDrop: handleDrop, onDragOver: handleDragOver, children: [_jsx("input", { ref: fileInputRef, type: "file", accept: acceptedTypes.join(','), onChange: (e) => e.target.files?.[0] && handleFileSelect(e.target.files[0]), className: "sr-only", id: `file-input-${documentType.id}`, capture: isMobile ? 'environment' : undefined }), !file ? (_jsxs("label", { htmlFor: `file-input-${documentType.id}`, className: "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors", children: [_jsx(Upload, { className: "w-12 h-12 text-gray-400 mb-4" }), _jsx("p", { className: "text-sm font-medium text-gray-700", children: "Arraste o arquivo ou clique para selecionar" }), _jsxs("p", { className: "text-xs text-gray-500 mt-2", children: [acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', '), " \u2022 M\u00E1x ", maxSizeMB, "MB"] }), isMobile && (_jsxs("button", { type: "button", onClick: handleCameraCapture, className: "mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors", children: [_jsx(Camera, { className: "w-4 h-4" }), "Tirar Foto"] }))] })) : (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg border border-gray-200", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(FileText, { className: "w-8 h-8 text-blue-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: file.name }), _jsxs("p", { className: "text-xs text-gray-500", children: [(file.size / 1024 / 1024).toFixed(2), " MB"] })] })] }), _jsx("button", { type: "button", onClick: handleClear, className: "p-2 text-gray-400 hover:text-red-600 transition-colors", "aria-label": "Remover arquivo", children: _jsx(XCircle, { className: "w-5 h-5" }) })] }), preview && (_jsxs("div", { className: "mt-3", children: [_jsxs("button", { type: "button", onClick: () => setShowPreview(!showPreview), className: "flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700", children: [_jsx(Eye, { className: "w-4 h-4" }), showPreview ? 'Ocultar Prévia' : 'Ver Prévia'] }), showPreview && (_jsx("img", { src: preview, alt: "Preview", className: "mt-2 max-w-full h-auto rounded border border-gray-200", style: { maxHeight: '300px' } }))] }))] }), uploadStatus !== 'idle' && (_jsx("div", { className: "p-4 rounded-lg border", style: {
                                    backgroundColor: uploadStatus === 'error' ? '#fef2f2' : uploadStatus === 'success' ? '#f0fdf4' : '#f9fafb',
                                    borderColor: uploadStatus === 'error' ? '#fecaca' : uploadStatus === 'success' ? '#bbf7d0' : '#e5e7eb'
                                }, children: _jsxs("div", { className: "flex items-center gap-3", children: [uploadStatus === 'uploading' && _jsx(Loader2, { className: "w-5 h-5 animate-spin text-blue-600" }), uploadStatus === 'processing' && _jsx(Loader2, { className: "w-5 h-5 animate-spin text-blue-600" }), uploadStatus === 'success' && _jsx(CheckCircle, { className: "w-5 h-5 text-green-600" }), uploadStatus === 'error' && _jsx(XCircle, { className: "w-5 h-5 text-red-600" }), _jsx("p", { className: "text-sm font-medium", children: uploadMessage || 'Processando...' })] }) }))] }))] }), validationError && (_jsx("div", { className: "p-4 bg-red-50 rounded-lg border border-red-200", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-red-600 mt-0.5" }), _jsx("p", { className: "text-sm text-red-800", children: validationError })] }) }))] }));
}
