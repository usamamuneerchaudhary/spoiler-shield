<?php

namespace App\Filament\Resources\Reports;

use App\Actions\AcceptReport;
use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\Rule;
use App\Rules\SpoilerPhrase;
use App\Support\Catalog;
use Filament\Actions\Action;
use Filament\Actions\BulkAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/** Moderation actions, shared by the reports table and the report page. */
class ReportActions
{
    public static function accept(): Action
    {
        return Action::make('accept')
            ->label('Accept')
            ->icon(Heroicon::OutlinedCheck)
            ->color('success')
            ->visible(fn (Report $record) => $record->status === ReportStatus::Pending && $record->kind === ReportKind::MissedSpoiler)
            ->modalHeading('Turn this report into a rule')
            ->modalDescription('Phrases stay readable here for moderators. They are hashed when you export them to GitHub.')
            ->modalSubmitActionLabel('Accept')
            ->schema([
                Select::make('rule_id')
                    ->label('Add to an existing rule')
                    ->options(fn (Report $record) => Rule::query()->where('pack', $record->pack)->orderBy('key')->pluck('key', 'id'))
                    ->searchable()
                    ->live()
                    ->helperText('Leave empty to create a new rule.'),
                TextInput::make('key')
                    ->label('New rule key')
                    ->placeholder('ch03-001')
                    ->helperText('Readable in the repo, so keep it spoiler-free: chapter plus a number works well.')
                    ->regex(AcceptReport::KEY_PATTERN)
                    ->validationMessages(['regex' => 'Use lower-case letters, numbers and dashes, e.g. ch03-001.'])
                    ->required(fn (Get $get) => blank($get('rule_id')))
                    ->visible(fn (Get $get) => blank($get('rule_id'))),
                Select::make('chapter')
                    ->label('Spoils')
                    ->options(fn (Report $record) => app(Catalog::class)->chapterOptions($record->pack))
                    ->default(fn (Report $record) => $record->chapter ? (string) $record->chapter : 'last')
                    ->required(fn (Get $get) => blank($get('rule_id')))
                    ->visible(fn (Get $get) => blank($get('rule_id'))),
                TagsInput::make('phrases')
                    ->label('Phrases to hide')
                    ->placeholder('Type a phrase and press Enter')
                    ->helperText('Short, specific phrases people really write: names plus what happens, hashtags, common misspellings.')
                    ->required()
                    ->nestedRecursiveRules([new SpoilerPhrase]),
                TextInput::make('note')
                    ->label('Note for reviewers')
                    ->maxLength(300)
                    ->helperText('Keep it spoiler-free.'),
            ])
            ->action(function (Report $record, array $data, Action $action) {
                try {
                    $rule = app(AcceptReport::class)->handle($record, $data, auth()->user());
                } catch (ValidationException $exception) {
                    Notification::make()->danger()->title('Not accepted')->body(collect($exception->errors())->flatten()->first())->send();
                    $action->halt();

                    return;
                }
                Notification::make()->success()->title("Added to rule {$rule->key}")->send();
            });
    }

    public static function markFixed(): Action
    {
        return Action::make('markFixed')
            ->label('Mark fixed')
            ->icon(Heroicon::OutlinedWrench)
            ->color('success')
            ->visible(fn (Report $record) => $record->status === ReportStatus::Pending && $record->kind === ReportKind::FalseAlarm)
            ->modalHeading('Mark this false alarm as fixed')
            ->schema([
                Textarea::make('resolution')
                    ->label('What did you change?')
                    ->placeholder('e.g. Added "spoiler-free review" as a safe phrase')
                    ->required()
                    ->maxLength(300),
            ])
            ->action(function (Report $record, array $data) {
                $record->update([
                    'status' => ReportStatus::Fixed,
                    'resolution' => $data['resolution'],
                    'reviewed_by' => auth()->id(),
                    'reviewed_at' => now(),
                ]);
                Notification::make()->success()->title('Marked as fixed')->send();
            });
    }

    public static function reject(): Action
    {
        return Action::make('reject')
            ->label('Reject')
            ->icon(Heroicon::OutlinedXMark)
            ->color('gray')
            ->visible(fn (Report $record) => $record->status === ReportStatus::Pending)
            ->requiresConfirmation()
            ->modalHeading('Reject this report?')
            ->schema([
                TextInput::make('resolution')->label('Reason (optional)')->maxLength(300),
            ])
            ->action(function (Report $record, array $data) {
                $record->update([
                    'status' => ReportStatus::Rejected,
                    'resolution' => $data['resolution'] ?? null,
                    'reviewed_by' => auth()->id(),
                    'reviewed_at' => now(),
                ]);
                Notification::make()->success()->title('Report rejected')->send();
            });
    }

    public static function rejectBulk(): BulkAction
    {
        return BulkAction::make('rejectSelected')
            ->label('Reject selected')
            ->icon(Heroicon::OutlinedXMark)
            ->requiresConfirmation()
            ->action(function (Collection $records) {
                $records->filter(fn (Report $report) => $report->status === ReportStatus::Pending)
                    ->each(fn (Report $report) => $report->update([
                        'status' => ReportStatus::Rejected,
                        'reviewed_by' => auth()->id(),
                        'reviewed_at' => now(),
                    ]));
            })
            ->deselectRecordsAfterCompletion();
    }
}
