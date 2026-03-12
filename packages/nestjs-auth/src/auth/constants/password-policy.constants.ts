/**
 * Password Policy Constants
 *
 * Security constants for password validation and strength scoring.
 */

// Password length requirements
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

// Security scoring thresholds
export const PASSWORD_MIN_SCORE_FOR_VALID = 60; // Score must be >= 60 to be valid

// Password strength scoring points
export const PASSWORD_SCORE_LENGTH_LONG = 20; // +20 for reaching MIN_LENGTH
export const PASSWORD_SCORE_LENGTH_EXTRA = 10; // +10 for >= 16 characters
export const PASSWORD_SCORE_UPPERCASE = 15; // +15 for uppercase letter
export const PASSWORD_SCORE_LOWERCASE = 15; // +15 for lowercase letter
export const PASSWORD_SCORE_NUMBERS = 15; // +15 for digit
export const PASSWORD_SCORE_SPECIAL_CHARS = 15; // +15 for special character

// Password strength penalties
export const PASSWORD_PENALTY_COMMON_PATTERNS = 10; // -10 for common patterns
export const PASSWORD_PENALTY_SEQUENTIAL_CHARS = 5; // -5 for sequential characters
export const PASSWORD_PENALTY_REPEATED_CHARS = 5; // -5 for too many repeated characters

// Character validation thresholds
export const PASSWORD_MAX_REPEATED_COUNT = 3; // No character should repeat more than 3 times

/** Password length threshold for extra scoring bonus */
export const PASSWORD_SCORE_THRESHOLD_EXTRA_LENGTH = 16;

// Strength level thresholds (for determining strength classification)
export const PASSWORD_STRENGTH_THRESHOLD_WEAK = 20;
export const PASSWORD_STRENGTH_THRESHOLD_FAIR = 40;
export const PASSWORD_STRENGTH_THRESHOLD_GOOD = 60;
export const PASSWORD_STRENGTH_THRESHOLD_STRONG = 80;
