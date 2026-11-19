<?php

return [
    /*
     * The packs (games and shows) reports can be about. The API reads the same
     * catalog the extension ships: from a local file when the API runs inside
     * the repo, otherwise from GitHub (cached).
     */
    'catalog_path' => env('SPOILER_SHIELD_CATALOG_PATH', base_path('../extension/data/catalog.json')),
    'catalog_url' => env(
        'SPOILER_SHIELD_CATALOG_URL',
        'https://raw.githubusercontent.com/usamamuneerchaudhary/spoiler-shield/main/extension/data/catalog.json'
    ),
    'catalog_cache_seconds' => (int) env('SPOILER_SHIELD_CATALOG_CACHE_SECONDS', 3600),

    /* Reviewed reports are deleted after this many days (pending ones are kept). */
    'retention_days' => (int) env('SPOILER_SHIELD_RETENTION_DAYS', 180),

    /* Reports one connection may send. */
    'reports_per_minute' => (int) env('SPOILER_SHIELD_REPORTS_PER_MINUTE', 10),
    'reports_per_day' => (int) env('SPOILER_SHIELD_REPORTS_PER_DAY', 100),

    /* Sites the extension runs on. */
    'sites' => ['youtube', 'reddit', 'x', 'twitch', 'tiktok', 'google'],

    /*
     * Who can sign in to the moderation panel. Empty means every user in the
     * database (create them with: php artisan make:filament-user).
     */
    'moderator_emails' => array_filter(array_map('trim', explode(',', (string) env('SPOILER_SHIELD_MODERATORS', '')))),
];
