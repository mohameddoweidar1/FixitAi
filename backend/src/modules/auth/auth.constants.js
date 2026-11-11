export const ROLES = Object.freeze({
  CLIENT: 'client',
  TECHNICIAN: 'technician',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.values(ROLES);

// Roles a user is allowed to self-assign at registration.
// ADMIN must be created by seeding or by another admin — never via public signup.
export const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  ROLES.CLIENT,
  ROLES.TECHNICIAN,
]);
