<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rules', function (Blueprint $table) {
            $table->id();
            $table->string('pack', 64);
            $table->string('key', 64);
            // null means "the last chapter": hidden until the reader finishes the story.
            $table->unsignedSmallInteger('chapter')->nullable();
            $table->json('phrases');
            $table->string('note', 300)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('exported_at')->nullable();
            $table->timestamps();

            $table->unique(['pack', 'key']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 32);
            $table->string('status', 32)->default('pending')->index();
            $table->string('pack', 64)->index();
            $table->unsignedSmallInteger('chapter')->nullable();
            $table->text('text');
            $table->string('page_url', 2048)->nullable();
            $table->string('site', 32)->nullable();
            $table->string('note', 300)->nullable();
            $table->string('extension_version', 32)->nullable();
            $table->string('list_version', 32)->nullable();
            // Same kind + pack + text: later copies only bump the counter.
            $table->char('fingerprint', 64)->index();
            $table->unsignedInteger('occurrences')->default(1);
            // HMAC of the sender's IP, kept only to spot abuse. The IP itself is never stored.
            $table->char('sender_hash', 64)->nullable()->index();
            $table->foreignId('rule_id')->nullable()->constrained('rules')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('resolution', 300)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('rules');
    }
};
