
import { db, getUnsyncedCount, markAllAsSynced } from './db';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'error';
type SyncCallback = (status: SyncStatus, pendingCount: number) => void;

class SyncService {
  private listeners: SyncCallback[] = [];
  private status: SyncStatus = navigator.onLine ? 'online' : 'offline';
  private pendingCount: number = 0;

  constructor() {
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
    // Initial check
    this.checkPending();
  }

  private handleNetworkChange = () => {
    this.status = navigator.onLine ? 'online' : 'offline';
    this.notify();
    if (this.status === 'online') {
      this.attemptSync();
    }
  };

  public async checkPending() {
    this.pendingCount = await getUnsyncedCount();
    this.notify();
  }

  public subscribe(callback: SyncCallback) {
    this.listeners.push(callback);
    callback(this.status, this.pendingCount);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.status, this.pendingCount));
  }

  public async attemptSync() {
    if (this.status === 'offline') return;

    // Re-check pending count before starting
    const count = await getUnsyncedCount();
    if (count === 0) return;

    this.status = 'syncing';
    this.pendingCount = count;
    this.notify();

    try {
      // --- SIMULATED API CALL ---
      // In a real app, you would fetch dirty records and POST to an API
      // const unsyncedStations = await db.stations.where({synced: false}).toArray();
      // await api.post('/sync', { stations: unsyncedStations });
      
      console.log(`Syncing ${count} records to server...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate latency

      // If successful, mark local DB as synced
      await markAllAsSynced();
      
      this.pendingCount = 0;
      this.status = 'online';
      this.notify();
    } catch (error) {
      console.error("Sync failed", error);
      this.status = 'error';
      this.notify();
      // Revert to online state after 3 seconds so user can try again
      setTimeout(() => {
        this.status = navigator.onLine ? 'online' : 'offline';
        this.notify();
      }, 3000);
    }
  }
}

export const syncService = new SyncService();
