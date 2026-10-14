/**
 * ResQNet - Supabase Realtime Synchronization Service (Phase 3G)
 * Subscribes to PostgreSQL Change Data Capture (CDC) events via Supabase Realtime.
 * Manages clean lifecycle, channel subscriptions, authentication context,
 * and error handling.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type RealtimeChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  new: Record<string, any>;
  old: Record<string, any>;
  commit_timestamp?: string;
};

export type RealtimeCallback = (payload: RealtimeChangePayload) => void;

class RealtimeService {
  private activeChannels: Map<string, RealtimeChannel> = new Map();

  /**
   * Subscribes to Supabase Realtime postgres_changes for specified tables.
   * Guarantees all postgres_changes handlers are registered BEFORE subscribe().
   */
  public subscribeToOperationalChanges(
    channelPrefix: string,
    tables: Array<'vehicles' | 'incidents' | 'incident_resources' | 'vehicle_status_history' | 'emergency_reports' | 'ai_audit_logs' | 'audit_logs' | 'notifications'>,
    onPayload: RealtimeCallback,
    customClient?: any,
    onStatusChange?: (status: string) => void
  ): { unsubscribe: () => Promise<void>; channel: RealtimeChannel } {
    const client = customClient || supabase;

    // Clean up any existing channel registered under this key
    if (this.activeChannels.has(channelPrefix)) {
      const existingChannel = this.activeChannels.get(channelPrefix)!;
      try {
        client.removeChannel(existingChannel);
      } catch (err) {
        console.warn(`[Supabase Realtime] Could not cleanly remove old channel for ${channelPrefix}:`, err);
      }
      this.activeChannels.delete(channelPrefix);
    }

    // Generate unique topic to guarantee a fresh, un-subscribed channel instance from Supabase client
    const uniqueChannelName = `${channelPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let channel: RealtimeChannel;

    try {
      channel = client.channel(uniqueChannelName);

      // Register ALL postgres_changes handlers BEFORE calling subscribe()
      for (const table of tables) {
        channel = channel.on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table,
          },
          (payload: any) => {
            onPayload({
              eventType: payload.eventType,
              table: payload.table,
              new: payload.new || {},
              old: payload.old || {},
              commit_timestamp: payload.commit_timestamp,
            });
          }
        );
      }

      // Call subscribe() exactly once AFTER all listeners are registered
      channel.subscribe((status: string, err?: Error) => {
        if (onStatusChange) {
          onStatusChange(status);
        }
        if (status === 'SUBSCRIBED') {
          console.log(`[Supabase Realtime] Subscribed to '${uniqueChannelName}' for tables: ${tables.join(', ')}`);
        } else if (status === 'CLOSED') {
          console.log(`[Supabase Realtime] Channel '${uniqueChannelName}' closed.`);
        } else if (status === 'CHANNEL_ERROR') {
          console.warn(`[Supabase Realtime] Channel error on '${uniqueChannelName}':`, err);
        }
      });

      this.activeChannels.set(channelPrefix, channel);
    } catch (err) {
      console.error(`[Supabase Realtime] Setup error on '${channelPrefix}':`, err);
      channel = client.channel(uniqueChannelName);
    }

    const unsubscribe = async () => {
      try {
        await client.removeChannel(channel);
        this.activeChannels.delete(channelPrefix);
        console.log(`[Supabase Realtime] Unsubscribed channel '${uniqueChannelName}'.`);
      } catch (err) {
        console.warn(`[Supabase Realtime] Unsubscribe warning on '${uniqueChannelName}':`, err);
      }
    };

    return { unsubscribe, channel };
  }

  /**
   * Cleans up all active subscriptions.
   */
  public async cleanupAll(customClient?: any): Promise<void> {
    const client = customClient || supabase;
    for (const [name, channel] of this.activeChannels.entries()) {
      try {
        await client.removeChannel(channel);
        console.log(`[Supabase Realtime] Cleaned up channel '${name}'.`);
      } catch (err) {
        console.warn(`[Supabase Realtime] Cleanup error on '${name}':`, err);
      }
    }
    this.activeChannels.clear();
  }
}

export const realtimeService = new RealtimeService();
