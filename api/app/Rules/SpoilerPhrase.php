<?php

namespace App\Rules;

use App\Support\SpoilerHasher;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Same limits as the extension's matcher: 3-60 characters and up to 6 words, after normalising. */
class SpoilerPhrase implements ValidationRule
{
    public const MIN_LENGTH = 3;

    public const MAX_LENGTH = 60;

    public const MAX_WORDS = 6;

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail('Each phrase must be text.');

            return;
        }

        $normalized = app(SpoilerHasher::class)->normalize($value);
        if (mb_strlen($normalized) < self::MIN_LENGTH) {
            $fail("\"{$value}\" is too short (at least ".self::MIN_LENGTH.' letters or numbers).');
        } elseif (mb_strlen($normalized) > self::MAX_LENGTH) {
            $fail("\"{$value}\" is too long (".self::MAX_LENGTH.' characters at most).');
        } elseif (count(explode(' ', $normalized)) > self::MAX_WORDS) {
            $fail("\"{$value}\" has more than ".self::MAX_WORDS.' words.');
        }
    }
}
