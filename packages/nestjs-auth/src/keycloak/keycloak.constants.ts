/**
 * Injection token for the `IKeycloakModuleOptions` configuration object.
 *
 * Provided automatically by `KeycloakModule.forRoot()` and `KeycloakModule.forRootAsync()`.
 * Use this token when injecting the raw module options directly (e.g. in custom services
 * that need access to `authServerUrl`, `realm`, or `clientId`).
 *
 * @example
 * ```typescript
 * constructor(@Inject(KEYCLOAK_MODULE_OPTIONS) options: IKeycloakModuleOptions) {
 *   console.log(options.realm);
 * }
 * ```
 */
export const KEYCLOAK_MODULE_OPTIONS = Symbol('KEYCLOAK_MODULE_OPTIONS');
