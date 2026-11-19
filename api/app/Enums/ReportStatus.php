<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

enum ReportStatus: string implements HasColor, HasLabel
{
    case Pending = 'pending';
    /** A missed spoiler that became (part of) a rule. */
    case Accepted = 'accepted';
    /** A false alarm that was fixed in the lists. */
    case Fixed = 'fixed';
    case Rejected = 'rejected';

    public function getLabel(): string
    {
        return ucfirst($this->value);
    }

    public function getColor(): string
    {
        return match ($this) {
            self::Pending => 'warning',
            self::Accepted, self::Fixed => 'success',
            self::Rejected => 'gray',
        };
    }
}
