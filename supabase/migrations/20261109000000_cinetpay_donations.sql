BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uce_app_records_id_church_idx
  ON public.uce_app_records (id, eglise_id);

CREATE TABLE IF NOT EXISTS public.uce_cinetpay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eglise_id uuid NOT NULL REFERENCES public.eglises(id) ON DELETE RESTRICT,
  donation_id uuid NOT NULL REFERENCES public.uce_app_records(id) ON DELETE RESTRICT,
  profile_id uuid NOT NULL REFERENCES public.profils_utilisateurs(id) ON DELETE RESTRICT,
  transaction_id varchar(64) NOT NULL UNIQUE,
  payment_method varchar(20) NOT NULL CHECK (payment_method IN ('mobile_money', 'card')),
  amount bigint NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL CHECK (currency = 'XAF'),
  status varchar(20) NOT NULL DEFAULT 'initializing'
    CHECK (status IN ('initializing', 'pending', 'accepted', 'refused', 'failed')),
  payment_url text,
  provider_status varchar(40),
  provider_code varchar(20),
  provider_payment_method varchar(40),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (donation_id),
  FOREIGN KEY (donation_id, eglise_id)
    REFERENCES public.uce_app_records(id, eglise_id) ON DELETE RESTRICT,
  FOREIGN KEY (profile_id, eglise_id)
    REFERENCES public.profils_utilisateurs(id, eglise_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS uce_cinetpay_profile_created_idx
  ON public.uce_cinetpay_transactions (eglise_id, profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uce_cinetpay_pending_idx
  ON public.uce_cinetpay_transactions (status, updated_at)
  WHERE status IN ('initializing', 'pending');

INSERT INTO public.finance_accounts (eglise_id, code, label, account_class, account_type, syscohada_code, is_system)
SELECT e.id, a.code, a.label, 5, 'asset', NULL, true
FROM public.eglises e
CROSS JOIN (VALUES
  ('CINETPAY_MOBILE_XAF', 'Compte de règlement Mobile Money CinetPay — XAF'),
  ('CINETPAY_CARD_XAF', 'Compte de règlement carte CinetPay — XAF')
) AS a(code, label)
ON CONFLICT (eglise_id, code) DO NOTHING;

ALTER TABLE public.uce_cinetpay_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uce_cinetpay_transactions FROM anon, authenticated;

COMMIT;
