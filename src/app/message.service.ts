
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  openWebSocket(): Observable<any> {
    const ws = new WebSocket('http://localhost:3000'.replace(/^http/, 'ws') + '/ws');

    return new Observable(observer => {
      ws.onopen = (event) => {
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        observer.next(message);
      };

      ws.onerror = (error) => {
        observer.error(error);
      };

      ws.onclose = () => {
        observer.complete();
      };

      return () => {
        ws.close();
      };
    });
  }

  sendMessage(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/messages`, data);
  }

  getChatMessages(username: string, friend: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/messages/${username}/${friend}`);
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
}
