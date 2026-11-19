<?php

/*
 * The browser extension posts reports from its own extension:// origin, so the
 * report endpoint accepts any origin. No cookies or credentials are involved.
 */
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['POST', 'OPTIONS'],
    'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Accept'],
    'exposed_headers' => [],
    'max_age' => 86400,
    'supports_credentials' => false,
];
