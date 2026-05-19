import React from 'react';
import { LiveSessionStatus } from '../../live/liveSessionState';

interface Props {
  status: LiveSessionStatus;
}

export function LiveStatusBadge({ status }: Props) {
  let bgColor = 'bg-zinc-800';
  let textColor = 'text-zinc-400';
  let dotColor = 'bg-zinc-500';

  switch (status) {
    case 'CONNECTED':
    case 'LISTENING':
    case 'THINKING':
    case 'SPEAKING':
      bgColor = 'bg-emerald-900/50';
      textColor = 'text-emerald-400';
      dotColor = 'bg-emerald-500 animate-pulse';
      break;
    case 'CONNECTING':
    case 'REQUESTING_PERMISSION':
      bgColor = 'bg-blue-900/50';
      textColor = 'text-blue-400';
      dotColor = 'bg-blue-500 animate-bounce';
      break;
    case 'FAILED_FINAL':
    case 'FAILED_RETRYABLE':
      bgColor = 'bg-red-900/50';
      textColor = 'text-red-400';
      dotColor = 'bg-red-500';
      break;
    case 'DEGRADED_TEXT_ONLY':
      bgColor = 'bg-yellow-900/50';
      textColor = 'text-yellow-400';
      dotColor = 'bg-yellow-500';
      break;
  }

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-current ${bgColor} ${textColor} text-[10px] font-bold uppercase tracking-widest`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      {status.replace(/_/g, ' ')}
    </div>
  );
}
