<?php

namespace App\Filament\Resources\Rules\Schemas;

use App\Actions\AcceptReport;
use App\Rules\SpoilerPhrase;
use App\Support\Catalog;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Schema;
use Illuminate\Validation\Rules\Unique;

class RuleForm
{
    public static function configure(Schema $schema): Schema
    {
        $catalog = app(Catalog::class);

        return $schema
            ->components([
                Select::make('pack')
                    ->label('Game or show')
                    ->options(fn () => $catalog->packOptions())
                    ->required()
                    ->live()
                    ->afterStateUpdated(fn (Set $set) => $set('chapter', 'last')),
                TextInput::make('key')
                    ->placeholder('ch03-001')
                    ->helperText('Readable in the repo, so keep it spoiler-free: chapter plus a number works well.')
                    ->required()
                    ->regex(AcceptReport::KEY_PATTERN)
                    ->validationMessages(['regex' => 'Use lower-case letters, numbers and dashes, e.g. ch03-001.'])
                    ->unique(ignoreRecord: true, modifyRuleUsing: fn (Unique $rule, Get $get) => $rule->where('pack', $get('pack'))),
                Select::make('chapter')
                    ->label('Spoils')
                    ->options(fn (Get $get) => $get('pack') ? $catalog->chapterOptions($get('pack')) : [])
                    ->required()
                    ->default('last')
                    // "last" is stored as null: hidden until the reader finishes.
                    ->formatStateUsing(fn ($state) => $state === null ? 'last' : (string) $state)
                    ->dehydrateStateUsing(fn ($state) => $state === 'last' || $state === null ? null : (int) $state),
                TagsInput::make('phrases')
                    ->label('Phrases to hide')
                    ->placeholder('Type a phrase and press Enter')
                    ->required()
                    ->nestedRecursiveRules([new SpoilerPhrase])
                    ->columnSpanFull(),
                TextInput::make('note')
                    ->label('Note for reviewers')
                    ->maxLength(300)
                    ->helperText('Keep it spoiler-free.')
                    ->columnSpanFull(),
            ]);
    }
}
