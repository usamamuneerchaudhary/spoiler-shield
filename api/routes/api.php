<?php

use App\Http\Controllers\Api\ReportController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('reports', [ReportController::class, 'store'])
        ->middleware('throttle:reports')
        ->name('api.reports.store');
});
