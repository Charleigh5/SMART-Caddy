const UNSUPPORTED_CLAIMS_REGEX = [
  /\bexact carry\b/i,
  /\bclubhead speed\b/i,
  /\bball speed\b/i,
  /\bspin rate\b/i,
  /\blaunch angle\b/i,
  /\bapex height\b/i,
  /\bapex\b/i,
  /\bsmash factor\b/i,
  /\bofficial handicap\b/i,
  /\bconfirmed club distance\b/i,
];

export function checkTruthGuard(text: string): { blocked: boolean; blockedClaims: string[] } {
  const blockedClaims: string[] = [];
  let blocked = false;
  
  for (const regex of UNSUPPORTED_CLAIMS_REGEX) {
    if (regex.test(text)) {
      blocked = true;
      blockedClaims.push(regex.source.replace(/\\b/g, '').trim().toUpperCase());
    }
  }

  // Identity check placeholder
  if (/\bidentifying you as\b/i.test(text)) {
    blocked = true;
    blockedClaims.push('IDENTITY_FROM_CAMERA');
  }

  return { blocked, blockedClaims };
}
