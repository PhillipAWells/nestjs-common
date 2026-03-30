export { GraphQLModule } from './graphql.module.js';
export { GraphQLService } from './graphql.service.js';
export type { IGraphQLConfigOptions, IGraphQLAsyncConfig } from './graphql-config.interface.js';

// Scalars
export { ObjectIdScalar } from './scalars/object-id.scalar.js';
export { DateTimeScalar } from './scalars/date-time.scalar.js';
export { JSONScalar } from './scalars/json.scalar.js';

// Types
export { PageInfo } from './types/page-info.type.js';
export { Connection, Edge, CursorUtils } from './types/connection.type.js';

// Enums
export { SortDirection } from './enums/sort-direction.enum.js';

// Error Handling
export { GraphQLErrorFormatter } from './error-formatter.js';
export { GraphQLErrorCode } from './error-codes.js';
export type { IGraphQLErrorExtensions, IValidationError } from './error-codes.js';

// BSON Support
export { BsonSerializationService, BsonSerializationMiddleware, BsonResponseInterceptor } from './bson/index.js';
