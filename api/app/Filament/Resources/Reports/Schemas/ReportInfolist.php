<?php

namespace App\Filament\Resources\Reports\Schemas;

use App\Filament\Resources\Reports\Tables\ReportsTable;
use App\Models\Report;
use App\Support\Catalog;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class ReportInfolist
{
    public static function configure(Schema $schema): Schema
    {
        $catalog = app(Catalog::class);

        return $schema
            ->columns(1)
            ->components([
                Section::make('Report')
                    ->columns(3)
                    ->schema([
                        TextEntry::make('kind')->badge(),
                        TextEntry::make('status')->badge(),
                        TextEntry::make('occurrences')->label('Times reported')->numeric(),
                        TextEntry::make('pack')->formatStateUsing(fn (string $state) => $catalog->name($state)),
                        TextEntry::make('chapter')
                            ->label('Spoils')
                            ->formatStateUsing(fn (Report $record) => $catalog->chapterLabel($record->pack, $record->chapter))
                            ->placeholder('Not sure'),
                        TextEntry::make('created_at')->label('First received')->dateTime(),
                        TextEntry::make('text')->columnSpanFull(),
                        TextEntry::make('note')->label('Note from the reporter')->placeholder('-')->columnSpanFull(),
                        TextEntry::make('page_url')
                            ->label('Page')
                            ->url(fn (?string $state) => $state)
                            ->openUrlInNewTab()
                            ->placeholder('Not included')
                            ->columnSpanFull(),
                        TextEntry::make('site')
                            ->formatStateUsing(fn (?string $state) => ReportsTable::SITE_NAMES[$state] ?? $state)
                            ->placeholder('-'),
                        TextEntry::make('extension_version')->label('Extension')->placeholder('-'),
                        TextEntry::make('list_version')->label('Lists')->placeholder('-'),
                    ]),
                Section::make('Review')
                    ->columns(3)
                    ->visible(fn (Report $record) => $record->reviewed_at !== null)
                    ->schema([
                        TextEntry::make('rule.key')->label('Rule')->placeholder('-'),
                        TextEntry::make('reviewer.name')->label('Reviewed by')->placeholder('-'),
                        TextEntry::make('reviewed_at')->dateTime(),
                        TextEntry::make('resolution')->placeholder('-')->columnSpanFull(),
                    ]),
            ]);
    }
}
