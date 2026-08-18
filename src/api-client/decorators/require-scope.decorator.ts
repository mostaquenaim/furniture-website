import { SetMetadata } from '@nestjs/common';
import { ApiScope } from '../api-scope.enum';

export const REQUIRE_SCOPE_KEY = 'require_api_scope';
export const RequireScope = (scope: ApiScope) =>
  SetMetadata(REQUIRE_SCOPE_KEY, scope);
