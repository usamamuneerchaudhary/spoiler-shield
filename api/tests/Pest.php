<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)->in('Unit');

/** A valid report payload, as the extension sends it. */
function reportPayload(array $overrides = []): array
{
    return array_merge([
        'kind' => 'missed_spoiler',
        'pack' => 'gta6',
        'chapter' => 3,
        'text' => 'GTA 6 the purple llama was the boss all along',
        'page_url' => 'https://www.youtube.com/watch?v=abc',
        'site' => 'youtube',
        'note' => null,
        'extension_version' => '0.2.0',
        'list_version' => 'abc123def456',
    ], $overrides);
}
