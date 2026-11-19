<?php

namespace App\Models;

use App\Support\Catalog;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A spoiler rule approved by a moderator. Phrases are kept readable here so
 * moderators can review them; they are hashed when exported to the repo.
 */
class Rule extends Model
{
    use HasFactory;

    protected $fillable = ['pack', 'key', 'chapter', 'phrases', 'note', 'created_by', 'exported_at'];

    protected function casts(): array
    {
        return [
            'chapter' => 'integer',
            'phrases' => 'array',
            'exported_at' => 'datetime',
        ];
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** "Chapter 3", "Season 2", or "Ending" for rules hidden until the end. */
    public function chapterLabel(): string
    {
        return app(Catalog::class)->chapterLabel($this->pack, $this->chapter);
    }
}
