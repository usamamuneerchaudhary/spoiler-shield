<?php

namespace App\Actions;

use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\Rule;
use App\Models\User;
use App\Rules\SpoilerPhrase;
use App\Support\Catalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule as ValidationRule;

/**
 * Turn a "missed spoiler" report into a rule: either a new rule, or more
 * phrases on an existing rule for the same pack.
 */
class AcceptReport
{
    public const KEY_PATTERN = '/^[a-z0-9][a-z0-9-]{1,63}$/';

    public function __construct(private readonly Catalog $catalog) {}

    /**
     * @param  array{rule_id?: int|string|null, key?: string|null, chapter?: string|int|null, phrases: list<string>, note?: string|null}  $data
     */
    public function handle(Report $report, array $data, ?User $moderator = null): Rule
    {
        if ($report->kind !== ReportKind::MissedSpoiler) {
            throw new \LogicException('Only missed-spoiler reports become rules.');
        }

        $pack = $report->pack;
        $existingId = $data['rule_id'] ?? null;

        $validated = Validator::make($data, [
            'rule_id' => ['nullable', ValidationRule::exists('rules', 'id')->where('pack', $pack)],
            'key' => [
                ValidationRule::requiredIf(! $existingId),
                'nullable',
                'regex:'.self::KEY_PATTERN,
                ValidationRule::unique('rules', 'key')->where('pack', $pack),
            ],
            'chapter' => [ValidationRule::requiredIf(! $existingId), 'nullable', ValidationRule::in(array_keys($this->catalog->chapterOptions($pack)))],
            'phrases' => ['required', 'array', 'min:1', 'max:50'],
            'phrases.*' => [new SpoilerPhrase],
            'note' => ['nullable', 'string', 'max:300'],
        ], [
            'key.regex' => 'Use lower-case letters, numbers and dashes, e.g. ch03-001.',
            'key.unique' => 'This pack already has a rule with that key. Pick it under "Add to an existing rule" instead.',
        ])->validate();

        return DB::transaction(function () use ($report, $validated, $existingId, $pack, $moderator) {
            $phrases = array_values(array_unique(array_map('trim', $validated['phrases'])));

            if ($existingId) {
                $rule = Rule::query()->whereKey($existingId)->lockForUpdate()->firstOrFail();
                $rule->phrases = array_values(array_unique([...$rule->phrases, ...$phrases]));
                if (! empty($validated['note'])) {
                    $rule->note = $validated['note'];
                }
                $rule->save();
            } else {
                $chapter = (string) $validated['chapter'];
                $rule = Rule::create([
                    'pack' => $pack,
                    'key' => $validated['key'],
                    'chapter' => $chapter === 'last' ? null : (int) $chapter,
                    'phrases' => $phrases,
                    'note' => $validated['note'] ?? null,
                    'created_by' => $moderator?->id,
                ]);
            }

            $report->update([
                'status' => ReportStatus::Accepted,
                'rule_id' => $rule->id,
                'reviewed_by' => $moderator?->id,
                'reviewed_at' => now(),
            ]);

            return $rule;
        });
    }
}
