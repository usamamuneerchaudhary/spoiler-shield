<?php

use App\Enums\ReportStatus;
use App\Filament\Resources\Reports\Pages\ListReports;
use App\Filament\Resources\Reports\Pages\ViewReport;
use App\Filament\Resources\Rules\Pages\CreateRule;
use App\Filament\Resources\Rules\Pages\ListRules;
use App\Filament\Widgets\ModerationStats;
use App\Models\Report;
use App\Models\Rule;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Livewire\Livewire;

beforeEach(function () {
    $this->moderator = User::factory()->create(['email' => 'mod@example.com']);
    $this->actingAs($this->moderator);
});

it('sends guests to the login page', function () {
    auth()->logout();
    $this->get('/admin')->assertRedirect('/admin/login');
});

it('lets moderators in, and can be limited to listed emails', function () {
    $this->get('/admin')->assertOk()->assertSee('Spoiler Shield');
    Livewire::test(ModerationStats::class)->assertSee('Waiting for review');

    config(['spoiler_shield.moderator_emails' => ['someone-else@example.com']]);
    $this->get('/admin')->assertForbidden();
});

it('lists pending reports by default', function () {
    $pending = Report::factory()->count(2)->create();
    $rejected = Report::factory()->create(['status' => ReportStatus::Rejected]);

    Livewire::test(ListReports::class)
        ->assertCanSeeTableRecords($pending)
        ->assertCanNotSeeTableRecords([$rejected])
        ->filterTable('status', 'rejected')
        ->assertCanSeeTableRecords([$rejected]);
});

it('accepts a report into a new rule from the table', function () {
    $report = Report::factory()->create(['chapter' => 4]);

    Livewire::test(ListReports::class)
        ->callAction(TestAction::make('accept')->table($report), data: [
            'key' => 'ch04-heist',
            'chapter' => '4',
            'phrases' => ['bank heist ends'],
        ])
        ->assertHasNoFormErrors()
        ->assertNotified('Added to rule ch04-heist');

    expect($report->refresh()->status)->toBe(ReportStatus::Accepted)
        ->and(Rule::sole()->only(['key', 'chapter', 'phrases']))->toBe(['key' => 'ch04-heist', 'chapter' => 4, 'phrases' => ['bank heist ends']])
        ->and($report->reviewed_by)->toBe($this->moderator->id);
});

it('shows form errors for bad phrases', function () {
    $report = Report::factory()->create();

    Livewire::test(ListReports::class)
        ->callAction(TestAction::make('accept')->table($report), data: [
            'key' => 'ch01-x',
            'chapter' => '1',
            'phrases' => ['ab'],
        ])
        ->assertHasFormErrors(['phrases.0']);

    expect($report->refresh()->status)->toBe(ReportStatus::Pending);
});

it('only offers the actions that fit the report', function () {
    $missed = Report::factory()->create();
    $falseAlarm = Report::factory()->falseAlarm()->create();
    $done = Report::factory()->create(['status' => ReportStatus::Rejected]);

    Livewire::test(ListReports::class)
        ->assertActionVisible(TestAction::make('accept')->table($missed))
        ->assertActionHidden(TestAction::make('markFixed')->table($missed))
        ->assertActionVisible(TestAction::make('markFixed')->table($falseAlarm))
        ->assertActionHidden(TestAction::make('accept')->table($falseAlarm))
        ->filterTable('status', 'rejected')
        ->assertActionHidden(TestAction::make('reject')->table($done));
});

it('marks false alarms fixed and rejects reports', function () {
    $falseAlarm = Report::factory()->falseAlarm()->create();
    $other = Report::factory()->create();

    Livewire::test(ListReports::class)
        ->callAction(TestAction::make('markFixed')->table($falseAlarm), data: ['resolution' => 'Added a safe phrase'])
        ->callAction(TestAction::make('reject')->table($other), data: ['resolution' => 'Not a spoiler'])
        ->assertHasNoFormErrors();

    expect($falseAlarm->refresh()->status)->toBe(ReportStatus::Fixed)
        ->and($falseAlarm->resolution)->toBe('Added a safe phrase')
        ->and($other->refresh()->status)->toBe(ReportStatus::Rejected);
});

it('rejects several reports at once', function () {
    $reports = Report::factory()->count(3)->create();

    Livewire::test(ListReports::class)
        ->selectTableRecords($reports)
        ->callAction(TestAction::make('rejectSelected')->table()->bulk());

    expect(Report::where('status', 'rejected')->count())->toBe(3);
});

it('shows a report with its actions', function () {
    $report = Report::factory()->create(['text' => 'GTA 6 llama reveal', 'note' => 'Saw it on the home page']);

    Livewire::test(ViewReport::class, ['record' => $report->getRouteKey()])
        ->assertSee('GTA 6 llama reveal')
        ->assertSee('Saw it on the home page')
        ->assertActionVisible('accept');
});

it('creates rules, keeping "ending" as null and keys unique per pack', function () {
    Livewire::test(CreateRule::class)
        ->fillForm(['pack' => 'gta6', 'key' => 'ending-twist', 'chapter' => 'last', 'phrases' => ['the big twist']])
        ->call('create')
        ->assertHasNoFormErrors();

    expect(Rule::sole()->chapter)->toBeNull();

    Livewire::test(CreateRule::class)
        ->fillForm(['pack' => 'gta6', 'key' => 'ending-twist', 'chapter' => '2', 'phrases' => ['another one']])
        ->call('create')
        ->assertHasFormErrors(['key' => 'unique']);

    Livewire::test(CreateRule::class)
        ->fillForm(['pack' => 'stranger-things', 'key' => 'ending-twist', 'chapter' => '5', 'phrases' => ['upside down']])
        ->call('create')
        ->assertHasNoFormErrors();
});

it('downloads hashed files for GitHub', function () {
    Rule::factory()->create(['key' => 'ch02-boat', 'chapter' => 2, 'phrases' => ['boat chase']]);

    Livewire::test(ListRules::class)
        ->callAction('export', data: ['pack' => 'gta6'])
        ->assertFileDownloaded('gta6-spoilers.zip');

    expect(Rule::sole()->exported_at)->not->toBeNull();
});

it('warns when a pack has nothing to export', function () {
    Livewire::test(ListRules::class)
        ->callAction('export', data: ['pack' => 'stranger-things'])
        ->assertNotified('No rules for this pack yet');
});
