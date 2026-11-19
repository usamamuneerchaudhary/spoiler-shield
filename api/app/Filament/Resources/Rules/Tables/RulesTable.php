<?php

namespace App\Filament\Resources\Rules\Tables;

use App\Models\Rule;
use App\Support\Catalog;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class RulesTable
{
    public static function configure(Table $table): Table
    {
        $catalog = app(Catalog::class);

        return $table
            ->defaultSort('updated_at', 'desc')
            ->modifyQueryUsing(fn (Builder $query) => $query->withCount('reports'))
            ->columns([
                TextColumn::make('pack')
                    ->formatStateUsing(fn (string $state) => $catalog->name($state))
                    ->sortable(),
                TextColumn::make('key')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('chapter')
                    ->label('Spoils')
                    ->formatStateUsing(fn (Rule $record) => $record->chapterLabel())
                    ->placeholder('Ending'),
                TextColumn::make('phrases')
                    ->badge()
                    ->limitList(3)
                    ->expandableLimitedList(),
                TextColumn::make('reports_count')
                    ->label('Reports')
                    ->numeric(),
                TextColumn::make('exported_at')
                    ->label('Exported')
                    ->since()
                    ->placeholder('Not yet'),
                TextColumn::make('updated_at')
                    ->since()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('pack')->options(fn () => $catalog->packOptions()),
                TernaryFilter::make('exported_at')
                    ->label('Exported')
                    ->nullable(),
            ])
            ->recordActions([
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
