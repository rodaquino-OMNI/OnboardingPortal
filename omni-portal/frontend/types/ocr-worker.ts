// OCR Worker Types and Interfaces
export interface OCRWorkerManager {
  createWorker(options?: WorkerOptions): Promise<TesseractWorker>;
  terminateAll(): Promise<void>;
}

export interface WorkerOptions {
  langs?: string | string[];
  logger?: (progress: LogProgress) => void;
  errorHandler?: (error: any) => void;
}

export interface LogProgress {
  jobId: string;
  status: string;
  progress: number;
  userJobId?: string;
}

export interface TesseractWorker {
  recognize(image: string | File | ImageLike, options?: RecognizeOptions): Promise<RecognizeResult>;
  detect(image: string | File | ImageLike): Promise<DetectResult>;
  terminate(): Promise<void>;
  setParameters(params: WorkerParameters): Promise<void>;
  initialize(lang?: string): Promise<void>;
  reinitialize(lang?: string): Promise<void>;
}

export interface RecognizeOptions {
  rectangle?: Rectangle;
  pdfTitle?: string;
  pdfTextOnly?: boolean;
  imageColor?: number;
  imageAlpha?: number;
  imageBinary?: number;
  outputFormats?: Array<'text' | 'hocr' | 'tsv' | 'box' | 'unlv' | 'osd'>;
}

export interface Rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageLike {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

export interface RecognizeResult {
  data: {
    text: string;
    confidence: number;
    blocks?: Block[];
    lines?: Line[];
    words?: Word[];
    symbols?: Symbol[];
    paragraphs?: Paragraph[];
    hocr?: string;
    tsv?: string;
    box?: string;
    unlv?: string;
    osd?: string;
  };
}

export interface DetectResult {
  data: {
    orientation: {
      degrees: number;
      confidence: number;
    };
    script: {
      name: string;
      confidence: number;
    };
  };
}

export interface Block {
  paragraphs: Paragraph[];
  text: string;
  confidence: number;
  baseline: Baseline;
  bbox: BBox;
  blocktype: string;
  polygon: Polygon;
}

export interface Paragraph {
  lines: Line[];
  text: string;
  confidence: number;
  baseline: Baseline;
  bbox: BBox;
  is_ltr: boolean;
  polygon: Polygon;
}

export interface Line {
  words: Word[];
  text: string;
  confidence: number;
  baseline: Baseline;
  bbox: BBox;
  polygon: Polygon;
}

export interface Word {
  symbols: Symbol[];
  choices: Choice[];
  text: string;
  confidence: number;
  baseline: Baseline;
  bbox: BBox;
  is_numeric: boolean;
  in_dictionary: boolean;
  direction: string;
  language: string;
  is_bold: boolean;
  is_italic: boolean;
  is_underlined: boolean;
  is_monospace: boolean;
  is_serif: boolean;
  is_smallcaps: boolean;
  font_size: number;
  font_id: number;
  font_name: string;
  polygon: Polygon;
}

export interface Symbol {
  choices: Choice[];
  image: any;
  text: string;
  confidence: number;
  baseline: Baseline;
  bbox: BBox;
  is_superscript: boolean;
  is_subscript: boolean;
  is_dropcap: boolean;
  polygon: Polygon;
}

export interface Choice {
  text: string;
  confidence: number;
}

export interface Baseline {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  has_baseline: boolean;
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Polygon {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
}

export interface WorkerParameters {
  tessedit_ocr_engine_mode?: number;
  tessedit_pageseg_mode?: number;
  tessedit_char_whitelist?: string;
  tessedit_char_blacklist?: string;
  classify_bln_numeric_mode?: boolean;
  textord_really_old_xheight?: boolean;
  textord_old_xheight?: boolean;
  wordrec_debug_level?: number;
  wordrec_max_join_chunks?: number;
  preserve_interword_spaces?: boolean;
  user_defined_dpi?: number;
  assume_fixed_pitch_char_segment?: boolean;
  [key: string]: string | number | boolean | undefined;
}