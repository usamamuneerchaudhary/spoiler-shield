<?php

use Illuminate\Support\Facades\Route;

// The API has no public site; send visitors to the moderation panel.
Route::redirect('/', '/admin');
