import { Injectable } from '@nestjs/common';

@Injectable()
export class LogsService {
  private logs = [
    { id: 1, userId: 1, adminId: null, action: 'User login', createdAt: new Date() },
    { id: 2, userId: null, adminId: 2, action: 'Created product', createdAt: new Date() },
  ];

  getAll() {
    return this.logs;
  }

  getUserLogs(userId: string) {
    return this.logs.filter(log => log.userId == +userId);
  }

  getAdminLogs() {
    return this.logs.filter(log => log.adminId != null);
  }

  deleteLog(id: string) {
    const idx = this.logs.findIndex(log => log.id == +id);
    if (idx === -1) return null;
    const removed = this.logs.splice(idx, 1);
    return removed[0];
  }
}
