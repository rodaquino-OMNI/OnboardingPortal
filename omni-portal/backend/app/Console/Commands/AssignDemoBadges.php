<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\GamificationBadge;
use Illuminate\Support\Facades\DB;

class AssignDemoBadges extends Command
{
    protected $signature = 'demo:assign-badges';
    protected $description = 'Assign badges to demo user';

    public function handle()
    {
        $user = User::where('email', 'demo@example.com')->first();
        
        if (!$user || !$user->beneficiary) {
            $this->error('Demo user or beneficiary not found!');
            return;
        }

        $beneficiary = $user->beneficiary;
        
        // Badges to assign
        $badgeSlugs = ['first_login', 'profile_complete', 'early_bird'];
        
        foreach ($badgeSlugs as $slug) {
            $badge = GamificationBadge::where('slug', $slug)->first();
            
            if ($badge) {
                // Check if already has badge
                if (!$beneficiary->badges()->where('gamification_badge_id', $badge->id)->exists()) {
                    $beneficiary->badges()->attach($badge->id, [
                        'earned_at' => now(),
                    ]);
                    $this->info("Assigned badge: {$badge->name}");
                } else {
                    $this->info("Already has badge: {$badge->name}");
                }
            }
        }
        
        $this->info('✅ Demo user badges assigned successfully!');
        $this->info('Total badges: ' . $beneficiary->badges()->count());
    }
}