import { describe, it, expect } from 'vitest';
import { checkTruthGuard } from './caddyTruthGuard';
import unsupportedFixture from './__fixtures__/unsupportedMetricClaims.json';

describe('Caddy Truth Guard', () => {
    it('PARSER-008 unsupported metrics move to blockedClaims', () => {
        const result = checkTruthGuard(unsupportedFixture.text);
        expect(result.blocked).toBe(true);
        expect(result.blockedClaims).toContain('SMASH FACTOR');
        expect(result.blockedClaims).toContain('EXACT CARRY');
    });

    it('blocks exact carry from phone video', () => {
        expect(checkTruthGuard('The exact carry is 200').blockedClaims).toContain('EXACT CARRY');
    });

    it('blocks clubhead speed from phone video', () => {
        expect(checkTruthGuard('Your clubhead speed is 100').blockedClaims).toContain('CLUBHEAD SPEED');
    });

    it('blocks ball speed from phone video', () => {
        expect(checkTruthGuard('Your ball speed is 100').blockedClaims).toContain('BALL SPEED');
    });

    it('blocks spin rate', () => {
        expect(checkTruthGuard('Spin rate is 2000').blockedClaims).toContain('SPIN RATE');
    });

    it('blocks launch angle', () => {
        expect(checkTruthGuard('launch angle is 10').blockedClaims).toContain('LAUNCH ANGLE');
    });

    it('blocks apex height', () => {
        expect(checkTruthGuard('Apex height is 100').blockedClaims).toContain('APEX HEIGHT');
    });

    it('blocks smash factor', () => {
        expect(checkTruthGuard('Smash factor of 1.5').blockedClaims).toContain('SMASH FACTOR');
    });

    it('blocks official handicap', () => {
        expect(checkTruthGuard('Your official handicap is 10').blockedClaims).toContain('OFFICIAL HANDICAP');
    });

    it('blocks confirmed club distance', () => {
        expect(checkTruthGuard('Confirmed club distance is 150').blockedClaims).toContain('CONFIRMED CLUB DISTANCE');
    });
    
    it('allows valid claims', () => {
        const result = checkTruthGuard('This looks like a solid swing. You should aim for the green.');
        expect(result.blocked).toBe(false);
        expect(result.blockedClaims.length).toBe(0);
    });
});
