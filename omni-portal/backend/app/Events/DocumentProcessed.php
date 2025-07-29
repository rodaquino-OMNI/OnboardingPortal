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

    /**
     * Create a new event instance.
     */
    public function __construct(Document $document, array $ocrResult)
    {
        $this->document = $document;
        $this->ocrResult = $ocrResult;
    }
}