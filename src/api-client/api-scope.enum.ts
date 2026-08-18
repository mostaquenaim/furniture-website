// A flat capability list for 3rd-party API credentials — deliberately not
// role-based. An external system doesn't have a job title the way a staff
// User does; it has a purpose, which is what a scope names.
export enum ApiScope {
  INVENTORY_READ = 'inventory:read',
}
