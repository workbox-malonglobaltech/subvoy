import { useState } from 'react';
import { markWelcomeSeen } from '../hooks/useOnboarding';
import { Modal } from './ui/Modal';

interface Props {
  userName: string | null;
  onClose: () => void;
  onAddSubscription: () => void;
}

const SLIDES = [
  {
    icon: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-200 mx-auto">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
    ),
    heading: (name: string | null) => `Welcome${name ? `, ${name.split(' ')[0]}` : ''}! 👋`,
    body: 'Subvoy is your subscription hub. Every recurring charge — streaming, SaaS, utilities — tracked in one place, in both naira and dollars.',
  },
  {
    icon: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200 mx-auto">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
    ),
    heading: () => 'Never miss a renewal',
    body: 'We send you email reminders 7 days and 3 days before each subscription renews — so you always have time to cancel or top up.',
  },
  {
    icon: (
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 mx-auto">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </div>
    ),
    heading: () => 'Pay USD bills from your naira wallet',
    body: 'Fund a USD balance from your Nigerian bank account. Pay Netflix, Spotify, and more directly — no card declines, no FX surprises.',
  },
];

export function OnboardingModal({ userName, onClose, onAddSubscription }: Props) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;
  const current = SLIDES[slide];

  function handleClose() {
    markWelcomeSeen();
    onClose();
  }

  function handleNext() {
    if (isLast) {
      markWelcomeSeen();
      onAddSubscription();
    } else {
      setSlide(s => s + 1);
    }
  }

  return (
    <Modal open onClose={handleClose} title="Welcome to Subvoy" bare className="max-w-md rounded-3xl bg-surface shadow-modal">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((slide + 1) / SLIDES.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Slide icon */}
          <div className="mb-6">
            {current.icon}
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-1.5 mb-6" role="tablist" aria-label="Slide indicator">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === slide}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === slide
                    ? 'w-5 h-2 bg-indigo-500'
                    : 'w-2 h-2 bg-gray-200 hover:bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="text-center space-y-3 mb-8">
            <h2 id="onboarding-heading" className="text-2xl font-bold text-gray-900">
              {current.heading(userName)}
            </h2>
            <p className="text-gray-500 leading-relaxed">
              {current.body}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleNext}
              className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {isLast ? 'Add my first subscription →' : 'Next →'}
            </button>
            <button
              onClick={handleClose}
              className="w-full rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {isLast ? 'Skip for now' : 'Skip intro'}
            </button>
          </div>
        </div>
    </Modal>
  );
}
