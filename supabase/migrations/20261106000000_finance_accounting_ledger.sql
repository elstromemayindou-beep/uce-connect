BEGIN;

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  code varchar(40) NOT NULL,
  label varchar(160) NOT NULL,
  account_class smallint NOT NULL CHECK (account_class BETWEEN 1 AND 8),
  account_type varchar(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  syscohada_code varchar(20),
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eglise_id, code),
  UNIQUE (id, eglise_id)
);

CREATE TABLE IF NOT EXISTS public.finance_sequences (
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE CASCADE,
  sequence_name varchar(30) NOT NULL,
  sequence_year integer NOT NULL,
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (eglise_id, sequence_name, sequence_year)
);

CREATE TABLE IF NOT EXISTS public.finance_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE RESTRICT,
  entry_number varchar(40) NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type varchar(30) NOT NULL,
  source_id uuid,
  description varchar(500) NOT NULL,
  status varchar(12) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  created_by uuid NOT NULL,
  posted_by uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eglise_id, entry_number),
  UNIQUE (id, eglise_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_journals_source_unique_idx
  ON public.finance_journals (eglise_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  line_number smallint NOT NULL CHECK (line_number > 0),
  account_id uuid NOT NULL,
  member_id uuid,
  description varchar(300),
  debit_amount numeric(20, 0) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount numeric(20, 0) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)),
  UNIQUE (journal_id, line_number),
  FOREIGN KEY (journal_id, eglise_id) REFERENCES public.finance_journals(id, eglise_id) ON DELETE RESTRICT,
  FOREIGN KEY (account_id, eglise_id) REFERENCES public.finance_accounts(id, eglise_id) ON DELETE RESTRICT,
  FOREIGN KEY (member_id, eglise_id) REFERENCES public.membres(id, eglise_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS finance_journals_church_date_idx
  ON public.finance_journals (eglise_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS finance_journal_lines_church_account_idx
  ON public.finance_journal_lines (eglise_id, account_id);
CREATE INDEX IF NOT EXISTS finance_journal_lines_church_member_idx
  ON public.finance_journal_lines (eglise_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE RESTRICT,
  expense_number varchar(40) NOT NULL,
  category varchar(30) NOT NULL CHECK (category IN ('general', 'ministry', 'event', 'solidarity', 'maintenance')),
  description varchar(500) NOT NULL,
  vendor_name varchar(160) NOT NULL,
  invoice_reference varchar(120),
  amount numeric(20, 0) NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL DEFAULT 'XAF',
  status varchar(20) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'paid')),
  payment_method varchar(20) CHECK (payment_method IN ('cash', 'mtn_momo', 'airtel_money', 'visa')),
  payment_reference varchar(120),
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason varchar(300),
  paid_by uuid,
  paid_at timestamptz,
  journal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (eglise_id, expense_number),
  FOREIGN KEY (journal_id, eglise_id) REFERENCES public.finance_journals(id, eglise_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS finance_expenses_church_created_idx
  ON public.finance_expenses (eglise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_expenses_church_status_idx
  ON public.finance_expenses (eglise_id, status);

CREATE TABLE IF NOT EXISTS public.finance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL,
  action varchar(50) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_audit_church_created_idx
  ON public.finance_audit_events (eglise_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS finance_received_payment_reference_unique_idx
  ON public.uce_app_records (eglise_id, (payload->>'payment_reference'))
  WHERE entity_type = 'Donation'
    AND payload->>'status' = 'received'
    AND NULLIF(payload->>'payment_reference', '') IS NOT NULL;

INSERT INTO public.finance_accounts (eglise_id, code, label, account_class, account_type, syscohada_code, is_system)
SELECT e.id, a.code, a.label, a.account_class, a.account_type, a.syscohada_code, true
FROM public.eglises e
CROSS JOIN (VALUES
  ('CASH_XAF', 'Caisse principale — XAF', 5, 'asset', '571'),
  ('BANK_XAF', 'Compte bancaire — XAF', 5, 'asset', '521'),
  ('MTN_MOMO_XAF', 'Compte de règlement MTN Mobile Money — XAF', 5, 'asset', NULL),
  ('AIRTEL_MONEY_XAF', 'Compte de règlement Airtel Money — XAF', 5, 'asset', NULL),
  ('VISA_CLEARING_XAF', 'Compte de règlement Visa — XAF', 5, 'asset', NULL),
  ('INCOME_TITHE', 'Produits — dîmes', 7, 'income', NULL),
  ('INCOME_OFFERING', 'Produits — offrandes', 7, 'income', NULL),
  ('INCOME_CAMPAIGN', 'Produits — campagnes', 7, 'income', NULL),
  ('INCOME_OTHER', 'Produits — autres dons', 7, 'income', NULL),
  ('EXPENSE_GENERAL', 'Charges — fonctionnement général', 6, 'expense', NULL),
  ('EXPENSE_MINISTRY', 'Charges — ministères', 6, 'expense', NULL),
  ('EXPENSE_EVENT', 'Charges — événements', 6, 'expense', NULL),
  ('EXPENSE_SOLIDARITY', 'Charges — solidarité', 6, 'expense', NULL),
  ('EXPENSE_MAINTENANCE', 'Charges — entretien et maintenance', 6, 'expense', NULL)
) AS a(code, label, account_class, account_type, syscohada_code)
ON CONFLICT (eglise_id, code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_assert_posted_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_journal_id uuid;
  journal_status varchar(12);
  debit_total numeric(20, 0);
  credit_total numeric(20, 0);
  line_count integer;
BEGIN
  IF TG_TABLE_NAME = 'finance_journal_lines' AND TG_OP = 'DELETE' THEN
    target_journal_id := OLD.journal_id;
  ELSIF TG_TABLE_NAME = 'finance_journal_lines' THEN
    target_journal_id := NEW.journal_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_journal_id := OLD.id;
  ELSE
    target_journal_id := NEW.id;
  END IF;
  SELECT status INTO journal_status
  FROM public.finance_journals
  WHERE id = target_journal_id;

  IF journal_status = 'posted' THEN
    SELECT COUNT(*), COALESCE(SUM(debit_amount), 0), COALESCE(SUM(credit_amount), 0)
      INTO line_count, debit_total, credit_total
    FROM public.finance_journal_lines
    WHERE journal_id = target_journal_id;

    IF line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'A posted finance journal must have at least two balanced lines.';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS finance_journal_lines_balanced_trigger ON public.finance_journal_lines;
CREATE CONSTRAINT TRIGGER finance_journal_lines_balanced_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.finance_journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.finance_assert_posted_journal_balanced();

DROP TRIGGER IF EXISTS finance_journals_balanced_trigger ON public.finance_journals;
CREATE CONSTRAINT TRIGGER finance_journals_balanced_trigger
AFTER INSERT OR UPDATE ON public.finance_journals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.finance_assert_posted_journal_balanced();

CREATE OR REPLACE FUNCTION public.finance_prevent_posted_journal_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'finance_journals' THEN
    IF TG_OP <> 'INSERT' AND OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Posted finance journals are immutable; create a reversing entry instead.';
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' AND EXISTS (
      SELECT 1 FROM public.finance_journals WHERE id = OLD.journal_id AND status = 'posted'
    ) THEN
      RAISE EXCEPTION 'Lines of a posted finance journal are immutable.';
    END IF;
    IF TG_OP <> 'DELETE' AND EXISTS (
      SELECT 1 FROM public.finance_journals WHERE id = NEW.journal_id AND status = 'posted'
    ) THEN
      RAISE EXCEPTION 'Lines cannot be added to or moved into a posted finance journal.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_journals_immutable_trigger ON public.finance_journals;
CREATE TRIGGER finance_journals_immutable_trigger
BEFORE UPDATE OR DELETE ON public.finance_journals
FOR EACH ROW EXECUTE FUNCTION public.finance_prevent_posted_journal_mutation();

DROP TRIGGER IF EXISTS finance_journal_lines_immutable_trigger ON public.finance_journal_lines;
CREATE TRIGGER finance_journal_lines_immutable_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_journal_lines
FOR EACH ROW EXECUTE FUNCTION public.finance_prevent_posted_journal_mutation();

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

COMMIT;
