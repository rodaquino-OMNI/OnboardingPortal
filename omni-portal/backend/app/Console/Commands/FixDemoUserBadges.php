<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\GamificationBadge;
use App\Models\GamificationProgress;

class FixDemoUserBadges extends Command
{
    protected $signature = 'demo:fix-badges';
    protected $description = 'Fix demo user gamification badges';

    public function handle()
    {
        $user = User::where('email', 'demo@example.com')->first();
        
        if (!$user) {
            $this->error('Demo user not found!');
            return;
        }

        $beneficiary = $user->beneficiary;
        
        if (!$beneficiary) {
            $this->error('Demo user beneficiary not found!');
            return;
        }

        // Update gamification progress to ensure badges_earned is an array
        $progress = $beneficiary->gamificationProgress;
        
        if ($progress) {
            $progress->badges_earned = json_encode(['early_bird', 'first_login', 'profile_complete']);
            $progress->save();
            
            $this->info('Fixed demo user badges!');
            $this->info('Badges earned: early_bird, first_login, profile_complete');
        } else {
            $this->error('Demo user gamification progress not found!');
        }
    }
}