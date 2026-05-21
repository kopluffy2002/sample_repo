import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class MessageService implements OnDestroy {
  private apiUrl = environment.apiUrl;
  private socket: Socket;

  constructor(private http: HttpClient) {
    // ── Connect to Socket.io (not raw WebSocket) ──────────────────────────────
    this.socket = io(this.apiUrl, {
      transports: ['websocket', 'polling'], // try websocket first, fallback to polling
      autoConnect: true,
    });
  }

  // ── Register the logged-in user so targeted emits work ────────────────────
  registerUser(username: string): void {
    this.socket.emit('register', username);
  }

  // ── Listen for incoming direct messages ───────────────────────────────────
  onMessage(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on('message', (message) => {
        observer.next(message);
      });
      return () => this.socket.off('message');
    });
  }

  // ── Listen for incoming group messages ────────────────────────────────────
  onGroupMessage(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on('group-message', (message) => {
        observer.next(message);
      });
      return () => this.socket.off('group-message');
    });
  }

  // ── Listen for notifications ──────────────────────────────────────────────
  onNotification(): Observable<any> {
    return new Observable((observer) => {
      this.socket.on('notification', (notification) => {
        observer.next(notification);
      });
      return () => this.socket.off('notification');
    });
  }

  // ── HTTP calls ────────────────────────────────────────────────────────────
  sendMessage(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages`, data);
  }

  getChatMessages(username: string, friend: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/messages/${username}/${friend}`,
    );
  }

  sendGroupMessage(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/group-messages`, data);
  }

  getGroupChatMessages(group: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/group-messages/${group}`);
  }

  uploadFiles(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  // ── Cleanup on service destroy ────────────────────────────────────────────
  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
