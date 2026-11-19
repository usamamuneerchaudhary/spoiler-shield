<?php

use App\Models\Rule;
use App\Support\PackExporter;
use App\Support\SpoilerHasher;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

function packSeed(string $pack): int
{
    $catalog = json_decode(file_get_contents(base_path('../extension/data/catalog.json')), true);

    return collect($catalog['packs'])->firstWhere('game.id', $pack)['hashSeed'];
}

it('builds hashed files grouped by chapter', function () {
    Rule::factory()->create(['key' => 'ch03-001', 'chapter' => 3, 'phrases' => ['Purple Llama', 'purple llama'], 'note' => 'Boss']);
    Rule::factory()->create(['key' => 'ending-001', 'chapter' => null, 'phrases' => ['the big twist']]);
    Rule::factory()->create(['pack' => 'stranger-things', 'key' => 'other-pack', 'chapter' => 1]);

    $files = app(PackExporter::class)->files('gta6', Rule::all());
    $seed = packSeed('gta6');

    expect(array_keys($files))->toBe(['chapter-03.json', 'ending.json'])
        ->and($files['chapter-03.json']['rules'])->toBe([
            ['id' => 'ch03-001', 'chapter' => 3, 'note' => 'Boss', 'hashes' => [(new SpoilerHasher)->hashPhrase('purple llama', $seed)]],
        ])
        ->and($files['ending.json']['rules'][0]['chapter'])->toBe('last')
        ->and(json_encode($files))->not->toContain('purple')->not->toContain('twist');
});

it('merges into existing repo files without losing their rules', function () {
    $dir = sys_get_temp_dir().'/ss-export-'.uniqid();
    File::ensureDirectoryExists($dir);
    file_put_contents("{$dir}/chapter-03.json", json_encode(['rules' => [
        ['id' => 'ch03-existing', 'chapter' => 3, 'hashes' => ['2:00000000000001']],
        ['id' => 'ch03-llama', 'chapter' => 3, 'hashes' => ['2:00000000000002']],
    ]]));
    Rule::factory()->create(['key' => 'ch03-llama', 'chapter' => 3, 'phrases' => ['purple llama']]);

    $changed = app(PackExporter::class)->writeTo($dir, 'gta6', Rule::all());
    $rules = json_decode(file_get_contents("{$dir}/chapter-03.json"), true)['rules'];

    expect($changed)->toBe(['chapter-03.json'])
        ->and(array_column($rules, 'id'))->toBe(['ch03-existing', 'ch03-llama'])
        ->and($rules[1]['hashes'])->toHaveCount(2)
        ->and(file_get_contents("{$dir}/chapter-03.json"))->toStartWith("{\n  \"rules\": [\n    {")
        ->and(app(PackExporter::class)->writeTo($dir, 'gta6', Rule::all()))->toBe([]);
});

it('exports files the extension\'s own matcher accepts and matches', function () {
    $node = (new ExecutableFinder)->find('node');
    if (! $node) {
        $this->markTestSkipped('Node.js is not installed.');
    }

    Rule::factory()->create(['key' => 'ch03-llama', 'chapter' => 3, 'phrases' => ['Purple Llama Boss']]);
    $files = app(PackExporter::class)->files('gta6', Rule::all());

    $script = <<<'JS'
        const m = require(process.argv[1]);
        const catalog = require(process.argv[2]);
        const file = JSON.parse(process.argv[3]);
        const pack = catalog.packs.find((p) => p.game.id === 'gta6');
        const bundle = { ...pack, rules: [...pack.rules, ...file.rules] };
        const check = m.validateBundle(bundle);
        if (!check.ok) { console.log(JSON.stringify(check.errors)); process.exit(1); }
        const result = m.compile(bundle, { progress: 2 }).match('GTA 6: the purple llama boss returns!');
        console.log(JSON.stringify(result));
    JS;
    $process = new Process([$node, '-e', $script, base_path('../packages/matcher/src/matcher.js'), base_path('../extension/data/catalog.json'), json_encode($files['chapter-03.json'])]);
    $process->mustRun();

    expect(json_decode($process->getOutput(), true))->toMatchArray(['isSpoiler' => true, 'chapter' => 3, 'ruleIds' => ['ch03-llama']]);
});

it('writes files with the artisan command', function () {
    Rule::factory()->create(['key' => 'ch02-boat', 'chapter' => 2, 'phrases' => ['boat chase']]);
    $dir = sys_get_temp_dir().'/ss-cmd-'.uniqid();

    $this->artisan('spoilers:export', ['pack' => 'gta6', '--path' => $dir])
        ->expectsOutputToContain('Updated chapter-02.json')
        ->assertSuccessful();

    expect(file_exists("{$dir}/chapter-02.json"))->toBeTrue()
        ->and(Rule::sole()->exported_at)->not->toBeNull();
});

it('prints JSON when no path is given', function () {
    Rule::factory()->create(['key' => 'ch02-boat', 'chapter' => 2, 'phrases' => ['boat chase']]);

    $this->artisan('spoilers:export', ['pack' => 'gta6'])
        ->expectsOutputToContain('// chapter-02.json')
        ->assertSuccessful();
});

it('explains unknown packs and empty packs', function () {
    $this->artisan('spoilers:export', ['pack' => 'nope'])->expectsOutputToContain('Unknown pack')->assertFailed();
    $this->artisan('spoilers:export', ['pack' => 'gta6'])->expectsOutputToContain('No approved rules')->assertSuccessful();
});
