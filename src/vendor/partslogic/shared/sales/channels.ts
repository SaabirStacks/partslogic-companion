// How an enquiry arrives, and how a customer says yes to an offer.
export const ENQUIRY_CHANNELS = ['phone', 'whatsapp', 'counter', 'email', 'website'] as const;
export type EnquiryChannel = (typeof ENQUIRY_CHANNELS)[number];
export const isEnquiryChannel = (value: string): value is EnquiryChannel =>
  (ENQUIRY_CHANNELS as readonly string[]).includes(value);
