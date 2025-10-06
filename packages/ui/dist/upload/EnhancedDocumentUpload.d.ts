/**
 * EnhancedDocumentUpload - Pure presentation component for document uploads
 *
 * Security:
 * - Client-side only validates MIME type and size
 * - No EXIF stripping or PII handling (server responsibility)
 * - No OCR processing (server-side via pre-signed URLs)
 * - Preview rendering only (no data extraction)
 *
 * @see ADR-004: Database & Privacy - Server handles all PHI
 */
interface DocumentUploadProps {
    documentType: {
        id: string;
        name: string;
        required: boolean;
        type: string;
        description?: string;
        examples?: string[];
        tips?: string;
    };
    onFileSelect: (file: File) => void;
    onUploadProgress?: (progress: number) => void;
    uploadStatus?: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
    uploadMessage?: string;
    maxSizeMB?: number;
    acceptedTypes?: string[];
}
export default function EnhancedDocumentUpload({ documentType, onFileSelect, onUploadProgress, uploadStatus, uploadMessage, maxSizeMB, acceptedTypes, }: DocumentUploadProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=EnhancedDocumentUpload.d.ts.map