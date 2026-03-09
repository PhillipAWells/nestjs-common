import {
	IsEmail,
	IsString,
	MinLength,
	MaxLength,
	Matches,
	ValidateIf
} from 'class-validator';

const MAX_EMAIL_LENGTH = 254;
const MIN_LOGIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_REGISTER_PASSWORD_LENGTH = 12;
const MAX_NAME_LENGTH = 100;
const MIN_TOKEN_LENGTH = 10;
const MAX_TOKEN_LENGTH = 4_096;

/**
 * Login input validation DTO
 * Validates email format, password requirements, and detects injection attempts
 */
export class LoginValidationInput {
	/**
	 * User email address
	 * Must be a valid email format
	 */
	@IsEmail({}, { message: 'Email must be a valid email address' })
	@MaxLength(MAX_EMAIL_LENGTH, { message: 'Email must not exceed 254 characters' })
	 
	public email!: string;

	/**
	 * User password
	 * Must be between 8 and 128 characters
	 */
	@IsString({ message: 'Password must be a string' })
	@MinLength(MIN_LOGIN_PASSWORD_LENGTH, { message: 'Password must be at least 8 characters long' })
	@MaxLength(MAX_PASSWORD_LENGTH, { message: 'Password must not exceed 128 characters' })
	// Reject common SQL injection patterns while allowing legitimate special characters
	@Matches(
		/^(?!.*['";\\-]{2,})[^'";\\]*$/,
		{
			message: 'Password contains invalid characters or patterns'
		}
	)
	 
	public password!: string;
}

/**
 * Register input validation DTO
 * Validates email, password strength, and optional name fields
 */
export class RegisterValidationInput {
	/**
	 * User email address
	 * Must be a valid email format
	 */
	@IsEmail({}, { message: 'Email must be a valid email address' })
	@MaxLength(MAX_EMAIL_LENGTH, { message: 'Email must not exceed 254 characters' })
	 
	public email!: string;

	/**
	 * User password
	 * Validates minimum length as per password-validator.service
	 */
	@IsString({ message: 'Password must be a string' })
	@MinLength(MIN_REGISTER_PASSWORD_LENGTH, { message: 'Password must be at least 12 characters long (enforce strong passwords)' })
	@MaxLength(MAX_PASSWORD_LENGTH, { message: 'Password must not exceed 128 characters' })
	 
	public password!: string;

	/**
	 * Optional first name
	 */
	@ValidateIf(o => o.firstName !== undefined && o.firstName !== null)
	@IsString({ message: 'First name must be a string' })
	@MaxLength(MAX_NAME_LENGTH, { message: 'First name must not exceed 100 characters' })
	public firstName?: string;

	/**
	 * Optional last name
	 */
	@ValidateIf(o => o.lastName !== undefined && o.lastName !== null)
	@IsString({ message: 'Last name must be a string' })
	@MaxLength(MAX_NAME_LENGTH, { message: 'Last name must not exceed 100 characters' })
	public lastName?: string;
}

/**
 * Refresh token input validation DTO
 * Validates refresh token format
 */
export class RefreshTokenValidationInput {
	/**
	 * JWT refresh token
	 * Must be a non-empty string
	 */
	@IsString({ message: 'Refresh token must be a string' })
	@MinLength(MIN_TOKEN_LENGTH, { message: 'Refresh token is invalid' })
	@MaxLength(MAX_TOKEN_LENGTH, { message: 'Refresh token exceeds maximum length' })
	 
	public refreshToken!: string;
}
