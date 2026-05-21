import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  sendFriendRequestNotification(
    sender: string,
    receiver: string,
  ): Observable<any> {
    const notification = {
      sender,
      receiver,
      content: `${sender} sent you a friend request`,
      component: 'friends',
    };
    return this.http.post(`${this.apiUrl}/notifications`, notification);
  }

  sendFriendRequestAcceptedNotification(
    sender: string,
    receiver: string,
  ): Observable<any> {
    const notification = {
      sender,
      receiver,
      content: `${sender} accepted your friend request`,
      component: 'friends',
    };
    // ← Fixed: was '/notifications/:username/:friendUsername' (literal string!)
    return this.http.post(
      `${this.apiUrl}/notifications/${receiver}/${sender}`,
      notification,
    );
  }

  sendMeetingNotification(
    sender: string,
    receiver: string,
    meetingData: any,
  ): Observable<any> {
    const notification = {
      sender,
      receiver,
      content: `${sender} added a meeting: ${meetingData.meetingName} on ${meetingData.date} from ${meetingData.startTime} to ${meetingData.endTime}`,
      component: 'calendar',
    };
    return this.http.post(`${this.apiUrl}/notifications/meeting`, notification);
  }

  getNotificationsForUser(username: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications/${username}`);
  }

  closeNotification(username: string, sno: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/notifications/${username}/${sno}`,
    );
  }

  clearNotifications(username: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/notifications/clear/${username}`,
    );
  }
}
