-- Store marketing settings (SEO, tracking, promotions, campaigns)
-- Apply in Supabase SQL editor or add as a migration.

alter table public.stores
  add column if not exists marketing_settings jsonb not null default '{
    "version": 1,
    "seo": {"metaTitle":"","metaDescription":"","keywords":"","ogImageUrl":""},
    "tracking": {"googleSearchConsoleVerification":"","facebookPixelId":"","googleAnalyticsId":""},
    "promotions": {
      "announcementBarEnabled": false,
      "announcementText": "Free shipping on orders over ₹999",
      "announcementLink": "",
      "promoBannerEnabled": false,
      "promoBannerTitle": "Summer Sale",
      "promoBannerMessage": "Get 15% off your first order",
      "promoBannerCta": "Shop now"
    },
    "sharing": {"whatsappShareEnabled": true, "whatsappShareMessage": "Check out my store on CatShare!"},
    "campaigns": {"discountCampaignsEnabled": false, "emailMarketingEnabled": false}
  }'::jsonb;

comment on column public.stores.marketing_settings is 'Seller marketing: SEO, tracking pixels, promotions, and campaign toggles';
