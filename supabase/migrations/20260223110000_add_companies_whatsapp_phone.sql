-- ============================================================
-- Add whatsapp_phone to companies
-- Format enforced: Twilio-style "whatsapp:+<8-15 digits>"
-- ============================================================

alter table public.companies
  add column if not exists whatsapp_phone text
    constraint companies_whatsapp_phone_format
    check (
      whatsapp_phone is null
      or whatsapp_phone ~ '^whatsapp:\+\d{8,15}$'
    );
