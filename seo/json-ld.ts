import { siteConfig } from "@/config/site";
import type { FaqItem } from "@/types/content";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.legal.tradeName,
    legalName: siteConfig.legal.legalName,
    url: siteConfig.url,
    email: siteConfig.legal.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "109/364, Ram Krishna Nagar, R K Nagar",
      addressLocality: "Kanpur Nagar",
      addressRegion: "Uttar Pradesh",
      postalCode: "208012",
      addressCountry: "IN",
    },
    logo: `${siteConfig.url}/logo.png`,
    description: siteConfig.description,
    sameAs: [siteConfig.discordUrl],
    areaServed: {
      "@type": "Country",
      name: "India",
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    url: siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    publisher: { "@id": `${siteConfig.url}/#organization` },
    inLanguage: "en-IN",
  };
}

export function faqJsonLd(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}

export function vipPricingJsonLd(
  offers: Array<{ name: string; pricePaise: number }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "WallBang VIP",
    description:
      "Prepaid WallBang VIP for CS2 retake servers. Pay once for 1, 3, or 6 months, or 1 year. No auto-renewal.",
    brand: {
      "@type": "Brand",
      name: siteConfig.name,
    },
    url: `${siteConfig.url}/pricing`,
    offers: offers.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      price: (offer.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${siteConfig.url}/pricing`,
    })),
  };
}
