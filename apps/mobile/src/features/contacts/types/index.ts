/**
 * Contact Types
 * TypeScript definitions matching contacts database schema
 */

export interface ContactAddress {
  chain_id: number;
  address: string;
  label: string; // e.g., "Ethereum", "Polygon", "Sepolia"
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  memo: string | null;
  avatar_url: string | null;
  tags: string[] | null;
  addresses: ContactAddress[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  name: string;
  addresses: ContactAddress[];
  memo?: string;
  avatar_url?: string;
  tags?: string[];
  is_favorite?: boolean;
}

export interface UpdateContactInput {
  name?: string;
  addresses?: ContactAddress[];
  memo?: string;
  avatar_url?: string;
  tags?: string[];
  is_favorite?: boolean;
}

// Contact tags for categorization
export const CONTACT_TAGS = {
  GUARDIAN: 'guardian',
  FRIEND: 'friend',
  BUSINESS: 'business',
  FAMILY: 'family',
  EXCHANGE: 'exchange',
} as const;

export type ContactTag = typeof CONTACT_TAGS[keyof typeof CONTACT_TAGS];
