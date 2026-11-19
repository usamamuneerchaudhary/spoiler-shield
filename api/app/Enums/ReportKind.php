<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

enum ReportKind: string implements HasColor, HasLabel
{
    case MissedSpoiler = 'missed_spoiler';
    case FalseAlarm = 'false_alarm';

    public function getLabel(): string
    {
        return match ($this) {
            self::MissedSpoiler => 'Missed spoiler',
            self::FalseAlarm => 'Not a spoiler',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::MissedSpoiler => 'danger',
            self::FalseAlarm => 'info',
        };
    }
}
