<?php

namespace App\Models;

use App\Enums\ReportKind;
use App\Enums\ReportStatus;
use App\Support\SpoilerHasher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    use HasFactory;
    use MassPrunable;

    protected $fillable = [
        'kind', 'status', 'pack', 'chapter', 'text', 'page_url', 'site', 'note',
        'extension_version', 'list_version', 'fingerprint', 'occurrences', 'sender_hash',
        'rule_id', 'reviewed_by', 'reviewed_at', 'resolution',
    ];

    protected $attributes = [
        'status' => 'pending',
        'occurrences' => 1,
    ];

    protected function casts(): array
    {
        return [
            'kind' => ReportKind::class,
            'status' => ReportStatus::class,
            'chapter' => 'integer',
            'occurrences' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    /** Fingerprint used to fold identical reports into one. */
    public static function fingerprintFor(string $kind, string $pack, string $text): string
    {
        return hash('sha256', $kind.'|'.$pack.'|'.app(SpoilerHasher::class)->normalize($text));
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(Rule::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function scopePending(Builder $query): void
    {
        $query->where('status', ReportStatus::Pending);
    }

    /** Reviewed reports are deleted after the retention period (see PRIVACY.md). */
    public function prunable(): Builder
    {
        return static::query()
            ->where('status', '!=', ReportStatus::Pending)
            ->where('updated_at', '<', now()->subDays((int) config('spoiler_shield.retention_days')));
    }
}
