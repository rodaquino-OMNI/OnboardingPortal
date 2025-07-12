<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return ['Laravel' => app()->version()];
});

// Test route to debug request
Route::post('/test-login', function (\Illuminate\Http\Request $request) {
    return response()->json([
        'all' => $request->all(),
        'input' => $request->input(),
        'json' => $request->json()->all(),
        'content' => $request->getContent(),
        'headers' => $request->headers->all(),
    ]);
});