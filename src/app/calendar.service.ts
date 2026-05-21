import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private apiUrl = environment.apiUrl; // ← pulls from environment file automatically

  constructor(private http: HttpClient) {}

  addMeeting(meetingData: any) {
    return this.http.post(`${this.apiUrl}/calendar`, meetingData);
  }

  getMeetings(username: string) {
    return this.http.get<any[]>(
      `${this.apiUrl}/calendar/meetings?username=${username}`,
    );
  }
  getEvents(username: string) {
    return this.http.get<any[]>(
      `${this.apiUrl}/calendar/events?username=${username}`,
    );
  }

  updateMeeting(sno: number, updatedMeeting: any, username: string) {
    const url = `${this.apiUrl}/calendar/${sno}?username=${username}`; // Include username in the URL
    return this.http.put(url, updatedMeeting);
  }

  deleteMeeting(sno: number, username: string) {
    const url = `${this.apiUrl}/calendar/${sno}?username=${username}`; // Include username in the URL
    return this.http.delete(url);
  }
}
