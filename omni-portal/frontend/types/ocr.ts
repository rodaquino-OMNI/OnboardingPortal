export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  lines: string[];
  extractedData?: ExtractedDocumentData;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ExtractedDocumentData {
  // Common fields
  name?: string;
  
  // RG/CNH fields
  rg?: string;
  cnh?: string;
  birthDate?: string;
  expirationDate?: string;
  
  // CPF fields
  cpf?: string;
  
  // Address fields
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  
  // Additional metadata
  [key: string]: string | undefined;
}

export interface OCRProgress {
  status: string;
  progress: number;
}

export interface DocumentValidation {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

export interface UploadResult {
  file: File;
  ocrData?: OCRResult;
  validation?: DocumentValidation;
  status: 'success' | 'error' | 'warning';
  message?: string;
}

export interface DocumentUploadStatus {
  uploaded: boolean;
  processing: boolean;
  validated: boolean;
  error?: string;
  ocrData?: OCRResult;
  validation?: DocumentValidation;
  file?: File;
  progress?: number;
}