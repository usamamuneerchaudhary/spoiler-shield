<?php

namespace Database\Factories;

use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Models\Report;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Report> */
class ReportFactory extends Factory
{
    public function definition(): array
    {
        $text = 'GTA 6 '.$this->faker->unique()->sentence(6);

        return [
            'kind' => ReportKind::MissedSpoiler,
            'status' => ReportStatus::Pending,
            'pack' => 'gta6',
            'chapter' => $this->faker->numberBetween(1, 6),
            'text' => $text,
            'page_url' => 'https://www.youtube.com/watch?v='.$this->faker->bothify('???###'),
            'site' => 'youtube',
            'fingerprint' => Report::fingerprintFor('missed_spoiler', 'gta6', $text),
        ];
    }

    public function falseAlarm(): static
    {
        return $this->state(fn () => ['kind' => ReportKind::FalseAlarm]);
    }
}
