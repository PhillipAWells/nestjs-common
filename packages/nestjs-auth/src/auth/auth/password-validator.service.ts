import { Injectable, BadRequestException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import {
	PASSWORD_MIN_LENGTH,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_SCORE_FOR_VALID,
	PASSWORD_SCORE_LENGTH_LONG,
	PASSWORD_SCORE_LENGTH_EXTRA,
	PASSWORD_SCORE_UPPERCASE,
	PASSWORD_SCORE_LOWERCASE,
	PASSWORD_SCORE_NUMBERS,
	PASSWORD_SCORE_SPECIAL_CHARS,
	PASSWORD_PENALTY_COMMON_PATTERNS,
	PASSWORD_PENALTY_SEQUENTIAL_CHARS,
	PASSWORD_PENALTY_REPEATED_CHARS,
	PASSWORD_MAX_REPEATED_COUNT,
	PASSWORD_STRENGTH_THRESHOLD_WEAK,
	PASSWORD_STRENGTH_THRESHOLD_FAIR,
	PASSWORD_STRENGTH_THRESHOLD_GOOD,
	PASSWORD_STRENGTH_THRESHOLD_STRONG,
	PASSWORD_SCORE_THRESHOLD_EXTRA_LENGTH,
} from '../constants/password-policy.constants.js';

export interface PasswordStrengthResult {
	isValid: boolean;
	score: number; // 0-100
	feedback: string[];
	strength: 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
}

@Injectable()
export class PasswordValidatorService implements LazyModuleRefService {
	constructor(public readonly moduleRef: ModuleRef) {}

	/**
   * Validate password strength
   */
	public validatePassword(password: string): PasswordStrengthResult {
		const result: PasswordStrengthResult = {
			isValid: false,
			score: 0,
			feedback: [],
			strength: 'weak',
		};

		// Check minimum length
		if (password.length < PASSWORD_MIN_LENGTH) {
			result.feedback.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
		} else {
			result.score += PASSWORD_SCORE_LENGTH_LONG;
		}

		// Check maximum length
		if (password.length > PASSWORD_MAX_LENGTH) {
			result.feedback.push(`Password must not exceed ${PASSWORD_MAX_LENGTH} characters`);
		} else if (password.length >= PASSWORD_SCORE_THRESHOLD_EXTRA_LENGTH) {
			result.score += PASSWORD_SCORE_LENGTH_EXTRA;
		}

		// Check for uppercase letters
		if (!/[A-Z]/.test(password)) {
			result.feedback.push('Password must contain at least one uppercase letter');
		} else {
			result.score += PASSWORD_SCORE_UPPERCASE;
		}

		// Check for lowercase letters
		if (!/[a-z]/.test(password)) {
			result.feedback.push('Password must contain at least one lowercase letter');
		} else {
			result.score += PASSWORD_SCORE_LOWERCASE;
		}

		// Check for numbers
		if (!/\d/.test(password)) {
			result.feedback.push('Password must contain at least one number');
		} else {
			result.score += PASSWORD_SCORE_NUMBERS;
		}

		// Check for special characters
		if (!/[!@#$%^&*()_+\-=[]{};':"\\|,.<>?`]/.test(password)) {
			result.feedback.push('Password must contain at least one special character');
		} else {
			result.score += PASSWORD_SCORE_SPECIAL_CHARS;
		}

		// Check for common patterns
		if (this.hasCommonPatterns(password)) {
			result.feedback.push('Password contains common patterns (e.g., "123", "abc")');
			result.score -= PASSWORD_PENALTY_COMMON_PATTERNS;
		}

		// Check for sequential characters
		if (this.hasSequentialCharacters(password)) {
			result.feedback.push('Password contains sequential characters');
			result.score -= PASSWORD_PENALTY_SEQUENTIAL_CHARS;
		}

		// Check for repeated characters
		if (this.hasRepeatedCharacters(password)) {
			result.feedback.push('Password contains too many repeated characters');
			result.score -= PASSWORD_PENALTY_REPEATED_CHARS;
		}

		// Determine strength
		result.strength = this.getStrength(result.score);
		result.isValid = result.score >= PASSWORD_MIN_SCORE_FOR_VALID;

		return result;
	}

	/**
   * Validate password and throw if invalid
   */
	public validatePasswordOrThrow(password: string): void {
		const result = this.validatePassword(password);

		if (!result.isValid) {
			throw new BadRequestException({
				message: 'Password does not meet strength requirements',
				feedback: result.feedback,
				strength: result.strength,
				score: result.score,
			});
		}
	}

	/**
   * Check for common patterns
   */
	private hasCommonPatterns(password: string): boolean {
		const commonPatterns = [
			'123', '234', '345', '456', '567', '678', '789', '890',
			'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
			'password', 'admin', 'user', 'test', 'demo', 'qwerty',
		];

		const lowerPassword = password.toLowerCase();
		return commonPatterns.some(pattern => lowerPassword.includes(pattern));
	}

	/**
   * Check for sequential characters
   */
	private hasSequentialCharacters(password: string): boolean {
		for (let i = 0; i < password.length - 2; i++) {
			const charCode = password.charCodeAt(i);
			const nextCode = password.charCodeAt(i + 1);
			const nextNextCode = password.charCodeAt(i + 2);

			if (nextCode === charCode + 1 && nextNextCode === charCode + 2) {
				return true;
			}
		}

		return false;
	}

	/**
   * Check for repeated characters
   */
	private hasRepeatedCharacters(password: string): boolean {
		const charCounts: Record<string, number> = {};

		for (const char of password) {
			charCounts[char] = (charCounts[char] ?? 0) + 1;
		}

		// If any character appears more than PASSWORD_MAX_REPEATED_COUNT times, it's too many
		return Object.values(charCounts).some(count => count > PASSWORD_MAX_REPEATED_COUNT);
	}

	/**
   * Get password strength
   */
	private getStrength(score: number): 'weak' | 'fair' | 'good' | 'strong' | 'very-strong' {
		if (score < PASSWORD_STRENGTH_THRESHOLD_WEAK) return 'weak';
		if (score < PASSWORD_STRENGTH_THRESHOLD_FAIR) return 'fair';
		if (score < PASSWORD_STRENGTH_THRESHOLD_GOOD) return 'good';
		if (score < PASSWORD_STRENGTH_THRESHOLD_STRONG) return 'strong';
		return 'very-strong';
	}
}
