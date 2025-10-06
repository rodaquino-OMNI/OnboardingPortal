/**
 * CompletionMessage - Pure presentation component
 *
 * ADR-003 Compliance:
 * ✅ NO network calls (fetch/axios)
 * ✅ NO storage (localStorage/sessionStorage/IndexedDB)
 * ✅ NO orchestration logic
 * ✅ ALL data via props
 * ✅ ALL interactions via callbacks
 *
 * @see docs/ARCHITECTURE_DECISIONS.md - ADR-003: Component Boundaries
 */

import React, { useEffect, useState } from 'react';

export interface CompletionMessageProps {
  /** User's name for personalization */
  userName: string;

  /** Points earned during onboarding */
  pointsEarned: number;

  /** Dashboard URL for navigation */
  dashboardUrl: string;

  /** Optional className for styling */
  className?: string;
}

/**
 * Simple confetti animation effect
 * Uses CSS animations, no external dependencies
 */
const ConfettiEffect: React.FC = () => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // Generate 30 random confetti particles
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100, // Random horizontal position (%)
      delay: Math.random() * 0.5, // Random delay (0-0.5s)
      duration: 2 + Math.random() * 1, // Random duration (2-3s)
    }));

    setParticles(newParticles);

    // Clean up after 3 seconds
    const timer = setTimeout(() => {
      setParticles([]);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="confetti-container" aria-hidden="true">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="confetti-particle"
          style={{
            left: `${particle.left}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            backgroundColor: [
              '#ff6b6b', // Red
              '#4ecdc4', // Teal
              '#45b7d1', // Blue
              '#f9ca24', // Yellow
              '#6c5ce7', // Purple
              '#a29bfe', // Light purple
            ][particle.id % 6],
          }}
        />
      ))}
    </div>
  );
};

export const CompletionMessage: React.FC<CompletionMessageProps> = ({
  userName,
  pointsEarned,
  dashboardUrl,
  className = '',
}) => {
  return (
    <div className={`completion-message ${className}`} role="status" aria-live="polite">
      <ConfettiEffect />

      <div className="completion-content">
        {/* Success Icon */}
        <div className="success-icon" aria-hidden="true">
          <svg
            viewBox="0 0 100 100"
            width="100"
            height="100"
            className="checkmark"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#4ecdc4"
              strokeWidth="4"
              className="checkmark-circle"
            />
            <path
              d="M30 50 L45 65 L70 35"
              fill="none"
              stroke="#4ecdc4"
              strokeWidth="4"
              strokeLinecap="round"
              className="checkmark-check"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="completion-title">
          Parabéns, {userName}!
        </h1>

        {/* Message */}
        <p className="completion-text">
          Você completou o processo de cadastro com sucesso!
        </p>

        {/* Points Earned */}
        <div className="points-badge">
          <div className="points-icon" aria-hidden="true">🎉</div>
          <div className="points-text">
            <span className="points-label">Você ganhou</span>
            <span className="points-value">{pointsEarned} pontos</span>
          </div>
        </div>

        {/* Benefits List */}
        <div className="benefits-list">
          <h2 className="benefits-title">Próximos passos:</h2>
          <ul>
            <li>
              <span className="benefit-icon" aria-hidden="true">✓</span>
              Acesse seu painel personalizado
            </li>
            <li>
              <span className="benefit-icon" aria-hidden="true">✓</span>
              Complete seu perfil de saúde para ganhar mais pontos
            </li>
            <li>
              <span className="benefit-icon" aria-hidden="true">✓</span>
              Faça upload de documentos quando necessário
            </li>
            <li>
              <span className="benefit-icon" aria-hidden="true">✓</span>
              Acompanhe seu progresso e conquistas
            </li>
          </ul>
        </div>

        {/* CTA Button */}
        <a
          href={dashboardUrl}
          className="btn btn-primary btn-large"
          role="button"
        >
          Ir para o Painel
        </a>

        {/* Additional Info */}
        <p className="completion-footer">
          Você receberá um email de confirmação em breve.
        </p>
      </div>

      {/* Inline styles for confetti animation */}
      <style>{`
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1000;
          overflow: hidden;
        }

        .confetti-particle {
          position: absolute;
          top: -10px;
          width: 10px;
          height: 10px;
          opacity: 0.8;
          animation: confetti-fall linear forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }

        .completion-message {
          position: relative;
          text-align: center;
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .completion-content {
          position: relative;
          z-index: 1;
        }

        .success-icon {
          margin: 0 auto 1.5rem;
          width: 100px;
          height: 100px;
        }

        .checkmark-circle {
          stroke-dasharray: 283;
          stroke-dashoffset: 283;
          animation: draw-circle 0.6s ease-out forwards;
        }

        .checkmark-check {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: draw-check 0.4s ease-out 0.6s forwards;
        }

        @keyframes draw-circle {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes draw-check {
          to {
            stroke-dashoffset: 0;
          }
        }

        .completion-title {
          font-size: 2rem;
          font-weight: bold;
          margin: 0 0 1rem;
          color: #2d3748;
        }

        .completion-text {
          font-size: 1.125rem;
          color: #4a5568;
          margin: 0 0 2rem;
        }

        .points-badge {
          display: inline-flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50px;
          margin: 0 0 2rem;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .points-icon {
          font-size: 2rem;
        }

        .points-text {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          color: white;
        }

        .points-label {
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .points-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .benefits-list {
          text-align: left;
          margin: 2rem 0;
        }

        .benefits-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0 0 1rem;
          color: #2d3748;
        }

        .benefits-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .benefits-list li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0;
          color: #4a5568;
          border-bottom: 1px solid #e2e8f0;
        }

        .benefits-list li:last-child {
          border-bottom: none;
        }

        .benefit-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #4ecdc4;
          color: white;
          border-radius: 50%;
          font-size: 0.875rem;
        }

        .btn {
          display: inline-block;
          padding: 0.75rem 2rem;
          font-size: 1rem;
          font-weight: 600;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }

        .btn-large {
          padding: 1rem 3rem;
          font-size: 1.125rem;
        }

        .completion-footer {
          margin-top: 2rem;
          font-size: 0.875rem;
          color: #718096;
        }

        /* Screen reader only */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .completion-title {
            font-size: 1.5rem;
          }

          .completion-text {
            font-size: 1rem;
          }

          .points-badge {
            padding: 0.75rem 1.5rem;
          }

          .points-value {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default CompletionMessage;
