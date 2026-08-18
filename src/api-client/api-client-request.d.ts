import { AuthenticatedApiClient } from './api-client.service';

// Augments Express's Request so every partner-namespace guard/interceptor
// shares one typed field instead of ad-hoc `as any` casts scattered around.
declare module 'express' {
  interface Request {
    apiClient?: AuthenticatedApiClient;
  }
}
