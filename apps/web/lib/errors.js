function startCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatIssue(issue) {
  const fieldLabel = issue?.path?.length ? startCase(issue.path.join(' ')) : 'Field';

  if (!issue?.message) {
    return 'Something went wrong. Please review your information and try again.';
  }

  if (issue.message === 'String must contain at least 1 character(s)') {
    return `${fieldLabel} is required.`;
  }

  if (issue.message.includes('at least')) {
    return `${fieldLabel} ${issue.message.replace(/^String /, '').replace(/^Number /, '').replace(/^must /i, 'must ')}`;
  }

  return `${fieldLabel}: ${issue.message}`;
}

export function formatApiErrorMessage(rawMessage) {
  if (!rawMessage) {
    return 'Something went wrong. Please try again.';
  }

  if (typeof rawMessage !== 'string') {
    return 'Something went wrong. Please try again.';
  }

  const trimmed = rawMessage.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const issues = JSON.parse(trimmed);
      if (Array.isArray(issues) && issues.length > 0) {
        return formatIssue(issues[0]);
      }
    } catch {
      return rawMessage;
    }
  }

  return rawMessage;
}
