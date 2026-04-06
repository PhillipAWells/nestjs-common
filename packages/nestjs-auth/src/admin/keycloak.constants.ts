/**
 * Injection token for the Keycloak Admin configuration object.
 *
 * Use this token when manually injecting the Keycloak admin configuration
 * (typically not required — inject {@link KeycloakAdminService} instead).
 *
 * @example
 * ```typescript
 * constructor(@Inject(KEYCLOAK_ADMIN_CONFIG_TOKEN) config: IKeycloakAdminConfig) {
 *   // Access the configuration directly
 *   console.log(config.realmName);
 * }
 * ```
 */
export const KEYCLOAK_ADMIN_CONFIG_TOKEN = 'KEYCLOAK_ADMIN_CONFIG';
