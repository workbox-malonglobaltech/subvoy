import { Link } from 'react-router-dom';
import { OnboardingStep, markRemindersAcknowledged } from '../hooks/useOnboarding';

interface Props {
  steps: OnboardingStep[];
  completedCount: number;
  progress: number;
  onDismiss: () => void;
  /** Called when user clicks the "Add subscription" step action */
  onAddSubscription: () => void;
}

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0" aria-hidden="true">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-300 shrink-0" aria-hidden="true" />
  );
}

export function OnboardingChecklist({
  steps,
  completedCount,
  progress,
  onDismiss,
  onAddSubscription,
}: Props) {
  const total = steps.length;

  function handleStepClick(step: OnboardingStep) {
    if (step.done) return;
    if (step.id === 'reminders') {
      markRemindersAcknowledged();
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Getting started
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {completedCount} of {total} steps complete
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Dismiss getting started guide"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% complete`}
          />
        </div>
      </div>

      {/* Steps */}
      <ul className="space-y-3" role="list">
        {steps.map(step => {
          const content = (
            <div className={`flex items-start gap-3 ${step.done ? 'opacity-60' : ''}`}>
              <StepIcon done={step.done} />
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${
                  step.done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900'
                }`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-fg-subtle mt-0.5 leading-snug">
                    {step.description}
                  </p>
                )}
              </div>
              {!step.done && (
                <svg className="w-4 h-4 text-gray-300 shrink-0 mt-0.5 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          );

          if (step.done) {
            return <li key={step.id}>{content}</li>;
          }

          if (step.action === 'openAddModal') {
            return (
              <li key={step.id}>
                <button
                  onClick={() => { handleStepClick(step); onAddSubscription(); }}
                  className="w-full text-left hover:bg-indigo-50 rounded-lg p-1.5 -mx-1.5 transition-colors group"
                >
                  {content}
                </button>
              </li>
            );
          }

          if (step.href) {
            return (
              <li key={step.id}>
                <Link
                  to={step.href}
                  onClick={() => handleStepClick(step)}
                  className="block hover:bg-indigo-50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                >
                  {content}
                </Link>
              </li>
            );
          }

          return <li key={step.id}>{content}</li>;
        })}
      </ul>
    </div>
  );
}
