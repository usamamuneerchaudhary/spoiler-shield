<?php

namespace App\Filament\Resources\Reports\Tables;

use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Filament\Resources\Reports\ReportActions;
use App\Models\Report;
use App\Support\Catalog;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ReportsTable
{
    public const SITE_NAMES = [
        'youtube' => 'YouTube', 'reddit' => 'Reddit', 'x' => 'X',
        'twitch' => 'Twitch', 'tiktok' => 'TikTok', 'google' => 'Google',
    ];

    public static function configure(Table $table): Table
    {
        $catalog = app(Catalog::class);

        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('created_at')
                    ->label('Received')
                    ->since()
                    ->sortable(),
                TextColumn::make('kind')
                    ->badge(),
                TextColumn::make('pack')
                    ->formatStateUsing(fn (string $state) => $catalog->name($state)),
                TextColumn::make('chapter')
                    ->label('Spoils')
                    ->formatStateUsing(fn (Report $record) => $catalog->chapterLabel($record->pack, $record->chapter))
                    ->placeholder('Not sure'),
                TextColumn::make('text')
                    ->limit(80)
                    ->wrap()
                    ->searchable(),
                TextColumn::make('site')
                    ->formatStateUsing(fn (?string $state) => self::SITE_NAMES[$state] ?? $state)
                    ->placeholder('-'),
                TextColumn::make('occurrences')
                    ->label('Reports')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('status')
                    ->badge(),
                TextColumn::make('rule.key')
                    ->label('Rule')
                    ->placeholder('-')
                    ->toggleable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(ReportStatus::class)
                    ->default(ReportStatus::Pending->value),
                SelectFilter::make('kind')
                    ->options(ReportKind::class),
                SelectFilter::make('pack')
                    ->options(fn () => $catalog->packOptions()),
            ])
            ->recordActions([
                ViewAction::make(),
                ActionGroup::make([
                    ReportActions::accept(),
                    ReportActions::markFixed(),
                    ReportActions::reject(),
                ]),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    ReportActions::rejectBulk(),
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
