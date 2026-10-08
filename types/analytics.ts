/** GA4 ecommerce item (camelCase gtag shape shared by web and Measurement Protocol). */
export type GaEcommerceItem = {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  item_variant: string;
  affiliation: string;
  price: number;
  quantity: number;
};

/** Non-personal attribution context captured at order creation for server-side GA events. */
export type PaymentAnalyticsAttribution = {
  gaClientId: string | null;
};
