<?php

namespace App\Filament\Widgets;

use App\Enums\ReportKind;
use App\Models\Report;
use App\Models\Rule;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class ModerationStats extends StatsOverviewWidget
{
    protected function getStats(): array
    {
        $pending = Report::query()->pending();

        return [
            Stat::make('Waiting for review', (clone $pending)->count())
                ->description((clone $pending)->where('kind', ReportKind::MissedSpoiler)->count().' missed spoilers'),
            Stat::make('Reports this week', Report::query()->where('created_at', '>=', now()->subWeek())->sum('occurrences')),
            Stat::make('Rules not exported yet', Rule::query()->whereNull('exported_at')->count())
                ->description(Rule::query()->count().' rules in total'),
        ];
    }
}
