<?php

namespace App\Filament\Resources\Rules\Pages;

use App\Filament\Resources\Rules\RuleResource;
use App\Models\Rule;
use App\Support\Catalog;
use App\Support\PackExporter;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Forms\Components\Select;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Filament\Support\Icons\Heroicon;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class ListRules extends ListRecords
{
    protected static string $resource = RuleResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('export')
                ->label('Download for GitHub')
                ->icon(Heroicon::OutlinedArrowDownTray)
                ->color('gray')
                ->modalHeading('Download hashed list files')
                ->modalDescription('A zip of chapter-NN.json / ending.json files. Copy them into data/packs/<pack>/spoilers in the repo (or run php artisan spoilers:export <pack> --path=... to merge automatically), then open a pull request.')
                ->modalSubmitActionLabel('Download')
                ->schema([
                    Select::make('pack')
                        ->label('Game or show')
                        ->options(fn () => app(Catalog::class)->packOptions())
                        ->required(),
                ])
                ->action(function (array $data): ?StreamedResponse {
                    $pack = $data['pack'];
                    $rules = Rule::query()->where('pack', $pack)->get();
                    if ($rules->isEmpty()) {
                        Notification::make()->warning()->title('No rules for this pack yet')->send();

                        return null;
                    }

                    $files = app(PackExporter::class)->files($pack, $rules);
                    Rule::query()->whereKey($rules->modelKeys())->update(['exported_at' => now()]);

                    return response()->streamDownload(function () use ($files) {
                        $path = tempnam(sys_get_temp_dir(), 'spoilers');
                        $zip = new ZipArchive;
                        $zip->open($path, ZipArchive::OVERWRITE);
                        foreach ($files as $name => $content) {
                            $zip->addFromString($name, json_encode($content, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
                        }
                        $zip->close();
                        readfile($path);
                        unlink($path);
                    }, "{$pack}-spoilers.zip", ['Content-Type' => 'application/zip']);
                }),
            CreateAction::make(),
        ];
    }
}
