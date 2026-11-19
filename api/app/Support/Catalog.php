<?php

namespace App\Support;

use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The games and shows ("packs") the extension knows about, read from the
 * same catalog.json the extension ships.
 */
class Catalog
{
    /** @var array<string, array<string, mixed>>|null */
    private ?array $packs = null;

    public function __construct(
        private readonly ?string $path,
        private readonly ?string $url,
        private readonly Cache $cache,
        private readonly int $cacheSeconds = 3600,
    ) {}

    /** @return array<string, array<string, mixed>> packs keyed by id */
    public function packs(): array
    {
        if ($this->packs !== null) {
            return $this->packs;
        }

        $catalog = $this->path && is_readable($this->path)
            ? json_decode((string) file_get_contents($this->path), true)
            : $this->cache->remember('spoiler_shield.catalog', $this->cacheSeconds, fn () => Http::timeout(10)->get($this->url)->throw()->json());

        if (! is_array($catalog) || ($catalog['catalogVersion'] ?? null) !== 1 || ! is_array($catalog['packs'] ?? null)) {
            throw new RuntimeException('The spoiler catalog could not be read.');
        }

        $packs = [];
        foreach ($catalog['packs'] as $pack) {
            $packs[$pack['game']['id']] = $pack;
        }

        return $this->packs = $packs;
    }

    /** @return list<string> */
    public function ids(): array
    {
        return array_keys($this->packs());
    }

    public function has(string $id): bool
    {
        return array_key_exists($id, $this->packs());
    }

    /** @return array<string, mixed> */
    public function pack(string $id): array
    {
        return $this->packs()[$id] ?? throw new RuntimeException("Unknown pack [{$id}].");
    }

    public function name(string $id): string
    {
        return $this->has($id) ? $this->pack($id)['game']['name'] : $id;
    }

    public function chapterCount(string $id): int
    {
        return count($this->pack($id)['chapters']);
    }

    public function seed(string $id): int
    {
        return (int) ($this->pack($id)['hashSeed'] ?? 0);
    }

    public function unit(string $id): string
    {
        return ucfirst($this->pack($id)['game']['unit'] ?? 'chapter');
    }

    /** @return array<string, string> pack id => name, for select fields */
    public function packOptions(): array
    {
        return array_map(fn (array $pack) => $pack['game']['name'], $this->packs());
    }

    /**
     * Options for a chapter select: "1" => "Chapter 1", ..., "last" => "Ending (hidden until the end)".
     *
     * @return array<string, string>
     */
    public function chapterOptions(string $id): array
    {
        if (! $this->has($id)) {
            return [];
        }
        $options = [];
        $count = $this->chapterCount($id);
        for ($chapter = 1; $chapter <= $count; $chapter++) {
            $options[(string) $chapter] = $this->unit($id).' '.$chapter;
        }
        $options['last'] = 'Ending (hidden until the end)';

        return $options;
    }

    public function chapterLabel(string $pack, ?int $chapter): string
    {
        if ($chapter === null) {
            return 'Ending';
        }

        return ($this->has($pack) ? $this->unit($pack) : 'Chapter').' '.$chapter;
    }
}
