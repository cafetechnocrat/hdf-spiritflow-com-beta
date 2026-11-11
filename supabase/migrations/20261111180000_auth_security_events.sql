-- Phase 1: audit actions for password and two-factor changes.
-- The audit log accepts these actions in addition to the earlier ones.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (
  action in (
    'insert', 'update', 'void', 'delete',
    'login', 'logout', 'failed_login',
    'password_change', 'password_reset',
    'mfa_enrol', 'mfa_reset'
  )
);
