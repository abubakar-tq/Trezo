/**
 * Contact Service
 * Manages CRUD operations for contacts in Supabase
 */

import { getSupabaseClient } from '@/lib/supabase';
import type { Contact, CreateContactInput, UpdateContactInput } from '../types';

export class ContactService {
  private static supabase = getSupabaseClient();

  /**
   * Get all contacts for the authenticated user
   */
  static async getContacts(): Promise<Contact[]> {
    console.log(`🔄 [ContactService] Fetching contacts...`);
    
    try {
      // Check authentication first
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error(`❌ [ContactService] User not authenticated:`, authError);
        return [];
      }
      console.log(`✅ [ContactService] User authenticated: ${user.id}`);

      const { data, error } = await Promise.race([
        this.supabase
          .from('contacts')
          .select('*')
          .order('name', { ascending: true }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);

      if (error) throw error;

      console.log(`✅ [ContactService] Fetched ${data?.length || 0} contacts`);
      return data || [];
    } catch (error) {
      console.error(`❌ [ContactService] Failed to fetch contacts:`, error);
      return [];
    }
  }

  /**
   * Get a single contact by ID
   */
  static async getContact(contactId: string): Promise<Contact | null> {
    console.log(`🔄 [ContactService] Fetching contact ${contactId}...`);
    
    try {
      const { data, error } = await this.supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) throw error;

      console.log(`✅ [ContactService] Contact fetched`);
      return data;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to fetch contact:`, error);
      return null;
    }
  }

  /**
   * Create a new contact
   */
  static async createContact(input: CreateContactInput): Promise<Contact | null> {
    console.log(`🔄 [ContactService] Creating contact "${input.name}"...`);
    
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await this.supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          addresses: input.addresses || [],
          memo: input.memo?.trim() || null,
          tags: input.tags || [],
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [ContactService] Contact created with ID ${data.id}`);
      return data;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to create contact:`, error);
      return null;
    }
  }

  /**
   * Update an existing contact
   */
  static async updateContact(
    contactId: string, 
    input: UpdateContactInput
  ): Promise<Contact | null> {
    console.log(`🔄 [ContactService] Updating contact ${contactId}...`);
    
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.addresses !== undefined) updateData.addresses = input.addresses;
      if (input.memo !== undefined) updateData.memo = input.memo?.trim() || null;
      if (input.tags !== undefined) updateData.tags = input.tags;

      const { data, error } = await this.supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [ContactService] Contact updated`);
      return data;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to update contact:`, error);
      return null;
    }
  }

  /**
   * Delete a contact
   */
  static async deleteContact(contactId: string): Promise<boolean> {
    console.log(`🔄 [ContactService] Deleting contact ${contactId}...`);
    
    try {
      const { error } = await this.supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      console.log(`✅ [ContactService] Contact deleted`);
      return true;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to delete contact:`, error);
      return false;
    }
  }

  /**
   * Search contacts by address using database function
   */
  static async searchContactsByAddress(
    address: string, 
    chainId?: number
  ): Promise<Contact[]> {
    console.log(`🔍 [ContactService] Searching for address "${address}"${chainId ? ` on chain ${chainId}` : ''}...`);
    
    try {
      const { data, error } = await this.supabase
        .rpc('search_contacts_by_address', {
          search_address: address.toLowerCase(),
          chain_id_filter: chainId || null,
        });

      if (error) throw error;

      console.log(`✅ [ContactService] Found ${data?.length || 0} contacts`);
      return data || [];
    } catch (error) {
      console.error(`❌ [ContactService] Failed to search contacts:`, error);
      return [];
    }
  }

  /**
   * Get contacts by tag using database function
   */
  static async getContactsByTag(tag: string): Promise<Contact[]> {
    console.log(`🔍 [ContactService] Getting contacts with tag "${tag}"...`);
    
    try {
      const { data, error } = await this.supabase
        .rpc('get_contacts_by_tag', {
          tag_name: tag,
        });

      if (error) throw error;

      console.log(`✅ [ContactService] Found ${data?.length || 0} contacts`);
      return data || [];
    } catch (error) {
      console.error(`❌ [ContactService] Failed to get contacts by tag:`, error);
      return [];
    }
  }

  /**
   * Get all unique tags from user's contacts
   */
  static async getAllTags(): Promise<string[]> {
    console.log(`🔄 [ContactService] Fetching all tags...`);
    
    try {
      // Check authentication first
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error(`❌ [ContactService] User not authenticated for tags:`, authError);
        return [];
      }

      const { data, error } = await Promise.race([
        this.supabase
          .from('contacts')
          .select('tags'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);

      if (error) throw error;

      // Extract unique tags
      const tagsSet = new Set<string>();
      data?.forEach(contact => {
        contact.tags?.forEach((tag: string) => tagsSet.add(tag));
      });

      const tags = Array.from(tagsSet).sort();
      console.log(`✅ [ContactService] Found ${tags.length} unique tags`);
      return tags;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to fetch tags:`, error);
      return [];
    }
  }

  /**
   * Batch import contacts
   */
  static async batchCreateContacts(contacts: CreateContactInput[]): Promise<number> {
    console.log(`🔄 [ContactService] Batch importing ${contacts.length} contacts...`);
    
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const insertData = contacts.map(contact => ({
        user_id: user.id,
        name: contact.name.trim(),
        addresses: contact.addresses || [],
        memo: contact.memo?.trim() || null,
        tags: contact.tags || [],
      }));

      const { data, error } = await this.supabase
        .from('contacts')
        .insert(insertData)
        .select();

      if (error) throw error;

      console.log(`✅ [ContactService] Imported ${data?.length || 0} contacts`);
      return data?.length || 0;
    } catch (error) {
      console.error(`❌ [ContactService] Failed to batch import contacts:`, error);
      return 0;
    }
  }
}
