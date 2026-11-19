<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Moderators: everyone in the users table, or only the emails listed in
     * SPOILER_SHIELD_MODERATORS when that is set. Nobody can register themselves.
     */
    public function canAccessPanel(Panel $panel): bool
    {
        $allowed = config('spoiler_shield.moderator_emails');

        return $allowed === [] || in_array(strtolower($this->email), array_map('strtolower', $allowed), true);
    }
}
