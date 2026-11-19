<?php

use App\Enums\ReportStatus;
use App\Models\Report;

it('deletes reviewed reports after the retention period, and keeps pending ones', function () {
    $oldReviewed = Report::factory()->create(['status' => ReportStatus::Rejected]);
    $oldPending = Report::factory()->create();
    $recentReviewed = Report::factory()->create(['status' => ReportStatus::Accepted]);
    Report::query()->whereKey([$oldReviewed->id, $oldPending->id])->update(['updated_at' => now()->subDays(181)]);

    $this->artisan('model:prune', ['--model' => [Report::class]])->assertSuccessful();

    expect(Report::pluck('id')->all())->toEqualCanonicalizing([$oldPending->id, $recentReviewed->id]);
});
