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

// ===== PUBLIC WEBSOCKET TESTING ROUTES (NO AUTH) =====
Route::group(['prefix' => 'api/websocket'], function () {
    Route::get('test', [App\Http\Controllers\Api\WebSocketTestController::class, 'testConnection']);
    Route::post('load-test', [App\Http\Controllers\Api\WebSocketTestController::class, 'loadTest']);
    Route::get('status', [App\Http\Controllers\Api\WebSocketTestController::class, 'status']);
});

// ===== PUBLIC ALERT TESTING ROUTES (NO AUTH) =====
Route::group(['prefix' => 'api/alerts'], function () {
    Route::post('broadcast', [App\Http\Controllers\Api\AlertController::class, 'broadcastHealthAlert']);
    Route::post('sample', [App\Http\Controllers\Api\AlertController::class, 'generateSampleAlert']);
    Route::get('connection-info', [App\Http\Controllers\Api\AlertController::class, 'connectionInfo']);
});

