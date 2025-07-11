

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Upload, Camera, CheckCircle, 
  Star, Trophy, Heart, Shield, FileText, Video, 
  Users, Target, Zap, Gift, Award, Play, User,
  Phone, Mail, MapPin, Calendar, Clock, AlertCircle,
  Sparkles, TrendingUp, Activity, Lock
} from 'lucide-react';

const AUSTAOnboardingMVP = () => {
  // Estado principal
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userProgress, setUserProgress] = useState({
    level: 1,
    points: 0,
    completedSteps: [],
    badges: [],
    streak: 0,
    levelName: 'Iniciante'
  });
  const [formData, setFormData] = useState({
    profile: {},
    health: {},
    documents: [],
    interview: {}
  });
  const [notifications, setNotifications] = useState([]);

  // Sistema de níveis
  const levels = [
    { name: 'Iniciante', min: 0, max: 299, color: 'from-gray-400 to-gray-500' },
    { name: 'Bronze', min: 300, max: 699, color: 'from-amber-600 to-amber-700' },
    { name: 'Prata', min: 700, max: 1199, color: 'from-gray-500 to-gray-600' },
    { name: 'Ouro', min: 1200, max: 1999, color: 'from-yellow-400 to-yellow-500' },
    { name: 'Platina', min: 2000, max: Infinity, color: 'from-purple-500 to-purple-600' }
  ];

  // Atualizar nível baseado em pontos
  useEffect(() => {
    const currentLevel = levels.find(level => 
      userProgress.points >= level.min && userProgress.points <= level.max
    );
    if (currentLevel && currentLevel.name !== userProgress.levelName) {
      setUserProgress(prev => ({ ...prev, levelName: currentLevel.name }));
      if (currentLevel.name !== 'Iniciante') {
        showNotification(`Nível ${currentLevel.name} alcançado! 🎊`, 'achievement');
      }
    }
  }, [userProgress.points]);

  // Sistema de notificações
  const showNotification = (message, type = 'success') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  // Adicionar pontos com animação
  const addPoints = (points, reason) => {
    setUserProgress(prev => ({
      ...prev,
      points: prev.points + points
    }));
    showNotification(`+${points} pontos! ${reason}`, 'points');
  };

  // Completar etapa
  const completeStep = (step) => {
    if (!userProgress.completedSteps.includes(step)) {
      setUserProgress(prev => ({
        ...prev,
        completedSteps: [...prev.completedSteps, step]
      }));
    }
  };

  // Adicionar badge
  const unlockBadge = (badge) => {
    if (!userProgress.badges.includes(badge.id)) {
      setUserProgress(prev => ({
        ...prev,
        badges: [...prev.badges, badge.id]
      }));
      showNotification(`Nova conquista: ${badge.name}! 🏆`, 'achievement');
    }
  };

  // Configuração das etapas
  const steps = [
    { id: 'welcome', name: 'Bem-vindo', icon: Heart, color: 'from-purple-500 to-purple-600' },
    { id: 'profile', name: 'Perfil', icon: User, color: 'from-blue-500 to-blue-600' },
    { id: 'health', name: 'Saúde', icon: Activity, color: 'from-red-500 to-red-600' },
    { id: 'documents', name: 'Documentos', icon: FileText, color: 'from-green-500 to-green-600' },
    { id: 'interview', name: 'Entrevista', icon: Video, color: 'from-orange-500 to-orange-600' },
    { id: 'complete', name: 'Finalizar', icon: Trophy, color: 'from-yellow-400 to-yellow-500' }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  const progressPercentage = (getCurrentStepIndex() / (steps.length - 1)) * 100;

  // Componente de Notificação
  const NotificationStack = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`transform transition-all duration-300 animate-slide-in-right
            px-6 py-3 rounded-lg shadow-lg backdrop-blur-sm text-white font-medium
            ${notification.type === 'points' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : ''}
            ${notification.type === 'achievement' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : ''}
            ${notification.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}
            ${notification.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-500' : ''}
          `}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'points' && <Star className="w-5 h-5" />}
            {notification.type === 'achievement' && <Trophy className="w-5 h-5" />}
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Header com Gamificação
  const GameHeader = () => {
    const currentLevel = levels.find(level => 
      userProgress.points >= level.min && userProgress.points <= level.max
    );
    
    return (
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AUSTA Saúde</h1>
                <p className="text-sm text-gray-600">Seu plano, sua jornada</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Nível {userProgress.level}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white
                    bg-gradient-to-r ${currentLevel?.color || 'from-gray-400 to-gray-500'}`}>
                    {userProgress.levelName}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold text-gray-900">{userProgress.points}</span>
                  <span className="text-sm text-gray-600">pontos</span>
                </div>
              </div>
              
              {userProgress.badges.length > 0 && (
                <div className="flex space-x-1">
                  {userProgress.badges.slice(0, 3).map((badge, i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                  ))}
                  {userProgress.badges.length > 3 && (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      +{userProgress.badges.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Barra de Progresso Global */}
          <div className="relative">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-700 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Início da jornada</span>
              <span className="font-medium text-gray-700">{Math.round(progressPercentage)}% completo</span>
              <span>Cadastro finalizado</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Tela de Boas-vindas
  const WelcomeScreen = () => {
    const [isLoading, setIsLoading] = useState(false);
    
    const handleStart = () => {
      setIsLoading(true);
      setTimeout(() => {
        addPoints(100, 'Iniciou sua jornada! 🚀');
        setCurrentStep('profile');
      }, 500);
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12 animate-fade-in">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
              <Heart className="w-16 h-16 text-white animate-pulse" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Bem-vindo à sua nova jornada de saúde!
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Em apenas alguns minutos, você terá acesso ao plano de saúde mais inovador do Brasil. 
              Vamos tornar este processo simples, rápido e até divertido!
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">Super Rápido</h3>
              <p className="text-gray-600">Complete seu cadastro em menos de 10 minutos</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">100% Seguro</h3>
              <p className="text-gray-600">Seus dados protegidos com criptografia bancária</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow transform hover:-translate-y-1">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                <Gift className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2 text-lg">Ganhe Recompensas</h3>
              <p className="text-gray-600">Acumule pontos e desbloqueie benefícios exclusivos</p>
            </div>
          </div>

          <div className="text-center">
            <button 
              onClick={handleStart}
              disabled={isLoading}
              className="group relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-5 rounded-2xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center justify-center">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                    Preparando sua jornada...
                  </>
                ) : (
                  <>
                    Começar Agora
                    <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
            </button>
            
            <p className="mt-6 text-sm text-gray-600">
              <Lock className="w-4 h-4 inline mr-1" />
                            Ao continuar, você concorda com nossos termos e política de privacidade
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Formulário de Perfil
  const ProfileForm = () => {
    const [profileData, setProfileData] = useState({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      nascimento: '',
      cep: '',
      endereco: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validação de CPF
    const validateCPF = (cpf) => {
      cpf = cpf.replace(/[^\d]/g, '');
      if (cpf.length !== 11) return false;
      
      // Validação básica de CPF
      let sum = 0;
      let remainder;
      
      if (cpf === "00000000000") return false;
      
      for (let i = 1; i <= 9; i++) {
        sum = sum + parseInt(cpf.substring(i-1, i)) * (11 - i);
      }
      
      remainder = (sum * 10) % 11;
      if ((remainder === 10) || (remainder === 11)) remainder = 0;
      if (remainder !== parseInt(cpf.substring(9, 10))) return false;
      
      sum = 0;
      for (let i = 1; i <= 10; i++) {
        sum = sum + parseInt(cpf.substring(i-1, i)) * (12 - i);
      }
      
      remainder = (sum * 10) % 11;
      if ((remainder === 10) || (remainder === 11)) remainder = 0;
      if (remainder !== parseInt(cpf.substring(10, 11))) return false;
      
      return true;
    };

    // Máscara de telefone
    const maskPhone = (value) => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
    };

    // Máscara de CPF
    const maskCPF = (value) => {
      return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1');
    };

    const validateForm = () => {
      const newErrors = {};
      
      if (!profileData.nome || profileData.nome.length < 3) {
        newErrors.nome = 'Nome completo é obrigatório';
      }
      
      if (!profileData.email || !/\S+@\S+\.\S+/.test(profileData.email)) {
        newErrors.email = 'E-mail inválido';
      }
      
      if (!profileData.telefone || profileData.telefone.replace(/\D/g, '').length < 11) {
        newErrors.telefone = 'Telefone inválido';
      }
      
      if (!profileData.cpf || !validateCPF(profileData.cpf)) {
        newErrors.cpf = 'CPF inválido';
      }
      
      if (!profileData.nascimento) {
        newErrors.nascimento = 'Data de nascimento obrigatória';
      }
      
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
      if (!validateForm()) {
        showNotification('Por favor, corrija os erros no formulário', 'error');
        return;
      }
      
      setIsSubmitting(true);
      
      // Simular processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setFormData(prev => ({ ...prev, profile: profileData }));
      addPoints(200, 'Perfil completo! 👤');
      completeStep('profile');
      
      // Check for early bird badge (horário da manhã)
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 12) {
        unlockBadge({ id: 'early-bird', name: 'Madrugador' });
      }
      
      setCurrentStep('health');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <GameHeader />
        
        <div className="max-w-2xl mx-auto p-4 md:p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Vamos nos conhecer melhor</h2>
            <p className="text-gray-600 text-lg">Preencha seus dados para personalizar sua experiência</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            {/* Nome completo */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome completo
              </label>
              <input
                type="text"
                value={profileData.nome}
                onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                  ${errors.nome ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="João da Silva"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.nome}
                </p>
              )}
            </div>

            {/* E-mail e Telefone */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                      ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    value={profileData.telefone}
                    onChange={(e) => setProfileData({ ...profileData, telefone: maskPhone(e.target.value) })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                      ${errors.telefone ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="(11) 99999-9999"
                    maxLength="15"
                  />
                </div>
                {errors.telefone && (
                  <p className="mt-1 text-sm text-red-600">{errors.telefone}</p>
                )}
              </div>
            </div>

            {/* CPF e Data de Nascimento */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPF
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={profileData.cpf}
                    onChange={(e) => setProfileData({ ...profileData, cpf: maskCPF(e.target.value) })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                      ${errors.cpf ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="123.456.789-00"
                    maxLength="14"
                  />
                </div>
                {errors.cpf && (
                  <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Data de nascimento
                </label>
                <div className="relative">
                  <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <input
                    type="date"
                    value={profileData.nascimento}
                    onChange={(e) => setProfileData({ ...profileData, nascimento: e.target.value })}
                    className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all
                      ${errors.nascimento ? 'border-red-300' : 'border-gray-300'}`}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                {errors.nascimento && (
                  <p className="mt-1 text-sm text-red-600">{errors.nascimento}</p>
                )}
              </div>
            </div>

            {/* CEP e Endereço (opcional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                CEP <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={profileData.cep}
                  onChange={(e) => setProfileData({ ...profileData, cep: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="12345-678"
                />
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex space-x-4 pt-4">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                <ChevronLeft className="w-5 h-5 inline mr-2" />
                Voltar
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="w-5 h-5 inline ml-2" />
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Dica de segurança */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Seus dados estão seguros</p>
                <p>Utilizamos criptografia de ponta a ponta e seguimos rigorosamente a LGPD para proteger suas informações.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Questionário de Saúde Gamificado
  const HealthQuestionnaire = () => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showAIChat, setShowAIChat] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const questions = [
      {
        id: 'health_general',
        title: 'Como você avalia sua saúde geral?',
        subtitle: 'Seja sincero, isso nos ajuda a oferecer o melhor cuidado',
        type: 'scale',
        options: [
          { value: 5, label: 'Excelente', emoji: '🌟', color: 'from-green-500 to-emerald-500' },
          { value: 4, label: 'Muito boa', emoji: '😊', color: 'from-blue-500 to-cyan-500' },
          { value: 3, label: 'Boa', emoji: '🙂', color: 'from-yellow-500 to-amber-500' },
          { value: 2, label: 'Regular', emoji: '😐', color: 'from-orange-500 to-red-500' },
          { value: 1, label: 'Necessita atenção', emoji: '😟', color: 'from-red-500 to-rose-500' }
        ]
      },
      {
        id: 'exercise_frequency',
        title: 'Com que frequência você pratica atividades físicas?',
        subtitle: 'Qualquer movimento conta!',
        type: 'multiple',
        options: [
          { value: 'daily', label: 'Todos os dias', emoji: '🏃‍♂️', description: 'Sou muito ativo!' },
          { value: 'frequent', label: '3-5x por semana', emoji: '💪', description: 'Mantenho uma rotina' },
          { value: 'occasional', label: '1-2x por semana', emoji: '🚶‍♀️', description: 'Quando posso' },
          { value: 'rare', label: 'Raramente', emoji: '🛋️', description: 'Preciso melhorar' }
        ]
      },
      {
        id: 'sleep_quality',
        title: 'Como está a qualidade do seu sono?',
        subtitle: 'O sono é fundamental para sua saúde',
        type: 'multiple',
        options: [
          { value: 'excellent', label: 'Durmo muito bem', emoji: '😴', description: '7-9 horas por noite' },
          { value: 'good', label: 'Durmo bem', emoji: '🛌', description: 'Acordo descansado' },
          { value: 'regular', label: 'Poderia ser melhor', emoji: '😪', description: 'Acordo cansado às vezes' },
          { value: 'poor', label: 'Tenho dificuldades', emoji: '😩', description: 'Insônia ou sono agitado' }
        ]
      },
      {
        id: 'health_conditions',
        title: 'Você tem alguma condição de saúde?',
        subtitle: 'Marque todas que se aplicam',
        type: 'checkbox',
        options: [
          { value: 'diabetes', label: 'Diabetes', icon: '💉' },
          { value: 'hypertension', label: 'Hipertensão', icon: '❤️' },
          { value: 'asthma', label: 'Asma', icon: '🫁' },
          { value: 'anxiety', label: 'Ansiedade', icon: '🧠' },
          { value: 'none', label: 'Nenhuma condição', icon: '✅' }
        ]
      },
      {
        id: 'medications',
        title: 'Você toma algum medicamento regularmente?',
        subtitle: 'Isso nos ajuda a entender melhor suas necessidades',
        type: 'boolean',
        options: [
          { value: true, label: 'Sim, tomo medicamentos', emoji: '💊', color: 'from-blue-500 to-purple-500' },
          { value: false, label: 'Não tomo medicamentos', emoji: '🌿', color: 'from-green-500 to-emerald-500' }
        ]
      }
    ];

    const handleAnswer = async (questionId, value) => {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
      addPoints(50, 'Questão respondida! 📝');
      
      // Animação de processamento
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsProcessing(false);
      
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        // Calcular score de risco
        const riskScore = calculateRiskScore(answers);
        
        // Badges baseados nas respostas
        if (answers.health_general >= 4 && answers.exercise_frequency === 'daily') {
          unlockBadge({ id: 'health-champion', name: 'Campeão da Saúde' });
        }
        
        completeStep('health');
        addPoints(150, 'Avaliação de saúde completa! 🏥');
        
        setFormData(prev => ({ 
          ...prev, 
          health: { ...answers, riskScore } 
        }));
        
        setCurrentStep('documents');
      }
    };

    const calculateRiskScore = (answers) => {
      // Lógica simplificada de cálculo de risco
      let score = 0;
      
      if (answers.health_general) score += answers.health_general * 20;
      if (answers.exercise_frequency === 'daily') score += 20;
      if (answers.exercise_frequency === 'frequent') score += 15;
      if (answers.sleep_quality === 'excellent') score += 15;
      if (answers.health_conditions?.includes('none')) score += 20;
      
      return Math.min(100, score);
    };

    const question = questions[currentQuestion];

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
        <GameHeader />
        
        <div className="max-w-3xl mx-auto p-4 md:p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <Activity className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Avaliação de Saúde</h2>
            <p className="text-gray-600 text-lg">Questão {currentQuestion + 1} de {questions.length}</p>
            
            {/* Mini barra de progresso */}
            <div className="w-48 mx-auto mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-red-400 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {question.title}
            </h3>
            <p className="text-gray-600 text-center mb-8">
              {question.subtitle}
            </p>

            {/* Opções de resposta */}
            <div className={`
              ${question.type === 'scale' ? 'space-y-3' : ''}
              ${question.type === 'multiple' ? 'grid md:grid-cols-2 gap-4' : ''}
              ${question.type === 'checkbox' ? 'space-y-3' : ''}
              ${question.type === 'boolean' ? 'grid md:grid-cols-2 gap-4' : ''}
            `}>
              {question.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(question.id, option.value)}
                  disabled={isProcessing}
                  className={`
                    ${question.type === 'scale' ? 'w-full p-4 text-left' : ''}
                    ${question.type === 'multiple' ? 'p-6' : ''}
                    ${question.type === 'checkbox' ? 'w-full p-4 text-left' : ''}
                    ${question.type === 'boolean' ? 'p-8' : ''}
                    border-2 border-gray-200 rounded-xl hover:border-blue-400 
                    transition-all duration-200 transform hover:scale-102 hover:shadow-lg
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${answers[question.id] === option.value ? 'border-blue-500 bg-blue-50' : ''}
                  `}
                >
                  <div className={`${question.type === 'boolean' ? 'text-center' : 'flex items-center'}`}>
                    {option.emoji && (
                      <span className={`text-3xl ${question.type === 'boolean' ? 'mb-3 block' : 'mr-4'}`}>
                        {option.emoji}
                      </span>
                    )}
                    {option.icon && (
                      <span className="text-2xl mr-3">{option.icon}</span>
                    )}
                    <div className={question.type === 'boolean' ? '' : 'flex-1'}>
                      <p className="font-semibold text-gray-900 text-lg">{option.label}</p>
                      {option.description && (
                        <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                      )}
                    </div>
                    {question.type === 'scale' && option.color && (
                      <div className={`w-12 h-12 bg-gradient-to-br ${option.color} rounded-lg flex items-center justify-center ml-auto`}>
                        <span className="text-white text-sm font-bold">{option.value}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Botão de ajuda AI */}
            <div className="mt-8 text-center">
              <button
                onClick={() => setShowAIChat(!showAIChat)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-center mx-auto"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                Precisa de ajuda? Converse com nosso assistente
              </button>
              
              {showAIChat && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                  <p className="text-sm text-blue-800">
                    <strong>Assistente AUSTA:</strong> Olá! Estou aqui para esclarecer dúvidas sobre as perguntas. 
                    Esta avaliação nos ajuda a entender melhor suas necessidades de saúde e oferecer o melhor cuidado possível. 
                    Todas as informações são confidenciais e protegidas pela LGPD.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Navegação */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => currentQuestion > 0 ? setCurrentQuestion(currentQuestion - 1) : setCurrentStep('profile')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5 inline mr-2" />
              Voltar
            </button>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">+50 pontos por resposta</p>
              <p className="text-xs text-gray-400 mt-1">Responda com sinceridade</p>
            </div>
            
            <button
              onClick={() => handleAnswer(question.id, null)}
              className="px-6 py-3 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Pular
              <ChevronRight className="w-5 h-5 inline ml-1" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Upload de Documentos
  const DocumentUpload = () => {
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [isProcessing, setIsProcessing] = useState({});
    
    const requiredDocs = [
      { 
        id: 'identity', 
        name: 'RG ou CNH', 
        icon: FileText, 
        color: 'from-blue-500 to-blue-600',
        points: 100,
        description: 'Documento de identidade com foto'
      },
      { 
        id: 'cpf', 
        name: 'CPF', 
        icon: FileText, 
        color: 'from-green-500 to-green-600',
        points: 100,
        description: 'Cadastro de Pessoa Física'
      },
      { 
        id: 'address', 
        name: 'Comprovante de Residência', 
        icon: FileText, 
        color: 'from-purple-500 to-purple-600',
        points: 100,
        description: 'Conta recente (últimos 3 meses)'
      },
      { 
        id: 'photo', 
        name: 'Foto 3x4', 
        icon: Camera, 
        color: 'from-pink-500 to-pink-600',
        points: 100,
        description: 'Foto recente com fundo claro'
      }
    ];

    const handleUpload = async (docId) => {
      setIsProcessing(prev => ({ ...prev, [docId]: true }));
      setUploadProgress(prev => ({ ...prev, [docId]: 0 }));
      
      // Simular upload progressivo
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => ({ ...prev, [docId]: i }));
      }
      
      // Simular processamento OCR
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setUploadedDocs(prev => [...prev, docId]);
      const doc = requiredDocs.find(d => d.id === docId);
      addPoints(doc.points, `${doc.name} enviado! 📄`);
      
      setIsProcessing(prev => ({ ...prev, [docId]: false }));
      setUploadProgress(prev => ({ ...prev, [docId]: null }));
      
      // Badge para upload rápido
      if (uploadedDocs.length === 0 && Date.now() - startTime < 60000) {
        unlockBadge({ id: 'speed-uploader', name: 'Upload Relâmpago' });
      }
    };

    const startTime = Date.now();
    const allDocsUploaded = uploadedDocs.length === requiredDocs.length;

    const handleContinue = () => {
      completeStep('documents');
      addPoints(200, 'Todos os documentos enviados! 📁');
      
      if (uploadedDocs.length === requiredDocs.length) {
        unlockBadge({ id: 'perfectionist', name: 'Perfeccionista' });
      }
      
      setFormData(prev => ({ ...prev, documents: uploadedDocs }));
      setCurrentStep('interview');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
        <GameHeader />
        
        <div className="max-w-3xl mx-auto p-4 md:p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <FileText className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Documentos Necessários</h2>
            <p className="text-gray-600 text-lg">Envie seus documentos de forma rápida e segura</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6 max-w-md mx-auto">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">Criptografia de ponta a ponta</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {requiredDocs.map((doc) => {
              const isUploaded = uploadedDocs.includes(doc.id);
              const isUploading = isProcessing[doc.id];
              const progress = uploadProgress[doc.id];
              const IconComponent = doc.icon;
              
              return (
                <div 
                  key={doc.id}
                  className={`
                    relative bg-white border-2 rounded-2xl p-6 transition-all duration-300
                    ${isUploaded 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300
                        ${isUploaded 
                          ? 'bg-gradient-to-br from-green-500 to-green-600' 
                          : `bg-gradient-to-br ${doc.color}`
                        }
                      `}>
                        {isUploaded ? (
                          <CheckCircle className="w-7 h-7 text-white" />
                        ) : (
                          <IconComponent className="w-7 h-7 text-white" />
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-gray-900 text-lg">{doc.name}</h3>
                        <p className="text-sm text-gray-600">{doc.description}</p>
                        {isUploaded && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            ✓ Documento validado com sucesso
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="flex items-center space-x-1 text-yellow-600">
                          <Star className="w-4 h-4" />
                          <span className="text-sm font-bold">+{doc.points}</span>
                        </div>
                      </div>
                      
                      {!isUploaded && !isUploading && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUpload(doc.id)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
                          >
                            <Upload className="w-4 h-4" />
                            <span className="font-medium">Enviar</span>
                          </button>
                          <button
                            onClick={() => handleUpload(doc.id)}
                            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 flex items-center space-x-2 shadow-md hover:shadow-lg"
                          >
                            <Camera className="w-4 h-4" />
                            <span className="font-medium">Foto</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Barra de progresso do upload */}
                  {isUploading && progress !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-2xl overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Status geral */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Status dos Documentos</h3>
              <span className="text-sm font-medium text-gray-600">
                {uploadedDocs.length} de {requiredDocs.length} completos
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${(uploadedDocs.length / requiredDocs.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Botões de navegação */}
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentStep('health')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5 inline mr-2" />
              Voltar
            </button>
            <button
              onClick={handleContinue}
              disabled={!allDocsUploaded}
              className={`
                flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg
                ${allDocsUploaded
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {allDocsUploaded ? (
                <>
                  Continuar
                  <ChevronRight className="w-5 h-5 inline ml-2" />
                </>
              ) : (
                'Complete todos os documentos'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Agendamento de Entrevista
  const InterviewScheduling = () => {
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Gerar slots de exemplo
    const generateTimeSlots = () => {
      const slots = [];
      const doctors = ['Dr. Silva', 'Dra. Santos', 'Dr. Oliveira', 'Dra. Costa'];
      const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
      
      times.forEach((time, index) => {
        slots.push({
          id: index + 1,
          time,
          doctor: doctors[Math.floor(Math.random() * doctors.length)],
          available: Math.random() > 0.3,
          duration: '30 min'
        });
      });
      
      return slots;
    };
    
    const timeSlots = generateTimeSlots();

    const handleSchedule = () => {
      if (!selectedSlot) return;
      
      setFormData(prev => ({ 
        ...prev, 
        interview: { 
          date: selectedDate, 
          time: selectedSlot.time,
          doctor: selectedSlot.doctor 
        } 
      }));
      
      addPoints(200, 'Entrevista agendada! 📅');
      completeStep('interview');
      
      // Badge para agendamento rápido
      const now = new Date();
      const scheduled = new Date(selectedDate);
      const daysDiff = Math.ceil((scheduled - now) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        unlockBadge({ id: 'proactive', name: 'Proativo' });
      }
      
      setCurrentStep('complete');
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <GameHeader />
        
        <div className="max-w-3xl mx-auto p-4 md:p-6 pt-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <Video className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Entrevista Médica Online</h2>
            <p className="text-gray-600 text-lg">Escolha o melhor horário para sua videochamada</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            {/* Seletor de data */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Escolha a data
              </label>
              <div className="relative">
                <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            
            {/* Grid de horários */}
            <h3 className="font-semibold text-gray-800 mb-4">Horários disponíveis</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => slot.available && setSelectedSlot(slot)}
                  disabled={!slot.available}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    ${selectedSlot?.id === slot.id
                      ? 'border-orange-500 bg-orange-50'
                      : slot.available
                      ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                      : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3 text-left">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <div>
                        <div className="font-semibold text-gray-900">{slot.time}</div>
                        <div className="text-sm text-gray-600">{slot.doctor}</div>
                        <div className="text-xs text-gray-500">{slot.duration}</div>
                      </div>
                    </div>
                    <div className={`
                      px-3 py-1 rounded-full text-xs font-medium
                      ${slot.available 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                      }
                    `}>
                      {slot.available ? 'Disponível' : 'Ocupado'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Informações sobre a entrevista */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
              <Video className="w-5 h-5 mr-2" />
              Como funciona a entrevista?
            </h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>Duração aproximada de 30 minutos</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>Conversa com médico especializado</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>Esclarecimento de dúvidas sobre o plano</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>100% online, sem sair de casa</span>
              </li>
            </ul>
          </div>

          {/* Confirmação do agendamento */}
          {selectedSlot && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">
                  Entrevista marcada para {new Date(selectedDate).toLocaleDateString('pt-BR')} às {selectedSlot.time} com {selectedSlot.doctor}
                </span>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentStep('documents')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5 inline mr-2" />
              Voltar
            </button>
            <button
              onClick={handleSchedule}
              disabled={!selectedSlot}
              className={`
                flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg
                ${selectedSlot
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              Confirmar Agendamento
              {selectedSlot && <ChevronRight className="w-5 h-5 inline ml-2" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Tela de Conclusão
  const CompletionScreen = () => {
    const totalTime = Math.round((Date.now() - startTime) / 60000); // minutos
    const startTime = Date.now() - 480000; // 8 minutos atrás para demo
    
    // Calcular conquistas finais
    const achievements = [
      { icon: Trophy, label: `Nível ${userProgress.level} alcançado`, color: 'text-yellow-500' },
      { icon: Star, label: `${userProgress.points} pontos conquistados`, color: 'text-yellow-500' },
      { icon: Target, label: '100% do cadastro completo', color: 'text-green-500' },
      { icon: Clock, label: `Completado em ${totalTime} minutos`, color: 'text-blue-500' },
      { icon: Award, label: `${userProgress.badges.length} conquistas desbloqueadas`, color: 'text-purple-500' },
      { icon: Gift, label: 'Benefícios exclusivos liberados', color: 'text-pink-500' }
    ];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50">
        <GameHeader />
        
        <div className="max-w-4xl mx-auto p-4 md:p-6 pt-8 text-center">
          {/* Animação de celebração */}
          <div className="mb-8">
            <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl animate-bounce">
              <Trophy className="w-16 h-16 text-white" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Parabéns! 🎉
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Você completou seu cadastro com sucesso e já faz parte da família AUSTA!
            </p>
          </div>

          {/* Card de conquistas */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h3 className="font-bold text-2xl text-gray-900 mb-6">Suas Conquistas</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement, index) => {
                const IconComponent = achievement.icon;
                return (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
                    <IconComponent className={`w-6 h-6 ${achievement.color}`} />
                    <span className="text-sm font-medium text-gray-700">{achievement.label}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Badges conquistadas */}
            {userProgress.badges.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4">Medalhas Conquistadas</h4>
                <div className="flex justify-center space-x-4">
                  {userProgress.badges.map((badge, i) => (
                    <div key={i} className="relative group">
                      <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Award className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap bg-white px-2 py-1 rounded shadow">
                          {badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Próximos passos */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 mb-8">
            <h3 className="font-bold text-2xl text-gray-900 mb-4">Próximos Passos</h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 shadow-md">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Confirmação por E-mail</h4>
                <p className="text-sm text-gray-600">Você receberá os detalhes do seu plano em instantes</p>
              </div>
              <div>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 shadow-md">
                  <Video className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Entrevista Médica</h4>
                <p className="text-sm text-gray-600">
                  Agendada para {formData.interview?.date ? new Date(formData.interview.date).toLocaleDateString('pt-BR') : 'em breve'}
                </p>
              </div>
              <div>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 shadow-md">
                  <Heart className="w-6 h-6 text-red-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Carteirinha Digital</h4>
                <p className="text-sm text-gray-600">Disponível no app assim que aprovado</p>
              </div>
            </div>
          </div>

          {/* CTAs finais */}
          <div className="space-y-4">
            <button className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
              <Users className="w-5 h-5 inline mr-2" />
              Acessar Área do Beneficiário
            </button>
            
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
                📱 Baixar App AUSTA
              </button>
              <button className="px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
                🎁 Ver Benefícios do Plano
              </button>
            </div>
          </div>
          
          {/* Feedback */}
          <div className="mt-12 text-sm text-gray-600">
            <p className="mb-2">Como foi sua experiência?</p>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} className="text-2xl hover:scale-110 transition-transform">
                  ⭐
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Navegação entre steps
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome': return <WelcomeScreen />;
      case 'profile': return <ProfileForm />;
      case 'health': return <HealthQuestionnaire />;
      case 'documents': return <DocumentUpload />;
      case 'interview': return <InterviewScheduling />;
      case 'complete': return <CompletionScreen />;
      default: return <WelcomeScreen />;
    }
  };

  // Step indicators (para telas que não são welcome ou complete)
  const StepIndicators = () => {
    if (currentStep === 'welcome' || currentStep === 'complete') return null;
    
    const activeSteps = steps.slice(1, -1); // Remove welcome e complete
    
    return (
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {activeSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = userProgress.completedSteps.includes(step.id);
              const IconComponent = step.icon;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                    ${isCompleted 
                      ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
                      : isActive 
                      ? `bg-gradient-to-br ${step.color} text-white` 
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <IconComponent className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="hidden md:block ml-2">
                    <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.name}
                    </p>
                  </div>
                  
                  {index < activeSteps.length - 1 && (
                    <div className={`
                      w-8 md:w-16 h-0.5 mx-2 transition-all duration-300
                      ${userProgress.completedSteps.includes(activeSteps[index + 1].id) 
                        ? 'bg-green-500' 
                        : 'bg-gray-300'
                      }
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
      
      <NotificationStack />
      
      {currentStep === 'welcome' ? (
        <WelcomeScreen />
      ) : (
        <>
          <StepIndicators />
          {renderCurrentStep()}
        </>
      )}
    </>
  );
};

export default AUSTAOnboardingMVP;