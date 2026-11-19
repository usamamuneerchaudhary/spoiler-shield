<?php

use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Models\Report;

it('stores a report', function () {
    $this->postJson('/api/v1/reports', reportPayload())
        ->assertCreated()
        ->assertJson(['status' => 'pending']);

    $report = Report::sole();
    expect($report->kind)->toBe(ReportKind::MissedSpoiler)
        ->and($report->status)->toBe(ReportStatus::Pending)
        ->and($report->pack)->toBe('gta6')
        ->and($report->chapter)->toBe(3)
        ->and($report->page_url)->toBe('https://www.youtube.com/watch?v=abc')
        ->and($report->occurrences)->toBe(1);
});

it('never stores the sender\'s IP address, only a keyed hash of it', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])->postJson('/api/v1/reports', reportPayload())->assertCreated();

    $row = (array) DB::table('reports')->first();
    expect(json_encode($row))->not->toContain('203.0.113.7')
        ->and($row['sender_hash'])->toHaveLength(64);
});

it('accepts a report with only the required fields', function () {
    $this->postJson('/api/v1/reports', ['kind' => 'false_alarm', 'pack' => 'stranger-things', 'text' => 'Stranger Things cast reunion'])
        ->assertCreated();
});

it('folds identical pending reports into one', function () {
    $first = $this->postJson('/api/v1/reports', reportPayload())->assertCreated()->json('id');
    $this->postJson('/api/v1/reports', reportPayload(['text' => '  gta 6 THE PURPLE LLAMA was the boss, all along! ']))
        ->assertOk()
        ->assertJson(['id' => $first, 'merged' => true]);

    expect(Report::count())->toBe(1)->and(Report::sole()->occurrences)->toBe(2);
});

it('opens a new report when the earlier one was already reviewed', function () {
    $this->postJson('/api/v1/reports', reportPayload())->assertCreated();
    Report::query()->update(['status' => ReportStatus::Rejected]);

    $this->postJson('/api/v1/reports', reportPayload())->assertCreated();
    expect(Report::count())->toBe(2);
});

it('rejects invalid reports', function (array $overrides, string $field) {
    $this->postJson('/api/v1/reports', reportPayload($overrides))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'unknown kind' => [['kind' => 'rant'], 'kind'],
    'unknown pack' => [['pack' => 'not-a-game'], 'pack'],
    'chapter past the end' => [['chapter' => 7], 'chapter'],
    'chapter zero' => [['chapter' => 0], 'chapter'],
    'missing text' => [['text' => '   '], 'text'],
    'text too long' => [['text' => str_repeat('a', 501)], 'text'],
    'javascript url' => [['page_url' => 'javascript:alert(1)'], 'page_url'],
    'unknown site' => [['site' => 'myspace'], 'site'],
    'note too long' => [['note' => str_repeat('n', 301)], 'note'],
    'bad version' => [['extension_version' => 'latest'], 'extension_version'],
]);

it('explains an unknown pack in plain words', function () {
    $this->postJson('/api/v1/reports', reportPayload(['pack' => 'nope']))
        ->assertJsonPath('errors.pack.0', 'Spoiler Shield doesn\'t have a list for that game or show yet.');
});

it('limits how many reports one connection can send', function () {
    config(['spoiler_shield.reports_per_minute' => 2]);

    $this->postJson('/api/v1/reports', reportPayload(['text' => 'GTA 6 one']))->assertCreated();
    $this->postJson('/api/v1/reports', reportPayload(['text' => 'GTA 6 two']))->assertCreated();
    $this->postJson('/api/v1/reports', reportPayload(['text' => 'GTA 6 three']))->assertTooManyRequests();
});

it('lets the extension call it from any origin', function () {
    $this->withHeaders([
        'Origin' => 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        'Access-Control-Request-Method' => 'POST',
        'Access-Control-Request-Headers' => 'content-type',
    ])->options('/api/v1/reports')
        ->assertNoContent()
        ->assertHeader('Access-Control-Allow-Origin', '*');

    $this->withHeaders(['Origin' => 'moz-extension://1234'])->postJson('/api/v1/reports', reportPayload())
        ->assertHeader('Access-Control-Allow-Origin', '*');
});

it('only accepts POST', function () {
    $this->getJson('/api/v1/reports')->assertMethodNotAllowed();
});

it('sends visitors of the home page to the moderation panel', function () {
    $this->get('/')->assertRedirect('/admin');
});
