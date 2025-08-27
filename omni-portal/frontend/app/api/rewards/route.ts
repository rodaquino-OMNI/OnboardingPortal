import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Rewards API - Handles gamification rewards and user points
 */

interface Reward {
  id: number;
  code: string;
  name: string;
  description: string;
  benefits: string[];
  points_required: number;
  type: 'badge' | 'discount' | 'service_upgrade' | 'physical_item' | 'digital_item' | 'feature_unlock' | 'priority_access';
  icon: string;
  color_scheme: string;
  is_premium: boolean;
  is_available: boolean;
  is_unlocked: boolean;
  can_claim: boolean;
  user_status: 'unlocked' | 'claimed' | 'delivered' | 'expired' | 'revoked' | null;
  redemption_code: string | null;
  claimed_at: string | null;
  delivered_at: string | null;
}

// Mock rewards data
const MOCK_REWARDS: Reward[] = [
  {
    id: 1,
    code: 'HEALTH_CHAMPION',
    name: 'Campeão da Saúde',
    description: 'Complete seu perfil de saúde e ganhe acesso premium',
    benefits: ['Consultas prioritárias', 'Relatórios detalhados', 'Suporte 24/7'],
    points_required: 100,
    type: 'badge',
    icon: '🏆',
    color_scheme: 'gold',
    is_premium: false,
    is_available: true,
    is_unlocked: true,
    can_claim: true,
    user_status: 'unlocked',
    redemption_code: null,
    claimed_at: null,
    delivered_at: null
  },
  {
    id: 2,
    code: 'PREMIUM_ACCESS',
    name: 'Acesso Premium',
    description: 'Desbloqueie recursos premium do portal',
    benefits: ['Telemedicina ilimitada', 'AI Health Assistant', 'Dashboard avançado'],
    points_required: 250,
    type: 'feature_unlock',
    icon: '⭐',
    color_scheme: 'purple',
    is_premium: true,
    is_available: true,
    is_unlocked: false,
    can_claim: false,
    user_status: null,
    redemption_code: null,
    claimed_at: null,
    delivered_at: null
  },
  {
    id: 3,
    code: 'WELLNESS_KIT',
    name: 'Kit de Bem-estar',
    description: 'Kit físico com produtos de saúde e bem-estar',
    benefits: ['Termômetro digital', 'Oxímetro', 'Guia nutricional', 'Frete grátis'],
    points_required: 500,
    type: 'physical_item',
    icon: '📦',
    color_scheme: 'blue',
    is_premium: true,
    is_available: true,
    is_unlocked: false,
    can_claim: false,
    user_status: null,
    redemption_code: null,
    claimed_at: null,
    delivered_at: null
  },
  {
    id: 4,
    code: 'PRIORITY_SUPPORT',
    name: 'Suporte Prioritário',
    description: 'Atendimento prioritário em consultas e suporte',
    benefits: ['Fila prioritária', 'Agendamento flexível', 'Reagendamento ilimitado'],
    points_required: 150,
    type: 'priority_access',
    icon: '🚀',
    color_scheme: 'orange',
    is_premium: false,
    is_available: true,
    is_unlocked: false,
    can_claim: false,
    user_status: null,
    redemption_code: null,
    claimed_at: null,
    delivered_at: null
  },
  {
    id: 5,
    code: 'DISCOUNT_10',
    name: 'Desconto 10%',
    description: '10% de desconto em serviços adicionais',
    benefits: ['10% off em consultas particulares', 'Válido por 6 meses'],
    points_required: 75,
    type: 'discount',
    icon: '💰',
    color_scheme: 'green',
    is_premium: false,
    is_available: true,
    is_unlocked: true,
    can_claim: true,
    user_status: 'unlocked',
    redemption_code: null,
    claimed_at: null,
    delivered_at: null
  }
];

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = cookies();
    const authToken = cookieStore.get('auth_token')?.value;
    const authenticated = cookieStore.get('authenticated')?.value === 'true';
    
    if (!authenticated && !authToken) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'You must be logged in to view rewards'
      }, { status: 401 });
    }

    // Mock user points (in real app, this would come from database/backend)
    const userPoints = 125; // Simulated current points
    
    // Calculate reward status based on user points
    const rewardsWithStatus = MOCK_REWARDS.map(reward => ({
      ...reward,
      is_unlocked: userPoints >= reward.points_required,
      can_claim: userPoints >= reward.points_required && reward.user_status !== 'claimed',
      user_status: userPoints >= reward.points_required ? 
        (reward.user_status === 'claimed' ? 'claimed' : 'unlocked') : 
        null
    }));

    const response = {
      success: true,
      data: {
        rewards: rewardsWithStatus,
        user_points: userPoints
      }
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Rewards fetch error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to fetch rewards',
      success: false,
      data: {
        rewards: [],
        user_points: 0
      }
    }, { status: 500 });
  }
}

// Handle POST for claiming rewards
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authToken = cookieStore.get('auth_token')?.value;
    const authenticated = cookieStore.get('authenticated')?.value === 'true';
    
    if (!authenticated && !authToken) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { reward_id, action = 'claim' } = body;

    if (!reward_id) {
      return NextResponse.json({
        error: 'Reward ID is required'
      }, { status: 400 });
    }

    // Find the reward
    const reward = MOCK_REWARDS.find(r => r.id === reward_id);
    if (!reward) {
      return NextResponse.json({
        error: 'Reward not found'
      }, { status: 404 });
    }

    // Mock claim logic
    const response = {
      success: true,
      message: `${reward.name} resgatado com sucesso!`,
      data: {
        redemption_code: `${reward.code}_${Date.now()}`,
        status: 'claimed',
        bonus_points: Math.floor(reward.points_required * 0.1) // 10% bonus
      }
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('Reward claim error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to claim reward',
      success: false
    }, { status: 500 });
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}