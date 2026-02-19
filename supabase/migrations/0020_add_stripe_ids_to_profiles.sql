-- Store Stripe customer and subscription for paid tiers
alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
