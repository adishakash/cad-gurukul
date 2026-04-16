'use strict';

/**
 * Role hierarchy for the unified multi-role auth system.
 *
 * Hierarchy (highest → lowest):
 *   ADMIN (4) > CAREER_COUNSELLOR_LEAD (3) > CAREER_COUNSELLOR (2) > STUDENT (1)
 *
 * Rule: a user with a higher level can access any route that requires a lower level.
 *
 * Phase status:
 *   ADMIN                  — Phase 1 ✅ implemented
 *   CAREER_COUNSELLOR_LEAD — Phase 2 ⏳ schema-ready, endpoints not yet built
 *   CAREER_COUNSELLOR      — Phase 2 ⏳ schema-ready, endpoints not yet built
 *   STUDENT / PARENT       — existing, untouched
 */

const ROLE_HIERARCHY = Object.freeze({
  ADMIN: 4,
  CAREER_COUNSELLOR_LEAD: 3,
  CAREER_COUNSELLOR: 2,
  STUDENT: 1,
  PARENT: 1,
  COUNSELLOR: 1, // legacy value — kept for backward compat
});

/**
 * All valid role strings (matches Prisma UserRole enum).
 * Used for validation and documentation; NOT for authorization logic.
 */
const ALL_ROLES = Object.freeze(Object.keys(ROLE_HIERARCHY));

/**
 * Roles that can access the admin panel (Phase 1: ADMIN only).
 * Extend this when Phase 2 roles are implemented.
 */
const ADMIN_PANEL_ROLES = Object.freeze(['ADMIN']);

/**
 * Roles that can access the staff portal.
 * Phase 2: CAREER_COUNSELLOR_LEAD.
 * Phase 3: add CAREER_COUNSELLOR.
 */
const STAFF_PORTAL_ROLES = Object.freeze(['CAREER_COUNSELLOR_LEAD', 'CAREER_COUNSELLOR']);

/**
 * Returns the numeric hierarchy level for a given role.
 * Returns 0 for unknown roles (they will fail all checks).
 */
const getRoleLevel = (role) => ROLE_HIERARCHY[role] ?? 0;

module.exports = { ROLE_HIERARCHY, ALL_ROLES, ADMIN_PANEL_ROLES, STAFF_PORTAL_ROLES, getRoleLevel };
