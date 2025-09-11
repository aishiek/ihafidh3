import { AppState, AppStateStatus } from 'react-native';
import type { NativeEventSubscription } from 'react-native';

class ActiveTimeTracker {
  private startTime: number | null = null;
  private totalActiveTime: number = 0;
  private isActive: boolean = false;
  private appStateSubscription: NativeEventSubscription | null = null;
  
  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // React Native AppState events
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      this.resumeTracking();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.pauseTracking();
    }
  }

  public startTracking(): void {
    if (!this.isActive) {
      this.startTime = Date.now();
      this.isActive = true;
      console.log('✅ Active Time Tracker: Started tracking active Quran reading time');
    }
  }

  public pauseTracking(): void {
    if (this.isActive && this.startTime) {
      const sessionTime = Date.now() - this.startTime;
      this.totalActiveTime += sessionTime;
      this.isActive = false;
      this.startTime = null;
      console.log(`⏸️ Active Time Tracker: Paused tracking. Session time: ${this.formatTime(sessionTime)} | Total: ${this.formatTime(this.totalActiveTime)}`);
    }
  }

  public resumeTracking(): void {
    if (!this.isActive) {
      this.startTime = Date.now();
      this.isActive = true;
      console.log('▶️ Active Time Tracker: Resumed tracking active reading time');
    }
  }

  public stopTracking(): void {
    if (this.isActive && this.startTime) {
      const sessionTime = Date.now() - this.startTime;
      this.totalActiveTime += sessionTime;
      this.isActive = false;
      this.startTime = null;
      console.log(`⏹️ Active Time Tracker: Stopped tracking. Final session: ${this.formatTime(sessionTime)} | Total: ${this.formatTime(this.totalActiveTime)}`);
    }
  }

  public resetTracking(): void {
    this.stopTracking();
    this.totalActiveTime = 0;
    console.log('Reset tracking time to 0');
  }

  public getTotalActiveTime(): number {
    let currentTotal = this.totalActiveTime;
    
    // Add current session time if actively tracking
    if (this.isActive && this.startTime) {
      currentTotal += Date.now() - this.startTime;
    }
    
    return currentTotal;
  }

  public getTotalActiveTimeInSeconds(): number {
    return Math.floor(this.getTotalActiveTime() / 1000);
  }

  public getTotalActiveTimeFormatted(): string {
    return this.formatTime(this.getTotalActiveTime());
  }

  public getCurrentSessionTime(): number {
    if (this.isActive && this.startTime) {
      return Date.now() - this.startTime;
    }
    return 0;
  }

  public getCurrentSessionTimeInSeconds(): number {
    return Math.floor(this.getCurrentSessionTime() / 1000);
  }

  public isCurrentlyActive(): boolean {
    return this.isActive;
  }

  private formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  public cleanup(): void {
    this.stopTracking();
    
    // Remove event listeners
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  // Methods to integrate with existing activity store
  public commitTimeToStore(commitCallback: (timeInSeconds: number) => void): void {
    if (this.totalActiveTime > 0) {
      const timeInSeconds = this.getTotalActiveTimeInSeconds();
      commitCallback(timeInSeconds);
      this.totalActiveTime = 0; // Reset after committing
      console.log(`Committed ${timeInSeconds} seconds to store`);
    }
  }

  public getSessionStats() {
    return {
      totalTime: this.getTotalActiveTime(),
      totalTimeSeconds: this.getTotalActiveTimeInSeconds(),
      totalTimeFormatted: this.getTotalActiveTimeFormatted(),
      currentSession: this.getCurrentSessionTime(),
      currentSessionSeconds: this.getCurrentSessionTimeInSeconds(),
      isActive: this.isCurrentlyActive()
    };
  }
}

// Usage class for Quran app
class QuranActiveTimeManager {
  private timeTracker: ActiveTimeTracker;
  private updateInterval: NodeJS.Timeout | null = null;
  private onTimeUpdateCallback: ((stats: any) => void) | null = null;

  constructor() {
    this.timeTracker = new ActiveTimeTracker();
  }

  public startReading(onTimeUpdate?: (stats: any) => void): void {
    console.log('User started reading Quran');
    this.timeTracker.startTracking();
    this.onTimeUpdateCallback = onTimeUpdate || null;
    
    // Update display every second if callback provided
    if (this.onTimeUpdateCallback) {
      this.updateInterval = setInterval(() => {
        this.onTimeUpdateCallback!(this.timeTracker.getSessionStats());
      }, 1000);
    }
  }

  public pauseReading(): void {
    console.log('User paused reading');
    this.timeTracker.pauseTracking();
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public stopReading(commitToStore?: (timeInSeconds: number) => void): void {
    console.log('User stopped reading');
    this.timeTracker.stopTracking();
    
    // Commit time to store if callback provided
    if (commitToStore) {
      this.timeTracker.commitTimeToStore(commitToStore);
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public getStats() {
    return this.timeTracker.getSessionStats();
  }

  public cleanup(): void {
    this.timeTracker.cleanup();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export { ActiveTimeTracker, QuranActiveTimeManager };
