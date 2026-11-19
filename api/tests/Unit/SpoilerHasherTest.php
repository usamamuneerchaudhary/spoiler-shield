<?php

use App\Support\SpoilerHasher;

$vectors = json_decode(file_get_contents(__DIR__.'/../Fixtures/hash-vectors.json'), true);

it('normalises exactly like the extension', function (string $input, int $seed, string $normalized) {
    expect((new SpoilerHasher)->normalize($input))->toBe($normalized);
})->with(array_map(fn ($v) => [$v['input'], $v['seed'], $v['normalized']], array_filter($vectors, fn ($v) => $v['seed'] === 0)));

it('hashes exactly like the extension', function (string $input, int $seed, string $hash) {
    expect((new SpoilerHasher)->hashPhrase($input, $seed))->toBe($hash);
})->with(array_map(fn ($v) => [$v['input'], $v['seed'], $v['hash']], $vectors));
