'use client';

function getStepClassName(status) {
  if (status === 'complete') {
    return 'onboarding-guide-step onboarding-guide-step-complete';
  }

  if (status === 'active') {
    return 'onboarding-guide-step onboarding-guide-step-active';
  }

  return 'onboarding-guide-step onboarding-guide-step-upcoming';
}

function getStatusLabel(status) {
  if (status === 'complete') {
    return 'Complete';
  }

  if (status === 'active') {
    return 'Current';
  }

  return 'Up next';
}

export function OnboardingGuide({
  eyebrow = 'Guided onboarding',
  title = '',
  intro = '',
  steps = [],
  currentStepId = '',
  footer = '',
}) {
  const activeStep =
    steps.find((step) => step.id === currentStepId) ||
    steps.find((step) => step.status === 'active') ||
    steps[0] ||
    null;

  const completedCount = steps.filter((step) => step.status === 'complete').length;

  return (
    <div className="onboarding-guide">
      <div className="onboarding-guide-header">
        <span className="label">{eyebrow}</span>
        <h2>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </div>

      <div className="onboarding-guide-summary">
        <strong>
          {completedCount}/{steps.length} steps complete
        </strong>
        {activeStep ? (
          <span>
            Current focus: <strong>{activeStep.title}</strong>
          </span>
        ) : null}
      </div>

      <div className="onboarding-guide-rail">
        {steps.map((step, index) => (
          <div key={step.id || step.title} className={getStepClassName(step.status)}>
            <div className="onboarding-guide-step-index">{index + 1}</div>
            <div className="onboarding-guide-step-copy">
              <div className="onboarding-guide-step-title-row">
                <strong>{step.title}</strong>
                <span className={`onboarding-guide-step-pill onboarding-guide-step-pill-${step.status}`}>
                  {getStatusLabel(step.status)}
                </span>
              </div>
              {step.detail ? <p>{step.detail}</p> : null}
            </div>
          </div>
        ))}
      </div>

      {activeStep ? (
        <div className="onboarding-guide-detail-card">
          <span className="label">Current step</span>
          <strong>{activeStep.title}</strong>
          {activeStep.detail ? <p>{activeStep.detail}</p> : null}
          {activeStep.helper ? <p className="onboarding-guide-helper">{activeStep.helper}</p> : null}
        </div>
      ) : null}

      {footer ? <p className="onboarding-guide-footer">{footer}</p> : null}
    </div>
  );
}
