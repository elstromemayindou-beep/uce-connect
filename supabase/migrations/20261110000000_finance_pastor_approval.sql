BEGIN;

ALTER TABLE public.finance_expenses
  DROP CONSTRAINT IF EXISTS finance_expenses_status_check;

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS pastor_approved_by uuid,
  ADD COLUMN IF NOT EXISTS pastor_approved_at timestamptz;

UPDATE public.finance_expenses
SET status='pending_pastor'
WHERE status='approved';

ALTER TABLE public.finance_expenses
  ADD CONSTRAINT finance_expenses_status_check
  CHECK (status IN ('pending_review', 'pending_pastor', 'approved', 'rejected', 'paid'));

CREATE INDEX IF NOT EXISTS finance_expenses_pastor_review_idx
  ON public.finance_expenses (eglise_id, created_at DESC)
  WHERE status='pending_pastor';

COMMIT;
