<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReportRequest;
use App\Models\Report;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    /**
     * Receive a report from the extension. Identical pending reports are folded
     * into one, so moderators see how many people hit the same problem.
     */
    public function store(StoreReportRequest $request): JsonResponse
    {
        $data = $request->validated();
        $fingerprint = Report::fingerprintFor($data['kind'], $data['pack'], $data['text']);

        $existing = Report::query()->pending()->where('fingerprint', $fingerprint)->first();
        if ($existing) {
            $existing->increment('occurrences');

            return response()->json(['id' => $existing->id, 'status' => 'pending', 'merged' => true]);
        }

        $report = Report::create([
            ...$data,
            'fingerprint' => $fingerprint,
            'sender_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
        ]);

        return response()->json(['id' => $report->id, 'status' => 'pending'], 201);
    }
}
