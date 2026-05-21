import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  private apiUrl = environment.apiUrl; // ← pulls from environment file automatically

  constructor(private http: HttpClient) {}

  addclass(eventData: any) {
    return this.http.post(`${this.apiUrl}/account`, eventData);
  }

  getCourseCodesByPrefix(prefix: string) {
    return this.http.get<string[]>(
      `${this.apiUrl}/account/codes?prefix=${prefix}`,
    );
  }

  updateclass(sno: number, updatedEvent: any) {
    return this.http.put(`${this.apiUrl}/account/${sno}`, updatedEvent);
  }

  deleteClass(sno: number, username: string) {
    const url = `${this.apiUrl}/account/${sno}?username=${username}`;
    return this.http.delete(url);
  }

  getEvents(username: string) {
    return this.http.get<any[]>(
      `${this.apiUrl}/account/events?username=${username}`,
    );
  }

  getMeetings(username: string) {
    return this.http.get<any[]>(
      `${this.apiUrl}/account/meetings?username=${username}`,
    );
  }
}
