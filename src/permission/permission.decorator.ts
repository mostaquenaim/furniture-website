import { SetMetadata } from '@nestjs/common';
import { Action } from './action.enum';

export const PERMISSION_KEY = 'required_permission';
export const Permission = (action: Action) =>
  SetMetadata(PERMISSION_KEY, action);
