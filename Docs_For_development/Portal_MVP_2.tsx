

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronLeft, Upload, Camera, CheckCircle, 
  Star, Trophy, Heart, Shield, FileText, Video, 
  Users, Target, Zap, Gift, Award, Play, User,
  Phone, Mail, MapPin, Calendar, Clock
} from 'lucide-react';

const AUSTAOnboardingPlatform = () => {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userProgress, setUserProgress] = useState({
    level: 1,
    points: 0,
    completedSteps: [],
    badges: [],
    streak: 0
  });
  const [formData, setFormData] = useState({});
  const [showNotification, setShowNotification] = useState(false);

  // Simular notificações de gamificação
  const showAchievement = (message) => {
    setShowNotification(message);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const addPoints = (points) => {
    setUserProgress(prev => ({
      ...prev,
      points: prev.points + points
    }));
    showAchievement(`+${points} pontos! 🎉`);
  };

  const completeStep = (step) => {
    setUserProgress(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, step]
    }));
    addPoints(100);
  };

  const steps = [
    { id: 'welcome', name: 'Bem-vindo', icon: Heart, color: 'bg-purple-500' },
    { id: 'profile', name: 'Perfil', icon: User, color: 'bg-blue-500' },
    { id: 'health', name: 'Saúde', icon: Heart, color: 'bg-red-500' },
    { id: 'documents', name: 'Documentos', icon: FileText, color: 'bg-green-500' },
    { id: 'interview', name: 'Entrevista', icon: Video, color: 'bg-orange-500' },
    { id: 'complete', name: 'Finalizar', icon: Trophy, color: 'bg-yellow-500' }
  ];

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  const progressPercentage = (getCurrentStepIndex() / (steps.length - 1)) * 100;

  // Componente de Notificação Gamificada
  const NotificationToast = ({ message }) => (
    <div className="fixed top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300">
      <div className="flex items-center space-x-2">
        <Star className="w-5 h-5" />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );

  // Header com Gamificação
  const GameHeader = () => (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AUSTA Saúde</h1>
              <p className="text-blue-100 text-sm">Seu plano, sua jornada</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-sm">Nível {userProgress.level}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4" />
              <span className="text-sm">{userProgress.points} pontos</span>
            </div>
          </div>
        </div>
        
        {/* Barra de Progresso */}
        <div className="relative">
          <div className="w-full bg-white/20 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-blue-100">
            <span>Início</span>
            <span>{Math.round(progressPercentage)}% completo</span>
            <span>Finalização</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Tela de Boas-vindas
  const WelcomeScreen = () => (
    <div className="max-w-2xl mx-auto text-center p-6">
      <div className="mb-8">
        <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center">
          <Heart className="w-16 h-16 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Bem-vindo à sua jornada de saúde! 🌟
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed">
          Vamos tornar seu cadastro uma experiência incrível. Em poucos minutos, 
          você terá acesso ao melhor plano de saúde do Brasil.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-xl">
          <Zap className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">Rápido</h3>
          <p className="text-gray-600 text-sm">Apenas 5-10 minutos para completar</p>
        </div>
        <div className="bg-green-50 p-6 rounded-xl">
          <Shield className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">Seguro</h3>
          <p className="text-gray-600 text-sm">Seus dados protegidos por criptografia</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-xl">
          <Gift className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-800 mb-2">Recompensas</h3>
          <p className="text-gray-600 text-sm">Ganhe pontos e conquiste benefícios</p>
        </div>
      </div>

      <button 
        onClick={() => setCurrentStep('profile')}
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
      >
        Começar Jornada
        <ChevronRight className="w-5 h-5 inline ml-2" />
      </button>
    </div>
  );

  // Formulário de Perfil
  const ProfileForm = () => {
    const [profileData, setProfileData] = useState({
      nome: '',
      email: '',
      telefone: '',
      nascimento: '',
      endereco: ''
    });

    const handleSubmit = () => {
      if (profileData.nome && profileData.email && profileData.telefone && profileData.nascimento) {
        setFormData({ ...formData, profile: profileData });
        completeStep('profile');
        setCurrentStep('health');
      }
    };

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Vamos nos conhecer melhor</h2>
          <p className="text-gray-600">Conte-nos um pouco sobre você para personalizar sua experiência</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome completo *
            </label>
            <input
              type="text"
              value={profileData.nome}
              onChange={(e) => setProfileData({ ...profileData, nome: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Seu nome completo"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail *
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone *
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  type="tel"
                  value={profileData.telefone}
                  onChange={(e) => setProfileData({ ...profileData, telefone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data de nascimento *
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="date"
                value={profileData.nascimento}
                onChange={(e) => setProfileData({ ...profileData, nascimento: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endereço
            </label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={profileData.endereco}
                onChange={(e) => setProfileData({ ...profileData, endereco: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentStep('welcome')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 inline mr-2" />
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              Continuar
              <ChevronRight className="w-5 h-5 inline ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Questionário de Saúde Gamificado
  const HealthQuestionnaire = () => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});

    const questions = [
      {
        id: 'geral',
        title: 'Como você avalia sua saúde geral?',
        type: 'scale',
        options: [
          { value: 5, label: 'Excelente', emoji: '🌟' },
          { value: 4, label: 'Muito boa', emoji: '😊' },
          { value: 3, label: 'Boa', emoji: '🙂' },
          { value: 2, label: 'Regular', emoji: '😐' },
          { value: 1, label: 'Ruim', emoji: '😟' }
        ]
      },
      {
        id: 'exercicio',
        title: 'Com que frequência você pratica exercícios?',
        type: 'multiple',
        options: [
          { value: 'diario', label: 'Diariamente', emoji: '🏃‍♂️' },
          { value: 'semanal', label: '3-5x por semana', emoji: '💪' },
          { value: 'ocasional', label: 'Ocasionalmente', emoji: '🚶‍♀️' },
          { value: 'nunca', label: 'Raramente/Nunca', emoji: '🛋️' }
        ]
      },
      {
        id: 'historico',
        title: 'Você tem alguma condição médica?',
        type: 'checkbox',
        options: [
          { value: 'diabetes', label: 'Diabetes' },
          { value: 'hipertensao', label: 'Hipertensão' },
          { value: 'cardiaco', label: 'Problemas cardíacos' },
          { value: 'respiratorio', label: 'Problemas respiratórios' },
          { value: 'nenhum', label: 'Nenhuma condição' }
        ]
      }
    ];

    const handleAnswer = (questionId, value) => {
      setAnswers({ ...answers, [questionId]: value });
      addPoints(50);
      
      if (currentQuestion < questions.length - 1) {
        setTimeout(() => setCurrentQuestion(currentQuestion + 1), 500);
      } else {
        setTimeout(() => {
          completeStep('health');
          setCurrentStep('documents');
        }, 1000);
      }
    };

    const question = questions[currentQuestion];

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Avaliação de Saúde</h2>
          <p className="text-gray-600">Questão {currentQuestion + 1} de {questions.length}</p>
          
          {/* Progress bar para questões */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
            <div 
              className="bg-gradient-to-r from-red-400 to-pink-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            {question.title}
          </h3>

          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(question.id, option.value)}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 flex items-center space-x-3"
              >
                {option.emoji && <span className="text-2xl">{option.emoji}</span>}
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => currentQuestion > 0 ? setCurrentQuestion(currentQuestion - 1) : setCurrentStep('profile')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 inline mr-2" />
            Voltar
          </button>
          <span className="text-sm text-gray-500 self-center">
            +50 pontos por resposta!
          </span>
        </div>
      </div>
    );
  };

  // Upload de Documentos Gamificado
  const DocumentUpload = () => {
    const [uploadedDocs, setUploadedDocs] = useState([]);
    
    const requiredDocs = [
      { id: 'rg', name: 'RG ou CNH', icon: FileText, points: 100 },
      { id: 'cpf', name: 'CPF', icon: FileText, points: 100 },
      { id: 'comprovante', name: 'Comprovante de Residência', icon: FileText, points: 100 },
      { id: 'foto', name: 'Foto 3x4', icon: Camera, points: 100 }
    ];

    const handleUpload = (docId) => {
      if (!uploadedDocs.includes(docId)) {
        setUploadedDocs([...uploadedDocs, docId]);
        const doc = requiredDocs.find(d => d.id === docId);
        addPoints(doc.points);
      }
    };

    const canContinue = uploadedDocs.length === requiredDocs.length;

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Documentos Necessários</h2>
          <p className="text-gray-600">Envie seus documentos de forma rápida e segura</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Seus documentos são criptografados e protegidos</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {requiredDocs.map((doc) => {
            const isUploaded = uploadedDocs.includes(doc.id);
            const IconComponent = doc.icon;
            
            return (
              <div 
                key={doc.id}
                className={`border-2 border-dashed rounded-xl p-6 transition-all duration-300 ${
                  isUploaded 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      isUploaded ? 'bg-green-500' : 'bg-gray-400'
                    }`}>
                      {isUploaded ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <IconComponent className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{doc.name}</h3>
                      <p className="text-sm text-gray-600">
                        {isUploaded ? 'Documento enviado!' : 'Clique para enviar'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="flex items-center space-x-1 text-yellow-600">
                        <Star className="w-4 h-4" />
                        <span className="text-sm font-medium">+{doc.points}</span>
                      </div>
                    </div>
                    
                    {!isUploaded && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpload(doc.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload</span>
                        </button>
                        <button
                          onClick={() => handleUpload(doc.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Foto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex space-x-4 mt-8">
          <button
            onClick={() => setCurrentStep('health')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 inline mr-2" />
            Voltar
          </button>
          <button
            onClick={() => {
              completeStep('documents');
              setCurrentStep('interview');
            }}
            disabled={!canContinue}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              canContinue
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continuar
            <ChevronRight className="w-5 h-5 inline ml-2" />
          </button>
        </div>
      </div>
    );
  };

  // Agendamento de Entrevista
  const InterviewScheduling = () => {
    const [selectedSlot, setSelectedSlot] = useState(null);
    
    const timeSlots = [
      { id: 1, time: '09:00', doctor: 'Dr. Silva', available: true },
      { id: 2, time: '10:30', doctor: 'Dra. Santos', available: true },
      { id: 3, time: '14:00', doctor: 'Dr. Oliveira', available: false },
      { id: 4, time: '15:30', doctor: 'Dra. Costa', available: true },
      { id: 5, time: '16:45', doctor: 'Dr. Pereira', available: true }
    ];

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Entrevista Médica</h2>
          <p className="text-gray-600">Agende sua videochamada com nossos especialistas</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Horários disponíveis para hoje</h3>
          
          <div className="space-y-3">
            {timeSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => slot.available && setSelectedSlot(slot)}
                disabled={!slot.available}
                className={`w-full p-4 text-left border rounded-lg transition-all duration-200 ${
                  selectedSlot?.id === slot.id
                    ? 'border-orange-500 bg-orange-50'
                    : slot.available
                    ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                    : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-medium">{slot.time}</div>
                      <div className="text-sm text-gray-600">{slot.doctor}</div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    slot.available 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {slot.available ? 'Disponível' : 'Ocupado'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedSlot && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 text-blue-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">
                Entrevista agendada para {selectedSlot.time} com {selectedSlot.doctor}
              </span>
            </div>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={() => setCurrentStep('documents')}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 inline mr-2" />
            Voltar
          </button>
          <button
            onClick={() => {
              if (selectedSlot) {
                completeStep('interview');
                addPoints(200);
                setCurrentStep('complete');
              }
            }}
            disabled={!selectedSlot}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              selectedSlot
                ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Confirmar Agendamento
            <ChevronRight className="w-5 h-5 inline ml-2" />
          </button>
        </div>
      </div>
    );
  };

  // Tela de Conclusão
  const CompletionScreen = () => (
    <div className="max-w-2xl mx-auto text-center p-6">
      <div className="mb-8">
        <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse">
          <Trophy className="w-16 h-16 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          Parabéns! 🎉
        </h2>
        <p className="text-gray-600 text-lg leading-relaxed mb-6">
          Você completou seu cadastro com sucesso! Sua jornada de saúde começa agora.
        </p>
        
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Suas conquistas:</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <span>Nível {userProgress.level} alcançado</span>
            </div>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span>{userProgress.points} pontos ganhos</span>
            </div>
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-green-500" />
              <span>100% do cadastro completo</span>
            </div>
            <div className="flex items-center space-x-2">
              <Gift className="w-5 h-5 text-purple-500" />
              <span>Benefícios desbloqueados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
          Acessar Minha Área
        </button>
        <button className="w-full border border-blue-300 text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
          Baixar Aplicativo Móvel
        </button>
      </div>
    </div>
  );

  // Renderização principal baseada no step atual
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Notificação de Gamificação */}
      {showNotification && <NotificationToast message={showNotification} />}
      
      {/* Header */}
      <GameHeader />
      
      {/* Navegação por Steps */}
      {currentStep !== 'welcome' && currentStep !== 'complete' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            {steps.slice(1, -1).map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = userProgress.completedSteps.includes(step.id);
              const IconComponent = step.icon;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isActive 
                      ? step.color + ' text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <IconComponent className="w-5 h-5" />
                    )}
                  </div>
                  {index < steps.slice(1, -1).length - 1 && (
                    <div className={`w-12 h-1 mx-2 ${
                      userProgress.completedSteps.includes(steps[index + 2].id) 
                        ? 'bg-green-500' 
                        : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Conteúdo Principal */}
      <div className="pb-8">
        {renderCurrentStep()}
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-600">
          <p className="text-sm">
            © 2024 AUSTA Saúde - Sua jornada de saúde, nossa prioridade
          </p>
          <div className="flex justify-center space-x-6 mt-2 text-xs">
            <a href="#" className="hover:text-blue-600">Política de Privacidade</a>
            <a href="#" className="hover:text-blue-600">Termos de Uso</a>
            <a href="#" className="hover:text-blue-600">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AUSTAOnboardingPlatform;