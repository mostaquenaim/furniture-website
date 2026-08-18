import { Injectable } from '@nestjs/common';

@Injectable()
export class RolesService {
  private roles = [
    { id: 1, name: 'SUPERADMIN', permissions: ['all'] },
    { id: 2, name: 'PRODUCTMANAGER', permissions: ['products', 'categories'] },
    { id: 3, name: 'ORDERMANAGER', permissions: ['orders'] },
  ];

  getAll() {
    return this.roles;
  }

  createRole(name: string) {
    const newRole = { id: Date.now(), name, permissions: [] };
    this.roles.push(newRole);
    return newRole;
  }

  updateRole(id: string, name: string) {
    const role = this.roles.find(r => r.id == +id);
    if (!role) return null;
    role.name = name;
    return role;
  }

  deleteRole(id: string) {
    const idx = this.roles.findIndex(r => r.id == +id);
    if (idx === -1) return null;
    const removed = this.roles.splice(idx, 1);
    return removed[0];
  }

  getPermissions(id: string) {
    const role = this.roles.find(r => r.id == +id);
    return role ? role.permissions : null;
  }

  assignPermissions(id: string, permissions: string[]) {
    const role = this.roles.find(r => r.id == +id);
    if (!role) return null;
    role.permissions = permissions;
    return role;
  }
}
