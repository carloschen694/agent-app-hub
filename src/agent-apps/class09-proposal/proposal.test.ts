import { describe, it, expect } from 'vitest';
import { incrementVersion } from './services/storageService';

describe('class09-proposal version increment helper', () => {
  it('should correctly increment patch version', () => {
    expect(incrementVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(incrementVersion('0.2.5', 'patch')).toBe('0.2.6');
  });

  it('should correctly increment minor version', () => {
    expect(incrementVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(incrementVersion('0.2.5', 'minor')).toBe('0.3.0');
  });

  it('should correctly increment major version', () => {
    expect(incrementVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(incrementVersion('0.2.5', 'major')).toBe('1.0.0');
  });
});
