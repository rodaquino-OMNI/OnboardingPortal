<?php

namespace App\Events;

use App\Models\Document;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentProcessed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Document $document;
    public array $ocrResult;
    public ?array $gamificationData;

    /**
     * Create a new event instance.
     */
    public function __construct(Document $document, ?array $ocrResult = null, ?array $gamificationData = null)
    {
        $this->document = $document;
        $this->ocrResult = $ocrResult ?? $document->ocr_data ?? [];
        $this->gamificationData = $gamificationData;
    }
}