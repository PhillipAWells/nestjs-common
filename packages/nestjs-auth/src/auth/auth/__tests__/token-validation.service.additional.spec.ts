import { TokenValidationService } from '../token-validation.service.js';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('TokenValidationService - Additional Tests', () => {
	let service: TokenValidationService;
	let mockModuleRef: any;
	let mockJwtService: any;

	beforeEach(() => {
		const jwtCalls: any[] = [];
		mockJwtService = {
			decode(token: string) {
				jwtCalls.push({ action: 'decode', token });
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api',
					type: 'access'
				};
			},
			verify(token: string) {
				jwtCalls.push({ action: 'verify', token });
				return true;
			},
			getJwtCalls() {
				return jwtCalls;
			}
		};

		mockModuleRef = {
			get(token: any) {
				if (token === JwtService) return mockJwtService;
				return null;
			}
		};

		service = new TokenValidationService(mockModuleRef);
	});

	describe('Token validation - happy path', () => {
		it('should validate a valid access token', () => {
			const token = 'valid-token-123';

			const result = service.validateToken(token, 'access');
			expect(result).toBeDefined();
			expect(result.sub).toBe('user-123');
		});

		it('should validate a valid refresh token', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 259200, // 3 days
					iss: 'nestjs-app',
					aud: 'nestjs-api',
					type: 'refresh'
				};
			};

			const token = 'valid-refresh-token';
			const result = service.validateToken(token, 'refresh');
			expect(result).toBeDefined();
			expect(result.type).toBe('refresh');
		});

		it('should return decoded token payload', () => {
			const token = 'test-token';

			const result = service.validateToken(token, 'access');
			expect(result.email).toBe('user@example.com');
			expect(result.sub).toBe('user-123');
		});
	});

	describe('Required claims validation', () => {
		it('should require sub claim', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					email: 'user@example.com',
					iat: now,
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token-no-sub', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should require email claim', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					iat: now,
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token-no-email', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should require iat claim', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token-no-iat', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should require exp claim', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now
				};
			};

			expect(() => {
				service.validateToken('token-no-exp', 'access');
			}).toThrow(UnauthorizedException);
		});
	});

	describe('Claim value validation', () => {
		it('should validate subject claim is non-empty string', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: '',
					email: 'user@example.com',
					iat: now,
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should validate email format', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'invalid-email',
					iat: now,
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should accept valid email formats', () => {
			const validEmails = [
				'user@example.com',
				'first.last@example.co.uk',
				'user+tag@example.org'
			];

			for (const email of validEmails) {
				mockJwtService.decode = () => {
					const now = Math.floor(Date.now() / 1000);
					return {
						sub: 'user-123',
						email,
						iat: now,
						exp: now + 900,
						iss: 'nestjs-app',
						aud: 'nestjs-api'
					};
				};

				const result = service.validateToken('token', 'access');
				expect(result.email).toBe(email);
			}
		});

		it('should validate iat is positive number', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: -1,
					exp: now + 900
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should validate exp is positive number', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: -1
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});
	});

	describe('Token type validation', () => {
		it('should validate access token type', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api',
					type: 'access'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result.type).toBe('access');
		});

		it('should reject refresh token when access expected', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api',
					type: 'refresh'
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should default token type to access', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
					// No type field
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();
		});
	});

	describe('Token age validation', () => {
		it('should accept fresh tokens', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();
		});

		it('should reject tokens older than 24 hours', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				const oneDayAgo = now - 86401; // 24 hours + 1 second
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: oneDayAgo,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});
	});

	describe('Issuer validation', () => {
		it('should accept default issuer', () => {
			delete process.env['JWT_ISSUER'];
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();
		});

		it('should accept custom issuer from environment', () => {
			process.env['JWT_ISSUER'] = 'custom-issuer';
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'custom-issuer',
					aud: 'nestjs-api'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();

			delete process.env['JWT_ISSUER'];
		});

		it('should reject mismatched issuer', () => {
			process.env['JWT_ISSUER'] = 'expected-issuer';
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'wrong-issuer',
					aud: 'nestjs-api'
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);

			delete process.env['JWT_ISSUER'];
		});
	});

	describe('Audience validation', () => {
		it('should accept default audience', () => {
			delete process.env['JWT_AUDIENCE'];
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();
		});

		it('should accept custom audience from environment', () => {
			process.env['JWT_AUDIENCE'] = 'custom-api';
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'custom-api'
				};
			};

			const result = service.validateToken('token', 'access');
			expect(result).toBeDefined();

			delete process.env['JWT_AUDIENCE'];
		});

		it('should reject mismatched audience', () => {
			process.env['JWT_AUDIENCE'] = 'expected-api';
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'user@example.com',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'wrong-api'
				};
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);

			delete process.env['JWT_AUDIENCE'];
		});
	});

	describe('Error handling', () => {
		it('should handle null decoded token', () => {
			mockJwtService.decode = () => null;

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should handle JWT decode errors', () => {
			mockJwtService.decode = () => {
				throw new Error('Malformed JWT');
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should handle JWT verify errors', () => {
			mockJwtService.verify = () => {
				throw new Error('Invalid signature');
			};

			expect(() => {
				service.validateToken('token', 'access');
			}).toThrow(UnauthorizedException);
		});

		it('should wrap errors in UnauthorizedException', () => {
			mockJwtService.decode = () => {
				throw new Error('Generic error');
			};

			try {
				service.validateToken('token', 'access');
			}
			catch (e) {
				expect(e instanceof UnauthorizedException).toBe(true);
			}
		});

		it('should preserve UnauthorizedException messages', () => {
			mockJwtService.decode = () => {
				const now = Math.floor(Date.now() / 1000);
				return {
					sub: 'user-123',
					email: 'invalid-email-format',
					iat: now,
					exp: now + 900,
					iss: 'nestjs-app',
					aud: 'nestjs-api'
				};
			};

			try {
				service.validateToken('token', 'access');
			}
			catch (e) {
				expect((e as any).message).toContain('Invalid email claim');
			}
		});
	});

	describe('Integration scenarios', () => {
		it('should validate complete authentication token flow', () => {
			const now = Math.floor(Date.now() / 1000);
			mockJwtService.decode = () => ({
				sub: 'user-123',
				email: 'user@example.com',
				iat: now,
				exp: now + 900,
				iss: 'nestjs-app',
				aud: 'nestjs-api',
				type: 'access'
			});

			const token = 'complete-token';
			const result = service.validateToken(token, 'access');

			expect(result.sub).toBe('user-123');
			expect(result.email).toBe('user@example.com');
			expect(result.type).toBe('access');
		});

		it('should handle multiple consecutive validations', () => {
			const tokens = ['token1', 'token2', 'token3'];

			const results = tokens.map(token =>
				service.validateToken(token, 'access')
			);

			results.forEach(result => {
				expect(result).toBeDefined();
				expect(result.sub).toBe('user-123');
			});
		});

		it('should properly separate access and refresh token validation', () => {
			const now = Math.floor(Date.now() / 1000);

			// Setup mock for access token
			mockJwtService.decode = () => ({
				sub: 'user-123',
				email: 'user@example.com',
				iat: now,
				exp: now + 900,
				iss: 'nestjs-app',
				aud: 'nestjs-api',
				type: 'access'
			});

			const accessResult = service.validateToken('access-token', 'access');
			expect(accessResult.type).toBe('access');

			// Setup mock for refresh token
			mockJwtService.decode = () => ({
				sub: 'user-123',
				email: 'user@example.com',
				iat: now,
				exp: now + 259200,
				iss: 'nestjs-app',
				aud: 'nestjs-api',
				type: 'refresh'
			});

			const refreshResult = service.validateToken('refresh-token', 'refresh');
			expect(refreshResult.type).toBe('refresh');
		});
	});
});
