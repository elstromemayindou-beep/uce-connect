BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE RESTRICT,
  label varchar(160) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash numeric(20, 0) NOT NULL DEFAULT 0 CHECK (opening_cash = 0),
  counted_cash numeric(20, 0) CHECK (counted_cash >= 0),
  expected_cash numeric(20, 0) CHECK (expected_cash >= 0),
  variance numeric(20, 0),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'open' AND counted_cash IS NULL AND expected_cash IS NULL AND variance IS NULL
      AND closed_by IS NULL AND closed_at IS NULL)
    OR
    (status = 'closed' AND counted_cash IS NOT NULL AND expected_cash IS NOT NULL AND variance IS NOT NULL
      AND closed_by IS NOT NULL AND closed_at IS NOT NULL)
  ),
  UNIQUE (id, eglise_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_cash_sessions_one_open_per_church_idx
  ON public.finance_cash_sessions (eglise_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS finance_cash_sessions_church_opened_idx
  ON public.finance_cash_sessions (eglise_id, opened_at DESC);

ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS cash_session_id uuid;

ALTER TABLE public.finance_expenses
  DROP CONSTRAINT IF EXISTS finance_expenses_cash_session_fk;

ALTER TABLE public.finance_expenses
  ADD CONSTRAINT finance_expenses_cash_session_fk
  FOREIGN KEY (cash_session_id, eglise_id)
  REFERENCES public.finance_cash_sessions(id, eglise_id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS finance_expenses_cash_session_idx
  ON public.finance_expenses (cash_session_id)
  WHERE cash_session_id IS NOT NULL;

ALTER TABLE public.finance_cash_sessions ENABLE ROW LEVEL SECURITY;

COMMIT;
