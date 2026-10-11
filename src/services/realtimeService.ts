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
   */
  public subscribeToOperationalChanges(
    channelName: string,
    tables: Array<'vehicles' | 'incidents' | 'incident_resources' | 'vehicle_status_history' | 'emergency_reports' | 'ai_audit_logs' | 'audit_logs'>,
    onPayload: RealtimeCallback,
    customClient?: any
  ): { unsubscribe: () => Promise<void>; channel: RealtimeChannel } {
    const client = customClient || supabase;

    if (this.activeChannels.has(channelName)) {
      const existingChannel = this.activeChannels.get(channelName)!;
      return {
        unsubscribe: async () => {
          await client.removeChannel(existingChannel);
          this.activeChannels.delete(channelName);
        },
        channel: existingChannel,
      };
    }

    let channel = client.channel(channelName);

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

    channel.subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Supabase Realtime] Subscribed to channel '${channelName}' for tables: ${tables.join(', ')}`);
      } else if (status === 'CLOSED') {
        console.log(`[Supabase Realtime] Channel '${channelName}' closed.`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Supabase Realtime] Error on channel '${channelName}':`, err);
      }
    });

    this.activeChannels.set(channelName, channel);

    const unsubscribe = async () => {
      if (this.activeChannels.has(channelName)) {
        await client.removeChannel(channel);
        this.activeChannels.delete(channelName);
        console.log(`[Supabase Realtime] Unsubscribed channel '${channelName}'.`);
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
      await client.removeChannel(channel);
      console.log(`[Supabase Realtime] Cleaned up channel '${name}'.`);
    }
    this.activeChannels.clear();
  }
}

export const realtimeService = new RealtimeService();
