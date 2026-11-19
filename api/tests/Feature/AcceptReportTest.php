<?php

use App\Actions\AcceptReport;
use App\Enums\ReportStatus;
use App\Models\Report;
use App\Models\Rule;
use App\Models\User;
use Illuminate\Validation\ValidationException;

it('creates a rule from a report', function () {
    $moderator = User::factory()->create();
    $report = Report::factory()->create(['chapter' => 3]);

    $rule = app(AcceptReport::class)->handle($report, [
        'key' => 'ch03-llama',
        'chapter' => '3',
        'phrases' => ['purple llama', ' llama boss '],
        'note' => 'Boss identity',
    ], $moderator);

    expect($rule->pack)->toBe('gta6')
        ->and($rule->key)->toBe('ch03-llama')
        ->and($rule->chapter)->toBe(3)
        ->and($rule->phrases)->toBe(['purple llama', 'llama boss'])
        ->and($rule->created_by)->toBe($moderator->id);

    $report->refresh();
    expect($report->status)->toBe(ReportStatus::Accepted)
        ->and($report->rule_id)->toBe($rule->id)
        ->and($report->reviewed_by)->toBe($moderator->id)
        ->and($report->reviewed_at)->not->toBeNull();
});

it('stores "last" as the ending', function () {
    $rule = app(AcceptReport::class)->handle(Report::factory()->create(), [
        'key' => 'ending-twist', 'chapter' => 'last', 'phrases' => ['the big twist'],
    ]);

    expect($rule->chapter)->toBeNull()->and($rule->chapterLabel())->toBe('Ending');
});

it('adds phrases to an existing rule without duplicates', function () {
    $rule = Rule::factory()->create(['key' => 'ch02-boat', 'chapter' => 2, 'phrases' => ['boat chase']]);

    app(AcceptReport::class)->handle(Report::factory()->create(), ['rule_id' => $rule->id, 'phrases' => ['boat chase', 'speedboat crash']]);

    expect($rule->refresh()->phrases)->toBe(['boat chase', 'speedboat crash'])
        ->and(Rule::count())->toBe(1);
});

it('refuses bad input', function (array $data, string $field) {
    Rule::factory()->create(['key' => 'taken-key']);
    try {
        app(AcceptReport::class)->handle(Report::factory()->create(), $data);
        $this->fail('Expected a validation error');
    } catch (ValidationException $exception) {
        expect($exception->errors())->toHaveKey($field);
    }
})->with([
    'key with capitals' => [['key' => 'Bad Key', 'chapter' => '1', 'phrases' => ['good phrase']], 'key'],
    'key already used' => [['key' => 'taken-key', 'chapter' => '1', 'phrases' => ['good phrase']], 'key'],
    'missing key' => [['chapter' => '1', 'phrases' => ['good phrase']], 'key'],
    'chapter out of range' => [['key' => 'ok-key', 'chapter' => '9', 'phrases' => ['good phrase']], 'chapter'],
    'no phrases' => [['key' => 'ok-key', 'chapter' => '1', 'phrases' => []], 'phrases'],
    'phrase too short' => [['key' => 'ok-key', 'chapter' => '1', 'phrases' => ['ab']], 'phrases.0'],
    'phrase too many words' => [['key' => 'ok-key', 'chapter' => '1', 'phrases' => ['one two three four five six seven']], 'phrases.0'],
    'rule from another pack' => [['rule_id' => 999, 'phrases' => ['good phrase']], 'rule_id'],
]);

it('only turns missed spoilers into rules', function () {
    app(AcceptReport::class)->handle(Report::factory()->falseAlarm()->create(), ['key' => 'x-key', 'chapter' => '1', 'phrases' => ['abc def']]);
})->throws(LogicException::class);
