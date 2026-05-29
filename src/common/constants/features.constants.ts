export enum FeatureKey {
  MAX_AGENTS = 'MAX_AGENTS',
  MAX_LEADS_PER_MONTH = 'MAX_LEADS_PER_MONTH',
  MAX_PROPERTIES = 'MAX_PROPERTIES',
  WHATSAPP_INTEGRATION = 'WHATSAPP_INTEGRATION',
  ADVANCED_REPORTS = 'ADVANCED_REPORTS',
  API_ACCESS = 'API_ACCESS',
  CUSTOM_BRANDING = 'CUSTOM_BRANDING',
}

export const FEATURE_CATALOG = {
  [FeatureKey.MAX_AGENTS]: {
    name: { en: 'Maximum Agents', hi: 'अधिकतम एजेंट', ar: 'أقصى عدد من الوكلاء' },
    description: { en: 'Number of team members who can access the system' },
  },
  [FeatureKey.MAX_LEADS_PER_MONTH]: {
    name: { en: 'Monthly Lead Limit', hi: 'मासिक लीड सीमा', ar: 'حد العملاء الشهري' },
    description: { en: 'Maximum new leads that can be created per month' },
  },
  [FeatureKey.MAX_PROPERTIES]: {
    name: { en: 'Property Listings', hi: 'संपत्ति सूचियाँ', ar: 'قوائم العقارات' },
    description: { en: 'Number of properties that can be listed' },
  },
  [FeatureKey.WHATSAPP_INTEGRATION]: {
    name: { en: 'WhatsApp Messaging', hi: 'व्हाट्सएप संदेश', ar: 'رسائل واتساب' },
    description: { en: 'Send and receive WhatsApp messages' },
  },
  [FeatureKey.ADVANCED_REPORTS]: {
    name: { en: 'Advanced Reports', hi: 'उन्नत रिपोर्ट', ar: 'تقارير متقدمة' },
    description: { en: 'Team performance and commission analytics' },
  },
  [FeatureKey.API_ACCESS]: {
    name: { en: 'API Access', hi: 'एपीआई एक्सेस', ar: 'الوصول إلى واجهة برمجة التطبيقات' },
    description: { en: 'Programmatic access via REST API' },
  },
  [FeatureKey.CUSTOM_BRANDING]: {
    name: { en: 'Custom Branding', hi: 'कस्टम ब्रांडिंग', ar: 'العلامة التجارية المخصصة' },
    description: { en: 'Personalized logo and colors for the dashboard' },
  },
} as const;
