<?php

namespace App\Support;

use App\Models\Rule;
use Illuminate\Support\Collection;

/**
 * Turns approved rules into the repo's hashed list files
 * (data/packs/<pack>/spoilers/chapter-NN.json and ending.json).
 */
class PackExporter
{
    public function __construct(
        private readonly Catalog $catalog,
        private readonly SpoilerHasher $hasher,
    ) {}

    public static function fileFor(?int $chapter): string
    {
        return $chapter === null ? 'ending.json' : sprintf('chapter-%02d.json', $chapter);
    }

    /**
     * @param  iterable<Rule>  $rules
     * @return array<string, array{rules: list<array<string, mixed>>}> file name => contents
     */
    public function files(string $pack, iterable $rules): array
    {
        $seed = $this->catalog->seed($pack);

        return Collection::make($rules)
            ->filter(fn (Rule $rule) => $rule->pack === $pack)
            ->sortBy('key')
            ->groupBy(fn (Rule $rule) => self::fileFor($rule->chapter))
            ->map(fn (Collection $group) => ['rules' => $group->map(fn (Rule $rule) => $this->ruleData($rule, $seed))->values()->all()])
            ->sortKeys()
            ->all();
    }

    /**
     * Merge the rules into the files in a spoilers folder, keeping rules that
     * are already there. Returns the file names that changed.
     *
     * @param  iterable<Rule>  $rules
     * @return list<string>
     */
    public function writeTo(string $directory, string $pack, iterable $rules): array
    {
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $changed = [];
        foreach ($this->files($pack, $rules) as $name => $content) {
            $path = $directory.DIRECTORY_SEPARATOR.$name;
            $existing = is_file($path) ? json_decode((string) file_get_contents($path), true) : ['rules' => []];
            $merged = $this->merge($existing['rules'] ?? [], $content['rules']);
            $json = json_encode(['rules' => $merged], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n";
            // PHP indents with 4 spaces; the repo's JSON uses 2.
            $json = (string) preg_replace_callback('/^( +)/m', fn (array $match) => str_repeat(' ', intdiv(strlen($match[1]), 2)), $json);
            if (! is_file($path) || file_get_contents($path) !== $json) {
                file_put_contents($path, $json);
                $changed[] = $name;
            }
        }

        return $changed;
    }

    /** @return array<string, mixed> */
    private function ruleData(Rule $rule, int $seed): array
    {
        $hashes = Collection::make($rule->phrases)
            ->filter(fn ($phrase) => is_string($phrase) && $this->hasher->normalize($phrase) !== '')
            ->map(fn (string $phrase) => $this->hasher->hashPhrase($phrase, $seed))
            ->unique()
            ->values()
            ->all();

        return array_filter([
            'id' => $rule->key,
            'chapter' => $rule->chapter ?? 'last',
            'note' => $rule->note ?: null,
            'hashes' => $hashes,
        ], fn ($value) => $value !== null);
    }

    /**
     * @param  list<array<string, mixed>>  $existing
     * @param  list<array<string, mixed>>  $incoming
     * @return list<array<string, mixed>>
     */
    private function merge(array $existing, array $incoming): array
    {
        $byId = [];
        foreach ($existing as $rule) {
            $byId[$rule['id']] = $rule;
        }
        foreach ($incoming as $rule) {
            if (isset($byId[$rule['id']])) {
                $current = $byId[$rule['id']];
                $rule['hashes'] = array_values(array_unique([...($current['hashes'] ?? []), ...$rule['hashes']]));
                if (isset($current['terms'])) {
                    $rule['terms'] = $current['terms'];
                }
            }
            $byId[$rule['id']] = $rule;
        }

        return array_values($byId);
    }
}
