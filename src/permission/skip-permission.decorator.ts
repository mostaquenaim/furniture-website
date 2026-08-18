// src/permission/skip-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_PERMISSION_KEY = 'skip_permission';
export const SkipPermission = () => SetMetadata(SKIP_PERMISSION_KEY, true);
