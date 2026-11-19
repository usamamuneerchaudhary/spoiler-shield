<?php

namespace App\Console\Commands;

use App\Models\Rule;
use App\Support\Catalog;
use App\Support\PackExporter;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('spoilers:export
    {pack : Pack id, e.g. gta6}
    {--path= : The repo\'s data/packs/<pack>/spoilers folder to merge into (prints JSON when left out)}')]
#[Description('Export approved rules as hashed list files for the repo')]
class ExportSpoilers extends Command
{
    public function handle(Catalog $catalog, PackExporter $exporter): int
    {
        $pack = (string) $this->argument('pack');
        if (! $catalog->has($pack)) {
            $this->error("Unknown pack \"{$pack}\". Known packs: ".implode(', ', $catalog->ids()));

            return self::FAILURE;
        }

        $rules = Rule::query()->where('pack', $pack)->orderBy('key')->get();
        if ($rules->isEmpty()) {
            $this->info("No approved rules for {$pack} yet.");

            return self::SUCCESS;
        }

        $path = $this->option('path');
        if (! $path) {
            foreach ($exporter->files($pack, $rules) as $name => $content) {
                $this->line("// {$name}");
                $this->line(json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
            }

            return self::SUCCESS;
        }

        $changed = $exporter->writeTo($path, $pack, $rules);
        Rule::query()->whereKey($rules->modelKeys())->update(['exported_at' => now()]);

        $this->info($changed === []
            ? 'Already up to date.'
            : 'Updated '.implode(', ', $changed).'. Next: npm run build && npm test, then open a pull request.');

        return self::SUCCESS;
    }
}
