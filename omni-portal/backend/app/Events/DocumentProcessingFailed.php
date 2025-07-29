<?php

namespace App\Events;

use App\Models\Document;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentProcessingFailed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Document $document;
    public \Throwable $exception;

    /**
     * Create a new event instance.
     */
    public function __construct(Document $document, \Throwable $exception)
    {
        $this->document = $document;
        $this->exception = $exception;
    }
}