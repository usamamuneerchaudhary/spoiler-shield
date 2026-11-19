<?php

namespace App\Providers;

use App\Support\Catalog;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Catalog::class, fn ($app) => new Catalog(
            path: config('spoiler_shield.catalog_path'),
            url: config('spoiler_shield.catalog_url'),
            cache: $app['cache.store'],
            cacheSeconds: config('spoiler_shield.catalog_cache_seconds'),
        ));
    }

    public function boot(): void
    {
        RateLimiter::for('reports', fn (Request $request) => [
            Limit::perMinute(config('spoiler_shield.reports_per_minute'))->by($request->ip()),
            Limit::perDay(config('spoiler_shield.reports_per_day'))->by($request->ip()),
        ]);
    }
}
