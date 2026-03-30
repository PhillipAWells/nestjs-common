# TypeScript Style Guide

A self-contained reference for TypeScript conventions across NestJS backends, React frontends, and shared packages. Rules marked **error** are enforced by the linter and will fail CI. Rules marked **warn** are strongly encouraged and reported as warnings. Unmarked rules are conventions without automated enforcement.

---

## Table of Contents

1. [Formatting](#formatting)
2. [Naming Conventions](#naming-conventions)
3. [TypeScript Rules](#typescript-rules)
4. [Async and Promises](#async-and-promises)
5. [Imports and Exports](#imports-and-exports)
6. [NestJS Conventions](#nestjs-conventions)
7. [GraphQL Conventions](#graphql-conventions)
8. [React Conventions](#react-conventions)
9. [Interface vs Type](#interface-vs-type)
10. [Generics](#generics)
11. [Discriminated Unions](#discriminated-unions)
12. [Error Classes and Assertion Infrastructure](#error-classes-and-assertion-infrastructure)
13. [Test Files](#test-files)
14. [Quick Reference](#quick-reference)

---

## Formatting

| Rule | Value | Enforcement |
|---|---|---|
| Indentation | Tabs | error |
| Quotes | Single | error |
| Semicolons | Required | error |
| Trailing commas | Always on multiline | error |
| Brace style | 1TBS (opening brace same line) | error |
| Object curly spacing | `{ spaced: 'always' }` | error |
| Array bracket spacing | None — `[0, 1, 2]` | error |
| Space before function paren | None for named/anonymous; required for async arrow | error |
| Blank lines within code | Max 1 | error |
| Blank lines at EOF | 0 | error |
| Max line length | Not enforced | — |

```typescript
// Correct
const config = { host: 'localhost', port: 3000 };
const ids = [1, 2, 3];

function process(input: string): void {
	doSomething(input);
}

const handler = async () => {
	await doSomething();
};

// Wrong — double quotes, no trailing comma, space before paren
function process (input: string) {
	return {
		value: "hello"
	}
}
```

---

## Naming Conventions

### Principle: We Control vs. They Control

These conventions apply to **code we own and implement**. When interfacing with systems or contracts we do not control, match the external convention instead.

| Situation | Rule |
|---|---|
| Our classes, services, functions, types | Apply all conventions in this guide |
| External API request/response shapes | Match the wire format — do not rename properties |
| Database column mappings | Match the schema — do not rename to satisfy naming rules |
| Third-party library interfaces being implemented | Match the interface — do not rename methods |
| Framework lifecycle methods (NestJS, React, etc.) | Match the framework — do not rename |

**Examples of valid convention breaks:**

```typescript
// External REST API returns snake_case — match it in the DTO
interface IStripeWebhookEvent {
	event_type: string;
	created_at: string;
	data: { object: Record<string, unknown> };
}

// Database column is userId (camelCase from ORM) — match it
interface IUserRow {
	userId: string;
	created_at: string; // DB column name
}

// NestJS-mandated lifecycle method — camelCase, not our choice
class MyService implements OnModuleInit {
	public onModuleInit(): void { ... }
}
```

When mapping between an external contract and internal code, do the conversion at the boundary (e.g. in a mapper/transformer service) and use our conventions on the internal side.

### General Rules

| Construct | Format | Notes |
|---|---|---|
| Class | PascalCase | |
| Interface | `I` + PascalCase | e.g. `IUserService`, `IRepository` |
| Type alias | `T` + PascalCase | e.g. `TUser`, `TCreatePostInput` |
| Enum | PascalCase | |
| Enum member | `UPPER_CASE` or PascalCase | |
| Type parameter (generic) | PascalCase, starts with uppercase | See [Generics](#generics) |
| Function | PascalCase | e.g. `ParseLogLevel`, `CreateUser` |
| Variable | PascalCase | |
| Parameter | camelCase only | Leading underscore allowed to suppress unused warning |
| Class property | PascalCase | Private properties backing a public getter may use `_` prefix |
| Class method | PascalCase | Leading underscore allowed |
| Constant (public static or exported) | `UPPER_SNAKE_CASE` | e.g. `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` |
| Constant (local / private scope) | PascalCase | e.g. `ParsedResult`, `RetryCount` |
| Destructured variable | No restriction | |
| Type property | No restriction | |
| File name (NestJS/Node) | kebab-case | e.g. `logger.service.ts`, `jwt-auth.guard.ts` |
| File name (React component) | PascalCase `.tsx` | e.g. `UserCard.tsx` |
| File name (React non-component) | kebab-case `.ts` | e.g. `use-auth.ts` |

### Private Backing Properties

A private property may use a leading underscore **only** when it backs a public getter. This makes the getter/backing-property pair visually obvious.

```typescript
class Circle {
	private _Radius: number;

	constructor(radius: number) {
		this._Radius = radius;
	}

	public get Radius(): number {
		return this._Radius;
	}

	public set Radius(value: number) {
		if (value < 0) throw new RangeError('Radius must be non-negative');
		this._Radius = value;
	}
}
```

Private properties that do not back a getter use PascalCase without a leading underscore.

### Constants

Use `UPPER_SNAKE_CASE` for constants that form part of the public API or are shared across modules. Use PascalCase for constants that are local to a function or private to a class.

```typescript
// Exported module-level constant — UPPER_SNAKE_CASE
export const MAX_RETRIES = 3;
export const DEFAULT_TIMEOUT_MS = 5000;

// Public static class constant — UPPER_SNAKE_CASE
class RateLimiter {
	public static readonly MAX_REQUESTS_PER_WINDOW = 100;
	public static readonly WINDOW_DURATION_MS = 60_000;
}

// Local / private constant — PascalCase
function ParseConfig(raw: unknown): TConfig {
	const DefaultPort = 3000;
	const AllowedOrigins = ['https://example.com'];
	// ...
}

// Private class constant — PascalCase
class TokenValidator {
	private static readonly ClockSkewMs = 5000;
}
```

### Scope Prefixing

> **Guideline (unenforced):** Prefix exported names with their package or domain context to prevent collisions across packages and avoid consumers needing `import * as …` workarounds.

A generic name like `Library`, `Client`, or `Config` is likely to exist in multiple packages. When a consumer imports from several packages simultaneously, names collide and disambiguation becomes the consumer's problem. Prefixing at the source eliminates this.

```typescript
// ✗ Avoid — generic names that will collide
export class Library { ... }
export class Client { ... }
export interface IConfig { ... }

// ✓ Prefer — scoped names that are unambiguous at the import site
export class MediaLibrary { ... }
export class MediaClient { ... }
export interface IMediaConfig { ... }
```

Apply this to all exported symbols: classes, interfaces, type aliases, enums, constants, and functions.

```typescript
// Package: auth
export class AuthGuard { ... }
export class AuthService { ... }
export interface IAuthConfig { ... }
export type TAuthToken = string;
export const AUTH_MODULE_OPTIONS = Symbol('AUTH_MODULE_OPTIONS');
export function CreateAuthToken(payload: TAuthPayload): TAuthToken { ... }

// Package: media
export class MediaLibrary { ... }
export class MediaUploadService { ... }
export interface IMediaConfig { ... }
export const MEDIA_MODULE_OPTIONS = Symbol('MEDIA_MODULE_OPTIONS');
export function CreateMediaUploadUrl(fileId: string): string { ... }
```

**When not to prefix:** Internal symbols (not exported from the package barrel) do not need a scope prefix — they are already scoped by the module boundary.

This pairs naturally with namespace exports — a scoped name like `MediaLibrary` becomes `Media.Library` under a namespace alias. See [Namespace Exports](#namespace-exports).

### Specific Prohibitions

- No constructor parameter shorthand (`public readonly foo: Bar`) in production code. Test files are exempt from this rule entirely.

---

## TypeScript Rules

### Access Modifiers

All class members must have an explicit access modifier (`public`, `private`, or `protected`) — **except constructors**. (warn)

```typescript
// Correct
class UserService {
	private readonly Users: TUser[] = [];
	private readonly Db: IDatabase;

	constructor(db: IDatabase) {
		this.Db = db;
	}

	public async FindById(id: string): Promise<TUser | null> {
		return this.Db.Find(id);
	}
}

// Wrong — missing access modifier on property and method
class UserService {
	Users: TUser[] = [];

	async FindById(id: string): Promise<TUser | null> { ... }
}
```

### Prefer Readonly

Class properties that are never reassigned after construction should be declared `readonly`. (warn)

```typescript
// Correct — never reassigned, so readonly
class TokenValidator {
	private readonly Secret: string;
	private readonly ExpiryMs: number;

	constructor(secret: string, expiryMs: number) {
		this.Secret = secret;
		this.ExpiryMs = expiryMs;
	}
}

// Wrong — should be readonly
class TokenValidator {
	private Secret: string;
}
```

This applies to both `public` and `private` properties. The linter enforces this as a warning.

### Return Types

Explicit return types are required on all exported functions and strongly encouraged everywhere else. (warn)

```typescript
// Correct
export async function CreateUser(dto: TCreateUserDto): Promise<TUser> { ... }

// Wrong — missing return type
export async function CreateUser(dto: TCreateUserDto) { ... }
```

### Strict Equality

Always use `===`. Using `==` is an error.

### Null Safety

Prefer optional chaining (`?.`) and nullish coalescing (`??`) over manual null checks. (warn)

```typescript
// Correct
const name = user?.profile?.displayName ?? 'Anonymous';

// Avoid
const name = user && user.profile && user.profile.displayName ? user.profile.displayName : 'Anonymous';
```

### Non-Null Assertions

Avoid non-null assertions (`!`). They suppress errors without resolving them. (warn)

```typescript
// Avoid
const value = map.get(key)!;

// Better
const value = map.get(key);
if (!value) throw new Error(`Key not found: ${key}`);
```

### `any`

`any` is not a lint error in this codebase, but treat it as a last resort. Prefer `unknown` when the type is genuinely unknown, and narrow it before use.

### Throw Literals

Always throw `Error` instances. Throwing strings or other literals is an error.

```typescript
// Correct
throw new Error('User not found');

// Wrong — lint error
throw 'User not found';
```

### Prefer `const`

Declare variables with `const` by default. Use `let` only when reassignment is required. `var` is prohibited.

### Object Shorthand

Use property shorthand and method shorthand in object literals. (warn)

```typescript
// Correct
const obj = { name, value, process() { ... } };

// Avoid
const obj = { name: name, value: value, process: function() { ... } };
```

### Magic Numbers

Avoid unexplained numeric literals. Assign them to a named constant. Values `0`, `1`, `-1`, and `2` are exempt, as are array index expressions. (warn)

```typescript
// Exported or public static — UPPER_SNAKE_CASE
export const MAX_RETRIES = 3;

// Local to a function — PascalCase
function Connect(url: string): void {
	const MaxRetries = 3;
	if (retries > MaxRetries) { ... }
}
```

### Unused Variables

Prefix unused variables with `_` to suppress the lint warning.

```typescript
catch (_err) {
	return null;
}
```

Note: `_err` in a `catch` clause is a **parameter** (camelCase with `_` prefix), not a variable. The PascalCase convention applies to variables declared with `const`/`let`/`var`. Parameters always use camelCase per the parameter naming rule — the leading `_` is the suppression prefix for unused ones.

---

## Async and Promises

### `return await`

`return await` is **correct and required** inside `async` functions. (error)

It ensures that errors thrown by the awaited expression are caught by the enclosing `try/catch`. Without it, the Promise escapes the function's error boundary.

```typescript
// Correct
async function FetchUser(id: string): Promise<User> {
	try {
		return await this.userRepository.FindById(id);
	} catch (err) {
		this.logger.error('Failed to fetch user', { err });
		throw err;
	}
}

// Wrong — the error escapes the try/catch
async function FetchUser(id: string): Promise<User> {
	try {
		return this.userRepository.FindById(id);
	} catch (err) { ... }
}
```

### Synchronous Throws Before Returning a Promise

If a function must throw synchronously before returning a Promise — for example, to validate arguments before starting async work — do **not** make it `async`. Making it `async` converts the synchronous throw into a rejected Promise, which changes the observable behavior.

Suppress the lint warning with an inline disable comment:

```typescript
// eslint-disable-next-line @typescript-eslint/promise-function-async
function CreateStream(options: StreamOptions): Promise<Stream> {
	if (!options.url) throw new Error('url is required'); // synchronous throw
	return OpenStream(options);
}
```

### Promise-Returning Functions

All functions that return a Promise should be declared `async`, unless the synchronous-throw exception above applies. (warn)

### Arrow Functions as Callbacks

Prefer arrow functions over function expressions in callbacks. (warn)

```typescript
// Correct
const doubled = numbers.map(n => n * 2);

// Avoid
const doubled = numbers.map(function(n) { return n * 2; });
```

---

## Imports and Exports

### File Extensions in Imports

Always include the `.js` extension in relative import paths, even when the source files are `.ts`. This is required for ESM and bundler resolution.

```typescript
// Correct
import { LoggerService } from '../services/logger.service.js';

// Wrong
import { LoggerService } from '../services/logger.service';
```

### No Duplicate Imports

Multiple imports from the same module must be combined into a single statement. (error)

```typescript
// Correct
import { Injectable, Inject, Optional } from '@nestjs/common';

// Wrong
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
```

### Self-Imports

A module must not import from itself. This is always a mistake — it either does nothing or creates a circular reference. (error)

```typescript
// Wrong — self-import in packages/media/src/library.ts
import { MediaLibrary } from './library.js';
```

### Circular Imports

Circular import chains are reported as warnings. Avoid them. In NestJS, use the `LazyGetter<T>` pattern via `ModuleRef` when circular dependencies are unavoidable.

### Barrel Files

Each package or module boundary exposes a single `index.ts` barrel file as its public API surface. Do not create deep barrel files that re-export everything from sub-directories within an application — this slows hot module replacement, complicates tree-shaking, and increases circular dependency risk.

For published packages, add `"sideEffects": false` in `package.json`.

### Namespace Exports

A package or feature module can re-export its barrel under a namespace alias, allowing consumers to use dot-notation access (`Media.Library`, `Auth.Guard`) instead of named imports. This improves readability at call sites where multiple symbols from the same domain are used together.

```typescript
// packages/media/src/index.ts — normal barrel
export { MediaLibrary } from './library.js';
export { MediaClient } from './client.js';
export type { IMediaConfig } from './config.js';

// packages/media/namespace.ts — namespace re-export
export * as Media from './index.js';
```

Consumer usage:

```typescript
// Named imports — explicit, tree-shakeable
import { MediaLibrary, MediaClient } from '@pawells/media';

// Namespace import — readable, not tree-shakeable
import { Media } from '@pawells/media/namespace';
const library = new Media.Library();
```

**Tradeoff:**

| | Named imports | Namespace imports |
|---|---|---|
| Tree-shaking | ✓ Bundler can eliminate unused exports | ✗ Entire namespace is treated as one unit |
| Readability | Verbose at the import site | Clean dot-notation at the call site |
| IDE support | Full autocomplete on imports | Full autocomplete after namespace |
| Recommended for | Libraries, published packages, anything bundled | Internal application code, scripts, CLIs |

**Guidelines:**
- Expose a namespace export as an *opt-in* via a separate entry point (e.g. `package/namespace`) so consumers who need tree-shaking can use the normal barrel and those who prefer readability can use the namespace
- Never replace the main barrel export with a namespace — keep both
- Add `"sideEffects": false` to `package.json` so bundlers can still tree-shake the normal barrel even if the namespace entry point is present
- This pattern pairs naturally with [Scope Prefixing](#scope-prefixing) — a scoped name like `MediaLibrary` becomes `Media.Library` under a namespace, which is both collision-safe and readable

---

## NestJS Conventions

### Module Design

All configurable modules implement both `forRoot` and `forRootAsync` dynamic module patterns with typed options interfaces.

```typescript
@Module({})
export class CacheModule {
	static forRoot(options: CacheModuleOptions): DynamicModule { ... }
	static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule { ... }
}
```

### Dependency Injection

Use standard NestJS constructor injection for the majority of dependencies. Reserve the **lazy `ModuleRef` pattern** for cases where circular dependencies make eager injection impossible.

```typescript
import { LazyModuleRefBase } from '@pawells/nestjs-shared';

@Injectable()
class MediaService extends LazyModuleRefBase {
	protected get Library(): MediaLibrary {
		return this.Module.get(MediaLibrary) as MediaLibrary;
	}

	protected get Client(): MediaClient {
		return this.Module.get(MediaClient) as MediaClient;
	}

	public async FindAll(): Promise<TMedia[]> {
		return this.Library.FindAll();
	}
}
```

**Why lazy loading:**
- NestJS resolves all `@Inject()` dependencies eagerly at module initialisation. If two providers depend on each other, this produces a circular dependency error at runtime.
- `ModuleRef.get()` is called only when the getter is first accessed, after the DI container is fully initialised. By that point circular references are resolved.
- Getters are the call site — no injection token boilerplate, no `forwardRef()`.

**Rules for this pattern:**
- Extend `LazyModuleRefBase` from `@pawells/nestjs-shared` — do not implement `LazyModuleRefService` manually.
- Pass `module` (camelCase) to `super(module)` in the constructor. If no other dependencies are needed, the constructor can be omitted entirely as `LazyModuleRefBase` handles `ModuleRef` injection.
- `public readonly Module` is provided by the base class — do not redeclare it.
- Getters are `protected` by default; use `public` only when subclasses or consumers need direct access.
- Getter names match the resolved class name exactly: `ItemsService` → getter is `Items`; `MediaLibrary` → getter is `Library`.
- Each getter calls `this.Module.get(ServiceClass) as ServiceClass` — the cast is intentional.

**When `@Inject()` is still acceptable:**
- Simple utilities with no risk of circular dependency (e.g. `ConfigService`, `EventEmitter2`)
- NestJS-provided tokens that `ModuleRef.get()` does not resolve cleanly (e.g. `@Inject(CONFIG_OPTIONS)` for dynamic module options)

When in doubt, use constructor injection. Switch to the lazy pattern only when a circular dependency error occurs at startup.

### Class Naming

| Class type | Suffix convention |
|---|---|
| Service | `Service` — e.g. `LoggerService`, `ErrorSanitizerService` |
| Guard | `Guard` — e.g. `JwtAuthGuard`, `RoleGuard` |
| Interceptor | `Interceptor` — e.g. `LoggingInterceptor` |
| Filter | `Filter` — e.g. `GlobalExceptionFilter` |
| Module | `Module` — e.g. `AuthModule`, `GraphQLModule` |
| Decorator | PascalCase — e.g. `@CurrentUser`, `@Auth` |

### Interface Implementation

| Class type | Interface | Required method |
|---|---|---|
| Guard | `CanActivate` | `canActivate(context: ExecutionContext): Promise<boolean>` |
| Interceptor | `NestInterceptor` | `intercept(context: ExecutionContext, next: CallHandler): Observable<T>` |
| Filter | `ExceptionFilter` | `catch(exception: unknown, host: ArgumentsHost): void` |

> **Note:** NestJS lifecycle and interface methods (`canActivate`, `intercept`, `catch`, `onModuleInit`, `onModuleDestroy`, etc.) are external contracts — see [We Control vs. They Control](#principle-we-control-vs-they-control). For dependency injection, prefer the lazy `ModuleRef` pattern — see [Dependency Injection](#dependency-injection).

### Global Providers

Register filters, interceptors, and pipes globally via the `APP_FILTER`, `APP_INTERCEPTOR`, and `APP_PIPE` tokens — not via `useGlobalFilters()` and equivalents on the application instance, which bypass the DI container.

```typescript
{
	provide: APP_FILTER,
	useClass: GlobalExceptionFilter,
}
```

### Logger

In any package that depends on `nestjs-shared`, use `AppLogger` exclusively. Do not use the NestJS built-in `Logger` class in application code.

```typescript
// Correct
this.logger.info('User created', { userId });
this.logger.warn('Rate limit approaching', { remaining });
this.logger.error('Failed to connect', { err });

// Wrong — .log() is not a valid AppLogger method
this.logger.log('User created');
```

Available methods: `.info()`, `.warn()`, `.error()`, `.debug()`, `.fatal()`.

Exception: the NestJS native `Logger` may be used in `main.ts` (bootstrap) and config-only contexts before the application is initialised.

### Error Handling

All custom errors must extend `BaseApplicationError` from `nestjs-shared`.

Error codes use `UPPER_SNAKE_CASE` string literals:

```typescript
throw new UserNotFoundError('USER_NOT_FOUND', `User ${id} does not exist`);
```

### Configuration

Environment variables are the source of truth for all configuration. Validate them with Joi in modules that depend on `nestjs-shared`. Standalone packages (`nestjs-pyroscope`, `nestjs-qdrant`) use plain typed interfaces without Joi.

### Module Import Order

`ConfigModule` must be imported before any other modules that depend on configuration.

---

## GraphQL Conventions

### Operation Names

All GraphQL operation names (queries, mutations, subscriptions) must use PascalCase. This is the standard across the GraphQL ecosystem.

In NestJS code-first GraphQL, the method name is camelCase but the `name` option in the decorator is PascalCase:

```typescript
@Query(() => Post, { name: 'GetPost' })
async GetPost(@Args('id') id: string): Promise<Post> {
	return await this.postsService.FindById(id);
}

@Mutation(() => Post, { name: 'CreatePost' })
async CreatePost(@Args('input') input: TCreatePostInput): Promise<Post> {
	return await this.postsService.Create(input);
}

@Subscription(() => Post, { name: 'PostAdded' })
PostAdded(): AsyncIterator<Post> {
	return this.pubSub.asyncIterator('postAdded');
}
```

> **Note:** Because the [Naming Conventions](#naming-conventions) rule requires PascalCase for all methods, the TypeScript method name and the GraphQL `name` option now share the same casing. The explicit `name` option is still required — NestJS derives the operation name from the method name automatically, but only in camelCase; the `name` option overrides this.

### Conversion Rule

Capitalise the first letter of every word or segment in the method name:

| Method name | Operation name |
|---|---|
| `getPost` | `GetPost` |
| `me` | `Me` |
| `createUserAccount` | `CreateUserAccount` |
| `notificationAdded` | `NotificationAdded` |

---

## React Conventions

### Components

Use function components. Class components are not permitted.

```typescript
// Correct
export function UserCard({ user, onSelect }: TUserCardProps): React.JSX.Element {
	return <div onClick={() => onSelect(user.id)}>{user.name}</div>;
}

// Wrong — class component
export class UserCard extends React.Component<TUserCardProps> { ... }
```

Prefer plain function declarations over `React.FC`. `React.FC` adds no value and obscures the return type.

### Props Types

Define props as a `type` (not `interface`) with a `T[ComponentName]Props` naming pattern:

```typescript
type TUserCardProps = {
	user: TUser;
	onSelect: (id: string) => void;
	isDisabled?: boolean;
};
```

Export the props type when consumers may need to pass it around or extend it.

Destructure props at the function signature:

```typescript
function UserCard({ user, onSelect, isDisabled = false }: TUserCardProps): React.JSX.Element {
	...
}
```

### Component File Structure

Follow this canonical order within a component file:

1. Props type declaration
2. Component function (with props destructured at the signature)
3. Hooks at the top of the function body
4. Derived values and event handlers
5. Return statement

### Hooks

Custom hooks must start with `use` followed by a capital letter. Only use the `use` prefix if the function actually calls at least one other hook.

```typescript
// Correct
function useAuth(): AuthState { ... }
function useFormInput(initial: string): [string, (e: ChangeEvent<HTMLInputElement>) => void] { ... }

// Wrong — not a hook (doesn't call other hooks); should be a plain PascalCase function
function FormatDate(date: Date): string { ... }
```

Return shape conventions:

| Shape | Convention | Example |
|---|---|---|
| Single value | Direct return | `const isOnline = useOnlineStatus()` |
| State pair | Tuple | `const [books, setBooks] = useLibrary()` |
| Named API | Object | `const { isOpen, onToggle } = useModal()` |

### Event Handler Naming

| Role | Prefix | Example |
|---|---|---|
| Prop passed in from parent | `on` | `onClick`, `onSubmit`, `onItemSelect` |
| Internal implementation | `handle` | `handleClick`, `handleSubmit`, `handleItemSelect` |
| Boolean state prop | `is` / `has` / `can` | `isDisabled`, `hasError`, `canSubmit` |

Match native DOM event names where applicable: `onChange`, `onFocus`, `onBlur`.

> **Note:** React event handler implementations (`handleClick`, `handleSubmit`) follow the React-specific `handle` + camelCase convention — see [We Control vs. They Control](#principle-we-control-vs-they-control).

```typescript
type TFormProps = {
	onSubmit: (data: FormData) => void;  // prop: on prefix
};

function Form({ onSubmit }: TFormProps): React.JSX.Element {
	function handleSubmit(e: React.FormEvent): void {  // implementation: handle prefix
		e.preventDefault();
		onSubmit(collectData());
	}

	return <form onSubmit={handleSubmit}>...</form>;
}
```

### Context

| Construct | Convention | Example |
|---|---|---|
| Context object | `[Domain]Context` | `ThemeContext` |
| Provider component | `[Domain]Provider` | `ThemeProvider` |
| Consumer hook | `use[Domain]` | `useTheme` |
| Value type | `T[Domain]Context` | `TThemeContext` |

Always throw an actionable error when the consumer hook is called outside its provider:

```typescript
export function useTheme(): TThemeContext {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
	return ctx;
}
```

### File and Folder Co-location

Group component files together in a folder named after the component:

```
components/
  UserCard/
    UserCard.tsx
    UserCard.test.tsx
    UserCard.module.css
    index.ts          ← re-exports UserCard as the public surface
```

---

## Interface vs Type

| Situation | Use |
|---|---|
| Shape that may be extended (`extends`), implemented (`implements`), or declaration-merged | `interface` |
| Union types | `type` |
| Intersection types | `type` |
| Mapped or conditional types | `type` |
| Function type aliases | `type` |
| React props | `type` |
| Closed contracts that will not be extended | `type` |

```typescript
// interface — extended in application code, good fit
interface IRepository<T> {
	findById(id: string): Promise<T | null>;
	save(entity: T): Promise<T>;
}

// type — React props, closed contract
type TButtonProps = {
	label: string;
	onClick: () => void;
	variant?: 'primary' | 'secondary';
};

// type — union
type TResult<T> = { ok: true; value: T } | { ok: false; error: Error };
```

> **Note:** Interface method names follow the [We Control vs. They Control](#principle-we-control-vs-they-control) principle. Methods on interfaces that will be implemented by consuming code (e.g. `IRepository`) should use PascalCase. Methods on interfaces that mirror an external contract (e.g. a NestJS lifecycle interface, a third-party SDK shape) use whatever casing that contract requires.

---

## Generics

### Single Generic

`T` is acceptable when the semantics are unambiguous from context:

```typescript
function identity<T>(value: T): T { return value; }
```

### Multiple Generics or Ambiguous Cases

Use `T`-prefixed descriptive names. Avoid single-letter sequences that become unreadable as complexity grows.

```typescript
// Correct — descriptive names
function transform<TInput, TOutput>(
	input: TInput,
	fn: (value: TInput) => TOutput,
): TOutput { ... }

// Avoid — opaque single letters
function transform<T, U>(input: T, fn: (value: T) => U): U { ... }
```

Common names: `TData`, `TError`, `TResult`, `TInput`, `TOutput`, `TContext`, `TKey`, `TValue`.

Generic type parameters must start with an uppercase letter (enforced by the linter).

---

## Discriminated Unions

Use a shared discriminant property (`status`, `kind`, or `type`) with string literal values.

```typescript
type AsyncState<TData, TError = Error> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'success'; data: TData }
	| { status: 'error'; error: TError };
```

Add an exhaustiveness check via `never` in the `default` branch of a `switch`:

```typescript
function render(state: AsyncState<User>): string {
	switch (state.status) {
		case 'idle':
			return 'Waiting...';
		case 'loading':
			return 'Loading...';
		case 'success':
			return state.data.name;
		case 'error':
			return state.error.message;
		default: {
			const _exhaustive: never = state;
			return _exhaustive;
		}
	}
}
```

When the discriminant is typed as `string` rather than a literal union, use `const _check: never = value as never` to preserve type safety.

---

## Error Classes and Assertion Infrastructure

### Domain Error Classes

Every domain or package should define its own typed error class. This enables callers to distinguish errors by origin using `instanceof`, and gives stack traces a meaningful class name.

```typescript
export class VectorError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = 'VectorError';
		Object.setPrototypeOf(this, new.target.prototype);
	}
}
```

**Both `this.name` and `Object.setPrototypeOf` are required:**
- `this.name` — sets the class name shown in error messages and stack traces
- `Object.setPrototypeOf(this, new.target.prototype)` — restores correct prototype chain after TypeScript transpiles `extends Error` to ES5. Without it, `error instanceof VectorError` returns `false` at runtime.

Naming: `[Domain]Error` — scope-prefixed per the [Scope Prefixing](#scope-prefixing) convention. e.g. `VectorError`, `AuthError`, `MediaError`.

---

### Assert Function Signature

Assert functions follow a consistent three-parameter signature:

```typescript
function AssertVector(
	data: unknown,
	args: TAssertVectorArgs = {},
	exception: IAssertVectorException = {},
): asserts data is TVector { ... }
```

| Parameter | Type | Purpose |
|---|---|---|
| `data` | `unknown` | The value to validate — always `unknown`, never pre-narrowed |
| `args` | `TAssert[X]Args` | Validation constraints (size, range, format, etc.) — defaults to `{}` |
| `exception` | `IAssert[X]Exception` | Error customisation (class, message context) — defaults to `{}` |

The `args` and `exception` parameters are always optional with empty object defaults so callers can omit them entirely for basic usage.

---

### Exception Bag Pattern

Assert functions accept a mutable exception configuration object (`IAssertException`) that carries the error class and message context. Set the default error class with `??=` so callers can override it:

```typescript
export function AssertVector(data: unknown, args = {}, exception: IAssertVectorException = {}): asserts data is TVector {
	const exc = exception ?? {};
	exc.class ??= VectorError; // caller can substitute a different class

	if (!Array.isArray(data)) {
		SetExceptionMessage(exc, 'Not a valid vector');
		ThrowException(exc);
	}
	// ...
}
```

This makes assertion infrastructure composable — a caller that wants a different error type passes `{ class: MyError }` without rewriting the assertion.

---

### Composable Args via Intersection Types

Validation constraint interfaces should be composed with intersection types rather than duplicating properties:

```typescript
// Reusable constraint interfaces
interface IAssertNumberArgs { finite?: boolean; integer?: boolean; gt?: number; gte?: number; lt?: number; lte?: number; }
interface IAssertArrayArgs  { size?: number; minSize?: number; maxSize?: number; }

// Compose — do not copy-paste properties
type TAssertVectorArgs = IAssertNumberArgs & IAssertArrayArgs;

// Extend for domain-specific additions
interface IAssertVectorsArgs extends TAssertVectorArgs {
	sameSize?: boolean;
}
```

---

### Specialized Variants Compose the Base

Narrower assertions delegate to the general one with pre-filled constraints. No logic is duplicated:

```typescript
// Base assertion — general
function AssertVector(data: unknown, args: TAssertVectorArgs = {}, exc = {}): asserts data is TVector { ... }

// Specialized — just pre-fills the size constraint
function AssertVector2(data: unknown, exc = {}): asserts data is TVector2 {
	AssertVector(data, { size: 2 }, exc);
}

function AssertVector3(data: unknown, exc = {}): asserts data is TVector3 {
	AssertVector(data, { size: 3 }, exc);
}
```

---

### Extended Exception Interfaces

Domain-specific exception interfaces extend the base to carry extra diagnostic context. This context can be included in error messages to make failures easier to debug:

```typescript
interface IAssertVectorException extends IAssertException {
	index?: number; // which array element failed
}

// Usage: include the index in the message
SetExceptionMessage(exc, `Vector[${exc.index}] is not a number`);
```

---

### Defensive Clone on Sub-Assert Calls

The exception object is passed by reference and may be mutated by the called function (e.g. to set `index`). When calling a sub-assertion in a loop, always spread the exception to give the child its own copy — otherwise the child's mutations corrupt the parent's state:

```typescript
for (let i = 0; i < array.length; i++) {
	// ✓ Correct — child gets its own copy; parent's exc.index is not affected
	AssertVectorValue(array[i], args, { ...exc, index: i });

	// ✗ Wrong — child mutates exc.index and the parent sees the change
	AssertVectorValue(array[i], args, exc);
}
```

---

### Validate Counterpart

Every `Assert` function should have a paired `Validate` function that returns a boolean type predicate. `Validate` calls `Assert` and catches the error:

```typescript
function ValidateVector(data: unknown, args?: TAssertVectorArgs): data is TVector {
	try {
		AssertVector(data, args);
		return true;
	} catch {
		return false;
	}
}
```

The `Assert`/`Validate` naming rule: drop the `T` prefix from the type name for readability — `AssertMediaItem` not `AssertTMediaItem`, `ValidateAuthToken` not `ValidateTAuthToken`.

---

## Test Files

Test files (`*.test.ts`, `*.spec.ts`, `**/__tests__/**`) have relaxed rules:

- Naming conventions are not enforced
- Explicit return types are not required
- Explicit access modifiers are not required
- Magic number warnings are suppressed
- `require-await` is suppressed
- Non-null assertions are allowed

All other rules (quotes, indentation, semicolons, import hygiene) apply in full.

---

## Quick Reference

| Rule | Value | Enforcement |
|---|---|---|
| Indentation | Tabs | error |
| Quotes | Single | error |
| Semicolons | Required | error |
| Trailing commas | Always on multiline | error |
| Object curly spacing | `{ spaced }` | error |
| Array bracket spacing | None | error |
| Brace style | 1TBS | error |
| `===` only | Yes | error |
| `return await` | Required in async functions | error |
| Throw literals | Prohibited | error |
| `var` | Prohibited | error |
| Duplicate imports | Prohibited | error |
| Self-import | Prohibited | error |
| Unused imports | Prohibited | error |
| Access modifiers on class members | Required (not on constructors) | warn |
| Explicit return types | Required | warn |
| Prefer `const` | Yes | warn |
| Optional chaining (`?.`) | Preferred | warn |
| Nullish coalescing (`??`) | Preferred | warn |
| Non-null assertion (`!`) | Avoid | warn |
| Arrow callbacks | Preferred | warn |
| Object shorthand | Required | warn |
| `prefer-readonly` | Yes | warn |
| Circular imports | Avoid | warn |
| Magic numbers | Name them | warn |
| Functions | PascalCase | — |
| Class methods | PascalCase | — |
| Classes | PascalCase | warn |
| Interfaces | `I` + PascalCase | warn |
| Type aliases | `T` + PascalCase | warn |
| Enums | PascalCase | warn |
| Enum members | `UPPER_CASE` or PascalCase | warn |
| Parameters | camelCase only | warn |
| Type parameters | PascalCase, starts uppercase | warn |
| Class properties | PascalCase (`_` prefix allowed on private backing properties) | warn |
| Constants (public static / exported) | `UPPER_SNAKE_CASE` | — |
| Constants (local / private) | PascalCase | — |
| File names (Node/NestJS) | kebab-case | — |
| File names (React components) | PascalCase | — |
| NestJS logger method | `.info()` `.warn()` `.error()` `.debug()` `.fatal()` — never `.log()` | — |
| GraphQL operation names | PascalCase | — |
| React props type | `type T[Name]Props`, not `interface` | — |
| React event props | `on` prefix | — |
| React event handlers | `handle` prefix | — |
| Custom hooks | `use` + capital letter | — |
| Context hook | Throw if called outside provider | — |
| Import extensions | `.js` required in relative paths | — |
| Constructor parameter shorthand | Prohibited in production code | — |
