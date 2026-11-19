<?php

use App\Models\Report;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Delete reviewed reports after the retention period (see PRIVACY.md).
Schedule::command('model:prune', ['--model' => [Report::class]])->daily();
